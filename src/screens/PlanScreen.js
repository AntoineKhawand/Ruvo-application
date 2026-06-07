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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingNavBar from '../components/FloatingNavBar';
import SkeletonCard from '../components/SkeletonCard';
import { useUser } from '../context/UserContext';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';

const { width } = Dimensions.get('window');

const HEATMAP_COLS = 16;
const HEATMAP_GAP = 3;
const HEATMAP_CELL = Math.floor((width - 108 - (HEATMAP_COLS - 1) * HEATMAP_GAP) / HEATMAP_COLS);

const ACCENT = '#CCFF00';
const COLORS = {
    primary: ACCENT,
    secondary: '#1C1C1E',
    background: '#000000',
    card: '#121212',
    text: '#FFFFFF',
    subText: '#888888',
    divider: '#333333',
    overlay: 'rgba(0,0,0,0.85)',
};

const INTENSITY_COLOR = { High: '#FF6B6B', Moderate: '#FFD700', Low: ACCENT, Rest: '#444' };
const TYPE_COLOR = { Intervals: '#FF6B6B', 'Long Run': '#FFD700', Run: ACCENT, Rest: '#333' };

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
            isPast: d < new Date().setHours(0, 0, 0, 0),
        };
    });
};

export default function PlanScreen({ navigation }) {
    const { userData, isLoading, updateUserProfile, updateTrainingPlan, habits, addHabit, deleteHabit, toggleHabitCompletion } = useUser();

    const weekDates = useMemo(() => getCurrentWeek(), []);
    const [selectedDate, setSelectedDate] = useState(weekDates.find(d => d.isToday) || weekDates[0]);
    const [showEditMenu, setShowEditMenu] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [tempRunDays, setTempRunDays] = useState(userData?.runDays || []);

    useEffect(() => {
        if (!userData.trainingPlan) updateTrainingPlan('Active', userData.goal || '10k');
    }, [userData.trainingPlan]);

    const currentPlan = userData.trainingPlan || { weeks: [], status: 'Active' };
    const activeGoal = currentPlan.activeGoal || '10k';
    const planStatus = currentPlan.status || 'Active';

    const weeklyPlan = useMemo(() => {
        const plan = {};
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const currentWeekData = currentPlan.weeks?.[0] || { workouts: [] };
        days.forEach(day => {
            const workoutData = currentWeekData.workouts.find(w => w.day === day);
            if (workoutData) {
                const distKm = workoutData.detail.includes('km')
                    ? parseFloat(workoutData.detail.split('km')[0]) || 0 : 0;
                const isSpeed = workoutData.icon === 'stopwatch';
                const estDuration = distKm > 0 ? Math.round(distKm * (isSpeed ? 5.5 : 6) + 10) : 30;
                const intensity = isSpeed ? 'High' : workoutData.title === 'Long Run' ? 'Moderate' : 'Low';
                plan[day] = {
                    isRest: workoutData.isRest,
                    completed: workoutData.completed || false,
                    completedDistance: workoutData.completedDistance || 0,
                    completedAt: workoutData.completedAt || null,
                    title: workoutData.title,
                    desc: workoutData.detail,
                    duration: estDuration,
                    dist: distKm.toString(),
                    type: isSpeed ? 'Intervals' : workoutData.title === 'Long Run' ? 'Long Run' : 'Run',
                    intensity,
                };
            } else {
                plan[day] = { isRest: true, title: 'Rest & Recovery', desc: 'Active recovery day.', type: 'Rest', intensity: 'Rest' };
            }
        });
        return plan;
    }, [currentPlan]);

    const activePlan = weeklyPlan[selectedDate.dayKey] || { isRest: true, title: 'Rest', desc: 'Rest day', type: 'Rest', intensity: 'Rest' };
    const stripeColor = INTENSITY_COLOR[activePlan.intensity] || ACCENT;

    const [showAddHabitModal, setShowAddHabitModal] = useState(false);
    const [newHabitName, setNewHabitName] = useState('');
    const [newHabitDesc, setNewHabitDesc] = useState('');
    const [newHabitFrequency, setNewHabitFrequency] = useState(3);
    const [newHabitIcon, setNewHabitIcon] = useState('run-fast');

    const getHabitIndices = (completions = []) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const indices = new Set();
        completions.forEach(dateStr => {
            const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
            const diffWeeks = Math.floor((today - d) / (7 * 86400000));
            if (diffWeeks >= 0 && diffWeeks < HEATMAP_COLS)
                indices.add(d.getDay() * HEATMAP_COLS + (HEATMAP_COLS - 1 - diffWeeks));
        });
        return [...indices];
    };

    const handleAddHabit = async () => {
        if (!newHabitName.trim()) return;
        lightTap();
        await addHabit({ name: newHabitName.trim(), description: newHabitDesc.trim(), frequency: newHabitFrequency, icon: newHabitIcon });
        setNewHabitName(''); setNewHabitDesc(''); setNewHabitFrequency(3); setNewHabitIcon('run-fast');
        setShowAddHabitModal(false);
        successFeedback();
    };

    const renderHeatmap = (activeIndices) => (
        <View style={styles.hmContainer}>
            <View style={styles.hmLabels}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <Text key={i} style={styles.hmLabel}>{d}</Text>
                ))}
            </View>
            <View style={styles.hmGrid}>
                {Array.from({ length: HEATMAP_COLS * 7 }, (_, i) => (
                    <View key={i} style={[styles.hmCell, activeIndices.includes(i) && styles.hmCellActive]} />
                ))}
            </View>
        </View>
    );

    const handleStart = () => {
        lightTap();
        if (activePlan.isRest) return;
        navigation.navigate('WorkoutDetail', {
            workout: {
                name: activePlan.title, desc: activePlan.desc,
                duration: activePlan.duration, type: activePlan.type,
                intensity: activePlan.intensity, customSteps: activePlan.customSteps,
            },
        });
    };

    const handleUpgrade = () => { lightTap(); navigation.navigate('Paywall'); };

    const handleGoalSelect = (newGoal) => {
        lightTap();
        updateTrainingPlan('Active', newGoal);
        setShowGoalModal(false);
        successFeedback();
        Alert.alert('AI Plan Updated', `We've built a new ${newGoal} schedule for you.`);
    };

    const toggleDay = (day) => {
        lightTap();
        setTempRunDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    const saveSchedule = () => {
        successFeedback();
        updateUserProfile({ runDays: tempRunDays });
        setShowScheduleModal(false);
        updateTrainingPlan(planStatus, activeGoal, tempRunDays);
        Alert.alert('Schedule Updated', 'Your upcoming workouts have been rescheduled.');
    };

    const handleInjuryToggle = () => {
        lightTap();
        const isInjured = planStatus === 'Injured';
        if (isInjured) {
            Alert.alert('Welcome Back!', "Glad you're feeling better. We'll ease you back in.", [{
                text: "Let's Go", onPress: () => { successFeedback(); updateTrainingPlan('Active', activeGoal); setShowEditMenu(false); },
            }]);
        } else {
            Alert.alert('Injury Mode', "Sorry to hear that. We'll pause your intensity and switch to recovery protocols.", [
                { text: 'Cancel', style: 'cancel', onPress: () => lightTap() },
                { text: 'Activate Injury Mode', style: 'destructive', onPress: () => { successFeedback(); updateTrainingPlan('Injured'); setShowEditMenu(false); } },
            ]);
        }
    };

    const handleVacationToggle = () => {
        lightTap();
        const isVacation = planStatus === 'Vacation';
        if (isVacation) {
            successFeedback();
            updateTrainingPlan('Active', activeGoal);
            setShowEditMenu(false);
            Alert.alert('Welcome Back!', 'Hope you had a great trip! Schedule restored.');
        } else {
            Alert.alert('Vacation Mode', "Switching to maintenance mode? We'll keep runs short and scenic.", [
                { text: 'Cancel', style: 'cancel', onPress: () => lightTap() },
                { text: 'Activate Vacation Mode', onPress: () => { successFeedback(); updateTrainingPlan('Vacation'); setShowEditMenu(false); } },
            ]);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
                <StatusBar barStyle="light-content" />
                <ScrollView showsVerticalScrollIndicator={false}>
                    <SkeletonCard variant="plan" />
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* ── HEADER ── */}
            <SafeAreaView style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>My Plan</Text>
                    <Text style={styles.headerSub}>
                        {planStatus === 'Active' ? `Goal: ${activeGoal.toUpperCase()}` : planStatus === 'Injured' ? 'Recovery Mode' : 'Vacation Mode'}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {!userData.isPro && (
                        <TouchableOpacity activeOpacity={0.7} style={styles.headerUpgradeBtn} onPress={handleUpgrade}>
                            <Text style={styles.headerUpgradeText}>PRO</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity activeOpacity={0.7} style={[styles.editBtn, { backgroundColor: ACCENT }]}
                        onPress={() => { lightTap(); navigation.navigate('AICoach', { initialPrompt: 'I need to adjust my plan...' }); }}>
                        <MaterialCommunityIcons name="robot" size={19} color="#000" />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} style={styles.editBtn} onPress={() => { lightTap(); setShowEditMenu(true); }}>
                        <MaterialCommunityIcons name="pencil" size={19} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── CALENDAR STRIP ── */}
                <View style={styles.calendarRail}>
                    {weekDates.map((item, index) => {
                        const isSelected = selectedDate.fullDate === item.fullDate;
                        const dayPlan = weeklyPlan[item.dayKey];
                        const hasRun = dayPlan && !dayPlan.isRest;
                        const isCompleted = dayPlan?.completed;
                        const dotColor = TYPE_COLOR[dayPlan?.type] || '#444';
                        return (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                key={index}
                                style={[styles.dayItem, isSelected && styles.dayItemSelected, item.isToday && !isSelected && styles.dayItemToday]}
                                onPress={() => { lightTap(); setSelectedDate(item); }}
                            >
                                <Text style={[styles.dayName, isSelected && styles.dayTextSelected, item.isToday && !isSelected && { color: ACCENT }]}>
                                    {item.dayName}
                                </Text>
                                <Text style={[styles.dayNum, isSelected && styles.dayTextSelected]}>
                                    {item.dayNum}
                                </Text>
                                {isCompleted ? (
                                    <Ionicons name="checkmark-circle" size={10} color={isSelected ? '#000' : '#32CD32'} style={{ marginTop: 3 }} />
                                ) : hasRun ? (
                                    <View style={[styles.dot, isSelected ? { backgroundColor: '#000' } : { backgroundColor: dotColor }]} />
                                ) : (
                                    <View style={{ height: 10, marginTop: 3 }} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── STATUS BANNERS ── */}
                {planStatus === 'Injured' && (
                    <View style={[styles.statusBanner, { backgroundColor: 'rgba(255,59,48,0.12)', borderColor: 'rgba(255,59,48,0.3)' }]}>
                        <View style={[styles.statusIconCircle, { backgroundColor: 'rgba(255,59,48,0.2)' }]}>
                            <FontAwesome5 name="user-injured" size={13} color="#FF3B30" />
                        </View>
                        <View>
                            <Text style={[styles.statusBannerTitle, { color: '#FF3B30' }]}>Recovery Mode Active</Text>
                            <Text style={styles.statusBannerSub}>Your plan is paused until you recover</Text>
                        </View>
                    </View>
                )}
                {planStatus === 'Vacation' && (
                    <View style={[styles.statusBanner, { backgroundColor: 'rgba(0,191,255,0.1)', borderColor: 'rgba(0,191,255,0.3)' }]}>
                        <View style={[styles.statusIconCircle, { backgroundColor: 'rgba(0,191,255,0.2)' }]}>
                            <Ionicons name="airplane" size={15} color="#00BFFF" />
                        </View>
                        <View>
                            <Text style={[styles.statusBannerTitle, { color: '#00BFFF' }]}>Vacation Mode Active</Text>
                            <Text style={styles.statusBannerSub}>Maintenance runs only while you're away</Text>
                        </View>
                    </View>
                )}

                {/* ── WORKOUT CARD ── */}
                <View style={[styles.planCard, { borderColor: stripeColor + '33' }]}>
                    {/* Left intensity stripe */}
                    <View style={[styles.planCardStripe, { backgroundColor: stripeColor }]} />

                    <View style={styles.planCardInner}>
                        {/* Completed badge */}
                        {activePlan.completed && (
                            <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-circle" size={13} color="#32CD32" />
                                <Text style={styles.completedBadgeText}>DONE</Text>
                            </View>
                        )}

                        {/* Type chip */}
                        {!activePlan.isRest && (
                            <View style={[styles.typeChip, { backgroundColor: stripeColor + '1A', borderColor: stripeColor + '44' }]}>
                                <Text style={[styles.typeChipText, { color: stripeColor }]}>{activePlan.type?.toUpperCase()}</Text>
                            </View>
                        )}

                        <Text style={styles.cardHeaderDate}>
                            {selectedDate.isToday ? 'Today — ' : ''}{selectedDate.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </Text>
                        <Text style={styles.workoutTitle}>{activePlan.title}</Text>
                        <Text style={styles.workoutDesc}>{activePlan.desc}</Text>

                        {/* Meta badges */}
                        {!activePlan.isRest && (
                            <View style={styles.metaRow}>
                                {activePlan.duration > 0 && (
                                    <View style={styles.metaBadge}>
                                        <Ionicons name="time-outline" size={12} color="#888" />
                                        <Text style={styles.metaBadgeText}>{activePlan.duration} min</Text>
                                    </View>
                                )}
                                {parseFloat(activePlan.dist) > 0 && (
                                    <View style={styles.metaBadge}>
                                        <Ionicons name="footsteps-outline" size={12} color="#888" />
                                        <Text style={styles.metaBadgeText}>{activePlan.dist} km</Text>
                                    </View>
                                )}
                                {activePlan.intensity && (
                                    <View style={[styles.metaBadge, { borderColor: stripeColor + '55', backgroundColor: stripeColor + '12' }]}>
                                        <Ionicons name="flash-outline" size={12} color={stripeColor} />
                                        <Text style={[styles.metaBadgeText, { color: stripeColor }]}>{activePlan.intensity}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Action button */}
                        {activePlan.isRest || activePlan.completed ? (
                            <View style={[styles.mainActionBtn, styles.restBtn]}>
                                <Text style={[styles.mainActionText, { color: activePlan.completed ? '#32CD32' : '#666' }]}>
                                    {activePlan.completed ? 'Workout Completed ✓' : 'Rest Day'}
                                </Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.startBtnWrap}
                                onPress={handleStart}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={[ACCENT, '#B2FF59']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.mainActionBtn}
                                >
                                    <Ionicons name="play-circle" size={20} color="#000" style={{ marginRight: 8 }} />
                                    <Text style={styles.mainActionText}>Start Workout</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* ── MY HABITS ── */}
                <View style={styles.habitsSectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>My Habits</Text>
                        {habits.length > 0 && (
                            <Text style={styles.sectionSub}>{habits.length} habit{habits.length !== 1 ? 's' : ''} tracked</Text>
                        )}
                    </View>
                    <TouchableOpacity activeOpacity={0.7} style={styles.habitAddBtn} onPress={() => { lightTap(); setShowAddHabitModal(true); }}>
                        <Ionicons name="add" size={16} color="#000" />
                        <Text style={styles.habitAddBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {habits.length === 0 ? (
                    <TouchableOpacity activeOpacity={0.8} style={styles.habitEmptyCard} onPress={() => { lightTap(); setShowAddHabitModal(true); }}>
                        <MaterialCommunityIcons name="plus-circle-outline" size={34} color="#2A2A2A" />
                        <Text style={styles.habitEmptyTitle}>No habits yet</Text>
                        <Text style={styles.habitEmptyDesc}>Tap to track your first habit</Text>
                    </TouchableOpacity>
                ) : (
                    habits.map(habit => {
                        const today = new Date().toISOString().split('T')[0];
                        const completions = habit.completions || [];
                        const isDoneToday = completions.includes(today);
                        const now = new Date();
                        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                        const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
                        const monthCount = completions.filter(d => new Date(d) >= monthStart).length;
                        const weekCount = completions.filter(d => new Date(d) >= weekStart).length;
                        const freq = Math.max(habit.frequency || 3, 1);
                        const weekPct = Math.min(Math.round((weekCount / freq) * 100), 100);

                        return (
                            <View key={habit.id} style={styles.habitCard}>
                                {/* Left accent stripe */}
                                <View style={styles.habitStripe} />

                                <View style={styles.habitCardInner}>
                                    <View style={styles.habitTitleRow}>
                                        <View style={styles.habitIconBox}>
                                            <MaterialCommunityIcons name={habit.icon || 'run-fast'} size={22} color={ACCENT} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.habitTitle}>{habit.name}</Text>
                                            <Text style={styles.habitDesc}>{habit.description || `Goal: ${freq}× / week`}</Text>
                                        </View>
                                        {weekPct >= 100 && (
                                            <View style={styles.habitStreakBadge}>
                                                <MaterialCommunityIcons name="fire" size={12} color="#FF6B00" />
                                                <Text style={styles.habitStreakText}>On fire</Text>
                                            </View>
                                        )}
                                        <TouchableOpacity
                                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                            style={{ marginLeft: 10 }}
                                            onPress={() => Alert.alert('Delete Habit', `Delete "${habit.name}"?`, [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(habit.id) },
                                            ])}
                                        >
                                            <Ionicons name="trash-outline" size={17} color="#333" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Stats grid */}
                                    <View style={styles.habitStatsGrid}>
                                        <View style={styles.habitStatBox}>
                                            <Text style={styles.habitStatVal}>{monthCount}</Text>
                                            <Text style={styles.habitStatLabel}>This month</Text>
                                        </View>
                                        <View style={styles.habitStatBox}>
                                            <Text style={[styles.habitStatVal, weekPct >= 100 && { color: ACCENT }]}>{weekPct}%</Text>
                                            <Text style={styles.habitStatLabel}>This week</Text>
                                        </View>
                                        <View style={styles.habitStatBox}>
                                            <Text style={styles.habitStatVal}>{completions.length}</Text>
                                            <Text style={styles.habitStatLabel}>Total</Text>
                                        </View>
                                    </View>

                                    {/* Weekly progress bar */}
                                    <View style={styles.habitProgressRow}>
                                        <View style={styles.habitProgressTrack}>
                                            <LinearGradient
                                                colors={weekPct >= 100 ? [ACCENT, '#B2FF59'] : [ACCENT + 'AA', ACCENT]}
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                style={[styles.habitProgressFill, { width: `${weekPct}%` }]}
                                            />
                                        </View>
                                        <Text style={styles.habitProgressLabel}>{weekCount}/{freq}</Text>
                                    </View>

                                    {renderHeatmap(getHabitIndices(completions))}

                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={[styles.habitDoneBtn, isDoneToday && styles.habitDoneBtnActive]}
                                        onPress={() => { lightTap(); toggleHabitCompletion(habit.id); }}
                                    >
                                        <Ionicons name={isDoneToday ? 'checkmark-circle' : 'radio-button-off'} size={18} color={isDoneToday ? '#000' : ACCENT} />
                                        <Text style={[styles.habitDoneBtnText, isDoneToday && { color: '#000' }]}>
                                            {isDoneToday ? 'Done today ✓' : 'Mark as done'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}

                {/* ── UPCOMING SCHEDULE ── */}
                <View style={styles.scheduleSectionHeader}>
                    <Text style={styles.sectionTitle}>Upcoming Schedule</Text>
                    {userData.isPro && currentPlan.weeks?.length > 0 && (
                        <View style={styles.proActiveBadge}>
                            <Text style={styles.proActiveBadgeText}>PRO</Text>
                        </View>
                    )}
                </View>

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
                                        <Ionicons name="footsteps" size={11} color="#888" style={{ marginRight: 4 }} />
                                        <Text style={styles.weekDistText}>{week.totalDist}</Text>
                                    </View>
                                </View>
                                <View style={styles.weekDivider} />
                                {week.workouts.map((wo, wIdx) => {
                                    const woType = wo.isRest ? 'Rest' : wo.icon === 'stopwatch' ? 'Intervals' : wo.title === 'Long Run' ? 'Long Run' : 'Run';
                                    const woDotColor = TYPE_COLOR[woType] || '#444';
                                    return (
                                        <View key={wIdx} style={[styles.fwRow, wIdx === week.workouts.length - 1 && { marginBottom: 0 }]}>
                                            {/* Type dot */}
                                            <View style={[styles.fwTypeDot, { backgroundColor: woDotColor }]} />
                                            <View style={[styles.fwIconBox, wo.isRest && { opacity: 0.4 }, wo.completed && { backgroundColor: 'rgba(50,205,50,0.1)' }]}>
                                                <Ionicons
                                                    name={wo.completed ? 'checkmark-circle' : wo.icon}
                                                    size={14}
                                                    color={wo.completed ? '#32CD32' : (wo.isRest ? '#555' : ACCENT)}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={[styles.fwTitle, wo.isRest && { color: '#555' }]}>{wo.title}</Text>
                                                    {wo.completed && <Ionicons name="checkmark-circle" size={13} color="#32CD32" />}
                                                </View>
                                                <Text style={styles.fwDetail}>{wo.detail}</Text>
                                            </View>
                                            <View style={styles.fwRight}>
                                                <Text style={styles.fwDay}>{wo.day}</Text>
                                                {!wo.isRest && wo.detail?.includes('km') && (
                                                    <View style={[styles.fwDistChip, { borderColor: woDotColor + '44' }]}>
                                                        <Text style={[styles.fwDistChipText, { color: woDotColor }]}>
                                                            {wo.detail.split('km')[0].trim().split(' ').pop()}km
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.upsellCard}>
                        <LinearGradient colors={['#1A1A1A', '#0D0D0D']} style={styles.upsellGradient}>
                            <View style={styles.upsellIconRow}>
                                <View style={styles.upsellIconCircle}>
                                    <Ionicons name="calendar" size={22} color={ACCENT} />
                                </View>
                                <Text style={styles.upsellTitle}>Unlock Your Full Schedule</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <Ionicons name="checkmark-circle" size={16} color={ACCENT} />
                                <Text style={styles.featureText}>See your full 4-week schedule</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <Ionicons name="checkmark-circle" size={16} color={ACCENT} />
                                <Text style={styles.featureText}>Plan adapts to your run days</Text>
                            </View>
                            <TouchableOpacity activeOpacity={0.85} style={styles.upgradeBtnSmall} onPress={handleUpgrade}>
                                <LinearGradient colors={[ACCENT, '#B2FF59']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.upgradeBtnGradient}>
                                    <Text style={styles.upgradeBtnTextSmall}>View Full Schedule</Text>
                                    <Ionicons name="arrow-forward" size={16} color="#000" style={{ marginLeft: 8 }} />
                                </LinearGradient>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                )}

                <View style={{ height: 150 }} />
            </ScrollView>

            {/* ── EDIT MENU MODAL ── */}
            <Modal transparent visible={showEditMenu} animationType="fade" onRequestClose={() => setShowEditMenu(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEditMenu(false)}>
                    <View style={styles.editMenuContainer}>
                        <View style={styles.menuContent}>
                            {[
                                { icon: 'flag-checkered', label: 'Change my Goal', onPress: () => { lightTap(); setShowEditMenu(false); setShowGoalModal(true); } },
                                { icon: 'calendar-edit', label: 'Adjust My Schedule', onPress: () => { lightTap(); setTempRunDays(userData.runDays || []); setShowEditMenu(false); setShowScheduleModal(true); } },
                            ].map((item, i) => (
                                <View key={i}>
                                    <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={item.onPress}>
                                        <MaterialCommunityIcons name={item.icon} size={20} color="#FFF" style={{ marginRight: 12 }} />
                                        <Text style={styles.menuText}>{item.label}</Text>
                                    </TouchableOpacity>
                                    <View style={styles.menuDivider} />
                                </View>
                            ))}
                            <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={handleInjuryToggle}>
                                <FontAwesome5
                                    name={planStatus === 'Injured' ? 'running' : 'user-injured'}
                                    size={16}
                                    color={planStatus === 'Injured' ? ACCENT : '#FFF'}
                                    style={{ marginRight: 14, marginLeft: 2 }}
                                />
                                <Text style={[styles.menuText, planStatus === 'Injured' && { color: ACCENT }]}>
                                    {planStatus === 'Injured' ? "I'm Recovered" : "I'm Injured"}
                                </Text>
                            </TouchableOpacity>
                            <View style={styles.menuDivider} />
                            <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={handleVacationToggle}>
                                <MaterialCommunityIcons
                                    name={planStatus === 'Vacation' ? 'home' : 'palm-tree'}
                                    size={20}
                                    color={planStatus === 'Vacation' ? ACCENT : '#FFF'}
                                    style={{ marginRight: 12 }}
                                />
                                <Text style={[styles.menuText, planStatus === 'Vacation' && { color: ACCENT }]}>
                                    {planStatus === 'Vacation' ? 'Back from Vacation' : "I'm on Vacation"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── GOAL MODAL ── */}
            <Modal animationType="slide" transparent visible={showGoalModal} onRequestClose={() => setShowGoalModal(false)}>
                <View style={styles.subModalContainer}>
                    <View style={styles.subModalContent}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.subTitleText}>Select New Goal</Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowGoalModal(false); }}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        {['5k', '10k', 'Half Marathon', 'Weight Loss'].map(goal => (
                            <TouchableOpacity activeOpacity={0.7} key={goal}
                                style={[styles.priceOption, userData.goal === goal && styles.priceOptionSelected]}
                                onPress={() => handleGoalSelect(goal)}>
                                <Text style={styles.priceTitle}>{goal}</Text>
                                {userData.goal === goal && <Ionicons name="checkmark-circle" size={24} color={ACCENT} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

            {/* ── SCHEDULE MODAL ── */}
            <Modal animationType="slide" transparent visible={showScheduleModal} onRequestClose={() => setShowScheduleModal(false)}>
                <View style={styles.subModalContainer}>
                    <View style={styles.subModalContent}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.subTitleText}>Edit Weekly Schedule</Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowScheduleModal(false); }}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <TouchableOpacity activeOpacity={0.7} key={day}
                                    style={[styles.dayItem, tempRunDays.includes(day) && styles.dayItemSelected, { width: '30%', marginBottom: 10, height: 52 }]}
                                    onPress={() => toggleDay(day)}>
                                    <Text style={[styles.dayName, tempRunDays.includes(day) && styles.dayTextSelected, { fontSize: 15 }]}>{day}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity activeOpacity={0.7} style={styles.trialBtn} onPress={saveSchedule}>
                            <Text style={styles.trialBtnText}>Save Schedule</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── ADD HABIT MODAL ── */}
            <Modal animationType="slide" transparent visible={showAddHabitModal} onRequestClose={() => setShowAddHabitModal(false)}>
                <View style={styles.subModalContainer}>
                    <View style={styles.subModalContent}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.subTitleText}>New Habit</Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowAddHabitModal(false); }}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <TextInput style={styles.habitInput} value={newHabitName} onChangeText={setNewHabitName}
                            placeholder="Habit name (e.g. Daily Run)" placeholderTextColor="#444" />
                        <TextInput style={styles.habitInput} value={newHabitDesc} onChangeText={setNewHabitDesc}
                            placeholder="Description / goal (optional)" placeholderTextColor="#444" />
                        <Text style={styles.habitModalLabel}>Days per week</Text>
                        <View style={styles.freqRow}>
                            {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                <TouchableOpacity key={n} activeOpacity={0.7}
                                    style={[styles.freqBtn, newHabitFrequency === n && styles.freqBtnActive]}
                                    onPress={() => setNewHabitFrequency(n)}>
                                    <Text style={[styles.freqBtnText, newHabitFrequency === n && { color: '#000' }]}>{n}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.habitModalLabel}>Icon</Text>
                        <View style={styles.iconPickerRow}>
                            {['run-fast', 'dumbbell', 'water', 'sleep', 'food-apple', 'meditation', 'bike', 'walk', 'yoga', 'heart-pulse', 'book-open-variant', 'pencil'].map(icon => (
                                <TouchableOpacity key={icon} activeOpacity={0.7}
                                    style={[styles.iconPickerBtn, newHabitIcon === icon && styles.iconPickerBtnActive]}
                                    onPress={() => setNewHabitIcon(icon)}>
                                    <MaterialCommunityIcons name={icon} size={22} color={newHabitIcon === icon ? '#000' : ACCENT} />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity activeOpacity={0.8}
                            style={[styles.trialBtn, !newHabitName.trim() && { opacity: 0.4 }]}
                            onPress={handleAddHabit} disabled={!newHabitName.trim()}>
                            <Text style={styles.trialBtnText}>Create Habit</Text>
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

    // ── Header ──
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, zIndex: 10,
    },
    headerTitle: { color: '#FFF', fontSize: 26, fontFamily: 'Poppins_700Bold', lineHeight: 30 },
    headerSub: { color: '#555', fontSize: 12, fontFamily: 'Poppins_500Medium', marginTop: 1 },
    editBtn: { width: 38, height: 38, backgroundColor: '#1C1C1E', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    headerUpgradeBtn: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        borderWidth: 1, borderColor: ACCENT, backgroundColor: 'rgba(204,255,0,0.08)',
    },
    headerUpgradeText: { color: ACCENT, fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1.2 },

    // ── Calendar ──
    calendarRail: {
        flexDirection: 'row', justifyContent: 'space-between',
        marginHorizontal: 20, marginBottom: 24,
        backgroundColor: '#0D0D0D', borderRadius: 18,
        padding: 6, borderWidth: 1, borderColor: '#1A1A1A',
    },
    dayItem: {
        flex: 1, height: 66, borderRadius: 13,
        alignItems: 'center', justifyContent: 'center',
    },
    dayItemSelected: {
        backgroundColor: ACCENT,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
        elevation: 6,
    },
    dayItemToday: { borderWidth: 1, borderColor: ACCENT + '55' },
    dayName: { color: '#555', fontSize: 10, fontFamily: 'Poppins_600SemiBold', marginBottom: 3 },
    dayNum: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    dayTextSelected: { color: '#000' },
    dot: { width: 5, height: 5, borderRadius: 3, marginTop: 4 },

    // ── Status banners ──
    statusBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        marginHorizontal: 20, borderRadius: 16, padding: 14,
        marginBottom: 16, borderWidth: 1,
    },
    statusIconCircle: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
    },
    statusBannerTitle: { fontSize: 13, fontFamily: 'Poppins_700Bold' },
    statusBannerSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: '#666', marginTop: 1 },

    // ── Workout card ──
    planCard: {
        marginHorizontal: 20, borderRadius: 24, marginBottom: 24,
        borderWidth: 1, overflow: 'hidden',
        backgroundColor: '#111',
        flexDirection: 'row',
    },
    planCardStripe: { width: 4, borderRadius: 0 },
    planCardInner: { flex: 1, padding: 22 },
    completedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(50,205,50,0.12)', borderRadius: 10,
        paddingHorizontal: 8, paddingVertical: 3,
        alignSelf: 'flex-start', marginBottom: 10,
    },
    completedBadgeText: { color: '#32CD32', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 0.8 },
    typeChip: {
        borderWidth: 1, borderRadius: 8,
        paddingHorizontal: 8, paddingVertical: 3,
        alignSelf: 'flex-start', marginBottom: 10,
    },
    typeChipText: { fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
    cardHeaderDate: { color: '#666', fontSize: 13, fontFamily: 'Poppins_500Medium', marginBottom: 6 },
    workoutTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Poppins_700Bold', lineHeight: 30, marginBottom: 8 },
    workoutDesc: { color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 16 },
    metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
    metaBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#1A1A1A', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A',
        paddingHorizontal: 10, paddingVertical: 5,
    },
    metaBadgeText: { color: '#888', fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    startBtnWrap: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
        borderRadius: 30,
    },
    mainActionBtn: {
        width: '100%', height: 52, borderRadius: 30,
        justifyContent: 'center', alignItems: 'center',
        flexDirection: 'row',
    },
    restBtn: { backgroundColor: '#1A1A1A' },
    mainActionText: { color: '#000', fontSize: 15, fontFamily: 'Poppins_700Bold' },

    // ── Section headers ──
    sectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    sectionSub: { color: '#444', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    habitsSectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
        paddingHorizontal: 20, marginBottom: 14,
    },
    habitAddBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: ACCENT, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20,
    },
    habitAddBtnText: { color: '#000', fontSize: 12, fontFamily: 'Poppins_700Bold' },
    scheduleSectionHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 20, marginBottom: 14,
    },
    proActiveBadge: {
        backgroundColor: ACCENT, borderRadius: 8,
        paddingHorizontal: 8, paddingVertical: 3,
    },
    proActiveBadgeText: { color: '#000', fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },

    // ── Habit card ──
    habitCard: {
        marginHorizontal: 20, borderRadius: 24, marginBottom: 20,
        borderWidth: 1, borderColor: '#1A1A1A',
        backgroundColor: '#0D0D0D', overflow: 'hidden',
        flexDirection: 'row',
    },
    habitStripe: { width: 3, backgroundColor: ACCENT, opacity: 0.6 },
    habitCardInner: { flex: 1, padding: 20 },
    habitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    habitIconBox: {
        width: 44, height: 44, backgroundColor: 'rgba(204,255,0,0.08)',
        borderRadius: 14, borderWidth: 1, borderColor: 'rgba(204,255,0,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    habitTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold', marginBottom: 2 },
    habitDesc: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular' },
    habitStreakBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(255,107,0,0.12)', borderRadius: 20,
        paddingHorizontal: 8, paddingVertical: 4,
        borderWidth: 1, borderColor: 'rgba(255,107,0,0.25)',
    },
    habitStreakText: { color: '#FF6B00', fontSize: 10, fontFamily: 'Poppins_700Bold' },
    habitStatsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    habitStatBox: {
        flex: 1, backgroundColor: '#161616', borderRadius: 12,
        paddingVertical: 10, alignItems: 'center',
        borderWidth: 1, borderColor: '#1E1E1E',
    },
    habitStatVal: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
    habitStatLabel: { color: '#444', fontSize: 10, fontFamily: 'Poppins_500Medium' },

    // Weekly progress bar
    habitProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    habitProgressTrack: {
        flex: 1, height: 6, backgroundColor: '#1E1E1E',
        borderRadius: 3, overflow: 'hidden',
    },
    habitProgressFill: { height: '100%', borderRadius: 3 },
    habitProgressLabel: { color: '#555', fontSize: 11, fontFamily: 'Poppins_700Bold', minWidth: 28, textAlign: 'right' },

    // Heatmap
    hmContainer: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    hmLabels: { justifyContent: 'space-between', paddingVertical: 1 },
    hmLabel: { color: '#333', fontSize: 9, fontFamily: 'Poppins_500Medium' },
    hmGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: HEATMAP_GAP },
    hmCell: { width: HEATMAP_CELL, height: HEATMAP_CELL, borderRadius: 2, backgroundColor: '#161616' },
    hmCellActive: { backgroundColor: ACCENT },

    // Habit done button
    habitDoneBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, height: 48, borderRadius: 24,
        borderWidth: 1, borderColor: 'rgba(204,255,0,0.3)',
    },
    habitDoneBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    habitDoneBtnText: { color: ACCENT, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },

    // Empty habit state
    habitEmptyCard: {
        marginHorizontal: 20, marginBottom: 20, backgroundColor: '#0A0A0A',
        borderRadius: 24, padding: 40, alignItems: 'center',
        borderWidth: 1, borderColor: '#1A1A1A', borderStyle: 'dashed',
    },
    habitEmptyTitle: { color: '#333', fontSize: 15, fontFamily: 'Poppins_600SemiBold', marginTop: 12, marginBottom: 4 },
    habitEmptyDesc: { color: '#2A2A2A', fontSize: 13, fontFamily: 'Poppins_400Regular' },

    // ── Week cards ──
    weekCard: {
        backgroundColor: '#0D0D0D', borderRadius: 20,
        marginHorizontal: 20, marginBottom: 14,
        padding: 18, borderWidth: 1, borderColor: '#1A1A1A',
    },
    weekCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    weekCardTitle: { color: ACCENT, fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 1.5, marginBottom: 2 },
    weekCardFocus: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: '#666' },
    weekDistBadge: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A',
    },
    weekDistText: { color: '#888', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    weekDivider: { height: 1, backgroundColor: '#1A1A1A', marginBottom: 14 },
    fwRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    fwTypeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
    fwIconBox: {
        width: 30, height: 30, borderRadius: 9,
        backgroundColor: 'rgba(204,255,0,0.08)',
        alignItems: 'center', justifyContent: 'center', marginRight: 10,
    },
    fwTitle: { color: '#DDD', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    fwDetail: { color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    fwRight: { alignItems: 'flex-end', gap: 4 },
    fwDay: { color: '#444', fontSize: 11, fontFamily: 'Poppins_700Bold' },
    fwDistChip: {
        borderWidth: 1, borderRadius: 6,
        paddingHorizontal: 6, paddingVertical: 2,
    },
    fwDistChipText: { fontSize: 10, fontFamily: 'Poppins_700Bold' },

    // ── Upsell card ──
    upsellCard: {
        marginHorizontal: 20, marginTop: 4, borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(204,255,0,0.2)', overflow: 'hidden',
    },
    upsellGradient: { padding: 24 },
    upsellIconRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
    upsellIconCircle: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: 'rgba(204,255,0,0.1)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(204,255,0,0.2)',
    },
    upsellTitle: { color: '#FFF', fontSize: 17, fontFamily: 'Poppins_700Bold', flex: 1 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    featureText: { color: '#AAA', fontSize: 13, fontFamily: 'Poppins_400Regular' },
    upgradeBtnSmall: { borderRadius: 25, overflow: 'hidden', marginTop: 18 },
    upgradeBtnGradient: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: 20,
    },
    upgradeBtnTextSmall: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 14 },

    // ── Modals ──
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    editMenuContainer: { position: 'absolute', top: 110, right: 20 },
    menuContent: {
        backgroundColor: 'rgba(20,20,20,0.97)', borderRadius: 16,
        paddingVertical: 4, width: 230,
        borderWidth: 1, borderColor: '#2A2A2A',
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    menuText: { color: '#DDD', fontSize: 14, fontFamily: 'Poppins_500Medium' },
    menuDivider: { height: 1, backgroundColor: '#1E1E1E', marginHorizontal: 14 },
    subModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    subModalContent: {
        backgroundColor: '#0D0D0D', borderTopLeftRadius: 30, borderTopRightRadius: 30,
        padding: 25, paddingBottom: 44,
        borderWidth: 1, borderColor: '#1A1A1A',
    },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
    subTitleText: { color: '#FFF', fontSize: 22, fontFamily: 'Poppins_700Bold' },
    priceOption: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#161616', borderRadius: 16, padding: 18,
        marginBottom: 12, borderWidth: 1, borderColor: '#222',
    },
    priceOptionSelected: { borderColor: ACCENT, borderWidth: 1.5, backgroundColor: 'rgba(204,255,0,0.04)' },
    priceTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    trialBtn: {
        backgroundColor: ACCENT, height: 54, borderRadius: 30,
        justifyContent: 'center', alignItems: 'center', marginTop: 16,
    },
    trialBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },

    // Add habit modal
    habitInput: {
        backgroundColor: '#161616', borderRadius: 14, paddingHorizontal: 16,
        paddingVertical: 14, color: '#FFF', fontSize: 15,
        fontFamily: 'Poppins_400Regular', marginBottom: 12,
        borderWidth: 1, borderColor: '#222',
    },
    habitModalLabel: { color: '#666', fontSize: 12, fontFamily: 'Poppins_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
    freqRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
    freqBtn: {
        flex: 1, height: 38, backgroundColor: '#161616', borderRadius: 10,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#222',
    },
    freqBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    freqBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    iconPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
    iconPickerBtn: {
        width: 48, height: 48, backgroundColor: '#161616', borderRadius: 14,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#222',
    },
    iconPickerBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
});
