import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SimpleBarChart, SimpleLineChart } from '../components/SimpleCharts';
import { COLORS } from '../constants/legacy-theme';
import { useUser } from '../context/UserContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { lightTap } from '../utils/haptics';
import SkeletonCard from '../components/SkeletonCard';
import GlassCard from '../components/GlassCard';

const { width } = Dimensions.get('window');
const CHART_W = width - 64; // inside GlassCard with horizontal padding

const RACE_ROWS = [
    { key: '5k',       label: '5K',             icon: 'flash',         color: '#CCFF00' },
    { key: '10k',      label: '10K',            icon: 'speedometer',   color: '#FFD700' },
    { key: 'Half',     label: 'Half Marathon',  icon: 'trending-up',   color: '#FF9500' },
    { key: 'Marathon', label: 'Marathon',       icon: 'medal-outline', color: '#FF6B6B' },
];

const AnalyticsScreen = ({ navigation }) => {
    const { userData, loadFullRunHistory } = useUser();
    const isPro = userData?.isPro || false;
    const [timeRange, setTimeRange] = useState('Week');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [fullHistory, setFullHistory] = useState(null);

    useEffect(() => {
        loadFullRunHistory().then(setFullHistory).catch(() => setFullHistory(userData?.runHistory || []));
    }, [userData?.uid]);

    const runHistoryForAnalytics = fullHistory ?? userData?.runHistory ?? [];
    const hasRunHistory = runHistoryForAnalytics.length > 0;

    // ── Chart data ────────────────────────────────────────────────────────────
    const processChartData = () => {
        const history = runHistoryForAnalytics;
        const now = new Date();
        const daysToShow = timeRange === 'Week' ? 7 : 30;
        const labels = [];
        const distanceData = new Array(daysToShow).fill(0);
        const paceData     = new Array(daysToShow).fill(0);
        const elevationData = new Array(daysToShow).fill(0);
        const hrData       = new Array(daysToShow).fill(0);

        for (let i = daysToShow - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            labels.push(d.toLocaleDateString('en-US', { weekday: 'narrow' }));
        }

        history.forEach(run => {
            if (!run.date) return;
            const diffDays = Math.ceil(Math.abs(now - new Date(run.date)) / 86400000);
            if (diffDays <= daysToShow) {
                const idx = daysToShow - diffDays;
                if (idx >= 0) {
                    distanceData[idx] += parseFloat(run.distance) || 0;
                    elevationData[idx] += parseFloat(run.elevationGain) || 0;
                    const hr = parseFloat(run.heartRate) || 0;
                    if (hr > 0) hrData[idx] = hrData[idx] ? (hrData[idx] + hr) / 2 : hr;
                    if (run.pace) {
                        const [m, s] = run.pace.split(':').map(Number);
                        const pv = m + s / 60;
                        paceData[idx] = paceData[idx] ? (paceData[idx] + pv) / 2 : pv;
                    }
                }
            }
        });

        const chartLabels = timeRange === 'Week' ? labels : labels.map((l, i) => i % 5 === 0 ? l : '');
        return { labels: chartLabels, distanceData, paceData, elevationData, hrData };
    };

    const chartData = processChartData();
    const analytics = useAnalytics(runHistoryForAnalytics, userData);

    // ── Quick overview stats ──────────────────────────────────────────────────
    const periodRuns  = runHistoryForAnalytics.filter(r => {
        if (!r.date) return false;
        return Math.ceil(Math.abs(new Date() - new Date(r.date)) / 86400000) <= (timeRange === 'Week' ? 7 : 30);
    });
    const periodKm    = periodRuns.reduce((s, r) => s + (parseFloat(r.distance) || 0), 0);
    const periodMin   = periodRuns.reduce((s, r) => {
        if (!r.duration) return s;
        const [mm, ss] = r.duration.split(':').map(Number);
        return s + (mm || 0) + (ss || 0) / 60;
    }, 0);

    return (
        <View style={s.container}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>

                {/* ── Header ── */}
                <View style={s.header}>
                    <TouchableOpacity style={s.backBtn} onPress={() => { lightTap(); navigation.goBack(); }}>
                        <Ionicons name="arrow-back" size={22} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={s.title}>Performance</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* ── Time filter ── */}
                <View style={s.filterRow}>
                    {['Week', 'Month'].map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[s.filterBtn, timeRange === t && s.filterBtnActive]}
                            onPress={() => { lightTap(); setTimeRange(t); }}
                            activeOpacity={0.75}
                        >
                            <Text style={[s.filterText, timeRange === t && s.filterTextActive]}>
                                {t === 'Week' ? 'Weekly' : 'Monthly'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <ScrollView
                    contentContainerStyle={{ paddingBottom: 80 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 1000); }}
                            tintColor="#CCFF00" colors={['#CCFF00']} progressBackgroundColor="#1C1C1E"
                        />
                    }
                >

                    {/* ── Overview stat strip ── */}
                    {hasRunHistory && (
                        <View style={s.statStrip}>
                            {[
                                { label: 'RUNS',     value: String(periodRuns.length) },
                                { label: 'KM',       value: periodKm.toFixed(1) },
                                { label: 'MINUTES',  value: Math.round(periodMin).toString() },
                            ].map((item, i) => (
                                <View key={i} style={[s.statPill, i > 0 && { borderLeftWidth: 1, borderLeftColor: '#1E1E1E' }]}>
                                    <Text style={s.statPillValue}>{item.value}</Text>
                                    <Text style={s.statPillLabel}>{item.label}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* ── Charts ── */}
                    {!hasRunHistory ? (
                        <SkeletonCard variant="analytics" />
                    ) : (
                        <>
                            {[
                                { title: 'Distance', unit: 'km',     icon: 'footsteps',   color: COLORS.accent,  data: chartData.distanceData,  type: 'bar' },
                                { title: 'Avg Pace', unit: 'min/km', icon: 'speedometer', color: '#FFD700',       data: chartData.paceData,      type: 'line' },
                                { title: 'Elevation', unit: 'm',     icon: 'trending-up', color: '#FF6B6B',       data: chartData.elevationData, type: 'line' },
                                { title: 'Heart Rate', unit: 'bpm',  icon: 'heart',       color: '#FF3B30',       data: chartData.hrData,        type: 'line' },
                            ].map((chart) => (
                                <GlassCard key={chart.title} style={s.chartCard}>
                                    <View style={s.chartHeader}>
                                        <View style={[s.chartIconBadge, { backgroundColor: chart.color + '18' }]}>
                                            <Ionicons name={chart.icon} size={14} color={chart.color} />
                                        </View>
                                        <Text style={s.chartTitle}>{chart.title}</Text>
                                        <Text style={s.chartUnit}>{chart.unit}</Text>
                                    </View>
                                    {chart.type === 'bar' ? (
                                        <SimpleBarChart
                                            data={chart.data}
                                            labels={chartData.labels}
                                            width={CHART_W}
                                            height={160}
                                            barColor={chart.color}
                                            gradientId={`grad_${chart.title}`}
                                        />
                                    ) : (
                                        <SimpleLineChart
                                            data={chart.data}
                                            labels={chartData.labels}
                                            width={CHART_W}
                                            height={160}
                                            lineColor={chart.color}
                                            gradientId={`grad_${chart.title}`}
                                        />
                                    )}
                                </GlassCard>
                            ))}
                        </>
                    )}


                    {/* ── Advanced Metrics header ── */}
                    <View style={s.sectionHeaderRow}>
                        <View>
                            <Text style={s.sectionTitle}>Advanced Metrics</Text>
                            <Text style={s.sectionSub}>AI-powered training insights</Text>
                        </View>
                        {!isPro && (
                            <View style={s.proBadge}>
                                <Ionicons name="lock-closed" size={9} color="#000" />
                                <Text style={s.proBadgeText}>PRO</Text>
                            </View>
                        )}
                    </View>

                    <View style={!isPro ? s.locked : null}>

                        {/* ── VO2 + Consistency ── */}
                        <View style={s.twinRow}>
                            {[
                                { label: 'Est. VO2 Max',  icon: 'lung',     color: '#00C7BE', value: analytics.vo2Max,         descriptor: analytics.vo2Max >= 55 ? 'Superior' : analytics.vo2Max >= 45 ? 'Good' : analytics.vo2Max >= 35 ? 'Fair' : 'Basic', isMci: true },
                                { label: 'Consistency',   icon: 'calendar', color: '#FF2D55', value: analytics.consistencyScore, descriptor: analytics.consistencyScore >= 5 ? 'Elite' : analytics.consistencyScore >= 3 ? 'Solid' : analytics.consistencyScore >= 1 ? 'Building' : 'Start', isMci: false },
                            ].map((stat) => (
                                <GlassCard key={stat.label} style={s.statBox}>
                                    <View style={[s.statIconRing, { backgroundColor: stat.color + '18', borderColor: stat.color + '40' }]}>
                                        {stat.isMci
                                            ? <MaterialCommunityIcons name={stat.icon} size={20} color={stat.color} />
                                            : <Ionicons name={stat.icon} size={20} color={stat.color} />
                                        }
                                    </View>
                                    <Text style={s.statLabel}>{stat.label}</Text>
                                    <Text style={s.statValue}>{isPro ? stat.value : '—'}</Text>
                                    {isPro && <Text style={[s.statDescriptor, { color: stat.color }]}>{stat.descriptor}</Text>}
                                    <View style={[s.statStripe, { backgroundColor: stat.color }]} />
                                </GlassCard>
                            ))}
                        </View>

                        {/* ── Recovery Score ── */}
                        <GlassCard style={s.card}>
                            <View style={s.chartHeader}>
                                <View style={[s.chartIconBadge, { backgroundColor: (analytics.recovery.color || '#555') + '18', borderColor: (analytics.recovery.color || '#555') + '30' }]}>
                                    <Ionicons name="battery-charging" size={14} color={analytics.recovery.color || '#555'} />
                                </View>
                                <Text style={s.chartTitle}>Recovery Score</Text>
                                <Text style={[s.chartUnit, { color: analytics.recovery.color || '#555' }]}>
                                    {isPro ? analytics.recovery.text : 'Pro only'}
                                </Text>
                                <Text style={[s.recoveryPct, { color: isPro ? analytics.recovery.color : '#333' }]}>
                                    {isPro ? (typeof analytics.recovery.pct === 'string'
                                        ? analytics.recovery.pct.replace('%', '')
                                        : Math.round(parseFloat(analytics.recovery.pct) || 0))
                                        : '—'}
                                    {isPro && <Text style={{ fontSize: 12 }}>%</Text>}
                                </Text>
                            </View>
                            <View style={s.recoveryTrack}>
                                <LinearGradient
                                    colors={['#34C759', '#FFCC00', '#FF3B30']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={[s.recoveryFill, { width: isPro ? analytics.recovery.pct : '30%', opacity: isPro ? 1 : 0.2 }]}
                                />
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, marginBottom: 10 }}>
                                {['Poor', 'Fair', 'Good', 'Peak'].map((z, i) => (
                                    <Text key={i} style={s.zoneLabel}>{z}</Text>
                                ))}
                            </View>
                            <Text style={s.recoveryHint}>Based on your recent activity load.</Text>
                        </GlassCard>

                        {/* ── Race Predictor ── */}
                        <View style={s.subHeader}>
                            <Ionicons name="trophy-outline" size={15} color={COLORS.accent} />
                            <Text style={s.subTitle}>Race Predictor</Text>
                        </View>

                        <GlassCard style={[s.card, { paddingHorizontal: 0, overflow: 'hidden' }]}>
                            {isPro && analytics.predictions ? (
                                RACE_ROWS.map((race, i) => (
                                    <View key={race.key} style={[s.raceRow, i < RACE_ROWS.length - 1 && s.raceRowBorder]}>
                                        <View style={[s.raceIconBox, { backgroundColor: race.color + '18' }]}>
                                            <Ionicons name={race.icon} size={14} color={race.color} />
                                        </View>
                                        <Text style={[s.raceLabel, { color: race.color }]}>{race.label}</Text>
                                        <Text style={s.raceTime}>{analytics.predictions[race.key] || '--:--'}</Text>
                                    </View>
                                ))
                            ) : (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Ionicons name="trophy-outline" size={28} color="#2A2A2A" />
                                    <Text style={{ color: '#555', marginTop: 8, fontFamily: 'Poppins_400Regular', fontSize: 13, textAlign: 'center' }}>
                                        {isPro ? 'Complete more runs to unlock predictions' : 'Predicted finish times based on your training'}
                                    </Text>
                                </View>
                            )}
                        </GlassCard>

                        {/* ── Personal Records ── */}
                        <View style={s.subHeader}>
                            <MaterialCommunityIcons name="medal-outline" size={15} color={COLORS.accent} />
                            <Text style={s.subTitle}>Personal Records</Text>
                        </View>

                        <GlassCard style={[s.card, { paddingHorizontal: 0, overflow: 'hidden' }]}>
                            {[
                                { key: '5K',       color: '#CCFF00' },
                                { key: '10K',      color: '#FFD700' },
                                { key: 'Half',     color: '#FF9500' },
                                { key: 'Marathon', color: '#FF6B6B' },
                                { key: 'Longest',  color: COLORS.accent, isMci: true },
                            ].map(({ key, color, isMci }, i, arr) => {
                                const time = analytics.pbs[key];
                                if (time === undefined) return null;
                                return (
                                    <View key={key} style={[s.pbRow, i < arr.length - 1 && s.pbRowBorder]}>
                                        <View style={[s.pbStripe, { backgroundColor: color }]} />
                                        <View style={[s.pbBadge, { borderColor: color + '44', backgroundColor: color + '18' }]}>
                                            <Text style={[s.pbBadgeText, { color }]}>{key}</Text>
                                        </View>
                                        <Text style={s.pbValue}>{isPro ? time : '--:--'}</Text>
                                        {isPro && (
                                            isMci
                                                ? <MaterialCommunityIcons name="trophy" size={14} color={color} style={s.pbChevron} />
                                                : <Ionicons name="chevron-forward" size={14} color="#333" style={s.pbChevron} />
                                        )}
                                    </View>
                                );
                            })}
                        </GlassCard>

                        {/* ── Upgrade banner ── */}
                        {!isPro && (
                            <TouchableOpacity
                                activeOpacity={0.85}
                                style={s.upgradeBanner}
                                onPress={() => { lightTap(); navigation.navigate('Paywall'); }}
                            >
                                <LinearGradient
                                    colors={[COLORS.accent, '#B2FF59']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={s.upgradeBannerInner}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="lock-open-outline" size={18} color="#000" />
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={s.upgradeBannerTitle}>Unlock Advanced Analytics</Text>
                                            <Text style={s.upgradeBannerSub}>VO2 Max · Race Predictions · Recovery</Text>
                                        </View>
                                    </View>
                                    <Ionicons name="arrow-forward-circle" size={22} color="rgba(0,0,0,0.3)" />
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const s = StyleSheet.create({
    container:  { flex: 1, backgroundColor: '#000' },

    // Header
    header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
    backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center' },
    title:      { fontFamily: 'Poppins_700Bold', fontSize: 20, color: '#FFF' },

    // Filter
    filterRow:  { flexDirection: 'row', marginHorizontal: 20, marginBottom: 18, backgroundColor: '#111', borderRadius: 14, padding: 3, borderWidth: 1, borderColor: '#1E1E1E' },
    filterBtn:  { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 11 },
    filterBtnActive: { backgroundColor: '#2A2A2A' },
    filterText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: '#555' },
    filterTextActive: { color: '#FFF' },

    // Stat strip
    statStrip:  { flexDirection: 'row', marginHorizontal: 20, marginBottom: 18, backgroundColor: '#0E0E0E', borderRadius: 16, borderWidth: 1, borderColor: '#1E1E1E', overflow: 'hidden' },
    statPill:   { flex: 1, alignItems: 'center', paddingVertical: 14 },
    statPillValue: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold', lineHeight: 24 },
    statPillLabel: { color: '#444', fontSize: 9, fontFamily: 'Poppins_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 3 },

    // Charts
    chartCard:  { marginBottom: 14, marginHorizontal: 20, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    chartHeader:{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
    chartIconBadge: { width: 26, height: 26, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    chartTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14, flex: 1 },
    chartUnit:  { color: '#444', fontSize: 11, fontFamily: 'Poppins_500Medium' },

    // Cards
    card:       { marginHorizontal: 20, marginBottom: 14, padding: 16 },

    // Section headers
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },
    sectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    sectionSub:   { color: '#555', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    subHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 4, marginBottom: 12 },
    subTitle:   { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_600SemiBold' },

    // Pro badge + gate
    proBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
    proBadgeText: { color: '#000', fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 0.8 },
    locked:     { opacity: 0.45 },

    // Twin stat boxes
    twinRow:    { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 14, gap: 10 },
    statBox:    { flex: 1, padding: 16, alignItems: 'center', overflow: 'hidden' },
    statIconRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    statLabel:  { color: '#555', fontSize: 10, fontFamily: 'Poppins_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
    statValue:  { color: '#FFF', fontSize: 26, fontFamily: 'Poppins_700Bold', marginTop: 4 },
    statDescriptor: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', marginTop: 3, letterSpacing: 0.4 },
    statStripe: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, opacity: 0.8 },

    // Recovery
    recoveryPct: { fontSize: 26, fontFamily: 'Poppins_700Bold', marginLeft: 'auto' },
    recoveryTrack: { height: 9, backgroundColor: '#1E1E1E', borderRadius: 5, overflow: 'hidden', marginTop: 12, marginBottom: 4 },
    recoveryFill: { height: '100%', borderRadius: 5 },
    zoneLabel:  { color: '#3A3A3A', fontSize: 9, fontFamily: 'Poppins_500Medium', textTransform: 'uppercase', letterSpacing: 0.4 },
    recoveryHint: { color: '#444', fontSize: 11, fontFamily: 'Poppins_400Regular', fontStyle: 'italic' },

    // Race predictor rows
    raceRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, gap: 14 },
    raceRowBorder: { borderBottomWidth: 1, borderBottomColor: '#161616' },
    raceIconBox:{ width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    raceLabel:  { flex: 1, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    raceTime:   { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },

    // Personal records
    pbRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
    pbRowBorder:{ borderBottomWidth: 1, borderBottomColor: '#161616' },
    pbStripe:   { width: 3, height: 26, borderRadius: 2, flexShrink: 0 },
    pbBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, borderWidth: 1, flexShrink: 0 },
    pbBadgeText:{ fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },
    pbValue:    { flex: 1, color: '#FFF', fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
    pbChevron:  { marginLeft: 'auto', flexShrink: 0 },

    // Upgrade banner
    upgradeBanner: { marginHorizontal: 20, marginTop: 14, borderRadius: 16, overflow: 'hidden' },
    upgradeBannerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 18 },
    upgradeBannerTitle: { color: '#000', fontSize: 14, fontFamily: 'Poppins_700Bold' },
    upgradeBannerSub:   { color: 'rgba(0,0,0,0.5)', fontSize: 11, fontFamily: 'Poppins_500Medium', marginTop: 1 },
});

export default AnalyticsScreen;
