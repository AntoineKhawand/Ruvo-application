import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Dimensions, ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';

const COLORS = {
    accent: "#CCFF00", // Neon Green
    primary: "#000000",
    secondary: "#1C1C1E",
    cardBg: "#111111",
    text: "#FFFFFF",
    subText: "#888888",
};

const { width, height } = Dimensions.get('window');

export default function TipDetailScreen({ route, navigation }) {
    const { tip } = route.params || {};
    const { userData, toggleTipBookmark } = useUser();
    const [isHelpful, setIsHelpful] = useState(false);

    const isSaved = userData.savedTips?.includes(tip?.id);

    if (!tip) return null;

    // Fallback steps if data is missing
    const steps = tip.steps || [
        { title: "Preparation", desc: "Start slowly to build the habit." },
        { title: "Execution", desc: "Focus on consistency rather than speed." },
        { title: "Integration", desc: "Add this to your routine once a week." }
    ];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>

                {/* HERO HEADER (IMAGE ONLY) */}
                <ImageBackground
                    source={{
                        uri: tip.img,
                        // High priority tells the OS to download this immediately at best quality
                        priority: 'high'
                    }}
                    style={styles.heroImage}
                    // Ensures the image fills the space without pixelating
                    resizeMode="cover"
                    progressiveRenderingEnabled={true}
                >
                    <LinearGradient
                        colors={['rgba(0,0,0,0.6)', 'transparent', '#000']}
                        style={styles.gradientOverlay}
                    >
                        <SafeAreaView style={styles.safeArea}>
                            <View style={styles.navBar}>
                                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navButton}>
                                    <Ionicons name="close" size={28} color="#FFF" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleTipBookmark(tip.id)} style={styles.navButton}>
                                    <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={26} color={isSaved ? COLORS.accent : "#FFF"} />
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </LinearGradient>
                </ImageBackground>

                <View style={styles.bodyContainer}>

                    {/* --- HEADER METRICS & TITLE --- */}
                    <View style={styles.headerInfo}>
                        <View style={styles.tagRow}>
                            <View style={styles.pillTag}>
                                <Text style={styles.pillText}>RUNNING IQ</Text>
                            </View>
                            <View style={styles.dotSeparator} />
                            <View style={styles.pillTagTransparent}>
                                <Ionicons name="people" size={14} color="#888" style={{ marginRight: 6 }} />
                                <Text style={styles.statText}>{tip.views?.toLocaleString()} READS</Text>
                            </View>
                        </View>
                        <Text style={styles.heroTitle}>{tip.title.toUpperCase()}</Text>
                    </View>

                    {/* (Summary Section Removed) */}

                    {/* --- THE SCIENCE (CARD STYLE) --- */}
                    <View style={styles.scienceCard}>
                        <View style={styles.sectionHeaderRow}>
                            <MaterialCommunityIcons name="brain" size={20} color={COLORS.accent} style={{ marginRight: 10 }} />
                            <Text style={styles.sectionHeading}>THE BREAKDOWN</Text>
                        </View>
                        <Text style={styles.bodyParagraph}>
                            {tip.why || "This technique helps improve running economy by reducing the energy cost of movement. Studies show that focusing on this aspect can prevent common injuries like shin splints and runner's knee."}
                        </Text>
                    </View>

                    {/* --- ACTION PLAN (DRILL STYLE) --- */}
                    <View style={styles.actionSection}>
                        <View style={styles.sectionHeaderRow}>
                            <MaterialCommunityIcons name="lightning-bolt" size={20} color={COLORS.accent} style={{ marginRight: 10 }} />
                            <Text style={styles.sectionHeading}>DRILL SEQUENCE</Text>
                        </View>

                        {steps.map((step, index) => (
                            <View key={index} style={styles.stepItem}>
                                <View style={styles.stepLeftCol}>
                                    <View style={[styles.stepCircle, index === steps.length - 1 && { borderColor: COLORS.accent }]}>
                                        <Text style={[styles.stepNumber, index === steps.length - 1 && { color: COLORS.accent }]}>{index + 1}</Text>
                                    </View>
                                    {/* Don't show line for the last item */}
                                    {index !== steps.length - 1 && <View style={styles.stepLine} />}
                                </View>
                                <View style={styles.stepContent}>
                                    <Text style={[styles.stepTitle, index === steps.length - 1 && { color: COLORS.accent }]}>{step.title}</Text>
                                    <Text style={styles.stepDesc}>{step.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* FEEDBACK TOGGLE */}
                    <TouchableOpacity
                        style={[styles.feedbackBtn, isHelpful && styles.feedbackBtnActive]}
                        onPress={() => setIsHelpful(!isHelpful)}
                        activeOpacity={0.9}
                    >
                        <Text style={[styles.feedbackLabel, isHelpful && { color: '#000' }]}>
                            {isHelpful ? "MARKED AS HELPFUL" : "MARK AS HELPFUL"}
                        </Text>
                        {isHelpful && <Ionicons name="checkmark-circle" size={20} color="#000" style={{ marginLeft: 8 }} />}
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    heroImage: { width: '100%', height: height * 0.5 },
    gradientOverlay: { flex: 1, justifyContent: 'space-between' },
    safeArea: { marginHorizontal: 20, marginTop: 10, flex: 1 },

    navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    navButton: {
        width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center', alignItems: 'center'
    },

    bodyContainer: { paddingHorizontal: 24, marginTop: -40 },

    headerInfo: { marginBottom: 35 },
    tagRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    pillTag: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    pillText: { color: '#000', fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },
    dotSeparator: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#444', marginHorizontal: 10 },
    pillTagTransparent: { flexDirection: 'row', alignItems: 'center' },
    statText: { color: '#888', fontSize: 12, fontFamily: 'Poppins_600SemiBold', letterSpacing: 0.5 },

    heroTitle: {
        fontSize: 36,
        color: '#FFF',
        fontFamily: 'Poppins_900Black',
        lineHeight: 40,
        textTransform: 'uppercase',
        letterSpacing: -0.5,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10
    },

    // SCIENCE CARD
    scienceCard: {
        backgroundColor: COLORS.cardBg,
        padding: 24,
        borderRadius: 16,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: '#222'
    },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    sectionHeading: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 2,
        textTransform: 'uppercase'
    },
    bodyParagraph: {
        color: '#CCC',
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        lineHeight: 26
    },

    actionSection: { marginBottom: 40 },

    // DRILL STEP STYLES
    stepItem: { flexDirection: 'row', marginBottom: 0 },
    stepLeftCol: { alignItems: 'center', width: 40, marginRight: 15 },
    stepCircle: {
        width: 32, height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#444',
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: '#000',
        zIndex: 2
    },
    stepNumber: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold' },
    stepLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#222',
        marginVertical: -2
    },
    stepContent: { flex: 1, paddingBottom: 30 },
    stepTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold', marginBottom: 4 },
    stepDesc: { color: '#888', fontSize: 15, fontFamily: 'Poppins_400Regular', lineHeight: 22 },

    feedbackBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 18,
        borderRadius: 12,
        backgroundColor: '#222',
        marginTop: 10
    },
    feedbackBtnActive: {
        backgroundColor: COLORS.accent,
    },
    feedbackLabel: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 1
    }
});