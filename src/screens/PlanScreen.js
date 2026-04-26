import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
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
import FloatingNavBar from '../components/FloatingNavBar';
import { useUser } from '../context/UserContext';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';

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
            isPast: d < new Date().setHours(0, 0, 0, 0)
        };
    });
};

export default function PlanScreen({ navigation }) {
    // --- HELPERS FROM CONTEXT ---
    const { userData, updateUserProfile, updateTrainingPlan } = useUser();

    const weekDates = useMemo(() => getCurrentWeek(), []);
    const [selectedDate, setSelectedDate] = useState(weekDates.find(d => d.isToday) || weekDates[0]);

    const [showEditMenu, setShowEditMenu] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [tempRunDays, setTempRunDays] = useState(userData?.runDays || []);

    // Ensure Plan Exists (Self-Healing)
    useEffect(() => {
        if (!userData.trainingPlan) {
            updateTrainingPlan('Active', userData.goal || '10k');
        }
    }, [userData.trainingPlan]);

    // Use Persistent Plan or Fallback
    const currentPlan = userData.trainingPlan || { weeks: [], status: 'Active' };
    const activeGoal = currentPlan.activeGoal || '10k';
    const planStatus = currentPlan.status || 'Active';

    // --- MAIN PLAN LOGIC (Read from Persistent Object) ---
    const weeklyPlan = useMemo(() => {
        const plan = {};
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        // Get current week (Week 1 of the generated plan for simplicity in this demo)
        const currentWeekData = currentPlan.weeks?.[0] || { workouts: [] };

        days.forEach((day, index) => {
            const workoutData = currentWeekData.workouts.find(w => w.day === day);

            if (workoutData) {
                // Parse distance from detail (e.g. "8km Steady" -> 8)
                const distKm = workoutData.detail.includes('km')
                    ? parseFloat(workoutData.detail.split('km')[0]) || 0
                    : 0;

                // Estimate duration from distance (~6 min/km for easy, ~5.5 for speed)
                const isSpeed = workoutData.icon === 'stopwatch';
                const estDuration = distKm > 0
                    ? Math.round(distKm * (isSpeed ? 5.5 : 6) + 10) // +10 for warm-up/cool-down
                    : 30;

                // Determine intensity from workout type
                const intensity = isSpeed ? 'High'
                    : workoutData.title === 'Long Run' ? 'Moderate'
                    : 'Low';

                plan[day] = {
                    isRest: workoutData.isRest,
                    completed: workoutData.completed || false,
                    completedDistance: workoutData.completedDistance || 0,
                    completedAt: workoutData.completedAt || null,
                    title: workoutData.title,
                    desc: workoutData.detail,
                    duration: estDuration,
                    dist: distKm.toString(),
                    type: isSpeed ? 'Intervals' : 'Run',
                    intensity,
                };
            } else {
                plan[day] = { isRest: true, title: 'Rest & Recovery', desc: 'Active recovery day.', type: 'Rest' };
            }
        });
        return plan;
    }, [currentPlan]);

    const activePlan = weeklyPlan[selectedDate.dayKey] || { isRest: true, title: 'Rest', desc: 'Rest day' };

    // --- HANDLERS ---

    // START RUN (Linked to WorkoutDetail)
    const handleStart = () => {
        lightTap();
        if (activePlan.isRest) return;
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

    const handleUpgrade = () => { lightTap(); navigation.navigate('Paywall'); };

    const handleGoalSelect = (newGoal) => {
        lightTap();
        // AI RECALCULATE
        updateTrainingPlan('Active', newGoal);
        setShowGoalModal(false);
        successFeedback();
        Alert.alert("AI Plan Updated", `We've built a new ${newGoal} schedule for you.`);
    };

    const toggleDay = (day) => {
        lightTap();
        if (tempRunDays.includes(day)) setTempRunDays(tempRunDays.filter(d => d !== day));
        else setTempRunDays([...tempRunDays, day]);
    };

    const saveSchedule = () => {
        successFeedback();
        updateUserProfile({ runDays: tempRunDays });
        setShowScheduleModal(false);
        // Regenerate plan with NEW days explicitly
        updateTrainingPlan(planStatus, activeGoal, tempRunDays);
        Alert.alert("Schedule Updated", "Your upcoming workouts have been rescheduled.");
    };

    // --- LOGIC: INJURY & VACATION TOGGLES ---
    // Now uses updateTrainingPlan to switch modes while keeping memory of the main goal
    const handleInjuryToggle = () => {
        lightTap();
        const isInjured = planStatus === 'Injured';

        if (isInjured) {
            // BACK FROM INJURY -> RECOVERED -> ACTIVE
            Alert.alert("Welcome Back!", "Glad you're feeling better. We'll ease you back in.", [
                {
                    text: "Let's Go", onPress: () => {
                        successFeedback();
                        updateTrainingPlan('Active', activeGoal); // Restore Goal
                        setShowEditMenu(false);
                    }
                }
            ]);
        } else {
            // I'M INJURED
            Alert.alert("Injury Mode", "Sorry to hear that. We'll pause your intensity and switch to recovery protocols.", [
                { text: "Cancel", style: "cancel", onPress: () => lightTap() },
                {
                    text: "Activate Injury Mode", style: 'destructive', onPress: () => {
                        successFeedback();
                        updateTrainingPlan('Injured'); // AI handles the switch
                        setShowEditMenu(false);
                    }
                }
            ]);
        }
    };

    const handleVacationToggle = () => {
        lightTap();
        const isVacation = planStatus === 'Vacation';

        if (isVacation) {
            // BACK FROM VACATION
            successFeedback();
            updateTrainingPlan('Active', activeGoal);
            setShowEditMenu(false);
            Alert.alert("Welcome Back!", "Hope you had a great trip! Schedule restored.");
        } else {
            // I'M ON VACATION
            Alert.alert("Vacation Mode", "Switching to maintenance mode? We'll keep runs short and scenic.", [
                { text: "Cancel", style: "cancel", onPress: () => lightTap() },
                {
                    text: "Activate Vacation Mode", onPress: () => {
                        successFeedback();
                        updateTrainingPlan('Vacation');
                        setShowEditMenu(false);
                    }
                }
            ]);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <SafeAreaView style={styles.header}>
                <Text style={styles.headerTitle}>My Plan</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!userData.isPro && (
                        <TouchableOpacity activeOpacity={0.7} style={styles.headerUpgradeBtn} onPress={handleUpgrade}>
                            <Text style={styles.headerUpgradeText}>UPGRADE</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity activeOpacity={0.7} style={[styles.editBtn, { marginRight: 10, backgroundColor: COLORS.primary }]} onPress={() => { lightTap(); navigation.navigate('AICoach', { initialPrompt: "I need to adjust my plan..." }); }}>
                        <MaterialCommunityIcons name="robot" size={20} color="#000" />
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7} style={styles.editBtn} onPress={() => { lightTap(); setShowEditMenu(true); }}>
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
                        const isCompleted = weeklyPlan[item.dayKey] && weeklyPlan[item.dayKey].completed;
                        return (
                            <TouchableOpacity activeOpacity={0.7} key={index} style={[styles.dayItem, isSelected && styles.dayItemSelected]} onPress={() => { lightTap(); setSelectedDate(item); }}>
                                <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>{item.dayName}</Text>
                                <Text style={[styles.dayNum, isSelected && styles.dayTextSelected]}>{item.dayNum}</Text>
                                {isCompleted ? (
                                    <Ionicons name="checkmark-circle" size={12} color={isSelected ? "#000" : "#32CD32"} style={{ marginTop: 2 }} />
                                ) : (
                                    hasRun && <View style={[styles.dot, isSelected && { backgroundColor: '#000' }]} />
                                )}                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* STATUS BANNERS (Visible Feedback) */}
                {planStatus === 'Injured' && (
                    <View style={styles.statusBanner}>
                        <FontAwesome5 name="user-injured" size={14} color="#000" />
                        <Text style={styles.statusBannerText}>Recovery Mode Active - Plan Paused</Text>
                    </View>
                )}
                {planStatus === 'Vacation' && (
                    <View style={[styles.statusBanner, { backgroundColor: '#00BFFF' }]}>
                        <Ionicons name="airplane" size={16} color="#000" />
                        <Text style={styles.statusBannerText}>Vacation Mode Active - Plan Paused</Text>
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
                    {activePlan.completed && (
                        <View style={{ position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(50, 205, 50, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="checkmark-circle" size={14} color="#32CD32" />
                            <Text style={{ color: '#32CD32', fontSize: 10, marginLeft: 4, fontWeight: 'bold' }}>COMPLETED</Text>
                        </View>
                    )}
                    <TouchableOpacity
                        style={[styles.mainActionBtn, activePlan.isRest && styles.restBtn, activePlan.completed && { backgroundColor: '#333' }]}
                        onPress={handleStart}
                        disabled={activePlan.isRest || activePlan.completed}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.mainActionText, (activePlan.isRest || activePlan.completed) && { color: '#FFF' }]}>
                            {activePlan.completed ? "Workout Completed" : (activePlan.isRest ? "Rest Day" : "Start Workout")}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* UPCOMING SCHEDULE */}
                <Text style={styles.sectionTitle}>Upcoming Schedule</Text>
                {userData.isPro ? (
                    <View>
                        {currentPlan.weeks?.map((week, idx) => (
                            <View key={idx} style={styles.weekCard}>
                                <View style={styles.weekCardHeader}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={styles.weekCardTitle}>{week.focus.toUpperCase()}</Text>
                                        <Text style={styles.weekCardFocus}>Week {week.weekNum}</Text>
                                    </View>
                                    <View style={styles.weekDistBadge}>
                                        <Text style={styles.weekDistText}>{week.totalDist}</Text>
                                    </View>
                                </View>
                                <View style={styles.weekDivider} />
                                {week.workouts.map((wo, wIdx) => (
                                    <View key={wIdx} style={styles.fwRow}>
                                        <View style={[styles.fwIconBox, wo.isRest && { opacity: 0.5 }, wo.completed && { backgroundColor: 'rgba(50, 205, 50, 0.1)' }]}>
                                            <Ionicons name={wo.completed ? "checkmark-circle" : wo.icon} size={14} color={wo.completed ? "#32CD32" : (wo.isRest ? "#666" : COLORS.primary)} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={[styles.fwTitle, wo.isRest && { color: '#888' }]}>{wo.title}</Text>
                                                {wo.completed && <Ionicons name="checkmark-circle" size={14} color="#32CD32" style={{ marginLeft: 6 }} />}
                                            </View>
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
                            <TouchableOpacity activeOpacity={0.7} style={styles.upgradeBtnSmall} onPress={handleUpgrade}>
                                <Text style={styles.upgradeBtnTextSmall}>View Full Schedule</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                )}
                <View style={{ height: 150 }} />
            </ScrollView>

            {/* EDIT MENU MODAL */}
            <Modal transparent={true} visible={showEditMenu} animationType="fade" onRequestClose={() => setShowEditMenu(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEditMenu(false)}>
                    <View style={styles.editMenuContainer}>
                        <View style={styles.menuContent}>

                            <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={() => { lightTap(); setShowEditMenu(false); setShowGoalModal(true); }}>
                                <MaterialCommunityIcons name="flag-checkered" size={20} color="#FFF" style={{ marginRight: 10 }} />
                                <Text style={styles.menuText}>Change my Goal</Text>
                            </TouchableOpacity>

                            <View style={styles.menuDivider} />

                            <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={() => {
                                lightTap();
                                setTempRunDays(userData.runDays || []);
                                setShowEditMenu(false);
                                setShowScheduleModal(true);
                            }}>
                                <MaterialCommunityIcons name="calendar-edit" size={20} color="#FFF" style={{ marginRight: 10 }} />
                                <Text style={styles.menuText}>Adjust My Schedule</Text>
                            </TouchableOpacity>

                            <View style={styles.menuDivider} />

                            <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={handleInjuryToggle}>
                                <FontAwesome5
                                    name={planStatus === 'Injured' ? "running" : "user-injured"}
                                    size={16}
                                    color={planStatus === 'Injured' ? COLORS.primary : "#FFF"}
                                    style={{ marginRight: 12, marginLeft: 2 }}
                                />
                                <Text style={[styles.menuText, planStatus === 'Injured' && { color: COLORS.primary }]}>
                                    {planStatus === 'Injured' ? "I'm Recovered" : "I'm Injured"}
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.menuDivider} />

                            <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={handleVacationToggle}>
                                <MaterialCommunityIcons
                                    name={planStatus === 'Vacation' ? "home" : "palm-tree"}
                                    size={20}
                                    color={planStatus === 'Vacation' ? COLORS.primary : "#FFF"}
                                    style={{ marginRight: 10 }}
                                />
                                <Text style={[styles.menuText, planStatus === 'Vacation' && { color: COLORS.primary }]}>
                                    {planStatus === 'Vacation' ? "Back from Vacation" : "I'm on Vacation"}
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
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowGoalModal(false); }}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
                        </View>
                        {['5k', '10k', 'Half Marathon', 'Weight Loss'].map(goal => (
                            <TouchableOpacity activeOpacity={0.7} key={goal} style={[styles.priceOption, userData.goal === goal && styles.priceOptionSelected]} onPress={() => handleGoalSelect(goal)}>
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
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowScheduleModal(false); }}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <TouchableOpacity activeOpacity={0.7}
                                    key={day}
                                    style={[styles.dayItem, tempRunDays.includes(day) && styles.dayItemSelected, { width: '30%', marginBottom: 10 }]}
                                    onPress={() => toggleDay(day)}
                                >
                                    <Text style={[styles.dayName, tempRunDays.includes(day) && styles.dayTextSelected, { fontSize: 16 }]}>{day}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity activeOpacity={0.7} style={styles.trialBtn} onPress={saveSchedule}>
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
    weekCardTitle: { color: COLORS.primary, fontSize: 13, fontFamily: 'Poppins_700Bold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    weekCardFocus: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_500Medium', color: '#888' },
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