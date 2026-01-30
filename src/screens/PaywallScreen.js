import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
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
  priceStrike: "#555555" 
};

const PRO_FEATURES = [
  { 
    title: "Unlock Future Plans", 
    desc: "See your complete AI training schedule for the next 4 weeks." 
  },
  { 
    title: "Advanced Analytics", 
    desc: "Deep insights into VO2 Max, Heart Rate Zones, and Recovery trends." 
  },
  { 
    title: "Performance Forecast", 
    desc: "AI-driven race day predictions based on your training data." 
  },
  { 
    title: "Unlimited History", 
    desc: "Access your entire lifetime of workout stats and progress charts." 
  }
];

export default function PaywallScreen({ navigation }) {
  const { updateUserProfile } = useUser();
  const [selectedPlan, setSelectedPlan] = useState('annual'); // 'annual' is default
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = () => {
    setIsLoading(true);
    // Simulate network request
    setTimeout(() => {
      setIsLoading(false);
      updateUserProfile({ isPro: true });
      Alert.alert(
        "Welcome to Pro!", 
        `You have subscribed to the ${selectedPlan} plan. Your 7-day free trial starts now!`, 
        [{ text: "Let's Run", onPress: () => navigation.goBack() }]
      );
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <Text style={styles.title}>Unlock Your</Text>
            <Text style={styles.titleAccent}>Full Potential</Text>
            <Text style={styles.subtitle}>Your Elite Training Toolkit Awaits</Text>
          </View>

          <View style={styles.featuresContainer}>
            {PRO_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="checkmark" size={16} color="#000" />
                </View>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDesc}>{feature.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* --- PRICING CARDS --- */}
          <View style={styles.pricingContainer}>
            
            {/* MONTHLY PLAN */}
            <TouchableOpacity 
              style={[
                styles.planCard, 
                selectedPlan === 'monthly' && styles.selectedCard // Apply active style if selected
              ]}
              onPress={() => setSelectedPlan('monthly')}
              activeOpacity={0.9}
            >
              {/* Radio Circle */}
              <View style={styles.radioOuter}>
                {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
              </View>

              <View style={{flex: 1}}>
                <Text style={styles.planTitle}>Monthly Plan</Text>
                <Text style={styles.planSub}>Billed monthly, cancel anytime</Text>
              </View>
              <View style={styles.priceWrapper}>
                <Text style={styles.priceBig}>$4.99</Text>
                <Text style={styles.pricePeriod}>/mo</Text>
              </View>
            </TouchableOpacity>

            {/* ANNUAL PLAN */}
            <TouchableOpacity 
              style={[
                styles.planCard, 
                styles.annualCardLayout, // Extra margin for badge
                selectedPlan === 'annual' && styles.selectedCard // Apply active style if selected
              ]}
              onPress={() => setSelectedPlan('annual')}
              activeOpacity={0.9}
            >
              {/* BEST VALUE BADGE */}
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>BEST VALUE - SAVE 40%</Text>
              </View>

              {/* Radio Circle */}
              <View style={styles.radioOuter}>
                {selectedPlan === 'annual' && <View style={styles.radioInner} />}
              </View>

              <View style={{flex: 1}}>
                <Text style={styles.planTitle}>Annual Plan</Text>
                <Text style={styles.planSub}>Just $3.00/month</Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.strikePrice}>$59.88</Text>
                <View style={styles.priceWrapper}>
                  <Text style={[styles.priceBig, {color: COLORS.accent}]}>$35.99</Text>
                  <Text style={styles.pricePeriod}>/yr</Text>
                </View>
              </View>
            </TouchableOpacity>

          </View>

          {/* BUTTON */}
          <TouchableOpacity 
            style={styles.trialButton} 
            onPress={handlePurchase}
            disabled={isLoading}
          >
            <Text style={styles.trialButtonText}>
              {isLoading ? "PROCESSING..." : `Start ${selectedPlan === 'annual' ? 'Annual' : 'Monthly'} Free Trial`}
            </Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Cancel anytime. Your subscription will auto-renew after the 7-day trial. No commitment required.
          </Text>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 30 },
  
  closeButton: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginRight: 10
  },

  header: { alignItems: 'center', marginTop: 10, marginBottom: 30 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  titleAccent: { color: COLORS.accent, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: COLORS.subText, fontSize: 16, marginTop: 10, textAlign: 'center' },

  featuresContainer: { marginBottom: 10 },
  featureRow: { flexDirection: 'row', marginBottom: 20 },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    marginRight: 16
  },
  featureTextContainer: { flex: 1 },
  featureTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  featureDesc: { color: COLORS.subText, fontSize: 14, lineHeight: 20 },

  pricingContainer: { marginBottom: 25 },
  
  // CARD STYLES
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333', // Default border invisible/dark
  },
  annualCardLayout: {
    marginTop: 15, // Space for the badge
  },
  selectedCard: {
    borderColor: COLORS.accent, // Green border when selected
    borderWidth: 2,
    backgroundColor: '#252525' // Slightly lighter bg
  },

  // RADIO BUTTON
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent
  },

  planTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  planSub: { color: COLORS.subText, fontSize: 13 },
  priceWrapper: { flexDirection: 'row', alignItems: 'baseline' },
  priceBig: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  pricePeriod: { color: COLORS.subText, fontSize: 14, marginLeft: 2 },
  strikePrice: { color: COLORS.priceStrike, fontSize: 14, textDecorationLine: 'line-through', marginBottom: 2 },

  badgeContainer: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 10
  },
  badgeText: { color: '#000', fontSize: 11, fontWeight: '800' },

  trialButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 30,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  trialButtonText: { color: '#000', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  disclaimer: { color: COLORS.subText, fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 }
});