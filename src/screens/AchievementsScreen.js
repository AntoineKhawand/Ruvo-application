import { Ionicons } from '@expo/vector-icons';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BADGES } from '../constants/badges'; // Import shared constant
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');
const COL_WIDTH = (width - 60) / 3; // 3 Columns

export default function AchievementsScreen({ navigation }) {
    // 3. Get Real User Data
    const { userData } = useUser();

    // Safe fallback
    const userBadges = userData?.badges || [];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>All Achievements</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* PROGRESS HEADER */}
                <View style={styles.progressHeader}>
                    <Text style={styles.progressText}>
                        {userBadges.length} / {BADGES.length} UNLOCKED
                    </Text>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${(userBadges.length / BADGES.length) * 100}%` }]} />
                    </View>
                </View>

                <View style={styles.grid}>
                    {BADGES.map((badge) => {
                        // 4. Dynamic Check: Does user have this badge?
                        // Match by ID first, fallback to name for backwards compatibility
                        const isUnlocked = userBadges.some(b => {
                            if (b.id && badge.id && b.id === badge.id) return true;
                            if (b.name && badge.name && b.name === badge.name) return true;
                            return false;
                        });

                        return (
                            <View key={badge.id} style={styles.badgeWrapper}>
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
                                <Text style={[styles.badgeName, !isUnlocked && { color: '#666' }]}>{badge.name}</Text>
                                <Text style={styles.badgeDesc}>{badge.description}</Text>

                                {
                                    isUnlocked && (
                                        <View style={styles.checkBadge}>
                                            <Ionicons name="checkmark-circle" size={14} color={badge.color} />
                                        </View>
                                    )
                                }
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    scrollContent: { padding: 20 },

    progressHeader: { marginBottom: 30, alignItems: 'center' },
    progressText: { color: COLORS.accent, fontSize: 12, fontFamily: 'Poppins_700Bold', marginBottom: 10, letterSpacing: 1 },
    progressBarBg: { width: '60%', height: 4, backgroundColor: '#333', borderRadius: 2 },
    progressBarFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    badgeWrapper: { width: COL_WIDTH, alignItems: 'center', marginBottom: 30, position: 'relative' },
    badgeCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 10 },
    badgeName: { color: '#FFF', fontSize: 11, fontFamily: 'Poppins_600SemiBold', textAlign: 'center', marginBottom: 2 },
    badgeDesc: { color: '#666', fontSize: 9, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
    checkBadge: { position: 'absolute', top: 0, right: 10, backgroundColor: '#000', borderRadius: 7 }
});