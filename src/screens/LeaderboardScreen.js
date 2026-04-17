import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { COLORS } from '../constants/legacy-theme.js';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import useStaggerAnimation from '../hooks/useStaggerAnimation';
import SkeletonCard from '../components/SkeletonCard';

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

const LeaderboardList = ({ data, activeScope }) => {
    const renderLeaderboardItem = useCallback(({ item }) => <LeaderboardItem item={item} />, []);
    const { animatedRenderItem } = useStaggerAnimation(renderLeaderboardItem);

    return (
        <Animated.FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={animatedRenderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            updateCellsBatchingPeriod={50}
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
    );
};

export default function LeaderboardScreen() {
    const { theme } = useTheme();
    const { userData, user } = useUser();

    const [activeScope, setActiveScope] = useState('Friends');
    const [activeTime, setActiveTime] = useState('Weekly');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [dateRange, setDateRange] = useState(getCurrentWeekRange());
    const [loading, setLoading] = useState(true);

    // --- 1. DYNAMIC SERVER-SIDE QUERIES ---
    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!user?.uid) return;
            setLoading(true);
            try {
                const usersRef = collection(db, 'users');
                let q;

                const userCountry = userData?.location?.country || userData?.country || 'Lebanon';
                const sortField = activeTime === 'Weekly' ? 'weeklyDistance' : 'totalKm';

                if (activeScope === 'Country') {
                    // Use a simple query for country - Firestore will handle the composite index
                    q = query(usersRef, where('location.country', '==', userCountry), orderBy(sortField, 'desc'), limit(100));
                } else {
                    // Global & Friends - fetch top users
                    q = query(usersRef, orderBy(sortField, 'desc'), limit(100));
                }

                const snapshot = await getDocs(q);
                let users = [];

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (docSnap.id === user.uid) return; // Skip self, we append current user later

                    users.push({
                        id: docSnap.id,
                        name: data.name || 'Runner',
                        avatar: data.avatar || null,
                        displayDistance: data[sortField] || 0,
                        country: data.location?.country || data.country || null,
                        flag: getCountryFlag(data.location?.country || data.country),
                        isCurrentUser: false
                    });
                });

                // --- 2. LOCAL FRIENDS FILTERING ---
                if (activeScope === 'Friends') {
                    const following = userData?.following || [];
                    users = users.filter(u => following.includes(u.id));
                }

                // --- 3. APPEND CURRENT USER & RANK ---
                const currentUserDist = activeTime === 'Weekly' ? (userData?.weeklyDistance || 0) : (userData?.totalKm || 0);
                const currentUser = {
                    id: user.uid,
                    name: userData?.name || 'You',
                    avatar: userData?.avatar,
                    displayDistance: currentUserDist,
                    flag: getCountryFlag(userCountry),
                    country: userCountry,
                    isCurrentUser: true
                };

                const combined = [...users, currentUser];
                combined.sort((a, b) => b.displayDistance - a.displayDistance);
                const ranked = combined.map((item, index) => ({ ...item, rank: index + 1 }));

                setLeaderboardData(ranked);

                if (activeTime === 'Weekly') setDateRange(getCurrentWeekRange());
                else setDateRange('All Time Records');

            } catch (error) {
                console.error('Leaderboard query error:', error);
                // If query fails (e.g., missing composite index), try simpler query
                try {
                    const fallbackQ = query(usersRef, limit(50));
                    const fallbackSnapshot = await getDocs(fallbackQ);
                    let users = [];
                    fallbackSnapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        users.push({
                            id: docSnap.id,
                            name: data.name || 'Runner',
                            avatar: data.avatar || null,
                            displayDistance: data.weeklyDistance || 0,
                            country: data.location?.country || data.country || null,
                            flag: getCountryFlag(data.location?.country || data.country),
                            isCurrentUser: docSnap.id === user.uid
                        });
                    });
                    const currentUser = {
                        id: user.uid,
                        name: userData?.name || 'You',
                        avatar: userData?.avatar,
                        displayDistance: userData?.weeklyDistance || 0,
                        flag: getCountryFlag(userData?.location?.country || 'Lebanon'),
                        isCurrentUser: true
                    };
                    const combined = [...users.filter(u => u.id !== user.uid), currentUser];
                    combined.sort((a, b) => b.displayDistance - a.displayDistance);
                    setLeaderboardData(combined.map((item, index) => ({ ...item, rank: index + 1 })));
                } catch (fallbackError) {
                    console.error('Leaderboard fallback error:', fallbackError);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [user?.uid, activeTime, activeScope, userData?.location?.country, userData?.following]);

    // (Logic subsumed by dynamic query effect above)

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
                <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
                    <SkeletonCard variant="row" count={8} />
                </View>
            ) : (
                <LeaderboardList data={leaderboardData} activeScope={activeScope} />
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