import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Dimensions, Linking, Platform,
    ScrollView, StatusBar, StyleSheet, Text,
    TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SecurityContext } from '../context/SecurityContext';
import { useUser } from '../context/UserContext';
import { getOfferings, restorePurchases } from '../services/revenueCat';
import { lightTap, successFeedback } from '../utils/haptics';

const { width } = Dimensions.get('window');
const ACCENT = '#CCFF00';
const CARD_W = (width - 48 - 12) / 2;

// ─────────────────────────────────────────────────────────────────
// FEATURE DEFINITIONS — must match what's actually gated
// ─────────────────────────────────────────────────────────────────
const FEATURES = [
    {
        icon: 'chatbubbles',
        isIonicon: true,
        gradient: ['#0A1628', '#0F2040'],
        accentColor: '#5AC8FA',
        title: 'AI Coach',
        desc: 'Personalised training & adaptive plans',
    },
    {
        icon: 'coins',
        isIonicon: false,
        gradient: ['#1A1400', '#2A2000'],
        accentColor: ACCENT,
        title: '2× Coins',
        desc: 'Double coins on every run you log',
    },
    {
        icon: 'bar-chart',
        isIonicon: true,
        gradient: ['#160A28', '#220F3C'],
        accentColor: '#BF5AF2',
        title: 'Advanced Analytics',
        desc: 'VO2 Max, Race Predictor & PRs',
    },
    {
        icon: 'watch',
        isIonicon: true,
        gradient: ['#0A1A0A', '#0F280F'],
        accentColor: '#30D158',
        title: 'Wearables',
        desc: 'Whoop, Oura Ring & Health sync',
    },
];

// ─────────────────────────────────────────────────────────────────
// LOCKED FEATURE CARD
// ─────────────────────────────────────────────────────────────────
const FeatureCard = ({ feature }) => (
    <View style={[styles.featureCard, { width: CARD_W }]}>
        <LinearGradient colors={feature.gradient} style={StyleSheet.absoluteFill} />

        {/* Icon — dimmed */}
        <View style={styles.featureIconWrap}>
            {feature.isIonicon
                ? <Ionicons name={feature.icon} size={32} color={feature.accentColor} style={{ opacity: 0.45 }} />
                : <MaterialCommunityIcons name={feature.icon} size={32} color={feature.accentColor} style={{ opacity: 0.45 }} />
            }
        </View>

        {/* Lock overlay */}
        <View style={styles.featureLockOverlay}>
            <View style={styles.featureLockBadge}>
                <Ionicons name="lock-closed" size={12} color="#FFF" />
            </View>
        </View>

        {/* Title */}
        <Text style={styles.featureCardTitle}>{feature.title}</Text>
        <Text style={styles.featureCardDesc} numberOfLines={2}>{feature.desc}</Text>
    </View>
);

// ─────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────
export default function PaywallScreen({ navigation }) {
    const { restorePro, upgradeToPro, simulatePro } = useUser();
    const { isCompromised } = useContext(SecurityContext);

    const isIOS = Platform.OS === 'ios';

    const [offerings, setOfferings]             = useState(null);
    const [isMockOfferings, setIsMockOfferings] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [isPurchasing, setIsPurchasing]       = useState(false);
    const [isLoading, setIsLoading]             = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const real = await getOfferings();
                // Treat as real only if packages exist AND have verified prices from the Play Store.
                // RevenueCat can return packages with null priceString when the Play Store
                // product isn't active yet — that still counts as "not live".
                const hasVerifiedPrices = real?.availablePackages?.some(
                    p => p.product?.priceString != null && (p.product?.price ?? 0) > 0
                );
                if (hasVerifiedPrices) {
                    setOfferings(real);
                    setIsMockOfferings(false);
                    const annual = real.availablePackages.find(p => p.packageType === 'ANNUAL');
                    setSelectedPackage(annual || real.availablePackages[0]);
                } else {
                    // No real products configured yet — show demo prices
                    const mock = {
                        availablePackages: [
                            { identifier: 'monthly_test', packageType: 'MONTHLY', product: { productId: 'ruvo_pro_monthly', price: 4.99,  priceString: '$4.99',  currencyCode: 'USD' } },
                            { identifier: 'annual_test',  packageType: 'ANNUAL',  product: { productId: 'ruvo_pro_annual',  price: 39.99, priceString: '$39.99', currencyCode: 'USD' } },
                        ],
                    };
                    setOfferings(mock);
                    setIsMockOfferings(true);
                    setSelectedPackage(mock.availablePackages[1]);
                }
            } catch {
                Alert.alert('Connection Error', 'Could not load subscription packages.');
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const handlePurchase = async () => {
        // iOS purchases not yet configured
        if (isIOS) {
            Alert.alert(
                'Coming Soon on iOS',
                'iOS subscriptions are not available yet. Ruvo Pro is currently Android-only. We\'ll notify you when the iOS App Store version launches.'
            );
            return;
        }

        if (isCompromised) {
            return Alert.alert('Security Restriction', 'Purchases are disabled on rooted/jailbroken devices.');
        }
        if (!selectedPackage) return;

        // Mock offerings = no real products in Play Store yet
        if (isMockOfferings) {
            Alert.alert(
                'Purchases Not Live Yet',
                'The subscription products are not yet configured in Google Play Console / RevenueCat. Once published, real payments will work here automatically.'
            );
            return;
        }

        setIsPurchasing(true);
        try {
            const success = await upgradeToPro(selectedPackage);
            if (success) {
                successFeedback();
                Alert.alert('Welcome to Ruvo Pro! 🎉', 'All features are now unlocked. Enjoy your elite toolkit.');
                navigation.goBack();
            }
        } catch (error) {
            const msg = error?.userInfo?.readableErrorCode || error?.message || '';
            Alert.alert('Purchase Failed', msg || 'Could not connect to the store. Please try again.');
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleDevSimulate = () => {
        if (!simulatePro) return;
        lightTap();
        simulatePro();
        Alert.alert('DEV: Pro Simulated', 'isPro = true set in local state. All Pro features are now unlocked for this session.', [
            { text: 'OK', onPress: () => navigation.goBack() }
        ]);
    };

    const handleRestore = async () => {
        setIsPurchasing(true);
        const success = await restorePurchases();
        if (success) { await restorePro(); Alert.alert('Restored', 'Your Pro subscription is active.'); navigation.goBack(); }
        else Alert.alert('No Subscription Found', "We couldn't find an active subscription to restore.");
        setIsPurchasing(false);
    };

    if (isLoading) {
        return (
            <View style={styles.loadingScreen}>
                <ActivityIndicator size="large" color={ACCENT} />
                <Text style={styles.loadingText}>Loading plans…</Text>
            </View>
        );
    }

    const annualPkg  = offerings?.availablePackages.find(p => p.packageType === 'ANNUAL');
    const monthlyPkg = offerings?.availablePackages.find(p => p.packageType === 'MONTHLY');

    let savingsPct = 33; // $4.99×12 = $59.88 vs $39.99 annual = ~33% off
    if (annualPkg && monthlyPkg) {
        const yearly = monthlyPkg.product.price * 12;
        if (yearly > 0) savingsPct = Math.round(((yearly - annualPkg.product.price) / yearly) * 100);
    }

    const annualPerMonth   = annualPkg  ? (annualPkg.product.price  / 12).toFixed(2) : '3.33';
    const annualPriceStr   = annualPkg?.product?.priceString  || '$39.99';
    const monthlyPriceStr  = monthlyPkg?.product?.priceString || '$4.99';
    const currency         = annualPkg?.product?.currencyCode || '$';
    const hasIntro         = selectedPackage?.product?.introPrice != null;

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#0A0A0A', '#000000']} style={StyleSheet.absoluteFill} />

            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Close button */}
                <View style={styles.header}>
                    <TouchableOpacity activeOpacity={0.7} style={styles.closeBtn} onPress={() => { lightTap(); navigation.goBack(); }}>
                        <Ionicons name="close" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                    {/* ── HERO ─────────────────────────────── */}
                    <View style={styles.hero}>
                        <View style={styles.proBadge}>
                            <MaterialCommunityIcons name="crown" size={14} color="#000" style={{ marginRight: 5 }} />
                            <Text style={styles.proBadgeText}>RUVO PRO</Text>
                        </View>
                        <Text style={styles.heroTitle}>Unlock Your{'\n'}Full Potential</Text>
                        <Text style={styles.heroSub}>{"The complete runner's toolkit — all in one place"}</Text>
                        <View style={styles.socialProof}>
                            <Ionicons name="people" size={14} color="#555" />
                            <Text style={styles.socialProofText}>Joined by 12,400+ Pro runners</Text>
                        </View>
                    </View>

                    {/* ── LOCKED FEATURE CARDS ─────────────── */}
                    <Text style={styles.sectionLabel}>{"WHAT YOU'RE MISSING"}</Text>
                    <View style={styles.featureGrid}>
                        {FEATURES.map(f => <FeatureCard key={f.title} feature={f} />)}
                    </View>

                    {/* ── UNLOCK DIVIDER ───────────────────── */}
                    <View style={styles.unlockRow}>
                        <View style={styles.unlockLine} />
                        <View style={styles.unlockChip}>
                            <Ionicons name="lock-open-outline" size={13} color={ACCENT} style={{ marginRight: 5 }} />
                            <Text style={styles.unlockChipText}>Unlock everything below</Text>
                        </View>
                        <View style={styles.unlockLine} />
                    </View>

                    {/* ── PRICING CARDS ────────────────────── */}
                    <View style={styles.pricingWrap}>

                        {/* ANNUAL */}
                        {annualPkg && (
                            <TouchableOpacity
                                activeOpacity={0.85}
                                style={[styles.planCard, styles.planCardAnnual, selectedPackage?.identifier === annualPkg.identifier && styles.planCardSelected]}
                                onPress={() => { lightTap(); setSelectedPackage(annualPkg); }}
                            >
                                <View style={styles.bestValueBadge}>
                                    <Text style={styles.bestValueText}>BEST VALUE · SAVE {savingsPct}%</Text>
                                </View>
                                <View style={styles.planRow}>
                                    <View>
                                        <Text style={styles.planName}>Annual Plan</Text>
                                        <Text style={styles.planSub}>Just {currency}{annualPerMonth}/month</Text>
                                    </View>
                                    <View style={styles.planPriceCol}>
                                        <Text style={[styles.planPrice, { color: ACCENT }]}>{annualPriceStr}</Text>
                                        <Text style={styles.planPricePer}>/year</Text>
                                        {monthlyPkg && (
                                            <Text style={styles.planStrike}>{currency}{(monthlyPkg.product.price * 12).toFixed(2)}</Text>
                                        )}
                                    </View>
                                </View>
                                <View style={[styles.radioRow, selectedPackage?.identifier === annualPkg.identifier && styles.radioRowSelected]}>
                                    <View style={[styles.radioOuter, selectedPackage?.identifier === annualPkg.identifier && styles.radioOuterActive]}>
                                        {selectedPackage?.identifier === annualPkg.identifier && <View style={styles.radioInner} />}
                                    </View>
                                    <Text style={styles.radioText}>Selected plan</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* MONTHLY */}
                        {monthlyPkg && (
                            <TouchableOpacity
                                activeOpacity={0.85}
                                style={[styles.planCard, selectedPackage?.identifier === monthlyPkg.identifier && styles.planCardSelectedMono]}
                                onPress={() => { lightTap(); setSelectedPackage(monthlyPkg); }}
                            >
                                <View style={styles.planRow}>
                                    <View>
                                        <Text style={styles.planName}>Monthly Plan</Text>
                                        <Text style={styles.planSub}>Cancel anytime</Text>
                                    </View>
                                    <View style={styles.planPriceCol}>
                                        <Text style={styles.planPrice}>{monthlyPriceStr}</Text>
                                        <Text style={styles.planPricePer}>/month</Text>
                                    </View>
                                </View>
                                <View style={[styles.radioRow, selectedPackage?.identifier === monthlyPkg.identifier && styles.radioRowSelected]}>
                                    <View style={[styles.radioOuter, selectedPackage?.identifier === monthlyPkg.identifier && styles.radioOuterActive]}>
                                        {selectedPackage?.identifier === monthlyPkg.identifier && <View style={styles.radioInner} />}
                                    </View>
                                    <Text style={styles.radioText}>{selectedPackage?.identifier === monthlyPkg.identifier ? 'Selected plan' : 'Switch to monthly'}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ── iOS COMING SOON BANNER ───────────── */}
                    {isIOS && (
                        <View style={styles.iosBanner}>
                            <Ionicons name="logo-apple" size={16} color="#FFF" />
                            <Text style={styles.iosBannerText}>
                                iOS subscriptions are coming soon. Currently Android only.
                            </Text>
                        </View>
                    )}

                    {/* ── MOCK OFFERINGS WARNING ────────────── */}
                    {isMockOfferings && !isIOS && (
                        <View style={styles.mockBanner}>
                            <Ionicons name="construct-outline" size={14} color="#FF9500" />
                            <Text style={styles.mockBannerText}>
                                Demo prices — products not yet published in Play Store
                            </Text>
                        </View>
                    )}

                    {/* ── CTA ──────────────────────────────── */}
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                            styles.cta,
                            (isPurchasing || !selectedPackage || isIOS) && styles.ctaDisabled,
                        ]}
                        onPress={() => { lightTap(); handlePurchase(); }}
                        disabled={isPurchasing || !selectedPackage}
                    >
                        {isPurchasing
                            ? <ActivityIndicator color="#000" />
                            : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    {isIOS
                                        ? <Ionicons name="time-outline" size={18} color="#888" />
                                        : <MaterialCommunityIcons name="crown" size={18} color="#000" />
                                    }
                                    <Text style={[styles.ctaText, isIOS && { color: '#888' }]}>
                                        {isIOS
                                            ? 'Coming Soon on iOS'
                                            : hasIntro ? 'Start 7-Day Free Trial' : 'Unlock Ruvo Pro'
                                        }
                                    </Text>
                                </View>
                            )
                        }
                    </TouchableOpacity>

                    {/* ── DEV SIMULATE BUTTON (only in __DEV__ builds) ── */}
                    {__DEV__ && simulatePro && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={styles.devBtn}
                            onPress={handleDevSimulate}
                        >
                            <Ionicons name="code-slash" size={14} color="#FF9500" style={{ marginRight: 6 }} />
                            <Text style={styles.devBtnText}>DEV: Simulate Pro Upgrade</Text>
                        </TouchableOpacity>
                    )}

                    {/* Trust signals */}
                    <View style={styles.trustRow}>
                        {['No commitment', 'Cancel anytime', 'Secure payment'].map((t, i) => (
                            <View key={i} style={styles.trustItem}>
                                <Ionicons name="checkmark-circle" size={13} color={ACCENT} />
                                <Text style={styles.trustText}>{t}</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={styles.disclaimer}>
                        Subscription auto-renews. Manage or cancel in device Settings at any time.
                    </Text>

                    {/* Footer links */}
                    <View style={styles.footerLinks}>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); handleRestore(); }}>
                            <Text style={styles.footerLink}>Restore Purchase</Text>
                        </TouchableOpacity>
                        <Text style={styles.footerDot}>·</Text>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL('https://ruvo.run/terms')}>
                            <Text style={styles.footerLink}>Terms</Text>
                        </TouchableOpacity>
                        <Text style={styles.footerDot}>·</Text>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL('https://ruvo.run/privacy')}>
                            <Text style={styles.footerLink}>Privacy</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    loadingScreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#666', marginTop: 14, fontFamily: 'Poppins_400Regular', fontSize: 14 },

    header: { paddingHorizontal: 20, paddingTop: 12, alignItems: 'flex-end' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },

    scroll: { paddingHorizontal: 24, paddingBottom: 50 },

    // Hero
    hero: { alignItems: 'center', paddingTop: 16, paddingBottom: 28 },
    proBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ACCENT,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 5,
        marginBottom: 18,
    },
    proBadgeText: { color: '#000', fontSize: 11, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 1.5 },
    heroTitle: { color: '#FFF', fontSize: 34, fontFamily: 'Poppins_800ExtraBold', textAlign: 'center', lineHeight: 42, marginBottom: 10 },
    heroSub: { color: '#666', fontSize: 14, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
    socialProof: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    socialProofText: { color: '#444', fontSize: 12, fontFamily: 'Poppins_400Regular' },

    // Feature section
    sectionLabel: {
        color: '#444',
        fontSize: 10,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 1.2,
        textAlign: 'center',
        marginBottom: 14,
    },
    featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },

    featureCard: {
        borderRadius: 18,
        overflow: 'hidden',
        height: 150,
        padding: 16,
        justifyContent: 'flex-end',
        borderWidth: 1,
        borderColor: '#1E1E1E',
        position: 'relative',
    },
    featureIconWrap: { position: 'absolute', top: 16, left: 16 },
    featureLockOverlay: {
        position: 'absolute',
        top: 12,
        right: 12,
    },
    featureLockBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    featureCardTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold', marginBottom: 3 },
    featureCardDesc: { color: '#666', fontSize: 11, fontFamily: 'Poppins_400Regular', lineHeight: 15 },

    // Unlock divider
    unlockRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
    unlockLine: { flex: 1, height: 1, backgroundColor: '#1A1A1A' },
    unlockChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(204,255,0,0.07)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(204,255,0,0.18)',
        marginHorizontal: 10,
    },
    unlockChipText: { color: ACCENT, fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

    // Pricing
    pricingWrap: { gap: 12, marginBottom: 24 },
    planCard: {
        backgroundColor: '#0E0E0E',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1.5,
        borderColor: '#222',
    },
    planCardAnnual: {
        borderColor: ACCENT,
        backgroundColor: 'rgba(204,255,0,0.04)',
        paddingTop: 28,
    },
    planCardSelected: { borderColor: ACCENT },
    planCardSelectedMono: { borderColor: '#FFF' },

    bestValueBadge: {
        position: 'absolute',
        top: -12,
        alignSelf: 'center',
        backgroundColor: ACCENT,
        paddingHorizontal: 14,
        paddingVertical: 4,
        borderRadius: 20,
    },
    bestValueText: { color: '#000', fontSize: 10, fontFamily: 'Poppins_800ExtraBold', letterSpacing: 0.5 },

    planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    planName: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
    planSub: { color: '#555', fontSize: 12, fontFamily: 'Poppins_400Regular' },
    planPriceCol: { alignItems: 'flex-end' },
    planPrice: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold' },
    planPricePer: { color: '#555', fontSize: 12, fontFamily: 'Poppins_400Regular' },
    planStrike: { color: '#444', fontSize: 11, textDecorationLine: 'line-through', marginTop: 2 },

    radioRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    radioRowSelected: {},
    radioOuter: {
        width: 18, height: 18, borderRadius: 9,
        borderWidth: 1.5, borderColor: '#333',
        justifyContent: 'center', alignItems: 'center',
    },
    radioOuterActive: { borderColor: ACCENT },
    radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: ACCENT },
    radioText: { color: '#444', fontSize: 11, fontFamily: 'Poppins_400Regular' },

    // CTA
    cta: {
        backgroundColor: ACCENT,
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
    ctaDisabled: { opacity: 0.5, shadowOpacity: 0 },
    ctaText: { color: '#000', fontSize: 17, fontFamily: 'Poppins_700Bold', letterSpacing: 0.3 },

    // Status banners
    iosBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    iosBannerText: {
        flex: 1,
        color: '#888',
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
        lineHeight: 18,
    },
    mockBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,149,0,0.08)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,149,0,0.2)',
    },
    mockBannerText: {
        flex: 1,
        color: '#FF9500',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
    },
    devBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,149,0,0.35)',
        borderRadius: 14,
        paddingVertical: 12,
        marginBottom: 10,
        backgroundColor: 'rgba(255,149,0,0.06)',
    },
    devBtnText: {
        color: '#FF9500',
        fontSize: 13,
        fontFamily: 'Poppins_600SemiBold',
    },

    // Trust + footer
    trustRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' },
    trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    trustText: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular' },
    disclaimer: { color: '#333', fontSize: 10, textAlign: 'center', marginBottom: 22, paddingHorizontal: 10, lineHeight: 16 },
    footerLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    footerLink: { color: '#555', fontSize: 12, fontFamily: 'Poppins_500Medium' },
    footerDot: { color: '#333' },
});
