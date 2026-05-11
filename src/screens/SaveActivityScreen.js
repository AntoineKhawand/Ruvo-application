import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView, Modal, Platform,
    ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
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

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const { width, height } = Dimensions.get('window');

const COLORS = {
    primary: "#CCFF00",
    secondary: "#1C1C1E",
    accent: "#CCFF00",
    white: "#FFFFFF",
    black: "#000000",
    gray: "#888888",
    lightGray: "#2C2C2E",
    danger: "#FF3B30",
};

const ruvoLogoImg = require('../../assets/images/Ruvo Logo Original.png');

const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2C2C2C" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] }
];

const getHrZone = (hr, age = 30) => {
    if (!hr || hr === '--') return { zone: 0, color: '#8E8E93', name: 'Resting' };
    const maxHr = 220 - age;
    const percent = hr / maxHr;
    if (percent >= 0.9) return { zone: 5, color: '#FF3B30', name: 'Max' };
    if (percent >= 0.8) return { zone: 4, color: '#FF9500', name: 'Threshold' };
    if (percent >= 0.7) return { zone: 3, color: '#FFCC00', name: 'Aerobic' };
    if (percent >= 0.6) return { zone: 2, color: '#34C759', name: 'Fat Burn' };
    if (percent >= 0.5) return { zone: 1, color: '#5AC8FA', name: 'Warm Up' };
    return { zone: 0, color: '#8E8E93', name: 'Light' };
};

export default function SaveActivityScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();
    // 1. GET THE FIREBASE FUNCTION
    const { updateUserProfile, userData, addPost, addRunToHistory } = useUser();

    const storyViewRef = useRef(null);
    const routeViewRef = useRef(null);

    const { runData } = route.params || {
        runData: { distance: 0, time: '00:00', pace: '--', calories: 0, heartRate: '--', routePath: [], initialRegion: null, rpe: 5 }
    };

    const [title, setTitle] = useState(getGreetingTime() + " Run");
    const [description, setDescription] = useState("");
    const [activityType, setActivityType] = useState("Run");
    const [activityTag, setActivityTag] = useState("None");
    const [gear, setGear] = useState(userData?.gearList?.find(g => g.isDefault)?.name || "Default Shoes");
    const [privateNotes, setPrivateNotes] = useState("");
    const [visibility, setVisibility] = useState("Everyone");
    const [isMuted, setIsMuted] = useState(false);
    const [hideMap, setHideMap] = useState(false);
    const [notesModalVisible, setNotesModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Badge Modal State (Fix for ReferenceError)
    const [earnedBadges, setEarnedBadges] = useState([]);
    const [badgeModalVisible, setBadgeModalVisible] = useState(false);
    const [earnedStats, setEarnedStats] = useState({ coins: 0, xp: 0, coinBreakdown: null });
    const [isPhantomMapReady, setIsPhantomMapReady] = useState(false); // Delay rendering to prevent freeze
    const [isRouteCardReady, setIsRouteCardReady] = useState(false);

    const [weather, setWeather] = useState({ temp: "--°C", icon: "weather-cloudy" });
    const [runCity, setRunCity] = useState('');

    const [achievementVisible, setAchievementVisible] = useState(false);
    const [currentBadge, setCurrentBadge] = useState(null);

    // Derive a reliable map region: prefer initialRegion, fall back to midpoint of routePath
    const mapRegion = useMemo(() => {
        if (runData.initialRegion) return runData.initialRegion;
        const path = runData.routePath;
        if (path?.length > 0) {
            const mid = path[Math.floor(path.length / 2)];
            return { latitude: mid.latitude, longitude: mid.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        }
        return null;
    }, [runData]);

    useEffect(() => {
        fetchLocalWeather();
        // Reverse-geocode the run location to get a real city name
        if (mapRegion) {
            Location.reverseGeocodeAsync({ latitude: mapRegion.latitude, longitude: mapRegion.longitude })
                .then(places => {
                    if (places?.[0]) {
                        const p = places[0];
                        const parts = [p.district || p.city || p.subregion, p.country].filter(Boolean);
                        if (parts.length) setRunCity(parts.join(', '));
                    }
                })
                .catch(() => {});
        }
    }, []);

    function getGreetingTime() {
        const hours = new Date().getHours();
        if (hours < 12) return "Morning";
        if (hours < 18) return "Afternoon";
        return "Evening";
    }

    const pickImage = async () => {
        lightTap();
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Allow access to your gallery to add photos to your run.');
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });
        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
        }
    };

    const fetchLocalWeather = async () => {
        if (!mapRegion) return;
        const { latitude, longitude } = mapRegion;
        try {
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=is_day&timezone=auto`);
            const data = await response.json();
            if (data.current_weather) {
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;
                const currentHour = new Date().getHours();
                const isDay = data.hourly?.is_day?.[currentHour] === 1;
                
                let icon;
                if (code === 0) {
                    icon = isDay ? "weather-sunny" : "moon";
                } else if (code <= 3) {
                    icon = isDay ? "weather-partly-cloudy" : "moon-outline";
                } else {
                    icon = "weather-rainy";
                }
                setWeather({ temp: `${temp}°C`, icon: icon });
            }
        } catch (error) { }
    };

    // --- AI INSIGHT GENERATOR ---
    const generateAIInsight = (data) => {
        const dist = data.distance || 0;
        const paceStr = data.pace || "0:00";
        const [min, sec] = paceStr.split(':').map(Number);
        const paceVal = min + (sec / 60);
        const rpe = data.effortRating || data.rpe || 5;
        const hour = new Date().getHours();

        // 1. LONG RUNS (> 10km)
        if (dist >= 10) {
            if (paceVal < 5.5) return "Impressive endurance & speed combo. Your ability to hold this pace over a long distance indicates a high V02 Max. Focus on hydration now.";
            return "Solid aerobic endurance session. Covering this distance builds significant mitochondrial density. Great job building your base!";
        }

        // 2. SPEED WORK (Fast Pace < 5:00/km)
        if (paceVal > 0 && paceVal < 5.0) {
            return "Speed demon! 🚀 You're training your fast-twitch muscle fibers effectively. This session greatly improves your leg turnover and running economy.";
        }

        // 3. RECOVERY / EASY RUNS (RPE < 4 or Short Distance)
        if (rpe <= 4 || (dist < 3 && dist > 0)) {
            return "Perfect active recovery. Keeping the intensity low today puts 'money in the bank' for your next hard session while flushing out metabolic waste.";
        }

        // 4. HIGH INTENSITY (RPE >= 8)
        if (rpe >= 8) {
            return "High intensity effort detected! 💥 You've pushed your anaerobic threshold today. Expect an 'afterburn' effect (EPOC). Ensure you sleep 8+ hours tonight.";
        }

        // 5. MORNING RUNS
        if (hour < 9) {
            return "Early riser! ☀️ fasted morning runs can improve your body's efficiency at burning fat for fuel. A great way to jumpstart your metabolism.";
        }

        // 6. DEFAULT / GENERAL
        return "Consistent effort. You maintained a steady rhythm which is key for long-term progression. improving your running economy step by step.";
    };

    const handleSave = async () => {
        if (isSaving) return;
        lightTap();
        setIsSaving(true);

        const sanitizedTitle = sanitizeInput(title) || getGreetingTime() + " Run";
        const sanitizedDescription = sanitizeInput(description) || '';
        const sanitizedNotes = sanitizeInput(privateNotes) || '';

        const activeShoe = userData?.gearList?.find(g => g.name === gear);

        // Upload Image to Firebase Storage first (if any)
        let uploadedImageUrl = null;
        if (selectedImage) {
            try {
                setIsSaving(true); // Ensure saving state is true during upload
                
                // Use XMLHttpRequest for more reliable upload
                const imageUri = selectedImage;
                const blob = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', imageUri);
                    xhr.responseType = 'blob';
                    xhr.onload = () => {
                        if (xhr.status === 200) {
                            resolve(xhr.response);
                        } else {
                            reject(new Error('Failed to fetch image: ' + xhr.status));
                        }
                    };
                    xhr.onerror = () => reject(new Error('Network error fetching image'));
                    xhr.send();
                });
                
                // Upload to Firebase Storage
                const timestamp = Date.now();
                const imageRef = ref(storage, `runPhotos/${userData.uid || 'unknown'}/${timestamp}.jpg`);
                await uploadBytes(imageRef, blob);
                uploadedImageUrl = await getDownloadURL(imageRef);
            } catch (imageError) {
                console.error("Image Upload Error:", imageError);
                setIsSaving(false);
                Alert.alert("Upload Failed", "Could not upload your photo. Please try again or remove the photo.");
                return;
            }
        }

        // 1. Create the Activity Object
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
            weather: weather
        };

        // 2. Calculate Stats Updates (for UserContext)
        const currentTotalKm = userData.totalKm || 0;

        let updatedGearList = userData.gearList || [];
        if (activeShoe) {
            updatedGearList = userData.gearList.map(shoe =>
                shoe.id === activeShoe.id
                    ? { ...shoe, distance: (shoe.distance || 0) + newActivity.distance }
                    : shoe
            );
        }

        const calculatedUpdates = {
            totalKm: currentTotalKm + newActivity.distance,
            earningUnlockProgress: currentTotalKm + newActivity.distance,
            gearList: updatedGearList
        };

        try {
            // 3. Save via UserContext (Handles Badge Check)
            const result = await addRunToHistory(newActivity, calculatedUpdates) || {};

            if (result.queued) {
                Alert.alert(
                    "Saved Offline",
                    "No internet connection. Your run has been saved and will sync automatically when you're back online.",
                    [{ text: "OK", style: "default" }]
                );
                navigation.goBack();
                return;
            }

            const { newBadges = [], earnedXp = 0, earnedCoins = 0, coinBreakdown, levelsGained = 0, newLevel = 1 } = result;

            // 4. Create Post (if public)
            if (!isMuted && visibility !== 'Only Me') {
                // Import auth if not available in scope, or use UserContext if it exposes it. 
                // Assuming auth is available via import or context. 
                // If addPost logic resides in Context, we use it here.

                // We need to access addPost from useUser() - make sure it is destructured above!
                // Check if addPost is available in useUser destructuring at top of component.
                // If not, we might need to update the destructuring line.

                if (addPost) {
                    await addPost({
                        userId: userData.uid || 'unknown', // Fallback if direct auth access is tricky
                        user: userData.name,
                        avatar: userData.avatar,
                        level: userData.level,
                        title: sanitizedTitle || 'Running Workout',
                        description: sanitizedDescription || '',
                        stats: {
                            km: newActivity.distance.toFixed(2),
                            pace: newActivity.pace,
                            time: newActivity.duration
                        },
                        image: uploadedImageUrl || null,
                        badge: newBadges.length > 0 ? newBadges[0] : null, // Show first badge if earned
                        gear: gear,
                        activityTag: activityTag,
                        hideMap: hideMap,
                        // ✅ NEW: Geo-Spatial Data for Discovery Mode
                        routePath: hideMap ? [] : newActivity.routePath, // Don't share path if map is hidden
                        initialRegion: newActivity.initialRegion
                    });
                }
            }

            // Sync to Apple Health / Google Health Connect
            await syncRunToHealth(newActivity);

            setIsSaving(false);

            successFeedback();
            setEarnedStats({ coins: earnedCoins, xp: earnedXp, coinBreakdown: coinBreakdown || null });
            setEarnedBadges(newBadges || []);

            if (levelsGained > 0) {
                Alert.alert(
                    "Level Up!",
                    `You reached Level ${newLevel}! Keep running to unlock more rewards.`,
                    [{ text: "Let's Go!", style: "default" }]
                );
            }

            if (newBadges && newBadges.length > 0) {
                setCurrentBadge({
                    name: newBadges[0].name,
                    description: newBadges[0].desc,
                    icon: newBadges[0].icon,
                    color: '#CCFF00',
                });
                setAchievementVisible(true);
            } else {
                setBadgeModalVisible(true);
            }
        } catch (error) {
            console.error("Save Error:", error);
            errorFeedback();
            setIsSaving(false);
            Alert.alert("Save Failed", "Could not save your run. Please try again.");
        }
    };

    const shareStoryWithMap = async () => {
        try {
            setIsPhantomMapReady(true);
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (storyViewRef.current) {
                const captureHeight = Math.round(width * (16 / 9));
                const uri = await storyViewRef.current.capture({ height: captureHeight, width: width, result: 'tmpfile', quality: 1.0, format: 'jpg' });
                await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share your Run Story', UTI: 'public.jpeg' });
            }
        } catch (error) {
            console.error("Share (map) failed:", error);
            errorFeedback();
            Alert.alert("Share Failed", "Could not generate image. Please try again.");
        } finally {
            setIsPhantomMapReady(false);
        }
    };

    const shareRouteCard = async () => {
        try {
            setIsRouteCardReady(true);
            await new Promise(resolve => setTimeout(resolve, 1200));
            if (routeViewRef.current) {
                const captureHeight = Math.round(width * (16 / 9));
                const uri = await routeViewRef.current.capture({ height: captureHeight, width: width, result: 'tmpfile', quality: 1.0, format: 'jpg' });
                await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share your Route', UTI: 'public.jpeg' });
            }
        } catch (error) {
            console.error("Share (route) failed:", error);
            errorFeedback();
            Alert.alert("Share Failed", "Could not generate image. Please try again.");
        } finally {
            setIsRouteCardReady(false);
        }
    };

    const handleShare = () => {
        lightTap();
        Alert.alert(
            "Share Activity",
            "Choose a style",
            [
                { text: "Story (with Map)", onPress: shareStoryWithMap },
                { text: "Route Card", onPress: shareRouteCard },
                { text: "Cancel", style: "cancel" },
            ]
        );
    };

    const handleDiscard = () => { lightTap(); Alert.alert("Discard Activity?", "This run won't be saved.", [{ text: "Cancel", style: "cancel" }, { text: "Discard", style: "destructive", onPress: () => { errorFeedback(); navigation.navigate('Home'); } }]); };
    const selectActivityType = () => { lightTap(); Alert.alert("Select Activity Type", "", [{ text: "Run", onPress: () => setActivityType("Run") }, { text: "Walk", onPress: () => setActivityType("Walk") }, { text: "Hike", onPress: () => setActivityType("Hike") }, { text: "Cancel", style: "cancel" }]); };
    const selectActivityTag = () => { lightTap(); Alert.alert("Select Tag", "", [{ text: "None", onPress: () => setActivityTag("None") }, { text: "Commute", onPress: () => setActivityTag("Commute") }, { text: "Workout", onPress: () => setActivityTag("Workout") }, { text: "Race", onPress: () => setActivityTag("Race") }, { text: "Cancel", style: "cancel" }]); };

    const selectGear = () => {
        lightTap();
        const gearOptions = (userData?.gearList || []).map(g => ({ text: g.name, onPress: () => { setGear(g.name); } }));
        gearOptions.push({ text: "Cancel", style: "cancel" });
        Alert.alert("Select Gear", "", gearOptions);
    };

    const handleVisibility = () => { lightTap(); Alert.alert("Visibility", "Who can view this activity?", [{ text: "Everyone", onPress: () => setVisibility("Everyone") }, { text: "Followers", onPress: () => setVisibility("Followers") }, { text: "Only Me", onPress: () => setVisibility("Only Me") }, { text: "Cancel", style: "cancel" }]); };

    const SettingRow = ({ icon, label, value, showArrow = true, color = "#FFF", onPress, rightElement }) => (
        <TouchableOpacity activeOpacity={0.7} style={styles.settingRow} onPress={onPress} disabled={!onPress}>
            <View style={styles.settingLeft}>{icon && <View style={styles.iconContainer}>{icon}</View>}<Text style={[styles.settingLabel, { color }]}>{label}</Text></View>
            <View style={styles.settingRight}>{rightElement ? rightElement : (<>{value && <Text style={styles.settingValue}>{value}</Text>}{showArrow && <Ionicons name="chevron-forward" size={18} color="#555" />}</>)}</View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="arrow-back" size={28} color="#FFF" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Save Activity</Text>
                <TouchableOpacity activeOpacity={0.7} onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="share-social" size={24} color="#FFF" /></TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.inputSection}>
                    <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} placeholder="Name your run" placeholderTextColor="#666" />
                    <View style={styles.fullDivider} />
                    <TextInput style={styles.descInput} value={description} onChangeText={setDescription} placeholder="Add a description..." placeholderTextColor="#666" multiline />
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}><Text style={styles.statLabel}>Time</Text><Text style={styles.statValue}>{runData.time}</Text></View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}><Text style={styles.statLabel}>Distance</Text><Text style={styles.statValue}>{runData.distance?.toFixed(2)} km</Text></View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}><Text style={styles.statLabel}>Avg Pace</Text><Text style={styles.statValue}>{runData.pace}</Text></View>
                </View>

                {/* HR Zone Breakdown */}
                {runData.heartRate > 0 && runData.heartRate !== '--' && (
                    <View style={{ backgroundColor: '#1C1C1E', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#333' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={{ color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold' }}>Average Heart Rate</Text>
                            <Text style={{ color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' }}>{Math.round(runData.heartRate)} <Text style={{ color: '#888', fontSize: 12 }}>BPM</Text></Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getHrZone(runData.heartRate, userData?.age).color, marginRight: 8 }} />
                            <Text style={{ color: getHrZone(runData.heartRate, userData?.age).color, fontSize: 12, fontFamily: 'Poppins_700Bold' }}>
                                ZONE {getHrZone(runData.heartRate, userData?.age).zone}: {getHrZone(runData.heartRate, userData?.age).name.toUpperCase()}
                            </Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: '#333', borderRadius: 3, width: '100%', marginTop: 5, overflow: 'hidden' }}>
                            <View style={{ height: '100%', backgroundColor: getHrZone(runData.heartRate, userData?.age).color, width: `${(runData.heartRate / (220 - (userData?.age || 30))) * 100}%` }} />
                        </View>
                    </View>
                )}

                {/* AI Insight Card */}
                <View style={styles.aiInsightCard}>
                    <View style={styles.aiInsightHeader}>
                        <MaterialCommunityIcons name="robot" size={18} color={COLORS.accent} />
                        <Text style={styles.aiInsightTitle}>RUVO AI INSIGHT</Text>
                    </View>
                    <Text style={styles.aiInsightBody}>
                        {generateAIInsight(runData)}
                    </Text>
                </View>

                {runCity ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Ionicons name="location-outline" size={14} color="#888" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#888', fontSize: 12, fontFamily: 'Poppins_500Medium' }}>{runCity}</Text>
                    </View>
                ) : null}

                <View style={styles.mediaRow}>
                    <View style={styles.mapWrapper}>
                        {mapRegion ? (
                            <MapView style={StyleSheet.absoluteFill} provider={PROVIDER_DEFAULT} customMapStyle={darkMapStyle} initialRegion={mapRegion} scrollEnabled={false} zoomEnabled={false}>
                                {runData.routePath && runData.routePath.length > 0 && (<Polyline coordinates={runData.routePath} strokeColor={COLORS.accent} strokeWidth={3} />)}
                            </MapView>
                        ) : (
                            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A' }]}>
                                <Ionicons name="map-outline" size={28} color="#444" />
                                <Text style={{ color: '#444', fontSize: 10, fontFamily: 'Poppins_500Medium', marginTop: 4 }}>No GPS data</Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity activeOpacity={0.7} style={styles.addPhotoBox} onPress={pickImage}>
                        {selectedImage ? (
                            <Image source={{ uri: selectedImage }} style={StyleSheet.absoluteFill} />
                        ) : (
                            <View style={styles.dashedBorder}>
                                <Ionicons name="camera-outline" size={32} color={COLORS.accent} />
                                <Text style={styles.addPhotoText}>Add Photo</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <TouchableOpacity activeOpacity={0.7} style={styles.typeSelector} onPress={selectActivityType}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={styles.iconCircle}><MaterialCommunityIcons name={activityType === 'Run' ? "shoe-print" : activityType === 'Hike' ? "hiking" : "walk"} size={18} color="#000" /></View><Text style={styles.typeText}>{activityType}</Text></View>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>

                <View style={styles.spacer} />
                <Text style={styles.sectionHeader}>Details</Text>
                <View style={styles.sectionGroup}>
                    <SettingRow icon={<Ionicons name="pricetag-outline" size={20} color="#AAA" />} label="Activity Tag" value={activityTag} onPress={selectActivityTag} />
                    <View style={styles.divider} />
                    <SettingRow icon={<Ionicons name="document-text-outline" size={20} color="#AAA" />} label="Private notes" value={privateNotes ? "Edited" : ""} onPress={() => setNotesModalVisible(true)} />
                    <View style={styles.divider} />
                    <SettingRow icon={<MaterialCommunityIcons name="shoe-sneaker" size={20} color="#AAA" />} label="Gear" value={gear} onPress={selectGear} />
                </View>

                <Text style={styles.sectionHeader}>Visibility</Text>
                <View style={styles.sectionGroup}>
                    <SettingRow icon={<Ionicons name="globe-outline" size={20} color="#AAA" />} label="Who can view" value={visibility} onPress={handleVisibility} />
                    <View style={styles.divider} />
                    <SettingRow icon={<Ionicons name="eye-off-outline" size={20} color="#AAA" />} label="Hidden Details" showArrow={false} rightElement={<Switch value={hideMap} onValueChange={setHideMap} trackColor={{ false: "#333", true: COLORS.accent }} thumbColor={hideMap ? "#000" : "#FFF"} />} />
                </View>

                <View style={styles.toggleRow}>
                    <View style={{ flex: 1 }}><Text style={styles.toggleLabel}>Mute Activity</Text><Text style={styles.toggleSub}>Don't publish to Home or Club feeds</Text></View>
                    <Switch value={isMuted} onValueChange={setIsMuted} trackColor={{ false: "#333", true: COLORS.accent }} thumbColor={isMuted ? "#000" : "#FFF"} />
                </View>

                <TouchableOpacity activeOpacity={0.7} style={styles.discardButton} onPress={handleDiscard}><Text style={styles.discardText}>Discard Activity</Text></TouchableOpacity>
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* FOOTER WITH LOADING STATE */}
            <View style={[styles.footer, { paddingBottom: Math.max(Platform.OS === 'ios' ? 30 : 20, insets.bottom) }]}>
                <TouchableOpacity activeOpacity={0.7} style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                    {isSaving ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Activity</Text>
                    )}
                </TouchableOpacity>
            </View>

            <Modal visible={notesModalVisible} animationType="slide" transparent={true}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Private Notes</Text>
                        <TextInput style={styles.modalInput} value={privateNotes} onChangeText={setPrivateNotes} placeholder="Only you can see these notes..." placeholderTextColor="#666" multiline autoFocus />
                        <TouchableOpacity activeOpacity={0.7} style={styles.modalCloseBtn} onPress={() => { lightTap(); setNotesModalVisible(false); }}><Text style={styles.modalCloseText}>Done</Text></TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <AchievementOverlay
                visible={achievementVisible}
                badge={currentBadge}
                onDismiss={() => {
                    successFeedback();
                    setAchievementVisible(false);
                    setBadgeModalVisible(true);
                }}
            />

            {/* BADGE UNLOCK MODAL */}
            <Modal visible={badgeModalVisible} transparent={true} animationType="none" onRequestClose={() => setBadgeModalVisible(false)}>
                <View style={styles.badgeModalOverlay}>
                    <Animated.View
                        entering={ZoomIn.duration(400)}
                        style={styles.badgeCard}
                    >
                        {/* Show badge section only if badge was earned */}
                        {earnedBadges.length > 0 ? (
                            <>
                                <View style={styles.badgeGlow} />
                                <MaterialCommunityIcons name={earnedBadges[0].icon} size={80} color="#CCFF00" style={{ zIndex: 2, marginBottom: 15 }} />
                                <Text style={styles.badgeTitle}>BADGE UNLOCKED!</Text>
                                <Text style={styles.badgeName}>{earnedBadges[0].name}</Text>
                                <Text style={styles.badgeDesc}>{earnedBadges[0].desc}</Text>
                            </>
                        ) : (
                            <>
                                <MaterialCommunityIcons name="check-circle" size={80} color="#CCFF00" style={{ marginBottom: 15, opacity: 0.8 }} />
                                <Text style={styles.badgeTitle}>RUN SAVED!</Text>
                                <Text style={styles.badgeDesc}>Great work! Keep it up.</Text>
                            </>
                        )}

                        {/* REWARD STATS - Always show */}
                        <View style={styles.rewardStatsRow}>
                            <View style={styles.rewardStat}>
                                <AnimatedCounter value={earnedStats.xp} suffix=" XP" prefix="+" style={styles.rewardValue} />
                                <Text style={styles.rewardLabel}>EARNED</Text>
                            </View>
                            <View style={styles.rewardDivider} />
                            <View style={styles.rewardStat}>
                                <AnimatedCounter value={earnedStats.coins} prefix="+" style={styles.rewardValue} />
                                <Text style={styles.rewardLabel}>COINS</Text>
                                {earnedStats.coinBreakdown && (earnedStats.coinBreakdown.paceBonus > 0 || earnedStats.coinBreakdown.streakBonus > 0 || earnedStats.coinBreakdown.timeBonus !== 0) && (
                                    <Text style={styles.coinBreakdown}>
                                        {earnedStats.coinBreakdown.paceBonus > 0 && `+${earnedStats.coinBreakdown.paceBonus} pace `}
                                        {earnedStats.coinBreakdown.streakBonus > 0 && `+${earnedStats.coinBreakdown.streakBonus} streak `}
                                        {earnedStats.coinBreakdown.timeBonus !== 0 && (earnedStats.coinBreakdown.timeBonus > 0 ? `+${earnedStats.coinBreakdown.timeBonus} off-peak` : `${earnedStats.coinBreakdown.timeBonus} peak`)}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <TouchableOpacity activeOpacity={0.7} style={styles.claimButton} onPress={() => {
                            lightTap();
                            setBadgeModalVisible(false);
                            navigation.navigate('Home', { newRunData: route.params?.savedActivity || null });
                        }}>
                            <Text style={styles.claimButtonText}>CLAIM REWARD</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>

            {isRouteCardReady && (
                <ViewShot ref={routeViewRef} options={{ format: "jpg", quality: 1.0 }} style={[styles.phantomStoryContainer, { backgroundColor: '#0A0A0A' }]}>
                    <View style={{ flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <MapView style={{ width: '100%', height: '60%', borderRadius: 16, overflow: 'hidden' }} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT} customMapStyle={darkMapStyle} initialRegion={mapRegion || { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 }} showsUserLocation={false} showsCompass={false} showsScale={false} showsBuildings={false} showsTraffic={false} showsIndoors={false} showsPointsOfInterest={false} scrollEnabled={false} zoomEnabled={false}>
                            {runData.routePath && runData.routePath.length > 0 && (<Polyline coordinates={runData.routePath} strokeColor={COLORS.accent} strokeWidth={10} />)}
                        </MapView>
                    </View>
                    <View style={{ position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' }}>
                        <Text style={{ color: '#FFF', fontSize: 60, fontFamily: 'Poppins_900Black', lineHeight: 68 }}>{runData.distance?.toFixed(2)}</Text>
                        <Text style={{ color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 2, marginTop: -8 }}>KILOMETERS</Text>
                        <View style={{ flexDirection: 'row', gap: 30, marginTop: 18 }}>
                            <View style={{ alignItems: 'center' }}><Text style={{ color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold' }}>{runData.pace}</Text><Text style={{ color: '#888', fontSize: 10, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1 }}>PACE</Text></View>
                            <View style={{ alignItems: 'center' }}><Text style={{ color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold' }}>{runData.time}</Text><Text style={{ color: '#888', fontSize: 10, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1 }}>TIME</Text></View>
                        </View>
                        <Image source={ruvoLogoImg} style={{ width: 80, height: 30, resizeMode: 'contain', marginTop: 20, opacity: 0.7 }} />
                    </View>
                </ViewShot>
            )}

            {isPhantomMapReady && (
                <ViewShot ref={storyViewRef} options={{ format: "jpg", quality: 1.0 }} style={styles.phantomStoryContainer}>
                    <View style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
                        <MapView style={{ width: '100%', height: '115%' }} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT} customMapStyle={darkMapStyle} initialRegion={mapRegion || { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 }} showsUserLocation={false} showsCompass={false} showsScale={false} showsBuildings={false} showsTraffic={false} showsIndoors={false} showsPointsOfInterest={false}>
                            {runData.routePath && runData.routePath.length > 0 && (<Polyline coordinates={runData.routePath} strokeColor={COLORS.accent} strokeWidth={8} />)}
                        </MapView>
                    </View>
                    <View style={styles.storyMapOverlay} />
                    <View style={styles.storyLogoContainerCentered}>
                        <Image source={ruvoLogoImg} style={styles.storyLogoImage} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                            <MaterialCommunityIcons name={weather.icon} size={16} color="#BBB" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#BBB', fontSize: 12, fontFamily: 'Poppins_600SemiBold' }}>{weather.temp}</Text>
                        </View>
                    </View>
                    <View style={styles.storyFloatingStatsContainer}>
                        <View style={{ alignItems: 'center', marginBottom: 30 }}>
                            <Text style={styles.storyHeroValue}>{runData.distance?.toFixed(2)}</Text>
                            <Text style={styles.storyHeroLabel}>KILOMETERS</Text>
                        </View>
                        <View style={styles.storySecondaryRow}>
                            <View style={styles.storyStatItemFloating}><Text style={styles.storyStatValueFloating}>{runData.pace}</Text><Text style={styles.storyStatLabelFloating}>PACE</Text></View>
                            <View style={styles.storyStatItemFloating}><Text style={styles.storyStatValueFloating}>{runData.time}</Text><Text style={styles.storyStatLabelFloating}>TIME</Text></View>
                            <View style={styles.storyStatItemFloating}><View style={{ flexDirection: 'row', alignItems: 'baseline' }}><Text style={styles.storyStatValueFloating}>{runData.heartRate || '--'}</Text><Text style={[styles.storyStatValueFloating, { fontSize: 16, marginLeft: 2 }]}>bpm</Text></View><Text style={styles.storyStatLabelFloating}>HEART RATE</Text></View>
                        </View>
                    </View>
                </ViewShot>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000', // Fallback
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#000' },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    scrollContent: { padding: 16 },
    inputSection: { marginBottom: 20 },
    titleInput: { fontSize: 22, fontFamily: 'Poppins_600SemiBold', color: '#FFF', paddingVertical: 10 },
    fullDivider: { height: 1, backgroundColor: '#333', width: '100%' },
    descInput: { fontSize: 16, fontFamily: 'Poppins_400Regular', color: '#CCC', minHeight: 40, textAlignVertical: 'top', paddingVertical: 10 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 10 },
    statItem: { alignItems: 'center' },
    statLabel: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular' },
    statValue: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    statDivider: { width: 1, height: '100%', backgroundColor: '#333' },
    aiInsightCard: { backgroundColor: '#111', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#CCFF0040', marginBottom: 25 },
    aiInsightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    aiInsightTitle: { color: "#CCFF00", fontSize: 12, fontFamily: 'Poppins_700Bold', marginLeft: 8, letterSpacing: 1 },
    aiInsightBody: { color: '#DDD', fontSize: 13, fontFamily: 'Poppins_400Regular', lineHeight: 20 },
    mediaRow: { flexDirection: 'row', justifyContent: 'space-between', height: 160, marginBottom: 20 },
    mapWrapper: { width: '48%', height: '100%', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
    addPhotoBox: { width: '48%', height: '100%', borderRadius: 12, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333', overflow: 'hidden' },
    dashedBorder: { width: '90%', height: '90%', borderWidth: 1, borderColor: '#444', borderStyle: 'dashed', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    addPhotoText: { color: "#CCFF00", fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginTop: 8 },
    typeSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1C1C1E', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
    iconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#CCFF00", justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    typeText: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_500Medium' },
    spacer: { height: 20 },
    sectionHeader: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 12, marginTop: 10 },
    sectionGroup: { backgroundColor: '#1C1C1E', borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#333' },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1C1C1E' },
    settingLeft: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: { width: 24, alignItems: 'center', marginRight: 12 },
    settingLabel: { fontSize: 15, fontFamily: 'Poppins_400Regular' },
    settingRight: { flexDirection: 'row', alignItems: 'center' },
    settingValue: { color: '#888', fontSize: 14, marginRight: 8, fontFamily: 'Poppins_400Regular' },
    divider: { height: 1, backgroundColor: '#333', marginLeft: 52 },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, paddingHorizontal: 5 },
    toggleLabel: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    toggleSub: { color: '#888', fontSize: 12, marginTop: 4, maxWidth: '85%' },
    discardButton: { alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#FF3B30', borderRadius: 12, marginBottom: 20 },
    discardText: { color: '#FF3B30', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 16, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222' },
    saveButton: { backgroundColor: "#CCFF00", height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
    saveButtonText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 300 },
    modalTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 15 },
    modalInput: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_400Regular', height: 150, textAlignVertical: 'top', backgroundColor: '#111', borderRadius: 10, padding: 15 },
    modalCloseBtn: { marginTop: 20, backgroundColor: "#CCFF00", padding: 15, borderRadius: 10, alignItems: 'center' },
    modalCloseText: { color: '#000', fontFamily: 'Poppins_700Bold' },
    phantomStoryContainer: { position: 'absolute', left: width + 200, top: 0, width: width, height: Math.round(width * (16 / 9)), backgroundColor: '#121212' },
    storyMapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    storyLogoContainerCentered: { position: 'absolute', top: 80, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
    storyLogoImage: { width: 120, height: 45, resizeMode: 'contain' },
    storyFloatingStatsContainer: { position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center' },
    storyHeroValue: { color: '#FFF', fontSize: 80, fontFamily: 'Poppins_900Black', lineHeight: 100, paddingTop: 10, textAlign: 'center', includeFontPadding: false },
    storyHeroLabel: { color: "#CCFF00", fontSize: 14, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 2, marginTop: -15 },
    storySecondaryRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10, marginTop: 20 },
    storyStatItemFloating: { alignItems: 'center' },
    storyStatValueFloating: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold' },
    storyStatLabelFloating: { color: '#BBB', fontSize: 10, fontFamily: 'Poppins_600SemiBold', marginTop: 4, letterSpacing: 1 },

    // BADGE MODAL STYLES
    badgeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    badgeCard: { width: '85%', backgroundColor: '#1C1C1E', borderRadius: 25, padding: 30, alignItems: 'center', borderWidth: 2, borderColor: '#CCFF00', overflow: 'hidden' },
    badgeGlow: { position: 'absolute', top: -50, width: 200, height: 200, backgroundColor: '#CCFF00', opacity: 0.15, borderRadius: 100, blurRadius: 50 },
    badgeTitle: { color: "#CCFF00", fontSize: 14, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 2, marginBottom: 10, textAlign: 'center' },
    badgeName: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold', marginBottom: 5, textAlign: 'center' },
    badgeDesc: { color: '#CCC', fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center', marginBottom: 10, paddingHorizontal: 10 },

    // Reward Stats
    rewardStatsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 25, width: '100%' },
    rewardStat: { alignItems: 'center', width: '40%' },
    rewardValue: { color: '#FFF', fontSize: 28, fontFamily: 'Poppins_700Bold' },
    rewardLabel: { color: '#CCFF00', fontSize: 12, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1 },
    coinBreakdown: { color: '#888', fontSize: 9, fontFamily: 'Poppins_400Regular', marginTop: 4, textAlign: 'center' },
    rewardDivider: { width: 1, height: 30, backgroundColor: '#333' },

    claimButton: { backgroundColor: "#CCFF00", paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, width: '100%', alignItems: 'center' },
    claimButtonText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
});