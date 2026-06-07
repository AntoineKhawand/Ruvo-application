import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated, Dimensions, Image, KeyboardAvoidingView,
    Modal, Platform, ScrollView, StatusBar, StyleSheet, Switch, Text,
    TextInput, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import MapView, { Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from '../components/Map';
import { useUser } from '../context/UserContext';
import { sanitizeInput } from '../utils/sanitize';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';
import { syncRunToHealth } from '../services/healthService';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import AnimatedCounter from '../components/AnimatedCounter';
import AchievementOverlay from '../components/AchievementOverlay';

const { width, height } = Dimensions.get('window');

const ACCENT = '#CCFF00';

const ruvoLogoImg = require('../../assets/images/Ruvo Logo Original.png');

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2C2C2C' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
];

const getHrZone = (hr, age = 30) => {
    if (!hr || hr === '--') return { zone: 0, color: '#8E8E93', name: 'Resting', pct: 0 };
    const maxHr = 220 - age;
    const pct = hr / maxHr;
    if (pct >= 0.9) return { zone: 5, color: '#FF3B30', name: 'Max', pct };
    if (pct >= 0.8) return { zone: 4, color: '#FF9500', name: 'Threshold', pct };
    if (pct >= 0.7) return { zone: 3, color: '#FFCC00', name: 'Aerobic', pct };
    if (pct >= 0.6) return { zone: 2, color: '#34C759', name: 'Fat Burn', pct };
    if (pct >= 0.5) return { zone: 1, color: '#5AC8FA', name: 'Warm Up', pct };
    return { zone: 0, color: '#8E8E93', name: 'Light', pct };
};

const ZONE_COLORS = ['#5AC8FA', '#34C759', '#FFCC00', '#FF9500', '#FF3B30'];

const generateAIInsight = (data) => {
    const dist = data.distance || 0;
    const paceStr = data.pace || '0:00';
    const [min, sec] = paceStr.split(':').map(Number);
    const paceVal = min + (sec / 60);
    const rpe = data.effortRating || data.rpe || 5;
    const hour = new Date().getHours();

    if (dist >= 10) {
        if (paceVal < 5.5) return 'Impressive endurance & speed combo. Your ability to hold this pace over a long distance indicates a high VO₂ Max. Focus on hydration now.';
        return 'Solid aerobic endurance session. Covering this distance builds significant mitochondrial density. Great job building your base!';
    }
    if (paceVal > 0 && paceVal < 5.0) return 'Speed demon! 🚀 You\'re training your fast-twitch muscle fibers effectively. This session greatly improves your leg turnover and running economy.';
    if (rpe <= 4 || (dist < 3 && dist > 0)) return 'Perfect active recovery. Keeping the intensity low today puts \'money in the bank\' for your next hard session while flushing out metabolic waste.';
    if (rpe >= 8) return 'High intensity effort detected! 💥 You\'ve pushed your anaerobic threshold today. Expect an afterburn effect (EPOC). Ensure you sleep 8+ hours tonight.';
    if (hour < 9) return 'Early riser! ☀️ Fasted morning runs improve your body\'s efficiency at burning fat for fuel. A great way to jumpstart your metabolism.';
    return 'Consistent effort. You maintained a steady rhythm which is key for long-term progression — improving your running economy step by step.';
};

// ─── Confetti burst for modal ─────────────────────────────────────
const ConfettiDot = ({ startX, startY, color, delay, angle, size, isRect, spread }) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1, duration: 1150, useNativeDriver: true }),
        ]).start();
    }, []);
    const r = spread || 120;
    const dx = Math.sin(angle) * r;
    const dy = -Math.abs(Math.cos(angle)) * r * 1.4 - 50;
    return (
        <Animated.View style={{
            position: 'absolute',
            left: startX - size / 2,
            top: startY - size / 2,
            width: size,
            height: isRect ? Math.round(size * 0.45) : size,
            borderRadius: isRect ? 2 : size / 2,
            backgroundColor: color,
            opacity: anim.interpolate({ inputRange: [0, 0.08, 0.65, 1], outputRange: [0, 1, 0.9, 0] }),
            transform: [
                { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
                { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${Math.round(angle * 360 / Math.PI)}deg`] }) },
                { scale: anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1.4, 1.1, 0.5] }) },
            ],
        }} />
    );
};

const CONFETTI_COLORS = [ACCENT, '#FFD700', '#FF6B6B', '#60A5FA', '#FF9500', '#E040FB', '#AADD00'];
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
    startX: width / 2,
    startY: height * 0.27,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i * 38) % 320,
    angle: (i / 22) * Math.PI * 2,
    size: 7 + (i % 4) * 3,
    isRect: i % 4 === 1,
    spread: 100 + (i % 5) * 22,
}));

// ─── Stat cell ────────────────────────────────────────────────────
const StatCell = ({ icon, isMci, label, value, color = '#FFF', accent }) => (
    <View style={styles.statCell}>
        <View style={[styles.statCellIcon, accent && { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
            {isMci
                ? <MaterialCommunityIcons name={icon} size={16} color={accent || '#888'} />
                : <Ionicons name={icon} size={16} color={accent || '#888'} />}
        </View>
        <Text style={[styles.statCellValue, { color }]}>{value}</Text>
        <Text style={styles.statCellLabel}>{label}</Text>
    </View>
);

function getGreetingTime() {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 18) return 'Afternoon';
    return 'Evening';
}

export default function SaveActivityScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();
    const { userData, addPost, addRunToHistory } = useUser();

    const storyViewRef  = useRef(null);
    const routeViewRef  = useRef(null);
    const mapFadeAnim   = useRef(new Animated.Value(0)).current;

    const { runData } = route.params || {
        runData: { distance: 0, time: '00:00', pace: '--', calories: 0, heartRate: '--', routePath: [], initialRegion: null, rpe: 5 }
    };

    const [title, setTitle]               = useState(getGreetingTime() + ' Run');
    const [description, setDescription]   = useState('');
    const [activityType, setActivityType] = useState('Run');
    const [activityTag, setActivityTag]   = useState('None');
    const [gear, setGear]                 = useState(userData?.gearList?.find(g => g.isDefault)?.name || 'Default Shoes');
    const [privateNotes, setPrivateNotes] = useState('');
    const [visibility, setVisibility]     = useState('Everyone');
    const [isMuted, setIsMuted]           = useState(false);
    const [hideMap, setHideMap]           = useState(false);
    const [notesModalVisible, setNotesModalVisible] = useState(false);
    const [selectedImage, setSelectedImage]         = useState(null);
    const [isSaving, setIsSaving]                   = useState(false);

    const [earnedBadges, setEarnedBadges]     = useState([]);
    const [badgeModalVisible, setBadgeModalVisible] = useState(false);
    const [earnedStats, setEarnedStats]       = useState({ coins: 0, xp: 0, coinBreakdown: null });
    const [isPhantomMapReady, setIsPhantomMapReady] = useState(false);
    const [isRouteCardReady, setIsRouteCardReady]   = useState(false);
    const [weather, setWeather]               = useState({ temp: '--°C', icon: 'weather-cloudy' });
    const [runCity, setRunCity]               = useState('');
    const [achievementVisible, setAchievementVisible] = useState(false);
    const [currentBadge, setCurrentBadge]     = useState(null);
    const [isPersonalBest, setIsPersonalBest] = useState(false);

    const xpBarAnim      = useRef(new Animated.Value(0)).current;
    const modalSlideAnim = useRef(new Animated.Value(70)).current;
    const modalFadeAnim  = useRef(new Animated.Value(0)).current;
    const glowPulse      = useRef(new Animated.Value(0.55)).current;
    const glowLoopRef    = useRef(null);

    const mapRegion = useMemo(() => {
        if (runData.initialRegion) return runData.initialRegion;
        const path = runData.routePath;
        if (path?.length > 0) {
            const mid = path[Math.floor(path.length / 2)];
            return { latitude: mid.latitude, longitude: mid.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        }
        return null;
    }, [runData]);

    const hrZone  = getHrZone(runData.heartRate, userData?.age);
    const insight = generateAIInsight(runData);

    useEffect(() => {
        fetchLocalWeather();
        if (mapRegion) {
            Location.reverseGeocodeAsync({ latitude: mapRegion.latitude, longitude: mapRegion.longitude })
                .then(places => {
                    if (places?.[0]) {
                        const p = places[0];
                        const parts = [p.district || p.city || p.subregion, p.country].filter(Boolean);
                        if (parts.length) setRunCity(parts.join(', '));
                    }
                }).catch(() => {});
        }
        Animated.timing(mapFadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    useEffect(() => {
        if (badgeModalVisible) {
            modalSlideAnim.setValue(70);
            modalFadeAnim.setValue(0);
            xpBarAnim.setValue(0);
            glowPulse.setValue(0.55);
            Animated.parallel([
                Animated.spring(modalSlideAnim, { toValue: 0, tension: 68, friction: 11, useNativeDriver: true }),
                Animated.timing(modalFadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
            ]).start(() => {
                Animated.timing(xpBarAnim, { toValue: 1, duration: 1300, delay: 150, useNativeDriver: false }).start();
                glowLoopRef.current = Animated.loop(
                    Animated.sequence([
                        Animated.timing(glowPulse, { toValue: 1, duration: 950, useNativeDriver: true }),
                        Animated.timing(glowPulse, { toValue: 0.55, duration: 950, useNativeDriver: true }),
                    ])
                );
                glowLoopRef.current.start();
            });
        } else {
            glowLoopRef.current?.stop();
        }
    }, [badgeModalVisible]);

    const fetchLocalWeather = async () => {
        if (!mapRegion) return;
        const { latitude, longitude } = mapRegion;
        try {
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=is_day&timezone=auto`);
            const data = await response.json();
            if (data.current_weather) {
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;
                const isDay = data.hourly?.is_day?.[new Date().getHours()] === 1;
                let icon = code === 0 ? (isDay ? 'weather-sunny' : 'moon') : code <= 3 ? (isDay ? 'weather-partly-cloudy' : 'moon-outline') : 'weather-rainy';
                setWeather({ temp: `${temp}°C`, icon });
            }
        } catch (_) {}
    };

    const pickImage = async () => {
        lightTap();
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Denied', 'Allow access to your gallery to add photos to your run.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
        if (!result.canceled) setSelectedImage(result.assets[0].uri);
    };

    const handleSave = async () => {
        if (isSaving) return;
        lightTap();
        setIsSaving(true);

        const sanitizedTitle       = sanitizeInput(title) || getGreetingTime() + ' Run';
        const sanitizedDescription = sanitizeInput(description) || '';
        const sanitizedNotes       = sanitizeInput(privateNotes) || '';
        const activeShoe           = userData?.gearList?.find(g => g.name === gear);

        let uploadedImageUrl = null;
        if (selectedImage) {
            try {
                const blob = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', selectedImage);
                    xhr.responseType = 'blob';
                    xhr.onload = () => xhr.status === 200 ? resolve(xhr.response) : reject(new Error('Failed: ' + xhr.status));
                    xhr.onerror = () => reject(new Error('Network error'));
                    xhr.send();
                });
                const imageRef = ref(storage, `runPhotos/${userData.uid || 'unknown'}/${Date.now()}.jpg`);
                await uploadBytes(imageRef, blob);
                uploadedImageUrl = await getDownloadURL(imageRef);
            } catch (imageError) {
                console.error('Image Upload Error:', imageError);
                setIsSaving(false);
                Alert.alert('Upload Failed', 'Could not upload your photo. Please try again or remove the photo.');
                return;
            }
        }

        const newActivity = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            distance: runData.distance || 0,
            duration: runData.time || '00:00',
            pace: runData.pace || '0:00',
            calories: runData.calories || 0,
            heartRate: runData.heartRate || 0,
            rpe: runData.effortRating || 5,
            tags: runData.tags || [],
            routePath: runData.routePath || [],
            initialRegion: runData.initialRegion,
            kmSplits: runData.kmSplits || [],
            elevationGain: runData.elevationGain || 0,
            image: uploadedImageUrl,
            title: sanitizedTitle,
            description: sanitizedDescription,
            privateNotes: sanitizedNotes,
            activityType, activityTag, visibility, isMuted, hideMap,
            mapImage: null,
            gearId: activeShoe?.id || null,
            gearName: gear,
            weather,
            aiInsight: insight,
        };

        const currentTotalKm = userData.totalKm || 0;
        let updatedGearList  = userData.gearList || [];
        if (activeShoe) {
            updatedGearList = userData.gearList.map(shoe =>
                shoe.id === activeShoe.id ? { ...shoe, distance: (shoe.distance || 0) + newActivity.distance } : shoe
            );
        }
        const calculatedUpdates = { totalKm: currentTotalKm + newActivity.distance, earningUnlockProgress: currentTotalKm + newActivity.distance, gearList: updatedGearList };

        try {
            const prevMaxDist = Math.max(0, ...(userData.runHistory || []).map(r => parseFloat(r.distance) || 0));
            const result = await addRunToHistory(newActivity, calculatedUpdates) || {};

            if (result.queued) {
                Alert.alert('Saved Offline', "No internet connection. Your run has been saved and will sync automatically when you're back online.", [{ text: 'OK' }]);
                navigation.goBack();
                return;
            }
            if (result.success === false) {
                setIsSaving(false);
                Alert.alert('Save Failed', 'Could not save your run. Please check your connection and try again.');
                return;
            }

            const { newBadges = [], earnedXp = 0, earnedCoins = 0, coinBreakdown, levelsGained = 0, newLevel = 1 } = result;

            if (!isMuted && visibility !== 'Only Me' && addPost) {
                const compressRoute = (path) => {
                    if (!path?.length) return [];
                    const clean = path.map(({ latitude, longitude }) => ({ latitude, longitude }));
                    if (clean.length <= 150) return clean;
                    const step = Math.ceil(clean.length / 150);
                    const sampled = clean.filter((_, i) => i % step === 0);
                    if (sampled[sampled.length - 1] !== clean[clean.length - 1]) sampled.push(clean[clean.length - 1]);
                    return sampled;
                };
                await addPost({
                    userId: userData.uid || 'unknown', user: userData.name, avatar: userData.avatar, level: userData.level,
                    title: sanitizedTitle || 'Running Workout', description: sanitizedDescription || '',
                    stats: { km: newActivity.distance.toFixed(2), pace: newActivity.pace, time: newActivity.duration },
                    image: uploadedImageUrl || null, badge: newBadges.length > 0 ? newBadges[0] : null,
                    gear, activityTag, hideMap, routePath: hideMap ? [] : compressRoute(newActivity.routePath), initialRegion: newActivity.initialRegion,
                });
            }

            await syncRunToHealth(newActivity);
            setIsSaving(false);
            successFeedback();
            setEarnedStats({ coins: earnedCoins, xp: earnedXp, coinBreakdown: coinBreakdown || null });
            setEarnedBadges(newBadges || []);
            setIsPersonalBest((userData.runHistory || []).length > 0 && newActivity.distance > prevMaxDist);

            if (levelsGained > 0) {
                Alert.alert('Level Up!', `You reached Level ${newLevel}! Keep running to unlock more rewards.`, [{ text: "Let's Go!" }]);
            }

            if (newBadges?.length > 0) {
                setCurrentBadge({ name: newBadges[0].name, description: newBadges[0].desc, icon: newBadges[0].icon, color: ACCENT });
                setAchievementVisible(true);
            } else {
                setBadgeModalVisible(true);
            }
        } catch (error) {
            console.error('Save Error:', error);
            errorFeedback();
            setIsSaving(false);
            Alert.alert('Save Failed', 'Could not save your run. Please try again.');
        }
    };

    const shareStoryWithMap = async () => {
        try {
            setIsPhantomMapReady(true);
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (storyViewRef.current) {
                const uri = await storyViewRef.current.capture({ height: Math.round(width * 16 / 9), width, result: 'tmpfile', quality: 1.0, format: 'jpg' });
                await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share your Run Story', UTI: 'public.jpeg' });
            }
        } catch (e) { console.error('Share (map) failed:', e); errorFeedback(); Alert.alert('Share Failed', 'Could not generate image. Please try again.'); }
        finally { setIsPhantomMapReady(false); }
    };

    const shareRouteCard = async () => {
        try {
            setIsRouteCardReady(true);
            await new Promise(resolve => setTimeout(resolve, 1200));
            if (routeViewRef.current) {
                const uri = await routeViewRef.current.capture({ height: Math.round(width * 16 / 9), width, result: 'tmpfile', quality: 1.0, format: 'jpg' });
                await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share your Route', UTI: 'public.jpeg' });
            }
        } catch (e) { console.error('Share (route) failed:', e); errorFeedback(); Alert.alert('Share Failed', 'Could not generate image. Please try again.'); }
        finally { setIsRouteCardReady(false); }
    };

    const handleShare = () => {
        lightTap();
        Alert.alert('Share Activity', 'Choose a style', [
            { text: 'Story (with Map)', onPress: shareStoryWithMap },
            { text: 'Route Card', onPress: shareRouteCard },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleDiscard    = () => { lightTap(); Alert.alert('Discard Activity?', "This run won't be saved.", [{ text: 'Cancel', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => { errorFeedback(); navigation.navigate('Home'); } }]); };
    const selectActivityType = () => { lightTap(); Alert.alert('Activity Type', '', [{ text: 'Run', onPress: () => setActivityType('Run') }, { text: 'Walk', onPress: () => setActivityType('Walk') }, { text: 'Hike', onPress: () => setActivityType('Hike') }, { text: 'Cancel', style: 'cancel' }]); };
    const selectActivityTag  = () => { lightTap(); Alert.alert('Select Tag', '', [{ text: 'None', onPress: () => setActivityTag('None') }, { text: 'Commute', onPress: () => setActivityTag('Commute') }, { text: 'Workout', onPress: () => setActivityTag('Workout') }, { text: 'Race', onPress: () => setActivityTag('Race') }, { text: 'Cancel', style: 'cancel' }]); };
    const selectGear = () => { lightTap(); const opts = (userData?.gearList || []).map(g => ({ text: g.name, onPress: () => setGear(g.name) })); opts.push({ text: 'Cancel', style: 'cancel' }); Alert.alert('Select Gear', '', opts); };
    const handleVisibility = () => { lightTap(); Alert.alert('Visibility', 'Who can view this activity?', [{ text: 'Everyone', onPress: () => setVisibility('Everyone') }, { text: 'Followers', onPress: () => setVisibility('Followers') }, { text: 'Only Me', onPress: () => setVisibility('Only Me') }, { text: 'Cancel', style: 'cancel' }]); };

    const coachPrompt = `I just finished a ${runData.distance?.toFixed(2)}km ${activityType.toLowerCase()} in ${runData.time} at ${runData.pace}/km pace.${runData.heartRate > 0 ? ` My average heart rate was ${Math.round(runData.heartRate)} BPM (${hrZone.name} zone).` : ''} RPE: ${runData.effortRating || runData.rpe || 5}/10. What should I focus on for my next training session based on this effort?`;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* ── HEADER ── */}
            <View style={styles.header}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={22} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Session Analysis</Text>
                    <Text style={styles.headerSub}>{activityType} · {runData.distance?.toFixed(2)} km</Text>
                </View>
                <TouchableOpacity activeOpacity={0.7} onPress={handleShare} style={styles.headerBtn}>
                    <Ionicons name="share-social-outline" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>
            <View style={styles.headerAccentLine} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── HERO DISTANCE ── */}
                <View style={styles.heroSection}>
                    <Text style={styles.heroDistance}>{runData.distance?.toFixed(2)}</Text>
                    <Text style={styles.heroUnit}>KILOMETERS</Text>
                    <View style={styles.heroMetaRow}>
                        <MaterialCommunityIcons name={weather.icon} size={13} color="#666" />
                        <Text style={styles.heroMeta}>{weather.temp}</Text>
                        {runCity ? (
                            <>
                                <Text style={styles.heroMetaDot}>·</Text>
                                <Ionicons name="location-outline" size={12} color="#666" />
                                <Text style={styles.heroMeta}>{runCity}</Text>
                            </>
                        ) : null}
                    </View>
                </View>

                {/* ── STATS GRID ── */}
                <View style={styles.statsGrid}>
                    <StatCell icon="timer-outline" label="TIME"     value={runData.time} accent={ACCENT} />
                    <View style={styles.statsGridDivider} />
                    <StatCell icon="speedometer-outline" label="AVG PACE" value={runData.pace} accent="#60A5FA" />
                    <View style={styles.statsGridDivider} />
                    <StatCell icon="flame" isMci label="CALORIES" value={Math.round(runData.calories) || '--'} accent="#FF6B6B" />
                    {runData.heartRate > 0 && runData.heartRate !== '--' ? (
                        <>
                            <View style={styles.statsGridDivider} />
                            <StatCell icon="heart-pulse" isMci label="AVG BPM" value={Math.round(runData.heartRate)} accent="#FF4081" />
                        </>
                    ) : null}
                </View>

                {/* ── MAP HERO ── */}
                <Animated.View style={[styles.mapHero, { opacity: mapFadeAnim }]}>
                    {mapRegion ? (
                        <MapView
                            style={StyleSheet.absoluteFill}
                            provider={PROVIDER_DEFAULT}
                            customMapStyle={darkMapStyle}
                            initialRegion={mapRegion}
                            scrollEnabled={false}
                            zoomEnabled={false}
                        >
                            {runData.routePath?.length > 0 && (
                                <Polyline coordinates={runData.routePath} strokeColor={ACCENT} strokeWidth={4} />
                            )}
                        </MapView>
                    ) : (
                        <View style={styles.mapEmpty}>
                            <Ionicons name="map-outline" size={32} color="#333" />
                            <Text style={styles.mapEmptyText}>No GPS data</Text>
                        </View>
                    )}
                    {/* Gradient overlay at bottom */}
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                        style={styles.mapGradient}
                    />
                    {/* Photo overlay button */}
                    <TouchableOpacity activeOpacity={0.85} style={styles.photoOverlayBtn} onPress={pickImage}>
                        {selectedImage ? (
                            <Image source={{ uri: selectedImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        ) : (
                            <>
                                <Ionicons name="camera" size={18} color="#FFF" />
                                <Text style={styles.photoOverlayText}>Add Photo</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* ── AI INSIGHT ── */}
                <LinearGradient colors={['#0D1A00', '#091000']} style={styles.aiCard}>
                    <View style={styles.aiCardHeader}>
                        <View style={styles.aiIconCircle}>
                            <MaterialCommunityIcons name="robot" size={16} color="#000" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.aiCardTitle}>RUVO AI INSIGHT</Text>
                            <Text style={styles.aiCardSub}>Session analysis</Text>
                        </View>
                        <View style={styles.aiLivePill}>
                            <View style={styles.aiLiveDot} />
                            <Text style={styles.aiLiveText}>LIVE</Text>
                        </View>
                    </View>
                    <Text style={styles.aiCardBody}>{insight}</Text>
                    <TouchableOpacity
                        style={styles.aiCoachBtn}
                        activeOpacity={0.8}
                        onPress={() => {
                            lightTap();
                            navigation.navigate('AICoach', { initialPrompt: coachPrompt });
                        }}
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color={ACCENT} />
                        <Text style={styles.aiCoachBtnText}>Ask AI Coach for next session plan</Text>
                        <Ionicons name="chevron-forward" size={13} color={ACCENT} />
                    </TouchableOpacity>
                </LinearGradient>

                {/* ── HR ZONE ── */}
                {runData.heartRate > 0 && runData.heartRate !== '--' && (
                    <View style={styles.hrCard}>
                        <View style={styles.hrCardHeader}>
                            <View style={[styles.hrZoneDot, { backgroundColor: hrZone.color }]} />
                            <Text style={styles.hrCardTitle}>Heart Rate Analysis</Text>
                            <Text style={[styles.hrZoneBadge, { color: hrZone.color }]}>
                                Zone {hrZone.zone} · {hrZone.name}
                            </Text>
                        </View>
                        <View style={styles.hrValueRow}>
                            <Text style={styles.hrValue}>{Math.round(runData.heartRate)}</Text>
                            <Text style={styles.hrUnit}>BPM</Text>
                        </View>
                        {/* 5-zone bar */}
                        <View style={styles.zoneBar}>
                            {ZONE_COLORS.map((c, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.zoneBarSegment,
                                        { backgroundColor: c, opacity: hrZone.zone === i + 1 ? 1 : 0.25 },
                                        hrZone.zone === i + 1 && styles.zoneBarActive,
                                    ]}
                                />
                            ))}
                        </View>
                        <View style={styles.zoneLabels}>
                            {['Warm Up', 'Fat Burn', 'Aerobic', 'Threshold', 'Max'].map((l, i) => (
                                <Text key={i} style={[styles.zoneLabel, hrZone.zone === i + 1 && { color: ZONE_COLORS[i], fontFamily: 'Poppins_700Bold' }]}>{l}</Text>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── TITLE / DESCRIPTION ── */}
                <View style={styles.inputCard}>
                    <TextInput
                        style={styles.titleInput}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Name your run"
                        placeholderTextColor="#444"
                        selectionColor={ACCENT}
                    />
                    <View style={styles.inputDivider} />
                    <TextInput
                        style={styles.descInput}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="How did it feel? Add a note…"
                        placeholderTextColor="#444"
                        multiline
                        selectionColor={ACCENT}
                    />
                </View>

                {/* ── ACTIVITY TYPE ── */}
                <TouchableOpacity activeOpacity={0.7} style={styles.typeRow} onPress={selectActivityType}>
                    <View style={styles.typeIconCircle}>
                        <MaterialCommunityIcons
                            name={activityType === 'Run' ? 'shoe-print' : activityType === 'Hike' ? 'hiking' : 'walk'}
                            size={16} color="#000"
                        />
                    </View>
                    <Text style={styles.typeText}>{activityType}</Text>
                    <Ionicons name="chevron-down" size={16} color="#555" />
                </TouchableOpacity>

                {/* ── DETAILS ── */}
                <Text style={styles.sectionHeader}>Details</Text>
                <View style={styles.sectionCard}>
                    <TouchableOpacity activeOpacity={0.7} style={styles.settingRow} onPress={selectActivityTag}>
                        <View style={styles.settingLeft}>
                            <View style={styles.settingIconBox}><Ionicons name="pricetag-outline" size={16} color="#888" /></View>
                            <Text style={styles.settingLabel}>Activity Tag</Text>
                        </View>
                        <View style={styles.settingRight}>
                            <Text style={styles.settingValue}>{activityTag}</Text>
                            <Ionicons name="chevron-forward" size={15} color="#444" />
                        </View>
                    </TouchableOpacity>
                    <View style={styles.rowDivider} />
                    <TouchableOpacity activeOpacity={0.7} style={styles.settingRow} onPress={() => setNotesModalVisible(true)}>
                        <View style={styles.settingLeft}>
                            <View style={styles.settingIconBox}><Ionicons name="document-text-outline" size={16} color="#888" /></View>
                            <Text style={styles.settingLabel}>Private Notes</Text>
                        </View>
                        <View style={styles.settingRight}>
                            <Text style={styles.settingValue}>{privateNotes ? 'Added' : ''}</Text>
                            <Ionicons name="chevron-forward" size={15} color="#444" />
                        </View>
                    </TouchableOpacity>
                    <View style={styles.rowDivider} />
                    <TouchableOpacity activeOpacity={0.7} style={styles.settingRow} onPress={selectGear}>
                        <View style={styles.settingLeft}>
                            <View style={styles.settingIconBox}><MaterialCommunityIcons name="shoe-sneaker" size={16} color="#888" /></View>
                            <Text style={styles.settingLabel}>Gear</Text>
                        </View>
                        <View style={styles.settingRight}>
                            <Text style={styles.settingValue}>{gear}</Text>
                            <Ionicons name="chevron-forward" size={15} color="#444" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* ── VISIBILITY ── */}
                <Text style={styles.sectionHeader}>Visibility</Text>
                <View style={styles.sectionCard}>
                    <TouchableOpacity activeOpacity={0.7} style={styles.settingRow} onPress={handleVisibility}>
                        <View style={styles.settingLeft}>
                            <View style={styles.settingIconBox}><Ionicons name="globe-outline" size={16} color="#888" /></View>
                            <Text style={styles.settingLabel}>Who can view</Text>
                        </View>
                        <View style={styles.settingRight}>
                            <Text style={styles.settingValue}>{visibility}</Text>
                            <Ionicons name="chevron-forward" size={15} color="#444" />
                        </View>
                    </TouchableOpacity>
                    <View style={styles.rowDivider} />
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <View style={styles.settingIconBox}><Ionicons name="eye-off-outline" size={16} color="#888" /></View>
                            <Text style={styles.settingLabel}>Hidden Details</Text>
                        </View>
                        <Switch value={hideMap} onValueChange={setHideMap} trackColor={{ false: '#2A2A2A', true: ACCENT }} thumbColor={hideMap ? '#000' : '#FFF'} />
                    </View>
                    <View style={styles.rowDivider} />
                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.settingLeft}>
                                <View style={styles.settingIconBox}><Ionicons name="volume-mute-outline" size={16} color="#888" /></View>
                                <View>
                                    <Text style={styles.settingLabel}>Mute Activity</Text>
                                    <Text style={styles.settingSubLabel}>{"Don't publish to feeds"}</Text>
                                </View>
                            </View>
                        </View>
                        <Switch value={isMuted} onValueChange={setIsMuted} trackColor={{ false: '#2A2A2A', true: ACCENT }} thumbColor={isMuted ? '#000' : '#FFF'} />
                    </View>
                </View>

                <TouchableOpacity activeOpacity={0.7} style={styles.discardBtn} onPress={handleDiscard}>
                    <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                    <Text style={styles.discardText}>Discard Activity</Text>
                </TouchableOpacity>

                <View style={{ height: 130 }} />
            </ScrollView>

            {/* ── SAVE FOOTER ── */}
            <View style={[styles.footer, { paddingBottom: Math.max(Platform.OS === 'ios' ? 28 : 16, insets.bottom) }]}>
                <TouchableOpacity activeOpacity={0.85} style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                    <LinearGradient colors={[ACCENT, '#AADD00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtnGradient}>
                        {isSaving ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#000" style={{ marginRight: 8 }} />
                                <Text style={styles.saveBtnText}>Save Activity</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* ── PRIVATE NOTES MODAL ── */}
            <Modal visible={notesModalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.notesModal}>
                        <View style={styles.notesModalHandle} />
                        <Text style={styles.notesModalTitle}>Private Notes</Text>
                        <Text style={styles.notesModalSub}>Only visible to you</Text>
                        <TextInput
                            style={styles.notesInput}
                            value={privateNotes}
                            onChangeText={setPrivateNotes}
                            placeholder="How did the session feel? Any injuries? Goals for next time…"
                            placeholderTextColor="#444"
                            multiline
                            autoFocus
                            selectionColor={ACCENT}
                        />
                        <TouchableOpacity activeOpacity={0.85} style={styles.notesDoneBtn} onPress={() => { lightTap(); setNotesModalVisible(false); }}>
                            <Text style={styles.notesDoneText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <AchievementOverlay
                visible={achievementVisible}
                badge={currentBadge}
                onDismiss={() => { successFeedback(); setAchievementVisible(false); setBadgeModalVisible(true); }}
            />

            {/* ── RUN SAVED MODAL ── */}
            <Modal visible={badgeModalVisible} transparent animationType="none" onRequestClose={() => setBadgeModalVisible(false)}>
                <View style={styles.savedOverlay}>
                    {/* Full-screen confetti burst */}
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        {CONFETTI.map((c, i) => <ConfettiDot key={i} {...c} />)}
                    </View>

                    <Animated.View style={[styles.savedCard, { transform: [{ translateY: modalSlideAnim }], opacity: modalFadeAnim }]}>
                        {/* Top neon flush */}
                        <LinearGradient colors={[ACCENT + '1A', 'transparent']} style={styles.savedTopGlow} />

                        {/* Pulsing checkmark */}
                        <View style={styles.savedCheckOuter}>
                            <Animated.View style={[styles.savedCheckPulse, {
                                opacity: glowPulse,
                                transform: [{ scale: glowPulse.interpolate({ inputRange: [0.55, 1], outputRange: [1, 1.28] }) }],
                            }]} />
                            <LinearGradient colors={[ACCENT, '#AADD00']} style={styles.savedCheckCircle}>
                                <Ionicons name={earnedBadges.length > 0 ? 'trophy' : 'checkmark'} size={28} color="#000" />
                            </LinearGradient>
                        </View>

                        {/* Title + date */}
                        <Text style={styles.savedTitle}>
                            {earnedBadges.length > 0 ? 'BADGE UNLOCKED' : 'RUN SAVED'}
                        </Text>
                        <Text style={styles.savedSubtitle}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'short' })} · {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </Text>

                        {/* Personal best banner */}
                        {isPersonalBest && (
                            <View style={styles.savedPBBanner}>
                                <Ionicons name="trophy" size={12} color="#FFD700" />
                                <Text style={styles.savedPBText}>NEW PERSONAL BEST DISTANCE!</Text>
                            </View>
                        )}

                        {/* Hero distance */}
                        <View style={styles.savedHeroRow}>
                            <Text style={styles.savedHeroValue}>{runData.distance?.toFixed(2)}</Text>
                            <Text style={styles.savedHeroUnit}>KM</Text>
                        </View>

                        {/* Stats strip */}
                        <View style={styles.savedStatsRow}>
                            <View style={styles.savedStatItem}>
                                <Ionicons name="time-outline" size={11} color="#555" style={{ marginBottom: 3 }} />
                                <Text style={styles.savedStatValue}>{runData.time}</Text>
                                <Text style={styles.savedStatLabel}>TIME</Text>
                            </View>
                            <View style={styles.savedStatDivider} />
                            <View style={styles.savedStatItem}>
                                <Ionicons name="speedometer-outline" size={11} color="#555" style={{ marginBottom: 3 }} />
                                <Text style={styles.savedStatValue}>{runData.pace}</Text>
                                <Text style={styles.savedStatLabel}>PACE</Text>
                            </View>
                            <View style={styles.savedStatDivider} />
                            <View style={styles.savedStatItem}>
                                <MaterialCommunityIcons name="fire" size={11} color="#555" style={{ marginBottom: 3 }} />
                                <Text style={styles.savedStatValue}>{Math.round(runData.calories) || '--'}</Text>
                                <Text style={styles.savedStatLabel}>KCAL</Text>
                            </View>
                        </View>

                        <View style={styles.savedSectionDivider} />

                        {/* Badge row */}
                        {earnedBadges.length > 0 && (
                            <View style={styles.savedBadgeRow}>
                                <View style={styles.savedBadgeIconCircle}>
                                    <MaterialCommunityIcons name={earnedBadges[0].icon} size={24} color={ACCENT} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.savedBadgeName}>{earnedBadges[0].name}</Text>
                                    <Text style={styles.savedBadgeDesc}>{earnedBadges[0].desc}</Text>
                                </View>
                            </View>
                        )}

                        {/* XP row + animated bar */}
                        <View style={styles.savedRewardHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="star" size={14} color={ACCENT} />
                                <Text style={styles.savedRewardHeaderLabel}>XP EARNED</Text>
                            </View>
                            <AnimatedCounter value={earnedStats.xp} prefix="+" suffix=" XP" style={styles.savedRewardHeaderValue} />
                        </View>
                        <View style={styles.savedXpBarBg}>
                            <Animated.View style={[styles.savedXpBarFill, {
                                width: xpBarAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', `${Math.min(100, Math.round(((earnedStats.xp || 0) / 200) * 100))}%`],
                                }),
                            }]} />
                        </View>

                        {/* Coins row */}
                        <View style={[styles.savedRewardHeaderRow, { marginTop: 14 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <MaterialCommunityIcons name="coins" size={14} color="#FFD700" />
                                <Text style={[styles.savedRewardHeaderLabel, { color: '#C8A200' }]}>COINS EARNED</Text>
                            </View>
                            <AnimatedCounter value={earnedStats.coins} prefix="+" style={[styles.savedRewardHeaderValue, { color: '#FFD700' }]} />
                        </View>

                        {/* Coin breakdown chips */}
                        {earnedStats.coinBreakdown && (
                            earnedStats.coinBreakdown.paceBonus > 0 ||
                            earnedStats.coinBreakdown.streakBonus > 0 ||
                            earnedStats.coinBreakdown.timeBonus !== 0
                        ) && (
                            <View style={styles.savedBreakdownRow}>
                                {earnedStats.coinBreakdown.paceBonus > 0 && <View style={styles.savedChip}><Text style={styles.savedChipText}>+{earnedStats.coinBreakdown.paceBonus} pace</Text></View>}
                                {earnedStats.coinBreakdown.streakBonus > 0 && <View style={styles.savedChip}><Text style={styles.savedChipText}>+{earnedStats.coinBreakdown.streakBonus} streak</Text></View>}
                                {earnedStats.coinBreakdown.timeBonus !== 0 && <View style={styles.savedChip}><Text style={styles.savedChipText}>{earnedStats.coinBreakdown.timeBonus > 0 ? `+${earnedStats.coinBreakdown.timeBonus} off-peak` : `${earnedStats.coinBreakdown.timeBonus} peak`}</Text></View>}
                            </View>
                        )}

                        <View style={[styles.savedSectionDivider, { marginTop: 16 }]} />

                        {/* AI Coach CTA */}
                        <TouchableOpacity
                            style={styles.savedCoachCta}
                            activeOpacity={0.8}
                            onPress={() => {
                                lightTap();
                                setBadgeModalVisible(false);
                                navigation.navigate('AICoach', { initialPrompt: coachPrompt });
                            }}
                        >
                            <MaterialCommunityIcons name="robot" size={16} color={ACCENT} />
                            <Text style={styles.savedCoachCtaText}>Plan my next session with AI</Text>
                            <Ionicons name="chevron-forward" size={14} color={ACCENT} />
                        </TouchableOpacity>

                        {/* Done */}
                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.claimBtn}
                            onPress={() => {
                                lightTap();
                                setBadgeModalVisible(false);
                                navigation.navigate('Home');
                            }}
                        >
                            <LinearGradient colors={[ACCENT, '#AADD00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.claimBtnGradient}>
                                <Text style={styles.claimBtnText}>GO TO HOME</Text>
                                <Ionicons name="arrow-forward" size={16} color="#000" style={{ marginLeft: 8 }} />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>

            {/* ── PHANTOM SHARE VIEWS ── */}
            {isRouteCardReady && (
                <ViewShot ref={routeViewRef} options={{ format: 'jpg', quality: 1.0 }} style={[styles.phantom, { backgroundColor: '#0A0A0A' }]}>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <MapView style={{ width: '100%', height: '60%', borderRadius: 16, overflow: 'hidden' }} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT} customMapStyle={darkMapStyle} initialRegion={mapRegion || { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 }} scrollEnabled={false} zoomEnabled={false} showsUserLocation={false} showsCompass={false} showsScale={false} showsBuildings={false} showsTraffic={false} showsIndoors={false} showsPointsOfInterest={false}>
                            {runData.routePath?.length > 0 && <Polyline coordinates={runData.routePath} strokeColor={ACCENT} strokeWidth={10} />}
                        </MapView>
                    </View>
                    <View style={{ position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' }}>
                        <Text style={{ color: '#FFF', fontSize: 60, fontFamily: 'Poppins_900Black', lineHeight: 68 }}>{runData.distance?.toFixed(2)}</Text>
                        <Text style={{ color: ACCENT, fontSize: 14, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 2, marginTop: -8 }}>KILOMETERS</Text>
                        <View style={{ flexDirection: 'row', gap: 30, marginTop: 18 }}>
                            <View style={{ alignItems: 'center' }}><Text style={{ color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold' }}>{runData.pace}</Text><Text style={{ color: '#888', fontSize: 10, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1 }}>PACE</Text></View>
                            <View style={{ alignItems: 'center' }}><Text style={{ color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold' }}>{runData.time}</Text><Text style={{ color: '#888', fontSize: 10, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1 }}>TIME</Text></View>
                        </View>
                        <Image source={ruvoLogoImg} style={{ width: 80, height: 30, resizeMode: 'contain', marginTop: 20, opacity: 0.7 }} />
                    </View>
                </ViewShot>
            )}
            {isPhantomMapReady && (
                <ViewShot ref={storyViewRef} options={{ format: 'jpg', quality: 1.0 }} style={styles.phantom}>
                    <View style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
                        <MapView style={{ width: '100%', height: '115%' }} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT} customMapStyle={darkMapStyle} initialRegion={mapRegion || { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 }} showsUserLocation={false} showsCompass={false} showsScale={false} showsBuildings={false} showsTraffic={false} showsIndoors={false} showsPointsOfInterest={false}>
                            {runData.routePath?.length > 0 && <Polyline coordinates={runData.routePath} strokeColor={ACCENT} strokeWidth={8} />}
                        </MapView>
                    </View>
                    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' }} />
                    <View style={{ position: 'absolute', top: 80, left: 0, right: 0, alignItems: 'center' }}>
                        <Image source={ruvoLogoImg} style={{ width: 120, height: 45, resizeMode: 'contain' }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                            <MaterialCommunityIcons name={weather.icon} size={16} color="#BBB" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#BBB', fontSize: 12, fontFamily: 'Poppins_600SemiBold' }}>{weather.temp}</Text>
                        </View>
                    </View>
                    <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center' }}>
                        <Text style={{ color: '#FFF', fontSize: 80, fontFamily: 'Poppins_900Black', lineHeight: 100, paddingTop: 10, textAlign: 'center', includeFontPadding: false }}>{runData.distance?.toFixed(2)}</Text>
                        <Text style={{ color: ACCENT, fontSize: 14, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 2, marginTop: -15 }}>KILOMETERS</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10, marginTop: 20 }}>
                            <View style={{ alignItems: 'center' }}><Text style={{ color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold' }}>{runData.pace}</Text><Text style={{ color: '#BBB', fontSize: 10, fontFamily: 'Poppins_600SemiBold', marginTop: 4, letterSpacing: 1 }}>PACE</Text></View>
                            <View style={{ alignItems: 'center' }}><Text style={{ color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold' }}>{runData.time}</Text><Text style={{ color: '#BBB', fontSize: 10, fontFamily: 'Poppins_600SemiBold', marginTop: 4, letterSpacing: 1 }}>TIME</Text></View>
                            {runData.heartRate > 0 && <View style={{ alignItems: 'center' }}><Text style={{ color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold' }}>{runData.heartRate}</Text><Text style={{ color: '#BBB', fontSize: 10, fontFamily: 'Poppins_600SemiBold', marginTop: 4, letterSpacing: 1 }}>BPM</Text></View>}
                        </View>
                    </View>
                </ViewShot>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#111', borderWidth: 1, borderColor: '#222', justifyContent: 'center', alignItems: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },
    headerSub: { color: '#555', fontSize: 11, fontFamily: 'Poppins_500Medium', marginTop: 1 },
    headerAccentLine: { height: 1, backgroundColor: '#1A1A1A', marginHorizontal: 16 },

    scrollContent: { paddingBottom: 20 },

    // Hero
    heroSection: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
    heroDistance: { color: '#FFF', fontSize: 72, fontFamily: 'Poppins_800ExtraBold', lineHeight: 80, includeFontPadding: false },
    heroUnit: { color: ACCENT, fontSize: 12, fontFamily: 'Poppins_700Bold', letterSpacing: 3, marginTop: -4 },
    heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
    heroMeta: { color: '#555', fontSize: 12, fontFamily: 'Poppins_500Medium' },
    heroMetaDot: { color: '#333', fontSize: 12, marginHorizontal: 2 },

    // Stats grid
    statsGrid: {
        flexDirection: 'row',
        backgroundColor: '#0E0E0E',
        borderRadius: 20,
        borderWidth: 1, borderColor: '#1E1E1E',
        marginHorizontal: 16,
        marginBottom: 16,
        paddingVertical: 6,
        overflow: 'hidden',
    },
    statsGridDivider: { width: 1, backgroundColor: '#1E1E1E', marginVertical: 12 },
    statCell: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 6 },
    statCellIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center' },
    statCellValue: { color: '#FFF', fontSize: 17, fontFamily: 'Poppins_700Bold' },
    statCellLabel: { color: '#555', fontSize: 9, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1, textTransform: 'uppercase' },

    // Map hero
    mapHero: {
        height: 210,
        marginHorizontal: 16,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 16,
        backgroundColor: '#111',
        borderWidth: 1, borderColor: '#1E1E1E',
    },
    mapEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
    mapEmptyText: { color: '#333', fontSize: 12, fontFamily: 'Poppins_500Medium' },
    mapGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
    photoOverlayBtn: {
        position: 'absolute', bottom: 12, right: 12,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
    },
    photoOverlayText: { color: '#FFF', fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

    // AI card
    aiCard: {
        marginHorizontal: 16, marginBottom: 16,
        borderRadius: 20, padding: 18,
        borderWidth: 1, borderColor: ACCENT + '25',
    },
    aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    aiIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
    aiCardTitle: { color: ACCENT, fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 1.5 },
    aiCardSub: { color: '#555', fontSize: 10, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    aiLivePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ACCENT + '15', borderWidth: 1, borderColor: ACCENT + '30', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
    aiLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
    aiLiveText: { color: ACCENT, fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
    aiCardBody: { color: '#CCC', fontSize: 13, fontFamily: 'Poppins_400Regular', lineHeight: 21, marginBottom: 14 },
    aiCoachBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 7,
        backgroundColor: ACCENT + '12', borderWidth: 1, borderColor: ACCENT + '30',
        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    },
    aiCoachBtnText: { flex: 1, color: ACCENT, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

    // HR card
    hrCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#0E0E0E', borderRadius: 20, borderWidth: 1, borderColor: '#1E1E1E', padding: 18 },
    hrCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    hrZoneDot: { width: 10, height: 10, borderRadius: 5 },
    hrCardTitle: { flex: 1, color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    hrZoneBadge: { fontSize: 12, fontFamily: 'Poppins_700Bold' },
    hrValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 16 },
    hrValue: { color: '#FFF', fontSize: 42, fontFamily: 'Poppins_700Bold', lineHeight: 50 },
    hrUnit: { color: '#555', fontSize: 14, fontFamily: 'Poppins_500Medium' },
    zoneBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginBottom: 8 },
    zoneBarSegment: { flex: 1, borderRadius: 4 },
    zoneBarActive: { transform: [{ scaleY: 1.4 }] },
    zoneLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    zoneLabel: { fontSize: 9, fontFamily: 'Poppins_500Medium', color: '#444', textAlign: 'center', flex: 1 },

    // Input card
    inputCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#0E0E0E', borderRadius: 20, borderWidth: 1, borderColor: '#1E1E1E', padding: 16 },
    titleInput: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#FFF', paddingVertical: 6 },
    inputDivider: { height: 1, backgroundColor: '#1E1E1E', marginVertical: 8 },
    descInput: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: '#AAA', minHeight: 48, textAlignVertical: 'top', paddingVertical: 4 },

    // Activity type
    typeRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 20, backgroundColor: '#0E0E0E', borderRadius: 16, borderWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 14, paddingVertical: 12 },
    typeIconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    typeText: { flex: 1, color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },

    // Settings sections
    sectionHeader: { color: '#444', fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 1.5, marginHorizontal: 16, marginBottom: 10, textTransform: 'uppercase' },
    sectionCard: { backgroundColor: '#0E0E0E', borderRadius: 20, borderWidth: 1, borderColor: '#1E1E1E', marginHorizontal: 16, marginBottom: 20, overflow: 'hidden' },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    settingIconBox: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center' },
    settingLabel: { color: '#CCC', fontSize: 14, fontFamily: 'Poppins_500Medium' },
    settingSubLabel: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    settingValue: { color: '#555', fontSize: 13, fontFamily: 'Poppins_400Regular' },
    rowDivider: { height: 1, backgroundColor: '#161616', marginLeft: 58 },

    // Discard
    discardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginTop: 4, paddingVertical: 14 },
    discardText: { color: '#FF3B30', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },

    // Footer
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(0,0,0,0.95)', borderTopWidth: 1, borderTopColor: '#141414' },
    saveBtn: { borderRadius: 30, overflow: 'hidden' },
    saveBtnGradient: { height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#000', fontSize: 15, fontFamily: 'Poppins_700Bold' },

    // Private notes modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    notesModal: { backgroundColor: '#0E0E0E', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, minHeight: 340, borderTopWidth: 1, borderColor: '#1E1E1E' },
    notesModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 16 },
    notesModalTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
    notesModalSub: { color: '#555', fontSize: 12, fontFamily: 'Poppins_400Regular', marginBottom: 16 },
    notesInput: { color: '#CCC', fontSize: 15, fontFamily: 'Poppins_400Regular', height: 150, textAlignVertical: 'top', backgroundColor: '#141414', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#222' },
    notesDoneBtn: { marginTop: 16, backgroundColor: ACCENT, padding: 15, borderRadius: 20, alignItems: 'center' },
    notesDoneText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 15 },

    // Run Saved modal
    savedOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
    savedCard: { width: '100%', backgroundColor: '#0D0D0D', borderRadius: 28, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: ACCENT + '30', overflow: 'hidden' },
    savedTopGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
    savedCheckOuter: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    savedCheckPulse: { position: 'absolute', width: 76, height: 76, borderRadius: 38, backgroundColor: ACCENT + '20', borderWidth: 1.5, borderColor: ACCENT + '45' },
    savedCheckCircle: { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },
    savedTitle: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 2.5, marginBottom: 2 },
    savedSubtitle: { color: '#444', fontSize: 11, fontFamily: 'Poppins_500Medium', marginBottom: 10 },
    savedPBBanner: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFD70018', borderWidth: 1, borderColor: '#FFD70038', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
    savedPBText: { color: '#FFD700', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1.2 },
    savedHeroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
    savedHeroValue: { color: '#FFF', fontSize: 66, fontFamily: 'Poppins_900Black', lineHeight: 74, includeFontPadding: false },
    savedHeroUnit: { color: ACCENT, fontSize: 20, fontFamily: 'Poppins_700Bold', marginBottom: 8 },
    savedStatsRow: { flexDirection: 'row', width: '100%', backgroundColor: '#141414', borderRadius: 16, paddingVertical: 13, borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 18 },
    savedStatItem: { flex: 1, alignItems: 'center' },
    savedStatValue: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
    savedStatLabel: { color: '#555', fontSize: 9, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1 },
    savedStatDivider: { width: 1, backgroundColor: '#1E1E1E', alignSelf: 'stretch' },
    savedSectionDivider: { width: '100%', height: 1, backgroundColor: '#1A1A1A', marginBottom: 16 },
    savedBadgeRow: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: '#141414', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: ACCENT + '25', gap: 12 },
    savedBadgeIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT + '20', borderWidth: 1, borderColor: ACCENT + '40', justifyContent: 'center', alignItems: 'center' },
    savedBadgeName: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold' },
    savedBadgeDesc: { color: '#666', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    savedRewardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 8 },
    savedRewardHeaderLabel: { color: '#888', fontSize: 11, fontFamily: 'Poppins_600SemiBold', letterSpacing: 0.8 },
    savedRewardHeaderValue: { color: ACCENT, fontSize: 20, fontFamily: 'Poppins_700Bold' },
    savedXpBarBg: { width: '100%', height: 7, backgroundColor: '#1E1E1E', borderRadius: 4, overflow: 'hidden' },
    savedXpBarFill: { height: '100%', borderRadius: 4, backgroundColor: ACCENT },
    savedBreakdownRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start', marginTop: 8, width: '100%' },
    savedChip: { backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2A2A2A' },
    savedChipText: { color: ACCENT, fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    savedCoachCta: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', backgroundColor: ACCENT + '12', borderWidth: 1, borderColor: ACCENT + '30', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12 },
    savedCoachCtaText: { flex: 1, color: ACCENT, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    claimBtn: { width: '100%', borderRadius: 30, overflow: 'hidden' },
    claimBtnGradient: { height: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    claimBtnText: { color: '#000', fontSize: 15, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },

    // Phantom share views
    phantom: { position: 'absolute', left: width + 200, top: 0, width, height: Math.round(width * 16 / 9), backgroundColor: '#121212' },
});
