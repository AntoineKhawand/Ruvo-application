import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { updatePassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import * as StoreReview from 'expo-store-review';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, Share, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';

const COLORS = {
    primary: "#000000",
    secondary: "#1C1C1E",
    accent: "#CCFF00",
    danger: "#FF3B30",
    text: "#FFFFFF",
    subText: "#888888",
    border: "#333333"
};

export default function SettingsDetailScreen({ route, navigation }) {
    const { theme } = useTheme();
    const { userData, updateUserProfile, logSensitiveAction } = useUser();
    const { type } = route.params;

    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // --- DYNAMIC ABOUT CONFIG STATE ---
    const [aboutConfig, setAboutConfig] = useState({
        version: Constants.expoConfig?.version || '1.0.0',
        description: "Ruvo is the AI-powered running coach that adapts to you. Whether you're chasing a generic 5k or a sub-3 marathon, Ruvo builds the perfect plan.",
        legal: {
            termsUrl: 'https://www.ruvo.run/terms',
            privacyUrl: 'https://www.ruvo.run/privacy'
        },
        socials: {
            instagram: 'https://www.instagram.com/ruvoapp/',
            facebook: 'https://www.facebook.com/ruvoapp',
            website: 'https://www.ruvo.run',
            email: 'admin@ruvo.run'
        },
        store: {
            appStore: 'https://apps.apple.com/app/ruvo/id123456789',
            playStore: 'https://play.google.com/store/apps/details?id=com.ruvo.app'
        }
    });

    // --- FETCH SYSTEM CONFIG ---
    useEffect(() => {
        if (type === 'About') {
            const fetchSystemConfig = async () => {
                try {
                    const docRef = doc(db, 'system', 'app_config');
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setAboutConfig(prev => ({
                            ...prev,
                            description: data.aboutDescription || prev.description,
                            legal: { ...prev.legal, ...data.legal },
                            socials: { ...prev.socials, ...data.socials },
                            store: { ...prev.store, ...data.store },
                            activeVersion: data.activeVersion
                        }));
                    }
                } catch (error) {
                    if (error.code === 'permission-denied') {
                        console.log("System config: Access denied (using default config).");
                    } else {
                        console.log("Error fetching system config:", error);
                    }
                }
            };
            fetchSystemConfig();
        }
    }, [type]);


    // --- HEADER TITLES ---
    const getHeaderTitle = () => {
        if (type === 'units') return "Units of Measure";
        if (type === 'notifications') return "Notifications";
        if (type === 'regenerate') return "Regenerate Plan";
        if (type === 'Help') return "Help Center";
        if (type === 'About') return "About Ruvo";
        if (type === 'Password') return "Change Password";
        return 'Settings';
    };

    // --- RENDERERS ---
    const renderNotifications = () => {
        const toggleSwitch = async (key) => {
            const currentSettings = userData.notificationSettings || {};
            try {
                await updateUserProfile({ notificationSettings: { ...currentSettings, [key]: !currentSettings[key] } });
            } catch (error) {
                Alert.alert("Error", "Could not save notification setting.");
            }
        };
        const settings = userData.notificationSettings || { workoutReminders: true, clubUpdates: false, tips: true };

        const NotifRow = ({ label, value, onToggle }) => (
            <View style={styles.switchRow}>
                <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text>
                {/* FIX: Changed thumbColor to White (#FFF) so it doesn't look like a black hole */}
                <Switch
                    trackColor={{ false: "#333", true: COLORS.accent }}
                    thumbColor="#FFF"
                    onValueChange={onToggle}
                    value={value}
                />
            </View>
        );

        return (
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    <NotifRow label="Workout Reminders" value={settings.workoutReminders} onToggle={() => toggleSwitch('workoutReminders')} />
                    <View style={styles.divider} />
                    <NotifRow label="Daily Tips" value={settings.tips} onToggle={() => toggleSwitch('tips')} />
                </View>

                <Text style={[styles.sectionTitle, { marginLeft: 5, marginBottom: 10, marginTop: 20, color: theme.colors.subText }]}>COMMUNITY</Text>
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    <NotifRow label="New Followers" value={settings.newFollowers !== false} onToggle={() => toggleSwitch('newFollowers')} />
                    <View style={styles.divider} />
                    <NotifRow label="Likes & Comments" value={settings.communityActivity !== false} onToggle={() => toggleSwitch('communityActivity')} />
                    <View style={styles.divider} />
                    <NotifRow label="Club Updates" value={settings.clubUpdates} onToggle={() => toggleSwitch('clubUpdates')} />
                </View>
                <Text style={styles.helperText}>System permissions are required for push notifications.</Text>
            </ScrollView>
        );
    };

    const renderUnits = () => {
        const currentUnit = userData.unitSystem || 'metric';
        const handleSelect = (unit) => { updateUserProfile({ unitSystem: unit }); };
        const UnitRow = ({ label, value, isSelected }) => (
            <TouchableOpacity style={styles.selectionRow} onPress={() => handleSelect(value)}>
                <Text style={[styles.selectionText, { color: theme.colors.text }]}>{label}</Text>
                {isSelected && <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />}
            </TouchableOpacity>
        );
        return (
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    <UnitRow label="Metric (Kilometers, km)" value="metric" isSelected={currentUnit === 'metric'} />
                    <View style={styles.divider} />
                    <UnitRow label="Imperial (Miles, mi)" value="imperial" isSelected={currentUnit === 'imperial'} />
                </View>
                <Text style={styles.helperText}>This affects how distance and pace are displayed throughout the app.</Text>
            </ScrollView>
        );
    };

    const renderRegenerate = () => {
        const handleReset = () => {
            Alert.alert(
                "Regenerate AI Plan",
                "Are you sure you want to recalculate your training plan? This will change your upcoming schedule based on recent performance.",
                [
                    { text: "Cancel", style: "cancel" },
                    { 
                        text: "Yes, Regenerate", 
                        style: "destructive",
                        onPress: async () => {
                            setIsLoading(true);
                            try {
                                await updateUserProfile({ goal: '5k', savedGoal: null, isTransitionWeek: false });
                                Alert.alert("Success", "Your run plan has been recalibrated.");
                            } catch (error) {
                                Alert.alert("Error", "Could not regenerate plan. Please try again.");
                            } finally {
                                setIsLoading(false);
                            }
                        }
                    }
                ]
            );
        };
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="construct-outline" size={80} color={COLORS.accent} style={{ marginBottom: 20 }} />
                <Text style={[styles.pageHeading, { textAlign: 'center', color: theme.colors.text }]}>Recalibrate AI?</Text>
                <Text style={[styles.helperText, { textAlign: 'center', marginBottom: 40 }]}>This will analyze your recent performance and completely rebuild your upcoming schedule.</Text>
                <TouchableOpacity style={styles.saveBtnMain} onPress={handleReset} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Regenerate Plan</Text>}
                </TouchableOpacity>
            </View>
        );
    };

    const renderHelp = () => (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.pageHeading, { color: theme.colors.text }]}>Help Center</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                <TouchableOpacity style={styles.faqItem} onPress={() => Linking.openURL('https://support.google.com')}>
                    <View><Text style={[styles.question, { color: theme.colors.text }]}>GPS Troubleshooting</Text></View>
                    <Ionicons name="open-outline" size={20} color="#666" />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.faqItem} onPress={() => Linking.openURL('mailto:support@ruvo.run')}>
                    <View><Text style={[styles.question, { color: theme.colors.text }]}>Contact Support</Text></View>
                    <Ionicons name="mail-outline" size={20} color="#666" />
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    const onShareApp = async () => {
        try {
            const storeUrl = Platform.OS === 'ios' 
                ? (aboutConfig.store?.appStore || 'https://apps.apple.com/app/ruvo/id123456789')
                : (aboutConfig.store?.playStore || 'https://play.google.com/store/apps/details?id=com.ruvo.app');
            
            const message = `Check out Ruvo, the AI running coach that adapts to you! Download: ${storeUrl}`;
            
            await Share.share({
                message: message,
                title: 'Share Ruvo'
            });
        } catch (error) {
            Alert.alert(error.message);
        }
    };

    const onRateApp = async () => {
        try {
            const isAvailable = await StoreReview.isAvailableAsync();
            if (isAvailable) {
                await StoreReview.requestReview();
            } else {
                // Fallback for platforms that don't support it
                const url = Platform.OS === 'ios'
                    ? 'https://apps.apple.com/app/ruvo/id123456789'
                    : 'https://play.google.com/store/apps/details?id=com.ruvo.app';
                Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open store."));
            }
        } catch (error) {
            // Silently fail, show placeholder
            Alert.alert("Thank You!", "We appreciate your feedback.");
        }
    };

    const renderAbout = () => (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.logoContainer}>
                <Image source={require('../../assets/images/Ruvo Logo Original.png')} style={styles.logoImageInBox} resizeMode="contain" />
                <Text style={[styles.appVersion, { color: theme.colors.subText }]}>
                    v{aboutConfig.version} {aboutConfig.activeVersion ? `(Latest: ${aboutConfig.activeVersion})` : ''}
                </Text>

                <View style={styles.aboutDescriptionContainer}>
                    <Text style={styles.aboutDescriptionText}>
                        {aboutConfig.description}
                    </Text>
                </View>
            </View>

            {/* --- ACTION BUTTONS (Share / Rate) --- */}
            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton} onPress={onShareApp}>
                    <Ionicons name="share-social" size={20} color="#000" />
                    <Text style={styles.actionButtonText}>Share App</Text>
                </TouchableOpacity>
                <View style={{ width: 15 }} />
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#333' }]} onPress={onRateApp}>
                    <Ionicons name="star" size={20} color={COLORS.accent} />
                    <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Rate Us</Text>
                </TouchableOpacity>
            </View>

            {/* --- SOCIAL LINKS --- */}
            <Text style={[styles.sectionTitle, { marginLeft: 5, marginBottom: 15, marginTop: 30, color: theme.colors.subText }]}>CONNECT WITH US</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20 }]}>
                <TouchableOpacity onPress={() => Linking.openURL(aboutConfig.socials.instagram)}>
                    <MaterialCommunityIcons name="instagram" size={30} color="#E1306C" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(aboutConfig.socials.website)}>
                    <MaterialCommunityIcons name="web" size={30} color={COLORS.accent} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${aboutConfig.socials.email || 'admin@ruvo.run'}`)}>
                    <Ionicons name="mail" size={30} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* --- LEGAL LINKS --- */}
            <Text style={[styles.sectionTitle, { marginLeft: 5, marginBottom: 15, marginTop: 10, color: theme.colors.subText }]}>LEGAL</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(aboutConfig.legal.termsUrl)}>
                    <Text style={[styles.linkText, { color: theme.colors.text }]}>Terms of Service</Text>
                    <Ionicons name="open-outline" size={18} color={theme.colors.subText} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(aboutConfig.legal.privacyUrl)}>
                    <Text style={[styles.linkText, { color: theme.colors.text }]}>Privacy Policy</Text>
                    <Ionicons name="open-outline" size={18} color={theme.colors.subText} />
                </TouchableOpacity>
                <View style={styles.divider} />
                {/* Credits / Licenses */}
                <TouchableOpacity style={styles.linkRow} onPress={() => Alert.alert("Open Source Licenses", "This section lists the open source libraries used to build Ruvo (e.g. React Native, Expo, Firebase).")}>
                    <Text style={[styles.linkText, { color: theme.colors.text }]}>Licenses</Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.subText} />
                </TouchableOpacity>
            </View>
            <Text style={styles.copyright}>© {new Date().getFullYear()} Ruvo Inc. All rights reserved.</Text>
            <View style={{ height: 50 }} />
        </ScrollView>
    );

    const renderPassword = () => {
        const handlePasswordReset = async () => {
            if (!newPass || newPass.length < 6) {
                return Alert.alert("Error", "Password must be at least 6 characters long.");
            }
            setIsLoading(true);
            try {
                if (auth.currentUser) {
                    await updatePassword(auth.currentUser, newPass);

                    if (logSensitiveAction) await logSensitiveAction("PASSWORD_CHANGE");

                    Alert.alert("Success", "Password Updated Successfully");
                    setNewPass('');
                } else {
                    Alert.alert("Error", "You must be signed in to change your password.");
                }
            } catch (error) {
                console.error("Password update error:", error);

                // Handle specific Firebase re-auth required error
                if (error.code === 'auth/requires-recent-login') {
                    Alert.alert("Re-authentication Required", "For your security, please log out and log back in before changing your password.");
                } else {
                    Alert.alert("Error", error.message);
                }
            } finally {
                setIsLoading(false);
            }
        };

        return (
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={[styles.card, { backgroundColor: theme.colors.card, padding: 20 }]}>
                    <Text style={[styles.label, { color: theme.colors.subText }]}>New Password</Text>
                    <View style={styles.inputWrapper}>
                        <TextInput style={[styles.input, { color: theme.colors.text }]} secureTextEntry value={newPass} onChangeText={setNewPass} placeholder="******" placeholderTextColor="#555" />
                    </View>
                    <TouchableOpacity style={styles.saveBtnMain} onPress={handlePasswordReset} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Update Password</Text>}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    const renderContent = () => {
        switch (type) {
            case 'notifications': return renderNotifications();
            case 'units': return renderUnits();
            // Language case removed
            case 'regenerate': return renderRegenerate();
            case 'Help': return renderHelp();
            case 'About': return renderAbout();
            case 'Password': return renderPassword();
            default: return <View />;
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            <SafeAreaView style={{ flex: 1 }}>
                <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: theme.colors.text }]}>{getHeaderTitle()}</Text>
                    <View style={{ width: 24 }} />
                </View>
                {renderContent()}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    title: { fontSize: 18, fontFamily: 'Poppins_700Bold' },
    scrollContent: { padding: 20 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    card: { borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
    divider: { height: 1, backgroundColor: '#333', marginLeft: 16 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    selectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
    linkRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 18, alignItems: 'center' },
    faqItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    rowLabel: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', marginBottom: 2 },
    rowDesc: { fontSize: 12, fontFamily: 'Poppins_400Regular', lineHeight: 16 },
    selectionText: { fontSize: 16, fontFamily: 'Poppins_500Medium' },
    helperText: { color: '#666', fontSize: 12, marginTop: 5, marginLeft: 5, lineHeight: 18 },
    pageHeading: { fontSize: 24, fontFamily: 'Poppins_700Bold', marginBottom: 20 },
    label: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginBottom: 8, marginTop: 10, textTransform: 'uppercase' },
    inputWrapper: { backgroundColor: '#222', borderRadius: 8, height: 50, justifyContent: 'center', paddingHorizontal: 15, marginBottom: 10 },
    input: { fontFamily: 'Poppins_500Medium', fontSize: 16 },
    saveBtnMain: { backgroundColor: COLORS.accent, paddingVertical: 16, borderRadius: 30, alignItems: 'center', width: '100%', shadowColor: COLORS.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    saveBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    logoContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
    logoImageInBox: { width: 160, height: 50, marginBottom: 12 },
    appVersion: { fontSize: 14, fontFamily: 'Poppins_400Regular', marginTop: 5 },
    linkText: { fontSize: 16, fontFamily: 'Poppins_500Medium' },
    copyright: { textAlign: 'center', color: '#666', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 20 },
    question: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', marginBottom: 2 },
    sectionTitle: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1, textTransform: 'uppercase' },

    // --- NEW STYLES FOR ABOUT SECTION ---
    aboutDescriptionContainer: {
        marginTop: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    aboutDescriptionText: {
        color: '#CCC',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        fontFamily: 'Poppins_400Regular'
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 10
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: COLORS.accent,
        paddingVertical: 14,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionButtonText: {
        color: '#000',
        fontFamily: 'Poppins_700Bold',
        fontSize: 14,
        marginLeft: 8
    }
});