import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import FloatingNavBar from '../components/FloatingNavBar';

const { width } = Dimensions.get('window');

const COLORS = {
    primary: "#CCFF00", 
    secondary: "#1C1C1E",
    background: "#000000",
    card: "#121212",
    text: "#FFFFFF",
    subText: "#888888",
    divider: "#333333",
    overlay: "rgba(0,0,0,0.85)"
};

// --- HELPER: GET CURRENT WEEK DATES ---
const getCurrentWeek = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay(); 
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    return Array.from({ length: 7 }).map((_, idx) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + idx);
        return {
            date: d,
            dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
            dayNum: d.getDate(),
            fullDate: d.toDateString(),
            dayKey: d.toLocaleDateString('en-US', { weekday: 'short' }),
            isToday: d.toDateString() === today.toDateString(),
            isPast: d < new Date().setHours(0,0,0,0)
        };
    });
};

// --- HELPER: DYNAMIC FUTURE PLAN GENERATOR ---
const generateFutureWeeks = (goal, runDays = []) => {
    const activeDays = (runDays && runDays.length > 0) ? runDays : ['Mon', 'Wed', 'Fri'];
    const dayOrder = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };
    const sortedDays = [...activeDays].sort((a, b) => dayOrder[a] - dayOrder[b]);

    const weeks = [];
    const focusMap = {
        '5k': ['Base', 'Speed', 'Endurance', 'Peak'],
        '10k': ['Volume', 'Tempo', 'Race Pace', 'Taper'],
        'Half Marathon': ['Long Run', 'Strength', 'Threshold', 'Recovery'],
        'Weight Loss': ['Fat Burn', 'Cardio', 'Intervals', 'Consistency'],
        'Recovery': ['Rest', 'Mobility', 'Easy Walks', 'Recovery'], 
        'Maintenance': ['Easy Run', 'Easy Run', 'Fun Run', 'Steady'] 
    };
    const foci = focusMap[goal] || focusMap['10k'];

    for (let i = 1; i <= 4; i++) {
        const weekWorkouts = sortedDays.map((day, idx) => {
            let title = "Easy Run";
            let detail = "30 min Zone 2";
            let icon = "walk";

            if (goal === 'Recovery') {
                title = "Recovery Walk"; detail = "20 min low impact"; icon = "medical";
            } else if (goal === 'Maintenance') {
                title = "Vacation Run"; detail = "30 min enjoy the view"; icon = "airplane";
            } else {
                if (idx === sortedDays.length - 1) { 
                    title = "Long Run"; detail = `${8 + i} km steady`; icon = "map"; 
                } else if (sortedDays.length > 1 && idx === Math.floor(sortedDays.length / 2)) {
                    title = "Speed Work"; detail = `${i + 3}x400m intervals`; icon = "stopwatch";
                } else {
                    title = "Recovery Run"; detail = `25 min easy pace`; icon = "walk";
                }
            }
            return { day, title, detail, icon };
        });

        weeks.push({
            weekNum: i,
            focus: foci[i-1] || 'Training',
            totalDist: goal === 'Recovery' ? '10 km' : `${(sortedDays.length * 5) + (i * 2)} km`,
            workouts: weekWorkouts
        });
    }
    return weeks;
};

export default function PlanScreen({ navigation }) {
    const { userData, updateUserProfile } = useUser(); 
    
    const weekDates = useMemo(() => getCurrentWeek(), []);
    const [selectedDate, setSelectedDate] = useState(weekDates.find(d => d.isToday) || weekDates[0]);
    
    const [showEditMenu, setShowEditMenu] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [tempRunDays, setTempRunDays] = useState(userData?.runDays || []);

    const futurePlanData = useMemo(() => 
        generateFutureWeeks(userData?.goal || '10k', userData?.runDays), 
    [userData?.goal, userData?.runDays]);

    // --- MAIN PLAN LOGIC (Linked to Home & Settings) ---
    const weeklyPlan = useMemo(() => {
        const plan = {};
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        
        // --- 1. GET STATUS FROM USER DATA ---
        // This ensures strict linking to "I'm Injured" / "Vacation" states
        const currentGoal = userData?.goal || '10k'; 
        const runDays = userData?.runDays || ['Mon', 'Wed', 'Fri'];

        days.forEach((day, index) => {
            if (runDays.includes(day)) {
                let workout = {};

                // --- 2. APPLY LOGIC BASED ON STATUS ---
                
                // INJURY MODE (Linked)
                if (currentGoal === 'Recovery') {
                    workout = { 
                        title: 'Recovery Walk', 
                        desc: 'Keep HR low. No running today.', 
                        duration: 20, dist: '2 km', type: 'Recovery', intensity: 'Low',
                        customSteps: [
                            { type: 'Walk', color: '#4CD964', steps: [{ id: 1, text: '20 min walk', icon: 'walk', durationSec: 1200 }] }
                        ]
                    };
                }
                // VACATION MODE (Linked)
                else if (currentGoal === 'Maintenance') {
                    workout = {
                        title: 'Maintenance Run',
                        desc: 'Keep the habit alive. Enjoy the scenery.',
                        duration: 30, dist: '5 km', type: 'Run', intensity: 'Moderate',
                        customSteps: [
                             { type: 'Run', color: COLORS.primary, steps: [{ id: 1, text: '30 min steady', icon: 'run', durationSec: 1800 }] }
                        ]
                    };
                }
                // STANDARD TRAINING (Linked to Home)
                else {
                    workout = { 
                        title: 'Easy Run', desc: 'Zone 2 Recovery.', duration: 30, dist: '4 km', type: 'Run', intensity: 'Low', 
                        customSteps: [{ type: 'Easy', color: '#4CD964', steps: [{ id: 1, text: '30 min easy', icon: 'run', durationSec: 1800 }] }] 
                    };
                    
                    if (index === 6 || index === 5) {
                        workout = { 
                            title: 'Long Run', desc: 'Endurance building.', duration: 60, dist: '10 km', type: 'Endurance', intensity: 'Moderate',
                            customSteps: [{ type: 'Run', color: COLORS.primary, steps: [{ id: 1, text: '60 min long run', icon: 'run', durationSec: 3600 }] }] 
                        };
                    }
                    else if (index === 2) {
                        workout = { 
                            title: 'Speed Intervals', desc: 'VO2 Max work.', duration: 45, dist: '6 km', type: 'Intervals', intensity: 'High',
                            customSteps: [
                                { type: 'Warm Up', color: '#4CD964', steps: [{ id: 1, text: '10 min warm up', icon: 'walk', durationSec: 600 }] },
                                { type: 'Intervals', color: '#FF3B30', steps: [{ id: 2, text: '8x400m Fast', icon: 'run-fast', durationSec: 1200 }] }
                            ]
                        };
                    }
                }

                plan[day] = { isRest: false, ...workout };
            } else {
                plan[day] = { isRest: true, title: 'Rest & Recovery', desc: 'Active recovery day.', type: 'Rest' };
            }
        });
        return plan;
    }, [userData]); // Recalculates immediately when userData changes

    const activePlan = weeklyPlan[selectedDate.dayKey] || { isRest: true, title: 'Rest', desc: 'Rest day' };

    // --- HANDLERS ---
    
    // START RUN (Linked to WorkoutDetail)
    const handleStart = () => {
        if (activePlan.isRest) return;
        
        // Pass the calculated workout directly to the runner
        navigation.navigate('WorkoutDetail', { 
            workout: {
                name: activePlan.title,
                desc: activePlan.desc,
                duration: activePlan.duration,
                type: activePlan.type,
                intensity: activePlan.intensity,
                customSteps: activePlan.customSteps || []
            }
        });
    };

    const handleUpgrade = () => navigation.navigate('Paywall');

    const handleGoalSelect = (newGoal) => {
        updateUserProfile({ goal: newGoal, savedGoal: null });
        setShowGoalModal(false);
        Alert.alert("Goal Updated", `Your plan is now optimized for ${newGoal}.`);
    };

    const toggleDay = (day) => {
        if (tempRunDays.includes(day)) setTempRunDays(tempRunDays.filter(d => d !== day));
        else setTempRunDays([...tempRunDays, day]);
    };

    const saveSchedule = () => {
        updateUserProfile({ runDays: tempRunDays });
        setShowScheduleModal(false);
        Alert.alert("Schedule Updated", "Your upcoming workouts have been rescheduled.");
    };

    // --- LOGIC: INJURY & VACATION TOGGLES ---
    // This updates the Global User Context immediately
    const handleInjuryToggle = () => {
        const isInjured = userData.goal === 'Recovery';
        if (isInjured) {
            // BACK FROM INJURY
            const previousGoal = userData.savedGoal || '10k';
            updateUserProfile({ goal: previousGoal, savedGoal: null });
            setShowEditMenu(false);
            Alert.alert("Welcome Back!", "Injury mode disabled. Plan restored.");
        } else {
            // I'M INJURED
            Alert.alert("Recovery Mode", "Switching to low-impact recovery?", [
                { text: "Cancel", style: "cancel" },
                { text: "Activate", style: 'destructive', onPress: () => {
                    updateUserProfile({ goal: 'Recovery', savedGoal: userData.goal || '10k' });
                    setShowEditMenu(false);
                }}
            ]);
        }
    };

    const handleVacationToggle = () => {
        const isVacation = userData.goal === 'Maintenance';
        if (isVacation) {
            // BACK FROM VACATION
            const previousGoal = userData.savedGoal || '10k';
            updateUserProfile({ goal: previousGoal, savedGoal: null });
            setShowEditMenu(false);
            Alert.alert("Welcome Back!", "Vacation mode disabled. Plan restored.");
        } else {
            // I'M ON VACATION
            Alert.alert("Vacation Mode", "Switching to easy maintenance runs?", [
                { text: "Cancel", style: "cancel" },
                { text: "Activate", onPress: () => {
                    updateUserProfile({ goal: 'Maintenance', savedGoal: userData.goal || '10k' });
                    setShowEditMenu(false);
                }}
            ]);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            <SafeAreaView style={styles.header}>
                <Text style={styles.headerTitle}>My Plan</Text>
                
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    {!userData.isPro && (
                        <TouchableOpacity style={styles.headerUpgradeBtn} onPress={handleUpgrade} activeOpacity={0.7}>
                            <Text style={styles.headerUpgradeText}>UPGRADE</Text>
                        </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity style={styles.editBtn} onPress={() => setShowEditMenu(true)} activeOpacity={0.7}>
                        <MaterialCommunityIcons name="pencil" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* CALENDAR STRIP */}
                <View style={styles.calendarRow}>
                    {weekDates.map((item, index) => {
                        const isSelected = selectedDate.fullDate === item.fullDate;
                        const hasRun = weeklyPlan[item.dayKey] && !weeklyPlan[item.dayKey].isRest;
                        return (
                            <TouchableOpacity key={index} style={[styles.dayItem, isSelected && styles.dayItemSelected]} onPress={() => setSelectedDate(item)}>
                                <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>{item.dayName}</Text>
                                <Text style={[styles.dayNum, isSelected && styles.dayTextSelected]}>{item.dayNum}</Text>
                                {hasRun && <View style={[styles.dot, isSelected && { backgroundColor: '#000' }]} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* STATUS BANNERS (Visible Feedback) */}
                {userData.goal === 'Recovery' && (
                    <View style={styles.statusBanner}>
                        <FontAwesome5 name="user-injured" size={14} color="#000" />
                        <Text style={styles.statusBannerText}>Recovery Mode Active</Text>
                    </View>
                )}
                {userData.goal === 'Maintenance' && (
                    <View style={[styles.statusBanner, {backgroundColor: '#00BFFF'}]}>
                        <Ionicons name="airplane" size={16} color="#000" />
                        <Text style={styles.statusBannerText}>Vacation Mode Active</Text>
                    </View>
                )}

                {/* WORKOUT CARD */}
                <View style={styles.planCard}>
                    <Text style={styles.cardHeaderDate}>
                        {selectedDate.isToday ? "Today: " : ""}{selectedDate.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={styles.workoutTitle}>{activePlan.title}</Text>
                    <Text style={styles.workoutDesc}>{activePlan.desc}</Text>
                    
                    {/* FIXED: START RUN BUTTON */}
                    <TouchableOpacity 
                        style={[styles.mainActionBtn, activePlan.isRest && styles.restBtn]} 
                        onPress={handleStart} 
                        disabled={activePlan.isRest}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.mainActionText, activePlan.isRest && { color: '#FFF' }]}>
                            {activePlan.isRest ? "Rest Day" : "Start Workout"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* UPCOMING SCHEDULE */}
                <Text style={styles.sectionTitle}>Upcoming Schedule</Text>
                {userData.isPro ? (
                    <View>
                        {futurePlanData.map((week, idx) => (
                            <View key={idx} style={styles.weekCard}>
                                <View style={styles.weekCardHeader}>
                                    <View>
                                        <Text style={styles.weekCardTitle}>Week {week.weekNum}</Text>
                                        <Text style={styles.weekCardFocus}>{week.focus}</Text>
                                    </View>
                                    <View style={styles.weekDistBadge}>
                                        <Text style={styles.weekDistText}>{week.totalDist}</Text>
                                    </View>
                                </View>
                                <View style={styles.weekDivider} />
                                {week.workouts.map((wo, wIdx) => (
                                    <View key={wIdx} style={styles.fwRow}>
                                        <View style={styles.fwIconBox}>
                                            <Ionicons name={wo.icon} size={14} color={COLORS.primary} />
                                        </View>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.fwTitle}>{wo.title}</Text>
                                            <Text style={styles.fwDetail}>{wo.detail}</Text>
                                        </View>
                                        <Text style={styles.fwDay}>{wo.day}</Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>
                ) : (
                    <LinearGradient colors={['#222222', '#111111']} style={styles.upsellCard}>
                        <View style={styles.upsellContent}>
                            <Text style={styles.upsellTitle}>Unlock Future Plans</Text>
                            <View style={styles.featureItem}><Ionicons name="lock-closed" size={16} color={COLORS.primary} /><Text style={styles.featureText}>See your full 4-week schedule</Text></View>
                            <View style={styles.featureItem}><Ionicons name="lock-closed" size={16} color={COLORS.primary} /><Text style={styles.featureText}>Plan adapts to your run days</Text></View>
                            <TouchableOpacity style={styles.upgradeBtnSmall} onPress={handleUpgrade}>
                                <Text style={styles.upgradeBtnTextSmall}>View Full Schedule</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                )}
                <View style={{height: 150}} />
            </ScrollView>

            {/* EDIT MENU MODAL */}
            <Modal transparent={true} visible={showEditMenu} animationType="fade" onRequestClose={() => setShowEditMenu(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEditMenu(false)}>
                    <View style={styles.editMenuContainer}>
                        <View style={styles.menuContent}>
                            
                            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowEditMenu(false); setShowGoalModal(true); }}>
                                <MaterialCommunityIcons name="flag-checkered" size={20} color="#FFF" style={{marginRight: 10}} />
                                <Text style={styles.menuText}>Change my Goal</Text>
                            </TouchableOpacity>
                            
                            <View style={styles.menuDivider} />
                            
                            <TouchableOpacity style={styles.menuItem} onPress={() => { 
                                setTempRunDays(userData.runDays || []); 
                                setShowEditMenu(false); 
                                setShowScheduleModal(true); 
                            }}>
                                <MaterialCommunityIcons name="calendar-edit" size={20} color="#FFF" style={{marginRight: 10}} />
                                <Text style={styles.menuText}>Adjust My Schedule</Text>
                            </TouchableOpacity>

                            <View style={styles.menuDivider} />

                            <TouchableOpacity style={styles.menuItem} onPress={handleInjuryToggle}>
                                <FontAwesome5 
                                    name={userData.goal === 'Recovery' ? "running" : "user-injured"} 
                                    size={16} 
                                    color={userData.goal === 'Recovery' ? COLORS.primary : "#FFF"} 
                                    style={{marginRight: 12, marginLeft: 2}} 
                                />
                                <Text style={[styles.menuText, userData.goal === 'Recovery' && {color: COLORS.primary}]}>
                                    {userData.goal === 'Recovery' ? "I'm Recovered" : "I'm Injured"}
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.menuDivider} />

                            <TouchableOpacity style={styles.menuItem} onPress={handleVacationToggle}>
                                <MaterialCommunityIcons 
                                    name={userData.goal === 'Maintenance' ? "home" : "palm-tree"} 
                                    size={20} 
                                    color={userData.goal === 'Maintenance' ? COLORS.primary : "#FFF"} 
                                    style={{marginRight: 10}} 
                                />
                                <Text style={[styles.menuText, userData.goal === 'Maintenance' && {color: COLORS.primary}]}>
                                    {userData.goal === 'Maintenance' ? "Back from Vacation" : "I'm on Vacation"}
                                </Text>
                            </TouchableOpacity>

                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* GOAL MODAL */}
            <Modal animationType="slide" transparent={true} visible={showGoalModal} onRequestClose={() => setShowGoalModal(false)}>
                <View style={styles.subModalContainer}>
                    <View style={styles.subModalContent}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.subTitleText}>Select New Goal</Text>
                            <TouchableOpacity onPress={() => setShowGoalModal(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
                        </View>
                        {['5k', '10k', 'Half Marathon', 'Weight Loss'].map(goal => (
                            <TouchableOpacity key={goal} style={[styles.priceOption, userData.goal === goal && styles.priceOptionSelected]} onPress={() => handleGoalSelect(goal)}>
                                <Text style={styles.priceTitle}>{goal}</Text>
                                {userData.goal === goal && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

            {/* SCHEDULE MODAL */}
            <Modal animationType="slide" transparent={true} visible={showScheduleModal} onRequestClose={() => setShowScheduleModal(false)}>
                <View style={styles.subModalContainer}>
                    <View style={styles.subModalContent}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.subTitleText}>Edit Weekly Schedule</Text>
                            <TouchableOpacity onPress={() => setShowScheduleModal(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
                        </View>
                        <View style={{flexDirection:'row', flexWrap:'wrap', gap: 10, marginBottom: 20}}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <TouchableOpacity 
                                    key={day} 
                                    style={[styles.dayItem, tempRunDays.includes(day) && styles.dayItemSelected, {width: '30%', marginBottom: 10}]} 
                                    onPress={() => toggleDay(day)}
                                >
                                    <Text style={[styles.dayName, tempRunDays.includes(day) && styles.dayTextSelected, {fontSize: 16}]}>{day}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.trialBtn} onPress={saveSchedule}>
                            <Text style={styles.trialBtnText}>Save Schedule</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <FloatingNavBar current="Plan" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { paddingBottom: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, zIndex: 10 },
    headerTitle: { color: '#FFF', fontSize: 28, fontFamily: 'Poppins_700Bold' },
    editBtn: { width: 40, height: 40, backgroundColor: '#222', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    headerUpgradeBtn: { backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary, marginRight: 10 },
    headerUpgradeText: { color: COLORS.primary, fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },

    calendarRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 25 },
    dayItem: { width: (width - 40) / 7 - 5, height: 60, backgroundColor: '#1C1C1E', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    dayItemSelected: { backgroundColor: COLORS.primary },
    dayName: { color: '#888', fontSize: 10, fontFamily: 'Poppins_600SemiBold', marginBottom: 2 },
    dayNum: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    dayTextSelected: { color: '#000' },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary, marginTop: 4 },

    planCard: { backgroundColor: '#1C1C1E', marginHorizontal: 20, borderRadius: 24, padding: 25, minHeight: 180, marginBottom: 20 },
    cardHeaderDate: { color: '#AAA', fontSize: 16, fontFamily: 'Poppins_500Medium', marginBottom: 10 },
    workoutTitle: { color: '#FFF', fontSize: 28, fontFamily: 'Poppins_700Bold', lineHeight: 34, marginBottom: 10 },
    workoutDesc: { color: '#AAA', fontSize: 14, lineHeight: 20, marginBottom: 25 },
    mainActionBtn: { backgroundColor: COLORS.primary, width: '100%', height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
    restBtn: { backgroundColor: '#333' },
    mainActionText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },

    statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, marginHorizontal: 20, borderRadius: 10, padding: 10, marginBottom: 15 },
    statusBannerText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 12, marginLeft: 8 },

    sectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_600SemiBold', marginBottom: 15, paddingHorizontal: 20 },
    weekCard: { backgroundColor: '#181818', borderRadius: 20, marginHorizontal: 20, marginBottom: 15, padding: 20, borderWidth: 1, borderColor: '#222' },
    weekCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    weekCardTitle: { color: COLORS.primary, fontSize: 12, fontFamily: 'Poppins_700Bold', letterSpacing: 1, textTransform: 'uppercase' },
    weekCardFocus: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
    weekDistBadge: { backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    weekDistText: { color: '#AAA', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    weekDivider: { height: 1, backgroundColor: '#333', marginBottom: 15 },
    
    fwRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    fwIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(204, 255, 0, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    fwTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    fwDetail: { color: '#666', fontSize: 12 },
    fwDay: { color: '#444', fontSize: 12, fontFamily: 'Poppins_700Bold' },

    upsellCard: { marginHorizontal: 20, marginTop: 10, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary, overflow: 'hidden' }, 
    upsellContent: { padding: 25 },
    upsellTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 15 },
    featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    featureText: { color: '#DDD', fontSize: 13, marginLeft: 10 },
    upgradeBtnSmall: { backgroundColor: '#FFF', paddingVertical: 12, borderRadius: 25, alignItems: 'center', marginTop: 15 },
    upgradeBtnTextSmall: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 14 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    editMenuContainer: { position: 'absolute', top: 120, right: 20 },
    menuContent: { backgroundColor: 'rgba(30,30,30,0.95)', borderRadius: 12, paddingVertical: 5, width: 220 },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    menuText: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_500Medium' },
    menuDivider: { height: 1, backgroundColor: '#333', marginHorizontal: 10 },
    subModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    subModalContent: { backgroundColor: '#101010', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    subTitleText: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold' },
    priceOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    priceOptionSelected: { borderColor: COLORS.primary, borderWidth: 2 },
    priceTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    trialBtn: { backgroundColor: COLORS.primary, height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    trialBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },
});