import { Ionicons } from '@expo/vector-icons';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useUser } from '../context/UserContext'; // 1. Import Context

const { width } = Dimensions.get('window');
const COL_WIDTH = (width - 60) / 3; // 3 Columns

// 2. MASTER LIST OF BADGES (Aligned with UserContext names)
const ALL_BADGES = [
    { id: 0, name: 'Newcomer', desc: 'Joined the app', icon: 'star', color: '#CCFF00' },
    { id: 1, name: 'Early Bird', desc: 'Run before 7AM', icon: 'sunny', color: '#FFD700' },
    { id: 2, name: '5K Club', desc: 'Complete 5km run', icon: 'medal', color: COLORS.accent },
    { id: 3, name: '10K Finisher', desc: 'Complete 10km run', icon: 'ribbon', color: '#FF4500' },
    { id: 4, name: '20k Club', desc: 'Run 20km total', icon: 'trophy', color: '#9D50BB' },
    { id: 5, name: 'Marathoner', desc: 'Run 42.2km', icon: 'trophy', color: '#FFD700' },
    { id: 6, name: 'Night Owl', desc: 'Run after 8PM', icon: 'moon', color: '#536DFE' },
    { id: 7, name: 'Speed Demon', desc: 'Pace < 4:00/km', icon: 'flash', color: '#00E676' },
    { id: 8, name: 'Everest', desc: '1000m Elevation', icon: 'stats-chart', color: '#A1887F' },
    { id: 9, name: '7 Day Streak', desc: 'Run 7 days in a row', icon: 'flame', color: '#FF5722' },
    { id: 10, name: 'Iron Lungs', desc: 'Run at 90% HR', icon: 'heart', color: '#D50000' },
    { id: 11, name: 'Globe Trotter', desc: 'Run in 3 cities', icon: 'earth', color: '#2979FF' },
];

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
        <View style={{width: 40}} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* PROGRESS HEADER */}
        <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
                {userBadges.length} / {ALL_BADGES.length} UNLOCKED
            </Text>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${(userBadges.length / ALL_BADGES.length) * 100}%` }]} />
            </View>
        </View>

        <View style={styles.grid}>
            {ALL_BADGES.map((badge) => {
                // 4. Dynamic Check: Does user have this badge?
                const isUnlocked = userBadges.some(b => b.name === badge.name);

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
                        <Text style={styles.badgeDesc}>{badge.desc}</Text>
                        
                        {isUnlocked && (
                            <View style={styles.checkBadge}>
                                <Ionicons name="checkmark-circle" size={14} color={badge.color} />
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
      </ScrollView>
    </SafeAreaView>
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