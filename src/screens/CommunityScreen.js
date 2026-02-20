import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, doc, increment, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps'; // ✅ NEW: MapView for Discover
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingNavBar from '../components/FloatingNavBar';
import NotificationBell from '../components/NotificationBell';
import NotificationSheet from '../components/NotificationSheet';
import { db } from '../config/firebase';
import { COLORS } from '../constants/legacy-theme.js';
import { useNotifications } from '../context/NotificationContext';
import { useUser } from '../context/UserContext';
import { seedClubs } from '../services/clubService'; // ✅ Added seed service

const { width, height } = Dimensions.get('window');

// --- HELPERS ---
const getCountryFlag = (country) => {
    const flagMap = {
        'Lebanon': '🇱🇧', 'United States': '🇺🇸', 'USA': '🇺🇸', 'United Kingdom': '🇬🇧', 'UK': '🇬🇧',
        'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Canada': '🇨🇦',
        'Australia': '🇦🇺', 'Japan': '🇯🇵', 'China': '🇨🇳', 'India': '🇮🇳', 'Brazil': '🇧🇷',
        'Mexico': '🇲🇽', 'Russia': '🇷🇺', 'South Korea': '🇰🇷', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪',
        'Norway': '🇳🇴', 'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Switzerland': '🇨🇭', 'Belgium': '🇧🇪',
        'Austria': '🇦🇹', 'Poland': '🇵🇱', 'Turkey': '🇹🇷', 'Saudi Arabia': '🇸🇦', 'UAE': '🇦🇪',
        'Egypt': '🇪🇬', 'South Africa': '🇿🇦', 'Argentina': '🇦🇷', 'Chile': '🇨🇱', 'Colombia': '🇨🇴',
        'Portugal': '🇵🇹', 'Greece': '🇬🇷', 'Thailand': '🇹🇭', 'Vietnam': '🇻🇳', 'Philippines': '🇵🇭',
        'Indonesia': '🇮🇩', 'Malaysia': '🇲🇾', 'Singapore': '🇸🇬', 'New Zealand': '🇳🇿', 'Ireland': '🇮🇪',
        'Israel': '🇮🇱', 'Jordan': '🇯🇴', 'Morocco': '🇲🇦', 'Tunisia': '🇹🇳', 'Algeria': '🇩🇿'
    };
    return flagMap[country] || '🌍';
};

// --- HELPERS ---
const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now - past) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const getCurrentWeekRange = () => {
    const today = new Date();
    const diff = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(today.setDate(diff + 6));
    const options = { day: 'numeric', month: 'short' };
    return `${monday.toLocaleDateString('en-GB', options)} - ${sunday.toLocaleDateString('en-GB', options)} ${sunday.getFullYear()}`;
};

const getTodayDate = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const getMonthDate = () => new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const getYearDate = () => new Date().getFullYear().toString();

// --- DYNAMIC CHALLENGE GENERATOR ---
const getMonthlyChallenges = () => {
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();

    const fmtDate = (day) => `${monthName.substring(0, 3)} ${day}`;

    return [
        {
            id: 'c1', // Matches UserContext ID
            title: `The ${monthName} Ultra`,
            // High quality marathon/runner image
            image: 'https://images.unsplash.com/photo-1718248028293-934f04a578db?q=80&w=1286&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
            goal: `Log 100km in ${monthName}`,
            dates: `${monthName} 1 - ${monthName} ${daysInMonth}`,
            participants: 3420,
            xp: 10000,
            coins: 1500,
            type: 'Featured',
            description: `This is the ultimate endurance test for ${monthName}. Prove your consistency by logging 100km total distance this month. Be a legend.`
        },
        {
            id: 'c2',
            title: 'Speed Week',
            // Track / Sprinter image
            image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1200&auto=format&fit=crop',
            goal: 'Run a 5k under 25 mins',
            dates: `${fmtDate(8)} - ${fmtDate(15)}`,
            participants: 850,
            xp: 2500,
            coins: 500,
            type: 'Upcoming',
            description: "Focus on pace. Push your limits and try to set a new 5k Personal Best during the second week of the month."
        },
        {
            id: 'c3',
            title: 'Elevation King',
            // Mountain / Trail runner image
            image: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?q=80&w=1200&auto=format&fit=crop',
            goal: 'Gain 300m elevation',
            dates: `${fmtDate(20)} - ${fmtDate(27)}`,
            participants: 620,
            xp: 3000,
            coins: 750,
            type: 'Upcoming',
            description: "Hills build character (and quads). Find the steepest routes near you and accumulate 300m of vertical gain."
        }
    ];
};

const BADGE_ICONS = {
    'Newcomer': 'star', '5K Club': 'medal', '10K Finisher': 'trophy', '20k Club': 'ribbon', 'Night Owl': 'moon', 'Early Bird': 'sunny', '7 Day Streak': 'flame',
};

const MAP_PLACEHOLDERS = [
    'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?q=80&w=1000&auto=format&fit=crop',
];


const INITIAL_POSTS = [
    { id: 'p1', userId: 'bot1', user: 'Alex Johnson', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', level: 8, time: '2h ago', title: 'Morning 5K', stats: { km: '5.02', pace: '5:12', time: '26:05' }, image: MAP_PLACEHOLDERS[0], likes: 24, comments: 3, badge: '5K Club', isCustomPhoto: false },
    { id: 'p2', userId: 'bot2', user: 'Sarah Wilson', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', level: 5, time: '4h ago', title: 'Trail Run with the squad 🌲', stats: { km: '8.50', pace: '6:30', time: '55:10' }, image: 'https://images.pexels.com/photos/1571939/pexels-photo-1571939.jpeg?auto=compress&cs=tinysrgb&w=600', likes: 56, comments: 12, badge: null, isCustomPhoto: true },
    { id: 'p3', userId: 'lb1', user: 'Ahmad Hassan', avatar: 'https://randomuser.me/api/portraits/men/1.jpg', level: 7, time: 'Yesterday', title: 'Crushing the 10K!', stats: { km: '10.00', pace: '5:45', time: '57:30' }, image: MAP_PLACEHOLDERS[1], likes: 89, comments: 5, badge: '10K Finisher', isCustomPhoto: false },
];


const FeedCard = ({ item, onOpenOptions, onOpenComments, navigation, commentCount }) => {
    const { addNotification } = useNotifications();
    const { user, toggleLike, userData } = useUser();

    // Derived state from Firestore (Real-time)
    const isLiked = item.likedBy?.includes(user?.uid);
    const likeCount = item.likes || 0;

    const handleCheer = async () => {
        // Optimistic UI handled by Firestore listener
        await toggleLike(item.id);

        if (!isLiked) {
            addNotification({
                title: `You cheered ${item.user}!`,
                desc: `You liked their activity: "${item.title}"`,
                type: 'cheer_up'
            });
        }
    };
    const openProfile = () => { if (item.isCurrentUser) navigation.navigate('Profile'); else navigation.navigate('UserProfile', { userId: item.userId || item.id }); };

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <TouchableOpacity onPress={openProfile}><Image source={item.avatar ? { uri: item.avatar } : require('../../assets/icon.png')} style={styles.avatar} /></TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <TouchableOpacity onPress={openProfile}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={styles.userName}>{item.user}</Text>{item.level && <View style={styles.levelBadge}><Text style={styles.levelText}>Lvl {item.level}</Text></View>}</View></TouchableOpacity>
                    <Text style={styles.timeText}>{item.time}</Text>
                </View>
                <TouchableOpacity style={styles.moreBtn} onPress={() => onOpenOptions(item)}><Ionicons name="ellipsis-horizontal" size={20} color="#888" /></TouchableOpacity>
            </View>
            <Text style={styles.activityTitle}>{item.title}</Text>
            {item.description ? (<Text style={{ color: '#CCC', fontFamily: 'Poppins_400Regular', fontSize: 13, marginBottom: 10 }} numberOfLines={2}>{item.description}</Text>) : null}
            {(item.gear || item.activityTag) && (<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>{item.activityTag && item.activityTag !== 'None' && (<View style={{ backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 10 }}><Text style={{ color: '#BBB', fontSize: 10, fontFamily: 'Poppins_600SemiBold', textTransform: 'uppercase' }}>{item.activityTag}</Text></View>)}{item.gear && (<View style={{ flexDirection: 'row', alignItems: 'center' }}><MaterialCommunityIcons name="shoe-sneaker" size={14} color="#666" /><Text style={{ color: '#888', fontSize: 11, marginLeft: 4, fontFamily: 'Poppins_400Regular' }}>{item.gear}</Text></View>)}</View>)}
            {item.badge && (<View style={styles.badgeRow}><Ionicons name={BADGE_ICONS[typeof item.badge === 'string' ? item.badge : item.badge.name] || 'medal'} size={16} color="#000" style={{ marginRight: 6 }} /><Text style={styles.badgeText}>{typeof item.badge === 'string' ? item.badge : item.badge.name}</Text></View>)}
            <View style={styles.statsContainer}><View style={styles.statCol}><Text style={styles.statValue}>{item.stats.km}</Text><Text style={styles.statLabel}>km</Text></View><View style={styles.statCol}><Text style={styles.statValue}>{item.stats.time}</Text><Text style={styles.statLabel}>time</Text></View><View style={styles.statCol}><Text style={styles.statValue}>{item.stats.pace}</Text><Text style={styles.statLabel}>avg pace</Text></View></View>
            <TouchableOpacity activeOpacity={0.9} style={styles.mapContainer} disabled={item.hideMap} onPress={() => Alert.alert('Map View', 'Opening details...')}>{item.hideMap ? (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#222' }}><Ionicons name="eye-off-outline" size={32} color="#555" /><Text style={{ color: '#666', marginTop: 8, fontFamily: 'Poppins_500Medium' }}>Map Hidden by User</Text></View>) : (<View><Image source={{ uri: item.image || MAP_PLACEHOLDERS[2] }} style={styles.mapImage} resizeMode="cover" />{!item.isCustomPhoto && (<View style={styles.mapOverlayIcon}><Ionicons name="map" size={12} color="#FFF" /><Text style={{ color: '#FFF', fontSize: 10, marginLeft: 4, fontWeight: 'bold' }}>MAP</Text></View>)}</View>)}</TouchableOpacity>
            <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleCheer}>
                    <Ionicons name={isLiked ? "flame" : "flame-outline"} size={22} color={isLiked ? "#FF5722" : "#888"} />
                    <Text style={[styles.actionText, isLiked && { color: "#FF5722" }]}>
                        {likeCount > 0 ? likeCount : 'Cheer'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => onOpenComments(item)}>
                    <Ionicons name="chatbubble-outline" size={20} color="#888" />
                    <Text style={styles.actionText}>{commentCount > 0 ? commentCount : 'Comment'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const LeaderboardItem = ({ item, scope, navigation, following, blocked, requests }) => {
    const { followUser, sendFriendRequest, cancelFriendRequest, unfollowUser } = useUser();
    const safeFollowing = following || []; const safeRequests = requests || []; const safeBlocked = blocked || [];
    const isCurrentUser = item.isCurrentUser; const isFriend = safeFollowing.includes(item.id); const isRequested = safeRequests.includes(item.id);
    if (safeBlocked.includes(item.id)) return null;
    const openProfile = () => { if (!isCurrentUser) navigation.navigate('UserProfile', { userId: item.id }); else navigation.navigate('Profile'); };

    const handleAction = () => {
        // 1. If already friends -> Ask to Unfollow
        if (isFriend) {
            Alert.alert("Unfollow", `Stop following ${item.name}?`, [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Unfollow",
                    style: 'destructive',
                    onPress: () => unfollowUser(item.id)
                }
            ]);
            return;
        }

        // 2. If requested -> Cancel Request
        if (isRequested) {
            cancelFriendRequest(item.id);
        }
        // 3. If nothing -> Follow
        else {
            followUser(item.id);
        }
    };

    const displayDist = (item.displayDistance !== undefined && item.displayDistance !== null) ? item.displayDistance : 0;
    let rankBg = '#2C2C2E', rankTextCol = '#FFF';
    if (item.rank === 1) { rankBg = '#FFD700'; rankTextCol = '#000'; } else if (item.rank === 2) { rankBg = '#C0C0C0'; rankTextCol = '#000'; } else if (item.rank === 3) { rankBg = '#CD7F32'; rankTextCol = '#000'; } else if (isCurrentUser) { rankBg = COLORS.accent; rankTextCol = '#000'; }
    return (
        <TouchableOpacity style={isCurrentUser ? styles.currentUserItem : styles.itemContainer} onPress={openProfile} activeOpacity={0.9}><View style={[styles.rankCircle, { backgroundColor: rankBg }]}><Text style={[styles.rankText, { color: rankTextCol }]}>{item.rank}</Text></View><Image source={item.avatar ? { uri: item.avatar } : require('../../assets/icon.png')} style={styles.lbAvatar} /><View style={styles.friendsInfoCol}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={[styles.lbName, isCurrentUser && { color: COLORS.accent }]}>{item.name}</Text>{item.flag && scope !== 'Country' && <Text style={styles.flag}>{item.flag}</Text>}</View><Text style={[styles.friendsDistance, isCurrentUser && { color: COLORS.accent }]}>{displayDist.toLocaleString()} km</Text></View><View style={styles.friendsRightIcon}>{scope === 'Friends' ? (item.rank <= 3 && <FontAwesome5 name={item.rank === 1 ? "trophy" : "medal"} size={18} color={rankBg} />) : (!isCurrentUser && (<TouchableOpacity onPress={handleAction} style={styles.followIconBox}><Ionicons name={isFriend ? "checkmark-circle" : isRequested ? "time-outline" : "person-add-outline"} size={22} color={isFriend ? COLORS.accent : isRequested ? "#888" : "#FFF"} /></TouchableOpacity>))}</View></TouchableOpacity>
    );
};

import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// ✅ NEW: Premium Animated Toggle
const FeedScopeToggle = ({ scope, setScope }) => {
    const translateX = useSharedValue(scope === 'Global' ? 0 : 1);
    const containerWidth = Dimensions.get('window').width - 40; // padding 20 * 2
    const tabWidth = (containerWidth - 8) / 2; // padding 4 * 2

    useEffect(() => {
        translateX.value = withSpring(scope === 'Global' ? 0 : 1, { damping: 15, stiffness: 100 });
    }, [scope]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value * tabWidth }]
        };
    });

    return (
        <View style={{
            height: 48,
            backgroundColor: '#1C1C1E', // Darker gray bg
            borderRadius: 24,
            padding: 4,
            marginHorizontal: 20,
            marginBottom: 20,
            flexDirection: 'row',
            position: 'relative'
        }}>
            {/* Sliding Indicator */}
            <Animated.View style={[{
                position: 'absolute',
                top: 4,
                left: 4,
                width: tabWidth,
                height: 40,
                backgroundColor: COLORS.accent,
                borderRadius: 20,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
                elevation: 5
            }, animatedStyle]} />

            {/* Global Tab */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setScope('Global')}
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="earth" size={16} color={scope === 'Global' ? '#000' : '#888'} style={{ marginRight: 6 }} />
                    <Text style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 14,
                        color: scope === 'Global' ? '#000' : '#888'
                    }}>Global</Text>
                </View>
            </TouchableOpacity>

            {/* Following Tab */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setScope('Following')}
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="people" size={16} color={scope === 'Following' ? '#000' : '#888'} style={{ marginRight: 6 }} />
                    <Text style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 14,
                        color: scope === 'Following' ? '#000' : '#888'
                    }}>Following</Text>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const FilterButton = ({ label, isActive, onPress }) => (<TouchableOpacity style={[styles.filterBtn, isActive ? styles.filterBtnActive : styles.filterBtnInactive]} onPress={onPress}><Text style={[styles.filterText, isActive ? styles.filterTextActive : styles.filterTextInactive]}>{label}</Text></TouchableOpacity>);

export default function CommunityScreen({ navigation }) {
    const { user, userData, unblockUser, clubs, toggleClubMembership, postComments, addPostComment, updateUserProfile, saveRoute } = useUser(); // ✅ Added saveRoute

    const safeUserData = { name: userData?.name || 'User', avatar: userData?.avatar, level: userData?.level || 1, runHistory: Array.isArray(userData?.runHistory) ? userData.runHistory : [], allUsers: Array.isArray(userData?.allUsers) ? userData.allUsers : [], blocked: Array.isArray(userData?.blocked) ? userData.blocked : [], following: Array.isArray(userData?.following) ? userData.following : [], requests: Array.isArray(userData?.requests) ? userData.requests : [], joinedChallenges: Array.isArray(userData?.joinedChallenges) ? userData.joinedChallenges : [] };
    const [activeTab, setActiveTab] = useState('Feed');
    const [feedData, setFeedData] = useState([]);

    // ✅ NEW: Feed Scope State
    const [feedScope, setFeedScope] = useState('Global'); // 'Global' | 'Following'

    const [leaderboardData, setLeaderboardData] = useState([]);
    const [activeScope, setActiveScope] = useState('Friends');
    const [activeTime, setActiveTime] = useState('Weekly');
    const [dateLabel, setDateLabel] = useState(getCurrentWeekRange());
    const [dateFilterType, setDateFilterType] = useState('Week');
    const [mutedUsers, setMutedUsers] = useState([]);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    const [showComments, setShowComments] = useState(false);
    const [currentPostId, setCurrentPostId] = useState(null);
    const [realComments, setRealComments] = useState([]); // ✅ Real-time comments
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [challenges, setChallenges] = useState([]);
    const [selectedChallenge, setSelectedChallenge] = useState(null);
    const [showChallengeModal, setShowChallengeModal] = useState(false);

    // ✅ NEW: Route State for Explore Tab
    const [selectedRoute, setSelectedRoute] = useState(null);

    // --- CHALLENGES: FETCH FROM FIRESTORE & SYNC PROGRESS ---
    useEffect(() => {
        const q = query(collection(db, "challenges"), orderBy("endDate", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                console.log("No challenges found. Ready to seed.");
                return;
            }

            const earnedChallenges = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    isJoined: safeUserData.joinedChallenges.includes(doc.id)
                };
            });
            setChallenges(earnedChallenges);
        }, (error) => console.error("Challenges fetch error:", error));

        return () => unsubscribe();
    }, [userData?.joinedChallenges, safeUserData.joinedChallenges]);

    const seedChallenges = async () => {
        try {
            await seedChallengesFromService();
            Alert.alert("Success", "Challenges seeded from latest data.");
        } catch (e) {
            console.error(e);
            Alert.alert("Error", e.message);
        }
    };

    // --- 1. REAL-TIME FEED LISTENER ---
    useEffect(() => {
        // Create a query against the collection.
        // We order by timestamp descending to show newest posts first.
        const q = query(
            collection(db, "posts"),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const posts = [];
            querySnapshot.forEach((doc) => {
                posts.push({
                    id: doc.id,
                    ...doc.data(),
                    // Ensure these fields exist for compatibility with FeedCard
                    isCurrentUser: doc.data().userId === userData?.uid,
                    time: formatTimeAgo(doc.data().timestamp),
                    // Pass raw likes/likedBy data to FeedCard
                    likes: doc.data().likes || 0,
                    likedBy: doc.data().likedBy || []
                });
            });

            // Filter out blocked/muted users locally
            let filteredPosts = posts.filter(p =>
                !safeUserData.blocked.includes(p.userId) &&
                !mutedUsers.includes(p.user)
            );

            // Privacy Filter: Remove posts from users who disabled showActivityOnFeed
            // Note: This requires fetching user privacy settings, which is expensive
            // For better performance, consider denormalizing privacy settings to posts
            filteredPosts = filteredPosts.filter(p => {
                // Always show own posts
                if (p.isCurrentUser) return true;

                // For now, assume posts are visible unless explicitly hidden
                // In production, you'd fetch user privacy settings here
                // or denormalize the showActivityOnFeed flag to the post document
                return p.showActivityOnFeed !== false;
            });

            // ✅ FEED SCOPE FILTER
            if (feedScope === 'Following') {
                filteredPosts = filteredPosts.filter(p =>
                    p.isCurrentUser || safeUserData.following.includes(p.userId)
                );
            }

            setFeedData(filteredPosts);
            console.log(`📡 Feed updated: ${filteredPosts.length} posts (${feedScope})`);
        }, (error) => {
            console.error("Feed listener error:", error);
        });

        return () => unsubscribe();
    }, [userData?.uid, userData?.blocked, mutedUsers, feedScope, safeUserData.following]);

    // --- 4. REAL-TIME LEADERBOARD LISTENER ---
    useEffect(() => {
        if (!user?.uid) {
            console.log('⚠️ Leaderboard: No user.uid, skipping');
            return;
        }



        let q;
        const following = userData?.following || [];
        const blocked = userData?.blocked || [];



        // Build query based on scope
        if (activeScope === 'Friends') {
            if (following.length === 0) {
                console.log('⚠️ No friends to show, following array is empty');
                setLeaderboardData([]);
                return;
            }
            // Fetch all users, filter client-side to avoid composite index
            q = query(
                collection(db, "users"),
                orderBy("weeklyDistance", "desc"),
                limit(100) // Fetch more to ensure we get friends
            );
        } else if (activeScope === 'Lebanon') {
            q = query(
                collection(db, "users"),
                where("location.country", "==", "Lebanon"),
                orderBy("weeklyDistance", "desc"),
                limit(50)
            );
        } else {
            // Global
            q = query(
                collection(db, "users"),
                orderBy("weeklyDistance", "desc"),
                limit(50)
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {


            let users = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    uid: doc.data().uid,
                    name: doc.data().name || 'Unknown',
                    avatar: doc.data().avatar,
                    displayDistance: doc.data().weeklyDistance || 0,
                    flag: getCountryFlag(doc.data().location?.country),
                    country: doc.data().location?.country,
                    // Check both document ID and uid field
                    isCurrentUser: doc.id === user.uid || doc.data().uid === user.uid
                }))
                .filter(u => !blocked.includes(u.id)); // Filter blocked users by document ID



            // For Friends scope, filter to only followed users
            if (activeScope === 'Friends') {
                users = users.filter(u => following.includes(u.id) || u.isCurrentUser);

            }

            // Add current user if not in top 50
            const currentUserInList = users.find(u => u.isCurrentUser);
            if (!currentUserInList) {
                users.push({
                    id: user.uid,
                    uid: user.uid,
                    name: userData.name,
                    avatar: userData.avatar,
                    displayDistance: userData.weeklyDistance || 0,
                    flag: getCountryFlag(userData.location?.country),
                    isCurrentUser: true
                });
            }

            // Sort and rank
            const sorted = users.sort((a, b) => b.displayDistance - a.displayDistance);
            const ranked = sorted.map((user, index) => ({ ...user, rank: index + 1 }));

            setLeaderboardData(ranked);

        }, (error) => {
            console.error("Leaderboard listener error:", error);
        });

        return () => unsubscribe();
    }, [activeScope, activeTime, userData?.uid, userData?.following, userData?.blocked]);

    const handleDateFilterClick = () => { if (activeTime === 'All-Time') { Alert.alert("Filter by Date", "Select a time range:", [{ text: "Today", onPress: () => { setDateLabel(getTodayDate()); setDateFilterType('Day'); } }, { text: "This Month", onPress: () => { setDateLabel(getMonthDate()); setDateFilterType('Month'); } }, { text: "This Year", onPress: () => { setDateLabel(getYearDate()); setDateFilterType('Year'); } }, { text: "Cancel", style: "cancel" }]); } };
    const { unreadCount } = useNotifications(); const [showNotifications, setShowNotifications] = useState(false); const [showOptions, setShowOptions] = useState(false); const [selectedPost, setSelectedPost] = useState(null);
    const handleOpenOptions = (post) => { setSelectedPost(post); setShowOptions(true); };
    const handleOptionSelect = async (action) => { setShowOptions(false); if (!selectedPost) return; if (action === 'Share') { try { await Share.share({ message: `Check out this run on Ruvo!` }); } catch (error) { } } else if (action === 'Mute') { setMutedUsers(prev => [...prev, selectedPost.user]); Alert.alert("Muted", `Muted ${selectedPost.user}.`); } else if (action === 'Report') { Alert.alert("Reported", "Received."); } };

    // --- 3. REAL-TIME COMMENTS LISTENER (When Modal is Open) ---
    useEffect(() => {
        if (!currentPostId || !showComments) return;

        console.log(`📡 Listening to comments for post: ${currentPostId}`);
        const q = query(
            collection(db, "posts", currentPostId, "comments"),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                time: formatTimeAgo(doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date())
            }));
            setRealComments(comments);
        }, (error) => console.error("Comments listener error:", error));

        return () => unsubscribe();
    }, [currentPostId, showComments]);


    const handleOpenComments = (post) => { setCurrentPostId(post.id); setShowComments(true); setCommentText(''); setReplyTo(null); };
    const handleSendComment = () => { if (!commentText.trim()) return; let finalMessage = commentText; if (replyTo) { finalMessage = `@${replyTo} ${commentText}`; } addPostComment(currentPostId, finalMessage); setCommentText(''); setReplyTo(null); };

    // --- 2. UPDATED CHALLENGE JOIN LOGIC (SAVES TO FIREBASE) ---
    // --- 2. UPDATED CHALLENGE JOIN LOGIC (SAVES TO FIREBASE) ---
    const toggleChallengeJoin = async (id) => {
        let newJoinedList = [];
        const isJoining = !safeUserData.joinedChallenges.includes(id);

        if (!isJoining) {
            // Leave
            newJoinedList = safeUserData.joinedChallenges.filter(cId => cId !== id);
            Alert.alert("Left Challenge", "You have left the challenge.");

            // Decrease count in Firestore
            try {
                const challengeRef = doc(db, "challenges", id);
                await updateDoc(challengeRef, {
                    participants: increment(-1)
                });
            } catch (e) {
                console.error("Error decrementing participants:", e);
            }
        } else {
            // Join
            newJoinedList = [...safeUserData.joinedChallenges, id];
            Alert.alert("Joined!", "Track progress in your Profile.");

            // Increase count in Firestore
            try {
                const challengeRef = doc(db, "challenges", id);
                await updateDoc(challengeRef, {
                    participants: increment(1)
                });
            } catch (e) {
                console.error("Error incrementing participants:", e);
            }
        }

        // Sync to Firebase User Profile
        updateUserProfile({ joinedChallenges: newJoinedList });

        // Update local selected item if modal is open
        if (selectedChallenge && selectedChallenge.id === id) {
            setSelectedChallenge(prev => ({
                ...prev,
                isJoined: !prev.isJoined,
                participants: prev.isJoined ? prev.participants - 1 : prev.participants + 1
            }));
        }
    };

    const handleChallengePress = (challenge) => {
        setSelectedChallenge(challenge);
        setShowChallengeModal(true);
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Ionicons name="person-outline" size={24} color="#FFF" /></TouchableOpacity>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.iconWrapper} onPress={() => navigation.navigate('Search')}><Ionicons name="search-outline" size={24} color="#FFF" /></TouchableOpacity>
                    <View style={styles.iconWrapper}><NotificationBell onPress={() => setShowNotifications(true)} /></View>
                    <TouchableOpacity style={styles.iconWrapper} onPress={() => navigation.navigate('Plan')}><Ionicons name="calendar-outline" size={24} color="#FFF" /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconWrapper} onPress={() => setShowSettingsModal(true)}><Ionicons name="settings-outline" size={24} color="#FFF" /></TouchableOpacity>
                </View>
            </View>
            <Text style={styles.screenTitle}>Community</Text>
            <View style={{ height: 50 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
                    {['Feed', 'Explore', 'Leaderboards', 'Clubs', 'Challenges'].map((tab) => (
                        <TouchableOpacity key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
                            <Text style={[styles.tabText, activeTab === tab ? styles.tabTextActive : styles.tabTextInactive]}>{tab}</Text>
                            {activeTab === tab && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    const renderLeaderboard = () => (
        <View style={styles.leaderboardContainer}>
            <View style={styles.filtersSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}><FilterButton label="Friends" isActive={activeScope === 'Friends'} onPress={() => setActiveScope('Friends')} /><FilterButton label="Country (Lebanon)" isActive={activeScope === 'Country'} onPress={() => setActiveScope('Country')} /><FilterButton label="Global" isActive={activeScope === 'Global'} onPress={() => setActiveScope('Global')} /></ScrollView>
                <View style={[styles.filterRow, { justifyContent: 'space-between' }]}><View style={{ flexDirection: 'row' }}><FilterButton label="Weekly" isActive={activeTime === 'Weekly'} onPress={() => { setActiveTime('Weekly'); setDateLabel(getCurrentWeekRange()); }} /><FilterButton label="All-Time" isActive={activeTime === 'All-Time'} onPress={() => { setActiveTime('All-Time'); setDateLabel("Filter by Date"); }} /></View><TouchableOpacity onPress={handleDateFilterClick} disabled={activeTime === 'Weekly'} style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={[styles.dateRangeText, activeTime === 'All-Time' && { color: COLORS.accent, textDecorationLine: 'underline' }]}>{dateLabel}</Text>{activeTime === 'All-Time' && <Ionicons name="chevron-down" size={14} color={COLORS.accent} style={{ marginLeft: 4 }} />}</TouchableOpacity></View>
            </View>
            {leaderboardData.length === 0 && activeScope === 'Friends' ? (<View style={{ alignItems: 'center', marginTop: 50 }}><Ionicons name="people-outline" size={40} color="#333" /><Text style={{ color: '#666', marginTop: 10 }}>No friends yet. Follow people in Global!</Text></View>) : (leaderboardData.map((item) => (<LeaderboardItem key={item.id} item={item} scope={activeScope} navigation={navigation} following={safeUserData.following} blocked={safeUserData.blocked} requests={safeUserData.requests} />)))}
        </View>
    );

    const handleJoinPress = (club) => {
        if (club.requestSent) { Alert.alert("Cancel Request", `Cancel join request?`, [{ text: "No", style: "cancel" }, { text: "Yes", onPress: () => toggleClubMembership(club.id) }]); }
        else { toggleClubMembership(club.id); }
    };

    const renderClubs = () => {
        const filteredClubs = clubs.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
        const myClubs = filteredClubs.filter(c => c.joined);
        const discoverClubs = filteredClubs.filter(c => !c.joined);
        return (
            <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 }}>
                    <View style={styles.searchContainer}><Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} /><TextInput style={{ color: '#FFF', fontFamily: 'Poppins_400Regular', flex: 1 }} placeholder="Search clubs..." placeholderTextColor="#666" value={searchQuery} onChangeText={setSearchQuery} textContentType="none" autoComplete="off" importantForAutofill="no" /></View>
                    <TouchableOpacity style={styles.createBtnMain} onPress={() => navigation.navigate('CreateClub')}><Ionicons name="add" size={20} color="#000" /><Text style={styles.createBtnText}>Create</Text></TouchableOpacity>
                </View>
                {myClubs.length > 0 && (<><View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>My Clubs</Text><Text style={{ color: '#666', fontSize: 14 }}>{myClubs.length}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 30 }}>{myClubs.map(club => (<TouchableOpacity key={club.id} style={styles.myClubCard} activeOpacity={0.9} onPress={() => navigation.navigate('ClubDetail', { clubData: club })}><View style={[styles.clubIconCircle, { backgroundColor: club.color }]}><MaterialCommunityIcons name={club.icon} size={20} color="#000" /></View><View><Text style={styles.myClubName}>{club.name}</Text><Text style={styles.myClubMembers}>{Array.isArray(club.members) ? club.members.length : (club.memberCount || 0)} Members</Text></View></TouchableOpacity>))}</ScrollView></>)}
                {discoverClubs.length > 0 && (<><Text style={styles.sectionTitle}>Discover Clubs</Text>{discoverClubs.map(club => (<TouchableOpacity key={club.id} style={styles.discoverCard} onPress={() => navigation.navigate('ClubDetail', { clubData: club })}><View style={[styles.discoverIconCircle, { backgroundColor: club.color }]}><MaterialCommunityIcons name={club.icon} size={24} color="#FFF" /></View><View style={styles.discoverInfo}><Text style={styles.discoverName}>{club.name}</Text><Text style={styles.discoverDesc} numberOfLines={2}>{club.desc}</Text><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}><Ionicons name="people" size={12} color="#666" /><Text style={styles.discoverMembers}>{Array.isArray(club.members) ? club.members.length : (club.memberCount || 0)} Members</Text></View></View><TouchableOpacity style={club.requestSent ? styles.requestedBtn : styles.joinBtn} onPress={() => handleJoinPress(club)}><Text style={club.requestSent ? styles.requestBtnText : styles.joinBtnText}>{club.requestSent ? 'Request Sent' : (club.type === 'private' ? 'Request' : 'Join')}</Text></TouchableOpacity></TouchableOpacity>))}</>)}

                {/* 🛠️ TEMPORARY SEED BUTTON */}
                <TouchableOpacity
                    style={{ marginTop: 20, padding: 15, backgroundColor: '#333', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#444' }}
                    onPress={async () => {
                        try {
                            const success = await seedClubs();
                            if (success) Alert.alert("Success", "Clubs seeded! Please reload the app to see them.");
                            else Alert.alert("Info", "Clubs already exist.");
                        } catch (e) {
                            Alert.alert("Error", e.message);
                        }
                    }}
                >
                    <Text style={{ color: '#AAA', fontFamily: 'Poppins_600SemiBold' }}>🛠️ DEV: Seed Initial Clubs</Text>
                </TouchableOpacity>

            </View>
        );
    };

    const calculateChallengeProgress = (challenge) => {
        if (!challenge.goal || !userData.runHistory) return 0;

        // Parse goal (e.g., "Log 100km")
        const goalValue = parseFloat(challenge.goal.match(/(\d+)/)?.[0]) || 100;
        const isElevation = challenge.goal.toLowerCase().includes('elevation');

        // Filter runs by date
        const start = challenge.startDate?.toDate ? challenge.startDate.toDate() : new Date();
        const end = challenge.endDate?.toDate ? challenge.endDate.toDate() : new Date();

        const relevantRuns = userData.runHistory.filter(run => {
            const runDate = new Date(run.date);
            return runDate >= start && runDate <= end;
        });

        // Sum up
        let current = 0;
        if (isElevation) {
            // Assuming elevation is standard in run data, otherwise 0 for now
            current = relevantRuns.reduce((sum, run) => sum + (parseFloat(run.elevation) || 0), 0);
        } else {
            // Distance
            current = relevantRuns.reduce((sum, run) => sum + (parseFloat(run.distance) || 0), 0);
        }

        // Return percentage (0 to 1) and value
        return {
            percent: Math.min(current / goalValue, 1),
            current: current.toFixed(1),
            target: goalValue
        };
    };

    const renderChallenges = () => {
        const featured = challenges.find(c => c.type === 'Featured');
        const upcoming = challenges.filter(c => c.type !== 'Featured');

        const featuredProgress = featured ? calculateChallengeProgress(featured) : { percent: 0, current: 0, target: 100 };

        return (
            <View style={{ marginBottom: 20 }}>
                {/* Admin Button Exposed for Updates (Dev Only - Commented out for now) */}
                {/* <TouchableOpacity style={{ backgroundColor: '#333', padding: 10, borderRadius: 8, marginHorizontal: 20, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#444' }} onPress={seedChallenges}>
                    <Text style={{ color: '#CCC', fontSize: 12, fontFamily: 'Poppins_600SemiBold' }}>Admin: Update Challenges Data</Text>
                </TouchableOpacity> */}
                {featured && (
                    <TouchableOpacity style={styles.challengeCardFeatured} activeOpacity={0.9} onPress={() => handleChallengePress(featured)}>
                        <Image source={{ uri: featured.image }} style={styles.challengeBg} resizeMode="cover" />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} style={styles.challengeOverlay}>
                            <View style={styles.featuredBadge}><Text style={styles.featuredBadgeText}>FEATURED</Text></View>
                            <Text style={styles.challengeTitleBig}>{featured.title}</Text>
                            <View style={styles.challengeMetaContainer}>
                                <View style={styles.metaRow}><Ionicons name="flag-outline" size={14} color={COLORS.accent} /><Text style={styles.challengeMetaText}>{featured.goal}</Text></View>
                                <View style={styles.metaRow}><Ionicons name="calendar-outline" size={14} color="#CCC" /><Text style={styles.challengeMetaText}>{featured.dates}</Text></View>
                                <View style={styles.metaRow}><Ionicons name="people-outline" size={14} color="#CCC" /><Text style={styles.challengeMetaText}>{featured.participants.toLocaleString()} Runners</Text></View>
                            </View>

                            {/* PROGRESS BAR FOR FEATURED */}
                            {featured.isJoined && (
                                <View style={{ marginTop: 10, marginBottom: 20 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={{ color: COLORS.accent, fontSize: 12, fontWeight: 'bold' }}>Progress</Text>
                                        <Text style={{ color: '#FFF', fontSize: 12 }}>{featuredProgress.current} / {featuredProgress.target}</Text>
                                    </View>
                                    <View style={{ height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' }}>
                                        <View style={{ height: '100%', width: `${featuredProgress.percent * 100}%`, backgroundColor: COLORS.accent }} />
                                    </View>
                                </View>
                            )}

                            {!featured.isJoined && (
                                <View style={[styles.rewardContainerGlass, { marginBottom: 20 }]}>
                                    <Text style={styles.rewardLabel}>REWARD</Text>
                                    <View style={styles.rewardRow}>
                                        <View style={styles.rewardItem}><Ionicons name="star" size={18} color="#FFD700" /><Text style={styles.rewardValue}>+{featured.xp.toLocaleString()}</Text><Text style={styles.rewardUnit}>XP</Text></View>
                                        <View style={styles.verticalDivider} />
                                        <View style={styles.rewardItem}><View style={styles.coinIcon}><Text style={styles.coinText}>C</Text></View><Text style={styles.rewardValue}>{featured.coins}</Text><Text style={styles.rewardUnit}>Coins</Text></View>
                                    </View>
                                </View>
                            )}

                            <TouchableOpacity style={[styles.joinChallengeBtn, featured.isJoined && styles.joinedChallengeBtn, { borderRadius: 30 }]} onPress={() => toggleChallengeJoin(featured.id)} activeOpacity={0.8}><Text style={[styles.joinChallengeText, featured.isJoined && { color: COLORS.accent }]}>{featured.isJoined ? 'JOINED' : 'JOIN CHALLENGE'}</Text></TouchableOpacity>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                <Text style={styles.sectionTitle}>Upcoming Challenges</Text>
                {upcoming.map(item => {
                    const progress = item.isJoined ? calculateChallengeProgress(item) : null;
                    return (
                        <TouchableOpacity key={item.id} style={styles.challengeItemEnhanced} activeOpacity={0.9} onPress={() => handleChallengePress(item)}>
                            <Image source={{ uri: item.image }} style={styles.challengeItemImage} />
                            <View style={styles.challengeItemContent}>
                                <Text style={styles.challengeItemTitle} numberOfLines={1}>{item.title}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}><Ionicons name="calendar-clear-outline" size={12} color="#888" /><Text style={styles.challengeItemDates}>{item.dates}</Text></View>

                                {item.isJoined ? (
                                    <View style={{ marginTop: 6, width: 100 }}>
                                        <View style={{ height: 4, backgroundColor: '#333', borderRadius: 2 }}>
                                            <View style={{ height: '100%', width: `${progress.percent * 100}%`, backgroundColor: COLORS.accent }} />
                                        </View>
                                        <Text style={{ color: COLORS.accent, fontSize: 10, marginTop: 2 }}>{progress.current} km</Text>
                                    </View>
                                ) : (
                                    <View style={styles.miniRewardTag}><Ionicons name="star" size={10} color="#FFD700" /><Text style={styles.miniRewardText}>+{item.xp} XP</Text></View>
                                )}
                            </View>
                            <TouchableOpacity style={[styles.smallJoinBtn, item.isJoined && { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.accent }]} onPress={() => toggleChallengeJoin(item.id)}><Text style={[styles.smallJoinText, item.isJoined && { color: COLORS.accent }]}>{item.isJoined ? 'Joined' : 'Join'}</Text></TouchableOpacity>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    // ✅ NEW: Render Explore Map
    const renderExplore = () => {
        // Filter valid posts with routes
        const postsWithRoutes = feedData.filter(p => p.routePath && p.routePath.length > 0 && !p.hideMap);

        return (
            <View style={styles.mapContainerFull}>
                <MapView
                    style={StyleSheet.absoluteFill}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                    customMapStyle={DARK_MAP_STYLE}
                    initialRegion={{
                        latitude: userData.location?.latitude || 33.8938,
                        longitude: userData.location?.longitude || 35.5018,
                        latitudeDelta: 0.1,
                        longitudeDelta: 0.1,
                    }}
                    showsUserLocation={true}
                >
                    {postsWithRoutes.map(post => (
                        <Polyline
                            key={post.id}
                            coordinates={post.routePath}
                            strokeColor={selectedRoute?.id === post.id ? COLORS.active : COLORS.accent}
                            strokeWidth={selectedRoute?.id === post.id ? 6 : 4}
                            tappable={true}
                            onPress={() => setSelectedRoute(post)}
                        />
                    ))}
                    {selectedRoute && (
                        <Marker
                            coordinate={selectedRoute.routePath[0]}
                            title={selectedRoute.title}
                            description={selectedRoute.user}
                        >
                            <View style={styles.startMarker}><Ionicons name="location" size={24} color={COLORS.active} /></View>
                        </Marker>
                    )}
                </MapView>

                {/* Floating "Save Route" Card */}
                {selectedRoute && (
                    <View style={styles.routeCard}>
                        <View style={styles.routeHeader}>
                            <View>
                                <Text style={styles.routeTitle}>{selectedRoute.title}</Text>
                                <Text style={styles.routeUser}>by {selectedRoute.user}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedRoute(null)}>
                                <Ionicons name="close-circle" size={24} color="#888" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.routeStats}>
                            <View style={styles.rStat}><Ionicons name="navigate" size={14} color="#CCC" /><Text style={styles.rStatText}>{selectedRoute.stats.km} km</Text></View>
                            <View style={styles.rStat}><Ionicons name="timer" size={14} color="#CCC" /><Text style={styles.rStatText}>{selectedRoute.stats.time}</Text></View>
                        </View>
                        <TouchableOpacity style={styles.saveRouteBtn} onPress={() => { saveRoute(selectedRoute); Alert.alert('Saved', 'Route saved to your profile.'); }}>
                            <Ionicons name="bookmark" size={18} color="#000" />
                            <Text style={styles.saveRouteText}>Save Route</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {postsWithRoutes.length === 0 && (
                    <View style={styles.emptyMapOverlay}>
                        <Ionicons name="map-outline" size={48} color="#666" />
                        <Text style={styles.emptyMapText}>No routes discovered yet.</Text>
                        <Text style={styles.emptyMapSub}>Go for a run and save it to populate the map!</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {renderHeader()}
                <ScrollView contentContainerStyle={activeTab === 'Explore' ? { flex: 1 } : styles.scrollContent} showsVerticalScrollIndicator={false} scrollEnabled={activeTab !== 'Explore'}>
                    {activeTab === 'Feed' && (
                        <>
                            {/* NEW: Leaderboard-Style Toggles (Aligned with Cards) */}
                            <View style={{ flexDirection: 'row', marginBottom: 20, marginTop: 0 }}>
                                <TouchableOpacity
                                    onPress={() => setFeedScope('Global')}
                                    style={[styles.filterBtn, feedScope === 'Global' ? styles.filterBtnActive : styles.filterBtnInactive]}
                                >
                                    <Text style={[styles.filterText, feedScope === 'Global' ? styles.filterTextActive : styles.filterTextInactive]}>Global</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setFeedScope('Following')}
                                    style={[styles.filterBtn, feedScope === 'Following' ? styles.filterBtnActive : styles.filterBtnInactive]}
                                >
                                    <Text style={[styles.filterText, feedScope === 'Following' ? styles.filterTextActive : styles.filterTextInactive]}>Following</Text>
                                </TouchableOpacity>
                            </View>

                            {feedData.length === 0 && feedScope === 'Following' ? (
                                <View style={{ alignItems: 'center', marginTop: 50 }}>
                                    <Ionicons name="people-outline" size={40} color="#333" />
                                    <Text style={{ color: '#666', marginTop: 10 }}>Follow people to see their runs here!</Text>
                                    <TouchableOpacity
                                        style={{ marginTop: 15, backgroundColor: '#333', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                                        onPress={() => setFeedScope('Global')}
                                    >
                                        <Text style={{ color: COLORS.accent, fontWeight: 'bold' }}>Find People</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                feedData.map(item => (<FeedCard key={item.id} item={item} navigation={navigation} onOpenOptions={handleOpenOptions} onOpenComments={handleOpenComments} commentCount={item.comments || 0} />))
                            )}
                        </>
                    )}
                    {activeTab === 'Explore' && renderExplore()}
                    {activeTab === 'Leaderboards' && renderLeaderboard()}
                    {activeTab === 'Clubs' && renderClubs()}
                    {activeTab === 'Challenges' && renderChallenges()}
                    <View style={{ height: 100 }} />
                </ScrollView>
            </SafeAreaView>

            <NotificationSheet visible={showNotifications} onClose={() => setShowNotifications(false)} />

            <Modal animationType="slide" transparent={true} visible={showComments} onRequestClose={() => setShowComments(false)}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}><TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowComments(false)} /><View style={styles.commentsSheet}><View style={styles.notifHeader}><Text style={styles.notifHeaderTitle}>Comments</Text><TouchableOpacity onPress={() => setShowComments(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity></View><FlatList data={realComments} keyExtractor={item => item.id} renderItem={({ item }) => (<TouchableOpacity style={styles.commentItem} onPress={() => setReplyTo(item.user)}><Image source={item.avatar ? { uri: item.avatar } : require('../../assets/icon.png')} style={styles.commentAvatar} /><View style={{ flex: 1 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={styles.commentUser}>{item.user}</Text><Text style={styles.commentTime}>{item.time}</Text></View><Text style={styles.commentText}>{item.text}</Text></View></TouchableOpacity>)} ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>No comments yet.</Text>} />{replyTo && (<View style={styles.replyBar}><Text style={styles.replyText}>Replying to <Text style={{ fontWeight: 'bold' }}>{replyTo}</Text></Text><TouchableOpacity onPress={() => setReplyTo(null)}><Ionicons name="close-circle" size={16} color="#888" /></TouchableOpacity></View>)}<View style={styles.inputRow}><TextInput style={styles.commentInput} placeholder="Add a comment..." placeholderTextColor="#666" value={commentText} onChangeText={setCommentText} textContentType="none" autoComplete="off" importantForAutofill="no" /><TouchableOpacity onPress={handleSendComment}><Text style={[styles.sendText, { color: commentText ? COLORS.accent : '#444' }]}>Post</Text></TouchableOpacity></View></View></KeyboardAvoidingView></Modal>
            <Modal animationType="fade" transparent={true} visible={showOptions} onRequestClose={() => setShowOptions(false)}><View style={styles.modalOverlay}><TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowOptions(false)} /><View style={styles.optionsSheet}><View style={styles.optionsHeader}><Text style={styles.optionsTitle}>Options</Text></View><TouchableOpacity style={styles.optionItem} onPress={() => handleOptionSelect('Share')}><Ionicons name="share-social-outline" size={24} color="#FFF" /><Text style={styles.optionText}>Share Activity</Text></TouchableOpacity><TouchableOpacity style={styles.optionItem} onPress={() => handleOptionSelect('Mute')}><Ionicons name="volume-mute-outline" size={24} color="#FFF" /><Text style={styles.optionText}>Mute {selectedPost?.user}</Text></TouchableOpacity><TouchableOpacity style={styles.optionItem} onPress={() => handleOptionSelect('Report')}><Ionicons name="flag-outline" size={24} color="#FF3B30" /><Text style={[styles.optionText, { color: '#FF3B30' }]}>Report Activity</Text></TouchableOpacity><TouchableOpacity style={styles.cancelButton} onPress={() => setShowOptions(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View></View></Modal>
            <Modal animationType="slide" transparent={true} visible={showSettingsModal} onRequestClose={() => setShowSettingsModal(false)}><View style={styles.modalOverlay}><TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowSettingsModal(false)} /><View style={styles.notificationSheet}><View style={styles.notifHeader}><Text style={styles.notifHeaderTitle}>Manage Users</Text><TouchableOpacity onPress={() => setShowSettingsModal(false)}><Text style={styles.markReadText}>Close</Text></TouchableOpacity></View><Text style={{ color: '#AAA', marginTop: 10, marginBottom: 5, fontFamily: 'Poppins_700Bold' }}>Blocked Users ({safeUserData.blocked.length})</Text><FlatList data={safeUserData.blocked} keyExtractor={(item) => item} renderItem={({ item }) => (<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' }}><Text style={{ color: '#FFF', fontSize: 16 }}>{safeUserData.allUsers.find(u => u.id === item)?.name || "User"}</Text><TouchableOpacity onPress={() => unblockUser(item)} style={{ backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 }}><Text style={{ color: COLORS.accent, fontWeight: 'bold' }}>Unblock</Text></TouchableOpacity></View>)} ListEmptyComponent={<Text style={{ color: '#666', fontStyle: 'italic' }}>No blocked users.</Text>} /><Text style={{ color: '#AAA', marginTop: 20, marginBottom: 5, fontFamily: 'Poppins_700Bold' }}>Muted Users ({mutedUsers.length})</Text><FlatList data={mutedUsers} keyExtractor={(item) => item} renderItem={({ item }) => (<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' }}><Text style={{ color: '#FFF', fontSize: 16 }}>{item}</Text><TouchableOpacity onPress={() => setMutedUsers(prev => prev.filter(u => u !== item))} style={{ backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 }}><Text style={{ color: COLORS.accent, fontWeight: 'bold' }}>Unmute</Text></TouchableOpacity></View>)} ListEmptyComponent={<Text style={{ color: '#666', fontStyle: 'italic' }}>No muted users.</Text>} /></View></View></Modal>

            {/* FULL SCREEN CHALLENGE DETAILS MODAL */}
            <Modal animationType="slide" transparent={true} visible={showChallengeModal} onRequestClose={() => setShowChallengeModal(false)}>
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    {selectedChallenge && (
                        <>
                            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                                {/* HEADER IMAGE */}
                                <View style={{ height: 400, width: '100%' }}>
                                    <Image source={{ uri: selectedChallenge.image }} style={styles.challengeModalImage} resizeMode="cover" />
                                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)', '#000']} style={styles.challengeModalGradient} />

                                    <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowChallengeModal(false)}>
                                        <Ionicons name="close" size={24} color="#FFF" />
                                    </TouchableOpacity>

                                    {/* TOP LEFT TAG */}
                                    <View style={{ position: 'absolute', top: 50, left: 20, backgroundColor: COLORS.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, zIndex: 10 }}>
                                        <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }}>{selectedChallenge.type === 'Featured' ? 'FEATURED' : 'CHALLENGE'}</Text>
                                    </View>

                                    <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
                                        <Text style={styles.modalChallengeTitle}>{selectedChallenge.title}</Text>
                                    </View>
                                </View>

                                <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
                                    {/* STATUS BAR */}
                                    {selectedChallenge.isJoined ? (
                                        <View style={styles.statusCard}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                                <Text style={{ color: COLORS.accent, fontWeight: 'bold' }}>ACTIVE</Text>
                                                <Text style={{ color: '#FFF' }}>{calculateChallengeProgress(selectedChallenge).current} / {calculateChallengeProgress(selectedChallenge).target} {selectedChallenge.goal.includes('Elevation') ? 'm' : 'km'}</Text>
                                            </View>
                                            <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${calculateChallengeProgress(selectedChallenge).percent * 100}%` }]} /></View>
                                            <Text style={{ color: '#888', fontSize: 11, marginTop: 5 }}>Keep pushing! You are doing great.</Text>
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                            <Ionicons name="time-outline" size={16} color="#888" />
                                            <Text style={{ color: '#BBB', marginLeft: 5, fontSize: 13 }}>Ends {selectedChallenge.dates.split('-')[1]}</Text>
                                            <View style={{ width: 1, height: 12, backgroundColor: '#333', marginHorizontal: 10 }} />
                                            <Ionicons name="people-outline" size={16} color="#888" />
                                            <Text style={{ color: '#BBB', marginLeft: 5, fontSize: 13 }}>{selectedChallenge.participants.toLocaleString()} Runners</Text>
                                        </View>
                                    )}

                                    <Text style={styles.detailSectionTitle}>About this Challenge</Text>
                                    <Text style={styles.modalChallengeDesc}>{selectedChallenge.description || selectedChallenge.goal}</Text>

                                    {/* GOAL CARD */}
                                    <View style={styles.infoCard}>
                                        <View style={styles.infoRow}>
                                            <View style={styles.iconBox}><MaterialCommunityIcons name="target" size={24} color={COLORS.accent} /></View>
                                            <View>
                                                <Text style={styles.infoLabel}>GOAL</Text>
                                                <Text style={styles.infoValue}>{selectedChallenge.goal}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* REWARDS CARD */}
                                    <Text style={styles.detailSectionTitle}>Rewards</Text>
                                    <View style={styles.rewardCardPremium}>
                                        <View style={styles.rewardCol}>
                                            <Ionicons name="star" size={28} color="#FFD700" />
                                            <Text style={styles.rewardValueLarge}>+{selectedChallenge.xp}</Text>
                                            <Text style={styles.rewardLabelSmall}>XP POINTS</Text>
                                        </View>
                                        <View style={styles.verticalDividerLarge} />
                                        <View style={styles.rewardCol}>
                                            <MaterialCommunityIcons name="bitcoin" size={28} color={COLORS.accent} />
                                            <Text style={[styles.rewardValueLarge, { color: COLORS.accent }]}>{selectedChallenge.coins}</Text>
                                            <Text style={styles.rewardLabelSmall}>COINS</Text>
                                        </View>
                                    </View>
                                </View>
                            </ScrollView>

                            {/* STICKY FOOTER */}
                            <View style={styles.modalStickyFooter}>
                                <TouchableOpacity
                                    style={[styles.joinChallengeBtn, selectedChallenge.isJoined && styles.joinedChallengeBtn, { width: '100%', borderRadius: 15, paddingVertical: 16 }]}
                                    onPress={() => toggleChallengeJoin(selectedChallenge.id)}
                                >
                                    <Text style={[styles.joinChallengeText, selectedChallenge.isJoined && { color: COLORS.accent }]}>
                                        {selectedChallenge.isJoined ? 'LEAVE CHALLENGE' : 'JOIN CHALLENGE'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </Modal>

            <FloatingNavBar current="Community" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    safeArea: { flex: 1, backgroundColor: '#000' },
    headerContainer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 0, backgroundColor: '#000' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    iconWrapper: { marginLeft: 15 },
    screenTitle: { fontFamily: 'Poppins_700Bold', fontSize: 32, color: '#FFF', marginBottom: 15 },
    tabsScrollContent: { paddingRight: 20, paddingBottom: 10 },
    tabItem: { marginRight: 25, paddingBottom: 5 },
    tabText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    tabTextActive: { color: COLORS.accent }, tabTextInactive: { color: '#666' },
    activeIndicator: { height: 3, backgroundColor: COLORS.accent, borderRadius: 2, marginTop: 5, width: '100%' },
    scrollContent: { padding: 20 },
    card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 15, marginBottom: 20 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    userName: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14, marginRight: 8 },
    levelBadge: { backgroundColor: '#333', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    levelText: { color: COLORS.accent, fontSize: 10, fontFamily: 'Poppins_700Bold' },
    timeText: { color: '#888', fontFamily: 'Poppins_400Regular', fontSize: 12, marginTop: 2 },
    moreBtn: { marginLeft: 'auto', padding: 5 },
    activityTitle: { color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 15, marginBottom: 8 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 12 },
    badgeText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 11 },
    statsContainer: { flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 12, paddingVertical: 12, marginBottom: 15 },
    statCol: { flex: 1, alignItems: 'center' },
    statValue: { color: COLORS.accent, fontFamily: 'Poppins_700Bold', fontSize: 18 }, statLabel: { color: '#888', fontFamily: 'Poppins_400Regular', fontSize: 11 },
    mapContainer: { height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 15, backgroundColor: '#333' },
    mapImage: { width: '100%', height: '100%' },
    mapOverlayIcon: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
    cardFooter: { flexDirection: 'row', alignItems: 'center' },

    // PREMIUM MODAL STYLES
    challengeModalContent: { flex: 1, backgroundColor: '#1C1C1E', margin: 0 },
    challengeModalImageContainer: { height: 350, width: '100%' },
    challengeModalImage: { width: '100%', height: '100%' },
    challengeModalGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 },
    modalCloseBtn: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10 },

    modalStickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#000', padding: 20, borderTopWidth: 1, borderTopColor: '#333' },
    statusCard: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
    infoCard: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 15, marginBottom: 20, flexDirection: 'row', alignItems: 'center' },
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(204, 255, 0, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    infoLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    infoValue: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    rewardCardPremium: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 20, justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    rewardCol: { alignItems: 'center' },
    rewardValueLarge: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 5 },
    rewardLabelSmall: { color: '#666', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginTop: 2 },
    verticalDividerLarge: { width: 1, height: 40, backgroundColor: '#333' },
    detailSectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 15, marginTop: 10 },
    modalChallengeTitle: { color: '#FFF', fontSize: 32, fontFamily: 'Poppins_800ExtraBold', lineHeight: 36, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
    modalChallengeDesc: { color: '#CCC', fontSize: 14, lineHeight: 22, marginBottom: 20, fontFamily: 'Poppins_400Regular' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
    actionText: { color: '#888', fontFamily: 'Poppins_500Medium', fontSize: 13, marginLeft: 6 },
    leaderboardContainer: { marginBottom: 20 },
    filtersSection: { marginBottom: 20 },
    filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    filterBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginRight: 10, borderWidth: 1 },
    filterBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    filterBtnInactive: { backgroundColor: '#333', borderColor: '#333' },
    filterText: { fontFamily: 'Poppins_700Bold', fontSize: 12 },
    filterTextActive: { color: '#000' }, filterTextInactive: { color: '#AAA' },
    dateRangeText: { color: '#AAA', fontFamily: 'Poppins_400Regular', fontSize: 10, textAlign: 'right', alignSelf: 'center' },
    itemContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 15, marginBottom: 10 },
    currentUserItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(204, 255, 0, 0.1)', borderRadius: 16, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: COLORS.accent },
    lbAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15 },
    lbName: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 14 },
    flag: { fontSize: 14, marginLeft: 8 },
    rankCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    rankText: { fontFamily: 'Poppins_700Bold', fontSize: 14 },
    friendsInfoCol: { flex: 1, justifyContent: 'center' },
    friendsDistance: { color: '#AAA', fontFamily: 'Poppins_400Regular', fontSize: 12, marginTop: 2 },
    friendsRightIcon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minWidth: 60 },
    followIconBox: { padding: 5, marginLeft: 8 },
    countryDistance: { color: '#AAA', fontFamily: 'Poppins_400Regular', fontSize: 12 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalBackdrop: { flex: 1 },
    notificationSheet: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: height * 0.7, padding: 25 },
    commentsSheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: height * 0.8, padding: 20 },
    notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    notifHeaderTitle: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold' },
    markReadText: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    optionsSheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
    optionsHeader: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 15 },
    optionsTitle: { color: '#888', fontFamily: 'Poppins_600SemiBold', fontSize: 14, textAlign: 'center' },
    optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
    optionText: { color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 16, marginLeft: 15 },
    cancelButton: { marginTop: 10, paddingVertical: 15, alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 12 },
    cancelText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16 },
    commentItem: { flexDirection: 'row', marginBottom: 20 },
    commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
    commentUser: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
    commentTime: { color: '#666', fontSize: 11 },
    commentText: { color: '#DDD', fontSize: 14, marginTop: 2 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 15, marginTop: 10 },
    commentInput: { flex: 1, color: '#FFF', backgroundColor: '#2C2C2E', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10 },
    sendText: { fontFamily: 'Poppins_700Bold', fontSize: 16 },
    replyBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#333', padding: 8, borderRadius: 8, marginBottom: 10 },
    replyText: { color: '#CCC', fontSize: 12 },
    searchContainer: { flex: 1, height: 45, backgroundColor: '#1C1C1E', borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginRight: 10 },
    createBtnMain: { backgroundColor: COLORS.accent, height: 45, paddingHorizontal: 20, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    createBtnText: { fontFamily: 'Poppins_600SemiBold', color: '#000', marginLeft: 5 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 15 },
    myClubCard: { width: 140, height: 140, backgroundColor: '#1C1C1E', borderRadius: 16, padding: 15, marginRight: 12, justifyContent: 'space-between' },
    clubIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    myClubName: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 14, marginBottom: 2 },
    myClubMembers: { color: '#888', fontFamily: 'Poppins_400Regular', fontSize: 11 },
    discoverCard: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 15, marginBottom: 12, alignItems: 'center' },
    discoverIconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    discoverInfo: { flex: 1, marginLeft: 15, marginRight: 10 },
    discoverName: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold' },
    discoverDesc: { color: '#888', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    discoverMembers: { color: '#666', fontSize: 11, fontFamily: 'Poppins_500Medium', marginLeft: 4 },
    joinBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    joinBtnText: { color: '#000', fontSize: 12, fontFamily: 'Poppins_700Bold' },
    requestBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    requestBtnText: { color: '#BBB', fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    challengeCardFeatured: { borderRadius: 16, overflow: 'hidden', height: 420, marginBottom: 30, backgroundColor: '#1C1C1E' },
    challengeBg: { width: '100%', height: '100%', position: 'absolute' },
    challengeOverlay: { flex: 1, padding: 20, justifyContent: 'flex-end' },
    featuredBadge: { position: 'absolute', top: 20, left: 20, backgroundColor: COLORS.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
    featuredBadgeText: { color: '#000', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
    challengeTitleBig: { color: '#FFF', fontSize: 26, fontFamily: 'Poppins_700Bold', marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
    challengeMetaContainer: { marginBottom: 15 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    challengeMetaText: { color: '#EEE', fontSize: 14, fontFamily: 'Poppins_400Regular', marginLeft: 8 },
    rewardContainerGlass: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 15, backgroundColor: 'rgba(0,0,0,0.4)', marginBottom: 20 },
    rewardLabel: { color: '#AAA', fontSize: 10, fontFamily: 'Poppins_700Bold', marginBottom: 8, letterSpacing: 1 },
    rewardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    rewardItem: { alignItems: 'center' },
    rewardValue: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold', marginTop: 4 },
    rewardUnit: { color: '#BBB', fontSize: 11, fontFamily: 'Poppins_400Regular' },
    verticalDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
    coinIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
    coinText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
    joinChallengeBtn: { backgroundColor: COLORS.accent, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 30, alignItems: 'center' }, // Updated radius
    joinedChallengeBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.accent, borderRadius: 30 }, // Updated radius
    joinChallengeText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: '#000', textTransform: 'uppercase' },
    challengeItemEnhanced: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 12, marginBottom: 15 },
    challengeItemImage: { width: 60, height: 60, borderRadius: 12, marginRight: 15 },
    challengeItemContent: { flex: 1, justifyContent: 'center' },
    challengeItemTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
    challengeItemDates: { color: '#888', fontFamily: 'Poppins_400Regular', fontSize: 11, marginLeft: 5 },
    smallJoinBtn: { backgroundColor: COLORS.accent, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, alignSelf: 'center' }, // Updated radius
    smallJoinText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 11, textTransform: 'uppercase' },
    miniRewardTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
    miniRewardText: { color: '#FFD700', fontSize: 10, fontFamily: 'Poppins_700Bold', marginLeft: 4 },

});

const DARK_MAP_STYLE = [
    { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
    { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
    { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] },
    { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
    { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
    { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
    { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [{ "color": "#4e4e4e" }] },
    { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
    { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3d3d3d" }] }
];