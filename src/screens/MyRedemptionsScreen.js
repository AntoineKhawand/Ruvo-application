import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import * as Clipboard from 'expo-clipboard';
import { lightTap, successFeedback } from '../utils/haptics';

const COLORS = {
    background: "#000",
    card: "#1C1C1E",
    text: "#FFF",
    subText: "#888",
    primary: "#CCFF00",
    success: "#34C759",
    warning: "#FF9500",
    danger: "#FF3B30",
    border: "#333",
    gold: "#FFD700"
};

export default function MyRedemptionsScreen({ navigation }) {
    const [redemptions, setRedemptions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const q = query(
            collection(db, "users", uid, "redemptions"),
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRedemptions(data);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching redemptions:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const copyToClipboard = async (code) => {
        if (!code) return;
        lightTap();
        await Clipboard.setStringAsync(code);
        successFeedback();
        Alert.alert("Copied!", "Discount code copied to clipboard.");
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'used': return COLORS.success;
            case 'active': return COLORS.primary;
            case 'processing': return COLORS.warning;
            case 'expired': return COLORS.danger;
            default: return COLORS.subText;
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'used': return 'checkmark-circle';
            case 'active': return 'mail-open';
            case 'processing': return 'time';
            case 'expired': return 'close-circle';
            default: return 'help-circle';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Rewards</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : redemptions.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="receipt-outline" size={60} color="#333" />
                    <Text style={styles.emptyTitle}>No Redemptions Yet</Text>
                    <Text style={styles.emptyText}>Rewards you redeem using Ruvo Coins will appear here.</Text>
                    
                    <TouchableOpacity activeOpacity={0.7} style={styles.storeBtn} onPress={() => { lightTap(); navigation.navigate('RewardsStore'); }}>
                        <Text style={styles.storeBtnText}>Go to Store</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {redemptions.map(item => {
                        const isDigital = item.rewardType === 'digital' || item.rewardType === 'experience';
                        
                        // Parse Firestore timestamp safely
                        const dateString = item.timestamp?.toDate 
                            ? item.timestamp.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'Processing...';

                        return (
                            <View key={item.id} style={styles.itemCard}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemTitle}>{item.title}</Text>
                                    <View style={styles.priceTag}>
                                        <MaterialCommunityIcons name="lightning-bolt" size={14} color={COLORS.gold} />
                                        <Text style={styles.priceText}>{item.price} Coins</Text>
                                    </View>
                                </View>
                                
                                <Text style={styles.dateText}>Redeemed on {dateString}</Text>

                                {item.discountCode ? (
                                    <View style={styles.digitalBox}>
                                        <Text style={styles.codeLabel}>YOUR REWARD CODE:</Text>
                                        <View style={styles.codeRow}>
                                            <Text style={styles.codeText}>{item.discountCode}</Text>
                                            <TouchableOpacity 
                                                activeOpacity={0.7}
                                                style={styles.copyBtn} 
                                                onPress={() => copyToClipboard(item.discountCode)}
                                            >
                                                <Ionicons name="copy-outline" size={18} color={COLORS.primary} />
                                            </TouchableOpacity>
                                        </View>
                                        {item.status === 'active' && (
                                            <Text style={styles.helperText}>
                                                Show this code or the QR code in your email at the store to claim your reward.
                                            </Text>
                                        )}
                                        {item.status === 'used' && (
                                            <Text style={[styles.helperText, { color: COLORS.success }]}>
                                                ✅ This code has been redeemed.
                                            </Text>
                                        )}
                                    </View>
                                ) : (
                                    <View style={styles.physicalBox}>
                                        <View style={styles.statusRow}>
                                            <Ionicons name={getStatusIcon(item.status)} size={20} color={getStatusColor(item.status)} />
                                            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                                {item.status ? item.status.toUpperCase() : 'UNKNOWN'}
                                            </Text>
                                        </View>
                                        {item.status === 'processing' && (
                                            <Text style={styles.helperText}>We are reviewing your redemption. We will email you shortly for shipping details.</Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    backBtn: { padding: 8, backgroundColor: COLORS.card, borderRadius: 20 },
    headerTitle: { fontSize: 18, color: '#FFF', fontFamily: 'Poppins_700Bold' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    emptyTitle: { color: COLORS.text, fontSize: 20, fontFamily: 'Poppins_700Bold', marginTop: 20 },
    emptyText: { color: COLORS.subText, fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 },
    storeBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 30 },
    storeBtnText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 16 },
    content: { padding: 20, paddingBottom: 50 },
    itemCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: COLORS.border },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    itemTitle: { color: COLORS.text, fontSize: 16, fontFamily: 'Poppins_600SemiBold', flex: 1, marginRight: 10 },
    priceTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    priceText: { color: COLORS.gold, fontSize: 12, fontFamily: 'Poppins_700Bold', marginLeft: 2 },
    dateText: { color: COLORS.subText, fontSize: 12, marginTop: 4, marginBottom: 20 },
    digitalBox: { backgroundColor: '#111', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed' },
    codeLabel: { color: COLORS.subText, fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
    codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    codeText: { color: COLORS.primary, fontSize: 20, fontFamily: 'Poppins_700Bold', letterSpacing: 2 },
    copyBtn: { padding: 6, backgroundColor: 'rgba(204, 255, 0, 0.1)', borderRadius: 8 },
    physicalBox: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 15, borderRadius: 12 },
    shippingLabel: { color: COLORS.subText, fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1, marginBottom: 8 },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    statusText: { fontSize: 14, fontFamily: 'Poppins_700Bold', marginLeft: 8 },
    helperText: { color: COLORS.subText, fontSize: 12, marginTop: 10, lineHeight: 18 }
});
