import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView,
    Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingNavBar from '../components/FloatingNavBar';
import UserAvatar from '../components/UserAvatar';
import { BADGES } from '../constants/badges';
import { COUNTRIES } from '../constants/countries';
import { useUser } from '../context/UserContext';
import { contentService } from '../services/contentService';
import { getFlag } from '../utils/helpers';
import { formatDistance, formatPace } from '../utils/units';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';

const COLORS = {
    accent: "#CCFF00",
    primary: "#000000",
    secondary: "#1C1C1E",
    danger: "#FF3B30",
    text: "#FFFFFF"
};

const { width } = Dimensions.get('window');

const getMonthlyChallenges = () => {
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    const fmtDate = (day) => `${monthName.substring(0, 3)} ${day}`;

    return [
        {
            id: 'c1',
            title: `The ${monthName} Ultra`,
            target: 100,
            unit: 'km',
            type: 'distance',
            dates: `${monthName} 1 - ${daysInMonth}`,
        },
        {
            id: 'c2',
            title: 'Speed Week',
            target: 3,
            unit: 'runs',
            type: 'count',
            dates: `${fmtDate(8)} - ${fmtDate(15)}`,
        },
        {
            id: 'c3',
            title: 'Elevation King',
            target: 300,
            unit: 'm',
            type: 'elevation',
            dates: `${fmtDate(20)} - ${fmtDate(27)}`,
        }
    ];
};

const getLevelTitle = (level) => {
    if (level < 5) return "Rookie";
    if (level < 10) return "Endurance Athlete";
    return "Elite Runner";
};

export default function ProfileScreen({ navigation }) {
    const { userData, updateUserProfile, refreshUser } = useUser();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [activeTab, setActiveTab] = useState('Activity');
    const [filter, setFilter] = useState('All');
    const [lastRefresh, setLastRefresh] = useState(Date.now());

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            setLastRefresh(Date.now());
            setFilter('All');
        });
        return unsubscribe;
    }, [navigation]);

    const [allTips, setAllTips] = useState([]);

    useEffect(() => {
        const loadTips = async () => {
            const tips = await contentService.fetchTips();
            setAllTips(tips);
        };
        loadTips();
    }, []);

    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [editName, setEditName] = useState(userData?.name || "");
    const [isSaving, setIsSaving] = useState(false);

    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(userData?.location?.country || 'Earth');
    const [searchQuery, setSearchQuery] = useState("");

    // --- REAL RUN STATS ---
    const totalKm = userData?.runHistory ? userData.runHistory.reduce((acc, run) => acc + (parseFloat(run.distance) || 0), 0) : 0;
    const totalRuns = userData?.runHistory ? userData.runHistory.length : 0;

    const avgPace = useMemo(() => {
        if (!userData?.runHistory || userData.runHistory.length === 0) return '0:00';
        let totalSeconds = 0;
        let validRuns = 0;
        userData.runHistory.forEach(run => {
            if (run.duration) {
                const parts = run.duration.split(':').map(Number);
                let seconds = 0;
                if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                if (seconds > 0) { totalSeconds += seconds; validRuns++; }
            }
        });
        if (validRuns === 0 || totalKm === 0) return '0:00';
        const avgSecondsPerKm = totalSeconds / totalKm;
        const mins = Math.floor(avgSecondsPerKm / 60);
        const secs = Math.floor(avgSecondsPerKm % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, [userData?.runHistory, totalKm]);

    // --- STREAK (from real runHistory) ---
    const currentStreak = useMemo(() => {
        if (!userData?.runHistory || userData.runHistory.length === 0) return 0;
        const runDates = new Set(
            userData.runHistory.map(r => new Date(r.date).toDateString())
        );
        const today = new Date();
        const todayStr = today.toDateString();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        let checkDate = new Date(today);
        if (!runDates.has(todayStr)) {
            if (!runDates.has(yesterday.toDateString())) return 0;
            checkDate = new Date(yesterday);
        }

        let streak = 0;
        while (runDates.has(checkDate.toDateString())) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
        return streak;
    }, [userData?.runHistory]);

    // --- WEEKLY STRIP (from real runHistory) ---
    const weekDays = useMemo(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);

        const runDates = new Set(
            (userData?.runHistory || []).map(r => new Date(r.date).toDateString())
        );

        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return {
                label,
                date: d.getDate(),
                isToday: d.toDateString() === today.toDateString(),
                hasRun: runDates.has(d.toDateString()),
            };
        });
    }, [userData?.runHistory]);

    const handleShareProfile = async () => {
        lightTap();
        if (!userData?.username) {
            Alert.alert(
                'Set a Username First',
                'Create a username to get your public profile link.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Set Username', onPress: () => navigation.navigate('EditProfile') }
                ]
            );
            return;
        }
        await Share.share({
            message: `Check out my running profile on Ruvo! https://ruvo.app/u/${userData.username}`,
            url: `https://ruvo.app/u/${userData.username}`,
        });
    };

    const followersCount = userData?.followers ? userData.followers.length : 0;
    const followingCount = userData?.following ? userData.following.length : 0;
    const userCoins = userData?.coins || 0;

    const getFilteredHistory = () => {
        if (!userData?.runHistory) return [];
        const sorted = [...userData.runHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (filter === 'All') return sorted;
        if (filter === 'Week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return sorted.filter(r => new Date(r.date) >= oneWeekAgo);
        }
        return sorted;
    };
    const filteredData = getFilteredHistory();

    const savedTips = allTips.filter(tip => userData?.savedTips?.includes(tip.id));

    const myActiveChallenges = useMemo(() => {
        const allChallenges = getMonthlyChallenges();
        const joinedIds = userData?.joinedChallenges || [];
        const myChallenges = allChallenges.filter(c => joinedIds.includes(c.id));
        const unitSystem = userData?.unitSystem || 'metric';

        return myChallenges.map(challenge => {
            let currentProgress = 0;
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthRuns = (userData?.runHistory || []).filter(run => new Date(run.date) >= startOfMonth);

            if (challenge.type === 'distance') {
                const totalKm = monthRuns.reduce((acc, r) => acc + (parseFloat(r.distance) || 0), 0);
                if (unitSystem === 'imperial') {
                    currentProgress = totalKm * 0.621371;
                    challenge.displayTarget = (challenge.target * 0.621371).toFixed(1);
                    challenge.displayUnit = 'mi';
                } else {
                    currentProgress = totalKm;
                    challenge.displayTarget = challenge.target;
                    challenge.displayUnit = challenge.unit;
                }
            } else if (challenge.type === 'count') {
                currentProgress = monthRuns.length;
                challenge.displayTarget = challenge.target;
                challenge.displayUnit = challenge.unit;
            } else if (challenge.type === 'elevation') {
                currentProgress = monthRuns.reduce((acc, r) => acc + (parseFloat(r.elevation) || 0), 0);
                challenge.displayTarget = challenge.target;
                challenge.displayUnit = challenge.unit;
            }

            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const daysLeft = Math.ceil((endOfMonth - now) / (1000 * 60 * 60 * 24));

            return {
                ...challenge,
                progress: currentProgress.toFixed(1),
                target: challenge.displayTarget,
                unit: challenge.displayUnit,
                percent: Math.min((currentProgress / (unitSystem === 'imperial' && challenge.type === 'distance' ? challenge.target * 0.621371 : challenge.target)) * 100, 100),
                daysLeft: Math.max(daysLeft, 0)
            };
        });
    }, [userData?.runHistory, userData?.joinedChallenges, userData?.unitSystem]);

    const handleSaveProfile = async () => {
        lightTap();
        if (!editName.trim()) {
            errorFeedback();
            Alert.alert("Error", "Name cannot be empty");
            return;
        }
        setIsSaving(true);
        try {
            await updateUserProfile({ name: editName });
            successFeedback();
            setIsSaving(false);
            setEditModalVisible(false);
        } catch (error) {
            setIsSaving(false);
            errorFeedback();
            Alert.alert("Error", "Could not update profile.");
        }
    };

    const xpPercentage = (userData?.xpToNextLevel || 1000) > 0
        ? Math.min((userData?.currentXP || 0) / (userData?.xpToNextLevel || 1000), 1) * 100
        : 0;

    if (!userData) return null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={async () => {
                            setIsRefreshing(true);
                            try { if (refreshUser) await refreshUser(); } catch (e) {}
                            setTimeout(() => setIsRefreshing(false), 800);
                        }}
                        tintColor="#CCFF00"
                        colors={['#CCFF00']}
                        progressBackgroundColor="#1C1C1E"
                    />
                }
            >
                {/* ── HEADER ── */}
                <LinearGradient colors={['#1A1A1A', '#080808']} style={styles.header}>
                    <SafeAreaView edges={['top']}>

                        {/* Top bar: close left · coins + actions right */}
                        <View style={styles.headerTop}>
                            {navigation.canGoBack() ? (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={styles.closeBtn}
                                    onPress={() => { lightTap(); navigation.goBack(); }}
                                >
                                    <Ionicons name="close" size={16} color="#FFF" />
                                    <Text style={styles.closeBtnText}>Close</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={{ width: 70 }} />
                            )}

                            <View style={styles.headerRight}>
                                {/* Coin balance */}
                                <View style={styles.coinBadgeHeader}>
                                    <View style={styles.coinDot} />
                                    <Text style={styles.coinValueHeader}>{userCoins.toLocaleString()}</Text>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => { lightTap(); navigation.navigate('Rewards'); }}
                                    >
                                        <Ionicons name="add-circle" size={18} color={COLORS.accent} />
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity activeOpacity={0.7} onPress={handleShareProfile} style={styles.headerIconBtn}>
                                    <Ionicons name="share-outline" size={20} color="#FFF" />
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.navigate('Settings'); }} style={styles.headerIconBtn}>
                                    <Ionicons name="ellipsis-vertical" size={20} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Avatar + Identity */}
                        <View style={styles.profileInfo}>
                            <View style={styles.avatarWrapper}>
                                <UserAvatar
                                    uri={userData.avatar}
                                    name={userData.name}
                                    size={100}
                                    borderColor={COLORS.accent}
                                    borderWidth={2.5}
                                />
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={styles.editIconBadge}
                                    onPress={() => { lightTap(); setEditName(userData.name); setEditModalVisible(true); }}
                                >
                                    <Ionicons name="pencil" size={13} color="#000" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.userName}>{userData.name} {getFlag(userData.location?.country)}</Text>
                            {userData.username ? (
                                <Text style={styles.userHandle}>@{userData.username}</Text>
                            ) : null}
                            <Text style={styles.userLevel}>Level {userData.level || 1} • {getLevelTitle(userData.level || 1)}</Text>

                            {/* Social row */}
                            <View style={styles.socialRow}>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => { lightTap(); navigation.navigate('UserList', { title: 'Followers', userIds: userData.followers }); }}
                                >
                                    <Text style={styles.socialText}><Text style={styles.socialNum}>{followersCount}</Text> Followers</Text>
                                </TouchableOpacity>
                                <View style={styles.socialDivider} />
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => { lightTap(); navigation.navigate('UserList', { title: 'Following', userIds: userData.following }); }}
                                >
                                    <Text style={styles.socialText}><Text style={styles.socialNum}>{followingCount}</Text> Following</Text>
                                </TouchableOpacity>
                                <View style={styles.socialDivider} />
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => { lightTap(); navigation.navigate('FindFriends'); }}
                                >
                                    <Text style={styles.socialText}><Text style={[styles.socialNum, { color: COLORS.accent }]}>+</Text> Add</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* ── STAT PILLS ── */}
                        <View style={styles.statsPillsRow}>
                            <View style={styles.statPill}>
                                <View style={styles.statPillIcon}>
                                    <MaterialCommunityIcons name="run-fast" size={15} color="#000" />
                                </View>
                                <Text style={styles.statPillValue}>{totalRuns}</Text>
                                <Text style={styles.statPillLabel}>Runs</Text>
                            </View>
                            <View style={styles.statPill}>
                                <View style={styles.statPillIcon}>
                                    <Ionicons name="map-outline" size={15} color="#000" />
                                </View>
                                <Text style={styles.statPillValue}>
                                    {formatDistance(totalKm, userData?.unitSystem, 1).split(' ')[0]}
                                </Text>
                                <Text style={styles.statPillLabel}>{userData?.unitSystem === 'imperial' ? 'Miles' : 'Km'}</Text>
                            </View>
                            <View style={styles.statPill}>
                                <View style={styles.statPillIcon}>
                                    <Ionicons name="speedometer-outline" size={15} color="#000" />
                                </View>
                                <Text style={styles.statPillValue}>{formatPace(avgPace, userData?.unitSystem)}</Text>
                                <Text style={styles.statPillLabel}>Avg Pace</Text>
                            </View>
                        </View>

                        {/* ── WEEKLY STRIP ── */}
                        <View style={styles.weekStrip}>
                            {weekDays.map((day, i) => (
                                <View key={i} style={styles.weekDayCol}>
                                    <Text style={styles.weekDayLabel}>{day.label}</Text>
                                    <View style={[styles.weekDayCircle, day.isToday && styles.weekDayCircleActive]}>
                                        <Text style={[styles.weekDayDate, day.isToday && styles.weekDayDateActive]}>
                                            {day.date}
                                        </Text>
                                    </View>
                                    <View style={[styles.weekDayDot, day.hasRun && styles.weekDayDotActive]} />
                                </View>
                            ))}
                        </View>

                        {/* ── XP BAR ── */}
                        <View style={styles.levelContainer}>
                            <View style={styles.levelRow}>
                                <Text style={styles.levelLabel}>XP Progress</Text>
                                <Text style={styles.levelValue}>{userData.currentXP} / {userData.xpToNextLevel}</Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${xpPercentage}%` }]} />
                            </View>
                        </View>

                    </SafeAreaView>
                </LinearGradient>

                {/* ── MENU ROWS ── */}
                <View style={{ height: 12 }} />

                <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.menuRow}
                    onPress={() => { lightTap(); navigation.navigate('Gear'); }}
                >
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIconBox}>
                            <MaterialCommunityIcons name="shoe-sneaker" size={20} color={COLORS.accent} />
                        </View>
                        <Text style={styles.menuText}>My Gear Tracker</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#555" />
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.menuRow}
                    onPress={() => { lightTap(); setSelectedCountry(userData?.location?.country || 'Earth'); setShowCountryPicker(true); }}
                >
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIconBox}>
                            <Ionicons name="flag-outline" size={20} color={COLORS.accent} />
                        </View>
                        <View>
                            <Text style={styles.menuText}>Country</Text>
                            <Text style={styles.menuSubtext}>{getFlag(userData?.location?.country)} {userData?.location?.country || 'Not set'}</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#555" />
                </TouchableOpacity>

                {/* ── TAB CONTENT ── */}
                <View style={styles.contentPadding}>

                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            style={[styles.tabBtn, activeTab === 'Activity' && styles.tabBtnActive]}
                            onPress={() => { lightTap(); setActiveTab('Activity'); }}
                        >
                            <Text style={[styles.tabText, activeTab === 'Activity' && styles.tabTextActive]}>Activity</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            style={[styles.tabBtn, activeTab === 'Library' && styles.tabBtnActive]}
                            onPress={() => { lightTap(); setActiveTab('Library'); }}
                        >
                            <Text style={[styles.tabText, activeTab === 'Library' && styles.tabTextActive]}>Saved Library</Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'Activity' ? (
                        <>
                            {/* ── STREAK CARD (additive, from real runHistory) ── */}
                            {currentStreak > 0 && (
                                <View style={styles.streakCard}>
                                    <View style={styles.streakLeft}>
                                        <Text style={styles.streakTitle}>Keep it up!</Text>
                                        <Text style={styles.streakSub}>
                                            {currentStreak} day{currentStreak !== 1 ? 's' : ''} in a row — you're on fire 🔥
                                        </Text>
                                        <View style={styles.streakDots}>
                                            {Array.from({ length: Math.min(currentStreak, 7) }).map((_, i) => (
                                                <View key={i} style={styles.streakDot} />
                                            ))}
                                        </View>
                                    </View>
                                    <View style={styles.streakTrophyBg}>
                                        <Ionicons name="trophy" size={42} color={COLORS.accent} />
                                    </View>
                                </View>
                            )}

                            {/* ── ACTIVE CHALLENGES ── */}
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Active Challenges</Text>
                            </View>

                            {myActiveChallenges.length > 0 ? (
                                myActiveChallenges.map(challenge => (
                                    <View key={challenge.id} style={styles.activeChallengeCard}>
                                        <View style={styles.acHeader}>
                                            <Text style={styles.acTitle}>{challenge.title}</Text>
                                            <Text style={styles.acDays}>{challenge.daysLeft} days left</Text>
                                        </View>
                                        <View style={styles.acProgressRow}>
                                            <Text style={styles.acProgressText}>{challenge.progress} / {challenge.target} {challenge.unit}</Text>
                                            <Text style={styles.acPercentText}>{Math.round(challenge.percent)}%</Text>
                                        </View>
                                        <View style={styles.acProgressBarBg}>
                                            <View style={[styles.acProgressBarFill, { width: `${challenge.percent}%` }]} />
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={styles.emptyChallenges}
                                    onPress={() => { lightTap(); navigation.navigate('Community'); }}
                                >
                                    <Ionicons name="trophy-outline" size={24} color="#555" />
                                    <Text style={styles.emptyChallengesText}>No active challenges.</Text>
                                    <Text style={styles.joinNowText}>Join one in Community Tab</Text>
                                </TouchableOpacity>
                            )}

                            {/* ── ACHIEVEMENTS ── */}
                            <View style={[styles.sectionHeaderRow, { marginTop: 25 }]}>
                                <Text style={styles.sectionTitle}>Achievements</Text>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
                                {BADGES.map((badge) => {
                                    const isUnlocked = userData.badges && userData.badges.some(b => {
                                        if (b.id && badge.id && b.id === badge.id) return true;
                                        if (b.name && badge.name && b.name === badge.name) return true;
                                        return false;
                                    });
                                    return (
                                        <View key={badge.id} style={[styles.badgeItem, !isUnlocked && { opacity: 0.3 }]}>
                                            <View style={[styles.badgeIcon, { backgroundColor: isUnlocked ? badge.color : '#333' }]}>
                                                <Ionicons name={isUnlocked ? badge.icon : 'lock-closed'} size={24} color={isUnlocked ? "#000" : "#666"} />
                                            </View>
                                            <Text style={[styles.badgeText, !isUnlocked && { color: '#666' }]}>{badge.name}</Text>
                                            <Text style={styles.badgeSub}>{badge.description}</Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            {/* ── RECENT ACTIVITY ── */}
                            <View style={[styles.sectionHeaderRow, { marginTop: 25 }]}>
                                <Text style={styles.sectionTitle}>Recent Activity</Text>
                                <View style={styles.filterContainer}>
                                    {['All', 'Week'].map((f) => (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            key={f}
                                            style={[styles.filterPill, filter === f && styles.filterPillActive]}
                                            onPress={() => { lightTap(); setFilter(f); }}
                                        >
                                            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {filteredData.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <MaterialCommunityIcons name="run-fast" size={40} color="#333" />
                                    <Text style={styles.emptyText}>No runs found for this period.</Text>
                                </View>
                            ) : (
                                filteredData.map((run, index) => (
                                    <TouchableOpacity
                                        key={run.id || index}
                                        style={styles.activityCard}
                                        activeOpacity={0.75}
                                        onPress={() => { lightTap(); navigation.navigate('RunDetail', { run }); }}
                                    >
                                        <View style={styles.activityIcon}>
                                            <MaterialCommunityIcons name="run" size={22} color="#000" />
                                        </View>
                                        <View style={styles.activityInfo}>
                                            <Text style={styles.activityTitle}>{run.title || 'Run Workout'}</Text>
                                            <Text style={styles.activityDate}>{new Date(run.date).toLocaleDateString()} • {run.duration}</Text>
                                        </View>
                                        <View style={styles.activityStats}>
                                            <Text style={styles.activityDistance}>{formatDistance(run.distance, userData?.unitSystem)}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                <Ionicons name="flash" size={10} color={COLORS.accent} style={{ marginRight: 2 }} />
                                                <Text style={styles.activityCals}>{Math.floor(run.calories || 0)} kcal</Text>
                                            </View>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#444" />
                                    </TouchableOpacity>
                                ))
                            )}
                        </>
                    ) : (
                        <View style={{ marginTop: 10 }}>
                            {savedTips.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="bookmark-outline" size={40} color="#333" />
                                    <Text style={styles.emptyText}>No saved tips yet.</Text>
                                    <Text style={{ color: '#555', fontSize: 12, marginTop: 5 }}>Bookmark tips from the Home screen.</Text>
                                </View>
                            ) : (
                                savedTips.map((tip, index) => (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        key={index}
                                        style={styles.savedTipCard}
                                        onPress={() => { lightTap(); navigation.navigate('TipDetail', { tip }); }}
                                    >
                                        <Image source={{ uri: tip.img }} style={styles.savedTipImage} />
                                        <View style={styles.savedTipContent}>
                                            <Text style={styles.savedTipTitle}>{tip.title}</Text>
                                            <Text style={styles.savedTipDesc} numberOfLines={2}>{tip.desc}</Text>
                                            <Text style={styles.readMoreText}>READ NOW</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    )}

                </View>
            </ScrollView>

            {/* ── EDIT PROFILE MODAL ── */}
            <Modal visible={isEditModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setEditModalVisible(false); }}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: '#888', marginBottom: 10, marginLeft: 5 }}>Display Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editName}
                            onChangeText={setEditName}
                            placeholderTextColor="#666"
                            placeholder="Enter your name"
                        />
                        <TouchableOpacity activeOpacity={0.7} style={styles.saveBtn} onPress={handleSaveProfile} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── COUNTRY PICKER MODAL ── */}
            <Modal visible={showCountryPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => { lightTap(); setShowCountryPicker(false); }} />
                    <View style={[styles.countryPickerSheet, { height: Dimensions.get('screen').height * 0.7, maxHeight: undefined }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Country</Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowCountryPicker(false); }}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search country..."
                                placeholderTextColor="#666"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                            />
                        </View>
                        <ScrollView style={styles.countryList} keyboardShouldPersistTaps="handled">
                            {COUNTRIES
                                .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map((c) => (
                                    <TouchableOpacity
                                        key={c.code}
                                        style={[styles.countryItem, selectedCountry === c.name && styles.countryItemSelected]}
                                        onPress={async () => {
                                            lightTap();
                                            const prevCountry = selectedCountry;
                                            setSelectedCountry(c.name);
                                            setShowCountryPicker(false);
                                            setSearchQuery("");
                                            try {
                                                await updateUserProfile({ location: { ...userData.location, country: c.name } });
                                                successFeedback();
                                            } catch (error) {
                                                setSelectedCountry(prevCountry);
                                                errorFeedback();
                                                Alert.alert("Error", "Could not save your country selection. Please check your connection.");
                                            }
                                        }}
                                    >
                                        <Text style={styles.countryFlag}>{getFlag(c.name)}</Text>
                                        <Text style={[styles.countryName, selectedCountry === c.name && styles.countryNameSelected]}>{c.name}</Text>
                                        {selectedCountry === c.name && <Ionicons name="checkmark" size={20} color={COLORS.accent} />}
                                    </TouchableOpacity>
                                ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <FloatingNavBar current="Profile" />
        </View>
    );
}

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
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    closeBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_500Medium' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    coinBadgeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(204,255,0,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.25)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    coinDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
    },
    coinValueHeader: {
        color: COLORS.accent,
        fontSize: 13,
        fontFamily: 'Poppins_700Bold',
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── AVATAR + IDENTITY ──
    profileInfo: { alignItems: 'center', marginTop: 18 },
    avatarWrapper: { position: 'relative', marginBottom: 14 },
    editIconBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: COLORS.accent,
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#000',
    },
    userName: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold' },
    userHandle: { color: '#666', fontSize: 13, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    userLevel: { color: '#888', fontSize: 13, fontFamily: 'Poppins_500Medium', marginTop: 4 },
    socialRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
    socialText: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular' },
    socialNum: { color: '#FFF', fontFamily: 'Poppins_700Bold' },
    socialDivider: { width: 1, height: 12, backgroundColor: '#333' },

    // ── STAT PILLS ──
    statsPillsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginTop: 24,
        paddingHorizontal: 20,
    },
    statPill: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        gap: 4,
    },
    statPillIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    statPillValue: {
        color: '#FFF',
        fontSize: 17,
        fontFamily: 'Poppins_700Bold',
        lineHeight: 20,
    },
    statPillLabel: {
        color: '#666',
        fontSize: 10,
        fontFamily: 'Poppins_500Medium',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // ── WEEKLY STRIP ──
    weekStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 22,
        marginHorizontal: 20,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#222',
        paddingVertical: 14,
        paddingHorizontal: 10,
    },
    weekDayCol: { alignItems: 'center', flex: 1, gap: 6 },
    weekDayLabel: { color: '#555', fontSize: 10, fontFamily: 'Poppins_500Medium' },
    weekDayCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    weekDayCircleActive: {
        backgroundColor: COLORS.accent,
    },
    weekDayDate: { color: '#888', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    weekDayDateActive: { color: '#000' },
    weekDayDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'transparent',
    },
    weekDayDotActive: { backgroundColor: COLORS.accent },

    // ── XP BAR ──
    levelContainer: { marginTop: 20, paddingHorizontal: 24 },
    levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    levelLabel: { color: '#888', fontSize: 12, fontFamily: 'Poppins_500Medium' },
    levelValue: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    progressBarBg: { height: 5, backgroundColor: '#222', borderRadius: 3 },
    progressBarFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },

    // ── MENU ROWS ──
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#111',
        marginHorizontal: 16,
        marginTop: 10,
        padding: 15,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#222',
    },
    menuLeft: { flexDirection: 'row', alignItems: 'center' },
    menuIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(204,255,0,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    menuText: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
    menuSubtext: { color: '#666', fontSize: 12, marginTop: 1 },

    // ── TAB ──
    contentPadding: { padding: 16 },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#111',
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
        borderColor: '#222',
    },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
    tabBtnActive: { backgroundColor: '#2A2A2A' },
    tabText: { color: '#555', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    tabTextActive: { color: '#FFF' },

    // ── STREAK CARD ──
    streakCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.2)',
        borderLeftWidth: 3,
        borderLeftColor: COLORS.accent,
        padding: 18,
        marginBottom: 20,
    },
    streakLeft: { flex: 1 },
    streakTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    streakSub: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 4, lineHeight: 18 },
    streakDots: { flexDirection: 'row', gap: 5, marginTop: 10 },
    streakDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.accent,
    },
    streakTrophyBg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(204,255,0,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },

    // ── SECTION HEADERS ──
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        marginTop: 6,
    },
    sectionTitle: { color: '#FFF', fontSize: 17, fontFamily: 'Poppins_700Bold' },

    // ── ACTIVE CHALLENGES ──
    activeChallengeCard: {
        backgroundColor: '#111',
        padding: 16,
        borderRadius: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#222',
        borderLeftWidth: 3,
        borderLeftColor: COLORS.accent,
    },
    acHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    acTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    acDays: { color: '#666', fontSize: 12 },
    acProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    acProgressText: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_700Bold' },
    acPercentText: { color: '#888', fontSize: 12 },
    acProgressBarBg: { height: 5, backgroundColor: '#222', borderRadius: 3 },
    acProgressBarFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },

    emptyChallenges: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#111',
        borderRadius: 18,
        marginBottom: 20,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#333',
    },
    emptyChallengesText: { color: '#666', marginTop: 10, fontSize: 14 },
    joinNowText: { color: COLORS.accent, fontFamily: 'Poppins_600SemiBold', marginTop: 6, fontSize: 13 },

    // ── BADGES ──
    badgesScroll: { marginBottom: 10 },
    badgeItem: { alignItems: 'center', marginRight: 16, width: 90 },
    badgeIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    badgeText: { color: '#FFF', fontSize: 11, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },
    badgeSub: { color: '#555', fontSize: 9, textAlign: 'center', marginTop: 2 },

    // ── FILTER ──
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 2,
        borderWidth: 1,
        borderColor: '#222',
    },
    filterPill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 16 },
    filterPillActive: { backgroundColor: '#2A2A2A' },
    filterText: { color: '#555', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    filterTextActive: { color: '#FFF' },

    // ── ACTIVITY CARDS ──
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#222',
    },
    activityIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    activityInfo: { flex: 1 },
    activityTitle: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
    activityDate: { color: '#666', fontSize: 12, marginTop: 2 },
    activityStats: { alignItems: 'flex-end' },
    activityDistance: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold' },
    activityCals: { color: COLORS.accent, fontSize: 11, fontFamily: 'Poppins_500Medium' },

    // ── EMPTY STATE ──
    emptyState: { alignItems: 'center', marginTop: 30, opacity: 0.5 },
    emptyText: { color: '#888', marginTop: 10, fontSize: 14 },

    // ── SAVED TIPS ──
    savedTipCard: {
        flexDirection: 'row',
        backgroundColor: '#111',
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        height: 100,
        borderWidth: 1,
        borderColor: '#222',
    },
    savedTipImage: { width: 100, height: '100%' },
    savedTipContent: { flex: 1, padding: 12, justifyContent: 'space-between' },
    savedTipTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
    savedTipDesc: { color: '#666', fontSize: 11, fontFamily: 'Poppins_400Regular', lineHeight: 16 },
    readMoreText: { color: COLORS.accent, fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },

    // ── MODALS ──
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#111',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: '#222',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    modalTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold' },
    modalInput: {
        backgroundColor: '#1A1A1A',
        color: '#FFF',
        padding: 15,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#333',
        fontSize: 16,
        marginBottom: 20,
    },
    saveBtn: {
        backgroundColor: COLORS.accent,
        padding: 15,
        borderRadius: 30,
        alignItems: 'center',
        marginBottom: 20,
    },
    saveBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    modalBackdrop: { flex: 1 },
    countryPickerSheet: {
        backgroundColor: '#111',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        maxHeight: '70%',
        borderWidth: 1,
        borderColor: '#222',
    },
    countryList: { marginTop: 10 },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
    },
    countryItemSelected: { backgroundColor: '#1A1A1A' },
    countryFlag: { fontSize: 24, marginRight: 14 },
    countryName: { flex: 1, color: '#FFF', fontSize: 15 },
    countryNameSelected: { color: COLORS.accent, fontFamily: 'Poppins_600SemiBold' },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#333',
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Poppins_500Medium',
    },
});
