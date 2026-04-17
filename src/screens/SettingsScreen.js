import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { checkHardwareSupport, disableBiometricLogin, isBiometricEnabled } from '../utils/authStorage';
import { whoopService } from '../services/whoopService';
import { ouraService } from '../services/ouraService';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../config/firebase';
import { lightTap } from '../utils/haptics';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

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
    // 1. Get Logout & Delete Function
    const { userData, logout, deleteAccount, isLoading } = useUser();

    // 2. Safe Data Access (prevents crash if loading)
    const isPro = userData?.isPro || false;
    const unitSystem = userData?.unitSystem || 'metric';

    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [hardwareSupported, setHardwareSupported] = useState(false);

    useEffect(() => {
        const checkBioStatus = async () => {
            const hasHardware = await checkHardwareSupport();
            setHardwareSupported(hasHardware);
            if (hasHardware) {
                const isEnabled = await isBiometricEnabled();
                setBiometricEnabled(isEnabled);
            }
        };
        checkBioStatus();
    }, []);

    const toggleBiometrics = async () => {
        if (biometricEnabled) {
            // Disable
            await disableBiometricLogin();
            setBiometricEnabled(false);
            Alert.alert("Biometrics Disabled", "You will need to use your password to log in.");
        } else {
            // Enable - We don't have the password perfectly stored here, 
            // but we can prompt the user to re-login to enable it fully if needed,
            // or simply use what we have if we passed it down.
            // Since we use Firebase Auth natively, we can prompt for Biometrics to verify before "enabling"
            Alert.alert(
                "Enable Biometrics",
                "Log out and log back in, then check 'Enable Face ID / Touch ID' to link your credentials securely.",
                [{ text: "OK" }]
            );
        }
    };

    const handleManageSubscription = () => {
        if (!isPro) {
            Alert.alert("Free Plan", "Upgrade to Pro to manage subscription.");
            return;
        }
        const url = Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
        Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open settings."));
    };

    const isWhoopConnected = !!userData?.whoopData;
    const isOuraConnected = !!userData?.ouraData;

    const handleOuraConnect = async () => {
        if (!isPro) {
            navigation.navigate('Paywall');
            return;
        }

        if (isOuraConnected) {
            Alert.alert("Disconnect Oura", "Are you sure you want to disconnect?", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Disconnect",
                    style: "destructive",
                    onPress: async () => {
                        await ouraService.disconnect();
                        await updateDoc(doc(db, "users", userData.uid), { ouraData: deleteField() });
                    }
                }
            ]);
        } else {
            const success = await ouraService.authenticate();
            if (success) {
                Alert.alert("Success", "Oura connected successfully and data synced!");
            } else {
                Alert.alert("Error", "Could not connect to Oura.");
            }
        }
    };

    const handleWhoopConnect = async () => {
        if (!isPro) {
            navigation.navigate('Paywall');
            return;
        }

        if (isWhoopConnected) {
            Alert.alert("Disconnect Whoop", "Are you sure you want to disconnect?", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Disconnect",
                    style: "destructive",
                    onPress: async () => {
                        await whoopService.disconnect();
                        await updateDoc(doc(db, "users", userData.uid), { whoopData: deleteField() });
                    }
                }
            ]);
        } else {
            const success = await whoopService.authenticate();
            if (success) {
                Alert.alert("Success", "Whoop connected successfully and data synced!");
            } else {
                Alert.alert("Error", "Could not connect to Whoop.");
            }
        }
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
                    // App.js automatically handles swapping to the Welcome stack when auth changes.
                }
            }
        ]);
    };

    const handleDownloadData = async () => {
        lightTap();
        try {
            // Try Cloud Function first
            const exportUserData = httpsCallable(functions, 'exportUserData');
            const result = await exportUserData();
            const json = JSON.stringify(result.data, null, 2);
            const fileUri = FileSystem.cacheDirectory + 'ruvo_data_export.json';
            await FileSystem.writeAsStringAsync(fileUri, json);
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Your Ruvo Data Export' });
            } else {
                Alert.alert("Export Ready", `Data saved to: ${fileUri}`);
            }
        } catch (e) {
            // Fallback: export local userData directly
            try {
                const userDataString = JSON.stringify(userData, null, 2);
                const fileUri = FileSystem.cacheDirectory + 'ruvo_data_export.json';
                await FileSystem.writeAsStringAsync(fileUri, userDataString);
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Your Ruvo Data Export' });
                } else {
                    Alert.alert("Export Ready", `Data saved to: ${fileUri}`);
                }
            } catch (fallbackError) {
                Alert.alert("Export Failed", "Could not export your data. Please try again later.");
            }
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account",
            "This action is completely irreversible. All your tracking data, gear, subscriptions, and profile information will be permanently erased.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Permanently Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            if (deleteAccount) await deleteAccount();
                            // App.js automatically handles routing when auth state becomes null
                        } catch (e) {
                            // Error is handled in context
                        }
                    }
                }
            ]
        );
    };

    const SettingsRow = ({ icon, label, value, onPress, isDestructive = false, isHighlight = false }) => (
        <TouchableOpacity activeOpacity={0.7} style={styles.row} onPress={(e) => { lightTap(); if (onPress) onPress(e); }}>
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
                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
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
                    <SettingsRow icon="shield-checkmark" label="Two-Factor Auth (2FA)" onPress={() => navigation.navigate('2FASetup')} />
                    <SettingsRow icon="stats-chart" label="Personal Records" onPress={() => navigation.navigate('Achievements')} />

                    {hardwareSupported && (
                        <SettingsRow
                            icon="finger-print"
                            label={`Face ID/Touch ID`}
                            value={biometricEnabled ? "Enabled" : "Disabled"}
                            onPress={toggleBiometrics}
                        />
                    )}
                </View>

                <Text style={styles.sectionTitle}>CONNECTED DEVICES</Text>
                <View style={styles.sectionContainer}>
                    <SettingsRow
                        icon="hardware-chip"
                        label="Manage Devices"
                        onPress={() => navigation.navigate('ConnectedDevices')}
                    />
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
                    <SettingsRow icon="download-outline" label="Download My Data" onPress={handleDownloadData} />
                    <SettingsRow icon="log-out" label="Log Out" onPress={handleLogout} />
                    <SettingsRow icon="trash" label="Delete Account" isDestructive={true} onPress={handleDeleteAccount} />
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