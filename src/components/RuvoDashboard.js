import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');
const GAP = 16;
const PADDING = 20;
// Calculate card width for a 2-column layout
const CARD_WIDTH = (width - (PADDING * 2) - GAP) / 2;

const COLORS = {
    background: "#000000",
    card: "#1C1C1E",
    accent: "#CCFF00",
    text: "#FFFFFF",
    subText: "#888888",
    danger: "#FF3B30",
};

// Component for Circular Progress
const MiniProgress = ({ percentage }) => {
    const size = 60;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage * circumference);

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#333" strokeWidth={strokeWidth} fill="transparent" />
                <Circle
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke={COLORS.accent} strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </Svg>
            <View style={StyleSheet.absoluteFillObject} justifyContent="center" alignItems="center">
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>{Math.round(percentage * 100)}%</Text>
            </View>
        </View>
    );
};

export default function RuvoDashboard({ onOpenAnalytics }) {
    const { userData } = useUser();
    const navigation = useNavigation();

    // 1. User Name & Context
    const userName = userData?.name?.split(' ')[0] || 'Athlete';
    const isPro = userData?.isPro || false; // 2. Entitlement Check

    // Mock/Real Data
    const weeklyDist = userData?.weeklyDistance || 0;
    const weeklyGoal = userData?.weeklyGoal || 25;
    const progress = Math.min(weeklyDist / weeklyGoal, 1);
    const coins = userData?.wallet?.coins ?? userData?.coins ?? 0;

    // 3. Calculate Current Streak
    const currentStreak = (() => {
        const history = userData?.runHistory || [];
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
            // If haven't ran today, check yesterday to see if streak is still active
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
    })();

    return (
        <View style={styles.container}>

            {/* BENTO GRID CONTAINER */}
            <View style={styles.bentoGrid}>

                {/* ROW 1: WEEKLY GOAL (Large-ish) & STATS */}
                <View style={styles.row}>
                    {/* GOAL CARD */}
                    <TouchableOpacity style={[styles.card, { width: CARD_WIDTH, height: 160 }]} activeOpacity={0.8} onPress={() => navigation.navigate('Plan')}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="trophy-outline" size={20} color={COLORS.accent} />
                            <Text style={styles.cardLabel}>WEEKLY GOAL</Text>
                        </View>
                        <View style={styles.centeredContent}>
                            <MiniProgress percentage={progress} />
                            <Text style={styles.mainStatText}>{weeklyDist.toFixed(1)} <Text style={styles.unit}>km</Text></Text>
                            <Text style={styles.subStatText}>of {weeklyGoal} km</Text>
                        </View>
                    </TouchableOpacity>

                    {/* RIGHT COLUMN: 2 SMALLER CARDS */}
                    <View style={{ gap: GAP }}>
                        {/* COINS / REWARDS */}
                        <TouchableOpacity style={[styles.card, { width: CARD_WIDTH, height: 72 }]} activeOpacity={0.8} onPress={() => { }}>
                            <View style={[styles.cardHeader, { marginBottom: 5 }]}>
                                <MaterialCommunityIcons name="star-circle" size={18} color="#FFD700" />
                                <Text style={styles.cardLabel}>BALANCE</Text>
                            </View>
                            <Text style={styles.statLine}>{coins} <Text style={styles.subStatText}>Coins</Text></Text>
                        </TouchableOpacity>

                        {/* AI COACH SHORTCUT */}
                        <TouchableOpacity style={[styles.card, styles.aiCard, { width: CARD_WIDTH, height: 72 }]} activeOpacity={0.8} onPress={() => navigation.navigate('AICoach')}>
                            <View style={styles.rowCenter}>
                                <MaterialCommunityIcons name="robot" size={24} color="#000" />
                                <Text style={styles.aiBtnText}>AI COACH</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ROW 2: PRO CARD (Conditional) */}
                {!isPro && (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Paywall')}>
                        <LinearGradient
                            colors={[COLORS.accent, '#AADD00']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={styles.proBanner}
                        >
                            <View style={styles.proContent}>
                                <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={styles.proTitle}>Upgrade Your Training</Text>
                                    <Text style={styles.proDesc}>Unlock analytics & AI Recovery</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward-circle" size={28} color="#000" />
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* ROW 3: STREAK CARD */}
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.card, { width: CARD_WIDTH, height: 72 }]}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        <View style={[styles.cardHeader, { marginBottom: 5 }]}>
                            <Ionicons name="flame" size={18} color="#FF6B35" />
                            <Text style={styles.cardLabel}>STREAK</Text>
                        </View>
                        <Text style={styles.statLine}>
                            {currentStreak} <Text style={styles.subStatText}>{currentStreak === 1 ? 'Day' : 'Days'}</Text>
                        </Text>
                    </TouchableOpacity>

                    {/* ANALYTICS SHORTCUT */}
                    <TouchableOpacity
                        style={[styles.card, { width: CARD_WIDTH, height: 72 }]}
                        activeOpacity={0.8}
                        onPress={onOpenAnalytics}
                    >
                        <View style={[styles.cardHeader, { marginBottom: 5 }]}>
                            <Ionicons name="stats-chart" size={18} color={COLORS.accent} />
                            <Text style={styles.cardLabel}>ANALYTICS</Text>
                        </View>
                        <Text style={[styles.subStatText, { fontSize: 11, color: '#FFF' }]}>View Full Stats</Text>
                    </TouchableOpacity>
                </View>

                {/* ROW 4: RECOVERY / STATUS - REMOVED PER USER REQUEST */}

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        // marginBottom: 15, <--- Removed to allow parent to control gap (16px)
    },
    // headerRow, greetingSub, etc. removed as they are unused

    bentoGrid: {
        gap: GAP,
    },
    row: {
        flexDirection: 'row',
        gap: GAP,
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 15,
        borderWidth: 1,
        borderColor: '#252525',
    },
    aiCard: {
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 0,
    },

    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
    cardLabel: { color: COLORS.subText, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

    centeredContent: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    mainStatText: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginTop: 8 },
    unit: { fontSize: 12, color: COLORS.subText, fontWeight: '400' },
    subStatText: { color: COLORS.subText, fontSize: 11 },

    statLine: { color: COLORS.text, fontSize: 18, fontWeight: '700' },

    rowCenter: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    aiBtnText: { color: '#000', fontSize: 14, fontWeight: '800', marginLeft: 8 },

    // PRO BANNER
    proBanner: {
        borderRadius: 20,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: GAP,
    },
    proContent: { flexDirection: 'row', alignItems: 'center' },
    proBadge: { backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    proBadgeText: { color: COLORS.accent, fontSize: 10, fontWeight: '900' },
    proTitle: { color: '#000', fontSize: 14, fontWeight: '800' },
    proDesc: { color: '#333', fontSize: 11, fontWeight: '600' },

    // PROGRESS BAR
    progressBarBg: { height: 6, backgroundColor: '#333', borderRadius: 3, marginTop: 10, marginBottom: 6 },
    progressBarFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },
    highlightText: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },
    subText: { color: COLORS.subText, fontSize: 12 },
});
