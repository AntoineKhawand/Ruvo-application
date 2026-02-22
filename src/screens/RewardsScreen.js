import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingNavBar from '../components/FloatingNavBar';
import { functions } from '../config/firebase';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');

const COLORS = {
  background: "#080808",
  card: "#141414",
  accent: "#CCFF00",
  text: "#FFFFFF",
  subText: "#999999",
  border: "#2A2A2A",
  success: "#4CD964",
  danger: "#FF453A",
};

// --- DATA ---
const REWARDS = [
  {
    id: '1', title: '20% Off Mike Sport', category: 'Gear', price: 2500,
    desc: 'Valid storewide in Lebanon',
    longDesc: 'Get 20% off your total purchase at any Mike Sport branch in Lebanon. Valid on apparel, footwear, and equipment. Not valid with other promotions.',
    terms: 'Expires in 30 days • One use per customer',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/1200px-Logo_NIKE.svg.png',
    bgColor: '#FFF'
  },
  {
    id: '2', title: '1 Month Gym Access', category: 'Gym', price: 8000,
    desc: 'Fitness Zone / 180 Fitness',
    longDesc: 'Enjoy unlimited access to Fitness Zone or 180 Fitness for 30 days. Includes access to all classes, sauna, and pool facilities.',
    terms: 'New members only • Must activate within 14 days',
    icon: 'dumbbell', bgColor: '#1A1A1A'
  },
  {
    id: '3', title: 'Whey Protein (2kg)', category: 'Supplements', price: 6500,
    desc: 'Gold Standard - Double Rich Choco',
    longDesc: 'Optimum Nutrition Gold Standard 100% Whey. 24g of protein per serving. Double Rich Chocolate flavor.',
    terms: 'Pickup from nearest GNC or delivery available',
    image: 'https://www.optimumnutrition.com/sites/g/files/mrjbqn236/files/styles/product_main/public/2022-09/1101516_ON_GS_Whey_2lb_DoubleRichChoc_Render_Front.png',
    bgColor: '#222'
  },
  {
    id: '4', title: 'Pre-Workout (C4)', category: 'Supplements', price: 3500,
    desc: 'Explosive Energy - 30 Servings',
    icon: 'lightning-bolt', bgColor: '#1A1A1A',
    longDesc: 'C4 Original Pre-Workout. Explosive energy, heightened focus, and an overwhelming urge to tackle any challenge.',
    terms: 'Flavor: Fruit Punch'
  },
  {
    id: '5', title: 'Weekly Meal Plan', category: 'Nutrition', price: 5000,
    desc: '5 Days Healthy Lunch & Dinner',
    icon: 'food-apple', bgColor: '#1A1A1A',
    longDesc: 'A full week of healthy, macro-counted meals delivered to your door. Choose from Keto, High Protein, or Balanced.',
    terms: 'Delivery Beirut & Metn area only'
  },
  {
    id: '6', title: 'Private PT Session', category: 'Gym', price: 4000,
    desc: '1 Hour with Elite Coach',
    icon: 'account-star', bgColor: '#1A1A1A',
    longDesc: 'One-on-one session with a certified personal trainer. Focus on form, technique, or a specific goal.',
    terms: 'Booking required 24h in advance'
  },
  {
    id: '7', title: 'Adidas Running Cap', category: 'Gear', price: 1800,
    desc: 'Lightweight & Breathable',
    image: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg',
    bgColor: '#FFF',
    longDesc: 'Adidas Aeroready running cap. Moisture-wicking fabric to keep you dry and comfortable.',
    terms: 'One size fits all • Black or White'
  },
  {
    id: '8', title: 'BCAA Energy Drink', category: 'Supplements', price: 800,
    desc: 'Nocco / Celcius (1 Can)',
    icon: 'bottle-soda', bgColor: '#1A1A1A',
    longDesc: 'Caffeine-free BCAA drink to support muscle recovery. Refreshing citrus flavor.',
    terms: 'Pickup from gym reception'
  },
];

const CATEGORIES = ['All', 'Gear', 'Gym', 'Supplements', 'Nutrition'];

export default function RewardsScreen({ navigation }) {
  const { userData, updateUserProfile } = useUser();
  const userCoins = userData.coins || 0;

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const filteredRewards = selectedCategory === 'All'
    ? REWARDS
    : REWARDS.filter(r => r.category === selectedCategory);

  const handleCardPress = (item) => {
    setSelectedReward(item);
  };

  const confirmRedemption = async () => {
    if (!selectedReward) return;

    if (userCoins < selectedReward.price) {
      Alert.alert("Insufficient Funds", "Keep running to earn more coins!");
      return;
    }

    setIsRedeeming(true);

    try {
      const redeemReward = httpsCallable(functions, 'redeemReward');
      const result = await redeemReward({
        rewardId: selectedReward.id,
        price: selectedReward.price,
        title: selectedReward.title
      });

      if (result.data.success) {
        // Update ONLY the local State so the UI reacts instantly.
        // The Cloud Function already deducted the coins on the backend, so we don't
        // push `updateUserProfile` as that would rewrite the server's truth.
        setUserData(prev => ({ ...prev, coins: result.data.newCoinBalance }));
        setSelectedReward(null);

        setTimeout(() => {
          Alert.alert("Success! 🎉", `You redeemed ${selectedReward.title}. Check your email for details.`);
        }, 500);
      }
    } catch (error) {
      console.error("Redemption error:", error);
      Alert.alert("Redemption Failed", error.message || "An error occurred while processing your reward.");
    } finally {
      setIsRedeeming(false);
    }
  };

  const renderRewardItem = ({ item }) => {
    const isAffordable = userCoins >= item.price;
    const progress = userCoins > 0 ? Math.min(1, userCoins / item.price) : 0;
    const progressPercent = Math.floor(progress * 100);

    return (
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.9}
      >
        <View style={[styles.cardHeader, { backgroundColor: item.bgColor }]}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="contain" />
          ) : (
            <MaterialCommunityIcons name={item.icon || 'gift'} size={42} color={item.bgColor === '#FFF' ? '#000' : COLORS.accent} />
          )}
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{item.category.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardDesc} numberOfLines={1}>{item.desc}</Text>

          <View style={styles.priceRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="bitcoin" size={14} color={isAffordable ? COLORS.accent : '#666'} />
              <Text style={[styles.priceText, !isAffordable && { color: '#666' }]}> {item.price}</Text>
            </View>
            {!isAffordable && <Text style={styles.percentText}>{progressPercent}%</Text>}
          </View>

          {!isAffordable && (
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Rewards</Text>
        </View>
        <TouchableOpacity style={styles.historyBtn} onPress={() => setShowHistory(true)}>
          <MaterialCommunityIcons name="clock-time-four-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* WALLET */}
      <LinearGradient colors={['#CCFF00', '#AACC00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.walletCard}>
        <View style={styles.walletContent}>
          <View>
            <Text style={styles.walletLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.walletValue}>{userCoins.toLocaleString()}</Text>
          </View>
          <View style={styles.walletIconBox}><MaterialCommunityIcons name="wallet-outline" size={32} color="#000" /></View>
        </View>
        <View style={styles.walletFooter}><Text style={styles.walletFooterText}>Keep running to earn more.</Text></View>
      </LinearGradient>

      {/* TABS */}
      <View style={styles.tabsWrapper}>
        <FlatList
          horizontal data={CATEGORIES} showsHorizontalScrollIndicator={false} keyExtractor={item => item}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => {
            const isActive = selectedCategory === item;
            return (
              <TouchableOpacity style={[styles.tabItem, isActive && styles.tabItemActive]} onPress={() => setSelectedCategory(item)}>
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* REWARDS GRID */}
      <FlatList
        data={filteredRewards} keyExtractor={item => item.id} renderItem={renderRewardItem}
        numColumns={2} contentContainerStyle={styles.gridContent} columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
      />

      {/* --- DETAIL MODAL (BOTTOM SHEET) --- */}
      <Modal visible={!!selectedReward} transparent animationType="slide" onRequestClose={() => setSelectedReward(null)}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailModalContainer}>
            {selectedReward && (
              <>
                <View style={styles.modalHandle} />

                <View style={[styles.detailImageArea, { backgroundColor: selectedReward.bgColor }]}>
                  {selectedReward.image ? (
                    <Image source={{ uri: selectedReward.image }} style={{ width: 100, height: 100 }} resizeMode="contain" />
                  ) : (
                    <MaterialCommunityIcons name={selectedReward.icon || 'gift'} size={60} color={selectedReward.bgColor === '#FFF' ? '#000' : COLORS.accent} />
                  )}
                  <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setSelectedReward(null)}>
                    <Ionicons name="close" size={20} color="#000" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ padding: 25 }}>
                  <Text style={styles.detailCategory}>{selectedReward.category}</Text>
                  <Text style={styles.detailTitle}>{selectedReward.title}</Text>
                  <Text style={styles.detailPrice}>{selectedReward.price.toLocaleString()} Coins</Text>

                  <View style={styles.divider} />

                  <Text style={styles.detailSectionTitle}>Description</Text>
                  <Text style={styles.detailText}>{selectedReward.longDesc || selectedReward.desc}</Text>

                  <Text style={styles.detailSectionTitle}>Terms & Conditions</Text>
                  <Text style={styles.detailText}>{selectedReward.terms || 'Standard terms apply.'}</Text>

                  <View style={{ height: 100 }} />
                </ScrollView>

                <View style={styles.detailFooter}>
                  <TouchableOpacity
                    style={[
                      styles.redeemFullBtn,
                      (userCoins < selectedReward.price || isRedeeming) && styles.redeemFullBtnDisabled
                    ]}
                    onPress={confirmRedemption}
                    disabled={userCoins < selectedReward.price || isRedeeming}
                  >
                    <Text style={styles.redeemFullText}>
                      {isRedeeming ? "Processing..." : (userCoins >= selectedReward.price ? "Confirm Redemption" : "Insufficient Coins")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* --- HISTORY MODAL (CENTERED) --- */}
      <Modal visible={showHistory} transparent animationType="fade" onRequestClose={() => setShowHistory(false)}>
        <View style={styles.historyOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Wallet History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close-circle" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.historyRow}>
              <View>
                <Text style={styles.hTitle}>5k Run: Beirut Waterfront</Text>
                <Text style={styles.hDate}>Today, 7:00 AM</Text>
              </View>
              <Text style={styles.hPlus}>+350</Text>
            </View>
            <View style={styles.historyRow}>
              <View>
                <Text style={styles.hTitle}>Referral Bonus</Text>
                <Text style={styles.hDate}>Yesterday</Text>
              </View>
              <Text style={styles.hPlus}>+50</Text>
            </View>
          </View>
        </View>
      </Modal>

      <FloatingNavBar current="Rewards" />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, marginBottom: 20 },
  headerTitle: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: '#FFF' },
  headerSub: { fontSize: 14, color: COLORS.subText, marginTop: -4 },
  historyBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },

  walletCard: { marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 25, elevation: 5 },
  walletContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  walletLabel: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: 'rgba(0,0,0,0.6)', letterSpacing: 1 },
  walletValue: { fontSize: 36, fontFamily: 'Poppins_700Bold', color: '#000', marginTop: 2 },
  walletIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  walletFooter: { marginTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)', paddingTop: 10 },
  walletFooterText: { fontSize: 12, color: '#000', fontFamily: 'Poppins_500Medium' },

  tabsWrapper: { height: 45, marginBottom: 15 },
  tabItem: { paddingHorizontal: 18, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', marginRight: 8, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center' },
  tabItemActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  tabText: { fontSize: 12, color: '#888', fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },
  tabTextActive: { color: '#000' },

  gridContent: { paddingHorizontal: 20, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between' },

  cardContainer: { width: (width - 48) / 2, backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  cardHeader: { height: 90, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  cardImage: { width: '60%', height: '60%' },
  categoryTag: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryTagText: { color: '#FFF', fontSize: 8, fontFamily: 'Poppins_700Bold' },
  cardBody: { padding: 12 },
  cardTitle: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
  cardDesc: { color: '#666', fontSize: 10, fontFamily: 'Poppins_400Regular', marginBottom: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  priceText: { color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_700Bold' },
  percentText: { color: '#555', fontSize: 10, fontFamily: 'Poppins_600SemiBold' },
  progressBarBg: { height: 3, backgroundColor: '#333', borderRadius: 2, marginBottom: 12 },
  progressBarFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },

  // --- DETAIL MODAL STYLES ---
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  detailModalContainer: { height: '85%', backgroundColor: '#141414', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  detailImageArea: { height: 200, justifyContent: 'center', alignItems: 'center', marginTop: 10, borderRadius: 20, marginHorizontal: 20 },
  closeDetailBtn: { position: 'absolute', top: 15, right: 15, width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  detailCategory: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_700Bold', letterSpacing: 1, marginBottom: 5, marginTop: 10 },
  detailTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold', marginBottom: 5 },
  detailPrice: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_500Medium', marginBottom: 20 },
  divider: { height: 1, backgroundColor: '#222', marginBottom: 20 },
  detailSectionTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold', marginBottom: 10, marginTop: 10 },
  detailText: { color: '#BBB', fontSize: 14, lineHeight: 22, fontFamily: 'Poppins_400Regular' },
  detailFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#141414', borderTopWidth: 1, borderTopColor: '#222' },
  redeemFullBtn: { backgroundColor: COLORS.accent, paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
  redeemFullBtnDisabled: { backgroundColor: '#333' },
  redeemFullText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },

  // --- HISTORY MODAL STYLES ---
  historyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: width - 40, backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  hTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  hDate: { color: '#666', fontSize: 12, marginTop: 5 },
  hPlus: { color: COLORS.success, fontSize: 14, fontFamily: 'Poppins_700Bold' },
});