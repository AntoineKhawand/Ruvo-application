import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView, Modal, Platform, ScrollView,
    StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingNavBar from '../components/FloatingNavBar';
import { useUser } from '../context/UserContext';
import { getFlag } from '../utils/helpers';

const COLORS = {
    accent: "#CCFF00", 
    primary: "#000000",
    secondary: "#1C1C1E",
    danger: "#FF3B30",
    text: "#FFFFFF"
};

const { width } = Dimensions.get('window');

// --- SHARED CHALLENGE GENERATOR ---
const getMonthlyChallenges = () => {
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    const fmtDate = (day) => `${monthName.substring(0,3)} ${day}`;

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

const TIP_LIBRARY = [
    { id: 1, title: 'Trail Adventures', desc: 'Explore nature while building ankle strength.', img: 'https://images.pexels.com/photos/1571939/pexels-photo-1571939.jpeg?auto=compress&cs=tinysrgb&w=600' }, 
    { id: 2, title: 'Group Running', desc: 'Find motivation in numbers.', img: 'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=600' },
    { id: 3, title: 'Nutrition 101', desc: 'Fuel your body for longer runs.', img: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600' },
    { id: 4, title: 'Recovery Yoga', desc: 'Stretch effectively after hard runs.', img: 'https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&w=600' },
    { id: 10, title: 'Proper Gear', desc: 'Choosing the right shoes.', img: 'https://images.pexels.com/photos/2526878/pexels-photo-2526878.jpeg?auto=compress&cs=tinysrgb&w=600' },
];

const BADGES = [
    { id: 1, name: 'Early Bird', desc: 'Run before 6AM', icon: 'sunny-outline', color: '#FFD700' },
    { id: 2, name: '5K Club', desc: 'Complete a 5K run', icon: 'medal-outline', color: COLORS.accent },
    { id: 3, name: 'Night Owl', desc: 'Run after 10PM', icon: 'moon-outline', color: '#9D50BB' },
    { id: 4, name: 'Marathoner', desc: 'Run 42.2km total', icon: 'trophy-outline', color: '#FF4500' },
    { id: 5, name: 'Speed Demon', desc: 'Pace under 4:00/km', icon: 'flash-outline', color: '#00BFFF' },
    { id: 6, name: 'Everest', desc: '1000m Elevation', icon: 'trending-up', color: '#32CD32' },
];

const getLevelTitle = (level) => {
    if (level < 5) return "Rookie";
    if (level < 10) return "Endurance Athlete";
    return "Elite Runner";
};

export default function ProfileScreen({ navigation }) {
    // 1. USE UPDATEUSERPROFILE (Connects to Firebase)
    const { userData, updateUserProfile } = useUser();
    
    const [activeTab, setActiveTab] = useState('Activity');
    const [filter, setFilter] = useState('All'); 
    
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [editName, setEditName] = useState(userData?.name || "");
    const [isSaving, setIsSaving] = useState(false); // Loading state for save
    
    // --- REAL RUN STATS ---
    const totalKm = userData?.runHistory ? userData.runHistory.reduce((acc, run) => acc + (parseFloat(run.distance) || 0), 0) : 0;
    const totalRuns = userData?.runHistory ? userData.runHistory.length : 0;
    const avgPace = totalRuns > 0 && userData.runHistory[0] ? userData.runHistory[0].pace : '0:00';

    // --- REAL SOCIAL STATS ---
    const followersCount = userData?.followers ? userData.followers.length : 0;
    const followingCount = userData?.following ? userData.following.length : 0;
    const userCoins = userData?.coins || 0;

    const getFilteredHistory = () => {
        if (!userData?.runHistory) return [];
        if (filter === 'All') return userData.runHistory;
        if (filter === 'Week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return userData.runHistory.filter(r => new Date(r.date) >= oneWeekAgo);
        }
        return userData.runHistory;
    };
    const filteredData = getFilteredHistory();

    const savedTips = TIP_LIBRARY.filter(tip => userData?.savedTips?.includes(tip.id));

    // --- DYNAMIC ACTIVE CHALLENGES ENGINE ---
    const myActiveChallenges = useMemo(() => {
        const allChallenges = getMonthlyChallenges();
        const joinedIds = userData?.joinedChallenges || []; 
        const myChallenges = allChallenges.filter(c => joinedIds.includes(c.id));

        return myChallenges.map(challenge => {
            let currentProgress = 0;
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthRuns = (userData?.runHistory || []).filter(run => new Date(run.date) >= startOfMonth);

            if (challenge.type === 'distance') {
                currentProgress = monthRuns.reduce((acc, r) => acc + (parseFloat(r.distance) || 0), 0);
            } else if (challenge.type === 'count') {
                currentProgress = monthRuns.length;
            } else if (challenge.type === 'elevation') {
                currentProgress = monthRuns.reduce((acc, r) => acc + (parseFloat(r.elevation) || 0), 0);
            }

            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const daysLeft = Math.ceil((endOfMonth - now) / (1000 * 60 * 60 * 24));

            return {
                ...challenge,
                progress: currentProgress.toFixed(1),
                percent: Math.min((currentProgress / challenge.target) * 100, 100),
                daysLeft: Math.max(daysLeft, 0)
            };
        });
    }, [userData?.runHistory, userData?.joinedChallenges]);

    // --- 2. UPDATED SAVE FUNCTION (Writes to Firebase) ---
    const handleSaveProfile = async () => {
        if (!editName.trim()) {
            Alert.alert("Error", "Name cannot be empty");
            return;
        }
        
        setIsSaving(true);
        try {
            // This sends the new name to Firestore
            await updateUserProfile({ name: editName });
            setIsSaving(false);
            setEditModalVisible(false);
        } catch (error) {
            setIsSaving(false);
            Alert.alert("Error", "Could not update profile.");
        }
    };

    const xpPercentage = (userData?.xpToNextLevel || 1000) > 0 
        ? Math.min((userData?.currentXP || 0) / (userData?.xpToNextLevel || 1000), 1) * 100 
        : 0;

    // Safety check for user data
    if (!userData) return null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                
                {/* HEADER */}
                <LinearGradient colors={['#1E1E1E', '#000']} style={styles.header}>
                    <SafeAreaView edges={['top']}>
                        <View style={styles.headerTop}>
                            <TouchableOpacity onPress={() => navigation.goBack()}>
                                <Ionicons name="arrow-back" size={24} color="#FFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Profile</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                                <Ionicons name="settings-outline" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.profileInfo}>
                            <View style={styles.avatarWrapper}>
                                {userData.avatar ? (
                                    <Image source={{ uri: userData.avatar }} style={styles.avatarImage} />
                                ) : (
                                    <View style={styles.avatarContainer}>
                                        <Text style={styles.avatarText}>{userData.name ? userData.name.charAt(0) : 'U'}</Text>
                                    </View>
                                )}
                                <TouchableOpacity style={styles.editIconBadge} onPress={() => { setEditName(userData.name); setEditModalVisible(true); }}>
                                    <Ionicons name="pencil" size={14} color="#000" />
                                </TouchableOpacity>
                            </View>
                            
                            <View style={styles.nameRow}>
                                <Text style={styles.userName}>{userData.name} {getFlag(userData.location?.country)}</Text>
                            </View>
                            
                            <Text style={styles.userLevel}>Level {userData.level || 1} • {getLevelTitle(userData.level || 1)}</Text>

                            <View style={styles.socialRow}>
                                <Text style={styles.socialText}><Text style={styles.socialNum}>{followersCount}</Text> Followers</Text>
                                <View style={styles.socialDivider} />
                                <Text style={styles.socialText}><Text style={styles.socialNum}>{followingCount}</Text> Following</Text>
                            </View>

                            <View style={styles.coinBadge}>
                                <View style={styles.coinIcon}><Text style={styles.coinSymbol}>C</Text></View>
                                <Text style={styles.coinValue}>{userCoins.toLocaleString()}</Text>
                            </View>
                        </View>

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

                <View style={{ height: 10 }} />

                {/* STATS */}
                <View style={styles.statsContainer}>
                    <View style={styles.statBox}><Text style={styles.statValue}>{totalRuns}</Text><Text style={styles.statLabel}>Total Runs</Text></View>
                    <View style={styles.verticalDivider} />
                    <View style={styles.statBox}><Text style={styles.statValue}>{totalKm.toFixed(1)}</Text><Text style={styles.statLabel}>Total Km</Text></View>
                    <View style={styles.verticalDivider} />
                    <View style={styles.statBox}><Text style={styles.statValue}>{avgPace}</Text><Text style={styles.statLabel}>Avg Pace</Text></View>
                </View>

                <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Gear')}>
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIconBox}><MaterialCommunityIcons name="shoe-sneaker" size={20} color={COLORS.accent} /></View>
                        <Text style={styles.menuText}>My Gear Tracker</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>

                <View style={styles.contentPadding}>
                    
                    {/* TAB SWITCHER */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'Activity' && styles.tabBtnActive]} onPress={() => setActiveTab('Activity')}>
                            <Text style={[styles.tabText, activeTab === 'Activity' && styles.tabTextActive]}>Activity</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'Library' && styles.tabBtnActive]} onPress={() => setActiveTab('Library')}>
                            <Text style={[styles.tabText, activeTab === 'Library' && styles.tabTextActive]}>Saved Library</Text>
                        </TouchableOpacity>
                    </View>

                    {/* --- CONTENT AREA --- */}
                    {activeTab === 'Activity' ? (
                        <>
                            {/* --- DYNAMIC ACTIVE CHALLENGES --- */}
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
                                            <View style={[styles.acProgressBarFill, {width: `${challenge.percent}%`}]} />
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <TouchableOpacity style={styles.emptyChallenges} onPress={() => navigation.navigate('Community')}>
                                    <Ionicons name="trophy-outline" size={24} color="#666" />
                                    <Text style={styles.emptyChallengesText}>No active challenges.</Text>
                                    <Text style={styles.joinNowText}>Join one in Community Tab</Text>
                                </TouchableOpacity>
                            )}

                            <View style={[styles.sectionHeaderRow, { marginTop: 25 }]}>
                                <Text style={styles.sectionTitle}>Achievements</Text>
                            </View>
                            
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
                                {BADGES.map((badge) => {
                                    const isUnlocked = userData.badges && userData.badges.some(b => b.name === badge.name);
                                    return (
                                        <View key={badge.id} style={[styles.badgeItem, !isUnlocked && { opacity: 0.3 }]}>
                                            <View style={[styles.badgeIcon, { backgroundColor: isUnlocked ? badge.color : '#333' }]}>
                                                <Ionicons name={isUnlocked ? badge.icon : 'lock-closed'} size={24} color={isUnlocked ? "#000" : "#666"} />
                                            </View>
                                            <Text style={[styles.badgeText, !isUnlocked && { color: '#666' }]}>{badge.name}</Text>
                                            <Text style={styles.badgeSub}>{badge.desc}</Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            <View style={[styles.sectionHeaderRow, { marginTop: 25 }]}>
                                <Text style={styles.sectionTitle}>Recent Activity</Text>
                                <View style={styles.filterContainer}>
                                    {['All', 'Week'].map((f) => (
                                        <TouchableOpacity key={f} style={[styles.filterPill, filter === f && styles.filterPillActive]} onPress={() => setFilter(f)}>
                                            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                            
                            {filteredData.length === 0 ? (
                                <View style={styles.emptyState}><MaterialCommunityIcons name="run-fast" size={40} color="#333" /><Text style={styles.emptyText}>No runs found for this period.</Text></View>
                            ) : (
                                filteredData.map((run, index) => (
                                    <View key={index} style={styles.activityCard}>
                                        <View style={styles.activityIcon}><MaterialCommunityIcons name="run" size={24} color="#000" /></View>
                                        <View style={styles.activityInfo}><Text style={styles.activityTitle}>{run.title || 'Run Workout'}</Text><Text style={styles.activityDate}>{new Date(run.date).toLocaleDateString()} • {run.duration}</Text></View>
                                        <View style={styles.activityStats}><Text style={styles.activityDistance}>{parseFloat(run.distance).toFixed(2)} km</Text><View style={{flexDirection:'row', alignItems:'center', marginTop:2}}><Ionicons name="flash" size={10} color={COLORS.accent} style={{marginRight:2}}/><Text style={styles.activityCals}>{Math.floor(run.calories || 0)} kcal</Text></View></View>
                                    </View>
                                ))
                            )}
                        </>
                    ) : (
                        /* --- SAVED LIBRARY CONTENT --- */
                        <View style={{marginTop: 10}}>
                            {savedTips.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="bookmark-outline" size={40} color="#333" />
                                    <Text style={styles.emptyText}>No saved tips yet.</Text>
                                    <Text style={{color:'#555', fontSize:12, marginTop:5}}>Bookmark tips from the Home screen.</Text>
                                </View>
                            ) : (
                                savedTips.map((tip, index) => (
                                    <TouchableOpacity key={index} style={styles.savedTipCard} onPress={() => navigation.navigate('TipDetail', { tip })}>
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

            {/* EDIT MODAL */}
            <Modal visible={isEditModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Edit Profile</Text><TouchableOpacity onPress={() => setEditModalVisible(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity></View>
                        
                        <Text style={{color: '#888', marginBottom: 10, marginLeft: 5}}>Display Name</Text>
                        <TextInput 
                            style={styles.modalInput} 
                            value={editName} 
                            onChangeText={setEditName} 
                            placeholderTextColor="#666" 
                            placeholder="Enter your name"
                        />
                        
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={isSaving}>
                            {isSaving ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <FloatingNavBar current="Profile" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }, 
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems:'center', paddingHorizontal: 20, paddingTop: 10 },
    headerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold'},
    profileInfo: { alignItems: 'center', marginTop: 10 },
    avatarWrapper: { position: 'relative', marginBottom: 15 },
    avatarContainer: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.accent },
    avatarImage: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: COLORS.accent },
    avatarText: { color: COLORS.accent, fontSize: 36, fontWeight: 'bold' },
    editIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.accent, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
    nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    userName: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold' },
    userLevel: { color: '#AAA', fontSize: 14, fontFamily: 'Poppins_500Medium', marginTop: 2 },
    
    // --- SOCIAL & COINS ---
    socialRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    socialText: { color: '#888', fontSize: 12 },
    socialNum: { color: '#FFF', fontWeight: 'bold' },
    socialDivider: { width: 1, height: 12, backgroundColor: '#444', marginHorizontal: 10 },
    coinBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12 },
    coinIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
    coinSymbol: { color: '#000', fontSize: 10, fontWeight: 'bold' },
    coinValue: { color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_700Bold' },

    levelContainer: { marginTop: 20, paddingHorizontal: 30 }, 
    levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    levelLabel: { color: '#FFF', fontSize: 12, fontWeight: '600' },
    levelValue: { color: COLORS.accent, fontSize: 12, fontWeight: '600' },
    progressBarBg: { height: 6, backgroundColor: '#333', borderRadius: 3, width: '100%' },
    progressBarFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1C1C1E', marginHorizontal: 20, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333' },
    statBox: { alignItems: 'center', flex: 1 },
    statValue: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    statLabel: { color: '#888', fontSize: 12, marginTop: 4 },
    verticalDivider: { width: 1, height: '100%', backgroundColor: '#333' },
    contentPadding: { padding: 20 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
    sectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    
    // --- ACTIVE CHALLENGES ---
    activeChallengeCard: { backgroundColor: '#1C1C1E', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    acHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    acTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    acDays: { color: '#888', fontSize: 12 },
    acProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    acProgressText: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_700Bold' },
    acPercentText: { color: '#FFF', fontSize: 12 },
    acProgressBarBg: { height: 6, backgroundColor: '#333', borderRadius: 3 },
    acProgressBarFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },
    
    emptyChallenges: { alignItems: 'center', padding: 20, backgroundColor: '#1C1C1E', borderRadius: 16, marginBottom: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#444' },
    emptyChallengesText: { color: '#888', marginTop: 10 },
    joinNowText: { color: COLORS.accent, fontWeight: 'bold', marginTop: 5 },

    badgesScroll: { marginBottom: 10 },
    badgeItem: { alignItems: 'center', marginRight: 15, width: 90 },
    badgeIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    badgeText: { color: '#FFF', fontSize: 11, fontWeight: '600', textAlign: 'center' },
    badgeSub: { color: '#666', fontSize: 9, textAlign: 'center', marginTop: 2 },
    filterContainer: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 20, padding: 2 },
    filterPill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 16 },
    filterPillActive: { backgroundColor: '#333' },
    filterText: { color: '#666', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    filterTextActive: { color: '#FFF' },
    activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 15, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    activityIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    activityInfo: { flex: 1 },
    activityTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    activityDate: { color: '#888', fontSize: 12, marginTop: 2 },
    activityStats: { alignItems: 'flex-end' },
    activityDistance: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    activityCals: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_500Medium' },
    emptyState: { alignItems: 'center', marginTop: 30, opacity: 0.5 },
    emptyText: { color: '#888', marginTop: 10, fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    modalTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold' },
    modalInput: { backgroundColor: '#111', color: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333', fontSize: 16, marginBottom: 20 },
    saveBtn: { backgroundColor: COLORS.accent, padding: 15, borderRadius: 30, alignItems: 'center', marginBottom: 20 },
    saveBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1C1C1E', marginHorizontal: 20, marginTop: 20, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
    menuLeft: { flexDirection: 'row', alignItems: 'center' },
    menuIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(178, 255, 89, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    menuText: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    tabContainer: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#1C1C1E', borderRadius: 12, padding: 4 },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    tabBtnActive: { backgroundColor: '#333' },
    tabText: { color: '#666', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    tabTextActive: { color: '#FFF' },
    savedTipCard: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 15, marginBottom: 15, overflow: 'hidden', height: 100, borderWidth: 1, borderColor: '#333' },
    savedTipImage: { width: 100, height: '100%' },
    savedTipContent: { flex: 1, padding: 12, justifyContent: 'space-between' },
    savedTipTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
    savedTipDesc: { color: '#888', fontSize: 11, fontFamily: 'Poppins_400Regular', lineHeight: 16 },
    readMoreText: { color: COLORS.accent, fontSize: 10, fontFamily: 'Poppins_700Bold', marginTop: 5, letterSpacing: 0.5 },
});