import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AvatarPickerModal from '../components/AvatarPickerModal';
import FloatingNavBar from '../components/FloatingNavBar';
import SkeletonCard from '../components/SkeletonCard';
import UserAvatar from '../components/UserAvatar';
import { BADGES } from '../constants/badges';
import { COUNTRIES } from '../constants/countries';
import { useUser } from '../context/UserContext';
import { contentService } from '../services/contentService';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import { getFlag } from '../utils/helpers';
import { formatDistance, formatPace } from '../utils/units';

const ACCENT = '#CCFF00';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const getMonthlyChallenges = () => {
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    const fmt = (d) => `${monthName.substring(0, 3)} ${d}`;
    return [
        { id: 'c1', title: `The ${monthName} Ultra`, target: 100, unit: 'km',   type: 'distance', dates: `${monthName} 1 - ${daysInMonth}` },
        { id: 'c2', title: 'Speed Week',             target: 3,   unit: 'runs', type: 'count',    dates: `${fmt(8)} - ${fmt(15)}` },
        { id: 'c3', title: 'Elevation King',         target: 300, unit: 'm',    type: 'elevation',dates: `${fmt(20)} - ${fmt(27)}` },
    ];
};

const getLevelTitle = (level) => {
    if (level < 5)  return 'Rookie';
    if (level < 10) return 'Endurance Athlete';
    return 'Elite Runner';
};

const gearBarColors = (shoe) => {
    const pct = shoe.distance / shoe.limit;
    if (pct >= 0.9) return ['#FF4444', '#FF6B00'];
    if (pct >= 0.7) return ['#FF9500', '#FFCC00'];
    return [ACCENT, '#88BB00'];
};

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
    const { userData, isLoading, updateUserProfile, refreshUser } = useUser();

    // ── UI state ──
    const [isRefreshing, setIsRefreshing]     = useState(false);
    const [activeTab, setActiveTab]           = useState('Activity');
    const [activityFilter, setActivityFilter] = useState({ type: 'all' });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerYear, setPickerYear]         = useState(() => new Date().getFullYear());
    const [pickerMonth, setPickerMonth]       = useState(null);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [editName, setEditName]             = useState(userData?.name || '');
    const [isSaving, setIsSaving]             = useState(false);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [selectedCountry, setSelectedCountry]     = useState(userData?.location?.country || 'Earth');
    const [searchQuery, setSearchQuery]       = useState('');
    const [allTips, setAllTips]               = useState([]);

    const scrollRef = useRef(null);

    // ── Pulse animation for today's calendar dot ──
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.35, duration: 1100, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1,    duration: 1100, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, []);

    useEffect(() => {
        const unsub = navigation.addListener('focus', () => {
            setActivityFilter({ type: 'all' });
            setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
        });
        return unsub;
    }, [navigation]);

    useEffect(() => {
        contentService.fetchTips().then(setAllTips);
    }, []);

    // ─────────────────────────────────────────────
    // Derived data (all from Firebase — no dummies)
    // ─────────────────────────────────────────────

    const runDates = useMemo(() => new Set(
        (userData?.runHistory || []).map(r => new Date(r.date).toDateString())
    ), [userData?.runHistory]);

    const totalKm   = useMemo(() =>
        (userData?.runHistory || []).reduce((a, r) => a + (parseFloat(r.distance) || 0), 0),
    [userData?.runHistory]);

    const totalRuns = userData?.runHistory?.length ?? 0;

    const avgPace = useMemo(() => {
        if (!userData?.runHistory || userData.runHistory.length === 0) return '0:00';
        let totalSec = 0, valid = 0;
        userData.runHistory.forEach(run => {
            if (run.duration) {
                const p = run.duration.split(':').map(Number);
                const s = p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p[0]*60+p[1];
                if (s > 0) { totalSec += s; valid++; }
            }
        });
        if (valid === 0 || totalKm === 0) return '0:00';
        const spk = totalSec / totalKm;
        return `${Math.floor(spk/60)}:${Math.floor(spk%60).toString().padStart(2,'0')}`;
    }, [userData?.runHistory, totalKm]);

    const currentStreak = useMemo(() => {
        if (!userData?.runHistory?.length) return 0;
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        let check = new Date(today);
        if (!runDates.has(today.toDateString())) {
            if (!runDates.has(yesterday.toDateString())) return 0;
            check = new Date(yesterday);
        }
        let streak = 0;
        while (runDates.has(check.toDateString())) {
            streak++;
            check.setDate(check.getDate() - 1);
        }
        return streak;
    }, [userData?.runHistory, runDates]);

    const weekDays = useMemo(() => {
        const today = new Date();
        const dow = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));
        return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return {
                label,
                date: d.getDate(),
                isToday:  d.toDateString() === today.toDateString(),
                hasRun:   runDates.has(d.toDateString()),
            };
        });
    }, [userData?.runHistory, runDates]);

    const primaryGear = useMemo(() => {
        const list = userData?.gearList || [];
        return list.find(g => g.isDefault) || list[0] || null;
    }, [userData?.gearList]);

    const gearNearLimit = useMemo(() =>
        (userData?.gearList || []).filter(g => g.distance >= g.limit * 0.85).length,
    [userData?.gearList]);

    const myActiveChallenges = useMemo(() => {
        const joined  = userData?.joinedChallenges || [];
        const unit    = userData?.unitSystem || 'metric';
        const now     = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysLeft   = Math.max(0, Math.ceil((monthEnd - now) / 86400000));
        const monthRuns  = (userData?.runHistory || []).filter(r => new Date(r.date) >= monthStart);

        return getMonthlyChallenges().flatMap(c => {
            if (!joined.includes(c.id)) return [];
            let prog = 0, target = c.target, displayUnit = c.unit;
            if (c.type === 'distance') {
                const km = monthRuns.reduce((a, r) => a + (parseFloat(r.distance) || 0), 0);
                if (unit === 'imperial') { prog = km * 0.621371; target = c.target * 0.621371; displayUnit = 'mi'; }
                else { prog = km; }
            } else if (c.type === 'count') {
                prog = monthRuns.length;
            } else if (c.type === 'elevation') {
                prog = monthRuns.reduce((a, r) => a + (parseFloat(r.elevation) || 0), 0);
            }
            const pct = Math.min((prog / target) * 100, 100);
            return [{ ...c, progress: prog.toFixed(1), target: target.toFixed ? target.toFixed(1) : target, unit: displayUnit, percent: pct, daysLeft }];
        });
    }, [userData?.runHistory, userData?.joinedChallenges, userData?.unitSystem]);

    const filteredRuns = useMemo(() => {
        const sorted = [...(userData?.runHistory || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
        if (activityFilter.type === 'week') {
            const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
            return sorted.filter(r => new Date(r.date) >= cutoff);
        }
        if (activityFilter.type === 'date' && activityFilter.year) {
            return sorted.filter(r => {
                const d = new Date(r.date);
                if (activityFilter.month !== null && activityFilter.month !== undefined) {
                    return d.getFullYear() === activityFilter.year && d.getMonth() === activityFilter.month;
                }
                return d.getFullYear() === activityFilter.year;
            });
        }
        // Limit to 20 for rendering performance to prevent freezing on mount
        return sorted.slice(0, 20);
    }, [userData?.runHistory, activityFilter]);

    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const filterLabel = useMemo(() => {
        if (activityFilter.type === 'week') return 'This Week';
        if (activityFilter.type === 'date') {
            if (activityFilter.month !== null && activityFilter.month !== undefined) {
                return `${MONTHS_SHORT[activityFilter.month]} ${activityFilter.year}`;
            }
            return `${activityFilter.year}`;
        }
        return 'All';
    }, [activityFilter]);

    const savedTips = useMemo(() =>
        allTips.filter(t => userData?.savedTips?.includes(t.id)),
    [allTips, userData?.savedTips]);

    const followersCount = userData?.followers?.length ?? 0;
    const followingCount = userData?.following?.length  ?? 0;
    const userCoins      = userData?.coins ?? 0;
    const xpPct          = Math.min((userData?.currentXP || 0) / (userData?.xpToNextLevel || 1000), 1) * 100;

    // ─────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────
    const handleShareProfile = async () => {
        lightTap();
        if (!userData?.username) {
            Alert.alert('Set a Username First', 'Create a username to get your public profile link.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Set Username', onPress: () => navigation.navigate('EditProfile') },
            ]);
            return;
        }
        await Share.share({ message: `Check out my running profile on Ruvo! https://ruvo.app/u/${userData.username}` });
    };

    const handleSaveProfile = async () => {
        lightTap();
        if (!editName.trim()) { errorFeedback(); Alert.alert('Error', 'Name cannot be empty'); return; }
        setIsSaving(true);
        try {
            await updateUserProfile({ name: editName });
            successFeedback();
            setEditModalVisible(false);
        } catch {
            errorFeedback();
            Alert.alert('Error', 'Could not update profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarSelect = async (uri) => {
        await updateUserProfile({ avatar: uri });
    };

    if (!userData) return null;

    // ─────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────
    if (isLoading) {
        return (
            <View style={[styles.container, { flex: 1 }]}>
                <StatusBar barStyle="light-content" />
                <ScrollView showsVerticalScrollIndicator={false}>
                    <SkeletonCard variant="profile" />
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                ref={scrollRef}
                contentContainerStyle={{ paddingBottom: 110 }}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={async () => {
                            setIsRefreshing(true);
                            try { if (refreshUser) await refreshUser(); } catch {}
                            setTimeout(() => setIsRefreshing(false), 800);
                        }}
                        tintColor={ACCENT}
                        colors={[ACCENT]}
                        progressBackgroundColor="#1C1C1E"
                    />
                }
            >
                {/* ══════════════════════════════════
                    HEADER
                ══════════════════════════════════ */}
                <LinearGradient colors={['#1A1A1A', '#080808']} style={styles.header}>
                    <SafeAreaView edges={['top']}>

                        {/* Top bar */}
                        <View style={styles.headerTop}>
                            {navigation.canGoBack() ? (
                                <TouchableOpacity activeOpacity={0.7} style={styles.closeBtn}
                                    onPress={() => { lightTap(); navigation.goBack(); }}>
                                    <Ionicons name="close" size={16} color="#FFF" />
                                    <Text style={styles.closeBtnText}>Close</Text>
                                </TouchableOpacity>
                            ) : <View style={{ width: 70 }} />}

                            <View style={styles.headerRight}>
                                {/* Coin badge */}
                                <TouchableOpacity activeOpacity={0.8} style={styles.coinBadge}
                                    onPress={() => { lightTap(); navigation.navigate('Rewards'); }}>
                                    <View style={styles.coinDot} />
                                    <Text style={styles.coinValue}>{userCoins.toLocaleString()}</Text>
                                    <Ionicons name="add-circle" size={15} color={ACCENT} />
                                </TouchableOpacity>

                                <TouchableOpacity activeOpacity={0.7} style={styles.headerIconBtn} onPress={handleShareProfile}>
                                    <Ionicons name="share-outline" size={18} color="#FFF" />
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7} style={styles.headerIconBtn}
                                    onPress={() => { lightTap(); navigation.navigate('Settings'); }}>
                                    <Ionicons name="ellipsis-vertical" size={18} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Avatar + Identity */}
                        <View style={styles.profileInfo}>
                            <View style={styles.avatarWrapper}>
                                <UserAvatar
                                    uri={userData.avatar}
                                    name={userData.name}
                                    size={104}
                                    borderColor={ACCENT}
                                    borderWidth={2.5}
                                />
                                {/* Avatar edit badge → opens avatar picker */}
                                <TouchableOpacity activeOpacity={0.8} style={styles.editBadge}
                                    onPress={() => { lightTap(); setShowAvatarPicker(true); }}>
                                    <Ionicons name="color-palette" size={13} color="#000" />
                                </TouchableOpacity>
                            </View>

                            {/* Tapping name opens name-edit modal */}
                            <TouchableOpacity activeOpacity={0.7}
                                onPress={() => { lightTap(); setEditName(userData.name); setEditModalVisible(true); }}>
                                <Text style={styles.userName}>
                                    {userData.name} {getFlag(userData.location?.country)}
                                </Text>
                            </TouchableOpacity>

                            {userData.username
                                ? <Text style={styles.userHandle}>@{userData.username}</Text>
                                : null}

                            {/* Level badge pill */}
                            <View style={styles.levelBadgePill}>
                                <Ionicons name="medal" size={11} color={ACCENT} style={{ marginRight: 4 }} />
                                <Text style={styles.levelBadgeText}>
                                    Level {userData.level || 1} • {getLevelTitle(userData.level || 1)}
                                </Text>
                            </View>

                            {/* Social row */}
                            <View style={styles.socialRow}>
                                <TouchableOpacity activeOpacity={0.7}
                                    onPress={() => { lightTap(); navigation.navigate('UserList', { title: 'Followers', userIds: userData.followers }); }}>
                                    <Text style={styles.socialText}><Text style={styles.socialNum}>{followersCount}</Text> Followers</Text>
                                </TouchableOpacity>
                                <View style={styles.socialDivider} />
                                <TouchableOpacity activeOpacity={0.7}
                                    onPress={() => { lightTap(); navigation.navigate('UserList', { title: 'Following', userIds: userData.following }); }}>
                                    <Text style={styles.socialText}><Text style={styles.socialNum}>{followingCount}</Text> Following</Text>
                                </TouchableOpacity>
                                <View style={styles.socialDivider} />
                                <TouchableOpacity activeOpacity={0.7}
                                    onPress={() => { lightTap(); navigation.navigate('FindFriends'); }}>
                                    <Text style={styles.socialText}><Text style={[styles.socialNum, { color: ACCENT }]}>+</Text> Add</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* ── STAT PILLS ── */}
                        <View style={styles.statsPillsRow}>
                            {[
                                { icon: <MaterialCommunityIcons name="run-fast" size={16} color="#000" />, value: totalRuns, label: 'Runs' },
                                {
                                    icon: <Ionicons name="map-outline" size={16} color="#000" />,
                                    value: formatDistance(totalKm, userData?.unitSystem, 1).split(' ')[0],
                                    label: userData?.unitSystem === 'imperial' ? 'Miles' : 'Km',
                                },
                                { icon: <Ionicons name="speedometer-outline" size={16} color="#000" />, value: formatPace(avgPace, userData?.unitSystem), label: 'Avg Pace' },
                            ].map((s, i) => (
                                <LinearGradient key={i} colors={['#1E1E1E', '#141414']} style={styles.statPill}>
                                    <View style={styles.statPillIconWrap}>{s.icon}</View>
                                    <Text style={styles.statPillValue}>{s.value}</Text>
                                    <Text style={styles.statPillLabel}>{s.label}</Text>
                                </LinearGradient>
                            ))}
                        </View>

                        {/* ── WEEKLY STRIP ── */}
                        <View style={styles.weekStrip}>
                            {weekDays.map((day, i) => (
                                <View key={i} style={styles.weekDayCol}>
                                    <Text style={[styles.weekLabel, day.isToday && styles.weekLabelToday]}>
                                        {day.label}
                                    </Text>

                                    <View style={styles.weekCircleWrap}>
                                        {/* Pulsing ring behind today */}
                                        {day.isToday && (
                                            <Animated.View style={[
                                                styles.weekPulseRing,
                                                { transform: [{ scale: pulseAnim }] },
                                            ]} />
                                        )}
                                        <View style={[styles.weekCircle, day.isToday && styles.weekCircleToday]}>
                                            <Text style={[styles.weekDate, day.isToday && styles.weekDateToday]}>
                                                {day.date}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Run dot */}
                                    <View style={[styles.weekDot, day.hasRun && styles.weekDotActive]} />
                                </View>
                            ))}
                        </View>

                        {/* ── XP BAR ── */}
                        <View style={styles.xpContainer}>
                            <View style={styles.xpLabelRow}>
                                <Text style={styles.xpLabel}>XP Progress</Text>
                                <Text style={styles.xpValue}>{userData.currentXP} / {userData.xpToNextLevel} XP</Text>
                            </View>
                            <View style={styles.xpBarBg}>
                                <LinearGradient
                                    colors={['#88BB00', ACCENT]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[styles.xpBarFill, { width: `${xpPct}%` }]}
                                />
                                {xpPct > 4 && (
                                    <View style={[styles.xpGlowDot, { left: `${xpPct}%` }]} />
                                )}
                            </View>
                        </View>

                    </SafeAreaView>
                </LinearGradient>

                {/* ══════════════════════════════════
                    GEAR PREVIEW CARD
                ══════════════════════════════════ */}
                <View style={{ height: 14 }} />
                <TouchableOpacity activeOpacity={0.75} style={styles.gearCardOuter}
                    onPress={() => { lightTap(); navigation.navigate('Gear'); }}>
                    <LinearGradient colors={['#141420', '#0A0A14']} style={styles.gearCard}>
                        <View style={styles.gearTop}>
                            <View style={styles.gearLeft}>
                                <LinearGradient colors={['rgba(204,255,0,0.18)', 'rgba(204,255,0,0.06)']} style={styles.gearIconBox}>
                                    <MaterialCommunityIcons name="shoe-sneaker" size={20} color={ACCENT} />
                                </LinearGradient>
                                <View>
                                    <Text style={styles.gearCardTitle}>My Gear</Text>
                                    <Text style={styles.gearCardSub}>
                                        {(userData?.gearList || []).length} pair{(userData?.gearList || []).length !== 1 ? 's' : ''}
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#444" />
                        </View>

                        {primaryGear ? (
                            <>
                                <Text style={styles.gearShoeName} numberOfLines={1}>{primaryGear.name}</Text>
                                <View style={styles.gearBarRow}>
                                    <View style={styles.gearBarBg}>
                                        <LinearGradient
                                            colors={gearBarColors(primaryGear)}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={[styles.gearBarFill, {
                                                width: `${Math.min((primaryGear.distance / primaryGear.limit) * 100, 100)}%`,
                                            }]}
                                        />
                                    </View>
                                    <Text style={styles.gearBarPct}>
                                        {Math.round((primaryGear.distance / primaryGear.limit) * 100)}%
                                    </Text>
                                </View>
                                <Text style={styles.gearStatLine}>
                                    {primaryGear.distance} / {primaryGear.limit} km
                                    <Text style={{ color: '#444' }}> • {Math.max(0, primaryGear.limit - primaryGear.distance)} km left</Text>
                                </Text>
                                {gearNearLimit > 0 && (
                                    <View style={styles.gearWarnRow}>
                                        <Ionicons name="flame" size={11} color="#FF9500" />
                                        <Text style={styles.gearWarnText}>
                                            {gearNearLimit} shoe{gearNearLimit > 1 ? 's' : ''} near limit, time to retire
                                        </Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <View style={styles.gearEmpty}>
                                <Text style={styles.gearEmptyText}>Track your shoe mileage</Text>
                                <View style={styles.gearAddChip}>
                                    <Ionicons name="add" size={12} color="#000" />
                                    <Text style={styles.gearAddChipText}>Add Gear</Text>
                                </View>
                            </View>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {/* Country row */}
                <TouchableOpacity activeOpacity={0.7} style={styles.menuRow}
                    onPress={() => {
                        lightTap();
                        setSelectedCountry(userData?.location?.country || 'Earth');
                        setShowCountryPicker(true);
                    }}>
                    <View style={styles.menuLeft}>
                        <LinearGradient colors={['rgba(204,255,0,0.12)', 'rgba(204,255,0,0.04)']} style={styles.menuIconBox}>
                            <Ionicons name="flag-outline" size={18} color={ACCENT} />
                        </LinearGradient>
                        <View>
                            <Text style={styles.menuText}>Country</Text>
                            <Text style={styles.menuSub}>{getFlag(userData?.location?.country)} {userData?.location?.country || 'Not set'}</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#444" />
                </TouchableOpacity>

                {/* ══════════════════════════════════
                    TAB BAR
                ══════════════════════════════════ */}
                <View style={styles.contentPad}>
                    <View style={styles.tabBar}>
                        {['Activity', 'Library'].map(tab => (
                            <TouchableOpacity key={tab} activeOpacity={0.7}
                                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                                onPress={() => { lightTap(); setActiveTab(tab); }}>
                                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                    {tab === 'Library' ? 'Saved Library' : tab}
                                </Text>
                                {activeTab === tab && <View style={styles.tabUnderline} />}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ══════════════════════════════════
                        ACTIVITY TAB
                    ══════════════════════════════════ */}
                    {activeTab === 'Activity' ? (
                        <>
                            {/* ── STREAK CARD ── */}
                            {currentStreak > 0 && (
                                <LinearGradient
                                    colors={['#0F1A00', '#0A1000']}
                                    style={styles.streakCard}
                                >
                                    {/* Accent glow border overlay */}
                                    <View style={styles.streakAccentBorder} />

                                    <View style={styles.streakBody}>
                                        {/* Badge */}
                                        <View style={styles.streakOnFireBadge}>
                                            <Ionicons name="flame" size={10} color="#FF6B00" />
                                            <Text style={styles.streakOnFireText}>ON FIRE</Text>
                                        </View>
                                        <Text style={styles.streakTitle}>Keep it up!</Text>
                                        <Text style={styles.streakSub}>
                                            {currentStreak} day{currentStreak !== 1 ? 's' : ''} in a row
                                        </Text>

                                        {/* Last-7-days dots */}
                                        <View style={styles.streakDots}>
                                            {Array.from({ length: 7 }).map((_, i) => {
                                                const d = new Date();
                                                d.setDate(d.getDate() - (6 - i));
                                                const ran = runDates.has(d.toDateString());
                                                const isLast = i === 6;
                                                return (
                                                    <View key={i} style={[
                                                        styles.streak7Dot,
                                                        ran && styles.streak7DotActive,
                                                        isLast && ran && styles.streak7DotToday,
                                                    ]} />
                                                );
                                            })}
                                        </View>
                                    </View>

                                    <LinearGradient
                                        colors={['rgba(204,255,0,0.12)', 'rgba(204,255,0,0.04)']}
                                        style={styles.streakTrophyWrap}
                                    >
                                        <Ionicons name="trophy" size={44} color={ACCENT} />
                                    </LinearGradient>
                                </LinearGradient>
                            )}

                            {/* ── ACTIVE CHALLENGES ── */}
                            <View style={styles.sectionRow}>
                                <Text style={styles.sectionTitle}>Active Challenges</Text>
                            </View>

                            {myActiveChallenges.length > 0 ? (
                                myActiveChallenges.map(c => (
                                    <LinearGradient key={c.id} colors={['#131313', '#0E0E0E']} style={styles.challengeCard}>
                                        <View style={styles.challengeAccent} />
                                        <View style={styles.challengeHeader}>
                                            <Text style={styles.challengeTitle}>{c.title}</Text>
                                            <View style={styles.challengeDaysChip}>
                                                <Text style={styles.challengeDaysText}>{c.daysLeft}d left</Text>
                                            </View>
                                        </View>
                                        <View style={styles.challengeProgRow}>
                                            <Text style={styles.challengeProgVal}>{c.progress} / {c.target} {c.unit}</Text>
                                            <Text style={styles.challengeProgPct}>{Math.round(c.percent)}%</Text>
                                        </View>
                                        <View style={styles.challengeBarBg}>
                                            <LinearGradient
                                                colors={c.percent >= 100 ? [ACCENT, '#88FF00'] : ['#88BB00', ACCENT]}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={[styles.challengeBarFill, { width: `${c.percent}%` }]}
                                            />
                                        </View>
                                    </LinearGradient>
                                ))
                            ) : (
                                <TouchableOpacity activeOpacity={0.7} style={styles.emptyChallengeCard}
                                    onPress={() => { lightTap(); navigation.navigate('Community'); }}>
                                    <Ionicons name="trophy-outline" size={26} color="#333" />
                                    <Text style={styles.emptyCardText}>No active challenges</Text>
                                    <Text style={styles.emptyCardCta}>Join one in Community →</Text>
                                </TouchableOpacity>
                            )}

                            {/* ── ACHIEVEMENTS ── */}
                            <View style={[styles.sectionRow, { marginTop: 26 }]}>
                                <Text style={styles.sectionTitle}>Achievements</Text>
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 2 }}
                                style={{ marginBottom: 8, marginHorizontal: -2 }}
                            >
                                {BADGES.map(badge => {
                                    const unlocked = userData.badges?.some(b =>
                                        (b.id && b.id === badge.id) || (b.name && b.name === badge.name)
                                    );
                                    return (
                                        <View key={badge.id} style={[styles.badgeItem, !unlocked && { opacity: 0.28 }]}>
                                            <LinearGradient
                                                colors={unlocked ? [badge.color, badge.color + 'AA'] : ['#222', '#1A1A1A']}
                                                style={styles.badgeIconWrap}
                                            >
                                                <Ionicons name={unlocked ? badge.icon : 'lock-closed'} size={24}
                                                    color={unlocked ? '#000' : '#555'} />
                                            </LinearGradient>
                                            <Text style={[styles.badgeName, !unlocked && { color: '#555' }]}>{badge.name}</Text>
                                            <Text style={styles.badgeDesc}>{badge.description}</Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            {/* ── RECENT ACTIVITY ── */}
                            <View style={[styles.sectionRow, { marginTop: 26 }]}>
                                <Text style={styles.sectionTitle}>Recent Activity</Text>
                                <View style={styles.filterGroup}>
                                    <TouchableOpacity activeOpacity={0.7}
                                        style={[styles.filterChip, activityFilter.type === 'all' && styles.filterChipActive]}
                                        onPress={() => { lightTap(); setActivityFilter({ type: 'all' }); }}>
                                        <Text style={[styles.filterChipText, activityFilter.type === 'all' && styles.filterChipTextActive]}>All</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity activeOpacity={0.7}
                                        style={[styles.filterChip, activityFilter.type === 'week' && styles.filterChipActive]}
                                        onPress={() => { lightTap(); setActivityFilter({ type: 'week' }); }}>
                                        <Text style={[styles.filterChipText, activityFilter.type === 'week' && styles.filterChipTextActive]}>Week</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity activeOpacity={0.7}
                                        style={[styles.filterChip, activityFilter.type === 'date' && styles.filterChipActive]}
                                        onPress={() => {
                                            lightTap();
                                            setPickerYear(activityFilter.year || new Date().getFullYear());
                                            setPickerMonth(activityFilter.month ?? null);
                                            setShowDatePicker(true);
                                        }}>
                                        <Ionicons name="calendar-outline" size={11}
                                            color={activityFilter.type === 'date' ? '#FFF' : '#444'}
                                            style={{ marginRight: 3 }} />
                                        <Text style={[styles.filterChipText, activityFilter.type === 'date' && styles.filterChipTextActive]}>
                                            {activityFilter.type === 'date' ? filterLabel : 'Date'}
                                        </Text>
                                    </TouchableOpacity>
                                    {activityFilter.type === 'date' && (
                                        <TouchableOpacity activeOpacity={0.7}
                                            style={styles.filterClearBtn}
                                            onPress={() => { lightTap(); setActivityFilter({ type: 'all' }); }}>
                                            <Ionicons name="close" size={11} color="#888" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {filteredRuns.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <MaterialCommunityIcons name="run-fast" size={40} color="#222" />
                                    <Text style={styles.emptyText}>No runs for this period.</Text>
                                </View>
                            ) : (
                                filteredRuns.map((run, idx) => {
                                    const isNew = run.date && (Date.now() - new Date(run.date).getTime()) < 24 * 60 * 60 * 1000;
                                    const runDate = run.date ? new Date(run.date) : null;
                                    const dateLabel = runDate
                                        ? runDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        : '';
                                    const timeLabel = runDate
                                        ? runDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                        : '';
                                    const typeIcon = run.activityType === 'Walk' ? 'walk'
                                        : run.activityType === 'Hike' ? 'hiking' : 'run-fast';
                                    return (
                                        <TouchableOpacity
                                            key={run.id || idx}
                                            activeOpacity={0.75}
                                            style={[styles.runCard, isNew && styles.runCardNew]}
                                            onPress={() => { lightTap(); navigation.navigate('RunDetail', { run }); }}
                                        >
                                            {/* Left accent bar */}
                                            <View style={[styles.runCardAccent, isNew && { backgroundColor: ACCENT }]} />

                                            {/* Icon */}
                                            <LinearGradient
                                                colors={isNew ? [ACCENT, '#88BB00'] : ['#1E1E1E', '#161616']}
                                                style={styles.runIconWrap}
                                            >
                                                <MaterialCommunityIcons
                                                    name={typeIcon}
                                                    size={20}
                                                    color={isNew ? '#000' : '#555'}
                                                />
                                            </LinearGradient>

                                            {/* Info */}
                                            <View style={styles.runInfo}>
                                                <View style={styles.runTitleRow}>
                                                    <Text style={styles.runTitle} numberOfLines={1}>
                                                        {run.title || (run.activityType || 'Run') + ' Workout'}
                                                    </Text>
                                                    {isNew && (
                                                        <View style={styles.newBadge}>
                                                            <Text style={styles.newBadgeText}>NEW</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.runDate}>
                                                    {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
                                                    {run.gearName ? ` · ${run.gearName}` : ''}
                                                </Text>
                                                <View style={styles.runPillRow}>
                                                    <View style={styles.runPill}>
                                                        <Ionicons name="time-outline" size={9} color="#555" />
                                                        <Text style={styles.runPillText}>{run.duration}</Text>
                                                    </View>
                                                    {run.pace && run.pace !== '--' && (
                                                        <View style={styles.runPill}>
                                                            <Ionicons name="speedometer-outline" size={9} color="#555" />
                                                            <Text style={styles.runPillText}>{run.pace}/km</Text>
                                                        </View>
                                                    )}
                                                    {run.calories > 0 && (
                                                        <View style={styles.runPill}>
                                                            <MaterialCommunityIcons name="fire" size={9} color="#FF6B6B" />
                                                            <Text style={styles.runPillText}>{Math.round(run.calories)} kcal</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>

                                            {/* Distance + chevron */}
                                            <View style={styles.runRight}>
                                                <Text style={[styles.runDist, isNew && { color: ACCENT }]}>
                                                    {formatDistance(run.distance, userData?.unitSystem)}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={14} color="#2A2A2A" style={{ marginTop: 4 }} />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </>
                    ) : (
                        /* ══════════════════════════════════
                           LIBRARY TAB
                        ══════════════════════════════════ */
                        <View style={{ marginTop: 8 }}>
                            {savedTips.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="bookmark-outline" size={40} color="#222" />
                                    <Text style={styles.emptyText}>No saved tips yet.</Text>
                                    <Text style={styles.emptySubText}>Bookmark tips from the Home screen.</Text>
                                </View>
                            ) : (
                                savedTips.map((tip, idx) => (
                                    <TouchableOpacity key={idx} activeOpacity={0.75} style={styles.tipCard}
                                        onPress={() => { lightTap(); navigation.navigate('TipDetail', { tip }); }}>
                                        <Image source={{ uri: tip.img }} style={styles.tipImage} />
                                        <View style={styles.tipContent}>
                                            <Text style={styles.tipTitle}>{tip.title}</Text>
                                            <Text style={styles.tipDesc} numberOfLines={2}>{tip.desc}</Text>
                                            <Text style={styles.tipCta}>READ NOW</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* ══════════════════════════════════
                MODALS
            ══════════════════════════════════ */}

            {/* Avatar Picker */}
            <AvatarPickerModal
                visible={showAvatarPicker}
                currentUri={userData?.avatar}
                onSelect={handleAvatarSelect}
                onClose={() => setShowAvatarPicker(false)}
            />

            {/* Edit Profile Name */}
            <Modal visible={isEditModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Display Name</Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setEditModalVisible(false); }}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalLabel}>Display Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editName}
                            onChangeText={setEditName}
                            placeholderTextColor="#555"
                            placeholder="Enter your name"
                            autoFocus
                        />
                        <TouchableOpacity activeOpacity={0.85} style={styles.modalSaveBtn} onPress={handleSaveProfile} disabled={isSaving}>
                            {isSaving
                                ? <ActivityIndicator color="#000" />
                                : <Text style={styles.modalSaveBtnText}>Save Changes</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Country Picker */}
            <Modal visible={showCountryPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => { lightTap(); setShowCountryPicker(false); }} />
                    <View style={[styles.countrySheet, { height: Dimensions.get('screen').height * 0.72 }]}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Country</Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowCountryPicker(false); }}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.searchBox}>
                            <Ionicons name="search" size={18} color="#555" style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search country…"
                                placeholderTextColor="#555"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                            />
                        </View>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            {COUNTRIES.flatMap(c => {
                                if (!c.name.toLowerCase().includes(searchQuery.toLowerCase())) return [];
                                return [(
                                    <TouchableOpacity key={c.code}
                                        style={[styles.countryItem, selectedCountry === c.name && styles.countryItemActive]}
                                        onPress={async () => {
                                            lightTap();
                                            const prev = selectedCountry;
                                            setSelectedCountry(c.name);
                                            setShowCountryPicker(false);
                                            setSearchQuery('');
                                            try {
                                                await updateUserProfile({ location: { ...userData.location, country: c.name } });
                                                successFeedback();
                                            } catch {
                                                setSelectedCountry(prev);
                                                errorFeedback();
                                                Alert.alert('Error', 'Could not save country. Check your connection.');
                                            }
                                        }}>
                                        <Text style={styles.countryFlag}>{getFlag(c.name)}</Text>
                                        <Text style={[styles.countryName, selectedCountry === c.name && { color: ACCENT, fontFamily: 'Poppins_600SemiBold' }]}>
                                            {c.name}
                                        </Text>
                                        {selectedCountry === c.name && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                                    </TouchableOpacity>
                                )];
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Date Filter Picker */}
            <Modal visible={showDatePicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setShowDatePicker(false)} />
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filter by Date</Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowDatePicker(false); }}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Year navigator */}
                        <View style={styles.yearNav}>
                            <TouchableOpacity activeOpacity={0.7} style={styles.yearNavBtn}
                                onPress={() => setPickerYear(y => y - 1)}>
                                <Ionicons name="chevron-back" size={20} color="#FFF" />
                            </TouchableOpacity>
                            <Text style={styles.yearNavLabel}>{pickerYear}</Text>
                            <TouchableOpacity activeOpacity={0.7} style={styles.yearNavBtn}
                                disabled={pickerYear >= new Date().getFullYear()}
                                onPress={() => setPickerYear(y => Math.min(y + 1, new Date().getFullYear()))}>
                                <Ionicons name="chevron-forward" size={20}
                                    color={pickerYear >= new Date().getFullYear() ? '#333' : '#FFF'} />
                            </TouchableOpacity>
                        </View>

                        {/* All-year option */}
                        <TouchableOpacity activeOpacity={0.7}
                            style={[styles.yearOnlyBtn, pickerMonth === null && styles.yearOnlyBtnActive]}
                            onPress={() => setPickerMonth(null)}>
                            <Text style={[styles.yearOnlyText, pickerMonth === null && styles.yearOnlyTextActive]}>
                                All of {pickerYear}
                            </Text>
                        </TouchableOpacity>

                        {/* Month grid */}
                        <View style={styles.monthGrid}>
                            {MONTHS_SHORT.map((m, i) => {
                                const isSelected = pickerMonth === i;
                                const isDisabled = pickerYear === new Date().getFullYear() && i > new Date().getMonth();
                                return (
                                    <TouchableOpacity key={i} activeOpacity={0.7}
                                        disabled={isDisabled}
                                        style={[styles.monthCell, isSelected && styles.monthCellActive, isDisabled && { opacity: 0.25 }]}
                                        onPress={() => { lightTap(); setPickerMonth(isSelected ? null : i); }}>
                                        <Text style={[styles.monthText, isSelected && styles.monthTextActive]}>{m}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity activeOpacity={0.85} style={styles.modalSaveBtn}
                            onPress={() => {
                                lightTap();
                                setActivityFilter({ type: 'date', year: pickerYear, month: pickerMonth });
                                setShowDatePicker(false);
                            }}>
                            <Text style={styles.modalSaveBtnText}>Apply Filter</Text>
                        </TouchableOpacity>

                        <TouchableOpacity activeOpacity={0.7} style={styles.dpCancelBtn}
                            onPress={() => { lightTap(); setShowDatePicker(false); }}>
                            <Text style={styles.dpCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <FloatingNavBar current="Profile" />
        </View>
    );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    // ── HEADER ──
    header: { paddingBottom: 28 },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingTop: 10,
    },
    closeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255,255,255,0.07)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    closeBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_500Medium' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    coinBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(204,255,0,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    coinDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },
    coinValue: { color: ACCENT, fontSize: 13, fontFamily: 'Poppins_700Bold' },
    headerIconBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.07)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── AVATAR + IDENTITY ──
    profileInfo: { alignItems: 'center', marginTop: 20 },
    avatarWrapper: { position: 'relative', marginBottom: 14 },
    editBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: ACCENT,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2.5,
        borderColor: '#080808',
    },
    userName: {
        color: '#FFF',
        fontSize: 22,
        fontFamily: 'Poppins_700Bold',
        textAlign: 'center',
    },
    userHandle: {
        color: '#555',
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
        marginTop: 2,
    },
    levelBadgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(204,255,0,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.18)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginTop: 8,
    },
    levelBadgeText: {
        color: '#AAD400',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
    },
    socialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        gap: 12,
    },
    socialText: { color: '#666', fontSize: 12, fontFamily: 'Poppins_400Regular' },
    socialNum: { color: '#FFF', fontFamily: 'Poppins_700Bold' },
    socialDivider: { width: 1, height: 12, backgroundColor: '#2A2A2A' },

    // ── STAT PILLS ──
    statsPillsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginTop: 24,
        paddingHorizontal: 18,
    },
    statPill: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#252525',
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        gap: 4,
    },
    statPillIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: ACCENT,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    statPillValue: { color: '#FFF', fontSize: 17, fontFamily: 'Poppins_700Bold', lineHeight: 20 },
    statPillLabel: { color: '#555', fontSize: 10, fontFamily: 'Poppins_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },

    // ── WEEKLY STRIP ──
    weekStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 22,
        marginHorizontal: 18,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1E1E1E',
        paddingVertical: 14,
        paddingHorizontal: 10,
    },
    weekDayCol: { alignItems: 'center', flex: 1, gap: 6 },
    weekLabel: { color: '#444', fontSize: 10, fontFamily: 'Poppins_500Medium' },
    weekLabelToday: { color: ACCENT },
    weekCircleWrap: { position: 'relative', justifyContent: 'center', alignItems: 'center', width: 34, height: 34 },
    weekPulseRing: {
        position: 'absolute',
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(204,255,0,0.35)',
    },
    weekCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    weekCircleToday: { backgroundColor: ACCENT },
    weekDate: { color: '#666', fontSize: 13, fontFamily: 'Poppins_600SemiBold', textAlign: 'center', lineHeight: 16, includeFontPadding: false },
    weekDateToday: { color: '#000' },
    weekDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
    weekDotActive: { backgroundColor: ACCENT },

    // ── XP BAR ──
    xpContainer: { marginTop: 22, paddingHorizontal: 22 },
    xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    xpLabel: { color: '#666', fontSize: 11, fontFamily: 'Poppins_500Medium' },
    xpValue: { color: ACCENT, fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    xpBarBg: { height: 7, backgroundColor: '#1A1A1A', borderRadius: 4, overflow: 'hidden', position: 'relative' },
    xpBarFill: { height: '100%', borderRadius: 4 },
    xpGlowDot: {
        position: 'absolute',
        top: -3,
        marginLeft: -6,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: ACCENT,
        boxShadow: "0 0 6px rgba(204, 255, 0, 1)",
    },

    // ── GEAR CARD ──
    gearCardOuter: { marginHorizontal: 16, borderRadius: 22, overflow: 'hidden' },
    gearCard: {
        padding: 18,
        borderWidth: 1,
        borderColor: '#1E1E2E',
        borderRadius: 22,
    },
    gearTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    gearLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    gearIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.15)',
    },
    gearCardTitle: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold' },
    gearCardSub: { color: '#444', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    gearShoeName: { color: '#CCC', fontSize: 13, fontFamily: 'Poppins_600SemiBold', marginBottom: 10 },
    gearBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    gearBarBg: { flex: 1, height: 6, backgroundColor: '#1A1A2A', borderRadius: 3, overflow: 'hidden' },
    gearBarFill: { height: '100%', borderRadius: 3 },
    gearBarPct: { color: '#888', fontSize: 11, fontFamily: 'Poppins_600SemiBold', width: 34, textAlign: 'right' },
    gearStatLine: { color: '#666', fontSize: 11, fontFamily: 'Poppins_400Regular' },
    gearWarnRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
    gearWarnText: { color: '#FF9500', fontSize: 11, fontFamily: 'Poppins_500Medium' },
    gearEmpty: { alignItems: 'flex-start', marginTop: 4 },
    gearEmptyText: { color: '#444', fontSize: 12, fontFamily: 'Poppins_400Regular', marginBottom: 10 },
    gearAddChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: ACCENT,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    gearAddChipText: { color: '#000', fontSize: 12, fontFamily: 'Poppins_700Bold' },

    // ── MENU ROW ──
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0E0E0E',
        marginHorizontal: 16,
        marginTop: 10,
        padding: 15,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#1A1A1A',
    },
    menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    menuIconBox: {
        width: 38,
        height: 38,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.12)',
    },
    menuText: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    menuSub: { color: '#555', fontSize: 11, marginTop: 1 },

    // ── TABS ──
    contentPad: { padding: 16, paddingTop: 18 },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
        marginBottom: 22,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        position: 'relative',
    },
    tabBtnActive: {},
    tabText: { color: '#444', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    tabTextActive: { color: '#FFF' },
    tabUnderline: {
        position: 'absolute',
        bottom: -1,
        left: '20%',
        right: '20%',
        height: 2,
        borderRadius: 1,
        backgroundColor: ACCENT,
    },

    // ── STREAK CARD ──
    streakCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.15)',
        marginBottom: 22,
        overflow: 'hidden',
        position: 'relative',
    },
    streakAccentBorder: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: ACCENT,
        borderTopLeftRadius: 22,
        borderBottomLeftRadius: 22,
    },
    streakBody: { flex: 1, padding: 18, paddingLeft: 20 },
    streakOnFireBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,107,0,0.15)',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    streakOnFireText: { color: '#FF9500', fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },
    streakTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    streakSub: { color: '#666', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 3 },
    streakDots: { flexDirection: 'row', gap: 5, marginTop: 12 },
    streak7Dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#1E2A0A',
        borderWidth: 1,
        borderColor: '#2A3A10',
    },
    streak7DotActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    streak7DotToday: {
        width: 10,
        height: 10,
        borderRadius: 5,
        boxShadow: "0 0 5px rgba(204, 255, 0, 0.9)",
    },
    streakTrophyWrap: {
        width: 80,
        alignSelf: 'stretch',
        justifyContent: 'center',
        alignItems: 'center',
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(204,255,0,0.08)',
    },

    // ── CHALLENGES ──
    sectionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        marginTop: 4,
    },
    sectionTitle: { color: '#FFF', fontSize: 17, fontFamily: 'Poppins_700Bold' },
    challengeCard: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1E1E1E',
        marginBottom: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    challengeAccent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: ACCENT,
    },
    challengeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingLeft: 22,
        paddingTop: 16,
        marginBottom: 10,
    },
    challengeTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold', flex: 1 },
    challengeDaysChip: {
        backgroundColor: '#1A1A1A',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    challengeDaysText: { color: '#666', fontSize: 10, fontFamily: 'Poppins_500Medium' },
    challengeProgRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingLeft: 22,
        marginBottom: 8,
    },
    challengeProgVal: { color: ACCENT, fontSize: 12, fontFamily: 'Poppins_700Bold' },
    challengeProgPct: { color: '#666', fontSize: 12 },
    challengeBarBg: { height: 5, backgroundColor: '#1A1A1A', marginHorizontal: 18, marginLeft: 22, marginBottom: 16, borderRadius: 3, overflow: 'hidden' },
    challengeBarFill: { height: '100%', borderRadius: 3 },
    emptyChallengeCard: {
        alignItems: 'center',
        padding: 26,
        backgroundColor: '#0E0E0E',
        borderRadius: 20,
        marginBottom: 20,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#222',
    },
    emptyCardText: { color: '#555', marginTop: 10, fontSize: 14, fontFamily: 'Poppins_500Medium' },
    emptyCardCta: { color: ACCENT, fontFamily: 'Poppins_600SemiBold', marginTop: 6, fontSize: 12 },

    // ── BADGES ──
    badgeItem: { alignItems: 'center', marginRight: 16, width: 88 },
    badgeIconWrap: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    badgeName: { color: '#FFF', fontSize: 11, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },
    badgeDesc: { color: '#444', fontSize: 9, textAlign: 'center', marginTop: 2 },

    // ── FILTER ──
    filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 16,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#1E1E1E',
    },
    filterChipActive: { backgroundColor: '#1E1E1E', borderColor: ACCENT },
    filterChipText: { color: '#444', fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    filterChipTextActive: { color: '#FFF' },
    filterClearBtn: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },

    // ── DATE PICKER MODAL ──
    yearNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        marginBottom: 16,
    },
    yearNavBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    yearNavLabel: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold' },
    yearOnlyBtn: {
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#161616',
        alignItems: 'center',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    yearOnlyBtnActive: { borderColor: ACCENT, backgroundColor: 'rgba(204,255,0,0.06)' },
    yearOnlyText: { color: '#555', fontSize: 13, fontFamily: 'Poppins_500Medium' },
    yearOnlyTextActive: { color: ACCENT },
    monthGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    monthCell: {
        width: '23%',
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: '#161616',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    monthCellActive: { backgroundColor: 'rgba(204,255,0,0.12)', borderColor: ACCENT },
    monthText: { color: '#555', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    monthTextActive: { color: ACCENT },
    dpCancelBtn: { paddingVertical: 14, alignItems: 'center' },
    dpCancelText: { color: '#555', fontSize: 14, fontFamily: 'Poppins_500Medium' },

    // ── RUN CARDS ──
    runCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0D0D0D',
        borderRadius: 20,
        paddingVertical: 14,
        paddingRight: 14,
        paddingLeft: 0,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1A1A1A',
        gap: 12,
        overflow: 'hidden',
    },
    runCardNew: {
        borderColor: ACCENT + '35',
        backgroundColor: '#0D1200',
    },
    runCardAccent: {
        width: 3,
        alignSelf: 'stretch',
        backgroundColor: '#222',
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
    },
    runTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 },
    newBadge: {
        backgroundColor: ACCENT,
        borderRadius: 5,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    newBadgeText: { color: '#000', fontSize: 8, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 0.5 },
    runPillRow: { flexDirection: 'row', gap: 6, marginTop: 5, flexWrap: 'wrap' },
    runPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#161616',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: '#222',
    },
    runPillText: { color: '#555', fontSize: 10, fontFamily: 'Poppins_500Medium' },
    runRight: { alignItems: 'flex-end' },
    runIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#222',
    },
    runInfo: { flex: 1 },
    runTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold', flex: 1 },
    runDate: { color: '#555', fontSize: 10, fontFamily: 'Poppins_400Regular' },
    runStats: { alignItems: 'flex-end' },
    runDist: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_800ExtraBold' },
    runCals: { color: ACCENT, fontSize: 10, fontFamily: 'Poppins_500Medium' },

    // ── EMPTY STATES ──
    emptyState: { alignItems: 'center', marginTop: 32, marginBottom: 16 },
    emptyText: { color: '#555', marginTop: 12, fontSize: 14, fontFamily: 'Poppins_500Medium' },
    emptySubText: { color: '#333', fontSize: 12, marginTop: 4 },

    // ── SAVED TIPS ──
    tipCard: {
        flexDirection: 'row',
        backgroundColor: '#0E0E0E',
        borderRadius: 18,
        marginBottom: 12,
        overflow: 'hidden',
        height: 100,
        borderWidth: 1,
        borderColor: '#1A1A1A',
    },
    tipImage: { width: 100, height: '100%' },
    tipContent: { flex: 1, padding: 12, justifyContent: 'space-between' },
    tipTitle: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_700Bold' },
    tipDesc: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular', lineHeight: 16 },
    tipCta: { color: ACCENT, fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },

    // ── MODALS ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#0E0E0E',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        paddingBottom: 36,
        borderTopWidth: 1,
        borderColor: '#1E1E1E',
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#333',
        alignSelf: 'center',
        marginBottom: 18,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#FFF', fontSize: 19, fontFamily: 'Poppins_700Bold' },
    modalLabel: { color: '#555', fontSize: 12, marginBottom: 8, marginLeft: 2 },
    modalInput: {
        backgroundColor: '#161616',
        color: '#FFF',
        padding: 15,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        fontSize: 15,
        marginBottom: 20,
        fontFamily: 'Poppins_400Regular',
    },
    modalSaveBtn: {
        backgroundColor: ACCENT,
        padding: 15,
        borderRadius: 30,
        alignItems: 'center',
    },
    modalSaveBtnText: { color: '#000', fontSize: 15, fontFamily: 'Poppins_700Bold' },

    // ── COUNTRY PICKER ──
    countrySheet: {
        backgroundColor: '#0E0E0E',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 20,
        borderTopWidth: 1,
        borderColor: '#1E1E1E',
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#161616',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 11,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    searchInput: { flex: 1, color: '#FFF', fontSize: 14, fontFamily: 'Poppins_500Medium' },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#161616',
    },
    countryItemActive: { backgroundColor: '#111' },
    countryFlag: { fontSize: 22, marginRight: 14 },
    countryName: { flex: 1, color: '#FFF', fontSize: 14, fontFamily: 'Poppins_400Regular' },
});
