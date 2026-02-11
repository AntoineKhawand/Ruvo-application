import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, ImageBackground, KeyboardAvoidingView, Modal, Platform, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');

const COLORS = {
    accent: "#CCFF00",
    primary: "#000000",
    secondary: "#1C1C1E",
    danger: "#FF3B30",
    text: "#FFFFFF"
};

const generateMembers = (countStr, isCustom, userAvatar, userName) => {
    const count = parseInt(countStr) || 10;
    const members = [];
    const mockNames = ["Sarah Lee", "Ahmed Hassan", "Omar Kanaan", "Sovli", "Lina Safi", "Karim Mansour", "Nour Farah", "Rami Khalil", "Maya Habib"];
    members.push({ id: 'me', name: userName, role: isCustom ? 'Creator' : 'Member', avatar: userAvatar, isCurrentUser: true, distance: 67.8 });
    for (let i = 0; i < count; i++) {
        members.push({
            id: `m${i}`,
            name: mockNames[i % mockNames.length] + (i > 8 ? ` ${i}` : ''),
            role: i === 0 && !isCustom ? 'Creator' : (i === 1 ? 'Admin' : 'Member'),
            avatar: `https://randomuser.me/api/portraits/${i % 2 === 0 ? 'women' : 'men'}/${(i * 5) % 70}.jpg`,
            isCurrentUser: false,
            distance: parseFloat((Math.random() * 60 + 40).toFixed(1))
        });
    }
    return members.sort((a, b) => b.distance - a.distance);
};

export default function ClubDetailScreen({ route, navigation }) {
    const { user, userData, toggleClubMembership, followUser, unfollowUser, clubFeeds, addClubPost, addClubComment, sendFriendRequest, cancelFriendRequest, addTemporaryUsers, updateClub, deleteClub, toggleClubPostLike } = useUser();
    const { clubData } = route.params || {};

    const isCustom = clubData.isCustom || false;
    const isAdmin = clubData.role === 'admin' || clubData.role === 'creator';
    const currentUserAvatar = userData.avatar || 'https://i.pravatar.cc/150?u=you';
    const currentUserName = userData.name || 'You';

    const [status, setStatus] = useState(clubData.joined ? 'joined' : 'none');
    const [activeTab, setActiveTab] = useState('Feed');

    // Modals
    const [showMenu, setShowMenu] = useState(false);
    const [showManagementModal, setShowManagementModal] = useState(false);
    const [showUserManagementModal, setShowUserManagementModal] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [showManageMembers, setShowManageMembers] = useState(false);

    const [showAchievementModal, setShowAchievementModal] = useState(false);

    const [membersList, setMembersList] = useState([]);
    const [newPostText, setNewPostText] = useState('');
    const [attachedImage, setAttachedImage] = useState(null);
    const [attachedAchievement, setAttachedAchievement] = useState(null);

    const [memberSearch, setMemberSearch] = useState('');
    const [currentPostId, setCurrentPostId] = useState(null);
    const [commentText, setCommentText] = useState('');
    const [reminderData, setReminderData] = useState({ text: '', date: 'Tomorrow', time: '6:00 AM', location: 'Club Meeting Point' });
    const [feedItems, setFeedItems] = useState([]);

    useEffect(() => {
        if (!clubData.id) return;

        // Real-time listener for club posts
        const q = query(
            collection(db, "clubs", clubData.id, "posts"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => {
                const data = doc.data();
                // Format timestamp for display
                const timeAgo = data.createdAt ? formatTimestamp(data.createdAt) : 'Just now';

                return {
                    id: doc.id,
                    user: data.userName || 'Unknown',
                    avatar: data.userAvatar,
                    role: data.role || 'Member',
                    time: timeAgo,
                    text: data.text || '',
                    image: data.image,
                    achievement: data.achievement,
                    event: data.event,
                    likes: data.likes || 0,
                    liked: data.likedBy?.includes(user?.uid) || false,
                    comments: data.comments || [],
                    saved: false
                };
            });
            setFeedItems(posts);
            console.log(`📡 Club feed updated: ${posts.length} posts`);
        });

        // Generate members (keep existing logic)
        const generated = generateMembers(clubData.members, isCustom, currentUserAvatar, currentUserName);
        setMembersList(generated);
        addTemporaryUsers(generated);

        return () => unsubscribe();
    }, [clubData.id]);

    // Helper function to format timestamp
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return date.toLocaleDateString();
    };

    // --- ACTIONS ---
    const handleJoinAction = () => { if (status === 'none') { setStatus('joined'); toggleClubMembership(clubData.id); Alert.alert("Welcome!", `You joined ${clubData.name}.`); } };

    const handleLeaveClub = () => {
        setShowMenu(false);
        setShowUserManagementModal(false);
        setTimeout(() => { Alert.alert("Leave Club?", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Leave", style: "destructive", onPress: () => { setStatus('none'); toggleClubMembership(clubData.id); navigation.goBack(); } }]); }, 500);
    };

    const handleShareClub = () => { setShowMenu(false); setShowManagementModal(false); setShowUserManagementModal(false); setTimeout(async () => { try { await Share.share({ message: `Check out the "${clubData.name}" running club on Ruvo! 🏃‍♂️💨\n\nJoin us here: https://ruvo.app/club/${clubData.id}` }); } catch (e) { } }, 500); };
    const handleInvite = () => { setShowMenu(false); setShowManagementModal(false); setShowUserManagementModal(false); setTimeout(async () => { try { await Share.share({ message: `Hey! I'm inviting you to join the "${clubData.name}" club on Ruvo. Let's run together! 👟\n\nhttps://ruvo.app/invite/${clubData.id}` }); } catch (e) { } }, 500); };

    const handleReportClub = () => { setShowUserManagementModal(false); setTimeout(() => { Alert.alert("Report Received", "Thank you. We will review this club for community guideline violations."); }, 500); };
    const handleManageNotifications = () => { setShowMenu(false); setShowUserManagementModal(false); setTimeout(() => { Alert.alert("Notification Settings", "Choose what you want to see:", [{ text: "All Posts", onPress: () => Alert.alert("Updated", "You will be notified for all posts.") }, { text: "Highlights Only", onPress: () => Alert.alert("Updated", "You will see highlights only.") }, { text: "Mute", style: 'destructive', onPress: () => Alert.alert("Muted", "Notifications muted for this club.") }, { text: "Cancel", style: 'cancel' }]); }, 500); };

    const handleDisband = () => { setShowManagementModal(false); setTimeout(() => { Alert.alert("Disband Club?", "This action cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Disband", style: "destructive", onPress: () => { deleteClub(clubData.id); navigation.canGoBack() ? navigation.popToTop() : navigation.navigate('Community'); } }]); }, 500); };
    const handlePrivacyChange = () => { setShowManagementModal(false); setTimeout(() => { Alert.alert("Change Privacy", "Select the new privacy setting:", [{ text: "Cancel", style: "cancel" }, { text: "Set to Public", onPress: () => { updateClub(clubData.id, { type: 'public' }); Alert.alert("Success", "Club is now Public."); } }, { text: "Set to Private", onPress: () => { updateClub(clubData.id, { type: 'private' }); Alert.alert("Success", "Club is now Private."); } }]); }, 500); };
    const handleEditProfile = () => { setShowManagementModal(false); setTimeout(() => { Alert.alert("Edit Club Profile", "What would you like to change?", [{ text: "Cancel", style: "cancel" }, { text: "Change Name", onPress: () => { Alert.prompt("Edit Name", "Enter new club name:", (text) => { if (text) { updateClub(clubData.id, { name: text }); navigation.setParams({ clubData: { ...clubData, name: text } }); } }); } }, { text: "Change Cover Image", onPress: async () => { try { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 }); if (!result.canceled) { const newImage = result.assets[0].uri; updateClub(clubData.id, { image: newImage }); navigation.setParams({ clubData: { ...clubData, image: newImage } }); } } catch (e) { Alert.alert("Error", "Could not pick image"); } } }]); }, 500); };
    const handleManageMembers = () => { setShowMenu(false); setShowManagementModal(false); setShowManageMembers(true); };
    const kickMember = (id) => { Alert.alert("Kick User", "Remove this user?", [{ text: "Cancel", style: "cancel" }, { text: "Kick", style: "destructive", onPress: () => { setMembersList(prev => prev.filter(m => m.id !== id)); } }]); };

    const pickImage = async () => { try { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 }); if (!result.canceled) setAttachedImage(result.assets[0].uri); } catch (error) { Alert.alert("Error", "Could not open gallery."); } };

    // --- CALCULATE SHAREABLE STATS ---
    const getShareableStats = () => {
        const history = userData.runHistory || [];
        const achievements = [];

        // 1. Longest Run
        const distances = history.map(r => parseFloat(r.distance) || 0);
        const longest = distances.length > 0 ? Math.max(...distances).toFixed(2) : 0;
        if (longest > 0) {
            achievements.push({ id: 'longest', title: 'Longest Run', value: `${longest} km`, icon: 'flame', color: '#FF5722', desc: 'Maximum distance covered' });
        }

        // 2. 5K PB
        const runs5k = history.filter(r => parseFloat(r.distance) >= 5.0);
        if (runs5k.length > 0) {
            const best = runs5k.sort((a, b) => a.duration.localeCompare(b.duration))[0];
            achievements.push({ id: '5k', title: '5K Best', value: best.duration, icon: 'medal', color: '#FFC107', desc: 'Fastest 5K run' });
        }

        // 3. 10K PB
        const runs10k = history.filter(r => parseFloat(r.distance) >= 10.0);
        if (runs10k.length > 0) {
            const best = runs10k.sort((a, b) => a.duration.localeCompare(b.duration))[0];
            achievements.push({ id: '10k', title: '10K Best', value: best.duration, icon: 'trophy', color: '#4CAF50', desc: 'Fastest 10K run' });
        }

        // 4. Half Marathon (21.1k)
        const runsHalf = history.filter(r => parseFloat(r.distance) >= 21.0);
        if (runsHalf.length > 0) {
            const best = runsHalf.sort((a, b) => a.duration.localeCompare(b.duration))[0];
            achievements.push({ id: 'half', title: 'Half Marathon', value: best.duration, icon: 'ribbon', color: '#2196F3', desc: 'Fastest 21.1K run' });
        }

        // 5. Marathon (42.2k)
        const runsFull = history.filter(r => parseFloat(r.distance) >= 42.0);
        if (runsFull.length > 0) {
            const best = runsFull.sort((a, b) => a.duration.localeCompare(b.duration))[0];
            achievements.push({ id: 'full', title: 'Marathon', value: best.duration, icon: 'crown', color: '#9C27B0', desc: 'Fastest 42.2K run' });
        }

        return achievements;
    };

    const handleSelectAchievement = (achievement) => {
        setAttachedAchievement(achievement);
        setShowAchievementModal(false);
    };

    const handlePost = async (type = 'text') => {
        if (type === 'text' && !newPostText.trim() && !attachedImage && !attachedAchievement) return;

        const isReminder = type === 'reminder';
        const postData = {
            role: isAdmin ? 'Admin' : 'Member',
            text: isReminder ? `Reminder: ${newPostText || 'Upcoming Group Run!'}` : newPostText,
            image: attachedImage,
            achievement: attachedAchievement,
            event: isReminder ? {
                time: `${reminderData.date}, ${reminderData.time}`,
                loc: reminderData.location
            } : null
        };

        // Add to Firestore (onSnapshot will update UI)
        await addClubPost(clubData.id, postData);

        // Clear input
        setNewPostText('');
        setAttachedImage(null);
        setAttachedAchievement(null);

        if (isReminder) Alert.alert("Success", "Reminder posted.");
    };

    const postReminder = () => { if (!reminderData.text.trim()) { Alert.alert("Error", "Enter message."); return; } const newPost = { id: Date.now().toString(), user: currentUserName, avatar: currentUserAvatar, role: 'Admin', time: 'Just now', text: `Reminder: ${reminderData.text}`, likes: 0, comments: [], liked: false, event: { time: `${reminderData.date}, ${reminderData.time}`, loc: reminderData.location } }; setFeedItems([newPost, ...feedItems]); addClubPost(clubData.id, newPost); setShowReminderModal(false); setReminderData({ text: '', date: 'Tomorrow', time: '6:00 AM', location: 'Club Meeting Point' }); };

    // --- TOGGLE LIKE (Firestore handles UI update via onSnapshot) ---
    const toggleLike = async (id) => {
        await toggleClubPostLike(clubData.id, id);
    };

    const openComments = (postId) => { setCurrentPostId(postId); setShowComments(true); };
    const handleSendComment = () => { if (!commentText.trim()) return; const newComment = { id: Date.now().toString(), user: currentUserName, avatar: currentUserAvatar, text: commentText, time: 'Just now' }; setFeedItems(prev => prev.map(item => item.id === currentPostId ? { ...item, comments: [...(item.comments || []), newComment] } : item)); addClubComment(clubData.id, currentPostId, newComment); setCommentText(''); };
    const handleReply = (userName) => { setCommentText(`@${userName} `); };
    const openMemberProfile = (id) => { if (id === 'me') navigation.navigate('Profile'); else navigation.navigate('UserProfile', { userId: id }); };

    // --- RENDERERS ---
    const MemberItem = ({ item, index }) => {
        const isFriend = userData.following.includes(item.id);
        const isRequested = userData.requests.includes(item.id);
        const handleFriendAction = () => {
            if (isFriend) Alert.alert("Unfollow", `Stop following ${item.name}?`, [{ text: "Cancel", style: "cancel" }, { text: "Unfollow", onPress: () => unfollowUser(item.id) }]);
            else if (isRequested) Alert.alert("Cancel Request", `Cancel request to ${item.name}?`, [{ text: "No", style: "cancel" }, { text: "Yes", onPress: () => cancelFriendRequest(item.id) }]);
            else followUser(item.id, item);
        };
        return (
            <View style={styles.memberRow}>
                <Text style={styles.memberRank}>{index + 1}.</Text>
                <TouchableOpacity onPress={() => openMemberProfile(item.id)}><Image source={{ uri: item.avatar }} style={styles.memberAvatar} /></TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <TouchableOpacity onPress={() => openMemberProfile(item.id)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={styles.memberName}>{item.name}</Text>{(item.role === 'Creator' || item.role === 'Admin') && <MaterialCommunityIcons name="shield-check" size={14} color={COLORS.accent} style={{ marginLeft: 6 }} />}</View>
                        <Text style={styles.memberRoleText}>{item.role}</Text>
                    </TouchableOpacity>
                </View>
                {!item.isCurrentUser && (
                    <TouchableOpacity style={styles.friendActionBtn} onPress={handleFriendAction}>
                        {isFriend ? (<View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="checkmark-circle" size={20} color={COLORS.accent} /><Text style={styles.friendLabel}>Friends</Text></View>) : isRequested ? (<View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="time-outline" size={20} color="#888" /><Text style={[styles.followLabel, { color: '#888' }]}>Requested</Text></View>) : (<View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="add-circle" size={20} color="#888" /><Text style={styles.followLabel}>Follow</Text></View>)}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const LeaderboardItem = ({ item, index }) => {
        const isMe = item.isCurrentUser;
        const rank = index + 1;
        let rankColor = '#888'; if (rank === 1) rankColor = '#FFD700'; else if (rank === 2) rankColor = '#C0C0C0'; else if (rank === 3) rankColor = '#CD7F32';
        return (
            <View style={[styles.lbCard, isMe && styles.lbCardCurrent]}>
                <Text style={[styles.lbRankNum, { color: rankColor }]}>{rank}</Text>
                <TouchableOpacity onPress={() => openMemberProfile(item.id)}><Image source={{ uri: item.avatar }} style={styles.lbAvatar} /></TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 15 }}><TouchableOpacity onPress={() => openMemberProfile(item.id)}><Text style={[styles.lbName, isMe && { color: COLORS.accent }]}>{item.name}</Text></TouchableOpacity></View>
                <Text style={[styles.lbDistance, isMe && { color: COLORS.accent }]}>{item.distance.toFixed(1)} km</Text>
            </View>
        );
    };

    const currentPostComments = feedItems.find(p => p.id === currentPostId)?.comments || [];
    const shareableStats = getShareableStats();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ImageBackground source={{ uri: clubData.image || 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=1000' }} style={styles.headerBg}>
                <View style={styles.headerOverlay}>
                    <SafeAreaView edges={['top']}>
                        <View style={styles.navRow}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
                            <Text style={styles.headerTitle}>Club</Text>
                            <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.menuBtn}><Ionicons name="ellipsis-vertical" size={24} color="#FFF" /></TouchableOpacity>
                        </View>
                        <View style={styles.clubHeaderContent}>
                            <View style={[styles.clubLogo, { backgroundColor: clubData.color || (clubData.icon ? COLORS.accent : 'transparent'), borderColor: clubData.color || COLORS.accent }]}>{clubData.icon && <MaterialCommunityIcons name={clubData.icon} size={32} color="#000" />}</View>
                            <View style={styles.clubMeta}><Text style={styles.clubName}>{clubData.name}</Text><Text style={styles.clubMembers}>{clubData.members}</Text></View>
                        </View>
                        <View style={styles.actionRow}>
                            {status === 'joined' ? (<View style={styles.joinedBadge}><Ionicons name="checkmark" size={16} color="#FFF" /><Text style={styles.joinedText}>Joined</Text></View>) : (<TouchableOpacity style={styles.joinBtnMain} onPress={handleJoinAction}><Text style={styles.joinBtnTextMain}>Join Club</Text></TouchableOpacity>)}
                            {status === 'joined' && (
                                <TouchableOpacity style={styles.settingsIcon} onPress={() => isAdmin ? setShowManagementModal(true) : setShowUserManagementModal(true)}>
                                    <Ionicons name="settings" size={20} color={COLORS.accent} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </SafeAreaView>
                </View>
            </ImageBackground>

            <View style={styles.tabContainer}>{['Feed', 'Leaderboard', 'Members'].map(tab => (<TouchableOpacity key={tab} style={styles.tabBtn} onPress={() => setActiveTab(tab)}><Text style={[styles.tabText, activeTab === tab ? { color: COLORS.accent } : { color: '#888' }]}>{tab}</Text>{activeTab === tab && <View style={styles.activeLine} />}</TouchableOpacity>))}</View>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                {activeTab === 'Feed' && (
                    <View style={{ flex: 1 }}>
                        {status === 'joined' && (
                            <View style={styles.postInputContainer}>
                                {(attachedImage || attachedAchievement) && (
                                    <View style={styles.attachmentPreviewRow}>
                                        {attachedImage && (
                                            <View style={styles.imagePreview}>
                                                <Image source={{ uri: attachedImage }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                                                <TouchableOpacity style={styles.removeImage} onPress={() => setAttachedImage(null)}><Ionicons name="close-circle" size={20} color="#FF3B30" /></TouchableOpacity>
                                            </View>
                                        )}
                                        {attachedAchievement && (
                                            <View style={[styles.achievementPreview, { backgroundColor: attachedAchievement.color + '15', borderColor: attachedAchievement.color }]}>
                                                <View style={[styles.achIconCircle, { backgroundColor: attachedAchievement.color + '30' }]}>
                                                    <Ionicons name={attachedAchievement.icon} size={16} color={attachedAchievement.color} />
                                                </View>
                                                <View style={{ marginLeft: 10 }}>
                                                    <Text style={{ color: attachedAchievement.color, fontWeight: 'bold', fontSize: 14 }}>{attachedAchievement.value}</Text>
                                                    <Text style={{ color: '#AAA', fontSize: 10 }}>{attachedAchievement.title}</Text>
                                                </View>
                                                <TouchableOpacity style={styles.removeImage} onPress={() => setAttachedAchievement(null)}><Ionicons name="close-circle" size={20} color="#FF3B30" /></TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                )}

                                <View style={styles.postInputBox}>
                                    <Image source={{ uri: currentUserAvatar }} style={styles.inputAvatar} />
                                    <TextInput
                                        style={styles.realInput}
                                        placeholder={isAdmin ? "Share update or reminder..." : "Share with your club..."}
                                        placeholderTextColor="#666"
                                        value={newPostText}
                                        onChangeText={setNewPostText}
                                        textContentType="none" autoComplete="off" importantForAutofill="no"
                                    />

                                    <TouchableOpacity onPress={pickImage} style={{ marginRight: 15 }}>
                                        <Ionicons name={attachedImage ? "image" : "camera-outline"} size={22} color={attachedImage ? COLORS.accent : "#888"} />
                                    </TouchableOpacity>

                                    {/* OPEN VISUAL ACHIEVEMENT MODAL */}
                                    <TouchableOpacity onPress={() => setShowAchievementModal(true)} style={{ marginRight: 10 }}>
                                        <Ionicons name={attachedAchievement ? "trophy" : "trophy-outline"} size={22} color={attachedAchievement ? "#FFD700" : "#888"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => handlePost('text')}>
                                        <Ionicons name="send" size={20} color={(newPostText || attachedImage || attachedAchievement) ? COLORS.accent : '#444'} />
                                    </TouchableOpacity>
                                </View>
                                {isAdmin && (<View style={styles.adminToolsRow}><TouchableOpacity style={styles.adminToolBtn} onPress={() => setShowReminderModal(true)}><Ionicons name="calendar" size={16} color={COLORS.accent} /><Text style={styles.adminToolText}>Post Reminder</Text></TouchableOpacity></View>)}
                            </View>
                        )}
                        <FlatList
                            data={feedItems}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ padding: 15, paddingTop: 0 }}
                            ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>No posts yet.</Text>}
                            renderItem={({ item }) => (
                                <View style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <TouchableOpacity onPress={() => openMemberProfile(item.user)}><Image source={{ uri: item.avatar }} style={styles.cardAvatar} /></TouchableOpacity>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <TouchableOpacity onPress={() => openMemberProfile(item.user)}><Text style={styles.cardUser}>{item.user}</Text></TouchableOpacity>
                                                <View style={[styles.roleBadge, { backgroundColor: item.role === 'Admin' ? 'rgba(178, 255, 89, 0.2)' : '#333' }]}><Text style={[styles.roleText, item.role === 'Admin' && { color: COLORS.accent }]}>{item.role}</Text></View>
                                            </View>
                                            <Text style={styles.cardTime}>{item.time}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.cardBody}>{item.text}</Text>

                                    {/* RENDER ACHIEVEMENT BOX (CARD STYLE) */}
                                    {item.achievement && (
                                        <View style={[styles.achievementBox, { borderColor: item.achievement.color }]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <View style={[styles.achIconLarge, { backgroundColor: item.achievement.color + '20' }]}>
                                                    <Ionicons name={item.achievement.icon} size={30} color={item.achievement.color} />
                                                </View>
                                                <View style={{ marginLeft: 15 }}>
                                                    <Text style={[styles.achievementValue, { color: item.achievement.color }]}>{item.achievement.value}</Text>
                                                    <Text style={styles.achievementLabel}>{item.achievement.title}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    )}

                                    {item.image && <Image source={{ uri: item.image }} style={styles.postImage} />}
                                    {item.event && (<View style={styles.eventSnippet}><View style={{ flexDirection: 'row', marginBottom: 5 }}><Ionicons name="calendar" size={16} color={COLORS.accent} /><Text style={styles.eventText}>{item.event.time}</Text></View><View style={{ flexDirection: 'row' }}><Ionicons name="location" size={16} color="#888" /><Text style={[styles.eventText, { color: '#888' }]}>{item.event.loc}</Text></View></View>)}
                                    <View style={styles.cardActions}>
                                        <TouchableOpacity onPress={() => toggleLike(item.id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name={item.liked ? "heart" : "heart-outline"} size={20} color={item.liked ? "#FF3B30" : "#888"} />
                                            <Text style={[styles.actionText, item.liked && { color: "#FF3B30" }]}>{item.likes}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => openComments(item.id)} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 15 }}>
                                            <Ionicons name="chatbubble-outline" size={20} color="#888" />
                                            <Text style={styles.actionText}>{item.comments ? item.comments.length : 0}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        />
                    </View>
                )}
                {activeTab === 'Leaderboard' && <FlatList data={membersList} keyExtractor={item => item.id} renderItem={({ item, index }) => <LeaderboardItem item={item} index={index} />} contentContainerStyle={{ padding: 15 }} />}
                {activeTab === 'Members' && (<View style={{ flex: 1 }}><View style={styles.membersHeader}><View style={styles.memberSearchBox}><Ionicons name="search" size={18} color="#888" style={{ marginRight: 8 }} /><TextInput style={{ flex: 1, color: '#FFF' }} placeholder="Search members..." placeholderTextColor="#666" value={memberSearch} onChangeText={setMemberSearch} textContentType="none" autoComplete="off" importantForAutofill="no" /></View><TouchableOpacity style={styles.inviteBtn} onPress={handleInvite}><Ionicons name="add" size={18} color="#000" /><Text style={styles.inviteBtnText}>Invite Friends</Text></TouchableOpacity></View><FlatList data={membersList.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))} keyExtractor={item => item.id} renderItem={({ item, index }) => <MemberItem item={item} index={index} />} contentContainerStyle={{ paddingHorizontal: 20 }} /></View>)}
            </View>

            {/* --- IMPROVED VISUAL ACHIEVEMENT PICKER MODAL --- */}
            <Modal visible={showAchievementModal} animationType="slide" transparent={true} onRequestClose={() => setShowAchievementModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAchievementModal(false)}>
                    <View style={styles.gridModalContent}>
                        {/* Title Row with Close Button */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Share Achievement</Text>
                            <TouchableOpacity onPress={() => setShowAchievementModal(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
                        </View>
                        {shareableStats.length === 0 ? (
                            <View style={{ alignItems: 'center', padding: 30 }}>
                                <Ionicons name="analytics-outline" size={50} color="#333" />
                                <Text style={{ color: '#666', marginTop: 10, textAlign: 'center' }}>No run history found. {'\n'}Complete a run to unlock badges!</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={shareableStats}
                                keyExtractor={item => item.id}
                                numColumns={2}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.gridItem} onPress={() => handleSelectAchievement(item)}>
                                        <View style={[styles.gridIconCircle, { backgroundColor: item.color + '15' }]}>
                                            <Ionicons name={item.icon} size={28} color={item.color} />
                                        </View>
                                        <Text style={styles.gridValue}>{item.value}</Text>
                                        <Text style={styles.gridLabel}>{item.title}</Text>
                                        <Text style={styles.gridDesc}>{item.desc}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 1. ADMIN REMINDER MODAL */}
            <Modal visible={showReminderModal} animationType="slide" transparent={true} onRequestClose={() => setShowReminderModal(false)}><View style={styles.modalOverlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.commentsContainer}><View style={styles.commentsHeader}><Text style={styles.commentsTitle}>Create Reminder</Text><TouchableOpacity onPress={() => setShowReminderModal(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity></View><ScrollView contentContainerStyle={{ padding: 20 }}><Text style={styles.label}>Message</Text><TextInput style={styles.adminInput} placeholder="e.g. Group Run Tomorrow!" placeholderTextColor="#555" value={reminderData.text} onChangeText={(t) => setReminderData({ ...reminderData, text: t })} /><Text style={styles.label}>Date</Text><TextInput style={styles.adminInput} placeholder="e.g. Tomorrow" placeholderTextColor="#555" value={reminderData.date} onChangeText={(t) => setReminderData({ ...reminderData, date: t })} /><Text style={styles.label}>Time</Text><TextInput style={styles.adminInput} placeholder="e.g. 6:00 AM" placeholderTextColor="#555" value={reminderData.time} onChangeText={(t) => setReminderData({ ...reminderData, time: t })} /><Text style={styles.label}>Location</Text><TextInput style={styles.adminInput} placeholder="e.g. Beirut Lighthouse" placeholderTextColor="#555" value={reminderData.location} onChangeText={(t) => setReminderData({ ...reminderData, location: t })} /><TouchableOpacity style={styles.postBtn} onPress={postReminder}><Text style={styles.postBtnText}>Post Reminder</Text></TouchableOpacity></ScrollView></KeyboardAvoidingView></View></Modal>

            {/* 2. COMMENTS MODAL */}
            <Modal visible={showComments} animationType="slide" transparent={true} onRequestClose={() => setShowComments(false)}><View style={styles.modalOverlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.commentsContainer}><View style={styles.commentsHeader}><Text style={styles.commentsTitle}>Comments</Text><TouchableOpacity onPress={() => setShowComments(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity></View><FlatList data={currentPostComments} keyExtractor={(item, index) => index.toString()} contentContainerStyle={{ padding: 20 }} ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>No comments yet.</Text>} renderItem={({ item }) => (<View style={styles.commentItem}><Image source={{ uri: item.avatar || 'https://i.pravatar.cc/150' }} style={styles.commentAvatar} /><View style={{ flex: 1 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={styles.commentUser}>{item.user}</Text><Text style={styles.commentTime}>{item.time}</Text></View><Text style={styles.commentText}>{item.text}</Text><TouchableOpacity onPress={() => handleReply(item.user)}><Text style={styles.replyText}>Reply</Text></TouchableOpacity></View></View>)} /><View style={styles.commentInputBox}><TextInput style={styles.commentInput} placeholder="Add a comment..." placeholderTextColor="#666" value={commentText} onChangeText={setCommentText} textContentType="none" autoComplete="off" importantForAutofill="no" /><TouchableOpacity onPress={handleSendComment}><Ionicons name="send" size={24} color={COLORS.accent} /></TouchableOpacity></View></KeyboardAvoidingView></View></Modal>

            {/* 3. THREE-DOTS MENU */}
            <Modal visible={showMenu} transparent={true} animationType="fade" onRequestClose={() => setShowMenu(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
                    <View style={styles.menuContainer}>
                        <View style={styles.menuHeader}><Text style={styles.menuTitle}>Club Options</Text><TouchableOpacity onPress={() => setShowMenu(false)}><Ionicons name="close" size={20} color="#FFF" /></TouchableOpacity></View>
                        <TouchableOpacity style={styles.menuItem} onPress={handleInvite}><Ionicons name="person-add" size={20} color="#FFF" /><Text style={styles.menuText}>Invite Members</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={handleShareClub}><Ionicons name="share-social" size={20} color="#FFF" /><Text style={styles.menuText}>Share Club</Text></TouchableOpacity>
                        {status !== 'joined' && (<TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setTimeout(() => Alert.alert("Report", "Club reported."), 500); }}><Ionicons name="flag-outline" size={20} color="#FFF" /><Text style={styles.menuText}>Report Club</Text></TouchableOpacity>)}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 4. ADMIN MANAGEMENT MODAL */}
            <Modal visible={showManagementModal} animationType="slide" transparent={true} onRequestClose={() => setShowManagementModal(false)}>
                <TouchableOpacity style={styles.centeredModalOverlay} activeOpacity={1} onPress={() => setShowManagementModal(false)}>
                    <View style={styles.menuContainerLarge}>
                        <Text style={styles.menuTitleLarge}>Club Management</Text>
                        <TouchableOpacity style={styles.menuItemLarge} onPress={handleEditProfile}><Ionicons name="pencil" size={20} color="#FFF" /><Text style={styles.menuTextLarge}>Edit Club Profile</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.menuItemLarge} onPress={handleManageMembers}><Ionicons name="people" size={20} color="#FFF" /><Text style={styles.menuTextLarge}>Manage Members</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.menuItemLarge} onPress={handlePrivacyChange}><Ionicons name="lock-closed" size={20} color="#FFF" /><Text style={styles.menuTextLarge}>Change Privacy</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.menuItemLarge} onPress={handleDisband}><Ionicons name="trash-outline" size={20} color={COLORS.accent} /><Text style={[styles.menuTextLarge, { color: COLORS.accent }]}>Disband Club</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtnLarge} onPress={() => setShowManagementModal(false)}><Text style={styles.cancelTextLarge}>Cancel</Text></TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 5. USER MANAGEMENT MODAL */}
            <Modal visible={showUserManagementModal} animationType="slide" transparent={true} onRequestClose={() => setShowUserManagementModal(false)}>
                <TouchableOpacity style={styles.centeredModalOverlay} activeOpacity={1} onPress={() => setShowUserManagementModal(false)}>
                    <View style={styles.menuContainerLarge}>
                        <Text style={styles.menuTitleLarge}>Club Management</Text>
                        <TouchableOpacity style={styles.menuItemLarge} onPress={handleManageNotifications}><Ionicons name="notifications-outline" size={20} color="#FFF" /><Text style={styles.menuTextLarge}>Manage Notifications</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.menuItemLarge} onPress={handleReportClub}><Ionicons name="flag-outline" size={20} color="#FFF" /><Text style={styles.menuTextLarge}>Report Club</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.menuItemLarge} onPress={handleLeaveClub}><Ionicons name="log-out-outline" size={20} color={COLORS.accent} /><Text style={[styles.menuTextLarge, { color: COLORS.accent }]}>Leave Club</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtnLarge} onPress={() => setShowUserManagementModal(false)}><Text style={styles.cancelTextLarge}>Cancel</Text></TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* MANAGE MEMBERS LIST MODAL */}
            <Modal visible={showManageMembers} animationType="slide" transparent={true} onRequestClose={() => setShowManageMembers(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.commentsContainer}>
                        <View style={styles.commentsHeader}><Text style={styles.commentsTitle}>Manage Members</Text><TouchableOpacity onPress={() => setShowManageMembers(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity></View>
                        <FlatList data={membersList} keyExtractor={item => item.id} renderItem={({ item }) => (<View style={styles.memberRow}><Image source={{ uri: item.avatar }} style={styles.memberAvatar} /><View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.memberName}>{item.name}</Text><Text style={styles.memberRoleText}>{item.role}</Text></View>{!item.isCurrentUser && (<TouchableOpacity style={{ backgroundColor: '#333', padding: 8, borderRadius: 5 }} onPress={() => kickMember(item.id)}><Text style={{ color: '#FF3B30', fontWeight: 'bold' }}>Kick</Text></TouchableOpacity>)}</View>)} contentContainerStyle={{ padding: 20 }} />
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    headerBg: { width: '100%', height: 260 },
    headerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 20 },
    navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    headerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    clubHeaderContent: { marginTop: 15, flexDirection: 'row', alignItems: 'center' },
    clubInfoContainer: { marginTop: 0 },
    clubLogo: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
    clubMeta: { marginLeft: 15, justifyContent: 'center' },
    clubName: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold', lineHeight: 26 },
    clubMembers: { color: '#CCC', fontSize: 13, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    actionRow: { marginTop: 25, flexDirection: 'row', alignItems: 'center' },
    joinedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#445', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 10 },
    joinedText: { color: '#FFF', fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginLeft: 5 },
    joinBtnMain: { backgroundColor: COLORS.accent, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
    joinBtnTextMain: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 12 },
    requestedBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FFF', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
    requestedText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 12 },
    settingsIcon: { padding: 5 },
    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#000', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10 },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 15 },
    tabText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    activeLine: { position: 'absolute', bottom: 0, width: '60%', height: 3, backgroundColor: COLORS.accent, borderRadius: 2 },
    postInputContainer: { backgroundColor: '#1C1C1E', padding: 12, borderRadius: 12, marginBottom: 15, marginTop: 20, marginHorizontal: 15 },
    postInputBox: { flexDirection: 'row', alignItems: 'center' },
    realInput: { flex: 1, color: '#FFF', marginHorizontal: 10, fontFamily: 'Poppins_400Regular' },
    inputAvatar: { width: 32, height: 32, borderRadius: 16 },
    adminToolsRow: { flexDirection: 'row', marginTop: 10, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10 },
    adminToolBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    adminToolText: { color: COLORS.accent, fontSize: 11, fontWeight: 'bold', marginLeft: 5 },

    // ATTACHMENT PREVIEW STYLES
    attachmentPreviewRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' },
    imagePreview: { flexDirection: 'row', alignItems: 'center', marginRight: 10, marginBottom: 5 },

    // Updated Preview Style (For Input Area)
    achievementPreview: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 10, marginBottom: 5, borderWidth: 1 },
    achIconCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 5 },

    removeImage: { position: 'absolute', top: -5, right: -5 },

    label: { color: '#888', fontSize: 12, marginBottom: 5, marginTop: 15, fontFamily: 'Poppins_600SemiBold' },
    adminInput: { backgroundColor: '#111', color: '#FFF', padding: 12, borderRadius: 8, fontSize: 14 },
    postBtn: { backgroundColor: COLORS.accent, padding: 15, borderRadius: 12, marginTop: 20, alignItems: 'center' },
    postBtnText: { color: '#000', fontFamily: 'Poppins_700Bold' },
    card: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 15, marginBottom: 15 },
    cardHeader: { flexDirection: 'row', marginBottom: 10 },
    cardAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    cardUser: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 14 },
    roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    roleText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: '#BBB' },
    cardTime: { color: '#666', fontSize: 11 },
    cardBody: { color: '#EEE', fontSize: 13, fontFamily: 'Poppins_400Regular', marginBottom: 10, lineHeight: 20 },

    // ACHIEVEMENT BOX (FEED) STYLES
    achievementBox: { backgroundColor: '#111', padding: 15, borderRadius: 12, marginBottom: 15, borderLeftWidth: 4 },
    achIconLarge: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    achievementValue: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
    achievementLabel: { fontSize: 12, color: '#AAA', fontFamily: 'Poppins_400Regular' },

    postImage: { width: '100%', height: 180, borderRadius: 8, marginBottom: 10 },
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    actionText: { color: '#888', marginLeft: 5, fontSize: 12 },
    eventSnippet: { backgroundColor: '#111', padding: 10, borderRadius: 8, marginBottom: 10 },
    eventText: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginLeft: 8 },
    lbCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', padding: 15, borderRadius: 12, marginBottom: 10 },
    lbCardCurrent: { borderWidth: 1, borderColor: COLORS.accent },
    lbRankNum: { fontSize: 18, fontFamily: 'Poppins_700Bold', width: 30, color: '#888' },
    lbAvatar: { width: 44, height: 44, borderRadius: 22 },
    lbName: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    lbDistance: { color: '#CCC', fontSize: 14, fontFamily: 'Poppins_700Bold' },
    membersHeader: { flexDirection: 'row', padding: 20, alignItems: 'center' },
    memberSearchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', height: 40, borderRadius: 8, paddingHorizontal: 10, marginRight: 10 },
    inviteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, height: 40, paddingHorizontal: 15, borderRadius: 8 },
    inviteBtnText: { color: '#000', fontSize: 12, fontFamily: 'Poppins_700Bold', marginLeft: 4 },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
    memberRank: { color: '#666', fontSize: 14, fontFamily: 'Poppins_400Regular', width: 25 },
    memberAvatar: { width: 40, height: 40, borderRadius: 20 },
    memberName: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
    memberRoleText: { color: '#666', fontSize: 12, fontFamily: 'Poppins_400Regular' },
    friendActionBtn: { flexDirection: 'row', alignItems: 'center' },
    friendLabel: { color: '#888', fontSize: 12, marginLeft: 6, fontFamily: 'Poppins_500Medium' },
    followLabel: { color: '#FFF', fontSize: 12, marginLeft: 6, fontFamily: 'Poppins_500Medium' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    commentsContainer: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%' },
    commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    commentsTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    commentItem: { flexDirection: 'row', marginBottom: 20 },
    commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
    commentUser: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 14 },
    commentTime: { color: '#666', fontSize: 11 },
    commentText: { color: '#CCC', fontSize: 13, marginTop: 2 },
    replyText: { color: '#888', fontSize: 11, fontWeight: 'bold', marginTop: 5 },
    commentInputBox: { flexDirection: 'row', alignItems: 'center', padding: 15, borderTopWidth: 1, borderTopColor: '#333' },
    commentInput: { flex: 1, color: '#FFF', backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 15, height: 40, marginRight: 10 },

    // --- UPDATED GRID MODAL STYLES ---
    gridModalContent: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 25,
        paddingBottom: 50,
        maxHeight: '70%',
        // No top border
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    modalTitle: {
        color: '#FFF',
        fontSize: 18, // Changed to 18px to match Create Reminder
        fontFamily: 'Poppins_700Bold',
    },
    gridItem: {
        width: '47%',
        aspectRatio: 1, // Make it Square
        backgroundColor: '#252525',
        borderRadius: 12,
        padding: 10,
        marginRight: '3%',
        marginBottom: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#333',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    gridIconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    gridValue: {
        color: '#FFF',
        fontSize: 20,
        fontFamily: 'Poppins_700Bold',
        marginBottom: 2,
    },
    gridLabel: {
        color: '#CCC',
        fontSize: 10,
        fontFamily: 'Poppins_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        textAlign: 'center'
    },
    gridDesc: {
        display: 'none' // Hidden for cleaner square look
    },

    // Menu (Small 3-Dots)
    menuContainer: { position: 'absolute', top: 60, right: 20, width: 220, backgroundColor: '#1C1C1E', borderRadius: 12, padding: 5 },
    menuHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
    menuTitle: { color: '#FFF', fontFamily: 'Poppins_700Bold' },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    menuText: { color: '#FFF', marginLeft: 10, fontFamily: 'Poppins_500Medium', fontSize: 13 },

    // Centered Large Menu (Admin)
    centeredModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    menuContainerLarge: { width: '85%', backgroundColor: '#1E1E1E', borderRadius: 16, padding: 20 },
    menuTitleLarge: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', textAlign: 'center', marginBottom: 20 },
    menuItemLarge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
    menuTextLarge: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_500Medium', marginLeft: 15 },
    cancelBtnLarge: { marginTop: 20, backgroundColor: '#FFF', borderRadius: 30, paddingVertical: 15, alignItems: 'center' },
    cancelTextLarge: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' }
});