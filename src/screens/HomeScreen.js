import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, ImageBackground, Modal, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Stop, LinearGradient as SvgLinearGradient, Text as SvgText } from 'react-native-svg';
import { useNotifications } from '../context/NotificationContext';
import { useUser } from '../context/UserContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { getTodayWorkout } from '../services/aiCoach';

import FloatingNavBar from '../components/FloatingNavBar';
import NotificationBell from '../components/NotificationBell';
import NotificationSheet from '../components/NotificationSheet';
import RuvoDashboard from '../components/RuvoDashboard'; // <--- Import
import SkeletonCard from '../components/SkeletonCard';
import StreakMilestone, { shouldCelebrateStreak } from '../components/StreakMilestone';
import { contentService } from '../services/contentService';
import { fetchTodayStats } from '../services/healthService';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';

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

const MOTIVATIONAL_QUOTES = [
    "Just show up.", "Defy your limits.", "Run your race.", "Keep moving forward.", "Stronger every step.", "Focus on today.", "Chase greatness.", "No excuses.", "Earn your miles.", "You got this.",
];

// TIP_LIBRARY removed - using contentService

const fetchWeather = async (locationData) => {
    // FIX: Get real device coordinates first, fallback to stored location or London
    let lat, lon;
    
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
            const position = await Location.getCurrentPositionAsync({});
            lat = position.coords.latitude;
            lon = position.coords.longitude;
        } else {
            // Fallback to stored location
            lat = locationData?.latitude || 51.5074;
            lon = locationData?.longitude || -0.1278;
        }
    } catch (error) {
        console.log("Location Error", error);
        // Fallback to stored location or London
        lat = locationData?.latitude || 51.5074;
        lon = locationData?.longitude || -0.1278;
    }

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.current_weather) return { temp: '--', icon: 'cloudy-outline' };

        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;
        let icon = code === 0 ? 'sunny' : (code <= 3 ? 'partly-sunny' : (code >= 45 && code <= 48 ? 'cloudy' : 'rainy'));

        return { temp, icon: icon + '-outline' };
    } catch (error) {
        console.log("Weather Error", error);
        return { temp: '--', icon: 'cloudy-outline' };
    }
};

const CircularProgress = ({ size, strokeWidth, progress }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress * circumference);
    return (
        <View style={{ width: size, height: size, transform: [{ rotate: '-90deg' }] }}>
            <Svg width={size} height={size}>
                <Defs><SvgLinearGradient id="grad" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={COLORS.accent} stopOpacity="1" /><Stop offset="1" stopColor="#FFFF00" stopOpacity="1" /></SvgLinearGradient></Defs>
                <Circle stroke="#333" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="transparent" />
                {progress > 0 && <Circle stroke="url(#grad)" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />}
            </Svg>
        </View>
    );
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

const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff); d.setHours(0, 0, 0, 0); return d;
};



export default function HomeScreen({ route, navigation }) {
    const { userData, incrementTipView, isLoading } = useUser();
    const { addNotification } = useNotifications();

    const safeUserData = userData || {};
    const [showNotifications, setShowNotifications] = useState(false);
    const [showRunSummary, setShowRunSummary] = useState(false);
    const [runSummaryData, setRunSummaryData] = useState(null);

    const [healthStats, setHealthStats] = useState({ steps: 0, restingHR: 0, calories: 0 });
    const [isHealthConnected, setIsHealthConnected] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        fetchTodayStats().then(stats => {
            if (stats && (stats.steps > 0 || stats.restingHR > 0)) {
                setHealthStats(stats);
                setIsHealthConnected(true);
            }
        }).catch(() => {});
    }, []);

    const isWorkoutCompleted = useMemo(() => {
        if (!safeUserData.runHistory) return false;
        const todayString = new Date().toDateString();
        return safeUserData.runHistory.some(run => new Date(run.date).toDateString() === todayString);
    }, [safeUserData.runHistory]);

    const [weather, setWeather] = useState({ temp: '--', icon: 'cloudy-outline' });
    const [displayedTips, setDisplayedTips] = useState([]);
    const [showBadgeReveal, setShowBadgeReveal] = useState(false);
    const badgeScale = useRef(new Animated.Value(0)).current;
    const badgeOpacity = useRef(new Animated.Value(0)).current;
    const xpBarWidth = useRef(new Animated.Value(0)).current;

    // Streak celebration
    const [showStreakCelebration, setShowStreakCelebration] = useState(false);
    const [lastCelebratedStreak, setLastCelebratedStreak] = useState(0);

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

    const dailyQuote = useMemo(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)], []);

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

    useEffect(() => {
        fetchWeather(safeUserData.location || null).then(setWeather);
    }, [safeUserData.location]);

    // --- PULL-TO-REFRESH ---
    const onRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                fetchWeather(safeUserData.location || null).then(setWeather),
                fetchTodayStats().then(stats => {
                    if (stats && (stats.steps > 0 || stats.restingHR > 0)) {
                        setHealthStats(stats);
                        setIsHealthConnected(true);
                    }
                }).catch(() => {}),
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

    const progressPercent = (safeUserData.weeklyDistance || 0) / (safeUserData.weeklyGoal || 20);
    const weeklyDistance = safeUserData.weeklyDistance || 0;
    const weeklyGoal = safeUserData.weeklyGoal || 20;
    const isWeeklyGoalMet = weeklyDistance >= weeklyGoal;
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

    const handleFullAnalytics = () => {
        lightTap();
        if (userData.isPro) {
            navigation.navigate('Analytics');
        } else {
            navigation.navigate('Paywall');
        }
    };

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
        <ImageBackground source={{ uri: 'https://images.pexels.com/photos/5310917/pexels-photo-5310917.jpeg' }} style={styles.backgroundImage} imageStyle={{ opacity: 0.5 }}>
            <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000']} locations={[0, 0.6, 1]} style={styles.overlay}>
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
                                <Text style={{ color: '#888', fontSize: 12, fontWeight: '600', letterSpacing: 1 }}>WELCOME BACK</Text>
                                <Text style={{ color: '#FFF', fontSize: 32, fontFamily: 'Poppins_700Bold' }}>{safeUserData.name?.split(' ')[0] || 'Runner'}!</Text>
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
                            <RuvoDashboard onOpenAnalytics={handleFullAnalytics} />
                        </View>

                        {/* --- HEALTH DEVICE WIDGETS --- */}
                        <View style={styles.statsRow}>
                            {isHealthConnected ? (
                                <>
                                    <View style={styles.statCard}>
                                        <View style={styles.statIconContainer}>
                                            <Ionicons name="footsteps" size={24} color={COLORS.accent} />
                                        </View>
                                        <Text style={styles.statNumber}>{healthStats.steps.toLocaleString()}</Text>
                                        <Text style={styles.statLabel}>Today's Steps</Text>
                                    </View>
                                    <View style={styles.statCard}>
                                        <View style={styles.statIconContainer}>
                                            <MaterialCommunityIcons name="heart-pulse" size={24} color="#FF3B30" />
                                        </View>
                                        <Text style={styles.statNumber}>{healthStats.restingHR > 0 ? healthStats.restingHR : '--'}</Text>
                                        <Text style={styles.statLabel}>Resting HR</Text>
                                    </View>
                                </>
                            ) : (
                                <TouchableOpacity activeOpacity={0.7}
                                    style={[styles.statCard, { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }]}
                                    onPress={() => { lightTap(); navigation.navigate('ConnectedDevices'); }}
                                >
                                    <View style={[styles.statIconContainer, { marginBottom: 0, marginRight: 15 }]}>
                                        <Ionicons name="add-circle-outline" size={32} color={COLORS.accent} />
                                    </View>
                                    <View>
                                        <Text style={{ color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' }}>Connect a device</Text>
                                        <Text style={{ color: '#888', fontSize: 12 }}>Sync steps & heart rate</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <View style={styles.statIconContainer}><Ionicons name="flash" size={24} color="#FFD700" /></View>
                                <Text style={styles.statNumber}>{hasRuns && safeUserData.calories > 0 ? Math.floor(safeUserData.calories) : '--'}</Text>
                                <Text style={styles.statLabel}>Calories</Text>
                                <View style={styles.trendRow}>
                                    {hasRuns ? (<><Ionicons name={trends.calIcon} size={14} color={trends.calColor} /><Text style={{ color: trends.calColor, fontSize: 12, marginLeft: 4 }}>{trends.calText}</Text></>) : (<><Ionicons name="trending-up" size={14} color="#666" /><Text style={{ color: '#666', fontSize: 12, marginLeft: 4 }}>Start your first run</Text></>)}
                                </View>
                            </View>
                            <View style={styles.statCard}>
                                <View style={styles.statIconContainer}><Ionicons name="heart-outline" size={24} color="#FF4081" /></View>
                                <Text style={styles.statNumber}>{hasRuns && safeUserData.bpm > 0 ? Math.round(safeUserData.bpm) : '--'}</Text>
                                <Text style={styles.statLabel}>Avg BPM</Text>
                                <View style={styles.trendRow}>
                                    {hasRuns ? (<><MaterialIcons name={trends.bpmIcon} size={14} color={trends.bpmColor} /><Text style={{ color: trends.bpmColor, fontSize: 12, marginLeft: 4 }}>{trends.bpmText}</Text></>) : (<><MaterialIcons name="trending-flat" size={14} color="#666" /><Text style={{ color: '#666', fontSize: 12, marginLeft: 4 }}>No data yet</Text></>)}
                                </View>
                            </View>
                        </View>

                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Performance Insights</Text>
                        </View>

                        <View style={styles.insightDashboard}>
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
                        </View>

                        {trends.chartData && trends.chartData.length > 1 && (
                            <View style={styles.hrChartContainer}>
                                <View style={styles.hrHeader}>
                                    <Ionicons name="pulse" size={16} color={COLORS.accent} />
                                    <Text style={styles.hrTitle}>Heart Rate Trend (30 Days)</Text>
                                </View>
                                <LineChart data={trends.chartData} width={width - 80} height={140} color={COLORS.accent} />
                                <Text style={styles.hrAiAdvice}>
                                    RUVO AI: Your intensity is trending {trends.chartData[trends.chartData.length - 1] > trends.chartData[0] ? "upward" : "steady"}. Monitor recovery.
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity activeOpacity={0.7} style={styles.workoutCard} onPress={() => { lightTap(); navigation.navigate('WorkoutDetail', { workout: todaysWorkout }); }}>
                            <View style={styles.workoutHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.aiBadge}><Ionicons name="sparkles" size={10} color="#000" style={{ marginRight: 3 }} /><Text style={styles.aiBadgeText}>AI Plan</Text></View>
                                    <Text style={styles.workoutTitle}>Today's workout</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name={weather.icon} size={16} color="#AAA" /><Text style={{ color: '#AAA', marginLeft: 5 }}>{weather.temp}°C</Text></View>
                            </View>

                            <Text style={styles.workoutName}>{todaysWorkout.title}</Text>

                            <Text style={styles.workoutDesc}>{todaysWorkout.desc}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                                <View style={styles.intensityBadge}><Text style={styles.intensityText}>{todaysWorkout.intensity} intensity</Text></View>
                                {/* --- COMPLETED BADGE REMOVED --- */}
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity activeOpacity={0.7} style={styles.startRunButton} onPress={() => { lightTap(); navigation.navigate('ActiveRun', { workout: todaysWorkout, userWeight: safeUserData.weight || 70 }); }}>
                            <Ionicons name="play" size={24} color="#000" /><Text style={styles.startRunText}>Start run</Text>
                        </TouchableOpacity>

                        {/* LEVEL AND XP CARD (Updated with Coins) */}
                        <View style={styles.xpCard}>
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
                                    <View style={styles.xpProgressBarBg} />
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
                                <View style={styles.xpProgressBarBg} />
                                <View style={[styles.xpProgressBarFillEarning, { width: `${Math.min(earningUnlockProgressPercent, 1) * 100}%` }]} />
                            </View>

                            {earningUnlockProgressPercent < 1 && (
                                <Text style={styles.xpFooterRunText}>Run {earningProgress.toFixed(1)}km of {earningTarget}km to unlock Coin earning</Text>
                            )}
                        </View>



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
            </LinearGradient>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    backgroundImage: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000' },
    overlay: { flex: 1 },
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    greetingContainer: { marginBottom: 20 },
    greetingText: { fontSize: 32, fontFamily: 'Poppins_700Bold', color: '#FFF' },
    subGreeting: { fontSize: 14, color: '#888', marginTop: 5 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
    sectionTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: '#FFF' },

    // GLASS EFFECT FOR CARDS
    insightDashboard: { backgroundColor: 'rgba(28, 28, 30, 0.65)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 25 },
    hrChartContainer: { backgroundColor: 'rgba(28, 28, 30, 0.65)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 25 },
    progressMainCard: { backgroundColor: 'rgba(28, 28, 30, 0.65)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 25 },
    statCard: { width: '48%', backgroundColor: 'rgba(28, 28, 30, 0.65)', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'space-between' },
    workoutCard: { backgroundColor: 'rgba(28, 28, 30, 0.65)', borderRadius: 20, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
    xpCard: { backgroundColor: 'rgba(28, 28, 30, 0.65)', borderRadius: 20, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },

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
    completedBadge: { backgroundColor: '#4CD964', borderRadius: 15 },
    startRunButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, borderRadius: 25, padding: 20, justifyContent: 'center', marginBottom: 25, height: 60 },
    startRunText: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#000', marginLeft: 10 },
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
    glowContainer: { shadowColor: '#FFD700', shadowOpacity: 0.8, shadowRadius: 30, elevation: 20 },
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

    // --- ANALYTICS MODAL STYLES ---
    analyticsModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
    analyticsModalContent: { backgroundColor: '#101010', height: '90%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
    analyticsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    analyticsTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
    analyticsSection: { marginBottom: 15, padding: 20, backgroundColor: '#1C1C1E', borderRadius: 16, borderWidth: 1, borderColor: '#333' },
    analyticsSubTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    analyticsBigNumber: { color: '#FFF', fontSize: 42, fontFamily: 'Poppins_700Bold', lineHeight: 50 },
    analyticsText: { color: '#888', fontSize: 13, marginTop: 5, fontFamily: 'Poppins_400Regular' },
    volChartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, paddingVertical: 10 },
    volBarWrapper: { alignItems: 'center', width: 40 },
    volBar: { width: 12, backgroundColor: COLORS.accent, borderRadius: 4 },
    volLabel: { color: '#666', fontSize: 10, marginTop: 5 },
    pbRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    pbLabel: { color: '#CCC', fontSize: 14, fontFamily: 'Poppins_400Regular' },
    pbValue: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold' },

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