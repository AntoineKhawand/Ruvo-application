import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { HELP_CATEGORIES } from '../constants/helpData';
import { useTheme } from '../context/ThemeContext';

const COLORS = {
    primary: "#000000",
    secondary: "#1C1C1E",
    accent: "#CCFF00",
    text: "#FFFFFF",
    subText: "#888888",
    card: "#1C1C1E",
    border: "#333333"
};

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const AccordionItem = ({ question, answer }) => {
    const [expanded, setExpanded] = useState(false);
    const { theme } = useTheme();

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    return (
        <View style={[styles.accordionItem, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity style={styles.accordionHeader} onPress={toggleExpand}>
                <Text style={[styles.questionText, { color: theme.colors.text }]}>{question}</Text>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.accent} />
            </TouchableOpacity>
            {expanded && (
                <View style={styles.accordionBody}>
                    <Text style={[styles.answerText, { color: theme.colors.subText }]}>{answer}</Text>
                </View>
            )}
        </View>
    );
};

export default function HelpCenterScreen({ navigation }) {
    const { theme } = useTheme();
    const [categories, setCategories] = useState(HELP_CATEGORIES);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchFaqs = async () => {
            setLoading(true);
            try {
                const querySnapshot = await getDocs(collection(db, "help_categories"));
                if (!querySnapshot.empty) {
                    const fetchedCategories = [];
                    querySnapshot.forEach((doc) => {
                        fetchedCategories.push({ id: doc.id, ...doc.data() });
                    });

                    // Sort by an 'order' field if available, otherwise just use as is
                    fetchedCategories.sort((a, b) => (a.order || 0) - (b.order || 0));
                    setCategories(fetchedCategories);
                }
            } catch (error) {
                console.warn("Failed to fetch cloud FAQs, falling back to local data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFaqs();
    }, []);

    const handleEmailSupport = () => {
        Linking.openURL('mailto:support@ruvo.app?subject=Ruvo Support Request').catch(err => console.error("Couldn't load page", err));
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <SafeAreaView style={{ flex: 1 }}>

                {/* HEADER */}
                <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Help Center</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>

                    {/* HINT */}
                    <Text style={[styles.hintText, { color: theme.colors.subText }]}>
                        Browse topics below or contact us for help.
                    </Text>

                    {loading ? (
                        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={COLORS.accent} />
                            <Text style={[styles.hintText, { color: theme.colors.subText, marginTop: 10 }]}>Loading topics...</Text>
                        </View>
                    ) : (
                        <>
                            {/* CATEGORY LOOP */}
                            {categories.map((cat) => (
                                <View key={cat.id} style={styles.categoryContainer}>
                                    <View style={styles.catHeader}>
                                        <Ionicons name={cat.icon} size={22} color={COLORS.accent} style={{ marginRight: 10 }} />
                                        <Text style={[styles.catTitle, { color: theme.colors.text }]}>{cat.title}</Text>
                                    </View>

                                    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                                        {cat.faqs.map((faq, index) => (
                                            <AccordionItem key={index} question={faq.q} answer={faq.a} />
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </>
                    )}

                    {/* CONTACT SUPPORT */}
                    <View style={styles.contactSection}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Still need help?</Text>

                        <TouchableOpacity style={[styles.contactBtn, { backgroundColor: COLORS.accent }]} onPress={handleEmailSupport}>
                            <Ionicons name="mail" size={20} color="#000" style={{ marginRight: 10 }} />
                            <Text style={styles.contactBtnText}>Contact Support</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.reportBtn} onPress={() => Linking.openURL('mailto:support@ruvo.app?subject=Bug Report')}>
                            <Text style={[styles.reportBtnText, { color: theme.colors.subText }]}>Report a Bug</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold' },
    backButton: { padding: 5 },

    content: { padding: 20, paddingBottom: 40 },
    hintText: { fontSize: 14, fontFamily: 'Poppins_400Regular', marginBottom: 20 },

    categoryContainer: { marginBottom: 25 },
    catHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    catTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold' },

    card: { borderRadius: 12, overflow: 'hidden' },

    accordionItem: { borderBottomWidth: 1, borderBottomColor: '#333' },
    accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    questionText: { fontSize: 14, fontFamily: 'Poppins_500Medium', flex: 1, marginRight: 10 },
    accordionBody: { padding: 15, paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.2)' },
    answerText: { fontSize: 13, fontFamily: 'Poppins_400Regular', lineHeight: 20 },

    contactSection: { alignItems: 'center', marginTop: 20 },
    sectionTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 15 },
    contactBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 30, marginBottom: 15 },
    contactBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    reportBtn: { padding: 10 },
    reportBtnText: { fontSize: 14, fontFamily: 'Poppins_400Regular', textDecorationLine: 'underline' }
});
