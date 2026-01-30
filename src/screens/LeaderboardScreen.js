import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext'; // 1. Import UserContext

// --- DATE HELPER ---
const getCurrentWeekRange = () => {
    const today = new Date();
    const diff = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(today.setDate(diff + 6));
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

    // Format distance safely
    const displayDistance = typeof item.displayDistance === 'number' 
        ? `${item.displayDistance.toFixed(1)} km` 
        : item.distance || '0.0 km';

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
                    <Text style={[styles.name, isCurrentUser && {color: COLORS.accent}]}>{item.name}</Text>
                    {item.flag && <Text style={styles.flag}>{item.flag}</Text>}
                </View>
                <Text style={styles.distance}>{displayDistance}</Text>
            </View>
            {/* Logic for Status Icon based on Rank */}
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
    const { userData } = useUser(); // 2. Get Real Data
    
    const [activeScope, setActiveScope] = useState('Friends');
    const [activeTime, setActiveTime] = useState('Weekly');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [dateRange, setDateRange] = useState(getCurrentWeekRange());

    // 3. Process Data Effect
    useEffect(() => {
        // A. Calculate Current User Distance
        let userDist = 0;
        if (userData.runHistory) {
            userDist = userData.runHistory.reduce((acc, run) => {
                // Simple logic: In a real app, you'd check run.date vs activeTime
                return acc + (parseFloat(run.distance) || 0);
            }, 0);
        }

        // B. Prepare Current User Object
        const currentUser = {
            id: 'currentUser',
            name: userData.name || 'You',
            avatar: userData.avatar,
            displayDistance: userDist,
            flag: '🇱🇧', // Default flag or from userData.location
            isCurrentUser: true
        };

        // C. Filter & Process Other Users (Bots/Friends)
        let otherUsers = userData.allUsers || [];

        // Scope Filter
        if (activeScope === 'Friends') {
            // Only show people I follow
            otherUsers = otherUsers.filter(u => (userData.following || []).includes(u.id));
        } else if (activeScope === 'Country') {
            // For now, just show everyone or filter by a 'country' field if you had one
             otherUsers = otherUsers; // keeping all for demo density
        }
        // 'Global' shows everyone

        // Map data to standardize structure
        const mappedUsers = otherUsers.map(u => ({
            ...u,
            // Use 'performance' stats for bots, different for Weekly vs All-Time
            displayDistance: activeTime === 'Weekly' ? (u.performance?.week || 0) : (u.performance?.year || 0)
        }));

        // D. Combine, Sort, Rank
        const allData = [...mappedUsers, currentUser];
        
        // Sort DESC by distance
        allData.sort((a, b) => b.displayDistance - a.displayDistance);

        // Assign Rank
        const rankedData = allData.map((item, index) => ({
            ...item,
            rank: index + 1
        }));

        setLeaderboardData(rankedData);
        
        // Update Date Label based on filter
        if (activeTime === 'Weekly') setDateRange(getCurrentWeekRange());
        else setDateRange('All Time Records');

    }, [userData, activeScope, activeTime]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
            <View style={styles.headerContainer}>
                {/* Scope Filters */}
                <View style={styles.filterRow}>
                    <FilterButton label="Friends" isActive={activeScope === 'Friends'} onPress={() => setActiveScope('Friends')} />
                    <FilterButton label="Country (Lebanon)" isActive={activeScope === 'Country'} onPress={() => setActiveScope('Country')} />
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

            <FlatList
                data={leaderboardData}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <LeaderboardItem item={item} />}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={{alignItems:'center', marginTop: 50}}>
                         <Text style={{color:'#666'}}>No runners found in this category.</Text>
                    </View>
                }
            />
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