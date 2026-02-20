import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/legacy-theme.js';

export default function ClubsTab({
    clubs,
    searchQuery,
    setSearchQuery,
    navigation,
    handleJoinPress,
    seedClubs
}) {
    const filteredClubs = clubs.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const myClubs = filteredClubs.filter(c => c.joined);
    const discoverClubs = filteredClubs.filter(c => !c.joined);

    return (
        <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 }}>
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

            {myClubs.length > 0 && (
                <>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>My Clubs</Text>
                        <Text style={{ color: '#666', fontSize: 14 }}>{myClubs.length}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 30 }}>
                        {myClubs.map(club => (
                            <TouchableOpacity key={club.id} style={styles.myClubCard} activeOpacity={0.9} onPress={() => navigation.navigate('ClubDetail', { clubData: club })}>
                                <View style={[styles.clubIconCircle, { backgroundColor: club.color }]}>
                                    <MaterialCommunityIcons name={club.icon} size={20} color="#000" />
                                </View>
                                <View>
                                    <Text style={styles.myClubName}>{club.name}</Text>
                                    <Text style={styles.myClubMembers}>{Array.isArray(club.members) ? club.members.length : (club.memberCount || 0)} Members</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </>
            )}

            {discoverClubs.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Discover Clubs</Text>
                    {discoverClubs.map(club => (
                        <TouchableOpacity key={club.id} style={styles.discoverCard} onPress={() => navigation.navigate('ClubDetail', { clubData: club })}>
                            <View style={[styles.discoverIconCircle, { backgroundColor: club.color }]}>
                                <MaterialCommunityIcons name={club.icon} size={24} color="#FFF" />
                            </View>
                            <View style={styles.discoverInfo}>
                                <Text style={styles.discoverName}>{club.name}</Text>
                                <Text style={styles.discoverDesc} numberOfLines={2}>{club.desc}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                                    <Ionicons name="people" size={12} color="#666" />
                                    <Text style={styles.discoverMembers}>{Array.isArray(club.members) ? club.members.length : (club.memberCount || 0)} Members</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={club.requestSent ? styles.requestedBtn : styles.joinBtn} onPress={() => handleJoinPress(club)}>
                                <Text style={club.requestSent ? styles.requestBtnText : styles.joinBtnText}>
                                    {club.requestSent ? 'Request Sent' : (club.type === 'private' ? 'Request' : 'Join')}
                                </Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </>
            )}

            {/* 🛠️ DEV SEED BUTTON */}
            {seedClubs && (
                <TouchableOpacity
                    style={{ marginTop: 20, padding: 15, backgroundColor: '#333', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#444' }}
                    onPress={seedClubs}
                >
                    <Text style={{ color: '#AAA', fontFamily: 'Poppins_600SemiBold' }}>🛠️ DEV: Seed Initial Clubs</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
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
