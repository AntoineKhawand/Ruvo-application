import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useContext, useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingNavBar from '../components/FloatingNavBar';
import { db, functions } from '../config/firebase';
import { SecurityContext } from '../context/SecurityContext';
import { useUser } from '../context/UserContext';
import useStaggerAnimation from '../hooks/useStaggerAnimation';
import SkeletonCard from '../components/SkeletonCard';
import { lightTap } from '../utils/haptics';

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
    id: '1', title: '20% Off Sportswear', category: 'Gear', price: 2500,
    desc: 'Nike Lebanon',
    longDesc: 'Get 20% off your total purchase at any Nike branch in Lebanon. Valid on all sportswear. Not valid with other promotions.',
    terms: 'Expires in 30 days • One use per customer',
    image: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://nike.com&size=128',
    bgColor: '#FFF'
  },
  {
    id: '2', title: '25% Off Sportswear', category: 'Gear', price: 3000,
    desc: 'Adidas Lebanon',
    longDesc: 'Enjoy 25% off sportswear at any Adidas branch in Lebanon. Perfect to gear up for your next run.',
    terms: 'Valid in-store only • Cannot be combined with sales',
    image: 'https://static.vecteezy.com/system/resources/previews/014/414/689/large_2x/adidas-new-logo-on-transparent-background-free-vector.jpg',
    bgColor: '#FFF'
  },
  {
    id: '3', title: '15% Off Sportswear', category: 'Gear', price: 1500,
    desc: 'Decathlon Lebanon',
    longDesc: 'Get 15% off all running gear and sportswear at Decathlon Lebanon.',
    terms: 'Valid in-store only',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Decathlon_Logo.svg/1024px-Decathlon_Logo.svg.png',
    bgColor: '#0082C3'
  },
  {
    id: '4', title: '25% Off Footwear', category: 'Gear', price: 3500,
    desc: 'Mike Sport',
    longDesc: 'Upgrade your running shoes! Enjoy a massive 25% off footwear at Mike Sport.',
    terms: 'Valid on running shoes only',
    image: 'https://mikesport.com/cdn/shop/files/MIKESPORT_LOGO-01-01_1_250x.png',
    bgColor: '#FFF'
  },
  {
    id: '5', title: 'Free Race Entry', category: 'Gym', price: 10000,
    desc: 'Beirut Marathon',
    longDesc: 'Redeem your coins for a completely FREE entry into the next Beirut Marathon 5K, 10K, or Full Marathon race!',
    terms: 'Subject to race availability',
    image: 'https://beirutmarathon.org/images/logo.png',
    bgColor: '#FFF'
  },
  {
    id: '6', title: '20% Off Sportswear', category: 'Gear', price: 2000,
    desc: 'CrossFit',
    longDesc: 'Claim a 20% discount on official CrossFit branded sportswear and accessories.',
    terms: 'Valid at participating locations',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/CrossFit_Logo.svg/1200px-CrossFit_Logo.svg.png',
    bgColor: '#FFF'
  },
  {
    id: '7', title: '$50 Store Voucher', category: 'Gear', price: 6000,
    desc: 'Capelli Sport',
    longDesc: 'A flat $50 voucher to spend on any apparel or equipment at Capelli Sport.',
    terms: 'Minimum spend of $100 required',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Capelli_Sport_Logo.svg/1200px-Capelli_Sport_Logo.svg.png',
    bgColor: '#FFF'
  }
];

const CATEGORIES = ['All', 'Gear', 'Gym', 'Supplements', 'Nutrition'];

export default function RewardsScreen({ navigation }) {
  const { userData, setUserData } = useUser();
  const { isCompromised } = useContext(SecurityContext);
  const userCoins = userData.coins || 0;

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // stockCount per rewardId — null means no inventory doc yet (treat as unlimited)
  const [inventory, setInventory] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Real-time inventory listener — one listener per reward document
  useEffect(() => {
    const unsubs = REWARDS.map(reward =>
      onSnapshot(
        doc(db, 'rewards', reward.id),
        snap => {
          if (snap.exists() && snap.data().stockCount !== undefined) {
            setInventory(prev => ({ ...prev, [reward.id]: snap.data().stockCount }));
          }
        },
        err => console.warn('[Rewards] inventory listener error:', err)
      )
    );
    return () => unsubs.forEach(u => u());
  }, []);

  const filteredRewards = selectedCategory === 'All'
    ? REWARDS
    : REWARDS.filter(r => r.category === selectedCategory);

  const handleCardPress = (item) => {
    setSelectedReward(item);
  };

  const confirmRedemption = async () => {
    if (!selectedReward) return;

    if (isCompromised) {
      Alert.alert(
        "Wallet Disabled",
        "The rewards wallet is disabled on jailbroken or rooted devices to protect the integrity of the rewards system."
      );
      return;
    }

    const stockCount = inventory[selectedReward.id];
    if (stockCount !== undefined && stockCount !== null && stockCount <= 0) {
      Alert.alert(
        "Temporarily Unavailable",
        "This reward is currently out of stock. Check back tomorrow — we regularly replenish codes!"
      );
      return;
    }

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
          Alert.alert(
            "Reward Redeemed! 🎉",
            `Your code for ${selectedReward.title} has been sent to your email. Open it to find your QR code and instructions.`
          );
        }, 500);
      }
    } catch (error) {
      console.error("Redemption error:", error);
      Alert.alert("Redemption Failed", error.message || "An error occurred while processing your reward.");
    } finally {
      setIsRedeeming(false);
    }
  };

  const stableRenderRewardItem = useCallback(({ item }) => {
    const isAffordable = userCoins >= item.price;
    const progress = userCoins > 0 ? Math.min(1, userCoins / item.price) : 0;
    const progressPercent = Math.floor(progress * 100);
    const stockCount = inventory[item.id];
    const isOutOfStock = stockCount !== null && stockCount !== undefined && stockCount <= 0;

    return (
      <TouchableOpacity
        style={[styles.cardContainer, isOutOfStock && { opacity: 0.5 }]}
        onPress={() => !isOutOfStock && handleCardPress(item)}
        activeOpacity={isOutOfStock ? 1 : 0.7}
      >
        <View style={[styles.cardHeader, { backgroundColor: item.bgColor }]}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="contain" />
          ) : (
            <MaterialCommunityIcons name={item.icon || 'gift'} size={42} color={item.bgColor === '#FFF' ? '#000' : COLORS.accent} />
          )}
          {isOutOfStock ? (
            <View style={[styles.categoryTag, { backgroundColor: COLORS.danger }]}>
              <Text style={styles.categoryTagText}>OUT OF STOCK</Text>
            </View>
          ) : (
            <View style={styles.categoryTag}>
              <Text style={styles.categoryTagText}>{item.category.toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardDesc} numberOfLines={1}>{item.desc}</Text>

          {/* Codes availability row */}
          {stockCount !== undefined && stockCount !== null && (
            <View style={styles.stockRow}>
              <MaterialCommunityIcons
                name="ticket-percent-outline"
                size={11}
                color={isOutOfStock ? COLORS.danger : stockCount <= 10 ? '#FF9500' : '#4CD964'}
              />
              <Text style={[
                styles.stockText,
                isOutOfStock && { color: COLORS.danger },
                !isOutOfStock && stockCount <= 10 && { color: '#FF9500' },
                !isOutOfStock && stockCount > 10 && { color: '#4CD964' },
              ]}>
                {isOutOfStock ? 'No codes left' : `${stockCount} code${stockCount === 1 ? '' : 's'} left`}
              </Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="bitcoin" size={14} color={isAffordable && !isOutOfStock ? COLORS.accent : '#666'} />
              <Text style={[styles.priceText, (!isAffordable || isOutOfStock) && { color: '#666' }]}> {item.price}</Text>
            </View>
            {!isAffordable && !isOutOfStock && <Text style={styles.percentText}>{progressPercent}%</Text>}
          </View>

          {!isAffordable && !isOutOfStock && (
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [userCoins, inventory]);

  const { animatedRenderItem } = useStaggerAnimation(stableRenderRewardItem);

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

      {/* JAILBREAK / ROOT WARNING */}
      {isCompromised && (
        <View style={styles.compromisedBanner}>
          <Ionicons name="warning-outline" size={18} color="#000" />
          <Text style={styles.compromisedBannerText}>
            Rewards wallet disabled — jailbroken/rooted device detected
          </Text>
        </View>
      )}

      {/* WALLET */}
      <LinearGradient colors={['#CCFF00', '#AACC00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.walletCard, isCompromised && { opacity: 0.4 }]}>
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
              <TouchableOpacity activeOpacity={0.7} style={[styles.tabItem, isActive && styles.tabItemActive]} onPress={() => { lightTap(); setSelectedCategory(item); }}>
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* REWARDS GRID */}
      {isInitialLoad ? (
        <View style={styles.gridContent}>
          <SkeletonCard variant="card" count={6} />
        </View>
      ) : (
        <Animated.FlatList
          data={filteredRewards} keyExtractor={item => item.id} renderItem={animatedRenderItem}
          numColumns={2} contentContainerStyle={styles.gridContent} columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                setTimeout(() => setIsRefreshing(false), 1000);
              }}
              tintColor="#CCFF00"
              colors={['#CCFF00']}
              progressBackgroundColor="#1C1C1E"
            />
          }
        />
      )}

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

                  {/* Price + availability row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <Text style={styles.detailPrice}>{selectedReward.price.toLocaleString()} Coins</Text>
                    {(() => {
                      const sc = inventory[selectedReward.id];
                      if (sc === undefined || sc === null) return null;
                      const oos = sc <= 0;
                      const low = sc > 0 && sc <= 10;
                      return (
                        <View style={[styles.detailStockBadge, oos && { backgroundColor: 'rgba(255,69,58,0.15)', borderColor: COLORS.danger }, low && { backgroundColor: 'rgba(255,149,0,0.15)', borderColor: '#FF9500' }, !oos && !low && { backgroundColor: 'rgba(76,217,100,0.15)', borderColor: '#4CD964' }]}>
                          <MaterialCommunityIcons
                            name="ticket-percent-outline"
                            size={13}
                            color={oos ? COLORS.danger : low ? '#FF9500' : '#4CD964'}
                            style={{ marginRight: 5 }}
                          />
                          <Text style={[styles.detailStockText, { color: oos ? COLORS.danger : low ? '#FF9500' : '#4CD964' }]}>
                            {oos ? 'Out of stock' : `${sc} code${sc === 1 ? '' : 's'} available`}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.detailSectionTitle}>Description</Text>
                  <Text style={styles.detailText}>{selectedReward.longDesc || selectedReward.desc}</Text>

                  <Text style={styles.detailSectionTitle}>Terms & Conditions</Text>
                  <Text style={styles.detailText}>{selectedReward.terms || 'Standard terms apply.'}</Text>

                  <View style={{ height: 100 }} />
                </ScrollView>

                <View style={styles.detailFooter}>
                  {(() => {
                    const stockCount = inventory[selectedReward.id];
                    const isOutOfStock = stockCount !== null && stockCount !== undefined && stockCount <= 0;
                    const canAfford = userCoins >= selectedReward.price;
                    const isDisabled = !canAfford || isRedeeming || isOutOfStock;
                    const label = isRedeeming ? "Processing..."
                      : isOutOfStock ? "Out of Stock"
                      : canAfford ? "Confirm Redemption"
                      : "Insufficient Coins";
                    return (
                      <TouchableOpacity
                        style={[styles.redeemFullBtn, isDisabled && styles.redeemFullBtnDisabled]}
                        onPress={confirmRedemption}
                        disabled={isDisabled}
                      >
                        <Text style={styles.redeemFullText}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })()}
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
  compromisedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF9500', marginHorizontal: 20, marginBottom: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  compromisedBannerText: { flex: 1, color: '#000', fontFamily: 'Poppins_600SemiBold', fontSize: 12, lineHeight: 16 },
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
  stockRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stockText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', marginLeft: 4 },

  // --- DETAIL MODAL STYLES ---
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  detailModalContainer: { height: '85%', backgroundColor: '#141414', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  detailImageArea: { height: 200, justifyContent: 'center', alignItems: 'center', marginTop: 10, borderRadius: 20, marginHorizontal: 20 },
  closeDetailBtn: { position: 'absolute', top: 15, right: 15, width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  detailCategory: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_700Bold', letterSpacing: 1, marginBottom: 5, marginTop: 10 },
  detailTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold', marginBottom: 5 },
  detailPrice: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_500Medium' },
  detailStockBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  detailStockText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
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