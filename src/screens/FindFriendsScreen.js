import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Keyboard,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { getFlag } from '../utils/helpers';

const COLORS = {
    accent: "#CCFF00",
    primary: "#000000",
    secondary: "#1C1C1E",
    text: "#FFFFFF",
    subText: "#888888",
    card: "#151515"
};

const { width, height } = Dimensions.get('window');

export default function FindFriendsScreen({ navigation }) {
    const { userData, followUser, unfollowUser } = useUser();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [suggestedUsers, setSuggestedUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(true);

    // 1. Fetch Suggestions (Recent Users)
    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                // Determine potential friends: exclude self and already followed
                const following = userData?.following || [];
                const blocked = userData?.blocked || [];
                const excludeIds = [userData?.uid, ...following, ...blocked];

                // Simple query: Last 20 users joined
                const q = query(
                    collection(db, "users"),
                    orderBy("joinedAt", "desc"), // Ensure 'joinedAt' index exists or use simple limit
                    limit(20)
                );

                const snapshot = await getDocs(q);
                const users = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).filter(u => !excludeIds.includes(u.id));

                setSuggestedUsers(users);
            } catch (error) {
                console.error("Error fetching suggestions:", error);
            } finally {
                setLoadingSuggestions(false);
            }
        };

        fetchSuggestions();
    }, []);

    // 2. Search Logic
    const handleSearch = async (term) => {
        const searchValue = term || searchTerm;
        if (!searchValue.trim()) {
            setSearchResults([]);
            return;
        }

        setLoading(true);
        try {
            const searchNormalized = searchValue.toLowerCase();
            const q = query(
                collection(db, "users"),
                where("nameLowercase", ">=", searchNormalized),
                where("nameLowercase", "<=", searchNormalized + '\uf8ff'),
                limit(10)
            );

            const snapshot = await getDocs(q);
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(u => u.id !== userData?.uid);

            setSearchResults(users);
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollowToggle = async (userId) => {
        const isFollowing = userData?.following?.includes(userId);
        if (isFollowing) {
            await unfollowUser(userId);
            // Optional: Remove from suggestions list if followed? keeping it for now
        } else {
            await followUser(userId);
        }
    };

    const renderUserItem = ({ item }) => {
        const isFollowing = userData?.following?.includes(item.id);

        return (
            <TouchableOpacity style={styles.userCard} activeOpacity={0.8} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
                <View style={styles.userLeft}>
                    {item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{item.name ? item.name.charAt(0) : 'U'}</Text>
                        </View>
                    )}
                    <View style={styles.userInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.userName}>{item.name}</Text>
                            {item.location?.country && <Text style={styles.flag}>{getFlag(item.location.country)}</Text>}
                        </View>
                        <Text style={styles.userLevel}>Level {item.level || 1} • {item.location?.city || 'Runner'}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.followBtn, isFollowing && styles.followingBtn]}
                    onPress={() => handleFollowToggle(item.id)}
                >
                    <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                        {isFollowing ? "Following" : "Follow"}
                    </Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* BIG HEADER (Ad-Like) */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>
                <View style={styles.headerContent}>
                    <Text style={styles.bigTitle}>BUILD YOUR{'\n'}SQUAD 🚀</Text>
                    <Text style={styles.subtitle}>Running is better together. Find friends, compete in challenges, and share your runs.</Text>
                </View>
            </View>

            <View style={styles.body}>
                {/* SEARCH BAR */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#666" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for runners..."
                        placeholderTextColor="#666"
                        value={searchTerm}
                        onChangeText={(text) => {
                            setSearchTerm(text);
                            handleSearch(text);
                        }}
                    />
                    {searchTerm.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchTerm(''); setSearchResults([]); Keyboard.dismiss(); }}>
                            <Ionicons name="close-circle" size={18} color="#666" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* LIST AREA */}
                {loading ? (
                    <View style={styles.center}><ActivityIndicator color={COLORS.accent} /></View>
                ) : searchTerm.length > 0 ? (
                    <FlatList
                        data={searchResults}
                        renderItem={renderUserItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
                    />
                ) : (
                    <>
                        <Text style={styles.sectionTitle}>SUGGESTED FOR YOU</Text>
                        {loadingSuggestions ? (
                            <ActivityIndicator color="#444" style={{ marginTop: 20 }} />
                        ) : (
                            <FlatList
                                data={suggestedUsers}
                                renderItem={renderUserItem}
                                keyExtractor={item => item.id}
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={<Text style={styles.emptyText}>No suggestions available.</Text>}
                            />
                        )}
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        backgroundColor: COLORS.accent,
        paddingTop: Platform.OS === 'ios' ? 50 : 40,
        paddingBottom: 30,
        paddingHorizontal: 25,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
    },
    headerTop: { alignItems: 'flex-end', marginBottom: 10 },
    closeBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.2)',
        alignItems: 'center', justifyContent: 'center'
    },
    headerContent: {},
    bigTitle: {
        color: '#000',
        fontSize: 32,
        fontFamily: 'Poppins_900Black',
        lineHeight: 34,
        letterSpacing: -1,
        marginBottom: 8
    },
    subtitle: {
        color: '#111',
        fontSize: 14,
        fontFamily: 'Poppins_500Medium',
        lineHeight: 20
    },

    body: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 15,
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#333'
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Poppins_500Medium',
        marginLeft: 10
    },

    sectionTitle: {
        color: '#666',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 1,
        marginBottom: 10
    },
    listContent: { paddingBottom: 50 },

    // USER CARD
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#151515',
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#222'
    },
    userLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#333' },
    avatarPlaceholder: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: '#222',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333'
    },
    avatarText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    userInfo: { marginLeft: 12, flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    userName: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold' },
    flag: { fontSize: 14, marginLeft: 6 },
    userLevel: { color: '#666', fontSize: 12 },

    followBtn: {
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20
    },
    followingBtn: { backgroundColor: '#222', borderWidth: 1, borderColor: '#444' },
    followBtnText: { color: '#000', fontSize: 12, fontFamily: 'Poppins_700Bold' },
    followingBtnText: { color: '#888' },

    center: { alignItems: 'center', marginTop: 30 },
    emptyText: { color: '#666', textAlign: 'center', marginTop: 20, fontStyle: 'italic' }
});
