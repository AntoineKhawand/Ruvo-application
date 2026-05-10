import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from '../components/Map';
import { useUser } from '../context/UserContext';
import { lightTap } from '../utils/haptics';
import { formatDistance } from '../utils/units';

const { width } = Dimensions.get('window');

const ACCENT = '#CCFF00';
const BG = '#000';
const CARD = '#1C1C1E';
const BORDER = '#2C2C2E';

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2C2C2C' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
];

// Convert "MM:SS" pace string to total seconds
const paceToSeconds = (paceStr) => {
    if (!paceStr || paceStr === '--:--' || paceStr === '0:00') return 0;
    const parts = paceStr.split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + (parts[1] || 0) : 0;
};

// Format seconds as "M:SS"
const secsToPace = (secs) => {
    if (!secs || secs <= 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// Format seconds as "H:MM:SS" or "MM:SS"
const secsToTime = (secs) => {
    if (!secs || secs <= 0) return '--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// Derive splits from routePath when kmSplits is empty (GPS-density estimation)
const estimateSplitsFromRoute = (routePath, totalDistanceKm, totalDurationStr) => {
    if (!routePath?.length || totalDistanceKm <= 0) return [];

    // Parse total duration from "MM:SS" format
    const parts = (totalDurationStr || '').split(':').map(Number);
    const totalSecs = parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
    if (totalSecs <= 0) return [];

    const numKm = Math.floor(totalDistanceKm);
    if (numKm < 1) return [];

    // Distribute GPS points proportionally across km segments as time proxy
    const totalPoints = routePath.length;
    const pointsPerKm = totalPoints / totalDistanceKm;
    const avgSecsPerKm = totalSecs / totalDistanceKm;

    return Array.from({ length: numKm }, (_, i) => ({
        km: i + 1,
        splitSeconds: Math.round(avgSecsPerKm), // uniform estimate
        estimated: true,
    }));
};

// Determine bar colour relative to average pace
const splitColor = (splitSecs, avgSecs) => {
    if (!avgSecs || avgSecs <= 0) return ACCENT;
    const ratio = splitSecs / avgSecs;
    if (ratio <= 0.95) return ACCENT;          // faster than avg → green
    if (ratio <= 1.08) return '#FFD700';        // within 8% → amber
    return '#FF6B6B';                           // slower → red
};

export default function RunDetailScreen({ route, navigation }) {
    const { run } = route.params || {};
    const { userData } = useUser();
    const insets = useSafeAreaInsets();

    // Build splits data: prefer stored kmSplits, fall back to estimation
    const splits = (run?.kmSplits?.length > 0)
        ? run.kmSplits
        : estimateSplitsFromRoute(run?.routePath, run?.distance, run?.duration);

    // Average pace in seconds per km
    const avgPaceSecs = paceToSeconds(run?.pace);

    // Slowest split for bar scaling
    const maxSplitSecs = splits.length > 0
        ? Math.max(...splits.map(s => s.splitSeconds), avgPaceSecs * 1.5)
        : 1;

    // Animate bars on mount
    const barAnims = useRef(splits.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        const animations = barAnims.map((anim, i) =>
            Animated.timing(anim, {
                toValue: 1,
                duration: 500,
                delay: i * 60,
                useNativeDriver: false,
            })
        );
        Animated.stagger(60, animations).start();
    }, []);

    const hasMap = run?.routePath?.length > 1 && run?.initialRegion;
    const unitSystem = userData?.unitSystem || 'metric';
    const distLabel = unitSystem === 'imperial' ? 'mi' : 'km';

    const date = run?.date ? new Date(run.date) : null;
    const dateStr = date
        ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : '';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#1A1A1A', BG]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.35 }}
            />

            <SafeAreaView style={{ flex: 1 }}>
                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => { lightTap(); navigation.goBack(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="arrow-back" size={26} color="#FFF" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{run?.title || 'Run'}</Text>
                        {!!dateStr && <Text style={styles.headerDate}>{dateStr}</Text>}
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* HERO STATS */}
                    <View style={styles.heroRow}>
                        <View style={styles.heroMain}>
                            <Text style={styles.heroValue}>
                                {formatDistance(run?.distance || 0, unitSystem, 2).split(' ')[0]}
                            </Text>
                            <Text style={styles.heroUnit}>{distLabel}</Text>
                        </View>
                        <View style={styles.heroSide}>
                            <View style={styles.heroStat}>
                                <Text style={styles.heroStatValue}>{run?.duration || '--'}</Text>
                                <Text style={styles.heroStatLabel}>TIME</Text>
                            </View>
                            <View style={[styles.heroStat, { borderLeftWidth: 1, borderLeftColor: BORDER }]}>
                                <Text style={styles.heroStatValue}>{run?.pace || '--'}</Text>
                                <Text style={styles.heroStatLabel}>AVG PACE</Text>
                            </View>
                        </View>
                    </View>

                    {/* SECONDARY STATS GRID */}
                    <View style={styles.statsGrid}>
                        {[
                            { label: 'Calories', value: run?.calories ? `${Math.round(run.calories)}` : '--', unit: 'kcal', icon: 'flame-outline' },
                            { label: 'Heart Rate', value: (run?.heartRate && run.heartRate > 0) ? `${Math.round(run.heartRate)}` : '--', unit: 'bpm', icon: 'heart-outline' },
                            { label: 'Elevation', value: run?.elevationGain ? `${run.elevationGain}` : '--', unit: 'm', icon: 'trending-up-outline' },
                            { label: 'Effort (RPE)', value: run?.rpe ? `${run.rpe}/10` : '--', unit: '', icon: 'barbell-outline' },
                        ].map(({ label, value, unit, icon }) => (
                            <View key={label} style={styles.statCard}>
                                <Ionicons name={icon} size={18} color={ACCENT} />
                                <Text style={styles.statValue}>{value}{value !== '--' && unit ? <Text style={styles.statUnit}> {unit}</Text> : ''}</Text>
                                <Text style={styles.statLabel}>{label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* ROUTE MAP */}
                    {hasMap && (
                        <View style={styles.mapCard}>
                            <Text style={styles.sectionTitle}>Route</Text>
                            <View style={styles.mapContainer}>
                                <MapView
                                    style={StyleSheet.absoluteFill}
                                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                                    customMapStyle={darkMapStyle}
                                    initialRegion={run.initialRegion}
                                    scrollEnabled={false}
                                    zoomEnabled={false}
                                    pitchEnabled={false}
                                    rotateEnabled={false}
                                    showsUserLocation={false}
                                    showsCompass={false}
                                    showsPointsOfInterest={false}
                                    showsBuildings={false}
                                    showsTraffic={false}
                                >
                                    <Polyline
                                        coordinates={run.routePath}
                                        strokeColor={ACCENT}
                                        strokeWidth={4}
                                    />
                                </MapView>
                            </View>
                        </View>
                    )}

                    {/* SPLITS */}
                    {splits.length > 0 && (
                        <View style={styles.splitsCard}>
                            <View style={styles.splitsHeader}>
                                <Text style={styles.sectionTitle}>Splits</Text>
                                {splits[0]?.estimated && (
                                    <Text style={styles.estimatedNote}>estimated</Text>
                                )}
                            </View>

                            {/* Column headers */}
                            <View style={styles.splitColHeader}>
                                <Text style={[styles.splitColLabel, { width: 36 }]}>KM</Text>
                                <Text style={[styles.splitColLabel, { flex: 1, paddingLeft: 8 }]}>PACE BAR</Text>
                                <Text style={[styles.splitColLabel, { width: 60, textAlign: 'right' }]}>PACE</Text>
                            </View>

                            {splits.map((split, i) => {
                                const barFraction = barAnims[i].interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, (split.splitSeconds / maxSplitSecs) * (width - 120)],
                                });
                                const color = splitColor(split.splitSeconds, avgPaceSecs);
                                const paceLabel = secsToPace(split.splitSeconds);

                                return (
                                    <View key={split.km} style={styles.splitRow}>
                                        <Text style={styles.splitKm}>{split.km}</Text>
                                        <View style={styles.splitBarTrack}>
                                            <Animated.View
                                                style={[
                                                    styles.splitBar,
                                                    { width: barFraction, backgroundColor: color },
                                                ]}
                                            />
                                        </View>
                                        <Text style={[styles.splitPace, { color }]}>{paceLabel}</Text>
                                    </View>
                                );
                            })}

                            {/* Legend */}
                            <View style={styles.legend}>
                                {[
                                    { color: ACCENT, label: 'Faster than avg' },
                                    { color: '#FFD700', label: 'On pace' },
                                    { color: '#FF6B6B', label: 'Slower' },
                                ].map(({ color, label }) => (
                                    <View key={label} style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: color }]} />
                                        <Text style={styles.legendLabel}>{label}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* TERRAIN / TAGS */}
                    {(run?.terrain || run?.tags?.length > 0) && (
                        <View style={styles.tagsCard}>
                            {run.terrain && (
                                <View style={styles.tag}>
                                    <MaterialCommunityIcons name="map-outline" size={14} color={ACCENT} />
                                    <Text style={styles.tagText}>{run.terrain}</Text>
                                </View>
                            )}
                            {(run.tags || []).map((t, i) => (
                                <View key={i} style={styles.tag}>
                                    <Text style={styles.tagText}>{t}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
    },
    headerDate: {
        color: '#888',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        marginTop: 1,
    },
    content: { paddingHorizontal: 16, paddingTop: 8 },

    // Hero
    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD,
        borderRadius: 20,
        padding: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER,
    },
    heroMain: { flexDirection: 'row', alignItems: 'flex-end', marginRight: 20 },
    heroValue: { fontSize: 56, fontFamily: 'Poppins_800ExtraBold', color: '#FFF', lineHeight: 60 },
    heroUnit: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: '#888', marginBottom: 6, marginLeft: 4 },
    heroSide: { flex: 1 },
    heroStat: { paddingLeft: 16, paddingVertical: 6 },
    heroStatValue: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#FFF' },
    heroStatLabel: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: '#666', letterSpacing: 0.08, marginTop: 1 },

    // Stats grid
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 12,
    },
    statCard: {
        backgroundColor: CARD,
        borderRadius: 16,
        padding: 14,
        width: (width - 42) / 2,
        borderWidth: 1,
        borderColor: BORDER,
        gap: 4,
    },
    statValue: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#FFF', marginTop: 4 },
    statUnit: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: '#888' },
    statLabel: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: '#666' },

    // Map
    mapCard: { marginBottom: 12 },
    mapContainer: {
        height: 200,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: BORDER,
    },

    sectionTitle: {
        color: '#FFF',
        fontSize: 15,
        fontFamily: 'Poppins_700Bold',
        marginBottom: 12,
    },

    // Splits
    splitsCard: {
        backgroundColor: CARD,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER,
    },
    splitsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    estimatedNote: {
        fontSize: 10,
        fontFamily: 'Poppins_400Regular',
        color: '#555',
        fontStyle: 'italic',
    },
    splitColHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    splitColLabel: {
        fontSize: 9,
        fontFamily: 'Poppins_600SemiBold',
        color: '#555',
        letterSpacing: 0.08,
    },
    splitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
    },
    splitKm: {
        width: 36,
        color: '#888',
        fontSize: 13,
        fontFamily: 'Poppins_600SemiBold',
    },
    splitBarTrack: {
        flex: 1,
        height: 10,
        backgroundColor: '#111',
        borderRadius: 5,
        overflow: 'hidden',
        marginRight: 12,
    },
    splitBar: {
        height: '100%',
        borderRadius: 5,
    },
    splitPace: {
        width: 48,
        textAlign: 'right',
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
    },
    legend: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: BORDER,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: '#666' },

    // Tags
    tagsCard: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: CARD,
        borderRadius: 99,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: BORDER,
    },
    tagText: { color: '#AAA', fontSize: 12, fontFamily: 'Poppins_500Medium' },
});
