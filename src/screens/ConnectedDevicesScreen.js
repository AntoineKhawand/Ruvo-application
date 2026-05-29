import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { whoopService } from '../services/whoopService';
import { ouraService } from '../services/ouraService';
import { lightTap } from '../utils/haptics';

const ACCENT = '#CCFF00';

const StatChip = ({ label, value, color = ACCENT }) => (
    <View style={styles.statChip}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const ConnectButton = ({ connected, onConnect, onDisconnect, loading, isPro }) => {
    if (loading) return (
        <View style={styles.btnLoading}>
            <ActivityIndicator size="small" color={ACCENT} />
        </View>
    );
    if (connected) return (
        <TouchableOpacity style={styles.btnDisconnect} onPress={onDisconnect} activeOpacity={0.7}>
            <Text style={styles.btnDisconnectText}>Disconnect</Text>
        </TouchableOpacity>
    );
    return (
        <TouchableOpacity style={styles.btnConnect} onPress={onConnect} activeOpacity={0.7}>
            <LinearGradient colors={[ACCENT, '#AACC00']} style={styles.btnConnectGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.btnConnectText}>{isPro ? 'Connect' : 'Upgrade to Connect'}</Text>
            </LinearGradient>
        </TouchableOpacity>
    );
};

export default function ConnectedDevicesScreen({ navigation }) {
    const { userData } = useUser();
    const isPro = userData?.isPro || false;

    const [connectingDevice, setConnectingDevice] = useState(null);
    const [syncingDevice, setSyncingDevice] = useState(null);

    const whoopData = userData?.whoopData;
    const ouraData = userData?.ouraData;
    const isWhoopConnected = !!whoopData;
    const isOuraConnected = !!ouraData;

    useFocusEffect(useCallback(() => {
        setConnectingDevice(null);
        setSyncingDevice(null);
    }, []));

    const handleConnectWhoop = async () => {
        if (!isPro) { navigation.navigate('Paywall'); return; }
        const clientId = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID;
        if (!clientId || clientId.includes('your_whoop')) {
            Alert.alert('Whoop Not Available', 'Whoop integration requires API configuration. Please contact support.', [{ text: 'OK' }]);
            return;
        }
        lightTap();
        setConnectingDevice('whoop');
        try {
            const success = await whoopService.authenticate();
            Alert.alert(success ? 'Connected!' : 'Error', success ? 'Whoop connected and data synced!' : 'Could not connect to Whoop. Please try again.');
        } catch { Alert.alert('Error', 'An unexpected error occurred.'); }
        finally { setConnectingDevice(null); }
    };

    const handleConnectOura = async () => {
        if (!isPro) { navigation.navigate('Paywall'); return; }
        const clientId = process.env.EXPO_PUBLIC_OURA_CLIENT_ID;
        if (!clientId || clientId.includes('your_oura')) {
            Alert.alert('Oura Not Available', 'Oura Ring integration requires API configuration. Please contact support.', [{ text: 'OK' }]);
            return;
        }
        lightTap();
        setConnectingDevice('oura');
        try {
            const success = await ouraService.authenticate();
            Alert.alert(success ? 'Connected!' : 'Error', success ? 'Oura Ring connected and data synced!' : 'Could not connect to Oura. Please try again.');
        } catch { Alert.alert('Error', 'An unexpected error occurred.'); }
        finally { setConnectingDevice(null); }
    };

    const handleDisconnectWhoop = () => {
        lightTap();
        Alert.alert('Disconnect Whoop', 'Remove Whoop from your account?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disconnect', style: 'destructive', onPress: async () => {
                setConnectingDevice('whoop');
                try {
                    await whoopService.disconnect();
                    await updateDoc(doc(db, 'users', userData.uid), { whoopData: deleteField() });
                } catch { Alert.alert('Error', 'Could not disconnect Whoop.'); }
                finally { setConnectingDevice(null); }
            }}
        ]);
    };

    const handleDisconnectOura = () => {
        lightTap();
        Alert.alert('Disconnect Oura Ring', 'Remove Oura Ring from your account?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disconnect', style: 'destructive', onPress: async () => {
                setConnectingDevice('oura');
                try {
                    await ouraService.disconnect();
                    await updateDoc(doc(db, 'users', userData.uid), { ouraData: deleteField() });
                } catch { Alert.alert('Error', 'Could not disconnect Oura.'); }
                finally { setConnectingDevice(null); }
            }}
        ]);
    };

    const handleSyncWhoop = async () => {
        lightTap(); setSyncingDevice('whoop');
        try {
            const ok = await whoopService.syncToCloud();
            Alert.alert(ok ? 'Synced!' : 'Sync Failed', ok ? 'Whoop data refreshed.' : 'Could not refresh. Try again.');
        } catch { Alert.alert('Error', 'Unexpected error during sync.'); }
        finally { setSyncingDevice(null); }
    };

    const handleSyncOura = async () => {
        lightTap(); setSyncingDevice('oura');
        try {
            const ok = await ouraService.syncToCloud();
            Alert.alert(ok ? 'Synced!' : 'Sync Failed', ok ? 'Oura data refreshed.' : 'Could not refresh. Try again.');
        } catch { Alert.alert('Error', 'Unexpected error during sync.'); }
        finally { setSyncingDevice(null); }
    };


    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => { lightTap(); navigation.goBack(); }} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={22} color="#FFF" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Connected Devices</Text>
                    <Text style={styles.headerSub}>Sync your wearables & health data</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* HEALTH HUB CARD */}
                <Text style={styles.sectionLabel}>HEALTH PLATFORM</Text>
                <LinearGradient colors={['#1A1A1A', '#111']} style={styles.hubCard}>
                    <View style={styles.hubTop}>
                        <View style={styles.hubIconBox}>
                            <MaterialCommunityIcons name="google-fit" size={28} color="#4CD964" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={styles.hubTitle}>Google Health Connect</Text>
                            <Text style={styles.hubDesc}>Your universal health data hub</Text>
                        </View>
                        <View style={styles.activeBadge}>
                            <View style={styles.activeDot} />
                            <Text style={styles.activeText}>Active</Text>
                        </View>
                    </View>
                    <View style={styles.hubDivider} />
                    <Text style={styles.hubCompatLabel}>COMPATIBLE WEARABLES</Text>
                    <View style={styles.brandRow}>
                        {['Garmin', 'Samsung', 'Fitbit', 'Polar', 'Coros', 'Suunto'].map(b => (
                            <View key={b} style={styles.brandChip}>
                                <Text style={styles.brandChipText}>{b}</Text>
                            </View>
                        ))}
                    </View>
                </LinearGradient>

                {/* PREMIUM DEVICES */}
                <View style={styles.premiumRow}>
                    <Text style={styles.sectionLabel}>PREMIUM DEVICES</Text>
                    <View style={styles.proBadge}>
                        <Ionicons name="star" size={9} color="#000" style={{ marginRight: 3 }} />
                        <Text style={styles.proBadgeText}>PRO ONLY</Text>
                    </View>
                </View>

                {/* WHOOP CARD */}
                <View style={styles.deviceCard}>
                    <LinearGradient colors={['#1E1E1E', '#161616']} style={styles.deviceCardInner}>
                        <View style={styles.deviceTop}>
                            <View style={[styles.deviceIconBox, { backgroundColor: '#111', borderColor: '#333' }]}>
                                <Text style={styles.whoopLetter}>W</Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <View style={styles.nameRow}>
                                    <Text style={styles.deviceName}>Whoop</Text>
                                    {isWhoopConnected && <View style={styles.connectedDot} />}
                                </View>
                                <Text style={styles.deviceDesc}>Recovery · HRV · Strain · Sleep</Text>
                            </View>
                            {isWhoopConnected && (
                                <TouchableOpacity onPress={handleSyncWhoop} style={styles.syncBtn} activeOpacity={0.7}>
                                    {syncingDevice === 'whoop'
                                        ? <ActivityIndicator size="small" color={ACCENT} />
                                        : <MaterialCommunityIcons name="sync" size={18} color={ACCENT} />}
                                </TouchableOpacity>
                            )}
                        </View>

                        {isWhoopConnected && whoopData && (
                            <View style={styles.statsRow}>
                                {whoopData.recovery != null && <StatChip label="Recovery" value={`${whoopData.recovery}%`} color="#4CD964" />}
                                {whoopData.strain != null && <StatChip label="Strain" value={whoopData.strain} color="#FF9500" />}
                                {whoopData.hrv != null && <StatChip label="HRV" value={`${whoopData.hrv}ms`} />}
                                {whoopData.sleepScore != null && <StatChip label="Sleep" value={`${whoopData.sleepScore}%`} color="#5AC8FA" />}
                            </View>
                        )}

                        {!isWhoopConnected && !isPro && (
                            <View style={styles.lockedOverlayRow}>
                                <Ionicons name="lock-closed" size={13} color="#666" />
                                <Text style={styles.lockedText}>Available with Pro subscription</Text>
                            </View>
                        )}

                        <View style={styles.deviceFooter}>
                            {isWhoopConnected && whoopData?.lastSync && (
                                <Text style={styles.lastSyncText}>
                                    Last sync: {whoopData.lastSync?.toDate ? whoopData.lastSync.toDate().toLocaleDateString() : 'recently'}
                                </Text>
                            )}
                            {!isWhoopConnected && <Text style={styles.notConnectedText}>Not connected</Text>}
                            <ConnectButton
                                connected={isWhoopConnected}
                                onConnect={handleConnectWhoop}
                                onDisconnect={handleDisconnectWhoop}
                                loading={connectingDevice === 'whoop'}
                                isPro={isPro}
                            />
                        </View>
                    </LinearGradient>
                </View>

                {/* OURA CARD */}
                <View style={styles.deviceCard}>
                    <LinearGradient colors={['#1E1E1E', '#161616']} style={styles.deviceCardInner}>
                        <View style={styles.deviceTop}>
                            <View style={[styles.deviceIconBox, { backgroundColor: '#2A2A2A', borderColor: '#444' }]}>
                                <MaterialCommunityIcons name="ring" size={24} color="#E8C97A" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <View style={styles.nameRow}>
                                    <Text style={styles.deviceName}>Oura Ring</Text>
                                    {isOuraConnected && <View style={styles.connectedDot} />}
                                </View>
                                <Text style={styles.deviceDesc}>Sleep · Readiness · HRV</Text>
                            </View>
                            {isOuraConnected && (
                                <TouchableOpacity onPress={handleSyncOura} style={styles.syncBtn} activeOpacity={0.7}>
                                    {syncingDevice === 'oura'
                                        ? <ActivityIndicator size="small" color={ACCENT} />
                                        : <MaterialCommunityIcons name="sync" size={18} color={ACCENT} />}
                                </TouchableOpacity>
                            )}
                        </View>

                        {isOuraConnected && ouraData && (
                            <View style={styles.statsRow}>
                                {ouraData.readinessScore != null && <StatChip label="Readiness" value={`${ouraData.readinessScore}%`} color="#4CD964" />}
                                {ouraData.sleepScore != null && <StatChip label="Sleep" value={`${ouraData.sleepScore}%`} color="#5AC8FA" />}
                                {ouraData.hrv != null && <StatChip label="HRV" value={`${ouraData.hrv}ms`} />}
                            </View>
                        )}

                        {!isOuraConnected && !isPro && (
                            <View style={styles.lockedOverlayRow}>
                                <Ionicons name="lock-closed" size={13} color="#666" />
                                <Text style={styles.lockedText}>Available with Pro subscription</Text>
                            </View>
                        )}

                        <View style={styles.deviceFooter}>
                            {isOuraConnected && ouraData?.lastSync && (
                                <Text style={styles.lastSyncText}>
                                    Last sync: {ouraData.lastSync?.toDate ? ouraData.lastSync.toDate().toLocaleDateString() : 'recently'}
                                </Text>
                            )}
                            {!isOuraConnected && <Text style={styles.notConnectedText}>Not connected</Text>}
                            <ConnectButton
                                connected={isOuraConnected}
                                onConnect={handleConnectOura}
                                onDisconnect={handleDisconnectOura}
                                loading={connectingDevice === 'oura'}
                                isPro={isPro}
                            />
                        </View>
                    </LinearGradient>
                </View>

                {/* UPGRADE BANNER */}
                {!isPro && (
                    <TouchableOpacity activeOpacity={0.85} onPress={() => { lightTap(); navigation.navigate('Paywall'); }}>
                        <LinearGradient colors={['rgba(204,255,0,0.12)', 'rgba(204,255,0,0.04)']} style={styles.upgradeBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <View style={styles.upgradeIconBox}>
                                <Ionicons name="flash" size={22} color="#000" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <Text style={styles.upgradeTitle}>Unlock Premium Devices</Text>
                                <Text style={styles.upgradeDesc}>Connect Whoop & Oura to power your AI Coach with real biometrics</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={ACCENT} />
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
    headerSub: { color: '#666', fontSize: 12, fontFamily: 'Poppins_400Regular', textAlign: 'center' },

    content: { paddingHorizontal: 20, paddingTop: 10 },
    sectionLabel: { color: '#555', fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 1.5, marginBottom: 12 },

    // Health Hub
    hubCard: { borderRadius: 20, padding: 18, marginBottom: 28, borderWidth: 1, borderColor: '#222' },
    hubTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    hubIconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(76,201,100,0.12)', alignItems: 'center', justifyContent: 'center' },
    hubTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    hubDesc: { color: '#666', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,201,100,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CD964', marginRight: 5 },
    activeText: { color: '#4CD964', fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    hubDivider: { height: 1, backgroundColor: '#222', marginBottom: 14 },
    hubCompatLabel: { color: '#444', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1, marginBottom: 10 },
    brandRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    brandChip: { backgroundColor: '#1E1E1E', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A' },
    brandChipText: { color: '#888', fontSize: 11, fontFamily: 'Poppins_500Medium' },

    // Section header
    premiumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    proBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: ACCENT, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    proBadgeText: { color: '#000', fontSize: 9, fontFamily: 'Poppins_700Bold' },

    // Device cards
    deviceCard: { marginBottom: 14, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
    deviceCardInner: { padding: 18 },
    deviceTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    deviceIconBox: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    whoopLetter: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    deviceName: { color: '#FFF', fontSize: 17, fontFamily: 'Poppins_700Bold' },
    connectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CD964' },
    deviceDesc: { color: '#555', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    syncBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(204,255,0,0.08)', alignItems: 'center', justifyContent: 'center' },

    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    statChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
    statValue: { fontSize: 16, fontFamily: 'Poppins_700Bold' },
    statLabel: { color: '#555', fontSize: 10, fontFamily: 'Poppins_500Medium', marginTop: 2 },

    lockedOverlayRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
    lockedText: { color: '#555', fontSize: 12, fontFamily: 'Poppins_400Regular' },

    deviceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#222', paddingTop: 14 },
    lastSyncText: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular' },
    notConnectedText: { color: '#444', fontSize: 12, fontFamily: 'Poppins_400Regular' },

    btnConnect: { borderRadius: 20, overflow: 'hidden' },
    btnConnectGradient: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    btnConnectText: { color: '#000', fontSize: 12, fontFamily: 'Poppins_700Bold' },
    btnDisconnect: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#FF3B30' },
    btnDisconnectText: { color: '#FF3B30', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    btnLoading: { width: 90, height: 36, alignItems: 'center', justifyContent: 'center' },

    // Upgrade banner
    upgradeBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(204,255,0,0.2)' },
    upgradeIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
    upgradeTitle: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
    upgradeDesc: { color: '#666', fontSize: 12, fontFamily: 'Poppins_400Regular', lineHeight: 17 },
});
