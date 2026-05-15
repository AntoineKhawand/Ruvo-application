import React, { useEffect, useMemo } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import Svg, { Circle, Path, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useUser } from '../context/UserContext';
import { lightTap } from '../utils/haptics';
import GlassCard from './GlassCard';

const { width } = Dimensions.get('window');
const GAP = 12;
const PADDING = 20;
const COLUMN_WIDTH = (width - (PADDING * 2) - GAP) / 2;

const COLORS = {
    background: "#000000",
    card: "rgba(28, 28, 30, 0.6)",
    accent: "#CCFF00",
    text: "#FFFFFF",
    subText: "#888888",
    danger: "#FF3B30",
    water: "#00BFFF",
};

// GlassCard is now imported from components

// --- MINI BAR CHART FOR STEPS ---
const MiniBarChart = ({ data }) => {
    const height = 40;
    const barWidth = 4;
    const maxVal = Math.max(...data, 1);
    
    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height }}>
            {data.map((val, i) => {
                const barHeight = (val / maxVal) * height;
                return (
                    <View 
                        key={i} 
                        style={{ 
                            width: barWidth, 
                            height: Math.max(barHeight, 4), 
                            backgroundColor: i === data.length - 1 ? COLORS.accent : 'rgba(255,255,255,0.2)',
                            borderRadius: 2
                        }} 
                    />
                );
            })}
        </View>
    );
};

// --- MINI LINE CHART FOR WATER ---
const MiniLineChart = ({ data }) => {
    const h = 30;
    const w = COLUMN_WIDTH - 30;
    const maxVal = Math.max(...data, 1);
    const stepX = w / (data.length - 1);
    
    let pathD = `M 0 ${h - (data[0] / maxVal) * h}`;
    data.forEach((val, i) => {
        pathD += ` L ${i * stepX} ${h - (val / maxVal) * h}`;
    });

    return (
        <Svg height={h} width={w}>
            <Path d={pathD} stroke={COLORS.water} strokeWidth="2" fill="none" strokeLinecap="round" />
        </Svg>
    );
};

// --- CIRCULAR PROGRESS FOR CALORIES ---
const CircularProgress = ({ percentage, size = 50, strokeWidth = 5 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage * circumference);

    return (
        <View style={{ width: size, height: size, transform: [{ rotate: '-90deg' }] }}>
            <Svg width={size} height={size}>
                <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} fill="transparent" />
                <Circle
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke={COLORS.accent} strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </Svg>
        </View>
    );
};

export default function RuvoDashboard({ onOpenAnalytics }) {
    const { userData, healthData, refreshHealthData } = useUser();
    const navigation = useNavigation();

    useEffect(() => {
        refreshHealthData();
    }, []);

    // Real Data
    const steps = healthData?.steps || 0;
    const calories = healthData?.calories || userData?.calories || 0;
    const weeklyDist = userData?.weeklyDistance || 0;
    const weeklyGoal = userData?.weeklyGoal || 25;

    const km = (steps * 0.00076).toFixed(2);

    // Real step history from last 7 days of run history
    const stepHistory = useMemo(() => {
        const history = userData?.runHistory || [];
        const today = new Date();
        const last7 = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (6 - i));
            const dayStr = d.toDateString();
            const total = history
                .filter(r => new Date(r.date).toDateString() === dayStr)
                .reduce((sum, r) => sum + (r.steps || 0), 0);
            return total;
        });
        // Replace last entry with live today steps if higher
        last7[6] = Math.max(last7[6], steps);
        return last7;
    }, [userData?.runHistory, steps]);

    // Real weekly distance history (last 6 days + today) from run history
    const weeklyDistHistory = useMemo(() => {
        const history = userData?.runHistory || [];
        const today = new Date();
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (5 - i));
            const dayStr = d.toDateString();
            return history
                .filter(r => new Date(r.date).toDateString() === dayStr)
                .reduce((sum, r) => sum + (r.distance || 0), 0);
        });
    }, [userData?.runHistory]);

    // Dynamic banner subtitle from real run frequency goal
    const runsThisWeek = useMemo(() => {
        const history = userData?.runHistory || [];
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return history.filter(r => new Date(r.date) >= weekStart).length;
    }, [userData?.runHistory]);
    const weeklyRunGoal = userData?.runFrequency || 3;
    const remaining = Math.max(0, weeklyRunGoal - runsThisWeek);
    const bannerSub = remaining > 0
        ? `${remaining} more ${remaining === 1 ? 'run' : 'runs'} to reach your goal`
        : 'Weekly goal achieved!';

    return (
        <View style={styles.container}>

            {/* 1. STAY ACTIVE BANNER */}
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate('Plan')}
                style={styles.bannerContainer}
            >
                <LinearGradient
                    colors={['#1A3300', '#CCFF00']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.bannerGradient}
                >
                    <View style={styles.bannerLeft}>
                        <View style={styles.lightningIcon}>
                            <Ionicons name="flash" size={18} color="#000" />
                        </View>
                        <View>
                            <Text style={styles.bannerTitle}>Stay Active</Text>
                            <Text style={styles.bannerSub}>{bannerSub}</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.4)" />
                </LinearGradient>
            </TouchableOpacity>

            {/* 2. BENTO GRID */}
            <View style={styles.grid}>

                {/* LEFT COLUMN: STEPS (Tall Card) */}
                <GlassCard style={styles.tallCard} onPress={() => navigation.navigate('Analytics')}>
                    <View style={styles.cardHeader}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="footsteps" size={16} color={COLORS.accent} />
                        </View>
                        <Text style={styles.cardLabel}>Steps</Text>
                        <Ionicons name="chevron-forward" size={14} color="#555" style={{ marginLeft: 'auto' }} />
                    </View>

                    <View style={styles.statContainer}>
                        <Text style={styles.mainValue}>{steps.toLocaleString()} <Text style={styles.unit}>steps</Text></Text>
                        <Text style={styles.subValue}>{km} km</Text>
                    </View>

                    <View style={styles.chartContainer}>
                        <MiniBarChart data={stepHistory} />
                    </View>
                </GlassCard>

                {/* RIGHT COLUMN: CALORIES & WEEKLY KM */}
                <View style={styles.rightCol}>

                    {/* CALORIES CARD */}
                    <GlassCard style={styles.squareCard} onPress={() => navigation.navigate('Analytics')}>
                        <View style={styles.cardHeader}>
                            <View style={styles.iconCircleRed}>
                                <Ionicons name="flame" size={16} color="#FF3B30" />
                            </View>
                            <Text style={styles.cardLabel}>Calories</Text>
                            <Ionicons name="chevron-forward" size={14} color="#555" style={{ marginLeft: 'auto' }} />
                        </View>

                        <View style={styles.rowBetween}>
                            <View>
                                <Text style={styles.squareValue}>{Math.round(calories).toLocaleString()}</Text>
                                <Text style={styles.unit}>kcal</Text>
                            </View>
                            <CircularProgress percentage={Math.min(calories / 800, 1)} />
                        </View>
                    </GlassCard>

                    {/* WEEKLY DISTANCE CARD (real data) */}
                    <GlassCard style={styles.squareCard} onPress={() => navigation.navigate('Analytics')}>
                        <View style={styles.cardHeader}>
                            <View style={styles.iconCircleBlue}>
                                <MaterialCommunityIcons name="run-fast" size={16} color={COLORS.water} />
                            </View>
                            <Text style={styles.cardLabel}>Weekly</Text>
                            <Ionicons name="chevron-forward" size={14} color="#555" style={{ marginLeft: 'auto' }} />
                        </View>

                        <View style={{ marginTop: 5 }}>
                            <Text style={styles.squareValue}>{weeklyDist.toFixed(1)}</Text>
                            <Text style={styles.unit}>/ {weeklyGoal} km</Text>
                        </View>

                        <View style={{ marginTop: 10 }}>
                            <MiniLineChart data={weeklyDistHistory.length > 1 ? weeklyDistHistory : [0, weeklyDist]} />
                        </View>
                    </GlassCard>

                </View>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    // BANNER
    bannerContainer: {
        marginBottom: GAP,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    bannerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    bannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    lightningIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerTitle: {
        color: '#000',
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
    },
    bannerSub: {
        color: 'rgba(0,0,0,0.6)',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
    },

    // GRID
    grid: {
        flexDirection: 'row',
        gap: GAP,
    },
    card: {
        borderRadius: 24,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    tallCard: {
        flex: 1,
        height: 220,
        justifyContent: 'space-between',
    },
    rightCol: {
        flex: 1,
        gap: GAP,
    },
    squareCard: {
        height: 104,
        justifyContent: 'space-between',
    },

    // CARD ELEMENTS
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(204, 255, 0, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircleRed: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 59, 48, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircleBlue: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 191, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardLabel: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
    },
    statContainer: {
        marginTop: 10,
    },
    mainValue: {
        color: '#FFF',
        fontSize: 28,
        fontFamily: 'Poppins_700Bold',
    },
    squareValue: {
        color: '#FFF',
        fontSize: 22,
        fontFamily: 'Poppins_700Bold',
    },
    unit: {
        color: '#888',
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
    },
    subValue: {
        color: '#888',
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
    },
    chartContainer: {
        marginTop: 15,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});
