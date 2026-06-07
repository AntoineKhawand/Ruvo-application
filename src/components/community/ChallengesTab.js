import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Image, Modal, ScrollView, StyleSheet, Text,
    TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/legacy-theme.js';

const ACCENT = COLORS.accent;

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const daysLeft = (endDate) => {
    if (!endDate) return null;
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    const diff = Math.ceil((end - new Date()) / 86400000);
    return Math.max(0, diff);
};

const fmtUnit = (challenge, value) => {
    const v = parseFloat(value);
    if (challenge.goalType === 'count')     return `${Math.floor(v)} run${Math.floor(v) !== 1 ? 's' : ''}`;
    if (challenge.goalType === 'elevation') return `${v.toFixed(0)} m`;
    return `${v.toFixed(1)} km`;
};

const goalIcon = (goalType) => {
    if (goalType === 'count')     return 'repeat';
    if (goalType === 'elevation') return 'trending-up';
    return 'map-outline';
};

const pctLabel = (percent) => `${Math.round(percent * 100)}%`;

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function ChallengesTab({
    challenges = [],
    toggleChallengeJoin,
    handleChallengePress,
    showChallengeModal,
    setShowChallengeModal,
    selectedChallenge,
    calculateChallengeProgress,
    userData,
}) {
    const insets = useSafeAreaInsets();
    const featured = challenges.find(c => c.type === 'Featured');
    const upcoming  = challenges.filter(c => c.type !== 'Featured');

    // ── FEATURED CARD ──────────────────────────────────────────
    const renderFeatured = () => {
        if (!featured) return null;
        const prog = calculateChallengeProgress(featured);
        const left = daysLeft(featured.endDate);
        const pct  = prog.percent;

        return (
            <TouchableOpacity
                style={styles.featuredCard}
                activeOpacity={0.92}
                onPress={() => handleChallengePress(featured)}
            >
                <Image source={{ uri: featured.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <LinearGradient
                    colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.60)', 'rgba(0,0,0,0.96)']}
                    locations={[0, 0.45, 1]}
                    style={StyleSheet.absoluteFill}
                />

                {/* FEATURED badge */}
                <View style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>FEATURED</Text>
                </View>

                {/* Top-right: days left pill */}
                {left !== null && (
                    <View style={styles.daysLeftPill}>
                        <Ionicons name="time-outline" size={11} color="#FFF" />
                        <Text style={styles.daysLeftText}>{left}d left</Text>
                    </View>
                )}

                {/* Bottom content */}
                <View style={styles.featuredContent}>
                    <Text style={styles.featuredTitle}>{featured.title}</Text>

                    <View style={styles.featuredMeta}>
                        <MetaChip icon="flag-outline" label={featured.goal} />
                        <MetaChip icon="people-outline" label={`${featured.participants?.toLocaleString()} runners`} />
                    </View>

                    {/* Progress section — shown whether joined or not */}
                    <View style={styles.progressBlock}>
                        {featured.isJoined ? (
                            <>
                                <View style={styles.progressHeader}>
                                    <Text style={styles.progressCurrent}>
                                        {fmtUnit(featured, prog.current)}
                                    </Text>
                                    <View style={styles.progressRightGroup}>
                                        {prog.runCount > 0 && (
                                            <Text style={styles.progressRunCount}>
                                                {prog.runCount} run{prog.runCount !== 1 ? 's' : ''}
                                            </Text>
                                        )}
                                        <Text style={styles.progressPct}>{pctLabel(pct)}</Text>
                                    </View>
                                </View>
                                <Text style={styles.progressGoal}>of {fmtUnit(featured, prog.target)} goal</Text>
                                <View style={styles.progressTrack}>
                                    <View style={[styles.progressFill, { width: `${Math.min(pct * 100, 100)}%` }]} />
                                    {pct > 0 && pct < 1 && (
                                        <View style={[styles.progressGlow, { left: `${Math.min(pct * 100, 100)}%` }]} />
                                    )}
                                </View>
                                {pct >= 1 && (
                                    <Text style={styles.completedLabel}>✓ Challenge complete!</Text>
                                )}
                            </>
                        ) : (
                            /* Reward pills for non-joined */
                            <View style={styles.rewardRow}>
                                <RewardPill icon="star" color="#FFD700" label={`+${featured.xp?.toLocaleString()} XP`} />
                                <RewardPill icon="coin" isMci color={ACCENT} label={`${featured.coins} coins`} />
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.joinBtn, featured.isJoined && styles.joinBtnJoined]}
                        activeOpacity={0.85}
                        onPress={() => toggleChallengeJoin(featured.id)}
                    >
                        {featured.isJoined
                            ? <Ionicons name="checkmark-circle" size={16} color={ACCENT} style={{ marginRight: 6 }} />
                            : null
                        }
                        <Text style={[styles.joinBtnText, featured.isJoined && { color: ACCENT }]}>
                            {featured.isJoined ? 'Joined' : 'Join Challenge'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    // ── UPCOMING CARD ──────────────────────────────────────────
    const renderUpcoming = (item) => {
        const prog = item.isJoined ? calculateChallengeProgress(item) : null;
        const left = daysLeft(item.endDate);

        return (
            <TouchableOpacity
                key={item.id}
                style={styles.upcomingCard}
                activeOpacity={0.85}
                onPress={() => handleChallengePress(item)}
            >
                {/* Thumbnail */}
                <View style={styles.upcomingThumb}>
                    <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <LinearGradient
                        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={[styles.goalIconBox]}>
                        <Ionicons name={goalIcon(item.goalType)} size={18} color={ACCENT} />
                    </View>
                </View>

                {/* Body */}
                <View style={styles.upcomingBody}>
                    <View style={styles.upcomingTitleRow}>
                        <Text style={styles.upcomingTitle} numberOfLines={1}>{item.title}</Text>
                        {left !== null && (
                            <Text style={styles.upcomingDays}>{left}d</Text>
                        )}
                    </View>
                    <Text style={styles.upcomingGoal} numberOfLines={1}>{item.goal}</Text>

                    {item.isJoined && prog ? (
                        <View style={styles.miniProgressWrap}>
                            <View style={styles.miniProgressTrack}>
                                <View style={[styles.miniProgressFill, { width: `${Math.min(prog.percent * 100, 100)}%` }]} />
                            </View>
                            <Text style={styles.miniProgressLabel}>
                                {fmtUnit(item, prog.current)} / {fmtUnit(item, prog.target)} · {pctLabel(prog.percent)}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.rewardChipRow}>
                            <View style={styles.rewardChip}>
                                <Ionicons name="star" size={10} color="#FFD700" />
                                <Text style={styles.rewardChipText}>+{item.xp} XP</Text>
                            </View>
                            <View style={[styles.rewardChip, { marginLeft: 6 }]}>
                                <MaterialCommunityIcons name="coin" size={10} color={ACCENT} />
                                <Text style={[styles.rewardChipText, { color: ACCENT }]}>{item.coins}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Join button */}
                <TouchableOpacity
                    style={[styles.smallJoinBtn, item.isJoined && styles.smallJoinBtnJoined]}
                    activeOpacity={0.85}
                    onPress={() => toggleChallengeJoin(item.id)}
                >
                    <Text style={[styles.smallJoinText, item.isJoined && { color: ACCENT }]}>
                        {item.isJoined ? 'Joined' : 'Join'}
                    </Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    // ── DETAIL MODAL ───────────────────────────────────────────
    const renderModal = () => {
        if (!selectedChallenge) return null;
        const prog  = calculateChallengeProgress(selectedChallenge);
        const left  = daysLeft(selectedChallenge.endDate);
        const pct   = prog.percent;

        // Runs that contributed to this challenge (for modal breakdown)
        const toDate = (val) => {
            if (!val) return null;
            if (typeof val?.toDate === 'function') return val.toDate();
            if (val instanceof Date) return val;
            return new Date(val);
        };
        const start = toDate(selectedChallenge.startDate) || new Date(0);
        const end   = toDate(selectedChallenge.endDate)   || new Date(9999, 0);
        const contributingRuns = (userData?.runHistory || [])
            .filter(r => { const d = new Date(r.date); return d >= start && d <= end; })
            .slice(0, 5); // show most recent 5

        return (
            <Modal
                animationType="slide"
                transparent={false}
                visible={showChallengeModal}
                onRequestClose={() => setShowChallengeModal(false)}
            >
                <View style={styles.modalRoot}>
                    <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

                        {/* Hero */}
                        <View style={styles.modalHero}>
                            <Image source={{ uri: selectedChallenge.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            <LinearGradient
                                colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,1)']}
                                locations={[0, 0.55, 1]}
                                style={StyleSheet.absoluteFill}
                            />
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowChallengeModal(false)}>
                                <Ionicons name="close" size={20} color="#FFF" />
                            </TouchableOpacity>
                            <View style={styles.modalHeroContent}>
                                <View style={[styles.featuredBadge, { position: 'relative', top: 0, left: 0, alignSelf: 'flex-start', marginBottom: 10 }]}>
                                    <Text style={styles.featuredBadgeText}>
                                        {selectedChallenge.type === 'Featured' ? 'FEATURED' : 'CHALLENGE'}
                                    </Text>
                                </View>
                                <Text style={styles.modalHeroTitle}>{selectedChallenge.title}</Text>
                                {left !== null && (
                                    <View style={styles.modalDaysPill}>
                                        <Ionicons name="time-outline" size={12} color="#FFF" />
                                        <Text style={styles.modalDaysText}>{left} day{left !== 1 ? 's' : ''} remaining</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        <View style={styles.modalBody}>

                            {/* Live progress card */}
                            <View style={styles.liveProgressCard}>
                                <View style={styles.liveProgressHeader}>
                                    <View>
                                        <Text style={styles.liveProgressValue}>{fmtUnit(selectedChallenge, prog.current)}</Text>
                                        <Text style={styles.liveProgressOf}>of {fmtUnit(selectedChallenge, prog.target)} goal</Text>
                                    </View>
                                    <View style={styles.liveProgressRight}>
                                        <Text style={styles.liveProgressPct}>{pctLabel(pct)}</Text>
                                        {prog.runCount > 0 && (
                                            <Text style={styles.liveRunCount}>{prog.runCount} run{prog.runCount !== 1 ? 's' : ''}</Text>
                                        )}
                                    </View>
                                </View>

                                <View style={styles.progressTrack}>
                                    <View style={[styles.progressFill, { width: `${Math.min(pct * 100, 100)}%` }]} />
                                    {pct > 0 && pct < 1 && (
                                        <View style={[styles.progressGlow, { left: `${Math.min(pct * 100, 100)}%` }]} />
                                    )}
                                </View>

                                {pct >= 1 ? (
                                    <Text style={styles.completedLabel}>✓ Challenge complete!</Text>
                                ) : selectedChallenge.isJoined ? (
                                    <Text style={styles.liveProgressHint}>
                                        {fmtUnit(selectedChallenge, Math.max(0, selectedChallenge.goalValue - parseFloat(prog.current)))} more to go
                                    </Text>
                                ) : (
                                    <Text style={styles.liveProgressHint}>Join to start tracking your progress</Text>
                                )}
                            </View>

                            {/* Stats row */}
                            <View style={styles.statsRow}>
                                <StatBox
                                    icon="people-outline"
                                    value={selectedChallenge.participants?.toLocaleString()}
                                    label="Runners"
                                />
                                <StatBox icon="calendar-outline" value={`${left ?? '—'}d`} label="Left" />
                                <StatBox
                                    icon={goalIcon(selectedChallenge.goalType)}
                                    value={fmtUnit(selectedChallenge, selectedChallenge.goalValue)}
                                    label="Goal"
                                />
                            </View>

                            {/* About */}
                            <SectionLabel>About</SectionLabel>
                            <Text style={styles.aboutText}>{selectedChallenge.description}</Text>

                            {/* Goal card */}
                            <View style={styles.goalCard}>
                                <View style={styles.goalIconWrap}>
                                    <Ionicons name={goalIcon(selectedChallenge.goalType)} size={20} color={ACCENT} />
                                </View>
                                <View>
                                    <Text style={styles.goalMeta}>TARGET</Text>
                                    <Text style={styles.goalText}>{selectedChallenge.goal}</Text>
                                </View>
                            </View>

                            {/* Rewards */}
                            <SectionLabel>Rewards</SectionLabel>
                            <View style={styles.rewardCard}>
                                <View style={styles.rewardCol}>
                                    <Ionicons name="star" size={28} color="#FFD700" />
                                    <Text style={styles.rewardBig}>+{selectedChallenge.xp?.toLocaleString()}</Text>
                                    <Text style={styles.rewardUnit}>XP POINTS</Text>
                                </View>
                                <View style={styles.rewardDivider} />
                                <View style={styles.rewardCol}>
                                    <MaterialCommunityIcons name="coins" size={28} color={ACCENT} />
                                    <Text style={[styles.rewardBig, { color: ACCENT }]}>{selectedChallenge.coins}</Text>
                                    <Text style={styles.rewardUnit}>COINS</Text>
                                </View>
                            </View>

                            {/* Contributing runs */}
                            {selectedChallenge.isJoined && contributingRuns.length > 0 && (
                                <>
                                    <SectionLabel>Your Contributing Runs</SectionLabel>
                                    {contributingRuns.map((run, i) => (
                                        <View key={run.id || i} style={styles.runRow}>
                                            <View style={styles.runIconBox}>
                                                <MaterialCommunityIcons name="run-fast" size={16} color={ACCENT} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.runTitle} numberOfLines={1}>
                                                    {run.title || 'Run Workout'}
                                                </Text>
                                                <Text style={styles.runMeta}>
                                                    {new Date(run.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    {' · '}{run.duration}
                                                </Text>
                                            </View>
                                            <View style={styles.runStats}>
                                                <Text style={styles.runDist}>{parseFloat(run.distance).toFixed(2)} km</Text>
                                                {(run.elevationGain || run.elevation) > 0 && (
                                                    <Text style={styles.runElev}>
                                                        ↑{Math.round(run.elevationGain || run.elevation)} m
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </>
                            )}
                        </View>
                    </ScrollView>

                    {/* Sticky footer */}
                    <View style={[styles.modalFooter, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
                        <TouchableOpacity
                            style={[styles.joinBtn, selectedChallenge.isJoined && styles.joinBtnJoined, { borderRadius: 16 }]}
                            activeOpacity={0.85}
                            onPress={() => toggleChallengeJoin(selectedChallenge.id)}
                        >
                            {selectedChallenge.isJoined
                                ? <Ionicons name="exit-outline" size={16} color={ACCENT} style={{ marginRight: 6 }} />
                                : <Ionicons name="add-circle-outline" size={16} color="#000" style={{ marginRight: 6 }} />
                            }
                            <Text style={[styles.joinBtnText, selectedChallenge.isJoined && { color: ACCENT }]}>
                                {selectedChallenge.isJoined ? 'Leave Challenge' : 'Join Challenge'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <View style={styles.container}>
            {renderFeatured()}
            <Text style={styles.sectionTitle}>Upcoming Challenges</Text>
            {upcoming.map(renderUpcoming)}
            {renderModal()}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────
const MetaChip = ({ icon, label }) => (
    <View style={styles.metaChip}>
        <Ionicons name={icon} size={12} color="#CCC" />
        <Text style={styles.metaChipText}>{label}</Text>
    </View>
);

const RewardPill = ({ icon, color, label, isMci }) => (
    <View style={styles.rewardPill}>
        {isMci
            ? <MaterialCommunityIcons name={icon} size={13} color={color} />
            : <Ionicons name={icon} size={13} color={color} />
        }
        <Text style={[styles.rewardPillText, { color }]}>{label}</Text>
    </View>
);

const StatBox = ({ icon, value, label }) => (
    <View style={styles.statBox}>
        <Ionicons name={icon} size={16} color={ACCENT} style={{ marginBottom: 6 }} />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const SectionLabel = ({ children }) => (
    <Text style={styles.sectionLabel}>{children}</Text>
);

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { paddingBottom: 16 },

    // ── Featured card ──────────────────────────────────────────
    featuredCard: {
        borderRadius: 22,
        overflow: 'hidden',
        height: 480,
        marginBottom: 28,
        backgroundColor: '#1A1A1A',
        justifyContent: 'flex-end',
    },
    featuredBadge: {
        position: 'absolute',
        top: 18,
        left: 18,
        backgroundColor: ACCENT,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        zIndex: 10,
    },
    featuredBadgeText: { color: '#000', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1.2 },
    daysLeftPill: {
        position: 'absolute',
        top: 18,
        right: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        zIndex: 10,
    },
    daysLeftText: { color: '#FFF', fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

    featuredContent: { padding: 20, paddingTop: 12 },
    featuredTitle: {
        color: '#FFF',
        fontSize: 26,
        fontFamily: 'Poppins_800ExtraBold',
        lineHeight: 32,
        marginBottom: 10,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    featuredMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaChipText: { color: '#CCC', fontSize: 12, fontFamily: 'Poppins_400Regular' },

    // Progress block (inside featured card)
    progressBlock: { marginBottom: 14 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 2 },
    progressCurrent: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_800ExtraBold', lineHeight: 26 },
    progressGoal: { color: '#888', fontSize: 11, fontFamily: 'Poppins_400Regular', marginBottom: 8 },
    progressRightGroup: { alignItems: 'flex-end', gap: 2 },
    progressPct: { color: ACCENT, fontSize: 16, fontFamily: 'Poppins_700Bold' },
    progressRunCount: { color: '#666', fontSize: 11, fontFamily: 'Poppins_400Regular' },
    progressTrack: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 3,
        overflow: 'visible',
        position: 'relative',
    },
    progressFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 3 },
    progressGlow: {
        position: 'absolute',
        top: -3,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: ACCENT,
        marginLeft: -6,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
        elevation: 6,
    },
    completedLabel: { color: ACCENT, fontSize: 12, fontFamily: 'Poppins_700Bold', marginTop: 6 },

    rewardRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    rewardPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 20,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    rewardPillText: { color: '#FFF', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

    joinBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT,
        paddingVertical: 13,
        borderRadius: 30,
    },
    joinBtnJoined: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: ACCENT },
    joinBtnText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 14, letterSpacing: 0.3 },

    // ── Section label ──────────────────────────────────────────
    sectionTitle: {
        color: '#FFF',
        fontSize: 18,
        fontFamily: 'Poppins_700Bold',
        marginBottom: 14,
    },

    // ── Upcoming card ──────────────────────────────────────────
    upcomingCard: {
        flexDirection: 'row',
        backgroundColor: '#0E0E0E',
        borderRadius: 18,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1E1E1E',
        alignItems: 'center',
    },
    upcomingThumb: {
        width: 90,
        height: 90,
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        padding: 8,
    },
    goalIconBox: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.3)',
    },
    upcomingBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
    upcomingTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
    upcomingTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14, flex: 1 },
    upcomingDays: { color: '#555', fontSize: 11, fontFamily: 'Poppins_500Medium', marginLeft: 6 },
    upcomingGoal: { color: '#666', fontSize: 11, fontFamily: 'Poppins_400Regular', marginBottom: 7 },

    miniProgressWrap: { gap: 4 },
    miniProgressTrack: { height: 4, backgroundColor: '#2A2A2A', borderRadius: 2, overflow: 'hidden' },
    miniProgressFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },
    miniProgressLabel: { color: ACCENT, fontSize: 10, fontFamily: 'Poppins_500Medium' },

    rewardChipRow: { flexDirection: 'row' },
    rewardChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#181818',
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    rewardChipText: { color: '#FFD700', fontSize: 10, fontFamily: 'Poppins_700Bold' },

    smallJoinBtn: {
        marginRight: 14,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: ACCENT,
        borderRadius: 20,
    },
    smallJoinBtnJoined: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: ACCENT },
    smallJoinText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 11 },

    // ── Modal ──────────────────────────────────────────────────
    modalRoot: { flex: 1, backgroundColor: '#000' },
    modalHero: { height: 400, justifyContent: 'flex-end', backgroundColor: '#1A1A1A' },
    modalHeroContent: { padding: 20, paddingBottom: 16 },
    modalCloseBtn: {
        position: 'absolute', top: 52, right: 18,
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center', alignItems: 'center', zIndex: 20,
    },
    modalHeroTitle: {
        color: '#FFF',
        fontSize: 28,
        fontFamily: 'Poppins_800ExtraBold',
        lineHeight: 34,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    modalDaysPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignSelf: 'flex-start',
        marginTop: 10,
    },
    modalDaysText: { color: '#FFF', fontSize: 12, fontFamily: 'Poppins_500Medium' },

    modalBody: { padding: 20 },

    // Live progress card
    liveProgressCard: {
        backgroundColor: '#0E0E0E',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.18)',
        marginBottom: 16,
    },
    liveProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 4,
    },
    liveProgressValue: { color: '#FFF', fontSize: 28, fontFamily: 'Poppins_800ExtraBold', lineHeight: 32 },
    liveProgressOf: { color: '#555', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    liveProgressRight: { alignItems: 'flex-end', gap: 2 },
    liveProgressPct: { color: ACCENT, fontSize: 22, fontFamily: 'Poppins_700Bold' },
    liveRunCount: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular' },
    liveProgressHint: { color: '#555', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 8 },

    // Stats row
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 8,
    },
    statBox: {
        flex: 1,
        backgroundColor: '#0E0E0E',
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1E1E1E',
    },
    statValue: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold', lineHeight: 18 },
    statLabel: { color: '#555', fontSize: 10, fontFamily: 'Poppins_500Medium', marginTop: 2 },

    sectionLabel: {
        color: '#444',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
        marginTop: 20,
    },
    aboutText: { color: '#888', fontSize: 14, fontFamily: 'Poppins_400Regular', lineHeight: 22 },

    goalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0E0E0E',
        borderRadius: 14,
        padding: 16,
        gap: 14,
        borderWidth: 1,
        borderColor: '#1E1E1E',
        marginBottom: 4,
    },
    goalIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(204,255,0,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.15)',
    },
    goalMeta: { color: '#555', fontSize: 10, fontFamily: 'Poppins_600SemiBold', letterSpacing: 0.5 },
    goalText: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold', marginTop: 2 },

    rewardCard: {
        flexDirection: 'row',
        backgroundColor: '#0E0E0E',
        borderRadius: 16,
        padding: 20,
        justifyContent: 'space-around',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1E1E1E',
    },
    rewardCol: { alignItems: 'center', gap: 4 },
    rewardBig: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_800ExtraBold' },
    rewardUnit: { color: '#555', fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },
    rewardDivider: { width: 1, height: 44, backgroundColor: '#1E1E1E' },

    // Contributing runs
    runRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0A0A0A',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#1A1A1A',
        gap: 12,
    },
    runIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(204,255,0,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    runTitle: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    runMeta: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    runStats: { alignItems: 'flex-end' },
    runDist: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_700Bold' },
    runElev: { color: '#888', fontSize: 10, fontFamily: 'Poppins_400Regular', marginTop: 2 },

    modalFooter: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#000',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#111',
    },
});
