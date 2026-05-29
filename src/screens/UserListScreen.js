import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { getFlag } from '../utils/helpers';
import UserAvatar from '../components/UserAvatar';

const COLORS = {
    primary: "#000000",
    card: "#1C1C1E",
    accent: "#CCFF00",
    text: "#FFFFFF",
    subText: "#888888",
    border: "#333333"
};

export default function UserListScreen({ navigation }) {
    const route = useRoute();
    const { title, userIds = [] } = route.params || {};
    const { userData, followUser, unfollowUser } = useUser();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!userIds || userIds.length === 0) {
                setUsers([]);
                setLoading(false);
                return;
            }

            try {
                // Firestore 'in' query supports max 10 items. We need to chunk if list is long.
                // For MVP, we'll limit to first 10 or fetch in batches.
                // NOTE: A better approach for production is pagination or a dedicated 'friends' subcollection.

                const chunks = [];
                for (let i = 0; i < userIds.length; i += 10) {
                    chunks.push(userIds.slice(i, i + 10));
                }

                const chunkResults = await Promise.all(
                    chunks.flatMap(chunk => chunk.length === 0 ? [] : [
                        getDocs(query(collection(db, "users"), where(documentId(), 'in', chunk))).then(snap =>
                            snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }))
                        )
                    ])
                );
                const allFetchedUsers = chunkResults.flat();

                // If some userIds correspond to bots that don't exist in 'users' collection,
                // we might want to fake them or filter them out.
                // For now, let's filter out anyone not found (which handles deleted users too).

                setUsers(allFetchedUsers);
            } catch (error) {
                console.error("Error fetching users:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [userIds]);

    const isFollowing = (targetUid) => {
        return userData?.following?.includes(targetUid);
    };

    const isRequested = (targetUid) => {
        return userData?.requests?.includes(targetUid);
    };

    const handleToggleFollow = async (targetUid) => {
        if (isFollowing(targetUid)) {
            await unfollowUser(targetUid);
        } else if (isRequested(targetUid)) {
            return;
        } else {
            await followUser(targetUid);
        }
    };

    const renderUserItem = ({ item }) => (
        <View style={styles.userCard}>
            <TouchableOpacity
                style={styles.userInfo}
                onPress={() => item.uid !== userData.uid && navigation.push('UserProfile', { userId: item.uid })}
                disabled={item.uid === userData.uid} // Can't view own profile this way
            >
                <UserAvatar uri={item.avatar} name={item.name} size={44} />
                <View style={styles.textContainer}>
                    <Text style={styles.name}>{item.name} {getFlag(item.location?.country)}</Text>
                    <Text style={styles.level}>Level {item.level || 1}</Text>
                </View>
            </TouchableOpacity>

            {item.uid !== userData.uid && (
                <TouchableOpacity
                    style={[styles.followButton, (isFollowing(item.uid) || isRequested(item.uid)) ? styles.followingBtn : styles.followBtn]}
                    onPress={() => handleToggleFollow(item.uid)}
                >
                    <Text style={[styles.followText, (isFollowing(item.uid) || isRequested(item.uid)) ? styles.followingText : styles.followBtnText]}>
                        {isFollowing(item.uid) ? 'Following' : isRequested(item.uid) ? 'Requested' : 'Follow'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title || 'Users'}</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <FlatList
                    data={users}
                    renderItem={renderUserItem}
                    keyExtractor={item => item.uid}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={styles.emptyText}>No users found.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.primary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
    listContent: { padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
    emptyText: { color: COLORS.subText, fontSize: 16 },

    userCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, padding: 15, borderRadius: 12, marginBottom: 10 },
    userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    textContainer: { flex: 1 },
    name: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    level: { color: COLORS.subText, fontSize: 12, marginTop: 2 },

    followButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, minWidth: 90, alignItems: 'center' },
    followBtn: { backgroundColor: COLORS.accent },
    followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#666' },
    followText: { fontSize: 13, fontWeight: '700' },
    followBtnText: { color: '#000' },
    followingText: { color: '#FFF' }
});
