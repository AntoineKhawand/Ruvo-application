import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, ImageBackground, Modal, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Stop, LinearGradient as SvgLinearGradient, Text as SvgText } from 'react-native-svg';
import { useNotifications } from '../context/NotificationContext';
import { useUser } from '../context/UserContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { getTodayWorkout } from '../services/aiCoach';
import { fetchAIWorkoutSuggestion } from '../services/aiService';

import GlassCard from '../components/GlassCard';
import FloatingNavBar from '../components/FloatingNavBar';
import NotificationBell from '../components/NotificationBell';
import NotificationSheet from '../components/NotificationSheet';
import RuvoDashboard from '../components/RuvoDashboard';
import SkeletonCard from '../components/SkeletonCard';
import StreakMilestone, { shouldCelebrateStreak } from '../components/StreakMilestone';
import { contentService } from '../services/contentService';
import { lightTap } from '../utils/haptics';

const COLORS = {
    primary: "#000000",
    secondary: "#1C1C1E",
    accent: "#CCFF00",
    danger: "#FF3B30",
    text: "#FFFFFF",
    subText: "#888888",
    border: "#333333",
    blue: "#007AFF"
};

const { width } = Dimensions.get('window');

// TIP_LIBRARY removed - using contentService

const fetchWeather = async (unitSystem = 'metric') => {
    let lat, lon;

    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return { temp: '--', icon: 'thermometer-outline', unit: '°C' };
        let position = await Location.getLastKnownPositionAsync({ maxAge: 3600000 });
        if (!position) {
            position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        lat = position.coords.latitude;
        lon = position.coords.longitude;
    } catch {
        return { temp: '--', icon: 'thermometer-outline', unit: '°C' };
    }

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=is_day&timezone=auto`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.current_weather) return { temp: '--', icon: 'cloudy-outline', unit: '°C' };

        const tempC = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;
        const currentHour = new Date().getHours();
        const isDay = data.hourly?.is_day?.[currentHour] === 1;

        // WMO weather interpretation codes → Ionicons (all names complete, no appending)
        let icon;
        if (code === 0) {
            icon = isDay ? 'sunny-outline' : 'moon-outline';
        } else if (code <= 3) {
            icon = isDay ? 'partly-sunny-outline' : 'moon-outline';
        } else if (code <= 48) {
            icon = 'cloudy-outline';
        } else if (code <= 67 || (code >= 80 && code <= 82)) {
            icon = 'rainy-outline';
        } else if (code <= 77) {
            icon = 'snow-outline';
        } else {
            icon = 'thunderstorm-outline';
        }

        const temp = unitSystem === 'imperial' ? Math.round(tempC * 9 / 5 + 32) : tempC;
        const unit = unitSystem === 'imperial' ? '°F' : '°C';

        return { temp, icon, unit };
    } catch {
        return { temp: '--', icon: 'cloudy-outline', unit: '°C' };
    }
};


const LineChart = ({ data, height = 140, width = 300, color = COLORS.accent }) => {
    if (!data || data.length < 2) return null;
    const maxVal = Math.max(...data, 160);
    const minVal = Math.min(...data, 100);
    const range = maxVal - minVal || 1;
    const paddingLeft = 30; const paddingRight = 20; const paddingBottom = 20;
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingBottom;
    const stepX = chartWidth / (data.length - 1);

    let pathD = `M ${paddingLeft} ${chartHeight - ((data[0] - minVal) / range) * chartHeight}`;
    data.forEach((val, i) => {
        const x = paddingLeft + (i * stepX);
        const y = chartHeight - ((val - minVal) / range) * chartHeight;
        pathD += ` L ${x} ${y}`;
    });
    const areaD = `${pathD} L ${paddingLeft + chartWidth} ${chartHeight} L ${paddingLeft} ${chartHeight} Z`;

    return (
        <View style={{ height, width }}>
            <Svg height={height} width={width}>
                <Defs><SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.5" /><Stop offset="1" stopColor={color} stopOpacity="0" /></SvgLinearGradient></Defs>
                <Path d={`M ${paddingLeft} 0 L ${paddingLeft} ${chartHeight}`} stroke="#333" strokeWidth="1" />
                <Path d={`M ${paddingLeft} ${chartHeight} L ${width} ${chartHeight}`} stroke="#333" strokeWidth="1" />
                <SvgText x="0" y="10" fill="#666" fontSize="10">{Math.round(maxVal)}</SvgText>
                <SvgText x="0" y={chartHeight} fill="#666" fontSize="10">{Math.round(minVal)}</SvgText>
                <SvgText x={paddingLeft} y={height} fill="#666" fontSize="10">30d</SvgText>
                <SvgText x={width - 40} y={height} fill="#666" fontSize="10" textAnchor="start">Now</SvgText>
                <Path d={areaD} fill="url(#lineGrad)" />
                <Path d={pathD} stroke={color} strokeWidth="2" fill="none" />
                <Circle cx={paddingLeft + (data.length - 1) * stepX} cy={chartHeight - ((data[data.length - 1] - minVal) / range) * chartHeight} r="4" fill="#FFF" stroke={color} strokeWidth="2" />
            </Svg>
        </View>
    );
};




// GlassCard is now imported from components

export default function HomeScreen({ route, navigation }) {
    const { userData, incrementTipView, isLoading } = useUser();
    useNotifications();

    const safeUserData = userData || {};
    const [showNotifications, setShowNotifications] = useState(false);
    const [showRunSummary, setShowRunSummary] = useState(false);
    const [runSummaryData, setRunSummaryData] = useState(null);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const [weather, setWeather] = useState({ temp: '--', icon: 'partly-sunny-outline', unit: '°C' });
    const [displayedTips, setDisplayedTips] = useState([]);
    const [showBadgeReveal, setShowBadgeReveal] = useState(false);
    const badgeScale = useRef(new Animated.Value(0)).current;
    const badgeOpacity = useRef(new Animated.Value(0)).current;
    const xpBarWidth = useRef(new Animated.Value(0)).current;

    // Streak celebration
    const [showStreakCelebration, setShowStreakCelebration] = useState(false);
    const [lastCelebratedStreak, setLastCelebratedStreak] = useState(0);

    // AI workout suggestion
    const [aiWorkout, setAiWorkout] = useState(null);
    const [aiWorkoutLoading, setAiWorkoutLoading] = useState(true);

    // --- NEW FEATURE: STREAK CALCULATION ---
    const currentStreak = useMemo(() => {
        const history = safeUserData.runHistory || [];
        if (history.length === 0) return 0;

        // Get unique dates of runs
        const uniqueDates = [...new Set(history.map(r => new Date(r.date).toDateString()))];
        // Sort descending
        uniqueDates.sort((a, b) => new Date(b) - new Date(a));

        let streak = 0;
        let checkDate = new Date();

        // Check if ran today
        if (uniqueDates[0] === checkDate.toDateString()) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // If haven't ran today, check yesterday to see if streak is still active but at risk
            let yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (uniqueDates[0] !== yesterday.toDateString()) return 0; // Streak broken
        }

        // Count backwards
        for (let i = (streak === 1 ? 1 : 0); i < uniqueDates.length; i++) {
            if (uniqueDates[i] === checkDate.toDateString()) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    }, [safeUserData.runHistory]);

    // Check for streak milestone celebration
    useEffect(() => {
        if (currentStreak > 0 && shouldCelebrateStreak(currentStreak, lastCelebratedStreak)) {
            setShowStreakCelebration(true);
        }
    }, [currentStreak]);

    // Fetch AI-personalized workout on mount (AsyncStorage-cached per day)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const workout = await fetchAIWorkoutSuggestion();
                if (!cancelled && workout) setAiWorkout(workout);
            } catch { /* silently fall back to local workout */ }
            finally { if (!cancelled) setAiWorkoutLoading(false); }
        })();
        return () => { cancelled = true; };
    }, []);

    // Animate XP bar on mount / value change
    useEffect(() => {
        Animated.timing(xpBarWidth, {
            toValue: xpProgressPercent,
            duration: 1200,
            useNativeDriver: false,
        }).start();
    }, [xpProgressPercent]);

    // --- NEW ANALYTICS HOOK ---
    const analytics = useAnalytics(safeUserData.runHistory, safeUserData);
    const trends = analytics.trends;

    // --- POST-RUN TRIGGER LOGIC ---
    useEffect(() => {
        if (route.params?.newRunData) {
            // 1. Show the "Great Run" Modal
            setShowRunSummary(true);

            // 2. Set the data for the modal (XP earned, Distance)
            setRunSummaryData({
                distance: parseFloat(route.params.newRunData.distance),
                xpEarned: Math.floor(parseFloat(route.params.newRunData.distance) * 50),
            });

            // 3. Clear the params so it doesn't popup again if you reload
            navigation.setParams({ newRunData: null });
        }
    }, [route.params?.newRunData]);

    useEffect(() => {
        const loadDailyTips = async () => {
            try {
                // Fetch dynamic tips
                const allTips = await contentService.fetchTips();
                if (!allTips || allTips.length === 0) return;

                const todayStr = new Date().toDateString();
                const lastFetchDate = await AsyncStorage.getItem('@ruvo_last_tip_date');
                const savedIndicesJson = await AsyncStorage.getItem('@ruvo_daily_tip_indices');
                let indices = [];

                if (lastFetchDate === todayStr && savedIndicesJson) {
                    const parsedIndices = JSON.parse(savedIndicesJson);
                    if (Array.isArray(parsedIndices) && parsedIndices.length === 4) indices = parsedIndices;
                }

                if (indices.length === 0) {
                    const totalTips = allTips.length;
                    const allIndices = Array.from({ length: totalTips }, (_, i) => i);
                    // Shuffle
                    for (let i = allIndices.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
                    }
                    indices = allIndices.slice(0, 4);
                    await AsyncStorage.setItem('@ruvo_last_tip_date', todayStr);
                    await AsyncStorage.setItem('@ruvo_daily_tip_indices', JSON.stringify(indices));
                }

                const selection = indices.map(index => {
                    const safeIndex = index < allTips.length ? index : 0;
                    const tipData = allTips[safeIndex];
                    const userViews = safeUserData.tipViews?.[tipData.id] || 0;
                    // Use real view count from Firestore if available, else fallback
                    const globalViews = tipData.viewCount || (12000 + (safeIndex * 500));
                    return { ...tipData, views: globalViews + userViews, baseViews: globalViews };
                });
                setDisplayedTips(selection);
            } catch (e) {
                console.error("Error loading tips:", e);
                // Last resort fallback if everything completely fails (e.g. offline + no cache)
                setDisplayedTips([]);
            }
        };
        loadDailyTips();
    }, [safeUserData.tipViews]);

    const todaysWorkout = useMemo(() => getTodayWorkout(userData), [userData]);
    const displayWorkout = aiWorkout || todaysWorkout;

    useEffect(() => {
        fetchWeather(safeUserData.unitSystem || 'metric').then(setWeather);
    }, [safeUserData.unitSystem]);

    // --- PULL-TO-REFRESH ---
    const onRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                fetchWeather(safeUserData.unitSystem || 'metric').then(setWeather),
                contentService.fetchTips().then(allTips => {
                    if (allTips && allTips.length > 0) {
                        // Pick 4 random tips for refresh
                        const shuffled = [...allTips].sort(() => 0.5 - Math.random());
                        setDisplayedTips(shuffled.slice(0, 4));
                    }
                }).catch(() => {}),
            ]);
        } catch (e) {
            console.log('Refresh error:', e);
        } finally {
            setIsRefreshing(false);
        }
    };

    const hasRuns = safeUserData.runHistory && safeUserData.runHistory.length > 0;
    const currentXP = safeUserData.currentXP || 0;
    const xpTarget = safeUserData.xpToNextLevel || 1000;
    const xpProgressPercent = xpTarget > 0 ? currentXP / xpTarget : 0;
    const earningProgress = safeUserData.earningUnlockProgress || safeUserData.totalKm || 0;
    const earningTarget = 100;
    const earningUnlockProgressPercent = earningProgress / earningTarget;

    const handleViewTip = (tip) => {
        lightTap();
        incrementTipView(tip.id); // Local user tracking
        contentService.incrementTipView(tip.id); // Global count
        navigation.navigate('TipDetail', { tip });
    };
    const handleCollectRewards = () => { lightTap(); setShowRunSummary(false); if (runSummaryData?.newBadge) { setShowBadgeReveal(true); Animated.parallel([Animated.spring(badgeScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }), Animated.timing(badgeOpacity, { toValue: 1, duration: 500, useNativeDriver: true })]).start(); } };
    const closeBadgeReveal = () => { lightTap(); setShowBadgeReveal(false); badgeScale.setValue(0); badgeOpacity.setValue(0); };

    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#000', padding: 20, paddingTop: 80 }}>
                <SkeletonCard variant="card" count={3} />
                <View style={{ marginTop: 20 }}>
                    <SkeletonCard variant="chart" />
                </View>
            </View>
        );
    }

    return (
                <SafeAreaView style={styles.container} edges={['top']}>
                    <StatusBar barStyle="light-content" />
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={onRefresh}
                                tintColor="#CCFF00"
                                colors={['#CCFF00']}
                                progressBackgroundColor="#1C1C1E"
                            />
                        }
                    >

                        <View style={styles.header}>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.navigate('Profile'); }}><Ionicons name="person-outline" size={24} color="#FFF" /></TouchableOpacity>
                            <View style={styles.headerRight}>
                                <NotificationBell onPress={() => { lightTap(); setShowNotifications(true); }} />
                                {/* --- CALENDAR BUTTON FIX --- */}
                                <TouchableOpacity activeOpacity={0.7} style={{ marginLeft: 20 }} onPress={() => { lightTap(); navigation.navigate('Plan'); }}>
                                    <Ionicons name="calendar-outline" size={24} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* --- BENTO DASHBOARD --- */}
                        <View style={{ marginBottom: 16 }}>
                            <View style={{ marginBottom: 15 }}>
                                <Text style={{ color: '#888', fontSize: 14, fontFamily: 'Poppins_500Medium' }}>Keep Moving Today!</Text>
                                <Text style={{ color: '#FFF', fontSize: 32, fontFamily: 'Poppins_700Bold' }}>Hi, {safeUserData.name?.split(' ')[0] || 'Runner'}</Text>
                            </View>

                            {/* Status Banners integrated here */}
                            {userData?.trainingPlan?.status === 'Injured' && (
                                <View style={[styles.statusBanner, { backgroundColor: 'rgba(255, 59, 48, 0.15)', borderColor: '#FF3B30', marginBottom: 15 }]}>
                                    <Ionicons name="medkit" size={20} color="#FF3B30" />
                                    <Text style={[styles.statusText, { color: '#FF3B30' }]}>Recovery Mode Active</Text>
                                </View>
                            )}
                            {userData?.trainingPlan?.status === 'Vacation' && (
                                <View style={[styles.statusBanner, { backgroundColor: 'rgba(10, 132, 255, 0.15)', borderColor: '#0A84FF', marginBottom: 15 }]}>
                                    <Ionicons name="airplane" size={20} color="#0A84FF" />
                                    <Text style={[styles.statusText, { color: '#0A84FF' }]}>Vacation Mode Active</Text>
                                </View>
                            )}

                            {/* The New Dashboard Component */}
                            <Text style={[styles.sectionTitle, { marginBottom: 15 }]}>Your Recents Stats</Text>
                            <RuvoDashboard />
                        </View>


                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Performance Insights</Text>
                        </View>

                        <GlassCard style={styles.insightDashboard}>
                            <View style={styles.insightTopRow}>
                                <View style={styles.insightCol}>
                                    <Text style={styles.insightLabel}>30-DAY AVG PACE</Text>
                                    <Text style={styles.insightValue}>{trends.avgPaceStr}<Text style={styles.insightUnit}>{userData?.unitSystem === 'imperial' ? '/mi' : '/km'}</Text></Text>
                                    <View style={styles.improvementBadge}>
                                        <Ionicons name="trending-down" size={12} color={COLORS.accent} />
                                        <Text style={styles.improvementText}>STABLE</Text>
                                    </View>
                                </View>
                                <View style={styles.verticalInsightDivider} />
                                <View style={styles.insightCol}>
                                    <Text style={styles.insightLabel}>CONSISTENCY</Text>
                                    <Text style={styles.insightValue}>{trends.runCount30}<Text style={styles.insightUnit}> RUNS</Text></Text>
                                    <Text style={styles.insightSubtext}>Last 30 days</Text>
                                </View>
                            </View>
                            <TouchableOpacity activeOpacity={0.7} style={styles.insightFooter} onPress={() => { lightTap(); navigation.navigate('Gear'); }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="shoe-sneaker" size={16} color="#888" />
                                    <Text style={styles.insightFooterText}>Active Gear: {safeUserData.gearList?.find(g => g.isDefault)?.name || "Select Shoe"}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#666" />
                            </TouchableOpacity>
                        </GlassCard>

                        {trends.chartData && trends.chartData.length > 1 && (
                            <GlassCard style={styles.hrChartContainer}>
                                <View style={styles.hrHeader}>
                                    <Ionicons name="pulse" size={16} color={COLORS.accent} />
                                    <Text style={styles.hrTitle}>Heart Rate Trend (30 Days)</Text>
                                </View>
                                <LineChart data={trends.chartData} width={width - 80} height={140} color={COLORS.accent} />
                                <Text style={styles.hrAiAdvice}>
                                    RUVO AI: Your intensity is trending {trends.chartData[trends.chartData.length - 1] > trends.chartData[0] ? "upward" : "steady"}. Monitor recovery.
                                </Text>
                            </GlassCard>
                        )}

                        <GlassCard style={styles.workoutCard} onPress={() => navigation.navigate('WorkoutDetail', { workout: displayWorkout })}>
                            <View style={styles.workoutHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.aiBadge}>
                                        {aiWorkoutLoading
                                            ? <ActivityIndicator size="small" color="#000" style={{ width: 10, height: 10, marginRight: 3 }} />
                                            : <Ionicons name="sparkles" size={10} color="#000" style={{ marginRight: 3 }} />}
                                        <Text style={styles.aiBadgeText}>{aiWorkout ? 'AI Coach' : 'AI Plan'}</Text>
                                    </View>
                                    <Text style={styles.workoutTitle}>{"Today's workout"}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name={weather.icon} size={16} color="#AAA" />
                                    <Text style={{ color: '#AAA', fontFamily: 'Poppins_500Medium', fontSize: 13, marginLeft: 5 }}>
                                        {weather.temp !== '--' ? `${weather.temp}${weather.unit}` : '--'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.workoutName}>{displayWorkout.title}</Text>

                            <Text style={styles.workoutDesc}>{displayWorkout.desc}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, flexWrap: 'wrap', gap: 6 }}>
                                <View style={styles.intensityBadge}><Text style={styles.intensityText}>{displayWorkout.intensity} intensity</Text></View>
                                {!displayWorkout.isRest && displayWorkout.distance > 0 && (
                                    <View style={styles.coinEstimateBadge}>
                                        <MaterialCommunityIcons name="star-circle" size={11} color="#CCFF00" style={{ marginRight: 3 }} />
                                        <Text style={styles.coinEstimateText}>~{Math.round(displayWorkout.distance * 10)} coins</Text>
                                    </View>
                                )}
                            </View>
                            {aiWorkout?.explanation ? (
                                <Text style={styles.workoutExplanation}>{aiWorkout.explanation}</Text>
                            ) : null}
                        </GlassCard>

                        <TouchableOpacity activeOpacity={0.85} style={styles.startRunButton} onPress={() => { lightTap(); navigation.navigate('ActiveRun', { workout: displayWorkout, userWeight: safeUserData.weight || 70, runTracking: true }); }}>
                            <View style={styles.startRunIconCircle}>
                                <Ionicons name="play" size={20} color={COLORS.accent} />
                            </View>
                            <View style={styles.startRunTextBlock}>
                                <Text style={styles.startRunText}>START RUN</Text>
                                <Text style={styles.startRunSubtext}>Tap to begin your session</Text>
                            </View>
                            <Ionicons name="arrow-forward-circle" size={28} color="rgba(0,0,0,0.2)" />
                        </TouchableOpacity>

                        {/* LEVEL AND XP CARD (Updated with Coins) */}
                        <GlassCard style={styles.xpCard}>
                            <View style={styles.xpHeaderRow}>
                                <View>
                                    <Text style={styles.xpLevelText}>Level {(safeUserData.level || 1)}: Rookie</Text>
                                    <Text style={styles.xpTargetText}>{1000 - (safeUserData.currentXP || 0)} XP to next level</Text>
                                </View>

                                {/* --- NEW COIN BADGE --- */}
                                <View style={styles.coinDisplay}>
                                    <MaterialCommunityIcons name="star-circle" size={16} color="#000" />
                                    <Text style={styles.coinDisplayText}>{(safeUserData.coins || 0).toLocaleString()}</Text>
                                </View>
                            </View>

                            <View style={{ marginBottom: 5, marginTop: 10 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <Text style={styles.xpCurrentProgressText}>Current progress</Text>
                                    <Text style={styles.xpCurrentProgressPercentText}>{Math.round(xpProgressPercent * 100)}%</Text>
                                </View>
                                <View style={styles.xpProgressBarContainer}>
                                    <Animated.View style={[styles.xpProgressBarFill, {
                                        width: xpBarWidth.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['0%', '100%'],
                                        })
                                    }]} />
                                </View>
                            </View>

                            <View style={styles.earningHeaderRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={[styles.dot, earningUnlockProgressPercent >= 1 ? styles.dotUnlocked : styles.dotLocked]} />
                                    <Text style={[styles.earningText, earningUnlockProgressPercent >= 1 ? styles.earningTextUnlocked : styles.earningTextLocked]}>
                                        Earning feature
                                    </Text>
                                </View>
                                <Text style={[styles.lockStatus, earningUnlockProgressPercent >= 1 ? styles.lockStatusUnlocked : styles.lockStatusLocked]}>
                                    {earningUnlockProgressPercent >= 1 ? "Active" : "Locked"}
                                </Text>
                            </View>

                            <View style={styles.xpProgressBarContainer}>
                                <View style={[styles.xpProgressBarFillEarning, { width: `${Math.min(earningUnlockProgressPercent, 1) * 100}%` }]} />
                            </View>

                            {earningUnlockProgressPercent < 1 && (
                                <Text style={styles.xpFooterRunText}>Run {earningProgress.toFixed(1)}km of {earningTarget}km to unlock Coin earning</Text>
                            )}
                        </GlassCard>



                        {/* TIPS */}
                        <Text style={styles.sectionTitle}>Tips for today</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }}>
                            {displayedTips.map((tip, index) => (
                                <View key={index} style={styles.tipContainer}>
                                    <ImageBackground source={{ uri: tip.img }} style={styles.tipImageBg} imageStyle={{ borderRadius: 20 }}>
                                        <View style={styles.tipTopRow}><View style={styles.viewsBadge}><Ionicons name="eye" size={12} color="#FFF" /><Text style={styles.viewsText}>{tip.views?.toLocaleString()}</Text></View></View>
                                        <TouchableOpacity activeOpacity={0.7} style={styles.viewButtonContainer} onPress={() => handleViewTip(tip)}><View style={styles.viewButtonOpaque}><Text style={styles.viewButtonText}>View</Text></View></TouchableOpacity>
                                    </ImageBackground>
                                    <Text style={styles.tipTitleText}>{tip.title}</Text>
                                    <Text style={styles.tipDescText} numberOfLines={2}>{tip.desc}</Text>
                                </View>
                            ))}
                        </ScrollView>
                        <View style={{ height: 40 }} />
                    </ScrollView>

                    {/* MODALS */}
                    <Modal animationType="fade" transparent={true} visible={showRunSummary} onRequestClose={() => setShowRunSummary(false)}><View style={styles.modalOverlay}><View style={styles.summaryCard}><Ionicons name="trophy" size={60} color={COLORS.accent} style={{ marginBottom: 15 }} /><Text style={styles.summaryTitle}>Great Run!</Text><Text style={styles.summaryStats}>You ran <Text style={{ color: COLORS.accent }}>{runSummaryData?.distance.toFixed(2)} km</Text></Text><View style={styles.xpBadge}><Text style={styles.xpBadgeText}>+{runSummaryData?.xpEarned} XP Earned</Text></View><TouchableOpacity activeOpacity={0.7} style={styles.summaryButton} onPress={handleCollectRewards}><Text style={styles.summaryButtonText}>Collect Rewards</Text></TouchableOpacity></View></View></Modal>
                    <Modal animationType="fade" transparent={false} visible={showBadgeReveal} onRequestClose={closeBadgeReveal}><View style={styles.badgeRevealContainer}><TouchableOpacity activeOpacity={0.7} style={styles.closeRevealButton} onPress={closeBadgeReveal}><Ionicons name="close-circle-outline" size={40} color="#666" /></TouchableOpacity><Animated.View style={{ alignItems: 'center', opacity: badgeOpacity, transform: [{ scale: badgeScale }] }}><Text style={styles.revealTitle}>MILESTONE UNLOCKED</Text><Ionicons name="trophy" size={120} color="#FFD700" /><Text style={styles.revealName}>{runSummaryData?.newBadge?.name}</Text></Animated.View></View></Modal>

                    <NotificationSheet visible={showNotifications} onClose={() => setShowNotifications(false)} />

                    {showStreakCelebration && (
                        <StreakMilestone
                            streak={currentStreak}
                            onDismiss={() => {
                                setShowStreakCelebration(false);
                                setLastCelebratedStreak(currentStreak);
                            }}
                        />
                    )}

                    <FloatingNavBar current="Home" />
                </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    greetingContainer: { marginBottom: 20 },
    greetingText: { fontSize: 32, fontFamily: 'Poppins_700Bold', color: '#FFF' },
    subGreeting: { fontSize: 14, color: '#888', marginTop: 5 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
    sectionTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: '#FFF' },

    // GLASS EFFECT FOR CARDS
    glassCard: { borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' },
    insightDashboard: { marginBottom: 25 },
    hrChartContainer: { marginBottom: 25 },
    progressMainCard: { marginBottom: 25 },
    statCard: { width: '48%', justifyContent: 'space-between' },
    workoutCard: { marginBottom: 25 },
    xpCard: { marginBottom: 25 },

    // INNER COMPONENTS
    insightTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    insightCol: { flex: 1, alignItems: 'center' },
    verticalInsightDivider: { width: 1, height: 40, backgroundColor: '#333' },
    insightLabel: { color: '#666', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1, marginBottom: 5 },
    insightValue: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold' },
    insightUnit: { fontSize: 12, color: '#666' },
    improvementBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(204, 255, 0, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 5 },
    improvementText: { color: "#CCFF00", fontSize: 9, fontFamily: 'Poppins_700Bold', marginLeft: 4 },
    insightSubtext: { color: '#444', fontSize: 10, marginTop: 5 },
    insightFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#222', paddingTop: 15 },
    insightFooterText: { color: '#888', fontSize: 12, marginLeft: 8, fontFamily: 'Poppins_500Medium' },

    hrHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    hrTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold', marginLeft: 10 },
    hrAiAdvice: { color: '#666', fontSize: 11, fontStyle: 'italic', marginTop: 15, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10 },

    progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    weeklyLabel: { color: '#AAA', fontSize: 14, fontFamily: 'Poppins_400Regular' },
    percentageBig: { fontSize: 36, fontFamily: 'Poppins_700Bold', marginVertical: 5 },
    kmSmall: { color: '#666', fontSize: 12 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    statIconContainer: { marginBottom: 10 },
    statNumber: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: '#FFF' },
    statLabel: { fontSize: 14, color: '#AAA', fontFamily: 'Poppins_400Regular', marginBottom: 5 },
    trendRow: { flexDirection: 'row', alignItems: 'center' },
    workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginRight: 8 },
    aiBadgeText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#000' },
    workoutTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold' },
    workoutName: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold', marginBottom: 5 },
    workoutDesc: { color: '#AAA', fontSize: 14, marginBottom: 15 },
    intensityBadge: { backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
    intensityText: { color: '#FFF', fontSize: 12 },
    coinEstimateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(204,255,0,0.12)', borderWidth: 1, borderColor: 'rgba(204,255,0,0.25)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
    coinEstimateText: { color: '#CCFF00', fontSize: 12 },
    workoutExplanation: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 10, fontStyle: 'italic' },
    completedBadge: { backgroundColor: '#4CD964', borderRadius: 15 },
    startRunButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 18, marginBottom: 25, boxShadow: "0 6px 16px rgba(204, 255, 0, 0.35)" },
    startRunIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    startRunTextBlock: { flex: 1 },
    startRunText: { fontSize: 16, fontFamily: 'Poppins_800ExtraBold', color: '#000', letterSpacing: 1.5 },
    startRunSubtext: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: 'rgba(0,0,0,0.45)', marginTop: 2 },
    xpHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    xpLevelText: { color: '#FFF', fontFamily: 'Poppins_700Bold' },
    xpTargetText: { color: '#AAA', fontSize: 12, paddingTop: 5, },
    xpProgressBarContainer: { height: 6, backgroundColor: '#333', borderRadius: 3, marginTop: 4, overflow: 'hidden' },
    xpProgressBarFill: { height: '100%', backgroundColor: COLORS.accent },
    xpProgressBarFillEarning: { height: '100%', backgroundColor: '#FFD700' },
    xpCurrentProgressText: { color: '#AAA', fontSize: 12 },
    xpCurrentProgressPercentText: { color: '#FFF', fontSize: 12 },
    earningHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 2 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    dotLocked: { backgroundColor: '#333' },
    dotUnlocked: { backgroundColor: '#FFD700' },
    earningText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    earningTextLocked: { color: '#666' },
    earningTextUnlocked: { color: '#FFF' },
    lockStatus: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    lockStatusLocked: { color: '#666' },
    lockStatusUnlocked: { color: '#FFD700' },
    xpFooterRunText: { color: '#666', fontSize: 10, marginTop: 10, fontStyle: 'italic' },
    tipContainer: { width: 220, marginRight: 15 },
    tipImageBg: { width: 220, height: 140, justifyContent: 'space-between', padding: 10 },
    tipTopRow: { flexDirection: 'row', justifyContent: 'flex-end' },
    viewsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    viewsText: { color: '#FFF', fontSize: 10, marginLeft: 4 },
    viewButtonContainer: { alignSelf: 'flex-start' },
    viewButtonOpaque: { backgroundColor: COLORS.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
    viewButtonText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#000' },
    tipTitleText: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', marginTop: 10, fontSize: 14 },
    tipDescText: { color: '#AAA', fontSize: 12, marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    promptCard: { width: '80%', backgroundColor: '#222', borderRadius: 20, padding: 25, alignItems: 'center' },
    promptTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 10 },
    promptMessage: { color: '#AAA', textAlign: 'center', marginBottom: 20 },
    promptButton: { backgroundColor: COLORS.accent, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
    promptButtonText: { fontFamily: 'Poppins_700Bold', color: '#000' },
    promptSkipText: { color: '#666' },
    summaryCard: { width: '85%', backgroundColor: '#222', borderRadius: 20, padding: 30, alignItems: 'center', borderColor: COLORS.accent, borderWidth: 1 },
    summaryTitle: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: '#FFF', marginBottom: 10 },
    summaryStats: { color: '#AAA', fontSize: 16, marginBottom: 20 },
    xpBadge: { backgroundColor: '#333', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, marginBottom: 20 },
    xpBadgeText: { color: '#FFD700', fontFamily: 'Poppins_700Bold' },
    summaryButton: { backgroundColor: COLORS.accent, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30 },
    summaryButtonText: { fontFamily: 'Poppins_700Bold', color: '#000' },
    badgeRevealContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    revealTitle: { color: COLORS.accent, fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 20, letterSpacing: 2 },
    glowContainer: { boxShadow: "0 0 30px rgba(255, 215, 0, 0.8)" },
    revealName: { color: '#FFF', fontSize: 28, fontFamily: 'Poppins_700Bold', marginTop: 20 },
    revealDesc: { color: '#AAA', textAlign: 'center', paddingHorizontal: 40, marginTop: 10 },
    revealCongrat: { color: '#666', fontSize: 12, marginTop: 20, textTransform: 'uppercase', letterSpacing: 1 },
    divider: { height: 1, width: 50, backgroundColor: '#333', marginTop: 20 },
    closeRevealButton: { position: 'absolute', top: 50, right: 20 },

    // --- ANALYTICS MODAL STYLES ---
    analyticsModalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
    analyticsModalContent: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 25, borderTopRightRadius: 25, height: '80%', padding: 25 },
    analyticsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    analyticsTitle: { color: COLORS.accent, fontSize: 20, fontFamily: 'Poppins_700Bold', letterSpacing: 2 },
    analyticsSection: { marginBottom: 30, backgroundColor: '#222', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#333' },
    analyticsSubTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold', marginBottom: -5, },
    analyticsText: { color: '#888', fontSize: 13, lineHeight: 20, marginTop: 5 },
    analyticsBigNumber: { color: '#FFF', fontSize: 48, fontFamily: 'Poppins_700Bold', marginVertical: 5 },
    volChartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, paddingVertical: 10 },
    volBarWrapper: { alignItems: 'center', flex: 1 },
    volBar: { width: 12, backgroundColor: COLORS.accent, borderRadius: 4 },
    volLabel: { color: '#666', fontSize: 10, marginTop: 5 },
    pbRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 4 },
    pbLabel: { color: '#CCC', fontSize: 14, fontFamily: 'Poppins_500Medium' },
    pbValue: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold' },

    // --- STREAK STYLES ---
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        borderRadius: 15,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginLeft: 10
    },
    streakText: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
        marginLeft: 4
    },

    // --- AI COACH CARD STYLES ---
    aiCoachCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(28, 28, 30, 0.65)',
        borderRadius: 20,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    aiCoachIconBox: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    aiCoachTitle: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    },
    aiCoachSubtitle: {
        color: '#888',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
    },
    // Add these new styles:
    coinDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent, // Neon Yellow background
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    coinDisplayText: {
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
        color: '#000', // Black text for contrast
        marginLeft: 5,
    },
    // --- RECENT RUN STYLES ---
    recentRunTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 16 },
    recentRunDate: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular' },
    recentRunDist: { color: COLORS.accent, fontSize: 20, fontFamily: 'Poppins_700Bold' },
    recentRunTime: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold' },

    // NEW STYLES
    analyticsBigNumberSmall: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold' },
    analyticsLabelSmall: { color: '#666', fontSize: 12, fontFamily: 'Poppins_400Regular' },

    // --- STATUS BANNER STYLES ---
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 15,
        marginBottom: 25,
        borderWidth: 1,
    },
    statusText: {
        marginLeft: 12,
        fontFamily: 'Poppins_700Bold',
        fontSize: 14,
    },
});