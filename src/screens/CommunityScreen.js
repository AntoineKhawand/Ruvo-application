import { Ionicons } from '@expo/vector-icons';
import { collection, doc, increment, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, Modal, Platform, RefreshControl, ScrollView, Share, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChallengesTab from '../components/community/ChallengesTab';
import ClubsTab from '../components/community/ClubsTab';
import FeedTab from '../components/community/FeedTab';
import FloatingNavBar from '../components/FloatingNavBar';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from '../components/Map'; // ✅ NEW: MapView for Discover
import NotificationBell from '../components/NotificationBell';
import { db } from '../config/firebase';
import SkeletonCard from '../components/SkeletonCard';
import { COLORS } from '../constants/legacy-theme.js';
import { useNotifications } from '../context/NotificationContext';
import { useUser } from '../context/UserContext';
import { challengeService } from '../services/challengeService'; // ✅ Added challenge progress
// seedClubs import removed — DEV-only seed button has been removed
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';
import { submitReport } from '../services/reportService';

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

const FilterButton = ({ label, isActive, onPress }) => (
    <TouchableOpacity
        style={[{ paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginRight: 10, borderWidth: 1 }, isActive ? { backgroundColor: COLORS.accent, borderColor: COLORS.accent } : { backgroundColor: '#333', borderColor: '#333' }]}
        onPress={onPress}
    >
        <Text style={[{ fontFamily: 'Poppins_700Bold', fontSize: 12 }, isActive ? { color: '#000' } : { color: '#AAA' }]}>{label}</Text>
    </TouchableOpacity>
);

const CommunityLeaderboardItem = ({ item, navigation }) => {
    const isTop3 = item.rank <= 3;
    const isCurrentUser = item.isCurrentUser;
    let rankBgColor = '#333';
    let rankTextColor = '#FFF';
    if (item.rank === 1) { rankBgColor = '#FFD700'; rankTextColor = '#000'; }
    else if (item.rank === 2) { rankBgColor = '#C0C0C0'; rankTextColor = '#000'; }
    else if (item.rank === 3) { rankBgColor = '#CD7F32'; rankTextColor = '#000'; }
    else if (isCurrentUser) { rankBgColor = COLORS.accent; rankTextColor = '#000'; }
    const displayDistance = typeof item.displayDistance === 'number' ? `${item.displayDistance.toFixed(1)} km` : '0.0 km';
    return (
        <TouchableOpacity
            activeOpacity={isCurrentUser ? 1 : 0.7}
            style={isCurrentUser ? styles.currentUserItem : styles.itemContainer}
            onPress={() => { if (!isCurrentUser && navigation) navigation.navigate('UserProfile', { userId: item.id }); }}
        >
            <View style={[styles.rankCircle, { backgroundColor: rankBgColor }]}>
                <Text style={[styles.rankText, { color: rankTextColor }]}>{item.rank}</Text>
            </View>
            <Image source={item.avatar ? { uri: item.avatar } : require('../../assets/icon.png')} style={styles.lbAvatar} />
            <View style={styles.friendsInfoCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.lbName, isCurrentUser && { color: COLORS.accent }]}>{item.name}</Text>
                    {item.flag && <Text style={styles.flag}>{item.flag}</Text>}
                </View>
                <Text style={styles.friendsDistance}>{displayDistance}</Text>
            </View>
            <Ionicons
                name={item.rank === 1 ? 'trophy' : item.rank <= 3 ? 'medal' : 'person'}
                size={20}
                color={isTop3 ? (item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0C0' : '#CD7F32') : '#666'}
            />
        </TouchableOpacity>
    );
};



export default function CommunityScreen({ navigation }) {
    const { user, userData, unblockUser, muteUser, clubs, toggleClubMembership, postComments, checkPrivacyPermission, addPostComment, updateUserProfile, saveRoute, toggleLike } = useUser(); // ✅ Added checkPrivacyPermission

    const safeUserData = { name: userData?.name || 'User', avatar: userData?.avatar, level: userData?.level || 1, runHistory: Array.isArray(userData?.runHistory) ? userData.runHistory : [], blocked: Array.isArray(userData?.blocked) ? userData.blocked : [], following: Array.isArray(userData?.following) ? userData.following : [], requests: Array.isArray(userData?.requests) ? userData.requests : [], joinedChallenges: Array.isArray(userData?.joinedChallenges) ? userData.joinedChallenges : [] };
    const [activeTab, setActiveTab] = useState('Feed');
    const [feedData, setFeedData] = useState([]);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ✅ NEW: Feed Scope State
    const [feedScope, setFeedScope] = useState('Global'); // 'Global' | 'Following'

    const [leaderboardData, setLeaderboardData] = useState([]);
    const [activeScope, setActiveScope] = useState('Global');
    const [activeTime, setActiveTime] = useState('Weekly');
    const [dateLabel, setDateLabel] = useState(getCurrentWeekRange());
    const [dateFilterType, setDateFilterType] = useState('Week');

    // ✅ NEW: Derive mutedUsers reactively from Context instead of local state
    const mutedUsers = userData?.mutedUsers || [];

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

    // Explore Tab State
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [exploreFilter, setExploreFilter] = useState('All');

    const CURATED_ROUTES = [
        { id: 'c1', title: 'Beirut Corniche Loop', user: 'Ruvo Team', stats: { km: '5.2', time: '28:00', pace: '5:22' }, routePath: [], difficulty: 'Easy', tags: ['Flat', 'Scenic'], color: '#4CD964' },
        { id: 'c2', title: 'Raouché Coastal Run', user: 'Ruvo Team', stats: { km: '8.4', time: '48:00', pace: '5:42' }, routePath: [], difficulty: 'Moderate', tags: ['Coastal', 'Popular'], color: '#FF9500' },
        { id: 'c3', title: 'Horsh Beirut Trail', user: 'Ruvo Team', stats: { km: '3.8', time: '22:00', pace: '5:47' }, routePath: [], difficulty: 'Easy', tags: ['Park', 'Shaded'], color: '#4CD964' },
        { id: 'c4', title: 'Gemmayzeh Hills', user: 'Ruvo Team', stats: { km: '6.1', time: '38:00', pace: '6:13' }, routePath: [], difficulty: 'Hard', tags: ['Hilly', 'Urban'], color: '#FF3B30' },
        { id: 'c5', title: 'Mar Mikhael Loop', user: 'Ruvo Team', stats: { km: '4.5', time: '25:00', pace: '5:33' }, routePath: [], difficulty: 'Easy', tags: ['Urban', 'Night Friendly'], color: '#4CD964' },
    ];

    // --- CHALLENGES: FETCH FROM FIRESTORE & SYNC PROGRESS ---
    useEffect(() => {
        const q = query(collection(db, "challenges"), orderBy("endDate", "desc"));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (snapshot.empty) {
                console.log("No challenges found. Seeding defaults...");
                try {
                    const { seedChallenges } = await import('../services/challengeService');
                    await seedChallenges();
                } catch (e) {
                    console.log("Challenge seed error:", e.message);
                }
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
        }, (error) => console.log("Challenges fetch (Expected if no permissions):", error.message));

        return () => unsubscribe();
    }, [userData?.joinedChallenges, safeUserData.joinedChallenges]);

    const seedChallenges = async () => {
        try {
            const { seedChallenges } = await import('../services/challengeService');
            await seedChallenges();
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
                    time: formatTimeAgo(doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : doc.data().timestamp),
                    // Pass raw likes/likedBy data to FeedCard
                    likes: doc.data().likes || 0,
                    likedBy: doc.data().likedBy || []
                });
            });

            // Filter out blocked/muted users locally
            let filteredPosts = posts.filter(p =>
                !safeUserData.blocked.includes(p.userId) &&
                !mutedUsers.includes(p.userId)
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
            if (isInitialLoad) setIsInitialLoad(false);
            // console.log(`📡 Feed updated: ${filteredPosts.length} posts (${feedScope})`);
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
        // All scopes use the same base query — filter client-side to avoid composite index issues
        q = query(
            collection(db, "users"),
            orderBy("weeklyDistance", "desc"),
            limit(100)
        );

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
                    privacySettings: doc.data().privacySettings || {}, // Needed for check
                    // Check both document ID and uid field
                    isCurrentUser: doc.id === user.uid || doc.data().uid === user.uid
                }))
                .filter(u => !blocked.includes(u.id)); // Filter blocked users by document ID

            // @privacy-enforced: checkPrivacyPermission(user, 'viewStats')
            // Drop users completely if they explicitly disallow 'showStatsToOthers'
            // Allow users if they don't have privacy settings yet (default to visible)
            users = users.filter(u => {
                if (!u.privacySettings || Object.keys(u.privacySettings).length === 0) return true;
                return checkPrivacyPermission(u, 'viewStats');
            });

            // Scope filters (client-side)
            if (activeScope === 'Friends') {
                users = users.filter(u => following.includes(u.id) || u.isCurrentUser);
            } else if (activeScope === 'Lebanon') {
                users = users.filter(u => u.isCurrentUser || !u.country || u.country === 'Lebanon' || u.country === 'LB');
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

    const handleDateFilterClick = () => { lightTap(); if (activeTime === 'All-Time') { Alert.alert("Filter by Date", "Select a time range:", [{ text: "Today", onPress: () => { setDateLabel(getTodayDate()); setDateFilterType('Day'); } }, { text: "This Month", onPress: () => { setDateLabel(getMonthDate()); setDateFilterType('Month'); } }, { text: "This Year", onPress: () => { setDateLabel(getYearDate()); setDateFilterType('Year'); } }, { text: "Cancel", style: "cancel" }]); } };
    const { unreadCount, addNotification, notifications, markAllAsRead } = useNotifications(); const [showNotifications, setShowNotifications] = useState(false); const [showOptions, setShowOptions] = useState(false); const [selectedPost, setSelectedPost] = useState(null);
    const handleCheer = async (item) => {
        lightTap();
        const uid = user?.uid || userData?.uid;
        const isLiked = item.likedBy?.includes(uid) || false;

        // Optimistic update — flip the icon instantly before Firestore responds
        setFeedData(prev => prev.map(p => {
            if (p.id !== item.id) return p;
            const newLikedBy = isLiked
                ? (p.likedBy || []).filter(id => id !== uid)
                : [...(p.likedBy || []), uid];
            return { ...p, likedBy: newLikedBy, likes: Math.max(0, (p.likes || 0) + (isLiked ? -1 : 1)) };
        }));

        if (typeof toggleLike === 'function') await toggleLike(item.id);
        if (!isLiked && typeof addNotification === 'function') {
            addNotification({ title: `You cheered ${item.user}!`, desc: `You liked their activity: "${item.title}"`, type: 'cheer_up' });
        }
    };
    const handleOpenOptions = (post) => { lightTap(); setSelectedPost(post); setShowOptions(true); };
    const handleOptionSelect = async (action) => { lightTap(); setShowOptions(false); if (!selectedPost) return; if (action === 'Share') { try { const p = selectedPost; const stats = p?.stats; const shareText = `${p?.user || 'Someone'} just completed a run on Ruvo! 🏃‍♂️\n\n📍 ${stats?.km || '?'} km  ⏱ ${stats?.time || '?'}  💨 ${stats?.pace || '?'} /km\n\n${p?.title || ''}`.trim(); await Share.share({ message: shareText }); } catch (error) { } } else if (action === 'Mute') { muteUser(selectedPost.userId || selectedPost.user); Alert.alert("Muted", `Muted ${selectedPost.user}.`); } else if (action === 'Report') { submitReport({ reporterId: user?.uid, reporterName: userData?.name, itemId: selectedPost.id, itemType: 'post', itemLabel: selectedPost.title || selectedPost.user }); } };
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


    const handleOpenComments = (post) => { lightTap(); setCurrentPostId(post.id); setShowComments(true); setCommentText(''); setReplyTo(null); };
    const handleSendComment = async () => {
        lightTap();
        if (!commentText.trim()) return;
        if (!currentPostId) {
            Alert.alert("Error", "No post selected.");
            return;
        }
        try {
            let finalMessage = commentText;
            if (replyTo) {
                finalMessage = `@${replyTo} ${commentText}`;
            }
            await addPostComment(currentPostId, finalMessage);
            setCommentText('');
            setReplyTo(null);
        } catch (error) {
            console.error("Comment error:", error);
            Alert.alert("Error", "Could not post comment. Please try again.");
        }
    };

    // --- 2. UPDATED CHALLENGE JOIN LOGIC (SAVES TO FIREBASE) ---
    const toggleChallengeJoin = async (id) => {
        lightTap();
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
        lightTap();
        setSelectedChallenge(challenge);
        setShowChallengeModal(true);
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.navigate('Profile'); }}><Ionicons name="person-outline" size={24} color="#FFF" /></TouchableOpacity>
                <View style={styles.headerRight}>
                    <TouchableOpacity activeOpacity={0.7} style={styles.iconWrapper} onPress={() => { lightTap(); navigation.navigate('Search'); }}><Ionicons name="search-outline" size={24} color="#FFF" /></TouchableOpacity>
                    <View style={styles.iconWrapper}><NotificationBell onPress={() => { lightTap(); setShowNotifications(true); }} /></View>
                    <TouchableOpacity activeOpacity={0.7} style={styles.iconWrapper} onPress={() => { lightTap(); navigation.navigate('Plan'); }}><Ionicons name="calendar-outline" size={24} color="#FFF" /></TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} style={styles.iconWrapper} onPress={() => { lightTap(); setShowSettingsModal(true); }}><Ionicons name="settings-outline" size={24} color="#FFF" /></TouchableOpacity>
                </View>
            </View>
            <Text style={styles.screenTitle}>Community</Text>
            <View style={{ height: 50 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
                    {['Feed', 'Explore', 'Leaderboards', 'Clubs', 'Challenges'].map((tab) => (
                        <TouchableOpacity activeOpacity={0.7} key={tab} style={styles.tabItem} onPress={() => { lightTap(); setActiveTab(tab); }}>
                            <Text style={[styles.tabText, activeTab === tab ? styles.tabTextActive : styles.tabTextInactive]}>{tab}</Text>
                            {activeTab === tab && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    const renderLeaderboard = () => {
        const top3 = leaderboardData.slice(0, 3);
        const rest = leaderboardData.slice(3);
        const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
        const podiumHeights = [110, 80, 60];
        const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd

        return (
            <View style={styles.leaderboardContainer}>
                {/* SCOPE & TIME FILTERS */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {[['Global', 'globe-outline'], ['Lebanon', '🇱🇧'], ['Friends', 'people-outline']].map(([label, icon]) => {
                        const isActive = activeScope === label;
                        return (
                            <TouchableOpacity key={label} onPress={() => { lightTap(); setActiveScope(label); }}
                                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: isActive ? COLORS.accent : '#1C1C1E', borderWidth: 1, borderColor: isActive ? COLORS.accent : '#333' }}>
                                {icon.length > 2
                                    ? <Ionicons name={icon} size={14} color={isActive ? '#000' : '#888'} style={{ marginRight: 5 }} />
                                    : <Text style={{ marginRight: 5, fontSize: 13 }}>{icon}</Text>}
                                <Text style={{ color: isActive ? '#000' : '#888', fontSize: 12, fontFamily: 'Poppins_600SemiBold' }}>{label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                    {[['Weekly', true], ['All-Time', false]].map(([label]) => (
                        <FilterButton key={label} label={label} isActive={activeTime === label}
                            onPress={() => { lightTap(); setActiveTime(label); if (label === 'Weekly') setDateLabel(getCurrentWeekRange()); else setDateLabel('All Time'); }} />
                    ))}
                </View>

                {leaderboardData.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingTop: 60 }}>
                        <Ionicons name="trophy-outline" size={52} color="#2A2A2A" />
                        <Text style={{ color: '#444', marginTop: 16, fontFamily: 'Poppins_600SemiBold', fontSize: 16 }}>No runners yet</Text>
                        <Text style={{ color: '#333', marginTop: 6, fontFamily: 'Poppins_400Regular', fontSize: 13, textAlign: 'center' }}>
                            {activeScope === 'Friends' ? 'Follow other runners to see them here' : 'Complete a run to claim your spot!'}
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* TOP 3 PODIUM */}
                        {top3.length >= 2 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 28, paddingHorizontal: 10 }}>
                                {podiumOrder.map((idx) => {
                                    const p = top3[idx];
                                    if (!p) return <View key={idx} style={{ flex: 1 }} />;
                                    const isFirst = idx === 0;
                                    return (
                                        <View key={p.id} style={{ flex: 1, alignItems: 'center' }}>
                                            {/* Crown for #1 */}
                                            {isFirst && <Ionicons name="trophy" size={22} color="#FFD700" style={{ marginBottom: 4 }} />}
                                            <Image source={p.avatar ? { uri: p.avatar } : require('../../assets/icon.png')}
                                                style={{ width: isFirst ? 60 : 48, height: isFirst ? 60 : 48, borderRadius: isFirst ? 30 : 24, borderWidth: 2, borderColor: medalColors[idx], marginBottom: 6 }} />
                                            <Text style={{ color: '#FFF', fontSize: 11, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' }} numberOfLines={1}>{p.name?.split(' ')[0]}</Text>
                                            <Text style={{ color: COLORS.accent, fontSize: 11, fontFamily: 'Poppins_700Bold', marginBottom: 4 }}>{(p.displayDistance || 0).toFixed(1)} km</Text>
                                            <View style={{ width: '90%', height: podiumHeights[idx], backgroundColor: medalColors[idx] + '22', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderBottomWidth: 0, borderColor: medalColors[idx] + '55', alignItems: 'center', justifyContent: 'center' }}>
                                                <Text style={{ color: medalColors[idx], fontSize: 20, fontFamily: 'Poppins_800ExtraBold' }}>{p.rank}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* REST OF LEADERBOARD */}
                        {rest.map((item) => (
                            <CommunityLeaderboardItem key={item.id} item={item} navigation={navigation} />
                        ))}

                        {/* Show top3 as rows if podium didn't render */}
                        {top3.length < 2 && top3.map((item) => (
                            <CommunityLeaderboardItem key={item.id} item={item} navigation={navigation} />
                        ))}
                    </>
                )}
            </View>
        );
    };

    const handleJoinPress = (club) => {
        lightTap();
        if (club.requestSent) { Alert.alert("Cancel Request", `Cancel join request?`, [{ text: "No", style: "cancel" }, { text: "Yes", onPress: () => toggleClubMembership(club.id) }]); }
        else { toggleClubMembership(club.id); }
    };

    const calculateChallengeProgress = (challenge) => challengeService.getChallengeProgress(challenge, userData?.runHistory || []);

    const renderExplore = () => {
        try {
            const postsWithRoutes = (feedData || []).filter(p => p.routePath && p.routePath.length > 1 && !p.hideMap);

            const communityRoutes = postsWithRoutes;
            const displayRoutes = [...communityRoutes, ...CURATED_ROUTES];
            const filtered = exploreFilter === 'All' ? displayRoutes
                : exploreFilter === 'Community' ? communityRoutes
                : CURATED_ROUTES;
            const diffColor = (d) => d === 'Easy' ? '#4CD964' : d === 'Hard' ? '#FF3B30' : '#FF9500';

            return (
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    {/* MAP HERO */}
                    <View style={{ height: 300 }}>
                        <MapView
                            style={StyleSheet.absoluteFill}
                            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                            customMapStyle={DARK_MAP_STYLE}
                            initialRegion={{ latitude: userData?.location?.latitude || 33.8938, longitude: userData?.location?.longitude || 35.5018, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
                            showsUserLocation={true}
                        >
                            {communityRoutes.map(post => (
                                <Polyline key={post.id} coordinates={post.routePath}
                                    strokeColor={selectedRoute?.id === post.id ? '#FFF' : COLORS.accent}
                                    strokeWidth={selectedRoute?.id === post.id ? 5 : 3}
                                    tappable={true} onPress={() => setSelectedRoute(post)} />
                            ))}
                            {selectedRoute?.routePath?.length > 0 && (
                                <Marker coordinate={selectedRoute.routePath[0]}>
                                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.accent, borderWidth: 2, borderColor: '#FFF' }} />
                                </Marker>
                            )}
                        </MapView>
                        <View style={{ position: 'absolute', top: 14, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="navigate-circle" size={16} color={COLORS.accent} />
                                <Text style={{ color: '#FFF', fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginLeft: 6 }}>Explore Routes</Text>
                            </View>
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.accent, marginRight: 6 }} />
                                <Text style={{ color: '#FFF', fontSize: 11, fontFamily: 'Poppins_500Medium' }}>{communityRoutes.length} route{communityRoutes.length !== 1 ? 's' : ''}</Text>
                            </View>
                        </View>
                    </View>

                    {/* BOTTOM SHEET */}
                    <View style={{ flex: 1, backgroundColor: '#0A0A0A', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingTop: 12 }}>
                        <View style={{ width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 14 }} />
                        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 14, gap: 8 }}>
                            {['All', 'Community', 'Featured'].map(f => (
                                <TouchableOpacity key={f} onPress={() => { lightTap(); setExploreFilter(f); }}
                                    style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: exploreFilter === f ? COLORS.accent : '#1C1C1E', borderWidth: 1, borderColor: exploreFilter === f ? COLORS.accent : '#333' }}>
                                    <Text style={{ color: exploreFilter === f ? '#000' : '#888', fontSize: 12, fontFamily: 'Poppins_600SemiBold' }}>{f}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
                            {filtered.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                                    <Ionicons name="map-outline" size={48} color="#333" />
                                    <Text style={{ color: '#555', marginTop: 12, fontFamily: 'Poppins_500Medium', textAlign: 'center' }}>No community routes yet.{'\n'}Complete a run to add yours!</Text>
                                </View>
                            ) : filtered.map(route => {
                                const isSelected = selectedRoute?.id === route.id;
                                const isCurated = String(route.id).startsWith('c');
                                return (
                                    <TouchableOpacity key={route.id} activeOpacity={0.8}
                                        onPress={() => { lightTap(); setSelectedRoute(isSelected ? null : route); }}
                                        style={{ backgroundColor: isSelected ? '#1E1E1E' : '#141414', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: isSelected ? COLORS.accent : '#222', flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isSelected ? COLORS.accent + '22' : '#222', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                            <Ionicons name={isCurated ? 'star' : 'person'} size={22} color={isCurated ? COLORS.accent : '#5AC8FA'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                                                <Text style={{ color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold', flex: 1 }} numberOfLines={1}>{route.title}</Text>
                                                {route.difficulty && (
                                                    <View style={{ backgroundColor: diffColor(route.difficulty) + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                                                        <Text style={{ color: diffColor(route.difficulty), fontSize: 10, fontFamily: 'Poppins_700Bold' }}>{route.difficulty}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={{ color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular', marginBottom: 8 }}>by {route.user}</Text>
                                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                                {[
                                                    { icon: 'navigate-outline', val: `${route.stats?.km} km` },
                                                    { icon: 'time-outline', val: route.stats?.time },
                                                    { icon: 'speedometer-outline', val: `${route.stats?.pace}/km` },
                                                ].map(({ icon, val }) => (
                                                    <View key={icon} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Ionicons name={icon} size={11} color="#666" />
                                                        <Text style={{ color: '#999', fontSize: 11, fontFamily: 'Poppins_600SemiBold', marginLeft: 3 }}>{val}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                        {!isCurated && (
                                            <TouchableOpacity style={{ marginLeft: 10, padding: 8 }} onPress={() => { lightTap(); saveRoute(route); Alert.alert('Saved!', 'Route saved to your profile.'); }}>
                                                <Ionicons name="bookmark-outline" size={20} color={COLORS.accent} />
                                            </TouchableOpacity>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            );
        } catch (error) {
            console.error("Explore tab error:", error);
            return (
                <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="alert-circle-outline" size={48} color="#333" />
                    <Text style={{ color: '#555', marginTop: 12, fontFamily: 'Poppins_500Medium' }}>Unable to load map</Text>
                </View>
            );
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {renderHeader()}
                <ScrollView contentContainerStyle={(activeTab === 'Explore' || activeTab === 'Clubs') ? { flex: 1 } : styles.scrollContent} showsVerticalScrollIndicator={false} scrollEnabled={activeTab !== 'Explore' && activeTab !== 'Clubs'}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => {
                                setIsRefreshing(true);
                                // Toggle feedScope to re-trigger Firestore listener
                                setFeedScope(prev => { const tmp = prev === 'Global' ? 'Following' : 'Global'; setTimeout(() => setFeedScope(prev), 100); return tmp; });
                                setTimeout(() => setIsRefreshing(false), 1000);
                            }}
                            tintColor="#CCFF00"
                            colors={['#CCFF00']}
                            progressBackgroundColor="#1C1C1E"
                        />
                    }
                >
                    {activeTab === 'Feed' && (
                        <FeedTab
                            feedData={feedData}
                            feedScope={feedScope}
                            setFeedScope={setFeedScope}
                            navigation={navigation}
                            onOpenOptions={handleOpenOptions}
                            onOpenComments={handleOpenComments}
                            onCheer={handleCheer}
                            showComments={showComments}
                            setShowComments={setShowComments}
                            realComments={realComments}
                            commentText={commentText}
                            setCommentText={setCommentText}
                            replyTo={replyTo}
                            setReplyTo={setReplyTo}
                            handleSendComment={handleSendComment}
                            showOptions={showOptions}
                            setShowOptions={setShowOptions}
                            selectedPost={selectedPost}
                            handleOptionSelect={handleOptionSelect}
                            user={user}
                            userData={userData}
                            isLoading={isInitialLoad}
                        />
                    )}
                    {activeTab === 'Explore' && renderExplore()}
                    {activeTab === 'Clubs' && (
                        <ClubsTab
                            clubs={clubs}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            navigation={navigation}
                            handleJoinPress={handleJoinPress}
                        />
                    )}
                    {activeTab === 'Challenges' && (
                        <ChallengesTab
                            challenges={challenges}
                            toggleChallengeJoin={toggleChallengeJoin}
                            handleChallengePress={handleChallengePress}
                            showChallengeModal={showChallengeModal}
                            setShowChallengeModal={setShowChallengeModal}
                            selectedChallenge={selectedChallenge}
                            calculateChallengeProgress={calculateChallengeProgress}
                        />
                    )}
                </ScrollView>
            </SafeAreaView>

            <FloatingNavBar current="Community" />

            {/* ── NOTIFICATIONS MODAL ── */}
            <Modal animationType="slide" transparent visible={showNotifications} onRequestClose={() => setShowNotifications(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowNotifications(false)} />
                    <View style={styles.notificationSheet}>
                        <View style={styles.notifHeader}>
                            <Text style={styles.notifHeaderTitle}>Notifications</Text>
                            <TouchableOpacity onPress={() => { markAllAsRead(); lightTap(); }}>
                                <Text style={styles.markReadText}>Mark All Read</Text>
                            </TouchableOpacity>
                        </View>
                        {(!notifications || notifications.length === 0) ? (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="notifications-off-outline" size={48} color="#444" />
                                <Text style={{ color: '#666', marginTop: 12, fontFamily: 'Poppins_400Regular' }}>No notifications yet</Text>
                            </View>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {notifications.map((notif) => (
                                    <View key={notif.id} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#333' }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: notif.read ? '#333' : 'rgba(204,255,0,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                                            <Ionicons name={notif.type === 'cheer_up' ? 'flame' : notif.type === 'run_complete' ? 'checkmark-circle' : 'notifications'} size={18} color={notif.read ? '#666' : COLORS.accent} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: notif.read ? '#AAA' : '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14 }}>{notif.title}</Text>
                                            {notif.desc ? <Text style={{ color: '#888', fontFamily: 'Poppins_400Regular', fontSize: 12, marginTop: 2 }}>{notif.desc}</Text> : null}
                                        </View>
                                        {!notif.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent, marginTop: 4 }} />}
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ── SETTINGS MODAL ── */}
            <Modal animationType="slide" transparent visible={showSettingsModal} onRequestClose={() => setShowSettingsModal(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowSettingsModal(false)} />
                    <View style={[styles.optionsSheet, { paddingBottom: 40 }]}>
                        <View style={styles.optionsHeader}>
                            <Text style={styles.optionsTitle}>Community Settings</Text>
                        </View>
                        <TouchableOpacity style={styles.optionItem} onPress={() => { setShowSettingsModal(false); navigation.navigate('PrivacyControls'); }}>
                            <Ionicons name="shield-checkmark-outline" size={24} color="#FFF" />
                            <Text style={styles.optionText}>Privacy Controls</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.optionItem} onPress={() => { setShowSettingsModal(false); navigation.navigate('NotificationSettings'); }}>
                            <Ionicons name="notifications-outline" size={24} color="#FFF" />
                            <Text style={styles.optionText}>Notification Settings</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.optionItem} onPress={() => { setShowSettingsModal(false); navigation.navigate('BlockedUsers'); }}>
                            <Ionicons name="ban-outline" size={24} color="#FFF" />
                            <Text style={styles.optionText}>Blocked &amp; Muted Users</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => { lightTap(); setShowSettingsModal(false); }}>
                            <Text style={styles.cancelText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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