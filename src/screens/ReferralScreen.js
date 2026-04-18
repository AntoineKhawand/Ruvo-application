import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Alert, Share, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { processReferralReward, validateReferralCode } from '../services/referralService';

const COLORS = {
  primary: "#000000",
  secondary: "#1C1C1E",
  accent: "#CCFF00",
  danger: "#FF3B30",
  text: "#FFFFFF",
  subText: "#888888",
  border: "#333333"
};

export default function ReferralScreen({ navigation }) {
  const { theme } = useTheme();
  const { userData, updateCoins } = useUser();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const referralCode = userData?.referralCode || 'GENERATING...';
  const totalInvites = userData?.referralStats?.totalInvites || 0;
  const coinsEarned = userData?.referralStats?.coinsEarned || 0;

  const copyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(referralCode);
      setCopied(true);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      Alert.alert('Error', 'Could not copy to clipboard.');
    }
  };

  const handleRedeemCode = async () => {
    const code = redeemCode.trim().toUpperCase();
    if (!code) return;
    if (code === referralCode) {
      Alert.alert('Invalid', "You can't redeem your own referral code.");
      return;
    }
    setRedeeming(true);
    try {
      const referrer = await validateReferralCode(code);
      if (!referrer) {
        Alert.alert('Invalid Code', 'This referral code does not exist. Check it and try again.');
        return;
      }
      await processReferralReward(referrer.uid, userData.uid, code);
      await updateCoins(100, 'referral_bonus');
      setRedeemCode('');
      Alert.alert('🎉 Bonus Applied!', 'You received 100 free coins! Enjoy Ruvo.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not apply the referral code. It may already have been used.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Join me on Ruvo and get fit! Use my code ${referralCode} to get 100 free coins. Download here: https://ruvo.app`,
      });
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error) {
      Alert.alert(error.message);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* HEADER */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Invite Friends</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>

          {/* HERO SECTION */}
          <View style={styles.heroSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="gift-outline" size={40} color="#000" />
            </View>
            <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Refer & Earn</Text>
            <Text style={styles.heroSubtitle}>
              Invite your friends to Ruvo and earn 100 coins for every successful signup!
            </Text>
          </View>

          {/* CODE CARD */}
          <View style={[styles.codeCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.codeLabel, { color: theme.colors.subText }]}>YOUR REFERRAL CODE</Text>
            <View style={styles.codeRow}>
              <Text style={[styles.codeText, { color: COLORS.accent }]}>{referralCode}</Text>
              <TouchableOpacity onPress={copyToClipboard} style={styles.copyButton}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* SHARE BUTTON */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>Share Code</Text>
            <Ionicons name="share-social-outline" size={20} color="#000" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* STATS ROW */}
          <View style={styles.statsContainer}>
            <View style={[styles.statBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{totalInvites}</Text>
              <Text style={styles.statLabel}>Friends Invited</Text>
            </View>
            <View style={{ width: 15 }} />
            <View style={[styles.statBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.statValue, { color: COLORS.accent }]}>{coinsEarned}</Text>
              <Text style={styles.statLabel}>Coins Earned</Text>
            </View>
          </View>

          {/* REDEEM A CODE */}
          <View style={[styles.codeCard, { backgroundColor: theme.colors.card, marginTop: 20 }]}>
            <Text style={[styles.codeLabel, { color: theme.colors.subText }]}>HAVE A REFERRAL CODE?</Text>
            <View style={styles.redeemRow}>
              <TextInput
                style={[styles.redeemInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Enter code"
                placeholderTextColor="#555"
                autoCapitalize="characters"
                autoCorrect={false}
                value={redeemCode}
                onChangeText={setRedeemCode}
              />
              <TouchableOpacity
                style={[styles.redeemBtn, (!redeemCode.trim() || redeeming) && { opacity: 0.5 }]}
                onPress={handleRedeemCode}
                disabled={redeeming || !redeemCode.trim()}
              >
                {redeeming
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={styles.redeemBtnText}>Apply</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold' },
  backButton: { padding: 5 },

  content: { flex: 1, padding: 20, alignItems: 'center' },

  heroSection: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  heroTitle: { fontSize: 24, fontFamily: 'Poppins_700Bold', marginBottom: 10 },
  heroSubtitle: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: '#888', textAlign: 'center', paddingHorizontal: 20, lineHeight: 22 },

  codeCard: { width: '100%', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  codeLabel: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1.5, marginBottom: 10 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  codeText: { fontSize: 28, fontFamily: 'Poppins_700Bold', marginRight: 15, letterSpacing: 2 },
  copyButton: { padding: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 },

  shareButton: { backgroundColor: COLORS.accent, width: '100%', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  shareButtonText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#000' },

  statsContainer: { flexDirection: 'row', width: '100%' },
  statBox: { flex: 1, padding: 15, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontFamily: 'Poppins_700Bold', marginBottom: 5 },
  statLabel: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: '#888' },

  redeemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, width: '100%' },
  redeemInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1.5 },
  redeemBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', minWidth: 72 },
  redeemBtnText: { color: '#000', fontSize: 14, fontFamily: 'Poppins_700Bold' },
});