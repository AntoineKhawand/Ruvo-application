import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BADGES } from '../constants/badges';
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext';
import { lightTap } from '../utils/haptics';

const { width } = Dimensions.get('window');
const COL_WIDTH = (width - 60) / 3;

// Map categories to human-readable names
const CATEGORY_NAMES = {
    milestone: 'Distance Milestones',
    lifestyle: 'Lifestyle & Habits',
    consistency: 'Consistency & Streaks',
    elevation: 'Elevation Challenges',
    performance: 'Speed & Performance',
    default: 'Other Achievements'
};

export default function AchievementsScreen({ navigation }) {
    const { userData } = useUser();
    const userBadges = userData?.badges || [];

    // Check if user has a badge
    const hasBadge = (badge) => {
        return userBadges.some(b => {
            if (b.id && badge.id && b.id === badge.id) return true;
            if (b.name && badge.name && b.name === badge.name) return true;
            return false;
        });
    };

    // Grouping logic
    const groupedBadges = BADGES.reduce((acc, badge) => {
        const cat = badge.category || 'default';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(badge);
        return acc;
    }, {});

    // State for interactive modal
    const [selectedBadge, setSelectedBadge] = useState(null);

    // Fade-in animation
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
    }, []);

    const totalUnlocked = BADGES.filter(b => hasBadge(b)).length;
    const progressPercent = BADGES.length > 0 ? (totalUnlocked / BADGES.length) * 100 : 0;

    const renderBadgeModal = () => {
        if (!selectedBadge) return null;
        const isUnlocked = hasBadge(selectedBadge);

        return (
            <Modal
                transparent={true}
                animationType="fade"
                visible={!!selectedBadge}
                onRequestClose={() => setSelectedBadge(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.modalCloseBtn}
                            onPress={() => { lightTap(); setSelectedBadge(null); }}
                        >
                            <Ionicons name="close" size={24} color="#888" />
                        </TouchableOpacity>

                        <View style={[
                            styles.modalIconWrapper,
                            {
                                borderColor: isUnlocked ? selectedBadge.color : '#333',
                                shadowColor: isUnlocked ? selectedBadge.color : undefined,
                                shadowOpacity: isUnlocked ? 0.5 : 0,
                                shadowRadius: 20,
                            }
                        ]}>
                            <Ionicons
                                name={selectedBadge.icon}
                                size={60}
                                color={isUnlocked ? selectedBadge.color : '#444'}
                            />
                        </View>

                        <Text style={styles.modalTitle}>{selectedBadge.name}</Text>

                        <View style={[styles.statusBadge, { backgroundColor: isUnlocked ? 'rgba(204, 255, 0, 0.15)' : 'rgba(255, 255, 255, 0.1)' }]}>
                            <Ionicons name={isUnlocked ? "checkmark-circle" : "lock-closed"} size={16} color={isUnlocked ? COLORS.accent : '#888'} />
                            <Text style={[styles.statusText, { color: isUnlocked ? COLORS.accent : '#888' }]}>
                                {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                            </Text>
                        </View>

                        <Text style={styles.modalDesc}>{selectedBadge.description}</Text>

                        {!isUnlocked && (
                            <Text style={styles.modalHint}>Keep running to unlock this achievement!</Text>
                        )}
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); navigation.goBack(); }} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Trophy Room</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* PREMIUM PROGRESS HEADER */}
                <Animated.View style={[styles.premiumHeaderCard, { opacity: fadeAnim }]}>
                    <View style={styles.premiumHeaderTop}>
                        <View>
                            <Text style={styles.premiumLabel}>COMPLETION</Text>
                            <Text style={styles.premiumValue}>{Math.round(progressPercent)}%</Text>
                        </View>
                        <View style={styles.medalBox}>
                            <Ionicons name="trophy" size={32} color={COLORS.accent} />
                            <Text style={styles.totalUnlockedText}>{totalUnlocked} / {BADGES.length}</Text>
                        </View>
                    </View>

                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                    </View>
                </Animated.View>

                {/* CATEGORIES */}
                <Animated.View style={{ opacity: fadeAnim }}>
                    {Object.keys(groupedBadges).map((categoryKey) => {
                        const catBadges = groupedBadges[categoryKey];
                        const unlockedInCat = catBadges.filter(b => hasBadge(b)).length;

                        return (
                            <View key={categoryKey} style={styles.categorySection}>
                                <View style={styles.categoryHeader}>
                                    <Text style={styles.categoryTitle}>{CATEGORY_NAMES[categoryKey] || 'Other'}</Text>
                                    <Text style={styles.categoryCount}>{unlockedInCat} / {catBadges.length}</Text>
                                </View>

                                <View style={styles.grid}>
                                    {catBadges.map((badge) => {
                                        const isUnlocked = hasBadge(badge);

                                        return (
                                            <TouchableOpacity
                                                key={badge.id}
                                                style={styles.badgeWrapper}
                                                activeOpacity={0.7}
                                                onPress={() => setSelectedBadge(badge)}
                                            >
                                                <View style={[
                                                    styles.badgeCircle,
                                                    {
                                                        backgroundColor: isUnlocked ? 'rgba(255,255,255,0.05)' : '#111',
                                                        borderColor: isUnlocked ? badge.color : '#333',
                                                        shadowColor: isUnlocked ? badge.color : undefined,
                                                        shadowOpacity: isUnlocked ? 0.3 : 0,
                                                        shadowRadius: 10,
                                                    }
                                                ]}>
                                                    <Ionicons name={badge.icon} size={30} color={isUnlocked ? badge.color : '#444'} />
                                                </View>
                                                <Text style={[styles.badgeName, !isUnlocked && { color: '#666' }]} numberOfLines={1}>
                                                    {badge.name}
                                                </Text>

                                                {isUnlocked && (
                                                    <View style={styles.checkBadge}>
                                                        <Ionicons name="checkmark-circle" size={14} color={badge.color} />
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        );
                    })}
                </Animated.View>

            </ScrollView>

            {renderBadgeModal()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    backBtn: { padding: 5 },
    scrollContent: { padding: 20, paddingBottom: 50 },

    // Premium Header
    premiumHeaderCard: {
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 24,
        marginBottom: 35,
        borderWidth: 1,
        borderColor: '#222',
        shadowColor: COLORS.accent,
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
    },
    premiumHeaderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    premiumLabel: { color: '#888', fontSize: 12, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1.5, marginBottom: 4 },
    premiumValue: { color: '#FFF', fontSize: 36, fontFamily: 'Poppins_800ExtraBold', lineHeight: 40 },
    medalBox: { alignItems: 'center', backgroundColor: 'rgba(204,255,0,0.1)', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 16 },
    totalUnlockedText: { color: COLORS.accent, fontSize: 14, fontFamily: 'Poppins_700Bold', marginTop: 4 },
    progressBarBg: { width: '100%', height: 8, backgroundColor: '#222', borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 4 },

    // Categories
    categorySection: { marginBottom: 35 },
    categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 10, marginBottom: 20 },
    categoryTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', textTransform: 'uppercase' },
    categoryCount: { color: '#888', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },

    // Grid
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
    badgeWrapper: { width: COL_WIDTH, alignItems: 'center', marginBottom: 25, position: 'relative' },
    badgeCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 10 },
    badgeName: { color: '#FFF', fontSize: 11, fontFamily: 'Poppins_600SemiBold', textAlign: 'center', width: '90%' },
    checkBadge: { position: 'absolute', top: 0, right: 10, backgroundColor: '#000', borderRadius: 7 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', backgroundColor: '#1A1A1C', borderRadius: 24, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    modalCloseBtn: { position: 'absolute', top: 15, right: 15, padding: 5, zIndex: 10 },
    modalIconWrapper: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', borderWidth: 3, marginBottom: 20 },
    modalTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_800ExtraBold', textAlign: 'center', marginBottom: 15 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 20 },
    statusText: { fontSize: 12, fontFamily: 'Poppins_700Bold', marginLeft: 6, letterSpacing: 1 },
    modalDesc: { color: '#AAA', fontSize: 15, fontFamily: 'Poppins_400Regular', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
    modalHint: { color: '#666', fontSize: 12, fontFamily: 'Poppins_500Medium', textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
});