import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';

const COLORS = {
  background: "#000000",
  card: "#1C1C1E",
  accent: "#CCFF00",
  text: "#FFFFFF",
  subText: "#888888",
  border: "#333333",
  success: "#4CD964"
};

// --- UPDATED REWARD TO 50 XP ---
const XP_PER_INVITE = 50; 

// --- MOCK REFERRALS (3 Friends) ---
const REFERRALS = [
  { id: '1', name: 'Sarah J.', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', status: 'joined', date: '2h ago' },
  { id: '2', name: 'Mike T.', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', status: 'joined', date: '1d ago' },
  { id: '3', name: 'Dani R.', avatar: 'https://randomuser.me/api/portraits/women/68.jpg', status: 'joined', date: '3d ago' },
];

export default function ReferralScreen({ navigation }) {
  const { userData, updateUserProfile } = useUser(); 
  const [copied, setCopied] = useState(false);

  // --- DYNAMIC CODE GENERATION ---
  const [uniqueCode] = useState(() => {
    const namePart = userData?.name ? userData.name.split(' ')[0].toUpperCase() : 'USER';
    const randomPart = Math.floor(1000 + Math.random() * 9000); 
    return `${namePart}-${randomPart}`;
  });

  // --- SYNC XP TO HOME & PROFILE ---
  useEffect(() => {
    const totalMockXP = REFERRALS.length * XP_PER_INVITE; // 3 * 50 = 150 XP

    // Logic: Only add the points if we haven't already marked them as 'claimed'
    if (!userData.hasClaimedReferrals) {
        
        const newTotalXP = (userData.currentXP || 0) + totalMockXP;
        
        // 1. Update the Global State (Home/Profile will now update)
        updateUserProfile({ 
            currentXP: newTotalXP,
            hasClaimedReferrals: true // Mark as done so we don't add it again next time
        });

        // 2. Notify User
        Alert.alert("Referral Bonus", `+${totalMockXP} XP has been added to your profile!`);
    }
  }, []);

  const totalEarned = REFERRALS.length * XP_PER_INVITE;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(uniqueCode);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); 
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on Ruvo! Use code ${uniqueCode} to get started. Download here: https://ruvo.app/invite/${uniqueCode}`,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  const renderFriendItem = ({ item }) => (
    <View style={styles.friendRow}>
      <View style={styles.friendLeft}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendDate}>Joined {item.date}</Text>
        </View>
      </View>
      <View style={styles.statusBadge}>
        <Ionicons name="checkmark-circle" size={16} color="#000" />
        <Text style={styles.statusText}>+{XP_PER_INVITE} XP</Text>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View>
      <View style={styles.heroSection}>
        <View style={styles.iconCircle}>
          <Ionicons name="gift" size={40} color="#000" />
        </View>
        <Text style={styles.heroTitle}>Invite Friends,{'\n'}Level Up Faster.</Text>
        <Text style={styles.heroSub}>
          Get <Text style={{ color: COLORS.accent, fontWeight: 'bold' }}>+{XP_PER_INVITE} XP</Text> for every friend who joins Ruvo.
        </Text>
      </View>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>YOUR UNIQUE CODE</Text>
        
        <TouchableOpacity style={styles.codeBox} onPress={handleCopy} activeOpacity={0.7}>
          <Text style={styles.codeText}>{uniqueCode}</Text>
          <View style={[styles.copyBtn, copied && { backgroundColor: COLORS.success }]}>
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={copied ? "#FFF" : COLORS.subText} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <LinearGradient
            colors={[COLORS.accent, '#AACC00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shareBtnGradient}
          >
            <Ionicons name="share-social" size={20} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.shareBtnText}>SHARE INVITE LINK</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Friends Invited</Text>
          <Text style={styles.statValue}>{REFERRALS.length}</Text>
        </View>
        <View style={[styles.statBox, { marginLeft: 15 }]}>
          <Text style={styles.statLabel}>Total XP Earned</Text>
          <Text style={[styles.statValue, { color: COLORS.accent }]}>{totalEarned} XP</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Your Impact</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Referrals</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={REFERRALS}
        keyExtractor={item => item.id}
        renderItem={renderFriendItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#333" />
            <Text style={styles.emptyText}>No friends yet. Start sharing!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  navTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroSection: { alignItems: 'center', marginVertical: 30 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 20 },
  heroTitle: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: '#FFF', textAlign: 'center', lineHeight: 34 },
  heroSub: { fontSize: 14, color: COLORS.subText, textAlign: 'center', marginTop: 10, fontFamily: 'Poppins_400Regular' },
  codeCard: { backgroundColor: COLORS.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 30 },
  codeLabel: { color: COLORS.subText, fontSize: 12, fontFamily: 'Poppins_700Bold', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  codeBox: { flexDirection: 'row', backgroundColor: '#000', borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed' },
  codeText: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold', letterSpacing: 2 },
  copyBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  shareBtn: { height: 56, borderRadius: 28, overflow: 'hidden', shadowColor: COLORS.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  shareBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  shareBtnText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#000', letterSpacing: 0.5 },
  statsContainer: { flexDirection: 'row', marginBottom: 30 },
  statBox: { flex: 1, backgroundColor: COLORS.card, borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statLabel: { color: COLORS.subText, fontSize: 12, fontFamily: 'Poppins_500Medium', marginBottom: 5 },
  statValue: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold' },
  sectionTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: '#FFF', marginBottom: 15 },
  friendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  friendLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#333' },
  friendName: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  friendDate: { color: COLORS.subText, fontSize: 12, fontFamily: 'Poppins_400Regular' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: '#000', marginLeft: 4 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#666', marginTop: 10, fontFamily: 'Poppins_400Regular' }
});