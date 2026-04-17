import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, functions } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';

const COLORS = {
    background: "#000",
    card: "#1C1C1E",
    text: "#FFF",
    subText: "#888",
    primary: "#CCFF00",
    accent: "#5AC8FA",
    danger: "#FF3B30",
    border: "#333",
    gold: "#FFD700"
};

const AVAILABLE_REWARDS = [
    { id: 'rwd_1', title: '15% Off Tracksmith Gear', price: 500, type: 'digital', description: 'Get a unique discount code instantly.', icon: 'pricetag', logo: null },
    { id: 'rwd_2', title: 'Free Ruvo Pro Month', price: 1000, type: 'digital', description: 'Unlock Ruvo Pro for 30 days automatically.', icon: 'star', logo: null },
    { id: 'rwd_3', title: 'Ruvo Running Hat', price: 2500, type: 'physical', description: 'Exclusive branded running cap, shipped to you.', icon: 'shirt', logo: null },
    { id: 'rwd_4', title: 'Virtual 5K Race Pass', price: 300, type: 'experience', description: 'Entry ticket for the next Ruvo monthly 5K.', icon: 'ticket', logo: null }
];

export default function RewardsStoreScreen({ navigation }) {
    const { userData, refreshUser } = useUser();
    const [redeemingId, setRedeemingId] = useState(null);

    const currentCoins = userData?.coins || 0;

    const handleRedeem = (reward) => {
        lightTap();
        if (currentCoins < reward.price) {
            errorFeedback();
            Alert.alert("Not Enough Coins", `You need ${reward.price - currentCoins} more Ruvo Coins to redeem this.`);
            return;
        }

        Alert.alert(
            "Confirm Redemption",
            `This will use ${reward.price} Ruvo Coins. You have ${currentCoins} coins available.`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Confirm", onPress: () => processRedemption(reward) }
            ]
        );
    };

    const processRedemption = async (reward) => {
        setRedeemingId(reward.id);
        
        try {
            const redeemRewardCall = httpsCallable(functions, 'redeemReward');
            const response = await redeemRewardCall({
                rewardId: reward.id,
                title: reward.title,
                price: reward.price,
                rewardType: reward.type
            });

            if (response.data.success) {
                successFeedback();
                await refreshUser();

                Alert.alert(
                    "Reward Redeemed! 🎉",
                    `Your ${reward.title} code has been sent to your email. Open it to find your QR code and redemption instructions.`,
                    [
                        { text: "View My Rewards", onPress: () => navigation.navigate('MyRedemptions') },
                        { text: "OK" }
                    ]
                );
            }
        } catch (error) {
            errorFeedback();
            Alert.alert("Redemption Failed", error.message || "An error occurred while redeeming.");
        } finally {
            setRedeemingId(null);
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
                <Text style={styles.headerTitle}>Rewards Store</Text>
                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.navigate('MyRedemptions'); }} style={styles.historyBtn}>
                    <Ionicons name="receipt-outline" size={22} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            {/* BALANCE CARD */}
            <View style={styles.balanceContainer}>
                <View style={styles.balanceBox}>
                    <Text style={styles.balanceLabel}>My Balance</Text>
                    <View style={styles.balanceRow}>
                        <MaterialCommunityIcons name="lightning-bolt-circle" size={32} color={COLORS.gold} />
                        <Text style={styles.balanceText}>{currentCoins.toLocaleString()} <Text style={styles.balanceUnit}>Coins</Text></Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>AVAILABLE REWARDS</Text>

                {AVAILABLE_REWARDS.map(reward => {
                    const canAfford = currentCoins >= reward.price;
                    const isProcessing = redeemingId === reward.id;

                    return (
                        <View key={reward.id} style={styles.rewardCard}>
                            <View style={styles.rewardTopRow}>
                                <View style={styles.iconBox}>
                                    <Ionicons name={reward.icon} size={24} color={COLORS.primary} />
                                </View>
                                <View style={styles.rewardInfo}>
                                    <Text style={styles.rewardTitle}>{reward.title}</Text>
                                    <View style={styles.badgeRow}>
                                        <View style={styles.typeBadge}>
                                            <Text style={styles.typeBadgeText}>{reward.type.toUpperCase()}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.rewardDesc}>{reward.description}</Text>

                            <View style={styles.rewardBottomRow}>
                                <View style={styles.priceTag}>
                                    <MaterialCommunityIcons name="lightning-bolt" size={16} color={COLORS.gold} />
                                    <Text style={styles.priceText}>{reward.price} Coins</Text>
                                </View>
                                
                                <TouchableOpacity 
                                    activeOpacity={0.7}
                                    style={[styles.redeemBtn, !canAfford && styles.redeemBtnDisabled]}
                                    onPress={() => handleRedeem(reward)}
                                    disabled={!canAfford || isProcessing}
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator size="small" color="#000" />
                                    ) : (
                                        <Text style={[styles.redeemBtnText, !canAfford && styles.redeemBtnTextDisabled]}>
                                            {canAfford ? 'Redeem' : 'Locked'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    backBtn: { padding: 8, backgroundColor: COLORS.card, borderRadius: 20 },
    headerTitle: { fontSize: 18, color: '#FFF', fontFamily: 'Poppins_700Bold' },
    historyBtn: { padding: 8, backgroundColor: 'rgba(204, 255, 0, 0.15)', borderRadius: 20 },
    balanceContainer: { paddingHorizontal: 20, marginBottom: 10 },
    balanceBox: { backgroundColor: '#111', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
    balanceLabel: { color: COLORS.subText, fontSize: 12, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1 },
    balanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    balanceText: { color: '#FFF', fontSize: 32, fontFamily: 'Poppins_700Bold', marginLeft: 8 },
    balanceUnit: { fontSize: 16, color: COLORS.subText },
    content: { padding: 20, paddingBottom: 50 },
    sectionTitle: { color: COLORS.subText, fontSize: 12, fontFamily: 'Poppins_700Bold', letterSpacing: 1, marginBottom: 15, marginLeft: 5 },
    rewardCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 15 },
    rewardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    iconBox: { width: 44, height: 44, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    rewardInfo: { flex: 1 },
    rewardTitle: { color: COLORS.text, fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    badgeRow: { flexDirection: 'row', marginTop: 4 },
    typeBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    typeBadgeText: { color: '#AAA', fontSize: 10, fontFamily: 'Poppins_700Bold' },
    rewardDesc: { color: COLORS.subText, fontSize: 13, lineHeight: 18, marginBottom: 15 },
    rewardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 15 },
    priceTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    priceText: { color: COLORS.gold, fontSize: 14, fontFamily: 'Poppins_700Bold', marginLeft: 4 },
    redeemBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    redeemBtnDisabled: { backgroundColor: '#333' },
    redeemBtnText: { color: '#000', fontSize: 14, fontFamily: 'Poppins_700Bold' },
    redeemBtnTextDisabled: { color: '#666' }
});
