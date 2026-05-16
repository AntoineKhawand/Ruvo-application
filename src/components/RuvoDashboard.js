import React, { useEffect, useMemo } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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

// --- STEPS BAR CHART: full-width with peak tooltip ---
const StepsBarChart = ({ data }) => {
    const chartHeight = 60;
    const maxVal = Math.max(...data, 1);
    const peakIdx = data.indexOf(maxVal);

    return (
        <View style={{ width: '100%', height: chartHeight + 35, marginTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight + 35, gap: 8 }}>
                {data.map((val, i) => {
                    const barH = Math.max((val / maxVal) * chartHeight, 8);
                    const isPeak = i === peakIdx && val > 0;
                    return (
                        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                            {isPeak && (
                                <View style={{
                                    backgroundColor: '#FFF',
                                    borderRadius: 12,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    marginBottom: 6,
                                    elevation: 4,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 2,
                                }}>
                                    <Text style={{ color: '#000', fontSize: 10, fontFamily: 'Poppins_700Bold' }}>
                                        {val.toLocaleString()}
                                    </Text>
                                </View>
                            )}
                            <View style={{
                                width: '100%',
                                height: barH,
                                backgroundColor: isPeak ? COLORS.accent : 'rgba(204,255,0,0.25)',
                                borderRadius: 100, // Capsule shape
                            }} />
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

// --- MINI LINE CHART FOR WATER ---
const MiniLineChart = ({ data }) => {
    const h = 24;
    const w = 45; // Fixed small width for half-cards
    const maxVal = Math.max(...data, 1);
    const stepX = w / (data.length - 1);
    
    let pathD = `M 0 ${h - (data[0] / maxVal) * h}`;
    data.forEach((val, i) => {
        pathD += ` L ${i * stepX} ${h - (val / maxVal) * h}`;
    });

    return (
        <Svg height={h} width={w}>
            <Path d={pathD} stroke={COLORS.water} strokeWidth="2.5" fill="none" strokeLinecap="round" />
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

export default function RuvoDashboard() {
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

            {/* 2. STEPS — full width */}
            <GlassCard style={styles.stepsCard} onPress={() => { lightTap(); navigation.navigate('Analytics'); }}>
                <View style={styles.cardHeader}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="footsteps" size={16} color={COLORS.accent} />
                    </View>
                    <Text style={styles.cardLabel}>Steps</Text>
                    <Ionicons name="chevron-forward" size={14} color="#555" style={{ marginLeft: 'auto' }} />
                </View>

                <View style={styles.stepsStats}>
                    <View>
                        <Text style={styles.stepsValue}>{steps.toLocaleString()}</Text>
                        <Text style={styles.stepsUnit}>Steps</Text>
                    </View>
                    <View style={styles.statsDivider} />
                    <View>
                        <Text style={styles.stepsValue}>{km}</Text>
                        <Text style={styles.stepsUnit}>km</Text>
                    </View>
                </View>

                <StepsBarChart data={stepHistory} />
            </GlassCard>

            {/* 3. BOTTOM ROW: Calories + Weekly side by side */}
            <View style={styles.bottomRow}>

                {/* CALORIES */}
                <GlassCard style={styles.halfCard} onPress={() => { lightTap(); navigation.navigate('Analytics'); }}>
                    <View style={styles.cardHeader}>
                        <View style={styles.iconCircleRed}>
                            <Ionicons name="flame" size={14} color="#FF3B30" />
                        </View>
                        <Text style={styles.cardLabel}>Calories</Text>
                    </View>
                    <View style={styles.halfCardContent}>
                        <View style={styles.valueRow}>
                            <Text style={styles.halfValue}>{Math.round(calories).toLocaleString()}</Text>
                            <Text style={styles.unit}>kcal</Text>
                        </View>
                        <CircularProgress percentage={Math.min(calories / 800, 1)} size={38} strokeWidth={4} />
                    </View>
                </GlassCard>

                {/* WEEKLY DISTANCE */}
                <GlassCard style={styles.halfCard} onPress={() => { lightTap(); navigation.navigate('Analytics'); }}>
                    <View style={styles.cardHeader}>
                        <View style={styles.iconCircleBlue}>
                            <MaterialCommunityIcons name="run-fast" size={14} color={COLORS.water} />
                        </View>
                        <Text style={styles.cardLabel}>Weekly</Text>
                    </View>
                    <View style={styles.halfCardContent}>
                        <View style={styles.valueRow}>
                            <Text style={styles.halfValue}>{weeklyDist.toFixed(1)}</Text>
                            <Text style={styles.unit}>km</Text>
                        </View>
                        <MiniLineChart data={weeklyDistHistory.length > 1 ? weeklyDistHistory : [0, weeklyDist]} />
                    </View>
                </GlassCard>

            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: '100%' },

    // BANNER
    bannerContainer: { marginBottom: GAP, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    bannerGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    lightningIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
    bannerTitle: { color: '#000', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    bannerSub: { color: 'rgba(0,0,0,0.6)', fontSize: 12, fontFamily: 'Poppins_400Regular' },

    // STEPS CARD — full width
    stepsCard: { marginBottom: GAP },
    stepsStats: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
    stepsValue: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold' },
    stepsUnit: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    statsDivider: { width: 1, height: 36, backgroundColor: '#333' },

    // BOTTOM ROW — side by side
    bottomRow: { flexDirection: 'row', gap: GAP },
    halfCard: { flex: 1, minHeight: 110, justifyContent: 'space-between' },
    halfCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 },
    valueRow: { marginBottom: -2 },
    halfValue: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold', lineHeight: 24 },

    // SHARED CARD ELEMENTS
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardLabel: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    unit: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    iconCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(204,255,0,0.15)', alignItems: 'center', justifyContent: 'center' },
    iconCircleRed: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,59,48,0.15)', alignItems: 'center', justifyContent: 'center' },
    iconCircleBlue: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,191,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
