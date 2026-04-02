import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingNavBar from '../components/FloatingNavBar';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { getFlag } from '../utils/helpers';
import { lightTap } from '../utils/haptics';

const COLORS = {
    accent: "#CCFF00",
    primary: "#000000",
    secondary: "#1C1C1E",
    text: "#FFFFFF"
};

const { width } = Dimensions.get('window');

export default function SearchScreen({ navigation }) {
    const { userData, followUser, unfollowUser, checkPrivacyPermission } = useUser();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const debounceTimer = useRef(null);

    const handleSearch = async (term) => {
        const searchValue = term || searchTerm;
        if (!searchValue.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Firestore standard prefix matching against normalized lowercase names
            // This bypasses the need for heavy engines like Algolia/Typesense for basic functionality
            const searchNormalized = searchValue.toLowerCase();
            const q = query(
                collection(db, "users"),
                where("nameLowercase", ">=", searchNormalized),
                where("nameLowercase", "<=", searchNormalized + '\uf8ff'),
                limit(20)
            );

            const snapshot = await getDocs(q);
            const rawUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                uid: doc.data().uid,
                name: doc.data().name || 'Unknown',
                email: doc.data().email,
                avatar: doc.data().avatar,
                country: doc.data().location?.country,
                level: doc.data().level || 1,
                privacySettings: doc.data().privacySettings || {} // Fetch privacy settings to validate
            }));

            // Filter out current user (compare with document ID)
            let filtered = rawUsers.filter(u => u.id !== userData?.uid);

            // @privacy-enforced: filter Search payloads using 'viewProfile'
            filtered = filtered.filter(u => checkPrivacyPermission(u, 'viewProfile'));

            console.log(`🔍 Search results: ${filtered.length} users found`);
            setSearchResults(filtered);
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const debouncedSearch = useCallback((text) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            handleSearch(text);
        }, 300);
    }, []);

    const handleFollowToggle = async (userId) => {
        const isFollowing = userData?.following?.includes(userId);
        const isRequested = userData?.requests?.includes(userId);
        if (isFollowing) {
            await unfollowUser(userId);
        } else if (!isRequested) {
            await followUser(userId);
        }
    };

    const renderUserItem = ({ item }) => {
        const isFollowing = userData?.following?.includes(item.id);
        const isRequested = userData?.requests?.includes(item.id);

        return (
            <TouchableOpacity
                style={styles.userCard}
                onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                activeOpacity={0.7}
            >
                <View style={styles.userLeft}>
                    {item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                        </View>
                    )}
                    <View style={styles.userInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.userName}>{item.name}</Text>
                            {item.country && <Text style={styles.flag}>{getFlag(item.country)}</Text>}
                        </View>
                        <Text style={styles.userLevel}>Level {item.level}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.followBtn, (isFollowing || isRequested) && styles.followingBtn]}
                    onPress={(e) => {
                        e.stopPropagation();
                        if (!isRequested) handleFollowToggle(item.id);
                    }}
                    disabled={isRequested}
                >
                    <Ionicons
                        name={isFollowing ? "checkmark-circle" : isRequested ? "time-outline" : "person-add-outline"}
                        size={20}
                        color={(isFollowing || isRequested) ? COLORS.accent : "#000"}
                    />
                    <Text style={[styles.followBtnText, (isFollowing || isRequested) && styles.followingBtnText]}>
                        {isFollowing ? "Following" : isRequested ? "Requested" : "Follow"}
                    </Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Search Users</Text>
                    <View style={{ width: 24 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={20} color="#888" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by name..."
                                placeholderTextColor="#666"
                                value={searchTerm}
                                onChangeText={(text) => {
                                    setSearchTerm(text);
                                    debouncedSearch(text);
                                }}
                                returnKeyType="search"
                            />
                            {searchTerm.length > 0 && (
                                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setSearchTerm(''); setSearchResults([]); }}>
                                    <Ionicons name="close-circle" size={20} color="#666" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {isSearching ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={COLORS.accent} />
                        </View>
                    ) : searchResults.length > 0 ? (
                        <FlatList
                            data={searchResults}
                            renderItem={renderUserItem}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContainer}
                            showsVerticalScrollIndicator={false}
                        />
                    ) : searchTerm.length > 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="search-outline" size={60} color="#333" />
                            <Text style={styles.emptyText}>No users found</Text>
                            <Text style={styles.emptySubtext}>Try a different search term</Text>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={60} color="#333" />
                            <Text style={styles.emptyText}>Search for runners</Text>
                            <Text style={styles.emptySubtext}>Find friends by name</Text>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>

            <FloatingNavBar current="Community" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    searchContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 15,
        gap: 10
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 25,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        marginLeft: 10,
        fontFamily: 'Poppins_400Regular'
    },
    searchButton: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: 20,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    searchButtonText: {
        color: '#000',
        fontSize: 14,
        fontFamily: 'Poppins_700Bold'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    listContainer: {
        paddingHorizontal: 20,
        paddingBottom: 100
    },
    userCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 15,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    userLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: COLORS.accent
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.accent
    },
    avatarText: {
        color: COLORS.accent,
        fontSize: 20,
        fontFamily: 'Poppins_700Bold'
    },
    userInfo: {
        marginLeft: 12,
        flex: 1
    },
    userName: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold'
    },
    flag: {
        fontSize: 16,
        marginLeft: 6
    },
    userLevel: {
        color: '#888',
        fontSize: 12,
        marginTop: 2
    },
    followBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6
    },
    followingBtn: {
        backgroundColor: '#333'
    },
    followBtnText: {
        color: '#000',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold'
    },
    followingBtnText: {
        color: COLORS.accent
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40
    },
    emptyText: {
        color: '#888',
        fontSize: 18,
        fontFamily: 'Poppins_600SemiBold',
        marginTop: 20
    },
    emptySubtext: {
        color: '#666',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center'
    }
});
