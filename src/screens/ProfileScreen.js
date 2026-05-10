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
import { BADGES } from '../constants/badges'; // Import shared badges
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

// --- SHARED CHALLENGE GENERATOR ---
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


// --- SHARED CHALLENGE GENERATOR ---



const getLevelTitle = (level) => {
    if (level < 5) return "Rookie";
    if (level < 10) return "Endurance Athlete";
    return "Elite Runner";
};

export default function ProfileScreen({ navigation }) {
    // 1. USE UPDATEUSERPROFILE (Connects to Firebase)
    const { userData, updateUserProfile, refreshUser } = useUser();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [activeTab, setActiveTab] = useState('Activity');
    const [filter, setFilter] = useState('All');
    const [lastRefresh, setLastRefresh] = useState(Date.now());

    // Auto-refresh when screen gains focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            setLastRefresh(Date.now());
            setFilter('All');
        });
        return unsubscribe;
    }, [navigation]);

    // --- DYNAMIC CONTENT ---
    const [allTips, setAllTips] = useState([]);

    // Fetch tips on mount
    useEffect(() => {
        const loadTips = async () => {
            const tips = await contentService.fetchTips();
            setAllTips(tips);
        };
        loadTips();
    }, []);

    // --- UI STATE ---
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [editName, setEditName] = useState(userData?.name || "");
    const [isSaving, setIsSaving] = useState(false);

    // Country selector
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(userData?.location?.country || 'Earth');
    const [searchQuery, setSearchQuery] = useState("");

    // --- REAL RUN STATS ---
    const totalKm = userData?.runHistory ? userData.runHistory.reduce((acc, run) => acc + (parseFloat(run.distance) || 0), 0) : 0;
    const totalRuns = userData?.runHistory ? userData.runHistory.length : 0;
    const avgPace = totalRuns > 0 && userData.runHistory[0] ? userData.runHistory[0].pace : '0:00';

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

    const savedTips = allTips.filter(tip => userData?.savedTips?.includes(tip.id));

    // --- DYNAMIC ACTIVE CHALLENGES ENGINE ---
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
                // Calculate total KM first
                const totalKm = monthRuns.reduce((acc, r) => acc + (parseFloat(r.distance) || 0), 0);

                if (unitSystem === 'imperial') {
                    // Convert everything to miles for display
                    currentProgress = totalKm * 0.621371;
                    // We also need to convert the target if we want to show 'X / Y miles'
                    // However, usually challenges have fixed metric targets (e.g. 100km). 
                    // Let's explicitly show the conversion for the user clarity.
                    // Actually, let's keep the target in KM if it's a specific '100k' challenge, 
                    // BUT display progress in KM too? 
                    // OR convert the target to miles? 100km = 62.1 mi.
                    // Let's convert both to ensure "Progress Bar" makes sense (ratio remains same).
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
                target: challenge.displayTarget, // Override/Add display target
                unit: challenge.displayUnit, // Override/Add display unit
                percent: Math.min((currentProgress / (unitSystem === 'imperial' && challenge.type === 'distance' ? challenge.target * 0.621371 : challenge.target)) * 100, 100),
                daysLeft: Math.max(daysLeft, 0)
            };
        });
    }, [userData?.runHistory, userData?.joinedChallenges, userData?.unitSystem]);

    // --- 2. UPDATED SAVE FUNCTION (Writes to Firebase) ---
    const handleSaveProfile = async () => {
        lightTap();
        if (!editName.trim()) {
            errorFeedback();
            Alert.alert("Error", "Name cannot be empty");
            return;
        }

        setIsSaving(true);
        try {
            // This sends the new name to Firestore
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

    // Safety check for user data
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
                            try {
                                if (refreshUser) await refreshUser();
                            } catch (e) { /* silent */ }
                            setTimeout(() => setIsRefreshing(false), 800);
                        }}
                        tintColor="#CCFF00"
                        colors={['#CCFF00']}
                        progressBackgroundColor="#1C1C1E"
                    />
                }
            >

                {/* HEADER */}
                <LinearGradient colors={['#1E1E1E', '#000']} style={styles.header}>
                    <SafeAreaView edges={['top']}>
                        <View style={styles.headerTop}>
                            {navigation.canGoBack() ? (
                                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }}>
                                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                                </TouchableOpacity>
                            ) : (
                                <View style={{ width: 24 }} />
                            )}
                            <Text style={styles.headerTitle}>Profile</Text>
                            <View style={{ flexDirection: 'row', gap: 15 }}>
                                <TouchableOpacity activeOpacity={0.7} onPress={handleShareProfile}>
                                    <Ionicons name="share-outline" size={24} color="#FFF" />
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.navigate('FindFriends'); }}>
                                    <Ionicons name="person-add-outline" size={24} color="#FFF" />
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.navigate('Settings'); }}>
                                    <Ionicons name="settings-outline" size={24} color="#FFF" />
                                </TouchableOpacity>
                            </View>
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
                                <TouchableOpacity activeOpacity={0.7} style={styles.editIconBadge} onPress={() => { lightTap(); setEditName(userData.name); setEditModalVisible(true); }}>
                                    <Ionicons name="pencil" size={14} color="#000" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.nameRow}>
                                <Text style={styles.userName}>{userData.name} {getFlag(userData.location?.country)}</Text>
                            </View>

                            <Text style={styles.userLevel}>Level {userData.level || 1} • {getLevelTitle(userData.level || 1)}</Text>

                            <View style={styles.socialRow}>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.navigate('UserList', { title: 'Followers', userIds: userData.followers }); }}>
                                    <Text style={styles.socialText}><Text style={styles.socialNum}>{followersCount}</Text> Followers</Text>
                                </TouchableOpacity>
                                <View style={styles.socialDivider} />
                                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.navigate('UserList', { title: 'Following', userIds: userData.following }); }}>
                                    <Text style={styles.socialText}><Text style={styles.socialNum}>{followingCount}</Text> Following</Text>
                                </TouchableOpacity>
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
                    <View style={styles.statBox}><Text style={styles.statValue}>{formatDistance(totalKm, userData?.unitSystem, 1).split(' ')[0]}</Text><Text style={styles.statLabel}>Total {userData?.unitSystem === 'imperial' ? 'Miles' : 'Km'}</Text></View>
                    <View style={styles.verticalDivider} />
                    <View style={styles.statBox}><Text style={styles.statValue}>{formatPace(avgPace, userData?.unitSystem)}</Text><Text style={styles.statLabel}>Avg Pace</Text></View>
                </View>

                <TouchableOpacity activeOpacity={0.7} style={styles.menuRow} onPress={() => { lightTap(); navigation.navigate('Gear'); }}>
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIconBox}><MaterialCommunityIcons name="shoe-sneaker" size={20} color={COLORS.accent} /></View>
                        <Text style={styles.menuText}>My Gear Tracker</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} style={styles.menuRow} onPress={() => { lightTap(); setSelectedCountry(userData?.location?.country || 'Earth'); setShowCountryPicker(true); }}>
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIconBox}><Ionicons name="flag-outline" size={20} color={COLORS.accent} /></View>
                        <View>
                            <Text style={styles.menuText}>Country</Text>
                            <Text style={styles.menuSubtext}>{getFlag(userData?.location?.country)} {userData?.location?.country || 'Not set'}</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>

                <View style={styles.contentPadding}>

                    {/* TAB SWITCHER */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity activeOpacity={0.7} style={[styles.tabBtn, activeTab === 'Activity' && styles.tabBtnActive]} onPress={() => { lightTap(); setActiveTab('Activity'); }}>
                            <Text style={[styles.tabText, activeTab === 'Activity' && styles.tabTextActive]}>Activity</Text>
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7} style={[styles.tabBtn, activeTab === 'Library' && styles.tabBtnActive]} onPress={() => { lightTap(); setActiveTab('Library'); }}>
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
                                            <View style={[styles.acProgressBarFill, { width: `${challenge.percent}%` }]} />
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <TouchableOpacity activeOpacity={0.7} style={styles.emptyChallenges} onPress={() => { lightTap(); navigation.navigate('Community'); }}>
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
                                    // Match by ID first, fallback to name for backwards compatibility
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

                            <View style={[styles.sectionHeaderRow, { marginTop: 25 }]}>
                                <Text style={styles.sectionTitle}>Recent Activity</Text>
                                <View style={styles.filterContainer}>
                                    {['All', 'Week'].map((f) => (
                                        <TouchableOpacity activeOpacity={0.7} key={f} style={[styles.filterPill, filter === f && styles.filterPillActive]} onPress={() => { lightTap(); setFilter(f); }}>
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
                                        <View style={styles.activityStats}><Text style={styles.activityDistance}>{formatDistance(run.distance, userData?.unitSystem)}</Text><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}><Ionicons name="flash" size={10} color={COLORS.accent} style={{ marginRight: 2 }} /><Text style={styles.activityCals}>{Math.floor(run.calories || 0)} kcal</Text></View></View>
                                    </View>
                                ))
                            )}
                        </>
                    ) : (
                        /* --- SAVED LIBRARY CONTENT --- */
                        <View style={{ marginTop: 10 }}>
                            {savedTips.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="bookmark-outline" size={40} color="#333" />
                                    <Text style={styles.emptyText}>No saved tips yet.</Text>
                                    <Text style={{ color: '#555', fontSize: 12, marginTop: 5 }}>Bookmark tips from the Home screen.</Text>
                                </View>
                            ) : (
                                savedTips.map((tip, index) => (
                                    <TouchableOpacity activeOpacity={0.7} key={index} style={styles.savedTipCard} onPress={() => { lightTap(); navigation.navigate('TipDetail', { tip }); }}>
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
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Edit Profile</Text><TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setEditModalVisible(false); }}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity></View>

                        <Text style={{ color: '#888', marginBottom: 10, marginLeft: 5 }}>Display Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editName}
                            onChangeText={setEditName}
                            placeholderTextColor="#666"
                            placeholder="Enter your name"
                        />

                        <TouchableOpacity activeOpacity={0.7} style={styles.saveBtn} onPress={handleSaveProfile} disabled={isSaving}>
                            {isSaving ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* COUNTRY PICKER MODAL */}
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

                        {/* Search Bar */}
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
                                        style={[
                                            styles.countryItem,
                                            selectedCountry === c.name && styles.countryItemSelected
                                        ]}
                                        onPress={async () => {
                                            lightTap();
                                            const prevCountry = selectedCountry;
                                            setSelectedCountry(c.name);
                                            setShowCountryPicker(false);
                                            setSearchQuery(""); // Reset search
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
                                        <Text style={[
                                            styles.countryName,
                                            selectedCountry === c.name && styles.countryNameSelected
                                        ]}>{c.name}</Text>
                                        {selectedCountry === c.name && (
                                            <Ionicons name="checkmark" size={20} color={COLORS.accent} />
                                        )}
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
    header: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    headerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
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

    // Country Picker
    menuSubtext: { color: '#888', fontSize: 12, marginTop: 2 },
    modalBackdrop: { flex: 1 },
    countryPickerSheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, maxHeight: '70%' },
    countryList: { marginTop: 10 },
    countryItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
    countryItemSelected: { backgroundColor: '#2A2A2A' },
    countryFlag: { fontSize: 24, marginRight: 15 },
    countryName: { flex: 1, color: '#FFF', fontSize: 16 },
    countryNameSelected: { color: COLORS.accent, fontFamily: 'Poppins_600SemiBold' },

    // Search Styling
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#333'
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Poppins_500Medium'
    }
});