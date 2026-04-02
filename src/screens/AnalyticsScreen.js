import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SimpleBarChart, SimpleLineChart } from '../components/SimpleCharts';
import { COLORS } from '../constants/legacy-theme';
import { useUser } from '../context/UserContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import SkeletonCard from '../components/SkeletonCard';

const { width } = Dimensions.get('window');

const AnalyticsScreen = ({ navigation }) => {
    const { userData } = useUser();
    const [timeRange, setTimeRange] = useState('Week'); // 'Week' | 'Month'
    const [isRefreshing, setIsRefreshing] = useState(false);
    const hasRunHistory = userData?.runHistory?.length > 0;

    // --- 1. CHARTS DATA (Visual Trends) ---
    const processChartData = () => {
        const history = userData?.runHistory || [];
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
    const analytics = useAnalytics(userData.runHistory, userData);

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
                        <>
                            <SkeletonCard variant="chart" />
                            <SkeletonCard variant="chart" />
                            <SkeletonCard variant="chart" />
                        </>
                    ) : (
                        <>
                            <View style={styles.chartCard}>
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
                            </View>

                            <View style={styles.chartCard}>
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
                            </View>

                    <View style={styles.chartCard}>
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
                    </View>

                    <View style={styles.chartCard}>
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
                    </View>
                        </>
                    )}

                    {/* --- HEART RATE ZONES (LATEST RUN) --- */}
                    {mockHrZones && (
                        <>
                            <Text style={styles.sectionTitle}>Heart Rate Zones (Latest Run)</Text>
                            <View style={styles.card}>
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
                                            <View style={{ height: 6, backgroundColor: '#333', borderRadius: 3 }}>
                                                <View style={{ width: `${zone.pct}%`, height: '100%', backgroundColor: zone.color, borderRadius: 3 }} />
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </>
                    )}

                    {/* --- NEW SECTIONS: RECOVERY & METRICS --- */}
                    <Text style={styles.sectionTitle}>Advanced Metrics</Text>

                    <View style={styles.rowBetween}>
                        {/* VO2 MAX */}
                        <View style={styles.statBox}>
                            <View style={styles.statIconBadge}>
                                <MaterialCommunityIcons name="lung" size={20} color="#00C7BE" />
                            </View>
                            <Text style={styles.statLabel}>Est. VO2 Max</Text>
                            <Text style={styles.statValue}>{analytics.vo2Max}</Text>
                        </View>

                        {/* CONSISTENCY */}
                        <View style={styles.statBox}>
                            <View style={[styles.statIconBadge, { backgroundColor: 'rgba(255,45,85,0.2)' }]}>
                                <Ionicons name="calendar" size={20} color="#FF2D55" />
                            </View>
                            <Text style={styles.statLabel}>Consistency</Text>
                            <Text style={styles.statValue}>{analytics.consistencyScore} <Text style={{ fontSize: 14, color: '#666' }}>run/wk</Text></Text>
                        </View>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="battery-charging" size={18} color={analytics.recovery.color} />
                            <Text style={[styles.chartTitle, { color: analytics.recovery.color }]}>{analytics.recovery.text}</Text>
                        </View>
                        <View style={styles.recoveryBarBg}>
                            <View style={[styles.recoveryBarFill, { width: analytics.recovery.pct, backgroundColor: analytics.recovery.color }]} />
                        </View>
                        <Text style={styles.recoveryText}>Based on your recent activity load.</Text>
                    </View>

                    {/* --- RACE PREDICTOR --- */}
                    <Text style={styles.sectionTitle}>Race Predictor</Text>
                    <View style={styles.card}>
                        {analytics.predictions ? (
                            <>
                                <View style={styles.predRow}>
                                    <View style={styles.predItem}><Text style={styles.predLabel}>5K</Text><Text style={styles.predValue}>{analytics.predictions['5k']}</Text></View>
                                    <View style={styles.predDivider} />
                                    <View style={styles.predItem}><Text style={styles.predLabel}>10K</Text><Text style={styles.predValue}>{analytics.predictions['10k']}</Text></View>
                                </View>
                                <View style={[styles.predRow, { borderTopWidth: 1, borderTopColor: '#333', marginTop: 15, paddingTop: 15 }]}>
                                    <View style={styles.predItem}><Text style={styles.predLabel}>Half</Text><Text style={styles.predValue}>{analytics.predictions['Half']}</Text></View>
                                    <View style={styles.predDivider} />
                                    <View style={styles.predItem}><Text style={styles.predLabel}>Marathon</Text><Text style={styles.predValue}>{analytics.predictions['Marathon']}</Text></View>
                                </View>
                            </>
                        ) : (
                            <Text style={{ color: '#666', textAlign: 'center', padding: 10 }}>Complete more runs to unlock predictions</Text>
                        )}
                    </View>

                    {/* --- PERSONAL RECORDS --- */}
                    <Text style={styles.sectionTitle}>Personal Records</Text>
                    <View style={styles.card}>
                        {Object.entries(analytics.pbs).map(([dist, time]) => {
                            if (dist === 'Longest') return null; // Handle separately if needed
                            return (
                                <View key={dist} style={styles.pbRow}>
                                    <View style={styles.pbBadge}><Text style={styles.pbBadgeText}>{dist}</Text></View>
                                    <Text style={styles.pbValue}>{time}</Text>
                                </View>
                            )
                        })}
                        <View style={[styles.pbRow, { borderBottomWidth: 0 }]}>
                            <View style={[styles.pbBadge, { backgroundColor: COLORS.accent }]}><Text style={[styles.pbBadgeText, { color: '#000' }]}>Longest</Text></View>
                            <Text style={[styles.pbValue, { color: COLORS.accent }]}>{analytics.pbs.Longest}</Text>
                        </View>
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
        backgroundColor: '#1C1C1E',
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 24,
        padding: 16,
        overflow: 'hidden'
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
    // --- NEW STYLES ---
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Poppins_600SemiBold',
        color: '#FFF',
        marginLeft: 20,
        marginTop: 10,
        marginBottom: 15
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginBottom: 20
    },
    statBox: {
        width: (width - 48) / 2,
        backgroundColor: '#1C1C1E',
        borderRadius: 20,
        padding: 15,
        alignItems: 'center'
    },
    statIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,199,190,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10
    },
    statLabel: {
        color: '#888',
        fontSize: 12,
        fontFamily: 'Poppins_500Medium'
    },
    statValue: {
        color: '#FFF',
        fontSize: 20,
        fontFamily: 'Poppins_700Bold',
        marginTop: 4
    },
    card: {
        backgroundColor: '#1C1C1E',
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 24,
        padding: 20
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15
    },
    recoveryBarBg: {
        height: 8,
        backgroundColor: '#333',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 10
    },
    recoveryBarFill: {
        height: '100%',
        borderRadius: 4
    },
    recoveryText: {
        color: '#666',
        fontSize: 12,
        fontStyle: 'italic'
    },
    predRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    predItem: {
        alignItems: 'center',
        flex: 1
    },
    predLabel: {
        color: '#666',
        fontSize: 12,
        marginBottom: 4
    },
    predValue: {
        color: '#FFF',
        fontSize: 18,
        fontFamily: 'Poppins_700Bold'
    },
    predDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#333'
    },
    pbRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2C2C2E'
    },
    pbBadge: {
        backgroundColor: '#333',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },
    pbBadgeText: {
        color: '#AAA',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold'
    },
    pbValue: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold'
    }
});

export default AnalyticsScreen;
