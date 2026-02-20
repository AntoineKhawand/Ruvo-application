import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { COLORS } from '../constants/legacy-theme.js';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';

// --- HELPERS ---
const getCountryFlag = (country) => {
    const flags = {
        'Lebanon': '🇱🇧', 'USA': '🇺🇸', 'United States': '🇺🇸', 'France': '🇫🇷',
        'Germany': '🇩🇪', 'UK': '🇬🇧', 'United Kingdom': '🇬🇧', 'Canada': '🇨🇦',
        'Australia': '🇦🇺', 'Japan': '🇯🇵', 'Brazil': '🇧🇷', 'India': '🇮🇳',
        'Italy': '🇮🇹', 'Spain': '🇪🇸', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪',
        'Kenya': '🇰🇪', 'Ethiopia': '🇪🇹', 'Mexico': '🇲🇽', 'South Korea': '🇰🇷',
        'Saudi Arabia': '🇸🇦', 'UAE': '🇦🇪', 'Egypt': '🇪🇬', 'Morocco': '🇲🇦',
    };
    return flags[country] || '🏃';
};

const getCurrentWeekRange = () => {
    const today = new Date();
    const diff = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('en-GB', options)}`;
};

const FilterButton = ({ label, isActive, onPress }) => (
    <TouchableOpacity
        style={[styles.filterBtn, isActive ? styles.filterBtnActive : styles.filterBtnInactive]}
        onPress={onPress}
    >
        <Text style={[styles.filterText, isActive ? styles.filterTextActive : styles.filterTextInactive]}>
            {label}
        </Text>
    </TouchableOpacity>
);

const LeaderboardItem = ({ item }) => {
    const isTop3 = item.rank <= 3;
    const isCurrentUser = item.isCurrentUser;

    let rankBgColor = '#333';
    let rankTextColor = '#FFF';
    if (item.rank === 1) { rankBgColor = '#FFD700'; rankTextColor = '#000'; }
    else if (item.rank === 2) { rankBgColor = '#C0C0C0'; rankTextColor = '#000'; }
    else if (item.rank === 3) { rankBgColor = '#CD7F32'; rankTextColor = '#000'; }
    else if (isCurrentUser) { rankBgColor = COLORS.accent; rankTextColor = '#000'; }

    const containerStyle = isCurrentUser ? styles.currentUserItem : styles.itemContainer;

    const displayDistance = typeof item.displayDistance === 'number'
        ? `${item.displayDistance.toFixed(1)} km`
        : '0.0 km';

    return (
        <View style={containerStyle}>
            <View style={[styles.rankCircle, { backgroundColor: rankBgColor }]}>
                <Text style={[styles.rankText, { color: rankTextColor }]}>{item.rank}</Text>
            </View>
            <Image
                source={item.avatar ? { uri: item.avatar } : require('../../assets/icon.png')}
                style={styles.avatar}
            />
            <View style={styles.infoContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.name, isCurrentUser && { color: COLORS.accent }]}>{item.name}</Text>
                    {item.flag && <Text style={styles.flag}>{item.flag}</Text>}
                </View>
                <Text style={styles.distance}>{displayDistance}</Text>
            </View>
            <Ionicons
                name={item.rank === 1 ? 'trophy' : item.rank <= 3 ? 'medal' : 'person'}
                size={20}
                color={isTop3 ? (item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0C0' : '#CD7F32') : '#666'}
            />
        </View>
    );
};

export default function LeaderboardScreen() {
    const { theme } = useTheme();
    const { userData, user } = useUser();

    const [activeScope, setActiveScope] = useState('Friends');
    const [activeTime, setActiveTime] = useState('Weekly');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [dateRange, setDateRange] = useState(getCurrentWeekRange());
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- 1. FETCH REAL USERS FROM FIRESTORE ---
    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, orderBy('totalKm', 'desc'), limit(100));
                const snapshot = await getDocs(q);

                const users = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    // Skip current user (we add them separately)
                    if (docSnap.id === user?.uid) return;

                    users.push({
                        id: docSnap.id,
                        name: data.name || 'Runner',
                        avatar: data.avatar || null,
                        weeklyDistance: data.weeklyDistance || 0,
                        totalKm: data.totalKm || 0,
                        country: data.location?.country || data.country || null,
                        flag: getCountryFlag(data.location?.country || data.country),
                        isCurrentUser: false
                    });
                });

                setAllUsers(users);
                console.log(`📊 Leaderboard: Fetched ${users.length} real users from Firestore`);
            } catch (error) {
                console.error('Leaderboard fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user?.uid) fetchUsers();
    }, [user?.uid]);

    // --- 2. FILTER, SORT & RANK ---
    useEffect(() => {
        // A. Current user object
        const userCountry = userData?.location?.country || userData?.country || 'Lebanon';
        let userDist = 0;
        if (activeTime === 'Weekly') {
            userDist = userData?.weeklyDistance || 0;
        } else {
            userDist = userData?.totalKm || 0;
        }

        const currentUser = {
            id: user?.uid || 'currentUser',
            name: userData?.name || 'You',
            avatar: userData?.avatar,
            displayDistance: userDist,
            flag: getCountryFlag(userCountry),
            country: userCountry,
            isCurrentUser: true
        };

        // B. Filter other users by scope
        let filtered = [...allUsers];

        if (activeScope === 'Friends') {
            const following = userData?.following || [];
            filtered = filtered.filter(u => following.includes(u.id));
        } else if (activeScope === 'Country') {
            filtered = filtered.filter(u => u.country === userCountry);
        }
        // 'Global' = show all

        // C. Map distance based on time filter
        const mapped = filtered.map(u => ({
            ...u,
            displayDistance: activeTime === 'Weekly' ? (u.weeklyDistance || 0) : (u.totalKm || 0)
        }));

        // D. Combine, sort, rank
        const combined = [...mapped, currentUser];
        combined.sort((a, b) => b.displayDistance - a.displayDistance);
        const ranked = combined.map((item, index) => ({ ...item, rank: index + 1 }));

        setLeaderboardData(ranked);

        // E. Update date label
        if (activeTime === 'Weekly') setDateRange(getCurrentWeekRange());
        else setDateRange('All Time Records');

    }, [allUsers, userData, activeScope, activeTime]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
            <View style={styles.headerContainer}>
                {/* Scope Filters */}
                <View style={styles.filterRow}>
                    <FilterButton label="Friends" isActive={activeScope === 'Friends'} onPress={() => setActiveScope('Friends')} />
                    <FilterButton label={`Country (${userData?.location?.country || 'Lebanon'})`} isActive={activeScope === 'Country'} onPress={() => setActiveScope('Country')} />
                    <FilterButton label="Global" isActive={activeScope === 'Global'} onPress={() => setActiveScope('Global')} />
                </View>

                {/* Time Filters & Date Range */}
                <View style={[styles.filterRow, { marginTop: 15, justifyContent: 'space-between' }]}>
                    <View style={{ flexDirection: 'row' }}>
                        <FilterButton label="Weekly" isActive={activeTime === 'Weekly'} onPress={() => setActiveTime('Weekly')} />
                        <FilterButton label="All-Time" isActive={activeTime === 'All-Time'} onPress={() => setActiveTime('All-Time')} />
                    </View>
                    <Text style={styles.dateRangeText}>{dateRange}</Text>
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={{ color: '#666', marginTop: 10 }}>Loading leaderboard...</Text>
                </View>
            ) : (
                <FlatList
                    data={leaderboardData}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <LeaderboardItem item={item} />}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Ionicons name="people-outline" size={40} color="#333" />
                            <Text style={{ color: '#666', marginTop: 10 }}>
                                {activeScope === 'Friends'
                                    ? 'No friends found. Follow people in Global!'
                                    : 'No runners found in this category.'}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerContainer: { padding: 20, paddingTop: 10 },
    filterRow: { flexDirection: 'row' },
    filterBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginRight: 10, borderWidth: 1 },
    filterBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    filterBtnInactive: { backgroundColor: '#333', borderColor: '#333' },
    filterText: { fontFamily: 'Poppins_700Bold', fontSize: 12 },
    filterTextActive: { color: '#000' },
    filterTextInactive: { color: '#AAA' },
    dateRangeText: { color: '#AAA', fontFamily: 'Poppins_400Regular', fontSize: 10, textAlign: 'right', alignSelf: 'center' },

    listContent: { paddingHorizontal: 20, paddingBottom: 20 },
    itemContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 15, marginBottom: 10 },
    currentUserItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(204, 255, 0, 0.1)', borderRadius: 16, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: COLORS.accent },
    rankCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    rankText: { fontFamily: 'Poppins_700Bold', fontSize: 14 },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15 },
    infoContainer: { flex: 1 },
    name: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 14 },
    flag: { fontSize: 14, marginLeft: 5 },
    distance: { color: '#AAA', fontFamily: 'Poppins_400Regular', fontSize: 12, marginTop: 2 },
});