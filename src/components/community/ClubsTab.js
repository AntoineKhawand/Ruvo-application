import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/legacy-theme.js';

const ListHeader = ({ searchQuery, setSearchQuery, navigation }) => (
    <View style={styles.stickyBar}>
        <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
            <TextInput
                style={{ color: '#FFF', fontFamily: 'Poppins_400Regular', flex: 1 }}
                placeholder="Search clubs..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                textContentType="none"
                autoComplete="off"
                importantForAutofill="no"
            />
        </View>
        <TouchableOpacity style={styles.createBtnMain} onPress={() => navigation.navigate('CreateClub')}>
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
    </View>
);

export default function ClubsTab({
    clubs,
    searchQuery,
    setSearchQuery,
    navigation,
    handleJoinPress,
}) {
    const filteredClubs = clubs.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const myClubs = filteredClubs.filter(c => c.joined);
    const discoverClubs = filteredClubs.filter(c => !c.joined);

    // Build a flat data array for FlatList: sections + items
    const sections = [];
    if (myClubs.length > 0) {
        sections.push({ type: 'myHeader' });
        sections.push({ type: 'myScroll', clubs: myClubs });
    }
    if (discoverClubs.length > 0) {
        sections.push({ type: 'discoverHeader' });
        discoverClubs.forEach(c => sections.push({ type: 'discoverItem', club: c }));
    }
    if (sections.length === 0) {
        sections.push({ type: 'empty' });
    }

    const renderMyClubItem = useCallback(({ item: club }) => (
        <TouchableOpacity
            style={styles.myClubCard}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('ClubDetail', { clubData: club })}
        >
            <View style={[styles.clubIconCircle, { backgroundColor: club.color }]}>
                <MaterialCommunityIcons name={club.icon} size={20} color="#000" />
            </View>
            <View>
                <Text style={styles.myClubName}>{club.name}</Text>
                <Text style={styles.myClubMembers}>
                    {Array.isArray(club.members) ? club.members.length : (club.memberCount || 0)} Members
                </Text>
            </View>
        </TouchableOpacity>
    ), [navigation]);

    const renderItem = useCallback(({ item }) => {
        if (item.type === 'myHeader') {
            return (
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>My Clubs</Text>
                    <Text style={{ color: '#666', fontSize: 14 }}>{myClubs.length}</Text>
                </View>
            );
        }
        if (item.type === 'myScroll') {
            return (
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={item.clubs}
                    keyExtractor={c => c.id}
                    style={{ marginBottom: 30 }}
                    renderItem={renderMyClubItem}
                />
            );
        }
        if (item.type === 'discoverHeader') {
            return <Text style={styles.sectionTitle}>Discover Clubs</Text>;
        }
        if (item.type === 'discoverItem') {
            const club = item.club;
            return (
                <TouchableOpacity
                    style={styles.discoverCard}
                    onPress={() => navigation.navigate('ClubDetail', { clubData: club })}
                >
                    <View style={[styles.discoverIconCircle, { backgroundColor: club.color }]}>
                        <MaterialCommunityIcons name={club.icon} size={24} color="#FFF" />
                    </View>
                    <View style={styles.discoverInfo}>
                        <Text style={styles.discoverName}>{club.name}</Text>
                        <Text style={styles.discoverDesc} numberOfLines={2}>{club.desc}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <Ionicons name="people" size={12} color="#666" />
                            <Text style={styles.discoverMembers}>
                                {Array.isArray(club.members) ? club.members.length : (club.memberCount || 0)} Members
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={club.requestSent ? styles.requestedBtn : styles.joinBtn}
                        onPress={() => handleJoinPress(club)}
                    >
                        <Text style={club.requestSent ? styles.requestBtnText : styles.joinBtnText}>
                            {club.requestSent ? 'Request Sent' : (club.type === 'private' ? 'Request' : 'Join')}
                        </Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            );
        }
        if (item.type === 'empty') {
            return (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Ionicons name="people-outline" size={48} color="#333" />
                    <Text style={{ color: '#666', marginTop: 12, fontFamily: 'Poppins_400Regular' }}>No clubs found</Text>
                </View>
            );
        }
        return null;
    }, [myClubs.length, navigation, handleJoinPress, renderMyClubItem]);


    return (
        <FlatList
            data={sections}
            keyExtractor={(item, idx) => `${item.type}-${idx}`}
            renderItem={renderItem}
            ListHeaderComponent={<ListHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} navigation={navigation} />}
            stickyHeaderIndices={[0]}
            contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
        />
    );
}

const styles = StyleSheet.create({
    stickyBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#000', paddingTop: 4, paddingHorizontal: 20 },
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
    requestedBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    requestBtnText: { color: '#BBB', fontSize: 11, fontFamily: 'Poppins_600SemiBold' }
});
