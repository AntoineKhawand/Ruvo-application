import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

const COLORS = {
    background: "#000",
    card: "#1C1C1E",
    text: "#FFF",
    subText: "#888",
    primary: "#CCFF00",
    danger: "#FF3B30",
    border: "#333"
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

    useFocusEffect(
        useCallback(() => {
            setConnectingDevice(null);
            setSyncingDevice(null);
        }, [])
    );

    const handleConnectWhoop = async () => {
        if (!isPro) {
            navigation.navigate('Paywall');
            return;
        }
        
        // Check if client IDs are properly configured
        const clientId = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID;
        if (!clientId || clientId.includes('your_whoop')) {
            Alert.alert(
                'Whoop Not Available',
                'Whoop integration requires API configuration. Please contact support to enable this feature.',
                [{ text: 'OK' }]
            );
            return;
        }
        
        lightTap();
        setConnectingDevice('whoop');
        try {
            const success = await whoopService.authenticate();
            if (success) {
                Alert.alert('Success', 'Whoop connected and data synced!');
            } else {
                Alert.alert('Error', 'Could not connect to Whoop. Please try again.');
            }
        } catch (err) {
            Alert.alert('Error', 'An unexpected error occurred while connecting to Whoop.');
        } finally {
            setConnectingDevice(null);
        }
    };

    const handleConnectOura = async () => {
        if (!isPro) {
            navigation.navigate('Paywall');
            return;
        }
        
        // Check if client IDs are properly configured
        const clientId = process.env.EXPO_PUBLIC_OURA_CLIENT_ID;
        if (!clientId || clientId.includes('your_oura')) {
            Alert.alert(
                'Oura Not Available',
                'Oura Ring integration requires API configuration. Please contact support to enable this feature.',
                [{ text: 'OK' }]
            );
            return;
        }
        
        lightTap();
        setConnectingDevice('oura');
        try {
            const success = await ouraService.authenticate();
            if (success) {
                Alert.alert('Success', 'Oura Ring connected and data synced!');
            } else {
                Alert.alert('Error', 'Could not connect to Oura. Please try again.');
            }
        } catch (err) {
            Alert.alert('Error', 'An unexpected error occurred while connecting to Oura.');
        } finally {
            setConnectingDevice(null);
        }
    };

    const handleDisconnectWhoop = () => {
        lightTap();
        Alert.alert('Disconnect Whoop', 'Are you sure you want to disconnect Whoop?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect',
                style: 'destructive',
                onPress: async () => {
                    setConnectingDevice('whoop');
                    try {
                        await whoopService.disconnect();
                        await updateDoc(doc(db, 'users', userData.uid), { whoopData: deleteField() });
                    } catch (err) {
                        Alert.alert('Error', 'Could not disconnect Whoop.');
                    } finally {
                        setConnectingDevice(null);
                    }
                }
            }
        ]);
    };

    const handleSyncWhoop = async () => {
        lightTap();
        setSyncingDevice('whoop');
        try {
            const success = await whoopService.syncToCloud();
            if (success) {
                Alert.alert('Synced', 'Whoop data refreshed successfully!');
            } else {
                Alert.alert('Sync Failed', 'Could not refresh Whoop data. Please try again.');
            }
        } catch (err) {
            Alert.alert('Error', 'An unexpected error occurred during sync.');
        } finally {
            setSyncingDevice(null);
        }
    };

    const handleDisconnectOura = () => {
        lightTap();
        Alert.alert('Disconnect Oura Ring', 'Are you sure you want to disconnect Oura Ring?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect',
                style: 'destructive',
                onPress: async () => {
                    setConnectingDevice('oura');
                    try {
                        await ouraService.disconnect();
                        await updateDoc(doc(db, 'users', userData.uid), { ouraData: deleteField() });
                    } catch (err) {
                        Alert.alert('Error', 'Could not disconnect Oura.');
                    } finally {
                        setConnectingDevice(null);
                    }
                }
            }
        ]);
    };

    const handleSyncOura = async () => {
        lightTap();
        setSyncingDevice('oura');
        try {
            const success = await ouraService.syncToCloud();
            if (success) {
                Alert.alert('Synced', 'Oura Ring data refreshed successfully!');
            } else {
                Alert.alert('Sync Failed', 'Could not refresh Oura Ring data. Please try again.');
            }
        } catch (err) {
            Alert.alert('Error', 'An unexpected error occurred during sync.');
        } finally {
            setSyncingDevice(null);
        }
    };

    const WhoopDataSummary = () => {
        if (!whoopData) return null;
        return (
            <View style={styles.dataSummary}>
                {whoopData.recovery != null && (
                    <View style={styles.dataChip}>
                        <Text style={styles.dataChipLabel}>Recovery</Text>
                        <Text style={styles.dataChipValue}>{whoopData.recovery}%</Text>
                    </View>
                )}
                {whoopData.strain != null && (
                    <View style={styles.dataChip}>
                        <Text style={styles.dataChipLabel}>Strain</Text>
                        <Text style={styles.dataChipValue}>{whoopData.strain}</Text>
                    </View>
                )}
                {whoopData.hrv != null && (
                    <View style={styles.dataChip}>
                        <Text style={styles.dataChipLabel}>HRV</Text>
                        <Text style={styles.dataChipValue}>{whoopData.hrv}ms</Text>
                    </View>
                )}
                {whoopData.sleepScore != null && (
                    <View style={styles.dataChip}>
                        <Text style={styles.dataChipLabel}>Sleep</Text>
                        <Text style={styles.dataChipValue}>{whoopData.sleepScore}%</Text>
                    </View>
                )}
            </View>
        );
    };

    const OuraDataSummary = () => {
        if (!ouraData) return null;
        return (
            <View style={styles.dataSummary}>
                {ouraData.readinessScore != null && (
                    <View style={styles.dataChip}>
                        <Text style={styles.dataChipLabel}>Readiness</Text>
                        <Text style={styles.dataChipValue}>{ouraData.readinessScore}%</Text>
                    </View>
                )}
                {ouraData.sleepScore != null && (
                    <View style={styles.dataChip}>
                        <Text style={styles.dataChipLabel}>Sleep</Text>
                        <Text style={styles.dataChipValue}>{ouraData.sleepScore}%</Text>
                    </View>
                )}
                {ouraData.hrv != null && (
                    <View style={styles.dataChip}>
                        <Text style={styles.dataChipLabel}>HRV</Text>
                        <Text style={styles.dataChipValue}>{ouraData.hrv}ms</Text>
                    </View>
                )}
            </View>
        );
    };

    const ActionButton = ({ label, onPress, loading, isDestructive }) => {
        if (loading) {
            return (
                <View style={[styles.actionBtn, styles.actionBtnLoading]}>
                    <ActivityIndicator size="small" color={COLORS.subText} />
                </View>
            );
        }
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                style={styles.actionBtn}
                onPress={onPress}
            >
                <Text style={[styles.actionBtnText, { color: isDestructive ? COLORS.danger : COLORS.primary }]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { lightTap(); navigation.goBack(); }}
                    style={styles.backBtn}
                >
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Connected Devices</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                <Text style={styles.sectionTitle}>HEALTH PLATFORMS</Text>
                <View style={styles.sectionContainer}>
                    <View style={styles.deviceCard}>
                        <View style={styles.deviceRow}>
                            <View style={styles.deviceLeft}>
                                <View style={[styles.iconBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                                    <Ionicons name="heart" size={24} color="#FFF" />
                                </View>
                                <View>
                                    <Text style={styles.deviceName}>Apple Health / Google Health</Text>
                                    <Text style={styles.deviceDesc}>Covers Apple Watch, Garmin, Coros, Suunto, Polar, Fitbit, Samsung Health</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.statusRow}>
                            <View style={styles.statusLeft}>
                                <View style={styles.connectedBadge}>
                                    <Ionicons name="checkmark-circle" size={12} color="#000" />
                                    <Text style={styles.connectedText}>Auto-synced</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.premiumHeader}>
                    <Text style={styles.sectionTitle}>PREMIUM DEVICES</Text>
                    <View style={styles.proBadge}>
                        <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                </View>

                <View style={styles.sectionContainer}>
                    <View style={[styles.deviceCard, { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                        <View style={styles.deviceRow}>
                            <View style={styles.deviceLeft}>
                                <View style={[styles.iconBox, { backgroundColor: '#000', borderWidth: 1, borderColor: '#333' }]}>
                                    <MaterialCommunityIcons name="alpha-w-circle" size={24} color="#FFF" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.deviceName}>Whoop</Text>
                                    <Text style={styles.deviceDesc}>Recovery · HRV · Strain · Sleep</Text>
                                </View>
                            </View>
                        </View>

                        {isWhoopConnected && <WhoopDataSummary />}

                        <View style={styles.statusRow}>
                            {isWhoopConnected ? (
                                <View style={styles.statusLeft}>
                                    <View style={styles.connectedBadge}>
                                        <Ionicons name="checkmark-circle" size={12} color="#000" />
                                        <Text style={styles.connectedText}>Connected</Text>
                                    </View>
                                    {whoopData?.lastSync && (
                                        <Text style={styles.lastSyncText}>
                                            Synced {whoopData.lastSync?.toDate ? whoopData.lastSync.toDate().toLocaleDateString() : 'recently'}
                                        </Text>
                                    )}
                                </View>
                            ) : (
                                <Text style={styles.disconnectedText}>Not Connected</Text>
                            )}

                            <View style={styles.actionGroup}>
                                {isWhoopConnected && (
                                    <ActionButton
                                        label="Sync"
                                        onPress={handleSyncWhoop}
                                        loading={syncingDevice === 'whoop'}
                                    />
                                )}
                                <ActionButton
                                    label={isWhoopConnected ? 'Disconnect' : 'Connect'}
                                    onPress={isWhoopConnected ? handleDisconnectWhoop : handleConnectWhoop}
                                    loading={connectingDevice === 'whoop'}
                                    isDestructive={isWhoopConnected}
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.deviceCard}>
                        <View style={styles.deviceRow}>
                            <View style={styles.deviceLeft}>
                                <View style={[styles.iconBox, { backgroundColor: '#FFF' }]}>
                                    <MaterialCommunityIcons name="ring" size={24} color="#000" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.deviceName}>Oura Ring</Text>
                                    <Text style={styles.deviceDesc}>Sleep · Readiness · HRV</Text>
                                </View>
                            </View>
                        </View>

                        {isOuraConnected && <OuraDataSummary />}

                        <View style={styles.statusRow}>
                            {isOuraConnected ? (
                                <View style={styles.statusLeft}>
                                    <View style={styles.connectedBadge}>
                                        <Ionicons name="checkmark-circle" size={12} color="#000" />
                                        <Text style={styles.connectedText}>Connected</Text>
                                    </View>
                                    {ouraData?.lastSync && (
                                        <Text style={styles.lastSyncText}>
                                            Synced {ouraData.lastSync?.toDate ? ouraData.lastSync.toDate().toLocaleDateString() : 'recently'}
                                        </Text>
                                    )}
                                </View>
                            ) : (
                                <Text style={styles.disconnectedText}>Not Connected</Text>
                            )}

                            <View style={styles.actionGroup}>
                                {isOuraConnected && (
                                    <ActionButton
                                        label="Sync"
                                        onPress={handleSyncOura}
                                        loading={syncingDevice === 'oura'}
                                    />
                                )}
                                <ActionButton
                                    label={isOuraConnected ? 'Disconnect' : 'Connect'}
                                    onPress={isOuraConnected ? handleDisconnectOura : handleConnectOura}
                                    loading={connectingDevice === 'oura'}
                                    isDestructive={isOuraConnected}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {!isPro && (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.upgradeBanner}
                        onPress={() => { lightTap(); navigation.navigate('Paywall'); }}
                    >
                        <Ionicons name="star" size={20} color={COLORS.primary} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={styles.upgradeTitle}>Unlock Premium Devices</Text>
                            <Text style={styles.upgradeDesc}>Connect Whoop and Oura Ring to power your AI Coach with advanced biometrics</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    backBtn: { padding: 8, backgroundColor: COLORS.card, borderRadius: 20 },
    headerTitle: { fontSize: 18, color: '#FFF', fontFamily: 'Poppins_700Bold' },
    content: { padding: 20, paddingBottom: 50 },
    sectionTitle: { color: COLORS.subText, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginLeft: 5 },
    premiumHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 10, marginLeft: 5 },
    proBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
    proBadgeText: { color: '#000', fontSize: 9, fontFamily: 'Poppins_700Bold' },
    sectionContainer: { backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
    deviceCard: { padding: 16 },
    deviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    deviceLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    deviceName: { color: COLORS.text, fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    deviceDesc: { color: COLORS.subText, fontSize: 12, marginTop: 2 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    statusLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    connectedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    connectedText: { color: '#000', fontSize: 10, fontFamily: 'Poppins_700Bold', marginLeft: 4 },
    lastSyncText: { color: COLORS.subText, fontSize: 10, marginLeft: 10 },
    disconnectedText: { color: COLORS.subText, fontSize: 12 },
    actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
    actionBtnLoading: { width: 70, alignItems: 'center', justifyContent: 'center' },
    actionBtnText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    dataSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10, marginTop: 2 },
    dataChip: { backgroundColor: 'rgba(204,255,0,0.08)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    dataChipLabel: { color: COLORS.subText, fontSize: 10, fontFamily: 'Poppins_500Medium' },
    dataChipValue: { color: COLORS.primary, fontSize: 14, fontFamily: 'Poppins_700Bold', marginTop: 1 },
    upgradeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(204,255,0,0.08)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(204,255,0,0.2)' }
});
