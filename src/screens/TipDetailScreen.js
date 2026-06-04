import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
    Dimensions, ImageBackground, ScrollView, StatusBar,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { successFeedback } from '../utils/haptics';

const { width, height } = Dimensions.get('window');

const ACCENT = '#CCFF00';

// ── Category colour + icon map ────────────────────────────────────
const CATEGORY_META = {
    'Technique':    { color: '#CCFF00', icon: 'speedometer-outline' },
    'Nutrition':    { color: '#FF9500', icon: 'nutrition-outline' },
    'Recovery':     { color: '#5AC8FA', icon: 'battery-charging-outline' },
    'Mental':       { color: '#BF5AF2', icon: 'brain' },
    'Strength':     { color: '#FF2D55', icon: 'barbell-outline' },
    'Gear':         { color: '#FFD700', icon: 'shirt-outline' },
    'Race Prep':    { color: '#FF6B6B', icon: 'flag-outline' },
    'Injury Prev':  { color: '#34C759', icon: 'shield-checkmark-outline' },
};

const getCategoryMeta = (category) =>
    CATEGORY_META[category] || { color: ACCENT, icon: 'book-outline' };

// ─────────────────────────────────────────────────────────────────
export default function TipDetailScreen({ route, navigation }) {
    const { tip } = route.params || {};
    const { userData, toggleTipBookmark } = useUser();
    const [isHelpful, setIsHelpful] = useState(false);

    if (!tip) return null;

    const isSaved = userData?.savedTips?.includes(tip.id);
    const meta = getCategoryMeta(tip.category);

    const steps = tip.steps || [
        { title: 'Preparation', desc: 'Start slowly to build the habit.' },
        { title: 'Execution', desc: 'Focus on consistency rather than speed.' },
        { title: 'Integration', desc: 'Add this to your routine once a week.' },
    ];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                {/* ── HERO ───────────────────────────────────────── */}
                <View style={styles.heroWrap}>
                    <ImageBackground
                        source={{ uri: tip.img }}
                        style={styles.heroImage}
                        resizeMode="cover"
                        progressiveRenderingEnabled
                    >
                        {/* Gradient: subtle top darkening for nav buttons + strong bottom fade */}
                        <LinearGradient
                            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
                            locations={[0, 0.45, 1]}
                            style={StyleSheet.absoluteFill}
                        />

                        <SafeAreaView style={styles.heroNav} edges={['top']}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
                                <Ionicons name="arrow-back" size={22} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => { toggleTipBookmark(tip.id); }}
                                style={[styles.navBtn, isSaved && { backgroundColor: 'rgba(204,255,0,0.2)', borderColor: 'rgba(204,255,0,0.4)' }]}
                            >
                                <Ionicons
                                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                                    size={20}
                                    color={isSaved ? ACCENT : '#FFF'}
                                />
                            </TouchableOpacity>
                        </SafeAreaView>

                        {/* Hero bottom — category, read time, title */}
                        <View style={styles.heroBtm}>
                            <View style={styles.heroMetaRow}>
                                {/* Category pill */}
                                <View style={[styles.catPill, { backgroundColor: meta.color }]}>
                                    <Ionicons name={meta.icon} size={11} color="#000" style={{ marginRight: 4 }} />
                                    <Text style={styles.catPillText}>{tip.tag || tip.category?.toUpperCase() || 'RUNNING IQ'}</Text>
                                </View>

                                {/* Read time */}
                                {tip.readTime && (
                                    <View style={styles.readTimePill}>
                                        <Ionicons name="time-outline" size={11} color="#AAA" style={{ marginRight: 4 }} />
                                        <Text style={styles.readTimeText}>{tip.readTime} min read</Text>
                                    </View>
                                )}

                                {/* Views */}
                                {tip.views > 0 && (
                                    <View style={styles.readTimePill}>
                                        <Ionicons name="eye-outline" size={11} color="#AAA" style={{ marginRight: 4 }} />
                                        <Text style={styles.readTimeText}>{tip.views?.toLocaleString()}</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={styles.heroTitle}>{tip.title}</Text>
                            <Text style={styles.heroDesc}>{tip.desc}</Text>
                        </View>
                    </ImageBackground>
                </View>

                {/* ── BODY ───────────────────────────────────────── */}
                <View style={styles.body}>

                    {/* Key Takeaway callout */}
                    {tip.keyTakeaway && (
                        <View style={[styles.callout, { borderLeftColor: meta.color }]}>
                            <View style={styles.calloutHeader}>
                                <View style={[styles.calloutIcon, { backgroundColor: meta.color + '22' }]}>
                                    <Ionicons name="bulb-outline" size={16} color={meta.color} />
                                </View>
                                <Text style={[styles.calloutLabel, { color: meta.color }]}>KEY TAKEAWAY</Text>
                            </View>
                            <Text style={styles.calloutText}>{tip.keyTakeaway}</Text>
                        </View>
                    )}

                    {/* The Breakdown */}
                    <View style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <View style={[styles.cardIcon, { backgroundColor: meta.color + '18' }]}>
                                <MaterialCommunityIcons name="brain" size={18} color={meta.color} />
                            </View>
                            <Text style={styles.cardHeading}>THE BREAKDOWN</Text>
                        </View>
                        <Text style={styles.bodyText}>
                            {tip.why || 'This technique helps improve running economy and reduces the energy cost of movement. Studies show consistent application prevents common overuse injuries.'}
                        </Text>
                    </View>

                    {/* Drill Sequence */}
                    <View style={styles.drillSection}>
                        <View style={styles.cardHeaderRow}>
                            <View style={[styles.cardIcon, { backgroundColor: ACCENT + '18' }]}>
                                <MaterialCommunityIcons name="lightning-bolt" size={18} color={ACCENT} />
                            </View>
                            <Text style={styles.cardHeading}>DRILL SEQUENCE</Text>
                        </View>

                        {steps.map((step, i) => {
                            const isLast = i === steps.length - 1;
                            return (
                                <View key={i} style={styles.stepRow}>
                                    {/* Left column: number circle + connector line */}
                                    <View style={styles.stepLeft}>
                                        <View style={[
                                            styles.stepCircle,
                                            isLast && { borderColor: meta.color, backgroundColor: meta.color + '15' },
                                        ]}>
                                            <Text style={[styles.stepNum, isLast && { color: meta.color }]}>
                                                {i + 1}
                                            </Text>
                                        </View>
                                        {!isLast && <View style={[styles.stepLine, { backgroundColor: meta.color + '30' }]} />}
                                    </View>

                                    {/* Content */}
                                    <View style={styles.stepContent}>
                                        <Text style={[styles.stepTitle, isLast && { color: meta.color }]}>
                                            {step.title}
                                        </Text>
                                        <Text style={styles.stepDesc}>{step.desc}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Helpful button */}
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={[styles.helpfulBtn, isHelpful && { backgroundColor: meta.color, borderColor: meta.color }]}
                        onPress={() => { setIsHelpful(!isHelpful); if (!isHelpful) successFeedback(); }}
                    >
                        {isHelpful
                            ? <Ionicons name="checkmark-circle" size={18} color="#000" style={{ marginRight: 8 }} />
                            : <Ionicons name="thumbs-up-outline" size={18} color="#888" style={{ marginRight: 8 }} />
                        }
                        <Text style={[styles.helpfulText, isHelpful && { color: '#000' }]}>
                            {isHelpful ? 'Marked as Helpful' : 'Mark as Helpful'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    // ── Hero ──
    heroWrap: { width: '100%' },
    heroImage: { width: '100%', height: height * 0.52, justifyContent: 'space-between' },
    heroNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 6,
    },
    navBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
    },
    heroBtm: { paddingHorizontal: 20, paddingBottom: 24 },
    heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
    catPill: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    },
    catPillText: { color: '#000', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 0.8 },
    readTimePill: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
    },
    readTimeText: { color: '#AAA', fontSize: 10, fontFamily: 'Poppins_500Medium' },
    heroTitle: {
        fontSize: 32,
        fontFamily: 'Poppins_800ExtraBold',
        color: '#FFF',
        lineHeight: 38,
        letterSpacing: -0.5,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
        marginBottom: 6,
    },
    heroDesc: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 15,
        fontFamily: 'Poppins_400Regular',
        lineHeight: 22,
    },

    // ── Body ──
    body: { paddingHorizontal: 20, paddingTop: 24 },

    // Key takeaway callout
    callout: {
        backgroundColor: '#0A0A0A',
        borderRadius: 16,
        padding: 18,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderWidth: 1,
        borderColor: '#1E1E1E',
    },
    calloutHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    calloutIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    calloutLabel: { fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
    calloutText: { color: '#DDD', fontSize: 15, fontFamily: 'Poppins_500Medium', lineHeight: 24 },

    // Breakdown card
    card: {
        backgroundColor: '#0D0D0D',
        borderRadius: 18,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#1E1E1E',
    },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    cardIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    cardHeading: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_700Bold', letterSpacing: 1.5, textTransform: 'uppercase' },
    bodyText: { color: '#BBB', fontSize: 15, fontFamily: 'Poppins_400Regular', lineHeight: 26 },

    // Drill steps
    drillSection: { marginBottom: 28 },
    stepRow: { flexDirection: 'row', marginBottom: 0 },
    stepLeft: { width: 42, alignItems: 'center', marginRight: 14 },
    stepCircle: {
        width: 34, height: 34, borderRadius: 17,
        borderWidth: 2, borderColor: '#2A2A2A',
        backgroundColor: '#0A0A0A',
        justifyContent: 'center', alignItems: 'center',
        zIndex: 2,
    },
    stepNum: { color: '#888', fontSize: 14, fontFamily: 'Poppins_700Bold' },
    stepLine: { width: 2, flex: 1, marginVertical: 4 },
    stepContent: { flex: 1, paddingBottom: 28 },
    stepTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold', marginBottom: 5 },
    stepDesc: { color: '#777', fontSize: 14, fontFamily: 'Poppins_400Regular', lineHeight: 22 },

    // Helpful button
    helpfulBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, borderRadius: 14,
        backgroundColor: '#111', borderWidth: 1.5, borderColor: '#2A2A2A',
        marginBottom: 16,
    },
    helpfulText: { color: '#888', fontSize: 14, fontFamily: 'Poppins_600SemiBold', letterSpacing: 0.5 },
});
