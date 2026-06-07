import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { lightTap } from '../utils/haptics';
import { formatDistance } from '../utils/units';

const { width } = Dimensions.get('window');
const ACCENT = '#CCFF00';

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2C2C2C' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
];

const paceToSeconds = (paceStr) => {
    if (!paceStr || paceStr === '--:--' || paceStr === '0:00') return 0;
    const parts = paceStr.split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + (parts[1] || 0) : 0;
};

const secsToPace = (secs) => {
    if (!secs || secs <= 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const estimateSplitsFromRoute = (routePath, totalDistanceKm, totalDurationStr) => {
    if (!routePath?.length || totalDistanceKm <= 0) return [];
    const parts = (totalDurationStr || '').split(':').map(Number);
    const totalSecs = parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
    if (totalSecs <= 0) return [];
    const numKm = Math.floor(totalDistanceKm);
    if (numKm < 1) return [];
    const avgSecsPerKm = totalSecs / totalDistanceKm;
    return Array.from({ length: numKm }, (_, i) => ({
        km: i + 1,
        splitSeconds: Math.round(avgSecsPerKm),
        estimated: true,
    }));
};

const splitColor = (splitSecs, avgSecs) => {
    if (!avgSecs || avgSecs <= 0) return ACCENT;
    const ratio = splitSecs / avgSecs;
    if (ratio <= 0.95) return ACCENT;
    if (ratio <= 1.08) return '#FFD700';
    return '#FF6B6B';
};

const getHrZone = (hr, age = 30) => {
    if (!hr || hr <= 0) return null;
    const maxHr = 220 - age;
    const pct = hr / maxHr;
    if (pct >= 0.9) return { zone: 5, color: '#FF3B30', name: 'Max Effort', pct };
    if (pct >= 0.8) return { zone: 4, color: '#FF9500', name: 'Threshold', pct };
    if (pct >= 0.7) return { zone: 3, color: '#FFCC00', name: 'Aerobic', pct };
    if (pct >= 0.6) return { zone: 2, color: '#34C759', name: 'Fat Burn', pct };
    if (pct >= 0.5) return { zone: 1, color: '#5AC8FA', name: 'Warm Up', pct };
    return { zone: 0, color: '#8E8E93', name: 'Light Activity', pct };
};

const ZONE_COLORS = ['#5AC8FA', '#34C759', '#FFCC00', '#FF9500', '#FF3B30'];

const WEATHER_ICONS = {
    'weather-sunny': { icon: 'sunny-outline', color: '#FFD700', lib: 'ion' },
    'weather-partly-cloudy': { icon: 'partly-sunny-outline', color: '#FFD700', lib: 'ion' },
    'weather-cloudy': { icon: 'cloud-outline', color: '#AAA', lib: 'ion' },
    'weather-rainy': { icon: 'rainy-outline', color: '#60A5FA', lib: 'ion' },
    'moon': { icon: 'moon-outline', color: '#AAA', lib: 'ion' },
    'moon-outline': { icon: 'moon-outline', color: '#AAA', lib: 'ion' },
};

// ─── Mini stat cell ────────────────────────────────────────────────
const MiniStat = ({ icon, isMci, value, label, accent }) => (
    <View style={styles.miniStatCell}>
        {isMci
            ? <MaterialCommunityIcons name={icon} size={18} color={accent || '#888'} />
            : <Ionicons name={icon} size={18} color={accent || '#888'} />}
        <Text style={[styles.miniStatValue, accent && { color: accent }]}>{value}</Text>
        <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
);

export default function RunDetailScreen({ route, navigation }) {
    const { run: runParam } = route.params || {};
    const { userData } = useUser();
    const insets = useSafeAreaInsets();

    const [run, setRun] = useState(runParam);
    const [loading, setLoading] = useState(!runParam?.routePath);

    const mapFadeAnim = useRef(new Animated.Value(0)).current;

    // Fetch full run from subcollection (has GPS data stripped from runHistory)
    useEffect(() => {
        const fetchFull = async () => {
            if (!runParam?.id || !userData?.uid) { setLoading(false); return; }
            try {
                const snap = await getDoc(doc(db, 'users', userData.uid, 'runs', runParam.id));
                if (snap.exists()) {
                    setRun({ ...runParam, ...snap.data() });
                }
            } catch (_) { /* use runParam as-is */ }
            setLoading(false);
        };
        fetchFull();
    }, [runParam?.id, userData?.uid]);

    useEffect(() => {
        if (!loading) {
            Animated.timing(mapFadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
        }
    }, [loading]);

    const splits = run?.kmSplits?.length > 0
        ? run.kmSplits
        : estimateSplitsFromRoute(run?.routePath, run?.distance, run?.duration);

    const avgPaceSecs = paceToSeconds(run?.pace);
    const maxSplitSecs = splits.length > 0
        ? Math.max(...splits.map(s => s.splitSeconds), avgPaceSecs * 1.5)
        : 1;

    const barAnims = useRef(splits.map(() => new Animated.Value(0))).current;
    useEffect(() => {
        if (loading || splits.length === 0) return;
        Animated.stagger(60, splits.map((_, i) =>
            Animated.timing(barAnims[i], { toValue: 1, duration: 500, delay: i * 60, useNativeDriver: false })
        )).start();
    }, [loading, splits.length]);

    const hasMap = run?.routePath?.length > 1 && run?.initialRegion;
    const unitSystem = userData?.unitSystem || 'metric';
    const distLabel = unitSystem === 'imperial' ? 'mi' : 'km';
    const hrZone = getHrZone(run?.heartRate, userData?.age);

    const date = run?.date ? new Date(run.date) : null;
    const dateStr = date
        ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : '';
    const timeStr = date
        ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '';

    const weatherIcon = run?.weather?.icon ? WEATHER_ICONS[run.weather.icon] : null;

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator color={ACCENT} size="large" />
                <Text style={{ color: '#555', fontFamily: 'Poppins_400Regular', fontSize: 13, marginTop: 16 }}>
                    Loading run data…
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <SafeAreaView style={{ flex: 1 }}>
                {/* ── HEADER ── */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.headerBackBtn}
                        activeOpacity={0.7}
                        onPress={() => { lightTap(); navigation.goBack(); }}
                    >
                        <Ionicons name="arrow-back" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {run?.title || (run?.activityType || 'Run') + ' Workout'}
                        </Text>
                        {!!dateStr && (
                            <View style={styles.headerMetaRow}>
                                <Ionicons name="calendar-outline" size={11} color="#555" />
                                <Text style={styles.headerDate}>{dateStr}{timeStr ? ` · ${timeStr}` : ''}</Text>
                            </View>
                        )}
                    </View>
                    {/* Tags / type chip */}
                    <View style={styles.headerTypeChip}>
                        <MaterialCommunityIcons
                            name={run?.activityType === 'Walk' ? 'walk' : run?.activityType === 'Hike' ? 'hiking' : 'run-fast'}
                            size={12}
                            color={ACCENT}
                        />
                        <Text style={styles.headerTypeText}>{run?.activityType || 'Run'}</Text>
                    </View>
                </View>
                <View style={styles.headerAccent} />

                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── HERO STATS ── */}
                    <View style={styles.heroCard}>
                        {/* Distance */}
                        <View style={styles.heroDistRow}>
                            <Text style={styles.heroDistValue}>
                                {formatDistance(run?.distance || 0, unitSystem, 2).split(' ')[0]}
                            </Text>
                            <Text style={styles.heroDistUnit}>{distLabel}</Text>
                        </View>

                        <View style={styles.heroDivider} />

                        {/* Time + Pace */}
                        <View style={styles.heroSubRow}>
                            <View style={styles.heroSubCell}>
                                <Text style={styles.heroSubValue}>{run?.duration || '--'}</Text>
                                <Text style={styles.heroSubLabel}>DURATION</Text>
                            </View>
                            <View style={styles.heroSubDivider} />
                            <View style={styles.heroSubCell}>
                                <Text style={styles.heroSubValue}>{run?.pace || '--'}</Text>
                                <Text style={styles.heroSubLabel}>AVG PACE</Text>
                            </View>
                        </View>
                    </View>

                    {/* ── WEATHER + GEAR ROW ── */}
                    {(run?.weather || run?.gearName) && (
                        <View style={styles.contextRow}>
                            {run?.weather && (
                                <View style={styles.contextChip}>
                                    {weatherIcon?.lib === 'ion'
                                        ? <Ionicons name={weatherIcon.icon} size={14} color={weatherIcon.color} />
                                        : <MaterialCommunityIcons name={run.weather.icon} size={14} color="#AAA" />
                                    }
                                    <Text style={styles.contextChipText}>{run.weather.temp}</Text>
                                </View>
                            )}
                            {run?.gearName && (
                                <View style={styles.contextChip}>
                                    <MaterialCommunityIcons name="shoe-sneaker" size={13} color="#555" />
                                    <Text style={styles.contextChipText}>{run.gearName}</Text>
                                </View>
                            )}
                            {run?.activityTag && run.activityTag !== 'None' && (
                                <View style={styles.contextChip}>
                                    <Ionicons name="pricetag-outline" size={12} color="#555" />
                                    <Text style={styles.contextChipText}>{run.activityTag}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* ── SECONDARY STATS ── */}
                    <View style={styles.statsGrid}>
                        <MiniStat
                            icon="fire"
                            isMci
                            label="CALORIES"
                            value={run?.calories ? `${Math.round(run.calories)}` : '--'}
                            accent="#FF6B6B"
                        />
                        <View style={styles.statsGridDiv} />
                        <MiniStat
                            icon="heart-pulse"
                            isMci
                            label="AVG BPM"
                            value={run?.heartRate && run.heartRate > 0 ? `${Math.round(run.heartRate)}` : '--'}
                            accent="#FF4081"
                        />
                        <View style={styles.statsGridDiv} />
                        <MiniStat
                            icon="trending-up-outline"
                            label="ELEVATION"
                            value={run?.elevationGain ? `${run.elevationGain}m` : '--'}
                            accent="#60A5FA"
                        />
                        <View style={styles.statsGridDiv} />
                        <MiniStat
                            icon="barbell-outline"
                            label="RPE"
                            value={run?.rpe ? `${run.rpe}/10` : '--'}
                            accent="#FF9500"
                        />
                    </View>

                    {/* ── MAP ── */}
                    <Animated.View style={[styles.mapSection, { opacity: mapFadeAnim }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Route</Text>
                            {!hasMap && (
                                <Text style={styles.sectionHint}>No GPS recorded</Text>
                            )}
                        </View>
                        {hasMap ? (
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
                                        strokeWidth={5}
                                    />
                                </MapView>
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.6)']}
                                    style={styles.mapGradient}
                                />
                                {/* Start/end dots */}
                                <View style={styles.mapStartDot}>
                                    <Text style={styles.mapDotText}>A</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.mapEmpty}>
                                <Ionicons name="map-outline" size={28} color="#2A2A2A" />
                                <Text style={styles.mapEmptyText}>GPS data not available for this run</Text>
                            </View>
                        )}
                    </Animated.View>

                    {/* ── HR ZONE ── */}
                    {hrZone && (
                        <View style={styles.hrCard}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Heart Rate Analysis</Text>
                                <View style={[styles.zoneBadge, { backgroundColor: hrZone.color + '20', borderColor: hrZone.color + '40' }]}>
                                    <View style={[styles.zoneDot, { backgroundColor: hrZone.color }]} />
                                    <Text style={[styles.zoneBadgeText, { color: hrZone.color }]}>Zone {hrZone.zone}</Text>
                                </View>
                            </View>

                            <View style={styles.hrValueRow}>
                                <Text style={[styles.hrBigValue, { color: hrZone.color }]}>
                                    {Math.round(run.heartRate)}
                                </Text>
                                <View>
                                    <Text style={styles.hrUnit}>BPM</Text>
                                    <Text style={styles.hrZoneName}>{hrZone.name}</Text>
                                </View>
                            </View>

                            {/* 5-zone progress bar */}
                            <View style={styles.zoneBarRow}>
                                {ZONE_COLORS.map((c, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.zoneBarSeg,
                                            { backgroundColor: c },
                                            hrZone.zone !== i + 1 && { opacity: 0.18 },
                                            hrZone.zone === i + 1 && styles.zoneBarSegActive,
                                        ]}
                                    />
                                ))}
                            </View>
                            <View style={styles.zoneLabelsRow}>
                                {['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map((l, i) => (
                                    <Text
                                        key={i}
                                        style={[
                                            styles.zoneLabel,
                                            hrZone.zone === i + 1 && { color: ZONE_COLORS[i], fontFamily: 'Poppins_700Bold' },
                                        ]}
                                    >
                                        {l}
                                    </Text>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* ── AI INSIGHT ── */}
                    {run?.aiInsight && (
                        <LinearGradient colors={['#0D1A00', '#080F00']} style={styles.aiCard}>
                            <View style={styles.aiCardHeader}>
                                <View style={styles.aiAvatarCircle}>
                                    <MaterialCommunityIcons name="robot" size={16} color="#000" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.aiCardTitle}>AI INSIGHT</Text>
                                    <Text style={styles.aiCardSub}>Post-run analysis</Text>
                                </View>
                            </View>
                            <Text style={styles.aiCardBody}>{run.aiInsight}</Text>
                            <TouchableOpacity
                                style={styles.aiCoachBtn}
                                activeOpacity={0.8}
                                onPress={() => {
                                    lightTap();
                                    const prompt = `Based on my ${run.distance?.toFixed(2)}km run at ${run.pace}/km: "${run.aiInsight}" — what should my next training week look like?`;
                                    navigation.navigate('AICoach', { initialPrompt: prompt });
                                }}
                            >
                                <Ionicons name="chatbubble-ellipses-outline" size={13} color={ACCENT} />
                                <Text style={styles.aiCoachBtnText}>Continue with AI Coach</Text>
                                <Ionicons name="chevron-forward" size={12} color={ACCENT} />
                            </TouchableOpacity>
                        </LinearGradient>
                    )}

                    {/* ── SPLITS ── */}
                    {splits.length > 0 && (
                        <View style={styles.splitsCard}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Splits</Text>
                                {splits[0]?.estimated && (
                                    <Text style={styles.sectionHint}>estimated</Text>
                                )}
                            </View>

                            {/* Column headers */}
                            <View style={styles.splitColHeader}>
                                <Text style={[styles.splitColLabel, { width: 32 }]}>KM</Text>
                                <Text style={[styles.splitColLabel, { flex: 1, marginLeft: 8 }]}>PACE BAR</Text>
                                <Text style={[styles.splitColLabel, { width: 56, textAlign: 'right' }]}>PACE</Text>
                            </View>

                            {splits.map((split, i) => {
                                const anim = barAnims[i] || new Animated.Value(1);
                                const barFraction = anim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, (split.splitSeconds / maxSplitSecs) * (width - 120)],
                                });
                                const color = splitColor(split.splitSeconds, avgPaceSecs);
                                const paceLabel = secsToPace(split.splitSeconds);

                                return (
                                    <View key={split.km} style={styles.splitRow}>
                                        <Text style={styles.splitKm}>{split.km}</Text>
                                        <View style={styles.splitBarTrack}>
                                            <Animated.View style={[styles.splitBar, { width: barFraction, backgroundColor: color }]} />
                                        </View>
                                        <Text style={[styles.splitPace, { color }]}>{paceLabel}</Text>
                                    </View>
                                );
                            })}

                            {/* Legend */}
                            <View style={styles.legend}>
                                {[
                                    { color: ACCENT, label: 'Faster' },
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

                    {/* ── NOTES ── */}
                    {run?.privateNotes && (
                        <View style={styles.notesCard}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="document-text-outline" size={15} color="#555" style={{ marginRight: 6 }} />
                                <Text style={styles.sectionTitle}>Private Notes</Text>
                            </View>
                            <Text style={styles.notesText}>{run.privateNotes}</Text>
                        </View>
                    )}

                    {/* ── DESCRIPTION ── */}
                    {run?.description && (
                        <View style={styles.notesCard}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="chatbubble-outline" size={15} color="#555" style={{ marginRight: 6 }} />
                                <Text style={styles.sectionTitle}>Notes</Text>
                            </View>
                            <Text style={styles.notesText}>{run.description}</Text>
                        </View>
                    )}

                    {/* ── TAGS ── */}
                    {(run?.terrain || run?.tags?.length > 0) && (
                        <View style={styles.tagsRow}>
                            {run.terrain && (
                                <View style={styles.tag}>
                                    <MaterialCommunityIcons name="map-outline" size={13} color={ACCENT} />
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
    container: { flex: 1, backgroundColor: '#000' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerBackBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: '#111', borderWidth: 1, borderColor: '#222',
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    headerDate: { color: '#555', fontSize: 10, fontFamily: 'Poppins_400Regular' },
    headerTypeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: ACCENT + '15', borderWidth: 1, borderColor: ACCENT + '30',
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    },
    headerTypeText: { color: ACCENT, fontSize: 11, fontFamily: 'Poppins_700Bold' },
    headerAccent: { height: 1, backgroundColor: '#111', marginHorizontal: 16 },

    content: { paddingHorizontal: 16, paddingTop: 16 },

    // Hero card
    heroCard: {
        backgroundColor: '#0E0E0E',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#1E1E1E',
        padding: 24,
        marginBottom: 12,
        alignItems: 'center',
    },
    heroDistRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    heroDistValue: { color: '#FFF', fontSize: 72, fontFamily: 'Poppins_800ExtraBold', lineHeight: 80, includeFontPadding: false },
    heroDistUnit: { color: ACCENT, fontSize: 14, fontFamily: 'Poppins_700Bold', marginBottom: 10, letterSpacing: 1 },
    heroDivider: { height: 1, backgroundColor: '#1A1A1A', width: '100%', marginVertical: 18 },
    heroSubRow: { flexDirection: 'row', width: '100%' },
    heroSubCell: { flex: 1, alignItems: 'center' },
    heroSubDivider: { width: 1, backgroundColor: '#1A1A1A', alignSelf: 'stretch' },
    heroSubValue: { color: '#FFF', fontSize: 26, fontFamily: 'Poppins_700Bold', lineHeight: 30 },
    heroSubLabel: { color: '#444', fontSize: 9, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1, marginTop: 4 },

    // Context row (weather, gear, tag)
    contextRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    contextChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#0E0E0E', borderWidth: 1, borderColor: '#1E1E1E',
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    },
    contextChipText: { color: '#666', fontSize: 11, fontFamily: 'Poppins_500Medium' },

    // Stats grid
    statsGrid: {
        flexDirection: 'row',
        backgroundColor: '#0E0E0E',
        borderRadius: 20,
        borderWidth: 1, borderColor: '#1E1E1E',
        marginBottom: 12,
        paddingVertical: 4,
        overflow: 'hidden',
    },
    statsGridDiv: { width: 1, backgroundColor: '#1E1E1E', marginVertical: 12 },
    miniStatCell: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 5 },
    miniStatValue: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', lineHeight: 20 },
    miniStatLabel: { color: '#444', fontSize: 8, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1, textTransform: 'uppercase' },

    // Map
    mapSection: { marginBottom: 12 },
    mapContainer: {
        height: 220, borderRadius: 20, overflow: 'hidden',
        borderWidth: 1, borderColor: '#1E1E1E',
    },
    mapGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
    mapStartDot: {
        position: 'absolute', top: 12, left: 12,
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center',
    },
    mapDotText: { color: '#000', fontSize: 10, fontFamily: 'Poppins_800ExtraBold' },
    mapEmpty: {
        height: 100, backgroundColor: '#0E0E0E', borderRadius: 20,
        borderWidth: 1, borderColor: '#1A1A1A',
        justifyContent: 'center', alignItems: 'center', gap: 8,
    },
    mapEmptyText: { color: '#333', fontSize: 12, fontFamily: 'Poppins_400Regular' },

    // Section header (reused)
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    sectionTitle: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold' },
    sectionHint: { color: '#444', fontSize: 10, fontFamily: 'Poppins_400Regular', fontStyle: 'italic' },

    // HR Zone
    hrCard: {
        backgroundColor: '#0E0E0E', borderRadius: 20, borderWidth: 1, borderColor: '#1E1E1E',
        padding: 18, marginBottom: 12,
    },
    zoneBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
    },
    zoneDot: { width: 8, height: 8, borderRadius: 4 },
    zoneBadgeText: { fontSize: 11, fontFamily: 'Poppins_700Bold' },
    hrValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 18 },
    hrBigValue: { fontSize: 48, fontFamily: 'Poppins_800ExtraBold', lineHeight: 52, includeFontPadding: false },
    hrUnit: { color: '#555', fontSize: 14, fontFamily: 'Poppins_500Medium', marginBottom: 8 },
    hrZoneName: { color: '#888', fontSize: 11, fontFamily: 'Poppins_500Medium' },
    zoneBarRow: { flexDirection: 'row', height: 10, gap: 3, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
    zoneBarSeg: { flex: 1, borderRadius: 5 },
    zoneBarSegActive: { transform: [{ scaleY: 1.5 }] },
    zoneLabelsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    zoneLabel: { flex: 1, textAlign: 'center', fontSize: 9, fontFamily: 'Poppins_500Medium', color: '#333' },

    // AI Insight
    aiCard: {
        borderRadius: 20, padding: 18, marginBottom: 12,
        borderWidth: 1, borderColor: ACCENT + '25',
    },
    aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    aiAvatarCircle: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center',
    },
    aiCardTitle: { color: ACCENT, fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1.5 },
    aiCardSub: { color: '#555', fontSize: 10, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    aiCardBody: { color: '#CCC', fontSize: 13, fontFamily: 'Poppins_400Regular', lineHeight: 21, marginBottom: 14 },
    aiCoachBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 7,
        backgroundColor: ACCENT + '12', borderWidth: 1, borderColor: ACCENT + '30',
        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
    },
    aiCoachBtnText: { flex: 1, color: ACCENT, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

    // Splits
    splitsCard: {
        backgroundColor: '#0E0E0E', borderRadius: 20, borderWidth: 1, borderColor: '#1E1E1E',
        padding: 18, marginBottom: 12,
    },
    splitColHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1A1A1A', marginBottom: 4,
    },
    splitColLabel: { fontSize: 9, fontFamily: 'Poppins_600SemiBold', color: '#444', letterSpacing: 1 },
    splitRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111',
    },
    splitKm: { width: 32, color: '#555', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    splitBarTrack: { flex: 1, height: 8, backgroundColor: '#141414', borderRadius: 4, overflow: 'hidden', marginRight: 12 },
    splitBar: { height: '100%', borderRadius: 4 },
    splitPace: { width: 46, textAlign: 'right', fontSize: 12, fontFamily: 'Poppins_700Bold' },
    legend: {
        flexDirection: 'row', gap: 14, marginTop: 12,
        paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1A1A1A',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 7, height: 7, borderRadius: 4 },
    legendLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: '#555' },

    // Notes
    notesCard: {
        backgroundColor: '#0E0E0E', borderRadius: 20, borderWidth: 1, borderColor: '#1E1E1E',
        padding: 18, marginBottom: 12,
    },
    notesText: { color: '#AAA', fontSize: 13, fontFamily: 'Poppins_400Regular', lineHeight: 21 },

    // Tags
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    tag: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#0E0E0E', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7,
        borderWidth: 1, borderColor: '#1A1A1A',
    },
    tagText: { color: '#666', fontSize: 12, fontFamily: 'Poppins_500Medium' },
});
