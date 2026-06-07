import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated, Modal,
    ScrollView, Share, StatusBar, StyleSheet, Text,
    TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { BADGES } from '../constants/badges';
import { useUser } from '../context/UserContext';
import { getFlag } from '../utils/helpers';
import { submitReport } from '../services/reportService';
import { lightTap, successFeedback } from '../utils/haptics';
import UserAvatar from '../components/UserAvatar';

const ACCENT = '#CCFF00';

const getLevelTitle = (level) => {
    if (!level || level < 5)  return 'Rookie';
    if (level < 10) return 'Endurance Athlete';
    if (level < 20) return 'Elite Runner';
    return 'Legend';
};

const computeAvgPace = (runHistory) => {
    if (!runHistory?.length) return '0:00';
    const secs = runHistory.flatMap(r => {
        if (!r.pace) return [];
        const p = r.pace.split(':').map(Number);
        const s = p.length === 2 ? p[0] * 60 + (p[1] || 0) : 0;
        return s > 0 ? [s] : [];
    });
    if (!secs.length) return '0:00';
    const avg = Math.round(secs.reduce((a, b) => a + b, 0) / secs.length);
    return `${Math.floor(avg / 60)}:${String(avg % 60).padStart(2, '0')}`;
};

export default function UserProfileScreen({ route, navigation }) {
    const { userId } = route.params || {};
    const { userData, followUser, unfollowUser, blockUser, unblockUser } = useUser();

    const [showMenu, setShowMenu]       = useState(false);
    const [isLoading, setIsLoading]     = useState(true);
    const [activityFilter, setActivityFilter] = useState('Week');
    const [profileData, setProfileData] = useState(null);

    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(24)).current;

    const isMe      = !userId || userId === 'currentUser' || userId === userData?.uid;
    const isFriend  = !isMe && (userData?.following || []).includes(userId);
    const isBlocked = !isMe && (userData?.blocked || []).includes(userId);

    useEffect(() => {
        const unsub = navigation.addListener('focus', () => loadProfile());
        return unsub;
    }, [navigation, userId]);

    const loadProfile = async () => {
        setIsLoading(true);
        try {
            if (isMe) {
                const rh = userData?.runHistory || [];
                const gl = userData?.gearList || [];
                const totalKm  = rh.reduce((a, r) => a + (parseFloat(r.distance) || 0), 0);
                const gear     = gl.find(g => g.isDefault) || gl[0];
                setProfileData({
                    name:       userData?.name || '',
                    username:   userData?.username || '',
                    avatar:     userData?.avatar,
                    flag:       getFlag(userData?.location?.country),
                    country:    userData?.location?.country || '',
                    level:      userData?.level || 1,
                    currentXP:  userData?.currentXP || 0,
                    xpToNext:   userData?.xpToNextLevel || 1000,
                    bio:        userData?.bio || '',
                    followers:  userData?.followers?.length ?? 0,
                    following:  userData?.following?.length ?? 0,
                    coins:      userData?.coins || 0,
                    distance:   totalKm.toFixed(1),
                    runs:       rh.length,
                    pace:       computeAvgPace(rh),
                    gear:       gear?.name || null,
                    gearDist:   gear?.distance || 0,
                    gearLimit:  gear?.limit || 500,
                    achievements: userData?.badges || [],
                    runHistory: rh,
                });
            } else {
                if (!userId) throw new Error('No userId');
                const snap = await getDoc(doc(db, 'users', userId));
                if (!snap.exists()) {
                    setProfileData({ name: 'User Not Found', notFound: true });
                    return;
                }
                const u = snap.data();
                const rh = u.runHistory || [];
                const gl = u.gearList || [];
                const totalKm = rh.reduce((a, r) => a + (parseFloat(r.distance) || 0), 0);
                const gear    = gl.find(g => g.isDefault) || gl[0];
                setProfileData({
                    name:       u.name || 'Unknown',
                    username:   u.username || '',
                    avatar:     u.avatar,
                    flag:       getFlag(u.location?.country),
                    country:    u.location?.country || '',
                    level:      u.level || 1,
                    currentXP:  u.currentXP || 0,
                    xpToNext:   u.xpToNextLevel || 1000,
                    bio:        u.bio || '',
                    followers:  u.followers?.length ?? 0,
                    following:  u.following?.length ?? 0,
                    distance:   totalKm.toFixed(1),
                    runs:       rh.length,
                    pace:       computeAvgPace(rh),
                    gear:       gear?.name || null,
                    gearDist:   gear?.distance || 0,
                    gearLimit:  gear?.limit || 500,
                    achievements: u.badges || [],
                    runHistory: rh,
                });
            }
        } catch (err) {
            console.error('UserProfileScreen error:', err);
            setProfileData({ name: 'Error loading profile', error: true });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isLoading && profileData) {
            Animated.parallel([
                Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
            ]).start();
        }
    }, [isLoading, profileData]);

    const filteredRuns = (() => {
        const sorted = [...(profileData?.runHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (activityFilter === 'Week') {
            const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
            return sorted.filter(r => new Date(r.date) >= cutoff);
        }
        return sorted.slice(0, 20);
    })();

    const handleMainAction = () => {
        lightTap();
        if (isMe)       { navigation.navigate('EditProfile'); return; }
        if (isBlocked)  { Alert.alert('Unblock?', `Unblock ${profileData?.name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Unblock', onPress: () => unblockUser(userId) }]); return; }
        if (isFriend)   { unfollowUser(userId); }
        else            { followUser(userId); successFeedback(); }
    };

    const handleChat = () => {
        lightTap();
        const routes = navigation.getState().routes;
        const prev   = routes[routes.length - 2];
        if (prev?.name === 'ChatScreen' && prev?.params?.userId === userId) navigation.goBack();
        else navigation.navigate('ChatScreen', { userId });
    };

    const handleMenuOption = async (action) => {
        setShowMenu(false);
        lightTap();
        if (action === 'Block')   { blockUser(userId); navigation.goBack(); }
        if (action === 'Unblock') unblockUser(userId);
        if (action === 'Report')  submitReport({ reporterId: userData?.uid, reporterName: userData?.name, itemId: userId, itemType: 'user', itemLabel: profileData?.name });
        if (action === 'Share')   { try { await Share.share({ message: `Check out ${profileData?.name} on Ruvo!` }); } catch {} }
    };

    const xpPct     = Math.min((profileData?.currentXP || 0) / (profileData?.xpToNext || 1000), 1) * 100;
    const gearPct   = Math.min((profileData?.gearDist || 0) / (profileData?.gearLimit || 500), 1);
    const gearColor = gearPct > 0.9 ? '#FF3B30' : gearPct > 0.7 ? '#FF9500' : ACCENT;

    // ── Loading ──────────────────────────────────────────────────
    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator color={ACCENT} size="large" />
                <Text style={styles.loadingText}>Loading profile…</Text>
            </View>
        );
    }

    // ── Not found / error ────────────────────────────────────────
    if (profileData?.notFound || profileData?.error) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="person-remove-outline" size={48} color="#333" />
                    <Text style={[styles.loadingText, { marginTop: 16 }]}>{profileData.name}</Text>
                    <TouchableOpacity style={styles.backBtnInline} onPress={() => navigation.goBack()}>
                        <Text style={styles.backBtnText}>Go Back</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* ── HEADER ── */}
            <LinearGradient colors={['#1A1A1A', '#000']} style={styles.gradientHeader}>
                <SafeAreaView edges={['top']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }}>
                            <Ionicons name="arrow-back" size={20} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {profileData?.name || 'Profile'}
                        </Text>
                        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={() => { lightTap(); setShowMenu(true); }}>
                            <Ionicons name="ellipsis-horizontal" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

                    {/* ── HERO ── */}
                    <View style={styles.heroSection}>
                        {/* Avatar */}
                        <View style={styles.avatarWrapper}>
                            <LinearGradient
                                colors={[ACCENT, '#88BB00']}
                                style={styles.avatarRing}
                            />
                            <UserAvatar
                                uri={profileData.avatar}
                                name={profileData.name}
                                size={96}
                                borderColor="transparent"
                                borderWidth={0}
                            />
                            {/* Level badge */}
                            <View style={styles.levelBadge}>
                                <Text style={styles.levelBadgeText}>Lvl {profileData.level}</Text>
                            </View>
                        </View>

                        {/* Name + flag */}
                        <View style={styles.nameRow}>
                            <Text style={styles.userName}>{profileData.name}</Text>
                            {profileData.flag && profileData.flag !== '🌍' && (
                                <Text style={styles.flagEmoji}>{profileData.flag}</Text>
                            )}
                        </View>

                        {/* Username */}
                        {!!profileData.username && (
                            <Text style={styles.userHandle}>@{profileData.username}</Text>
                        )}

                        {/* Country */}
                        {!!profileData.country && (
                            <View style={styles.locationRow}>
                                <Ionicons name="location-outline" size={12} color="#555" />
                                <Text style={styles.locationText}>{profileData.country}</Text>
                            </View>
                        )}

                        {/* Level title */}
                        <View style={styles.levelTitlePill}>
                            <Ionicons name="medal" size={11} color={ACCENT} style={{ marginRight: 4 }} />
                            <Text style={styles.levelTitleText}>
                                Level {profileData.level} · {getLevelTitle(profileData.level)}
                            </Text>
                        </View>

                        {/* Bio */}
                        {!!profileData.bio && (
                            <Text style={styles.bio}>{profileData.bio}</Text>
                        )}

                        {/* Followers row */}
                        <View style={styles.socialRow}>
                            <View style={styles.socialItem}>
                                <Text style={styles.socialNum}>{profileData.followers}</Text>
                                <Text style={styles.socialLabel}>Followers</Text>
                            </View>
                            <View style={styles.socialDivider} />
                            <View style={styles.socialItem}>
                                <Text style={styles.socialNum}>{profileData.following}</Text>
                                <Text style={styles.socialLabel}>Following</Text>
                            </View>
                            <View style={styles.socialDivider} />
                            <View style={styles.socialItem}>
                                <Text style={styles.socialNum}>{profileData.runs}</Text>
                                <Text style={styles.socialLabel}>Runs</Text>
                            </View>
                        </View>

                        {/* Action buttons */}
                        {!isMe && (
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.followBtn,
                                        isFriend  && styles.followBtnActive,
                                        isBlocked && styles.followBtnBlocked,
                                    ]}
                                    activeOpacity={0.85}
                                    onPress={handleMainAction}
                                >
                                    <Ionicons
                                        name={isBlocked ? 'ban-outline' : isFriend ? 'checkmark' : 'person-add-outline'}
                                        size={15}
                                        color={isFriend || isBlocked ? '#FFF' : '#000'}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[styles.followBtnText, (isFriend || isBlocked) && { color: '#FFF' }]}>
                                        {isBlocked ? 'Blocked' : isFriend ? 'Following' : 'Follow'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.msgBtn} activeOpacity={0.8} onPress={handleChat}>
                                    <Ionicons name="chatbubble-outline" size={18} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        )}
                        {isMe && (
                            <TouchableOpacity style={styles.editBtn} activeOpacity={0.8} onPress={() => { lightTap(); navigation.navigate('EditProfile'); }}>
                                <Ionicons name="pencil-outline" size={14} color="#FFF" style={{ marginRight: 6 }} />
                                <Text style={styles.editBtnText}>Edit Profile</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ── XP BAR ── */}
                    <View style={styles.xpCard}>
                        <View style={styles.xpLabelRow}>
                            <Text style={styles.xpLabel}>Level {profileData.level} Progress</Text>
                            <Text style={styles.xpValue}>{profileData.currentXP} / {profileData.xpToNext} XP</Text>
                        </View>
                        <View style={styles.xpBarBg}>
                            <LinearGradient
                                colors={['#88BB00', ACCENT]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.xpBarFill, { width: `${xpPct}%` }]}
                            />
                        </View>
                    </View>

                    {/* ── STATS ── */}
                    <View style={styles.statsRow}>
                        <View style={styles.statsCard}>
                            <MaterialCommunityIcons name="run-fast" size={18} color={ACCENT} style={{ marginBottom: 6 }} />
                            <Text style={styles.statsCardValue}>{profileData.distance}</Text>
                            <Text style={styles.statsCardLabel}>KM TOTAL</Text>
                        </View>
                        <View style={styles.statsCard}>
                            <Ionicons name="timer-outline" size={18} color="#60A5FA" style={{ marginBottom: 6 }} />
                            <Text style={styles.statsCardValue}>{profileData.pace}</Text>
                            <Text style={styles.statsCardLabel}>AVG PACE</Text>
                        </View>
                        <View style={styles.statsCard}>
                            <MaterialCommunityIcons name="shoe-sneaker" size={18} color="#FF9500" style={{ marginBottom: 6 }} />
                            <Text style={styles.statsCardValue}>{profileData.runs}</Text>
                            <Text style={styles.statsCardLabel}>TOTAL RUNS</Text>
                        </View>
                    </View>

                    {/* ── ACHIEVEMENTS ── */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Achievements</Text>
                        {profileData.achievements?.length > 0 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingVertical: 6, paddingRight: 4 }}
                            >
                                {profileData.achievements.map((badge, i) => {
                                    // Look up badge definition for the correct color and icon
                                    const def = BADGES.find(b => b.id === badge.id || b.name === badge.name);
                                    const color = def?.color || badge.color || ACCENT;
                                    const icon  = def?.icon  || badge.icon  || 'medal';
                                    return (
                                        <View key={i} style={styles.badgeItem}>
                                            <LinearGradient
                                                colors={[color, color + 'AA']}
                                                style={styles.badgeIconWrap}
                                            >
                                                <Ionicons name={icon} size={22} color="#000" />
                                            </LinearGradient>
                                            <Text style={styles.badgeName} numberOfLines={1}>{badge.name || def?.name}</Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        ) : (
                            <View style={styles.emptyBadges}>
                                <Ionicons name="ribbon-outline" size={28} color="#252525" />
                                <Text style={styles.emptyText}>No achievements yet</Text>
                            </View>
                        )}
                    </View>

                    {/* ── GEAR ── */}
                    {profileData.gear && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Active Gear</Text>
                            <View style={styles.gearCard}>
                                <View style={[styles.gearIconBox, { borderColor: gearColor + '40', backgroundColor: gearColor + '12' }]}>
                                    <MaterialCommunityIcons name="shoe-sneaker" size={20} color={gearColor} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.gearTopRow}>
                                        <Text style={styles.gearName} numberOfLines={1}>{profileData.gear}</Text>
                                        <Text style={[styles.gearPct, { color: gearColor }]}>
                                            {Math.round(gearPct * 100)}%
                                        </Text>
                                    </View>
                                    <View style={styles.gearBarBg}>
                                        <LinearGradient
                                            colors={gearPct > 0.9 ? ['#FF3B30', '#FF6B6B'] : gearPct > 0.7 ? ['#FF9500', '#FFCC00'] : ['#88BB00', ACCENT]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={[styles.gearBarFill, { width: `${gearPct * 100}%` }]}
                                        />
                                    </View>
                                    <Text style={styles.gearSubText}>
                                        {Math.floor(profileData.gearDist)} / {profileData.gearLimit} km
                                        <Text style={{ color: '#2A2A2A' }}> · {Math.max(0, profileData.gearLimit - Math.floor(profileData.gearDist))} km left</Text>
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ── RECENT ACTIVITY ── */}
                    <View style={[styles.section, { paddingBottom: 20 }]}>
                        <View style={styles.activityHeaderRow}>
                            <Text style={styles.sectionTitle}>Recent Activity</Text>
                            <View style={styles.filterPills}>
                                {['Week', 'All'].map(f => (
                                    <TouchableOpacity
                                        key={f}
                                        style={[styles.filterPill, activityFilter === f && styles.filterPillActive]}
                                        onPress={() => { lightTap(); setActivityFilter(f); }}
                                    >
                                        <Text style={[styles.filterPillText, activityFilter === f && styles.filterPillTextActive]}>
                                            {f}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {filteredRuns.length > 0 ? (
                            filteredRuns.map((run, idx) => {
                                const runDate = run.date ? new Date(run.date) : null;
                                const dateLabel = runDate
                                    ? runDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                    : '';
                                const timeLabel = runDate
                                    ? runDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                    : '';
                                return (
                                    <View key={run.id || idx} style={styles.runCard}>
                                        {/* Left accent */}
                                        <View style={styles.runCardAccent} />

                                        {/* Icon */}
                                        <View style={styles.runIconWrap}>
                                            <MaterialCommunityIcons
                                                name={run.activityType === 'Walk' ? 'walk' : run.activityType === 'Hike' ? 'hiking' : 'run-fast'}
                                                size={18}
                                                color="#444"
                                            />
                                        </View>

                                        {/* Info */}
                                        <View style={styles.runInfo}>
                                            <Text style={styles.runTitle} numberOfLines={1}>
                                                {run.title || (run.activityType || 'Run') + ' Workout'}
                                            </Text>
                                            <Text style={styles.runDate}>
                                                {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
                                            </Text>
                                            <View style={styles.runPillRow}>
                                                {run.duration && (
                                                    <View style={styles.runPill}>
                                                        <Ionicons name="time-outline" size={9} color="#555" />
                                                        <Text style={styles.runPillText}>{run.duration || run.time}</Text>
                                                    </View>
                                                )}
                                                {run.pace && run.pace !== '--' && (
                                                    <View style={styles.runPill}>
                                                        <Ionicons name="speedometer-outline" size={9} color="#555" />
                                                        <Text style={styles.runPillText}>{run.pace}/km</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        {/* Distance */}
                                        <Text style={styles.runDist}>
                                            {parseFloat(run.distance || 0).toFixed(2)}{'\n'}
                                            <Text style={styles.runDistUnit}>km</Text>
                                        </Text>
                                    </View>
                                );
                            })
                        ) : (
                            <View style={styles.emptyActivity}>
                                <MaterialCommunityIcons name="run" size={32} color="#1E1E1E" />
                                <Text style={styles.emptyText}>No runs this week</Text>
                                {activityFilter === 'Week' && (
                                    <TouchableOpacity onPress={() => setActivityFilter('All')}>
                                        <Text style={styles.emptyLink}>View all time →</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>

                </Animated.View>
            </ScrollView>

            {/* ── CONTEXT MENU MODAL ── */}
            <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
                <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => { lightTap(); setShowMenu(false); }}>
                    <View style={styles.menuSheet}>
                        <View style={styles.menuHandle} />
                        <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuOption('Share')}>
                            <Ionicons name="share-outline" size={18} color="#FFF" />
                            <Text style={styles.menuRowText}>Share Profile</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuOption('Report')}>
                            <Ionicons name="flag-outline" size={18} color="#FF9500" />
                            <Text style={[styles.menuRowText, { color: '#FF9500' }]}>Report User</Text>
                        </TouchableOpacity>
                        {!isMe && !isBlocked && (
                            <>
                                <View style={styles.menuDivider} />
                                <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuOption('Block')}>
                                    <Ionicons name="ban-outline" size={18} color="#FF3B30" />
                                    <Text style={[styles.menuRowText, { color: '#FF3B30' }]}>Block User</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        {!isMe && isBlocked && (
                            <>
                                <View style={styles.menuDivider} />
                                <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuOption('Unblock')}>
                                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                                    <Text style={styles.menuRowText}>Unblock User</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        <TouchableOpacity style={styles.menuCancelBtn} onPress={() => { lightTap(); setShowMenu(false); }}>
                            <Text style={styles.menuCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loadingText: { color: '#555', fontFamily: 'Poppins_400Regular', fontSize: 13, marginTop: 14 },

    // Gradient header
    gradientHeader: { paddingBottom: 12 },
    headerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4,
    },
    headerBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.07)',
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', flex: 1, textAlign: 'center', marginHorizontal: 8 },

    scrollContent: { paddingBottom: 60 },

    // Hero
    heroSection: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 20, paddingBottom: 28 },
    avatarWrapper: { position: 'relative', marginBottom: 16 },
    avatarRing: {
        position: 'absolute',
        width: 108, height: 108, borderRadius: 54,
        top: -4, left: -4,
    },
    levelBadge: {
        position: 'absolute', bottom: 0, right: -4,
        backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
        borderWidth: 2, borderColor: '#000',
    },
    levelBadgeText: { color: '#000', fontSize: 9, fontFamily: 'Poppins_800ExtraBold' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    userName: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold' },
    flagEmoji: { fontSize: 24 },
    userHandle: { color: '#555', fontSize: 13, fontFamily: 'Poppins_400Regular', marginBottom: 6 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
    locationText: { color: '#555', fontSize: 12, fontFamily: 'Poppins_400Regular' },
    levelTitlePill: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(204,255,0,0.08)', borderWidth: 1, borderColor: 'rgba(204,255,0,0.18)',
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12,
    },
    levelTitleText: { color: '#AAD400', fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    bio: { color: '#666', fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center', lineHeight: 20, marginBottom: 16, paddingHorizontal: 12 },
    socialRow: { flexDirection: 'row', alignItems: 'center', gap: 0, marginBottom: 20 },
    socialItem: { alignItems: 'center', paddingHorizontal: 24 },
    socialNum: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    socialLabel: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    socialDivider: { width: 1, height: 28, backgroundColor: '#1E1E1E' },

    // Action buttons
    actionRow: { flexDirection: 'row', gap: 10 },
    followBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: ACCENT, paddingHorizontal: 28, paddingVertical: 11,
        borderRadius: 28, minWidth: 130, justifyContent: 'center',
    },
    followBtnActive:  { backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2A2A2A' },
    followBtnBlocked: { backgroundColor: '#1A0000', borderWidth: 1, borderColor: '#FF3B3030' },
    followBtnText: { color: '#000', fontSize: 14, fontFamily: 'Poppins_700Bold' },
    msgBtn: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: '#161616', borderWidth: 1, borderColor: '#2A2A2A',
        justifyContent: 'center', alignItems: 'center',
    },
    editBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#161616', borderWidth: 1, borderColor: '#2A2A2A',
        paddingHorizontal: 24, paddingVertical: 11, borderRadius: 28,
    },
    editBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    backBtnInline: { marginTop: 20, backgroundColor: ACCENT, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
    backBtnText: { color: '#000', fontFamily: 'Poppins_700Bold' },

    // XP card
    xpCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#0E0E0E', borderRadius: 18, borderWidth: 1, borderColor: '#1A1A1A', padding: 16 },
    xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    xpLabel: { color: '#555', fontSize: 11, fontFamily: 'Poppins_500Medium' },
    xpValue: { color: ACCENT, fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    xpBarBg: { height: 7, backgroundColor: '#1A1A1A', borderRadius: 4, overflow: 'hidden' },
    xpBarFill: { height: '100%', borderRadius: 4 },

    // Stats row
    statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 10 },
    statsCard: {
        flex: 1, backgroundColor: '#0E0E0E', borderRadius: 18, borderWidth: 1, borderColor: '#1A1A1A',
        alignItems: 'center', paddingVertical: 16,
    },
    statsCardValue: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    statsCardLabel: { color: '#444', fontSize: 8, fontFamily: 'Poppins_600SemiBold', letterSpacing: 0.5, marginTop: 3 },

    // Section
    section: { marginHorizontal: 16, marginBottom: 20 },
    sectionTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', marginBottom: 14 },

    // Achievements
    badgeItem: { alignItems: 'center', marginRight: 18, width: 72 },
    badgeIconWrap: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    badgeName: { color: '#888', fontSize: 10, fontFamily: 'Poppins_500Medium', textAlign: 'center' },
    emptyBadges: { alignItems: 'center', paddingVertical: 20, gap: 8 },

    // Gear
    gearCard: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        backgroundColor: '#0E0E0E', borderRadius: 18, borderWidth: 1, borderColor: '#1A1A1A',
        padding: 16,
    },
    gearIconBox: {
        width: 46, height: 46, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    },
    gearTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    gearName: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold', flex: 1 },
    gearPct: { fontSize: 13, fontFamily: 'Poppins_700Bold' },
    gearBarBg: { height: 6, backgroundColor: '#1A1A1A', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
    gearBarFill: { height: '100%', borderRadius: 3 },
    gearSubText: { color: '#444', fontSize: 11, fontFamily: 'Poppins_400Regular' },

    // Activity
    activityHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    filterPills: { flexDirection: 'row', gap: 6 },
    filterPill: {
        paddingHorizontal: 12, paddingVertical: 5,
        borderRadius: 16, backgroundColor: '#111', borderWidth: 1, borderColor: '#1E1E1E',
    },
    filterPillActive: { backgroundColor: '#1E1E1E', borderColor: ACCENT },
    filterPillText: { color: '#444', fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    filterPillTextActive: { color: '#FFF' },

    runCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#0D0D0D', borderRadius: 18, borderWidth: 1, borderColor: '#1A1A1A',
        paddingVertical: 14, paddingRight: 14, paddingLeft: 0,
        marginBottom: 10, overflow: 'hidden',
    },
    runCardAccent: { width: 3, alignSelf: 'stretch', backgroundColor: '#2A2A2A', borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
    runIconWrap: {
        width: 40, height: 40, borderRadius: 20, marginHorizontal: 10,
        backgroundColor: '#161616', borderWidth: 1, borderColor: '#222',
        justifyContent: 'center', alignItems: 'center',
    },
    runInfo: { flex: 1 },
    runTitle: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold', marginBottom: 2 },
    runDate: { color: '#555', fontSize: 10, fontFamily: 'Poppins_400Regular' },
    runPillRow: { flexDirection: 'row', gap: 5, marginTop: 6, flexWrap: 'wrap' },
    runPill: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: '#161616', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
        borderWidth: 1, borderColor: '#222',
    },
    runPillText: { color: '#555', fontSize: 9, fontFamily: 'Poppins_500Medium' },
    runDist: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_800ExtraBold', textAlign: 'right' },
    runDistUnit: { color: '#444', fontSize: 11, fontFamily: 'Poppins_500Medium' },

    emptyActivity: { alignItems: 'center', paddingVertical: 30, gap: 8 },
    emptyText: { color: '#333', fontSize: 13, fontFamily: 'Poppins_400Regular' },
    emptyLink: { color: ACCENT, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

    // Context menu modal
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    menuSheet: {
        backgroundColor: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingBottom: 36, paddingTop: 12, paddingHorizontal: 16,
        borderTopWidth: 1, borderColor: '#1E1E1E',
    },
    menuHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 20 },
    menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
    menuRowText: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_500Medium' },
    menuDivider: { height: 1, backgroundColor: '#1A1A1A' },
    menuCancelBtn: { marginTop: 12, backgroundColor: '#161616', borderRadius: 16, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
    menuCancelText: { color: '#888', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
});
