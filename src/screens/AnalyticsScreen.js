import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SimpleBarChart, SimpleLineChart } from '../components/SimpleCharts';
import { COLORS } from '../constants/legacy-theme';
import { useUser } from '../context/UserContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import SkeletonCard from '../components/SkeletonCard';
import GlassCard from '../components/GlassCard';

const { width } = Dimensions.get('window');

const AnalyticsScreen = ({ navigation }) => {
    const { userData, loadFullRunHistory } = useUser();
    const isPro = userData?.isPro || false;
    const [timeRange, setTimeRange] = useState('Week'); // 'Week' | 'Month'
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [fullHistory, setFullHistory] = useState(null); // null = not loaded yet

    // Load full run history from subcollection on mount (bypasses 100-run cap)
    useEffect(() => {
        loadFullRunHistory().then(setFullHistory).catch(() => setFullHistory(userData?.runHistory || []));
    }, [userData?.uid]);

    // Use full history for calculations; fall back to capped array while loading
    const runHistoryForAnalytics = fullHistory ?? userData?.runHistory ?? [];
    const hasRunHistory = runHistoryForAnalytics.length > 0;

    // --- 1. CHARTS DATA (Visual Trends) ---
    const processChartData = () => {
        const history = runHistoryForAnalytics;
        const now = new Date();
        const daysToShow = timeRange === 'Week' ? 7 : 30;

        // Initialize data buckets
        const labels = [];
        const distanceData = new Array(daysToShow).fill(0);
        const paceData = new Array(daysToShow).fill(0);
        const elevationData = new Array(daysToShow).fill(0);
        const hrData = new Array(daysToShow).fill(0);

        // Generate Labels (Last N Days)
        for (let i = daysToShow - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            labels.push(d.toLocaleDateString('en-US', { weekday: 'narrow' })); // M, T, W
        }

        // Fill Data
        history.forEach(run => {
            if (!run.date) return;
            const runDate = new Date(run.date);
            const diffTime = Math.abs(now - runDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= daysToShow) {
                const index = daysToShow - diffDays;
                if (index >= 0) {
                    distanceData[index] += parseFloat(run.distance) || 0;
                    elevationData[index] += parseFloat(run.elevationGain) || 0; // Fixed prop name

                    // HR Parsing
                    const hr = parseFloat(run.heartRate) || 0;
                    if (hr > 0) {
                        if (hrData[index] === 0) hrData[index] = hr;
                        else hrData[index] = (hrData[index] + hr) / 2; // Average for the day
                    }

                    // Pace Parsing (MM:SS -> Decimal Minutes)
                    let paceVal = 0;
                    if (run.pace) {
                        const [m, s] = run.pace.split(':').map(Number);
                        paceVal = m + (s / 60);
                    }

                    if (paceData[index] === 0) paceData[index] = paceVal;
                    else paceData[index] = (paceData[index] + paceVal) / 2;
                }
            }
        });

        // Optimize Labels: Show all for weekly, show every 5th for monthly to avoid clutter
        const chartLabels = timeRange === 'Week' ? labels : labels.map((l, i) => i % 5 === 0 ? l : '');

        return { labels: chartLabels, distanceData, paceData, elevationData, hrData };
    };

    const chartData = processChartData();

    // --- 2. ADVANCED METRICS (VO2, Prediction, etc.) ---
    const analytics = useAnalytics(runHistoryForAnalytics, userData);

    // Mock HR Zones for latest run if HR data is present globally
    const hasHrData = chartData.hrData.some(hr => hr > 0);
    const mockHrZones = hasHrData ? { z5: 8, z4: 18, z3: 42, z2: 22, z1: 10 } : null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.safeArea} edges={['top']}>

                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Performance</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* TIME FILTER */}
                <View style={styles.filterContainer}>
                    <View style={styles.filterPill}>
                        <TouchableOpacity activeOpacity={0.7}
                            style={[styles.filterBtn, timeRange === 'Week' && styles.filterBtnActive]}
                            onPress={() => { lightTap(); setTimeRange('Week'); }}
                        >
                            <Text style={[styles.filterText, timeRange === 'Week' && styles.activeText]}>Weekly</Text>
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7}
                            style={[styles.filterBtn, timeRange === 'Month' && styles.filterBtnActive]}
                            onPress={() => { lightTap(); setTimeRange('Month'); }}
                        >
                            <Text style={[styles.filterText, timeRange === 'Month' && styles.activeText]}>Monthly</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => {
                                setIsRefreshing(true);
                                setTimeout(() => setIsRefreshing(false), 1000);
                            }}
                            tintColor="#CCFF00"
                            colors={['#CCFF00']}
                            progressBackgroundColor="#1C1C1E"
                        />
                    }
                >

                    {/* --- CHARTS SECTION --- */}
                    {!hasRunHistory ? (
                        <SkeletonCard variant="analytics" />
                    ) : (
                        <>
                            <GlassCard style={styles.chartCard}>
                                <View style={styles.chartHeader}>
                                    <Ionicons name="footsteps" size={18} color={COLORS.accent} />
                                    <Text style={styles.chartTitle}>Distance (km)</Text>
                                </View>
                                <SimpleBarChart
                                    data={chartData.distanceData}
                                    labels={chartData.labels}
                                    width={width - 32}
                                    height={200}
                                    barColor={COLORS.accent}
                                />
                            </GlassCard>

                            <GlassCard style={styles.chartCard}>
                                <View style={styles.chartHeader}>
                                    <Ionicons name="speedometer" size={18} color="#FFD700" />
                                    <Text style={styles.chartTitle}>Avg Pace (min/km)</Text>
                                </View>
                                <SimpleLineChart
                                    data={chartData.paceData}
                                    labels={chartData.labels}
                                    width={width - 32}
                                    height={200}
                                    lineColor="#FFD700"
                                />
                            </GlassCard>

                    <GlassCard style={styles.chartCard}>
                        <View style={styles.chartHeader}>
                            <Ionicons name="trending-up" size={18} color="#FF6B6B" />
                            <Text style={styles.chartTitle}>Elevation Gain (m)</Text>
                        </View>
                        <SimpleLineChart
                            data={chartData.elevationData}
                            labels={chartData.labels}
                            width={width - 32}
                            height={200}
                            lineColor="#FF6B6B"
                        />
                    </GlassCard>

                    <GlassCard style={styles.chartCard}>
                        <View style={styles.chartHeader}>
                            <Ionicons name="heart" size={18} color="#FF3B30" />
                            <Text style={styles.chartTitle}>Avg Heart Rate (bpm)</Text>
                        </View>
                        <SimpleLineChart
                            data={chartData.hrData}
                            labels={chartData.labels}
                            width={width - 32}
                            height={200}
                            lineColor="#FF3B30"
                        />
                    </GlassCard>
                        </>
                    )}

                    {/* --- HEART RATE ZONES (LATEST RUN) --- */}
                    {mockHrZones && (
                        <>
                            <Text style={styles.sectionTitle}>Heart Rate Zones (Latest Run)</Text>
                            <GlassCard style={styles.card}>
                                <Text style={styles.chartTitle}>Time in Zones (%)</Text>
                                
                                <View style={{ marginTop: 15 }}>
                                    {[
                                        { label: 'Z5 - Maximum', color: '#FF3B30', pct: mockHrZones.z5 },
                                        { label: 'Z4 - Threshold', color: '#FF9500', pct: mockHrZones.z4 },
                                        { label: 'Z3 - Aerobic', color: '#FFCC00', pct: mockHrZones.z3 },
                                        { label: 'Z2 - Fat Burn', color: '#34C759', pct: mockHrZones.z2 },
                                        { label: 'Z1 - Warm Up', color: '#5AC8FA', pct: mockHrZones.z1 }
                                    ].map((zone, i) => (
                                        <View key={i} style={{ marginBottom: 12 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Text style={{ color: zone.color, fontSize: 12, fontFamily: 'Poppins_700Bold' }}>{zone.label}</Text>
                                                <Text style={{ color: '#FFF', fontSize: 12 }}>{zone.pct}%</Text>
                                            </View>
                                            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                                                <View style={{ width: `${zone.pct}%`, height: '100%', backgroundColor: zone.color, borderRadius: 3 }} />
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </GlassCard>
                        </>
                    )}

                    {/* --- ADVANCED METRICS (PRO GATE) --- */}
                    <View style={styles.proSectionHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>Advanced Metrics</Text>
                            <Text style={styles.sectionSubtitle}>AI-powered training insights</Text>
                        </View>
                        {!isPro && (
                            <View style={styles.proChip}>
                                <Ionicons name="lock-closed" size={10} color="#000" />
                                <Text style={styles.proChipText}>PRO</Text>
                            </View>
                        )}
                    </View>

                    <View style={[!isPro && styles.proBlurWrap]}>

                        {/* ── VO2 Max + Consistency ── */}
                        <View style={styles.rowBetween}>
                            <GlassCard style={styles.statBox}>
                                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(0,199,190,0.15)', borderColor: 'rgba(0,199,190,0.3)' }]}>
                                    <MaterialCommunityIcons name="lung" size={22} color="#00C7BE" />
                                </View>
                                <Text style={styles.statLabel}>Est. VO2 Max</Text>
                                <Text style={styles.statValue}>{isPro ? analytics.vo2Max : '—'}</Text>
                                {isPro && (
                                    <Text style={[styles.statDescriptor, { color: '#00C7BE' }]}>
                                        {analytics.vo2Max >= 55 ? 'Superior' : analytics.vo2Max >= 45 ? 'Good' : analytics.vo2Max >= 35 ? 'Fair' : 'Basic'}
                                    </Text>
                                )}
                                <View style={[styles.statBottomStripe, { backgroundColor: '#00C7BE' }]} />
                            </GlassCard>

                            <GlassCard style={styles.statBox}>
                                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(255,45,85,0.15)', borderColor: 'rgba(255,45,85,0.3)' }]}>
                                    <Ionicons name="calendar" size={22} color="#FF2D55" />
                                </View>
                                <Text style={styles.statLabel}>Consistency</Text>
                                <Text style={styles.statValue}>
                                    {isPro ? analytics.consistencyScore : '—'}
                                    {isPro && <Text style={{ fontSize: 13, color: '#666' }}> /wk</Text>}
                                </Text>
                                {isPro && (
                                    <Text style={[styles.statDescriptor, { color: '#FF2D55' }]}>
                                        {analytics.consistencyScore >= 5 ? 'Elite' : analytics.consistencyScore >= 3 ? 'Solid' : analytics.consistencyScore >= 1 ? 'Building' : 'Start'}
                                    </Text>
                                )}
                                <View style={[styles.statBottomStripe, { backgroundColor: '#FF2D55' }]} />
                            </GlassCard>
                        </View>

                        {/* ── Recovery Score ── */}
                        <GlassCard style={styles.card}>
                            <View style={styles.recoveryHeader}>
                                <View style={styles.recoveryHeaderLeft}>
                                    <View style={[styles.recoveryIconWrap, { borderColor: (analytics.recovery.color || '#555') + '44' }]}>
                                        <Ionicons name="battery-charging" size={18} color={analytics.recovery.color || '#555'} />
                                    </View>
                                    <View>
                                        <Text style={styles.chartTitle}>Recovery Score</Text>
                                        <Text style={[styles.recoveryStatusLabel, { color: analytics.recovery.color || '#555' }]}>
                                            {isPro ? analytics.recovery.text : 'Unlock with Pro'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.recoveryPct, { color: isPro ? analytics.recovery.color : '#333' }]}>
                                    {isPro ? (typeof analytics.recovery.pct === 'string'
                                        ? analytics.recovery.pct.replace('%', '')
                                        : Math.round(parseFloat(analytics.recovery.pct) || 0))
                                        : '—'}
                                    {isPro && <Text style={{ fontSize: 14 }}>%</Text>}
                                </Text>
                            </View>

                            <View style={styles.recoveryBarBg}>
                                <LinearGradient
                                    colors={['#34C759', '#FFCC00', '#FF3B30']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={[styles.recoveryBarFill, {
                                        width: isPro ? analytics.recovery.pct : '30%',
                                        opacity: isPro ? 1 : 0.25,
                                    }]}
                                />
                            </View>

                            <View style={styles.recoveryZoneRow}>
                                {['Poor', 'Fair', 'Good', 'Peak'].map((z, i) => (
                                    <Text key={i} style={styles.recoveryZoneLabel}>{z}</Text>
                                ))}
                            </View>

                            <Text style={styles.recoveryText}>Based on your recent activity load.</Text>
                        </GlassCard>

                        {/* ── Race Predictor ── */}
                        <View style={styles.subSectionHeader}>
                            <Ionicons name="trophy-outline" size={16} color={COLORS.accent} />
                            <Text style={[styles.sectionTitle, { marginLeft: 8, marginTop: 0, marginBottom: 0 }]}>Race Predictor</Text>
                        </View>

                        <GlassCard style={styles.card}>
                            {isPro && analytics.predictions ? (
                                <View style={styles.predGrid}>
                                    {[
                                        { key: '5k',      label: '5K',       icon: 'flash',          color: '#CCFF00' },
                                        { key: '10k',     label: '10K',      icon: 'speedometer',    color: '#FFD700' },
                                        { key: 'Half',    label: 'Half',     icon: 'trending-up',    color: '#FF9500' },
                                        { key: 'Marathon',label: 'Marathon', icon: 'medal-outline',  color: '#FF6B6B' },
                                    ].map((race, i) => (
                                        <View
                                            key={race.key}
                                            style={[
                                                styles.predCell,
                                                { borderColor: race.color + '33' },
                                                i % 2 === 0 ? { marginRight: 8 } : {},
                                            ]}
                                        >
                                            <View style={[styles.predCellIcon, { backgroundColor: race.color + '18' }]}>
                                                <Ionicons name={race.icon} size={14} color={race.color} />
                                            </View>
                                            <Text style={[styles.predLabel, { color: race.color, marginTop: 8 }]}>{race.label}</Text>
                                            <Text style={styles.predValue}>{analytics.predictions[race.key] || '--:--'}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <Text style={{ color: '#555', textAlign: 'center', padding: 10, fontFamily: 'Poppins_400Regular', fontSize: 13 }}>
                                    {isPro ? 'Complete more runs to unlock predictions' : 'Predicted finish times based on your training'}
                                </Text>
                            )}
                        </GlassCard>

                        {/* ── Personal Records ── */}
                        <View style={styles.subSectionHeader}>
                            <MaterialCommunityIcons name="medal-outline" size={16} color={COLORS.accent} />
                            <Text style={[styles.sectionTitle, { marginLeft: 8, marginTop: 0, marginBottom: 0 }]}>Personal Records</Text>
                        </View>

                        <GlassCard style={[styles.card, { paddingHorizontal: 0, overflow: 'hidden' }]}>
                            {[
                                { key: '5K',       color: '#CCFF00' },
                                { key: '10K',      color: '#FFD700' },
                                { key: 'Half',     color: '#FF9500' },
                                { key: 'Marathon', color: '#FF6B6B' },
                            ].map(({ key, color }) => {
                                const time = analytics.pbs[key];
                                if (time === undefined) return null;
                                return (
                                    <View key={key} style={styles.pbRow}>
                                        <View style={[styles.pbAccentStripe, { backgroundColor: color }]} />
                                        <View style={[styles.pbBadge, { borderColor: color + '44', backgroundColor: color + '18' }]}>
                                            <Text style={[styles.pbBadgeText, { color }]}>{key}</Text>
                                        </View>
                                        <Text style={styles.pbValue}>{isPro ? time : '--:--'}</Text>
                                        {isPro && <Ionicons name="chevron-forward" size={14} color="#333" style={{ marginLeft: 'auto', marginRight: 16 }} />}
                                    </View>
                                );
                            })}
                            <View style={[styles.pbRow, { borderBottomWidth: 0 }]}>
                                <View style={[styles.pbAccentStripe, { backgroundColor: COLORS.accent }]} />
                                <View style={[styles.pbBadge, { borderColor: COLORS.accent + '55', backgroundColor: COLORS.accent + '18' }]}>
                                    <Text style={[styles.pbBadgeText, { color: COLORS.accent }]}>Longest</Text>
                                </View>
                                <Text style={[styles.pbValue, { color: isPro ? COLORS.accent : '#333' }]}>
                                    {isPro ? analytics.pbs.Longest : '--.- km'}
                                </Text>
                                {isPro && <MaterialCommunityIcons name="trophy" size={15} color={COLORS.accent} style={{ marginLeft: 'auto', marginRight: 16 }} />}
                            </View>
                        </GlassCard>

                        {/* ── Pro upgrade banner ── */}
                        {!isPro && (
                            <TouchableOpacity
                                activeOpacity={0.85}
                                style={styles.proUpgradeBanner}
                                onPress={() => { lightTap(); navigation.navigate('Paywall'); }}
                            >
                                <LinearGradient
                                    colors={[COLORS.accent, '#B2FF59']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.proUpgradeBannerGradient}
                                >
                                    <View style={styles.proUpgradeBannerLeft}>
                                        <Ionicons name="lock-open-outline" size={20} color="#000" />
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={styles.proUpgradeBannerText}>Unlock Advanced Analytics</Text>
                                            <Text style={styles.proUpgradeBannerSub}>VO2 Max · Race Predictions · Recovery</Text>
                                        </View>
                                    </View>
                                    <Ionicons name="arrow-forward-circle" size={22} color="rgba(0,0,0,0.35)" />
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 10
    },
    backBtn: {
        padding: 8,
        backgroundColor: '#1C1C1E',
        borderRadius: 20,
    },
    title: {
        fontFamily: 'Poppins_700Bold',
        fontSize: 20,
        color: '#FFF'
    },
    filterContainer: {
        alignItems: 'center',
        marginBottom: 20
    },
    filterPill: {
        flexDirection: 'row',
        backgroundColor: '#1C1C1E',
        borderRadius: 25,
        padding: 4,
        width: 200
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 20
    },
    filterBtnActive: {
        backgroundColor: '#333'
    },
    filterText: {
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
        color: '#666'
    },
    activeText: {
        color: '#FFF'
    },
    scrollContent: {
        paddingBottom: 40
    },
    chartCard: {
        marginBottom: 20,
        marginHorizontal: 16,
        padding: 16,
    },
    chartHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16
    },
    chartTitle: {
        color: '#FFF',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 16,
        marginLeft: 8
    },
    chart: {
        paddingRight: 0,
        borderRadius: 16
    },
    // --- ADVANCED METRICS STYLES ---
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Poppins_600SemiBold',
        color: '#FFF',
        marginLeft: 20,
        marginTop: 10,
        marginBottom: 15,
    },
    sectionSubtitle: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: '#555',
        marginLeft: 20,
        marginTop: -10,
        marginBottom: 16,
    },
    subSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 20,
        marginTop: 8,
        marginBottom: 14,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginBottom: 20,
    },
    statBox: {
        width: (width - 48) / 2,
        padding: 16,
        alignItems: 'center',
        overflow: 'hidden',
    },
    statIconBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statLabel: {
        color: '#666',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    statValue: {
        color: '#FFF',
        fontSize: 26,
        fontFamily: 'Poppins_700Bold',
        marginTop: 4,
    },
    statDescriptor: {
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
        marginTop: 4,
        letterSpacing: 0.5,
    },
    statBottomStripe: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        opacity: 0.7,
    },
    card: {
        marginHorizontal: 16,
        marginBottom: 20,
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },

    // Recovery
    recoveryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    recoveryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    recoveryIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recoveryStatusLabel: {
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
        marginTop: 2,
    },
    recoveryPct: {
        fontSize: 28,
        fontFamily: 'Poppins_700Bold',
    },
    recoveryBarBg: {
        height: 10,
        backgroundColor: '#1E1E1E',
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: 6,
    },
    recoveryBarFill: {
        height: '100%',
        borderRadius: 5,
    },
    recoveryZoneRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    recoveryZoneLabel: {
        color: '#444',
        fontSize: 9,
        fontFamily: 'Poppins_500Medium',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    recoveryText: {
        color: '#555',
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
        fontStyle: 'italic',
    },

    // Race Predictor
    predGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    predCell: {
        width: (width - 80) / 2,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        alignItems: 'center',
        marginBottom: 10,
    },
    predCellIcon: {
        width: 30,
        height: 30,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    predLabel: {
        color: '#666',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    predValue: {
        color: '#FFF',
        fontSize: 20,
        fontFamily: 'Poppins_700Bold',
    },
    predDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#2A2A2A',
    },
    predRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    predItem: {
        alignItems: 'center',
        flex: 1,
    },

    // Personal Records
    pbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#161616',
        gap: 12,
    },
    pbAccentStripe: {
        width: 3,
        height: 28,
        borderRadius: 2,
    },
    pbBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
    },
    pbBadgeText: {
        fontSize: 11,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 0.5,
    },
    pbValue: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold',
    },

    // Pro section
    proSectionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingRight: 20,
        marginBottom: 0,
    },
    proChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: COLORS.accent,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginTop: 12,
    },
    proChipText: { color: '#000', fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 0.8 },
    proBlurWrap: { opacity: 0.4 },
    proUpgradeBanner: {
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    proUpgradeBannerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 18,
    },
    proUpgradeBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    proUpgradeBannerText: {
        color: '#000',
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
    },
    proUpgradeBannerSub: {
        color: 'rgba(0,0,0,0.55)',
        fontSize: 11,
        fontFamily: 'Poppins_500Medium',
        marginTop: 1,
    }
});

export default AnalyticsScreen;
