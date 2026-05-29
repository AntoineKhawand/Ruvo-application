import { Ionicons } from '@expo/vector-icons';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SecurityContext } from '../context/SecurityContext';
import { useUser } from '../context/UserContext';
import { getOfferings, restorePurchases } from '../services/revenueCat';
import { lightTap } from '../utils/haptics';

const THEME = {
  bg: '#000000',
  card: '#1C1C1E',
  accent: '#CCFF00', // Neon Green
  text: '#FFFFFF',
  textDim: '#888888',
  success: '#CCFF00',
};

const FEATURES = [
  { title: "2x Coin Multiplier", desc: "Earn double coins on every run to unlock gear faster" },
  { title: "Unlimited AI Coaching", desc: "Get personalized training advice & adaptive plans" },
  { title: "Advanced Performance Analytics", desc: "Deep insights into your pace, heart rate, and progress" },
  { title: "Pro Training Plans", desc: "Unlock adaptive 5K, 10K & Half Marathon schedules" },
];

export default function PaywallScreen({ navigation }) {
  const { restorePro, upgradeToPro } = useUser(); // Added upgradeToPro
  const { isCompromised } = useContext(SecurityContext);

  const [offerings, setOfferings] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null); // 'annual' | 'monthly'
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // FETCH REVENUECAT OFFERINGS
  useEffect(() => {
    const loadOfferings = async () => {
      try {
        console.log("[Paywall] Loading offerings...");
        let currentOfferings = await getOfferings();
        console.log("[Paywall] Offerings result:", currentOfferings);

        // Fallback mock when RevenueCat returns nothing (local builds, Play Store not live yet)
        if (!currentOfferings || !currentOfferings.availablePackages?.length) {
          console.log("[Paywall] No offerings from RevenueCat — using fallback display prices");
          currentOfferings = {
            availablePackages: [
              {
                identifier: 'monthly_test',
                packageType: 'MONTHLY',
                product: {
                  productId: 'ruvo_pro_monthly',
                  price: 4.99,
                  priceString: '$4.99',
                  currency: 'USD'
                }
              },
              {
                identifier: 'annual_test', 
                packageType: 'ANNUAL',
                product: {
                  productId: 'ruvo_pro_annual',
                  price: 39.99,
                  priceString: '$39.99',
                  currency: 'USD'
                }
              }
            ]
          };
        }

        if (currentOfferings?.availablePackages?.length > 0) {
          setOfferings(currentOfferings);

          // Default to Annual if available
          const annual = currentOfferings.availablePackages.find(p => p.packageType === 'ANNUAL');
          setSelectedPackage(annual || currentOfferings.availablePackages[0]);
        } else {
          console.warn("[Paywall] No offerings found. Check RevenueCat dashboard for configured packages.");
        }
      } catch (e) {
        console.warn("[Paywall] Fetch Error:", e);
        Alert.alert("Connection Error", "Could not load subscription packages.");
      } finally {
        setIsLoading(false);
      }
    };
    loadOfferings();
  }, []);

  const handlePurchase = async () => {
    if (isCompromised) {
      return Alert.alert("Security Restriction", "In-app purchases are disabled on compromised or rooted devices to protect your financial safety.");
    }

    if (!selectedPackage) return;
    setIsPurchasing(true);

    try {
      const success = await upgradeToPro(selectedPackage);
      if (success) {
        Alert.alert("Success", "Welcome to Ruvo Pro!");
        navigation.goBack();
      }
      // success is false — purchasePackage already handled the alert
      // (user cancelled, already subscribed, or no native module)
    } catch (error) {
      console.error("Purchase Failed:", error);
      const message = error?.userInfo?.readableErrorCode || error?.message || error?.code || "";
      if (message.includes("Cannot find package") || message.includes("product") || message.includes("Invalid") || message.includes("mock")) {
        Alert.alert(
          "Subscriptions Not Configured",
          "No real subscription products are linked to this app yet. This requires:\n\n" +
          "1. Products created in Google Play Console / App Store Connect\n" +
          "2. Products added in RevenueCat Dashboard\n" +
          "3. An offering set as 'Current' in RevenueCat\n\n" +
          "Until then, purchases will not go through."
        );
      } else {
        Alert.alert("Purchase Failed", message || "Could not connect to the App Store/Play Store. Please try again.");
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    const success = await restorePurchases();
    if (success) {
      await restorePro();
      Alert.alert("Restored", "Your Pro subscription is active.");
      navigation.goBack();
    } else {
      Alert.alert("No Subscription", "We couldn't find an active subscription to restore.");
    }
    setIsPurchasing(false);
  };

  const openLink = (url) => Linking.openURL(url).catch(err => console.error("Couldn't load page", err));

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  // No offerings: show a clear message instead of a silently-disabled button
  if (!offerings || !offerings.availablePackages || offerings.availablePackages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="cloud-offline-outline" size={56} color="#444" />
          <Text style={{ color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold', marginTop: 20, textAlign: 'center' }}>Subscriptions Unavailable</Text>
          <Text style={{ color: '#888', fontSize: 14, fontFamily: 'Poppins_400Regular', marginTop: 12, textAlign: 'center', lineHeight: 22 }}>
            Could not load subscription packages. Please check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 30, backgroundColor: THEME.accent, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30 }}
            onPress={() => { 
              lightTap(); 
              // Reload by triggering the useEffect
              const { loadOfferings } = require('../services/revenueCat');
              setIsLoading(true);
              getOfferings().then(o => {
                setOfferings(o);
                setIsLoading(false);
              }).catch(() => setIsLoading(false));
            }}
          >
            <Text style={{ color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Helper to get packages safely
  const annualPkg = offerings?.availablePackages.find(p => p.packageType === 'ANNUAL');
  const monthlyPkg = offerings?.availablePackages.find(p => p.packageType === 'MONTHLY');

  // Logic to determine savings text (approximate if packages exist)
  let savingsText = "SAVE 40%";
  if (annualPkg && monthlyPkg) {
    const annualPrice = annualPkg.product.price;
    const monthlyPrice = monthlyPkg.product.price;
    const yearlyMonthlyCost = monthlyPrice * 12;
    if (yearlyMonthlyCost > 0) {
      const savings = Math.round(((yearlyMonthlyCost - annualPrice) / yearlyMonthlyCost) * 100);
      savingsText = `SAVE ${savings}%`;
    }
  }

  // Display price strings
  const annualPriceStr = annualPkg?.product?.priceString || "$35.99";
  const monthlyPriceStr = monthlyPkg?.product?.priceString || "$4.99";

  // Calculate "per month" visual for annual
  const annualPerMonth = annualPkg ? (annualPkg.product.price / 12).toFixed(2) : "3.00";
  const currencySymbol = annualPkg?.product?.currencyCode || "$";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* TITLE SECTION */}
        <View style={styles.titleSection}>
          <Text style={styles.titleStart}>Unlock Your</Text>
          <Text style={styles.titleHighlight}>Full Potential</Text>
          <Text style={styles.subtitle}>Your Elite Training Toolkit Awaits</Text>
        </View>

        {/* FEATURES LIST */}
        <View style={styles.featureList}>
          {FEATURES.map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={14} color="#000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featTitle}>{feature.title}</Text>
                <Text style={styles.featDesc}>{feature.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* PRICING OPTIONS */}
        <View style={styles.pricingContainer}>

          {/* MONTHLY OPTION */}
          {monthlyPkg && (
            <TouchableOpacity
              style={[styles.pricingCard, selectedPackage?.identifier === monthlyPkg.identifier && styles.selectedCard]}
              onPress={() => setSelectedPackage(monthlyPkg)}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.planName}>Monthly Plan</Text>
                <Text style={styles.planSub}>Billed monthly, cancel anytime</Text>
              </View>
              <View>
                <Text style={styles.priceMain}>{monthlyPriceStr}<Text style={styles.period}>/mo</Text></Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ANNUAL OPTION */}
          {annualPkg && (
            <TouchableOpacity
              style={[styles.pricingCard, styles.annualCard, selectedPackage?.identifier === annualPkg.identifier && styles.selectedCardAnnual]}
              onPress={() => setSelectedPackage(annualPkg)}
              activeOpacity={0.8}
            >
              <View style={styles.bestValueTag}>
                <Text style={styles.bestValueText}>BEST VALUE - {savingsText}</Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 10 }}>
                <View>
                  <Text style={styles.planName}>Annual Plan</Text>
                  <Text style={styles.planSub}>Just {currencySymbol}{annualPerMonth}/month, billed annually</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.priceMain, { color: THEME.accent }]}>{annualPriceStr}<Text style={[styles.period, { color: '#FFF' }]}>/yr</Text></Text>
                  <Text style={styles.oldPrice}>{monthlyPkg ? `${currencySymbol}${(monthlyPkg.product.price * 12).toFixed(2)}` : ""}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

        </View>

        {/* CTA BUTTON */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.ctaButton}
          onPress={() => { lightTap(); handlePurchase(); }}
          disabled={isPurchasing || !selectedPackage}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.ctaText}>
              {selectedPackage?.product?.introPrice ? "Start Your 7-Day Free Trial" : "Subscribe Now"}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Cancel anytime. Your subscription will auto-renew. No commitment required.
        </Text>

        <View style={styles.footerLinks}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); handleRestore(); }}><Text style={styles.linkText}>Restore Purchase</Text></TouchableOpacity>
          <Text style={styles.linkDivider}>•</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); openLink('https://ruvo.run/terms'); }}><Text style={styles.linkText}>Terms</Text></TouchableOpacity>
          <Text style={styles.linkDivider}>•</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); openLink('https://ruvo.run/privacy'); }}><Text style={styles.linkText}>Privacy</Text></TouchableOpacity>
        </View>

      </ScrollView >
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'flex-end',
  },
  closeBtn: {
    padding: 5,
    backgroundColor: '#333',
    borderRadius: 20,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },

  // Title
  titleSection: {
    marginTop: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  titleStart: {
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    color: '#FFF',
    lineHeight: 34,
  },
  titleHighlight: {
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    color: THEME.accent,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    color: '#AAA',
    marginTop: 8,
    fontFamily: 'Poppins_400Regular',
  },

  // Features
  featureList: {
    marginBottom: 30,
    gap: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featTitle: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 2,
  },
  featDesc: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins_400Regular',
  },

  // Pricing
  pricingContainer: {
    gap: 15,
    marginBottom: 30,
  },
  pricingCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#333',
  },
  annualCard: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingTop: 25, // Make room for badge
    marginTop: 10, // Spacing for badge overlap
    borderColor: THEME.accent, // Highlighting best value
  },
  selectedCard: {
    borderColor: '#FFF',
    backgroundColor: '#2C2C2E',
  },
  selectedCardAnnual: {
    borderColor: THEME.accent,
    backgroundColor: 'rgba(204, 255, 0, 0.05)', // Subtle green tint
  },

  bestValueTag: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: THEME.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    color: '#000',
    fontSize: 10,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.5,
  },

  planName: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  planSub: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  priceMain: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  period: {
    fontSize: 13,
    fontWeight: '400',
    color: '#888',
  },
  oldPrice: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },

  // CTA
  ctaButton: {
    backgroundColor: THEME.accent,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 15,
    boxShadow: "0 4px 10px rgba(204, 255, 0, 0.3)",
  },
  ctaText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  disclaimer: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },

  // Links
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  linkText: {
    color: '#AAA',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  linkDivider: {
    color: '#444',
  },
});