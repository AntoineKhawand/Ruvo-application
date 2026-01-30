import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, Modal, ScrollView, Share, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext';
import { getFlag } from '../utils/helpers';

const { width } = Dimensions.get('window');

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params || {}; 
  const { userData, sendFriendRequest, cancelFriendRequest, blockUser, unblockUser, addGear } = useUser();
  const [showMenu, setShowMenu] = useState(false);
  
  const [profileData, setProfileData] = useState({
      name: 'Loading...', distance: 0, runs: 0, pace: '0:00', gearLimit: 500, achievements: []
  });

  // --- 1. DETERMINE IF "ME" OR "THEM" ---
  const isMe = userId === 'currentUser' || userId === undefined || userId === userData.id;

  useEffect(() => {
      if (isMe) {
          // CALCULATE MY REAL STATS
          const totalKm = userData.runHistory.reduce((acc, run) => acc + (parseFloat(run.distance) || 0), 0);
          const totalRuns = userData.runHistory.length;
          const avgPace = totalRuns > 0 ? userData.runHistory[0].pace : '0:00'; 
          const activeGear = userData.gearList.find(g => g.isDefault) || userData.gearList[0];

          setProfileData({
              name: userData.name, 
              avatar: userData.avatar, 
              flag: getFlag(userData.location?.country), 
              level: userData.level, 
              bio: "My running journey.",
              gear: activeGear?.name || "None", 
              gearDist: activeGear?.distance || 0, 
              gearLimit: activeGear?.limit || 500,
              distance: totalKm.toFixed(1), 
              runs: totalRuns, 
              pace: avgPace,
              achievements: userData.badges || [], 
              recentRun: userData.runHistory[0] ? {
                  title: userData.runHistory[0].title, 
                  date: "Recently", 
                  dist: parseFloat(userData.runHistory[0].distance).toFixed(2) + " km",
                  time: userData.runHistory[0].duration, 
                  pace: userData.runHistory[0].pace
              } : null
          });
      } else {
          // LOAD BOT DATA (FIXED LOGIC)
          const bot = userData.allUsers.find(u => u.id === userId);
          if (bot) {
              setProfileData({
                  name: bot.name, 
                  avatar: bot.avatar, 
                  flag: bot.flag, 
                  level: bot.level, 
                  bio: "Dedicated Runner", // Default bio for bots
                  gear: bot.gear, 
                  gearDist: 120, // Simulated distance for bots
                  gearLimit: 800,
                  distance: bot.performance?.year || 0, 
                  runs: bot.stats?.runs || 0, 
                  pace: bot.stats?.pace || '5:30',
                  achievements: bot.achievements || [], // Correctly load bot's badges
                  recentRun: bot.recentRun
              });
          }
      }
  }, [userId, userData]);

  const isFriend = !isMe && userData.following.includes(userId);
  const isRequested = !isMe && userData.requests.includes(userId);
  const isBlocked = !isMe && userData.blocked.includes(userId);

  // --- NAVIGATION FIX FOR CHAT LOOP ---
  const handleChat = () => {
      const routes = navigation.getState().routes;
      const prevRoute = routes[routes.length - 2];

      if (prevRoute && prevRoute.name === 'ChatScreen' && prevRoute.params?.userId === userId) {
          navigation.goBack();
      } else {
          navigation.navigate('ChatScreen', { userId: userId });
      }
  };

  const handleMainAction = () => {
    if (isMe) Alert.alert("Edit", "Profile editing coming soon.");
    else if (isBlocked) Alert.alert("Unblock?", `Unblock ${profileData.name}?`, [{ text: "Cancel" }, { text: "Unblock", onPress: () => unblockUser(userId) }]);
    else if (isRequested) cancelFriendRequest(userId);
    else if (!isFriend) sendFriendRequest(userId);
  };

  const handleMenuOption = async (action) => {
      setShowMenu(false);
      if (action === 'Block') { blockUser(userId); navigation.goBack(); } 
      else if (action === 'Unblock') unblockUser(userId);
      else if (action === 'Report') Alert.alert("Reported", "User has been reported.");
      else if (action === 'Share') try { await Share.share({ message: `Check out ${profileData.name} on Ruvo!` }); } catch (error) {}
  };

  const handleAddGear = () => { Alert.prompt("Add New Gear", "Enter shoe name:", [{ text: "Cancel", style: "cancel" }, { text: "Add", onPress: (text) => { if(text) addGear(text, 500); } }], "plain-text"); };
  
  const gearProgress = Math.min((profileData.gearDist || 0) / (profileData.gearLimit || 500), 1);
  const gearColor = gearProgress > 0.9 ? '#FF3B30' : gearProgress > 0.7 ? 'orange' : COLORS.accent;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => setShowMenu(true)}><Ionicons name="ellipsis-horizontal" size={24} color="#FFF" /></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <View style={styles.avatarContainer}>
              <Image source={profileData.avatar ? { uri: profileData.avatar } : require('../../assets/icon.png')} style={styles.avatar} />
              <View style={styles.levelBadge}><Text style={styles.levelText}>Lvl {profileData.level || 1}</Text></View>
            </View>
            <Text style={styles.userName}>{profileData.name} {profileData.flag}</Text>
            <Text style={styles.bio}>{profileData.bio}</Text>
            
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.followBtn, isBlocked ? {backgroundColor:'red'} : (isFriend||isRequested)?{backgroundColor:'#333'}:{backgroundColor:COLORS.accent}]} onPress={handleMainAction}>
                <Text style={[styles.followText, (isFriend || isRequested || isBlocked) && {color:'#FFF'}]}>{isMe ? "Edit Profile" : isBlocked ? "Blocked" : isFriend ? "Following" : isRequested ? "Requested" : "Follow"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.messageBtn} onPress={handleChat}><Ionicons name="chatbubble-outline" size={20} color="#FFF" /></TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statCol}><Text style={styles.statValue}>{profileData.distance}</Text><Text style={styles.statLabel}>Total km</Text></View>
            <View style={styles.vertDivider} />
            <View style={styles.statCol}><Text style={styles.statValue}>{profileData.runs}</Text><Text style={styles.statLabel}>Runs</Text></View>
            <View style={styles.vertDivider} />
            <View style={styles.statCol}><Text style={styles.statValue}>{profileData.pace}</Text><Text style={styles.statLabel}>Avg Pace</Text></View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.badgesRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(profileData.achievements && profileData.achievements.length > 0) ? (
                        profileData.achievements.map((badge, index) => (
                            <View key={index} style={styles.badgeItem}>
                                <View style={styles.badgeIcon}><Ionicons name={badge.icon || 'medal'} size={20} color="#000" /></View>
                                <Text style={styles.badgeText}>{badge.name}</Text>
                            </View>
                        ))
                    ) : (<Text style={{color:'#666', fontStyle:'italic'}}>No achievements yet.</Text>)}
                </ScrollView>
            </View>
          </View>

          <View style={styles.section}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <Text style={styles.sectionTitle}>Gear</Text>
                {isMe && <TouchableOpacity onPress={handleAddGear}><Text style={{color:COLORS.accent, fontWeight:'bold'}}>+ Add</Text></TouchableOpacity>}
            </View>
            <View style={styles.gearRow}>
                <MaterialCommunityIcons name="shoe-sneaker" size={24} color={gearColor} />
                <View style={{marginLeft: 15, flex:1}}>
                    <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                        <Text style={styles.gearName}>{profileData.gear || "Unknown"}</Text>
                        <Text style={styles.gearDistText}>{Math.floor(profileData.gearDist)} / {profileData.gearLimit} km</Text>
                    </View>
                    <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${gearProgress * 100}%`, backgroundColor: gearColor }]} /></View>
                </View>
            </View>
          </View>

          {profileData.recentRun && (
                <View style={{paddingHorizontal:20, marginBottom:25}}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    <View style={styles.activityCard}>
                        <View style={styles.actHeader}>
                            <Image source={profileData.avatar ? { uri: profileData.avatar } : require('../../assets/icon.png')} style={styles.tinyAvatar} />
                            <View><Text style={styles.actTitle}>{profileData.recentRun.title}</Text><Text style={styles.actDate}>{profileData.recentRun.date}</Text></View>
                        </View>
                        <View style={styles.actStats}>
                            <Text style={styles.actStat}>{profileData.recentRun.dist}</Text>
                            <Text style={styles.actStat}>{profileData.recentRun.time}</Text>
                            <Text style={styles.actStat}>{profileData.recentRun.pace}</Text>
                        </View>
                    </View>
                </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showMenu} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
              <View style={styles.menuSheet}>
                  <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuOption('Share')}><Text style={styles.menuText}>Share Profile</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuOption('Report')}><Text style={[styles.menuText, {color:'orange'}]}>Report User</Text></TouchableOpacity>
                  {!isBlocked && !isMe ? (<TouchableOpacity style={styles.menuItem} onPress={() => handleMenuOption('Block')}><Text style={[styles.menuText, {color:'red'}]}>Block User</Text></TouchableOpacity>) : (isBlocked && <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuOption('Unblock')}><Text style={styles.menuText}>Unblock User</Text></TouchableOpacity>)}
                  <TouchableOpacity style={styles.cancelItem} onPress={() => setShowMenu(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              </View>
          </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems:'center' },
  headerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
  scrollContent: { paddingBottom: 40 },
  heroSection: { alignItems: 'center', paddingVertical: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: COLORS.accent },
  avatarContainer: { marginBottom: 15 },
  levelBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  levelText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#000' },
  userName: { fontSize: 22, color: '#FFF', fontFamily: 'Poppins_700Bold' },
  bio: { color: '#888', marginTop: 5, fontFamily: 'Poppins_400Regular', fontSize: 14, textAlign:'center', paddingHorizontal:20 },
  actionRow: { flexDirection: 'row', marginTop: 20 },
  followBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 30, paddingVertical: 10, borderRadius: 25, marginRight: 10, minWidth: 120, alignItems:'center' },
  followText: { fontFamily: 'Poppins_700Bold', color: '#000' },
  messageBtn: { backgroundColor: '#333', padding: 10, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  statsCard: { flexDirection: 'row', backgroundColor: '#1C1C1E', margin: 20, padding: 20, borderRadius: 16, justifyContent: 'space-between' },
  statCol: { alignItems: 'center' },
  statValue: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
  statLabel: { color: '#666', fontSize: 12, marginTop: 2 },
  vertDivider: { width: 1, backgroundColor: '#333' },
  section: { paddingHorizontal: 20, marginBottom: 25 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 15 },
  gearRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', padding: 15, borderRadius: 12 },
  gearName: { color: '#FFF', fontFamily: 'Poppins_600SemiBold' },
  gearDistText: { color: '#666', fontSize: 12 },
  progressBarBg: { height: 6, backgroundColor: '#333', borderRadius: 3, marginTop: 8, width: '100%' },
  progressBarFill: { height: 6, borderRadius: 3 },
  badgesRow: { flexDirection: 'row' },
  badgeItem: { alignItems: 'center', marginRight: 20 },
  badgeIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  badgeText: { color: '#CCC', fontSize: 10, fontFamily: 'Poppins_500Medium' },
  activityCard: { backgroundColor: '#1C1C1E', padding: 15, borderRadius: 12 },
  actHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tinyAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  actTitle: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  actDate: { color: '#666', fontSize: 11 },
  actStats: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10 },
  actStat: { color: COLORS.accent, fontFamily: 'Poppins_500Medium', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 40 },
  menuSheet: { backgroundColor: '#1C1C1E', borderRadius: 20, padding: 20 },
  menuItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  menuText: { color: '#FFF', fontSize: 16, textAlign: 'center', fontFamily: 'Poppins_500Medium' },
  cancelItem: { paddingVertical: 15, marginTop: 10 },
  cancelText: { color: '#AAA', fontSize: 16, textAlign: 'center', fontFamily: 'Poppins_600SemiBold' }
});