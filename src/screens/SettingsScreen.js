import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';

const COLORS = {
    background: "#000",
    card: "#1C1C1E",
    text: "#FFF",
    subText: "#888",
    primary: "#CCFF00",
    danger: "#FF3B30",
    border: "#333"
};

export default function SettingsScreen({ navigation }) {
    // 1. Get Logout Function
    const { userData, logout } = useUser();

    // 2. Safe Data Access (prevents crash if loading)
    const isPro = userData?.isPro || false;
    const unitSystem = userData?.unitSystem || 'metric';

    const handleManageSubscription = () => {
        if (!isPro) {
            Alert.alert("Free Plan", "Upgrade to Pro to manage subscription.");
            return;
        }
        const url = Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
        Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open settings."));
    };

    // 3. Updated Logout Logic (Async)
    const handleLogout = () => {
        Alert.alert("Log Out", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log Out",
                style: "destructive",
                onPress: async () => {
                    if (logout) await logout(); // Wait for Firebase

                    // Reset to Welcome Screen
                    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                }
            }
        ]);
    };

    const SettingsRow = ({ icon, label, value, onPress, isDestructive = false, isHighlight = false }) => (
        <TouchableOpacity style={styles.row} onPress={onPress}>
            <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: isDestructive ? 'rgba(255,59,48,0.1)' : (isHighlight ? 'rgba(204, 255, 0, 0.1)' : '#333') }]}>
                    <Ionicons name={icon} size={18} color={isDestructive ? COLORS.danger : (isHighlight ? COLORS.primary : '#FFF')} />
                </View>
                <Text style={[styles.rowLabel, { color: isDestructive ? COLORS.danger : (isHighlight ? COLORS.primary : COLORS.text) }]}>{label}</Text>
            </View>
            <View style={styles.rowRight}>
                {value && <Text style={styles.rowValue}>{value}</Text>}
                <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <Text style={styles.sectionTitle}>MEMBERSHIP</Text>
                <View style={styles.sectionContainer}>
                    <SettingsRow icon="star" label="Manage Subscription" value={isPro ? "Pro" : "Free"} onPress={handleManageSubscription} />
                </View>

                <Text style={styles.sectionTitle}>ACCOUNT</Text>
                <View style={styles.sectionContainer}>
                    <SettingsRow icon="person" label="Edit Profile" onPress={() => navigation.navigate('EditProfile')} />

                    <SettingsRow
                        icon="gift"
                        label="Refer & Earn"
                        isHighlight={true}
                        onPress={() => navigation.navigate('Referral')}
                    />

                    <SettingsRow icon="lock-closed" label="Privacy Controls" onPress={() => navigation.navigate('PrivacyControls')} />
                    <SettingsRow icon="stats-chart" label="Personal Records" onPress={() => navigation.navigate('Achievements')} />
                </View>

                <Text style={styles.sectionTitle}>PREFERENCES</Text>
                <View style={styles.sectionContainer}>
                    <SettingsRow icon="notifications" label="Notifications" onPress={() => navigation.navigate('SettingsDetail', { type: 'notifications' })} />
                    <SettingsRow icon="options" label="Units of Measure" value={unitSystem === 'imperial' ? 'Miles' : 'KM'} onPress={() => navigation.navigate('SettingsDetail', { type: 'units' })} />
                </View>

                <Text style={styles.sectionTitle}>SUPPORT</Text>
                <View style={styles.sectionContainer}>
                    <SettingsRow icon="help-buoy" label="Help Center" onPress={() => navigation.navigate('HelpCenter')} />
                    <SettingsRow icon="information-circle" label="About Ruvo" onPress={() => navigation.navigate('SettingsDetail', { type: 'About' })} />
                    <SettingsRow icon="log-out" label="Log Out" isDestructive={true} onPress={handleLogout} />
                </View>

                <Text style={styles.versionText}>Ruvo App v1.0.2</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    headerTitle: { fontSize: 18, color: '#FFF', fontFamily: 'Poppins_700Bold' },
    content: { padding: 20, paddingBottom: 50 },
    sectionTitle: { color: COLORS.subText, fontSize: 12, fontWeight: '700', marginBottom: 10, marginTop: 10, marginLeft: 10, letterSpacing: 1 },
    sectionContainer: { backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    rowLeft: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    rowLabel: { fontSize: 16, fontWeight: '500' },
    rowRight: { flexDirection: 'row', alignItems: 'center' },
    rowValue: { color: COLORS.subText, fontSize: 14, marginRight: 8 },
    versionText: { textAlign: 'center', color: '#444', fontSize: 12, marginTop: 10 }
});