import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    const { userData, updateUserProfile } = useUser();
    const { type } = route.params;

    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
        const toggleSwitch = (key) => {
            const currentSettings = userData.notificationSettings || {};
            updateUserProfile({ notificationSettings: { ...currentSettings, [key]: !currentSettings[key] } });
        };
        const settings = userData.notificationSettings || { workoutReminders: true, clubUpdates: false, tips: true };

        const NotifRow = ({ label, value, onToggle }) => (
            <View style={styles.switchRow}>
                <Text style={[styles.rowLabel, {color: theme.colors.text}]}>{label}</Text>
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
                    <NotifRow label="Club Updates" value={settings.clubUpdates} onToggle={() => toggleSwitch('clubUpdates')} />
                    <View style={styles.divider} />
                    <NotifRow label="Daily Tips" value={settings.tips} onToggle={() => toggleSwitch('tips')} />
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
            setIsLoading(true);
            setTimeout(() => {
                updateUserProfile({ goal: '5k', savedGoal: null, isTransitionWeek: false, runHistory: [] });
                setIsLoading(false);
                Alert.alert("Success", "Plan reset.");
            }, 2000);
        };
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="construct-outline" size={80} color={COLORS.accent} style={{marginBottom: 20}} />
                <Text style={[styles.pageHeading, {textAlign: 'center', color: theme.colors.text}]}>Recalibrate AI?</Text>
                <Text style={[styles.helperText, {textAlign: 'center', marginBottom: 40}]}>This will analyze your recent performance and completely rebuild your upcoming schedule.</Text>
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
               <TouchableOpacity style={styles.faqItem} onPress={() => Linking.openURL('mailto:support@ruvo.app')}>
                   <View><Text style={[styles.question, { color: theme.colors.text }]}>Contact Support</Text></View>
                   <Ionicons name="mail-outline" size={20} color="#666" />
               </TouchableOpacity>
           </View>
        </ScrollView>
    );

    const renderAbout = () => (
        <ScrollView contentContainerStyle={styles.scrollContent}>
           <View style={styles.logoContainer}>
               <View style={[styles.logoBox, { backgroundColor: '#000' }]}>
                 <Image source={require('../../assets/ruvo_icon.png')} style={styles.logoImageInBox} resizeMode="contain" />
               </View>
               <Text style={[styles.appName, { color: theme.colors.text }]}>RUVO</Text>
               <Text style={[styles.appVersion, { color: theme.colors.subText }]}>v1.0.2</Text>
           </View>
           <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
               <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://www.google.com/search?q=terms')}> 
                   <Text style={[styles.linkText, { color: theme.colors.text }]}>Terms of Service</Text>
                   <Ionicons name="open-outline" size={18} color={theme.colors.subText} />
               </TouchableOpacity>
               <View style={styles.divider} />
               <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://www.google.com/search?q=privacy')}>
                   <Text style={[styles.linkText, { color: theme.colors.text }]}>Privacy Policy</Text>
                   <Ionicons name="open-outline" size={18} color={theme.colors.subText} />
               </TouchableOpacity>
           </View>
        </ScrollView>
    );

    const renderPassword = () => (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={[styles.card, { backgroundColor: theme.colors.card, padding: 20 }]}>
                <Text style={[styles.label, { color: theme.colors.subText }]}>New Password</Text>
                <View style={styles.inputWrapper}>
                    <TextInput style={[styles.input, { color: theme.colors.text }]} secureTextEntry value={newPass} onChangeText={setNewPass} placeholder="******" placeholderTextColor="#555"/>
                </View>
                <TouchableOpacity style={styles.saveBtnMain} onPress={() => Alert.alert("Success", "Password Updated")}>
                    <Text style={styles.saveBtnText}>Update Password</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

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
                    <View style={{width: 24}} />
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
    saveBtnMain: { backgroundColor: COLORS.accent, paddingVertical: 16, borderRadius: 30, alignItems: 'center', width: '100%', shadowColor: COLORS.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width:0, height:4} },
    saveBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    logoContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
    logoBox: { width: 80, height: 80, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent, marginBottom: 15 },
    logoImageInBox: { width: 60, height: 60 }, 
    appName: { fontSize: 24, fontFamily: 'Poppins_700Bold', letterSpacing: 2 },
    appVersion: { fontSize: 14, fontFamily: 'Poppins_400Regular', marginTop: 5 },
    linkText: { fontSize: 16, fontFamily: 'Poppins_500Medium' },
    copyright: { textAlign: 'center', color: '#666', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 20 },
    question: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', marginBottom: 2 },
});