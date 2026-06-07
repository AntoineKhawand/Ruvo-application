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
  View,
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
// logoUrl uses Clearbit Logo API — the industry-standard CDN for brand logos,
// served from a reliable CDN optimised for programmatic access.
// cardGradient + brandInitial + brandName are the primary display;
// the logo loads on top as a bonus when the network delivers it.
const REWARDS = [
  {
    id: '1',
    title: '20% Off Sportswear',
    category: 'Gear',
    price: 2500,
    desc: 'Nike Lebanon',
    longDesc: 'Get 20% off your total purchase at any Nike branch in Lebanon. Valid on all sportswear. Not valid with other promotions.',
    terms: 'Expires in 30 days • One use per customer',
    logoUrl: 'https://logo.clearbit.com/nike.com',
    cardGradient: ['#1A1A1A', '#111111'],
    logoTint: '#FFF',
    brandInitial: 'NIKE',
  },
  {
    id: '2',
    title: '25% Off Sportswear',
    category: 'Gear',
    price: 3000,
    desc: 'Adidas Lebanon',
    longDesc: 'Enjoy 25% off sportswear at any Adidas branch in Lebanon. Perfect to gear up for your next run.',
    terms: 'Valid in-store only • Cannot be combined with sales',
    logoUrl: 'https://logo.clearbit.com/adidas.com',
    cardGradient: ['#F5F5F5', '#E8E8E8'],
    logoTint: '#000',
    brandInitial: 'ADI',
  },
  {
    id: '3',
    title: '15% Off Sportswear',
    category: 'Gear',
    price: 1500,
    desc: 'Decathlon Lebanon',
    longDesc: 'Get 15% off all running gear and sportswear at Decathlon Lebanon.',
    terms: 'Valid in-store only',
    logoUrl: 'https://logo.clearbit.com/decathlon.com',
    cardGradient: ['#006EAF', '#004F82'],
    logoTint: '#FFF',
    brandInitial: 'DEC',
  },
  {
    id: '4',
    title: '25% Off Footwear',
    category: 'Gear',
    price: 3500,
    desc: 'Mike Sport',
    longDesc: 'Upgrade your running shoes! Enjoy a massive 25% off footwear at Mike Sport.',
    terms: 'Valid on running shoes only',
    logoUrl: 'https://logo.clearbit.com/mikesport.com',
    cardGradient: ['#D42029', '#A5151C'],
    logoTint: '#FFF',
    brandInitial: 'MIKE',
  },
  {
    id: '5',
    title: 'Free Race Entry',
    category: 'Events',
    price: 10000,
    desc: 'Beirut Marathon',
    longDesc: 'Redeem your coins for a completely FREE entry into the next Beirut Marathon 5K, 10K, or Full Marathon race!',
    terms: 'Subject to race availability',
    logoUrl: 'https://logo.clearbit.com/beirutmarathon.org',
    cardGradient: ['#B8102A', '#850B1E'],
    logoTint: '#FFF',
    brandInitial: 'BMA',
  },
  {
    id: '6',
    title: '20% Off Sportswear',
    category: 'Gear',
    price: 2000,
    desc: 'CrossFit',
    longDesc: 'Claim a 20% discount on official CrossFit branded sportswear and accessories.',
    terms: 'Valid at participating locations',
    logoUrl: 'https://logo.clearbit.com/crossfit.com',
    cardGradient: ['#1A1A1A', '#0D0D0D'],
    logoTint: '#FFF',
    brandInitial: 'CF',
  },
  {
    id: '7',
    title: '$50 Store Voucher',
    category: 'Gear',
    price: 6000,
    desc: 'Capelli Sport',
    longDesc: 'A flat $50 voucher to spend on any apparel or equipment at Capelli Sport.',
    terms: 'Minimum spend of $100 required',
    logoUrl: 'https://logo.clearbit.com/capellisport.com',
    cardGradient: ['#F0F0F0', '#E0E0E0'],
    logoTint: '#000',
    brandInitial: 'CAP',
  },
];

const CATEGORIES = ['All', 'Gear', 'Events'];

export default function RewardsScreen({ navigation }) {
  const { userData, setUserData } = useUser();
  const { isCompromised } = useContext(SecurityContext);
  const userCoins = userData.coins || 0;

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);

  // Monthly redemption count — derived from recentRuns and current month
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlyRedemptionCount = userData?.redemptionStats?.month === currentMonthKey
    ? (userData.redemptionStats.count || 0)
    : 0;
  const redemptionsLeft = Math.max(0, 3 - monthlyRedemptionCount);
  const [logoErrors, setLogoErrors] = useState({});
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
        <LinearGradient
          colors={item.cardGradient || ['#1A1A1A', '#111']}
          style={styles.cardHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Primary display: styled brand abbreviation — always visible */}
          <Text style={[styles.brandWordmark, { color: item.logoTint || '#FFF', opacity: logoErrors[item.id] ? 1 : 0.18 }]}>
            {item.brandInitial}
          </Text>

          {/* Logo loads on top — hides wordmark when present */}
          {item.logoUrl && !logoErrors[item.id] && (
            <Image
              source={{ uri: item.logoUrl }}
              style={[styles.cardImage, StyleSheet.absoluteFill, { margin: 14 }]}
              resizeMode="contain"
              onError={() => setLogoErrors(prev => ({ ...prev, [item.id]: true }))}
            />
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
        </LinearGradient>

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
              <MaterialCommunityIcons name="coin" size={14} color={isAffordable && !isOutOfStock ? COLORS.accent : '#666'} />
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
  }, [userCoins, inventory, logoErrors]);

  const { animatedRenderItem } = useStaggerAnimation(stableRenderRewardItem);

  const renderCategoryTab = useCallback(({ item }) => {
    const isActive = selectedCategory === item;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.tabItem, isActive && styles.tabItemActive]}
        onPress={() => { lightTap(); setSelectedCategory(item); }}
      >
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{item}</Text>
      </TouchableOpacity>
    );
  }, [selectedCategory]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rewards</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.myRewardsBtn}
            onPress={() => { lightTap(); navigation.navigate('MyRedemptions'); }}
          >
            <Ionicons name="receipt-outline" size={16} color={COLORS.accent} />
            <Text style={styles.myRewardsBtnText}>My Rewards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.historyBtn} onPress={() => { lightTap(); setShowHistory(true); }}>
            <MaterialCommunityIcons name="clock-time-four-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* JAILBREAK / ROOT WARNING */}
      {isCompromised && (
        <View style={styles.compromisedBanner}>
          <Ionicons name="warning-outline" size={18} color="#000" />
          <Text style={styles.compromisedBannerText}>
            Rewards wallet disabled: jailbroken/rooted device detected
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
        <View style={styles.walletFooter}>
          <Text style={styles.walletFooterText}>Keep running to earn more.</Text>
          <View style={styles.capBadge}>
            <MaterialCommunityIcons name="ticket-check-outline" size={12} color="#000" />
            <Text style={styles.capBadgeText}>{redemptionsLeft}/3 redemptions left this month</Text>
          </View>
        </View>
      </LinearGradient>

      {/* TABS */}
      <View style={styles.tabsWrapper}>
        <FlatList
          horizontal data={CATEGORIES} showsHorizontalScrollIndicator={false} keyExtractor={item => item}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={renderCategoryTab}
        />
      </View>

      {/* REWARDS GRID */}
      {isInitialLoad ? (
        <SkeletonCard variant="rewards" />
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

                <LinearGradient
                  colors={selectedReward.cardGradient || ['#1A1A1A', '#111']}
                  style={styles.detailImageArea}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {/* Wordmark fallback — always present, logo loads on top */}
                  <Text style={[styles.detailBrandWordmark, {
                    color: selectedReward.logoTint || '#FFF',
                    opacity: logoErrors[selectedReward.id] ? 1 : 0.18,
                  }]}>
                    {selectedReward.brandInitial}
                  </Text>

                  {selectedReward.logoUrl && !logoErrors[selectedReward.id] && (
                    <Image
                      source={{ uri: selectedReward.logoUrl }}
                      style={[StyleSheet.absoluteFill, { margin: 24 }]}
                      resizeMode="contain"
                      onError={() => setLogoErrors(prev => ({ ...prev, [selectedReward.id]: true }))}
                    />
                  )}

                  <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setSelectedReward(null)}>
                    <Ionicons name="close" size={20} color={selectedReward.logoTint === '#000' ? '#000' : '#FFF'} />
                  </TouchableOpacity>
                </LinearGradient>

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

      {/* --- HISTORY MODAL — real data from run history --- */}
      <Modal visible={showHistory} transparent animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <View style={styles.historyOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowHistory(false)} />
          <View style={styles.historySheet}>
            <View style={styles.historyHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Coin History</Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowHistory(false); }}>
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Summary row */}
            <View style={styles.historySummary}>
              <View style={styles.historySummaryItem}>
                <Text style={styles.historySummaryValue}>{userCoins.toLocaleString()}</Text>
                <Text style={styles.historySummaryLabel}>Current Balance</Text>
              </View>
              <View style={[styles.historySummaryItem, { borderLeftWidth: 1, borderLeftColor: '#2A2A2A' }]}>
                <Text style={styles.historySummaryValue}>{(userData?.runHistory?.length || 0)}</Text>
                <Text style={styles.historySummaryLabel}>Total Runs</Text>
              </View>
              <View style={[styles.historySummaryItem, { borderLeftWidth: 1, borderLeftColor: '#2A2A2A' }]}>
                <Text style={styles.historySummaryValue}>{monthlyRedemptionCount}</Text>
                <Text style={styles.historySummaryLabel}>Redeemed This Month</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {(userData?.runHistory || []).slice(0, 15).map((run, i) => {
                const estimatedCoins = Math.floor((parseFloat(run.distance) || 0) * 10);
                const dateStr = run.date
                  ? new Date(run.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '—';
                return (
                  <View key={run.id || i} style={styles.historyRow}>
                    <View style={styles.historyRowIcon}>
                      <MaterialCommunityIcons name="run-fast" size={16} color={COLORS.accent} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.hTitle} numberOfLines={1}>{run.title || 'Run Workout'}</Text>
                      <Text style={styles.hDate}>{dateStr} · {run.duration || '--'} · {parseFloat(run.distance || 0).toFixed(2)} km</Text>
                    </View>
                    <Text style={styles.hPlus}>+{estimatedCoins}</Text>
                  </View>
                );
              })}
              {(!userData?.runHistory || userData.runHistory.length === 0) && (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <MaterialCommunityIcons name="run-fast" size={36} color="#2A2A2A" />
                  <Text style={{ color: '#555', marginTop: 10, fontFamily: 'Poppins_400Regular', fontSize: 14 }}>
                    Complete your first run to earn coins!
                  </Text>
                </View>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
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

  walletCard: { marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 25, boxShadow: "0 2px 5px rgba(0, 0, 0, 0.3)" },
  walletContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  walletLabel: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: 'rgba(0,0,0,0.6)', letterSpacing: 1 },
  walletValue: { fontSize: 36, fontFamily: 'Poppins_700Bold', color: '#000', marginTop: 2 },
  walletIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  walletFooter: { marginTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  walletFooterText: { fontSize: 12, color: '#000', fontFamily: 'Poppins_500Medium' },
  capBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  capBadgeText: { fontSize: 10, color: '#000', fontFamily: 'Poppins_600SemiBold' },
  myRewardsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(204,255,0,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(204,255,0,0.25)' },
  myRewardsBtnText: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

  tabsWrapper: { height: 45, marginBottom: 15 },
  tabItem: { paddingHorizontal: 18, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', marginRight: 8, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center' },
  tabItemActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  tabText: { fontSize: 12, color: '#888', fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },
  tabTextActive: { color: '#000' },

  gridContent: { paddingHorizontal: 20, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between' },

  cardContainer: { width: (width - 48) / 2, backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  cardHeader: { height: 100, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  // The logo from Clearbit loads as absoluteFill inside cardHeader, so no cardImage size needed
  cardImage: { width: '100%', height: '100%' },
  brandWordmark: {
    fontSize: 22,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
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
  detailImageArea: { height: 220, justifyContent: 'center', alignItems: 'center', marginTop: 10, borderRadius: 20, marginHorizontal: 20, overflow: 'hidden' },
  detailBrandWordmark: { fontSize: 36, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 3, textTransform: 'uppercase' },
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
  historyOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  historySheet: { backgroundColor: '#0E0E0E', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '75%', borderTopWidth: 1, borderColor: '#1E1E1E' },
  historyHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
  historySummary: { flexDirection: 'row', backgroundColor: '#141414', borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: '#1E1E1E' },
  historySummaryItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  historySummaryValue: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
  historySummaryLabel: { color: '#555', fontSize: 9, fontFamily: 'Poppins_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#141414' },
  historyRowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(204,255,0,0.08)', justifyContent: 'center', alignItems: 'center' },
  hTitle: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  hDate: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 2 },
  hPlus: { color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_700Bold' },
});