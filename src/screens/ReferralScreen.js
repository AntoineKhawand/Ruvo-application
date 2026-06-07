import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { processReferralReward, validateReferralCode } from '../services/referralService';

const ACCENT = '#CCFF00';

const STEPS = [
  {
    icon: 'share-social-outline',
    title: 'Share your code',
    desc: 'Send your unique code to friends via any app',
  },
  {
    icon: 'person-add-outline',
    title: 'Friend joins Ruvo',
    desc: 'They sign up and enter your referral code',
  },
  {
    icon: 'flash-outline',
    title: 'Both earn 100 coins',
    desc: 'Reward lands instantly in both accounts',
  },
];

export default function ReferralScreen({ navigation }) {
  const { theme } = useTheme();
  const { userData, updateCoins } = useUser();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
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
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
      copyTimerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
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
      await Share.share({
        message: `Join me on Ruvo and get fit! 🏃‍♂️\nUse my code ${referralCode} to get 100 free coins.\nDownload: https://ruvo.app`,
      });
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Refer & Earn</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >

          {/* ── HERO ── */}
          <View style={styles.heroSection}>
            <View style={styles.iconGlowOuter}>
              <Animated.View style={[styles.iconGlowRing, { opacity: glowAnim }]} />
              <View style={styles.iconCircle}>
                <Ionicons name="gift" size={36} color="#000" />
              </View>
            </View>
            <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Invite Friends,{'\n'}Earn Together</Text>
            <Text style={styles.heroSubtitle}>
              Share your code — when a friend joins Ruvo,{'\n'}
              <Text style={styles.heroHighlight}>both of you earn 100 coins</Text> instantly.
            </Text>
          </View>

          {/* ── STATS ── */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
              <View style={styles.statIconWrap}>
                <Ionicons name="people" size={16} color={ACCENT} />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{totalInvites}</Text>
              <Text style={styles.statLabel}>Friends Invited</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
              <View style={styles.statIconWrap}>
                <Ionicons name="flash" size={16} color={ACCENT} />
              </View>
              <Text style={[styles.statValue, { color: ACCENT }]}>{coinsEarned}</Text>
              <Text style={styles.statLabel}>Coins Earned</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
              <View style={styles.statIconWrap}>
                <Ionicons name="trophy-outline" size={16} color={ACCENT} />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {totalInvites >= 5 ? 'Gold' : totalInvites >= 2 ? 'Silver' : 'New'}
              </Text>
              <Text style={styles.statLabel}>Rank</Text>
            </View>
          </View>

          {/* ── CODE CARD ── */}
          <View style={styles.codeCard}>
            <Text style={styles.codeCardLabel}>YOUR REFERRAL CODE</Text>
            <Animated.View style={[styles.codeBox, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.codeText}>{referralCode}</Text>
            </Animated.View>
            <View style={styles.codeActionsRow}>
              <TouchableOpacity style={styles.codeAction} onPress={copyToClipboard} activeOpacity={0.7}>
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={17}
                  color={copied ? ACCENT : '#777'}
                />
                <Text style={[styles.codeActionText, copied && { color: ACCENT }]}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
              <View style={styles.codeActionDivider} />
              <TouchableOpacity style={styles.codeAction} onPress={handleShare} activeOpacity={0.7}>
                <Ionicons name="share-social-outline" size={17} color="#777" />
                <Text style={styles.codeActionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── INVITE BUTTON ── */}
          <TouchableOpacity style={styles.inviteBtn} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="paper-plane-outline" size={19} color="#000" style={{ marginRight: 10 }} />
            <Text style={styles.inviteBtnText}>Invite Friends Now</Text>
          </TouchableOpacity>

          {/* ── HOW IT WORKS ── */}
          <View style={[styles.howCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>How it works</Text>
            {STEPS.map((step, i) => (
              <View key={i}>
                <View style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View style={styles.stepNumWrap}>
                      <Text style={styles.stepNum}>{i + 1}</Text>
                    </View>
                    {i < STEPS.length - 1 && <View style={styles.stepLine} />}
                  </View>
                  <View style={styles.stepIconWrap}>
                    <Ionicons name={step.icon} size={20} color={ACCENT} />
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{step.title}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* ── REDEEM ── */}
          <View style={[styles.redeemCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.redeemHeaderRow}>
              <View style={styles.redeemIconWrap}>
                <Ionicons name="ticket-outline" size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Have a friend's code?</Text>
                <Text style={styles.redeemHint}>Enter it to claim your 100 coins welcome bonus.</Text>
              </View>
            </View>
            <View style={[styles.redeemInputRow, { borderColor: theme.colors.border }]}>
              <TextInput
                style={[styles.redeemInput, { color: theme.colors.text }]}
                placeholder="e.g. RUVO-ABCD"
                placeholderTextColor="#3A3A3A"
                autoCapitalize="characters"
                autoCorrect={false}
                value={redeemCode}
                onChangeText={setRedeemCode}
              />
              <TouchableOpacity
                style={[
                  styles.redeemBtn,
                  (!redeemCode.trim() || redeeming) && styles.redeemBtnDisabled,
                ]}
                onPress={handleRedeemCode}
                disabled={redeeming || !redeemCode.trim()}
                activeOpacity={0.85}
              >
                {redeeming
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={styles.redeemBtnText}>Apply</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* ── DISCLAIMER ── */}
          <Text style={styles.disclaimer}>
            Coins are credited once your friend completes signup. One bonus per account. Terms apply.
          </Text>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold' },
  backButton: { width: 40, padding: 4 },

  content: { padding: 20, paddingBottom: 48 },

  // ── Hero ──
  heroSection: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  iconGlowOuter: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  iconGlowRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ACCENT,
    opacity: 0.18,
    transform: [{ scale: 1.45 }],
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 10,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#777',
    textAlign: 'center',
    lineHeight: 22,
  },
  heroHighlight: { color: ACCENT, fontFamily: 'Poppins_600SemiBold' },

  // ── Stats ──
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232323',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(204,255,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 20, fontFamily: 'Poppins_700Bold', lineHeight: 24 },
  statLabel: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: '#666', marginTop: 2, textAlign: 'center' },

  // ── Code Card ──
  codeCard: {
    borderRadius: 18,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  codeCardLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    color: '#555',
    letterSpacing: 1.8,
    marginBottom: 16,
  },
  codeBox: {
    borderWidth: 1.5,
    borderColor: 'rgba(204,255,0,0.35)',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 30,
    marginBottom: 18,
    backgroundColor: 'rgba(204,255,0,0.05)',
  },
  codeText: {
    fontSize: 30,
    fontFamily: 'Poppins_700Bold',
    color: ACCENT,
    letterSpacing: 4,
  },
  codeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  codeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  codeActionText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: '#777',
  },
  codeActionDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#2A2A2A',
  },

  // ── Invite Button ──
  inviteBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  inviteBtnText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#000' },

  // ── How it works ──
  howCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    minHeight: 52,
  },
  stepLeft: {
    width: 28,
    alignItems: 'center',
    marginRight: 4,
  },
  stepNumWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(204,255,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNum: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    color: ACCENT,
  },
  stepLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#2A2A2A',
    marginTop: 4,
    marginBottom: -4,
    minHeight: 28,
  },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(204,255,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: -7,
  },
  stepBody: { flex: 1, paddingBottom: 16, marginTop: -4 },
  stepTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', marginBottom: 2 },
  stepDesc: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: '#666', lineHeight: 18 },

  // ── Redeem ──
  redeemCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  redeemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  redeemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(204,255,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  redeemHint: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
    lineHeight: 18,
    marginTop: 2,
  },
  redeemInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  redeemInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 1.5,
  },
  redeemBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  redeemBtnDisabled: { opacity: 0.4 },
  redeemBtnText: { color: '#000', fontSize: 14, fontFamily: 'Poppins_700Bold' },

  // ── Disclaimer ──
  disclaimer: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: '#3A3A3A',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 10,
  },
});
