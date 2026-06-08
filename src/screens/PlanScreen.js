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

const INTENSITY_COLOR = { High: '#FF6B6B', Moderate: '#FFD700', Low: ACCENT, Rest: '#2A2A2A' };
const TYPE_COLOR = { Intervals: '#FF6B6B', 'Long Run': '#FFD700', Run: ACCENT, Rest: '#2A2A2A' };

const TYPE_LABEL = { Intervals: 'INTERVALS', 'Long Run': 'LONG RUN', Run: 'EASY RUN', Rest: 'REST DAY' };

const EFFORT_LEVEL = { High: 4, Moderate: 3, Low: 2, Rest: 0 };
const EFFORT_ZONE  = { High: 'Zone 4–5', Moderate: 'Zone 3', Low: 'Zone 2', Rest: '—' };

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

    const weeklyStats = useMemo(() => {
        const days = Object.values(weeklyPlan);
        const runs = days.filter(d => !d.isRest);
        const totalKm = runs.reduce((sum, d) => sum + (parseFloat(d.dist) || 0), 0);
        const totalMin = runs.reduce((sum, d) => sum + (d.duration || 0), 0);
        const completed = runs.filter(d => d.completed).length;
        return { runs: runs.length, totalKm, totalMin, completed };
    }, [weeklyPlan]);

    const currentWeekNum = currentPlan.weeks?.[0]?.weekNum || 1;
    const planProgressPct = Math.min(100, Math.round((currentWeekNum / 8) * 100));

    const heroCardColors = activePlan.isRest
        ? ['#0F0F0F', '#0D0D0D']
        : activePlan.intensity === 'High'   ? ['#1C0808', '#0D0D0D']
        : activePlan.intensity === 'Moderate' ? ['#1A1500', '#0D0D0D']
        : ['#0C1500', '#0D0D0D'];

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
            <SafeAreaView style={styles.header} edges={['top']}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>My Plan</Text>
                    <Text style={styles.headerSub}>
                        {planStatus === 'Active'
                            ? `${activeGoal.toUpperCase()} · Week ${currentWeekNum}`
                            : planStatus === 'Injured' ? '🩹 Recovery Mode' : '✈️ Vacation Mode'}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {!userData.isPro && (
                        <TouchableOpacity activeOpacity={0.7} style={styles.headerProBtn} onPress={handleUpgrade}>
                            <Ionicons name="star" size={11} color="#000" />
                            <Text style={styles.headerProText}>PRO</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        style={[styles.headerIconBtn, { backgroundColor: ACCENT + '18', borderColor: ACCENT + '40' }]}
                        onPress={() => { lightTap(); navigation.navigate('AICoach', { initialPrompt: 'I need to adjust my plan...' }); }}
                    >
                        <MaterialCommunityIcons name="robot" size={19} color={ACCENT} />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} style={styles.headerIconBtn} onPress={() => { lightTap(); setShowEditMenu(true); }}>
                        <Ionicons name="ellipsis-horizontal" size={19} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── PLAN PROGRESS BANNER ── */}
                <View style={styles.progressBanner}>
                    <View style={styles.progressBannerLeft}>
                        <Text style={styles.progressBannerGoal}>{activeGoal.toUpperCase()} TRAINING</Text>
                        <Text style={styles.progressBannerWeek}>Week {currentWeekNum} of 8</Text>
                    </View>
                    <View style={styles.progressBannerRight}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${planProgressPct}%` }]} />
                        </View>
                        <Text style={styles.progressBarPct}>{planProgressPct}% complete</Text>
                    </View>
                </View>

                {/* ── CALENDAR STRIP ── */}
                <View style={styles.calendarWrap}>
                    <View style={styles.calendarRail}>
                        {weekDates.map((item, index) => {
                            const isSelected = selectedDate.fullDate === item.fullDate;
                            const dayPlan = weeklyPlan[item.dayKey];
                            const dotColor = TYPE_COLOR[dayPlan?.type] || '#333';
                            const isCompleted = dayPlan?.completed;
                            const isRest = dayPlan?.isRest;
                            return (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    key={index}
                                    style={[styles.dayItem, isSelected && styles.dayItemSelected]}
                                    onPress={() => { lightTap(); setSelectedDate(item); }}
                                >
                                    <Text style={[styles.dayName, isSelected && styles.dayTextSelected, item.isToday && !isSelected && { color: ACCENT }]}>
                                        {item.dayName}
                                    </Text>
                                    <Text style={[styles.dayNum, isSelected && styles.dayTextSelected]}>
                                        {item.dayNum}
                                    </Text>
                                    {isCompleted ? (
                                        <View style={[styles.dayDotWrap, { backgroundColor: isSelected ? '#00000030' : 'rgba(50,205,50,0.15)' }]}>
                                            <Ionicons name="checkmark" size={8} color={isSelected ? '#000' : '#32CD32'} />
                                        </View>
                                    ) : isRest ? (
                                        <View style={[styles.dayDotWrap, { backgroundColor: 'transparent' }]}>
                                            <View style={styles.dayRestDash} />
                                        </View>
                                    ) : (
                                        <View style={[styles.dayDotWrap, { backgroundColor: isSelected ? '#00000030' : dotColor + '25' }]}>
                                            <View style={[styles.dayDot, { backgroundColor: isSelected ? '#000' : dotColor }]} />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* ── STATUS BANNERS ── */}
                {planStatus === 'Injured' && (
                    <View style={[styles.statusBanner, { backgroundColor: 'rgba(255,59,48,0.10)', borderColor: 'rgba(255,59,48,0.28)' }]}>
                        <View style={[styles.statusIconCircle, { backgroundColor: 'rgba(255,59,48,0.18)' }]}>
                            <FontAwesome5 name="user-injured" size={13} color="#FF3B30" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusBannerTitle, { color: '#FF3B30' }]}>Recovery Mode Active</Text>
                            <Text style={styles.statusBannerSub}>Intensity paused · Low-impact sessions only</Text>
                        </View>
                    </View>
                )}
                {planStatus === 'Vacation' && (
                    <View style={[styles.statusBanner, { backgroundColor: 'rgba(0,191,255,0.08)', borderColor: 'rgba(0,191,255,0.28)' }]}>
                        <View style={[styles.statusIconCircle, { backgroundColor: 'rgba(0,191,255,0.18)' }]}>
                            <Ionicons name="airplane" size={15} color="#00BFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusBannerTitle, { color: '#00BFFF' }]}>Vacation Mode</Text>
                            <Text style={styles.statusBannerSub}>Maintenance runs only · Stay active</Text>
                        </View>
                    </View>
                )}

                {/* ── TODAY'S SESSION HERO CARD ── */}
                <View style={styles.heroCardWrap}>
                    <LinearGradient colors={heroCardColors} style={styles.heroCard}>

                        {/* Top accent line */}
                        <View style={[styles.heroAccentLine, { backgroundColor: stripeColor }]} />

                        <View style={styles.heroCardInner}>
                            {/* Type badge + date row */}
                            <View style={styles.heroTopRow}>
                                <View style={[styles.heroTypeBadge, { backgroundColor: stripeColor + '1E', borderColor: stripeColor + '50' }]}>
                                    <View style={[styles.heroTypeDot, { backgroundColor: stripeColor }]} />
                                    <Text style={[styles.heroTypeBadgeText, { color: stripeColor }]}>
                                        {TYPE_LABEL[activePlan.type] || 'SESSION'}
                                    </Text>
                                </View>
                                {activePlan.completed && (
                                    <View style={styles.heroDoneBadge}>
                                        <Ionicons name="checkmark-circle" size={12} color="#32CD32" />
                                        <Text style={styles.heroDoneBadgeText}>DONE</Text>
                                    </View>
                                )}
                                <Text style={styles.heroDateText}>
                                    {selectedDate.isToday
                                        ? 'TODAY'
                                        : selectedDate.date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}
                                </Text>
                            </View>

                            {/* Workout title + desc */}
                            <Text style={styles.heroTitle}>{activePlan.title}</Text>
                            {!activePlan.isRest && (
                                <Text style={styles.heroDesc} numberOfLines={2}>{activePlan.desc}</Text>
                            )}

                            {/* Metrics row */}
                            {!activePlan.isRest && (
                                <View style={styles.heroMetricsRow}>
                                    {activePlan.duration > 0 && (
                                        <View style={styles.heroMetricCell}>
                                            <Text style={styles.heroMetricValue}>{activePlan.duration}</Text>
                                            <Text style={styles.heroMetricLabel}>MIN</Text>
                                        </View>
                                    )}
                                    {parseFloat(activePlan.dist) > 0 && (
                                        <>
                                            <View style={styles.heroMetricDivider} />
                                            <View style={styles.heroMetricCell}>
                                                <Text style={styles.heroMetricValue}>{activePlan.dist}</Text>
                                                <Text style={styles.heroMetricLabel}>KM</Text>
                                            </View>
                                        </>
                                    )}
                                    <View style={styles.heroMetricDivider} />
                                    <View style={styles.heroMetricCell}>
                                        <Text style={[styles.heroMetricValue, { color: stripeColor }]}>{activePlan.intensity}</Text>
                                        <Text style={styles.heroMetricLabel}>EFFORT</Text>
                                    </View>
                                </View>
                            )}

                            {/* Effort gauge */}
                            {!activePlan.isRest && (
                                <View style={styles.heroEffortRow}>
                                    <View style={styles.heroEffortDots}>
                                        {[1, 2, 3, 4, 5].map(n => {
                                            const lvl = EFFORT_LEVEL[activePlan.intensity] || 2;
                                            return (
                                                <View
                                                    key={n}
                                                    style={[
                                                        styles.heroEffortDot,
                                                        n <= lvl
                                                            ? { backgroundColor: stripeColor, opacity: 1 - (n - 1) * 0.08 }
                                                            : { backgroundColor: '#222' },
                                                    ]}
                                                />
                                            );
                                        })}
                                    </View>
                                    <Text style={[styles.heroEffortZone, { color: stripeColor + 'CC' }]}>
                                        {EFFORT_ZONE[activePlan.intensity] || 'Zone 2'}
                                    </Text>
                                </View>
                            )}

                            {/* Rest / completed / start */}
                            {activePlan.isRest ? (
                                <View style={styles.heroRestRow}>
                                    <MaterialCommunityIcons name="sleep" size={16} color="#3A3A3A" />
                                    <Text style={styles.heroRestText}>Rest · Recovery · Regeneration</Text>
                                </View>
                            ) : activePlan.completed ? (
                                <View style={styles.heroCompletedRow}>
                                    <Ionicons name="checkmark-circle" size={18} color="#32CD32" />
                                    <Text style={styles.heroCompletedText}>Completed{activePlan.completedDistance > 0 ? ` · ${activePlan.completedDistance.toFixed(1)} km` : ''}</Text>
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.heroStartWrap} activeOpacity={0.86} onPress={handleStart}>
                                    <LinearGradient
                                        colors={activePlan.intensity === 'High' ? ['#FF6B6B', '#FF3B30'] : activePlan.intensity === 'Moderate' ? ['#FFD700', '#FFAA00'] : [ACCENT, '#AADD00']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        style={styles.heroStartBtn}
                                    >
                                        <Ionicons name="play" size={16} color="#000" style={{ marginRight: 8 }} />
                                        <Text style={styles.heroStartBtnText}>Let's Go</Text>
                                        <Ionicons name="arrow-forward" size={16} color="#000" style={{ marginLeft: 8 }} />
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </View>
                    </LinearGradient>
                </View>

                {/* ── THIS WEEK OVERVIEW ── */}
                <View style={styles.weekSection}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>This Week</Text>
                        <View style={styles.weekStatPills}>
                            <Text style={styles.weekStatPill}>{weeklyStats.runs} runs</Text>
                            <Text style={styles.weekStatPillDot}>·</Text>
                            <Text style={styles.weekStatPill}>{weeklyStats.totalKm.toFixed(0)} km</Text>
                            <Text style={styles.weekStatPillDot}>·</Text>
                            <Text style={[styles.weekStatPill, { color: ACCENT }]}>{weeklyStats.completed}/{weeklyStats.runs} done</Text>
                        </View>
                    </View>

                    {/* 7-block week visual */}
                    <View style={styles.weekBlocksRow}>
                        {weekDates.map((date, i) => {
                            const dayPlan = weeklyPlan[date.dayKey];
                            const typeColor = TYPE_COLOR[dayPlan?.type] || '#1A1A1A';
                            const isSelected = selectedDate.fullDate === date.fullDate;
                            const isCompleted = dayPlan?.completed;
                            const isRest = dayPlan?.isRest;
                            return (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => { lightTap(); setSelectedDate(date); }}
                                    style={styles.weekBlockItem}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.weekBlockDay, date.isToday && { color: ACCENT }]}>{date.dayName}</Text>
                                    <View style={[
                                        styles.weekBlock,
                                        isRest
                                            ? { backgroundColor: '#141414', borderColor: '#222' }
                                            : { backgroundColor: typeColor + '22', borderColor: typeColor + '60' },
                                        isSelected && { borderColor: typeColor, borderWidth: 1.5 },
                                        isCompleted && { backgroundColor: typeColor + '30' },
                                    ]}>
                                        {isCompleted ? (
                                            <Ionicons name="checkmark" size={11} color={typeColor} />
                                        ) : !isRest ? (
                                            <View style={[styles.weekBlockDot, { backgroundColor: typeColor }]} />
                                        ) : null}
                                    </View>
                                    {date.isToday && <View style={styles.weekBlockTodayDot} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Type legend */}
                    <View style={styles.weekLegendRow}>
                        {[['Run', 'Easy'], ['Long Run', 'Long'], ['Intervals', 'Speed'], ['Rest', 'Rest']].map(([type, label]) => (
                            <View key={type} style={styles.weekLegendItem}>
                                <View style={[styles.weekLegendDot, { backgroundColor: TYPE_COLOR[type] }]} />
                                <Text style={styles.weekLegendLabel}>{label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ── MY HABITS ── */}
                <View style={styles.sectionHeaderRow}>
                    <View>
                        <Text style={styles.sectionTitle}>My Habits</Text>
                        {habits.length > 0 && (
                            <Text style={styles.sectionSub}>{habits.length} habit{habits.length !== 1 ? 's' : ''} tracked</Text>
                        )}
                    </View>
                    <TouchableOpacity activeOpacity={0.7} style={styles.addHabitBtn} onPress={() => { lightTap(); setShowAddHabitModal(true); }}>
                        <Ionicons name="add" size={15} color="#000" />
                        <Text style={styles.addHabitBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {habits.length === 0 ? (
                    <TouchableOpacity activeOpacity={0.8} style={styles.habitEmptyCard} onPress={() => { lightTap(); setShowAddHabitModal(true); }}>
                        <View style={styles.habitEmptyIconCircle}>
                            <MaterialCommunityIcons name="plus" size={24} color="#333" />
                        </View>
                        <Text style={styles.habitEmptyTitle}>Build a habit</Text>
                        <Text style={styles.habitEmptyDesc}>Track daily habits alongside your training</Text>
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
                                <LinearGradient
                                    colors={isDoneToday ? [ACCENT + '10', 'transparent'] : ['transparent', 'transparent']}
                                    style={StyleSheet.absoluteFill}
                                />
                                {/* Left accent bar */}
                                <View style={[styles.habitAccentBar, isDoneToday && { backgroundColor: ACCENT }]} />

                                <View style={styles.habitCardInner}>
                                    <View style={styles.habitHeaderRow}>
                                        <View style={[styles.habitIconBox, isDoneToday && { backgroundColor: ACCENT + '20', borderColor: ACCENT + '40' }]}>
                                            <MaterialCommunityIcons name={habit.icon || 'run-fast'} size={22} color={isDoneToday ? ACCENT : '#555'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.habitTitle}>{habit.name}</Text>
                                            <Text style={styles.habitDesc}>{habit.description || `${freq}× per week`}</Text>
                                        </View>
                                        {weekPct >= 100 && (
                                            <View style={styles.habitFireBadge}>
                                                <MaterialCommunityIcons name="fire" size={12} color="#FF6B00" />
                                                <Text style={styles.habitFireText}>On fire</Text>
                                            </View>
                                        )}
                                        <TouchableOpacity
                                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                            style={{ marginLeft: 8 }}
                                            onPress={() => Alert.alert('Delete Habit', `Delete "${habit.name}"?`, [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(habit.id) },
                                            ])}
                                        >
                                            <Ionicons name="trash-outline" size={16} color="#2A2A2A" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Stats grid */}
                                    <View style={styles.habitStatsRow}>
                                        <View style={styles.habitStatCell}>
                                            <Text style={styles.habitStatValue}>{monthCount}</Text>
                                            <Text style={styles.habitStatLabel}>This month</Text>
                                        </View>
                                        <View style={styles.habitStatDivider} />
                                        <View style={styles.habitStatCell}>
                                            <Text style={[styles.habitStatValue, weekPct >= 100 && { color: ACCENT }]}>{weekPct}%</Text>
                                            <Text style={styles.habitStatLabel}>This week</Text>
                                        </View>
                                        <View style={styles.habitStatDivider} />
                                        <View style={styles.habitStatCell}>
                                            <Text style={styles.habitStatValue}>{completions.length}</Text>
                                            <Text style={styles.habitStatLabel}>Total</Text>
                                        </View>
                                    </View>

                                    {/* Progress bar */}
                                    <View style={styles.habitProgressRow}>
                                        <View style={styles.habitProgressTrack}>
                                            <LinearGradient
                                                colors={weekPct >= 100 ? [ACCENT, '#B2FF59'] : [ACCENT + 'AA', ACCENT]}
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                style={[styles.habitProgressFill, { width: `${weekPct}%` }]}
                                            />
                                        </View>
                                        <Text style={styles.habitProgressCount}>{weekCount}/{freq}</Text>
                                    </View>

                                    {renderHeatmap(getHabitIndices(completions))}

                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={[styles.habitMarkBtn, isDoneToday && styles.habitMarkBtnDone]}
                                        onPress={() => { lightTap(); toggleHabitCompletion(habit.id); }}
                                    >
                                        <Ionicons name={isDoneToday ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={isDoneToday ? '#000' : ACCENT} />
                                        <Text style={[styles.habitMarkBtnText, isDoneToday && { color: '#000' }]}>
                                            {isDoneToday ? 'Done today ✓' : 'Mark as done'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}

                {/* ── UPCOMING SCHEDULE ── */}
                <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
                    <Text style={styles.sectionTitle}>Full Schedule</Text>
                    {userData.isPro && (
                        <View style={styles.proBadge}>
                            <Ionicons name="star" size={9} color="#000" style={{ marginRight: 3 }} />
                            <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                    )}
                </View>

                {userData.isPro ? (
                    <View>
                        {currentPlan.weeks?.map((week, idx) => (
                            <View key={idx} style={styles.weekCard}>
                                {/* Week header */}
                                <LinearGradient colors={idx === 0 ? [ACCENT + '12', 'transparent'] : ['transparent', 'transparent']} style={styles.weekCardHeaderGrad}>
                                    <View style={styles.weekCardHeader}>
                                        <View style={styles.weekNumCircle}>
                                            <Text style={styles.weekNumText}>{week.weekNum}</Text>
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.weekCardTitle}>{week.focus}</Text>
                                            <Text style={styles.weekCardSub}>Week {week.weekNum}</Text>
                                        </View>
                                        <View style={styles.weekDistChip}>
                                            <Ionicons name="footsteps" size={10} color="#666" style={{ marginRight: 4 }} />
                                            <Text style={styles.weekDistText}>{week.totalDist}</Text>
                                        </View>
                                        {idx === 0 && (
                                            <View style={styles.currentWeekBadge}>
                                                <Text style={styles.currentWeekBadgeText}>CURRENT</Text>
                                            </View>
                                        )}
                                    </View>
                                </LinearGradient>

                                <View style={styles.weekCardDivider} />

                                {week.workouts.map((wo, wIdx) => {
                                    const woType = wo.isRest ? 'Rest' : wo.icon === 'stopwatch' ? 'Intervals' : wo.title === 'Long Run' ? 'Long Run' : 'Run';
                                    const woDotColor = TYPE_COLOR[woType] || '#333';
                                    return (
                                        <View key={wIdx} style={[styles.workoutRow, wIdx < week.workouts.length - 1 && styles.workoutRowBorder]}>
                                            <View style={[styles.workoutRowType, { backgroundColor: woDotColor + '20', borderColor: woDotColor + '40' }]}>
                                                <View style={[styles.workoutRowTypeDot, { backgroundColor: woDotColor }]} />
                                            </View>
                                            <View style={styles.workoutRowIcon}>
                                                <Ionicons
                                                    name={wo.completed ? 'checkmark-circle' : wo.isRest ? 'bed-outline' : wo.icon}
                                                    size={15}
                                                    color={wo.completed ? '#32CD32' : wo.isRest ? '#333' : ACCENT}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.workoutRowTitle, wo.isRest && { color: '#3A3A3A' }]}>
                                                    {wo.title}
                                                </Text>
                                                <Text style={styles.workoutRowDetail} numberOfLines={1}>{wo.detail}</Text>
                                            </View>
                                            <View style={styles.workoutRowRight}>
                                                <Text style={[styles.workoutRowDay, wo.day === selectedDate.dayKey && { color: ACCENT }]}>{wo.day}</Text>
                                                {!wo.isRest && wo.detail?.includes('km') && (
                                                    <View style={[styles.workoutDistPill, { borderColor: woDotColor + '40' }]}>
                                                        <Text style={[styles.workoutDistPillText, { color: woDotColor }]}>
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
                    <TouchableOpacity activeOpacity={0.9} style={styles.upsellCard} onPress={handleUpgrade}>
                        <LinearGradient colors={['#131300', '#0D0D0D']} style={styles.upsellInner}>
                            <View style={styles.upsellTop}>
                                <LinearGradient colors={[ACCENT, '#AADD00']} style={styles.upsellIconCircle}>
                                    <Ionicons name="calendar" size={22} color="#000" />
                                </LinearGradient>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={styles.upsellTitle}>Full Training Schedule</Text>
                                    <Text style={styles.upsellSub}>8-week personalized plan · adapts to you</Text>
                                </View>
                            </View>
                            <View style={styles.upsellFeatures}>
                                {['Full 8-week run calendar', 'Pace targets per session', 'Auto-adjusts to your schedule'].map((f, i) => (
                                    <View key={i} style={styles.upsellFeatureRow}>
                                        <Ionicons name="checkmark-circle" size={14} color={ACCENT} />
                                        <Text style={styles.upsellFeatureText}>{f}</Text>
                                    </View>
                                ))}
                            </View>
                            <LinearGradient colors={[ACCENT, '#AADD00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.upsellBtn}>
                                <Text style={styles.upsellBtnText}>Unlock with PRO</Text>
                                <Ionicons name="arrow-forward" size={15} color="#000" style={{ marginLeft: 6 }} />
                            </LinearGradient>
                        </LinearGradient>
                    </TouchableOpacity>
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
    container: { flex: 1, backgroundColor: '#000' },
    scrollContent: { paddingBottom: 100 },

    // ── Header ──
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
    },
    headerTitle: { color: '#FFF', fontSize: 28, fontFamily: 'Poppins_700Bold', lineHeight: 32 },
    headerSub: { color: '#555', fontSize: 12, fontFamily: 'Poppins_500Medium', marginTop: 1 },
    headerIconBtn: {
        width: 38, height: 38, borderRadius: 12, backgroundColor: '#141414',
        borderWidth: 1, borderColor: '#222', justifyContent: 'center', alignItems: 'center',
    },
    headerProBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: ACCENT, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    },
    headerProText: { color: '#000', fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },

    // ── Plan progress banner ──
    progressBanner: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 20, marginBottom: 20,
        backgroundColor: '#0D0D0D', borderRadius: 18,
        padding: 16, borderWidth: 1, borderColor: '#1A1A1A', gap: 16,
    },
    progressBannerLeft: { flex: 0 },
    progressBannerGoal: { color: ACCENT, fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1.5, marginBottom: 2 },
    progressBannerWeek: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold' },
    progressBannerRight: { flex: 1 },
    progressBarBg: { height: 5, backgroundColor: '#1E1E1E', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
    progressBarFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 3 },
    progressBarPct: { color: '#555', fontSize: 11, fontFamily: 'Poppins_500Medium', textAlign: 'right' },

    // ── Calendar ──
    calendarWrap: { marginHorizontal: 20, marginBottom: 20 },
    calendarRail: {
        flexDirection: 'row', backgroundColor: '#0D0D0D',
        borderRadius: 20, padding: 5,
        borderWidth: 1, borderColor: '#1A1A1A',
    },
    dayItem: {
        flex: 1, height: 70, borderRadius: 15,
        alignItems: 'center', justifyContent: 'center', gap: 2,
    },
    dayItemSelected: {
        backgroundColor: ACCENT,
        shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
    },
    dayName: { color: '#4A4A4A', fontSize: 10, fontFamily: 'Poppins_600SemiBold' },
    dayNum: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    dayTextSelected: { color: '#000' },
    dayDotWrap: { width: 18, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    dayDot: { width: 5, height: 5, borderRadius: 3 },
    dayRestDash: { width: 10, height: 1.5, backgroundColor: '#2A2A2A', borderRadius: 1 },

    // ── Status banners ──
    statusBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        marginHorizontal: 20, borderRadius: 16, padding: 14,
        marginBottom: 16, borderWidth: 1,
    },
    statusIconCircle: {
        width: 38, height: 38, borderRadius: 19,
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    statusBannerTitle: { fontSize: 13, fontFamily: 'Poppins_700Bold' },
    statusBannerSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: '#555', marginTop: 1 },

    // ── Hero workout card ──
    heroCardWrap: { marginHorizontal: 20, marginBottom: 24, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#1A1A1A' },
    heroCard: { borderRadius: 24 },
    heroAccentLine: { height: 3, width: '100%' },
    heroCardInner: { padding: 22 },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    heroTypeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 4,
    },
    heroTypeDot: { width: 5, height: 5, borderRadius: 3 },
    heroTypeBadgeText: { fontSize: 10, fontFamily: 'Poppins_700Bold', letterSpacing: 1.2 },
    heroDoneBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(50,205,50,0.1)', borderRadius: 8,
        paddingHorizontal: 7, paddingVertical: 3,
    },
    heroDoneBadgeText: { color: '#32CD32', fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 0.8 },
    heroDateText: { marginLeft: 'auto', color: '#444', fontSize: 11, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1 },
    heroTitle: { color: '#FFF', fontSize: 26, fontFamily: 'Poppins_700Bold', lineHeight: 32, marginBottom: 8 },
    heroDesc: { color: '#666', fontSize: 13, fontFamily: 'Poppins_400Regular', lineHeight: 20, marginBottom: 20 },
    heroMetricsRow: {
        flexDirection: 'row', backgroundColor: '#141414',
        borderRadius: 14, paddingVertical: 14, marginBottom: 18,
        borderWidth: 1, borderColor: '#1E1E1E',
    },
    heroMetricCell: { flex: 1, alignItems: 'center' },
    heroMetricValue: { color: '#FFF', fontSize: 20, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
    heroMetricLabel: { color: '#444', fontSize: 9, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1 },
    heroMetricDivider: { width: 1, backgroundColor: '#1E1E1E', alignSelf: 'stretch' },
    heroEffortRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
    heroEffortDots: { flexDirection: 'row', gap: 5 },
    heroEffortDot: { width: 28, height: 6, borderRadius: 3 },
    heroEffortZone: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', letterSpacing: 0.5 },
    heroRestRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#111', borderRadius: 16, height: 52,
        justifyContent: 'center', marginTop: 8,
    },
    heroRestText: { color: '#333', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    heroCompletedRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(50,205,50,0.08)', borderRadius: 16, height: 52,
        justifyContent: 'center', marginTop: 8, borderWidth: 1, borderColor: 'rgba(50,205,50,0.2)',
    },
    heroCompletedText: { color: '#32CD32', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    heroStartWrap: {
        shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4, shadowRadius: 14, elevation: 8, borderRadius: 30, marginTop: 4,
    },
    heroStartBtn: {
        height: 54, borderRadius: 30,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    },
    heroStartBtnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins_700Bold' },

    // ── This Week overview ──
    weekSection: { marginHorizontal: 20, marginBottom: 28 },
    sectionHeaderRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, marginBottom: 14,
    },
    sectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    sectionSub: { color: '#444', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    weekStatPills: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    weekStatPill: { color: '#555', fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
    weekStatPillDot: { color: '#333', fontSize: 11 },
    weekBlocksRow: {
        flexDirection: 'row', gap: 6,
        backgroundColor: '#0D0D0D', borderRadius: 18,
        padding: 12, borderWidth: 1, borderColor: '#1A1A1A', marginBottom: 12,
    },
    weekBlockItem: { flex: 1, alignItems: 'center', gap: 5 },
    weekBlockDay: { color: '#3A3A3A', fontSize: 10, fontFamily: 'Poppins_600SemiBold' },
    weekBlock: {
        width: '100%', aspectRatio: 1, borderRadius: 9,
        borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },
    weekBlockDot: { width: 5, height: 5, borderRadius: 3 },
    weekBlockTodayDot: {
        width: 4, height: 4, borderRadius: 2, backgroundColor: ACCENT,
    },
    weekLegendRow: { flexDirection: 'row', gap: 16, paddingLeft: 2 },
    weekLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    weekLegendDot: { width: 8, height: 8, borderRadius: 4 },
    weekLegendLabel: { color: '#3A3A3A', fontSize: 10, fontFamily: 'Poppins_500Medium' },

    // ── Habits ──
    addHabitBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: ACCENT, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20,
    },
    addHabitBtnText: { color: '#000', fontSize: 12, fontFamily: 'Poppins_700Bold' },
    habitEmptyCard: {
        marginHorizontal: 20, marginBottom: 20, backgroundColor: '#080808',
        borderRadius: 24, paddingVertical: 44, alignItems: 'center',
        borderWidth: 1, borderColor: '#141414', borderStyle: 'dashed',
    },
    habitEmptyIconCircle: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: '#111', borderWidth: 1, borderColor: '#222',
        alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    habitEmptyTitle: { color: '#2E2E2E', fontSize: 15, fontFamily: 'Poppins_600SemiBold', marginBottom: 4 },
    habitEmptyDesc: { color: '#1E1E1E', fontSize: 12, fontFamily: 'Poppins_400Regular', textAlign: 'center', paddingHorizontal: 30 },
    habitCard: {
        marginHorizontal: 20, borderRadius: 24, marginBottom: 18,
        borderWidth: 1, borderColor: '#1A1A1A', backgroundColor: '#0A0A0A',
        overflow: 'hidden', flexDirection: 'row',
    },
    habitAccentBar: { width: 3, backgroundColor: '#1E1E1E' },
    habitCardInner: { flex: 1, padding: 18 },
    habitHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    habitIconBox: {
        width: 46, height: 46, backgroundColor: '#141414',
        borderRadius: 15, borderWidth: 1, borderColor: '#222',
        alignItems: 'center', justifyContent: 'center',
    },
    habitTitle: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_600SemiBold', marginBottom: 2 },
    habitDesc: { color: '#444', fontSize: 11, fontFamily: 'Poppins_400Regular' },
    habitFireBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(255,107,0,0.1)', borderRadius: 20,
        paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,107,0,0.2)',
    },
    habitFireText: { color: '#FF6B00', fontSize: 10, fontFamily: 'Poppins_700Bold' },
    habitStatsRow: {
        flexDirection: 'row', backgroundColor: '#111', borderRadius: 14,
        paddingVertical: 12, marginBottom: 14,
        borderWidth: 1, borderColor: '#1A1A1A',
    },
    habitStatCell: { flex: 1, alignItems: 'center' },
    habitStatValue: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
    habitStatLabel: { color: '#3A3A3A', fontSize: 9, fontFamily: 'Poppins_500Medium', letterSpacing: 0.5 },
    habitStatDivider: { width: 1, backgroundColor: '#1A1A1A', alignSelf: 'stretch' },
    habitProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    habitProgressTrack: { flex: 1, height: 5, backgroundColor: '#1A1A1A', borderRadius: 3, overflow: 'hidden' },
    habitProgressFill: { height: '100%', borderRadius: 3 },
    habitProgressCount: { color: '#444', fontSize: 11, fontFamily: 'Poppins_700Bold', minWidth: 28, textAlign: 'right' },
    hmContainer: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    hmLabels: { justifyContent: 'space-between', paddingVertical: 1 },
    hmLabel: { color: '#2A2A2A', fontSize: 9, fontFamily: 'Poppins_500Medium' },
    hmGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: HEATMAP_GAP },
    hmCell: { width: HEATMAP_CELL, height: HEATMAP_CELL, borderRadius: 2, backgroundColor: '#131313' },
    hmCellActive: { backgroundColor: ACCENT },
    habitMarkBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, height: 46, borderRadius: 23,
        borderWidth: 1, borderColor: ACCENT + '30',
    },
    habitMarkBtnDone: { backgroundColor: ACCENT, borderColor: ACCENT },
    habitMarkBtnText: { color: ACCENT, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },

    // ── PRO badge ──
    proBadge: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: ACCENT, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    },
    proBadgeText: { color: '#000', fontSize: 9, fontFamily: 'Poppins_700Bold', letterSpacing: 0.8 },

    // ── Week cards (PRO) ──
    weekCard: {
        backgroundColor: '#0A0A0A', borderRadius: 20,
        marginHorizontal: 20, marginBottom: 12,
        borderWidth: 1, borderColor: '#1A1A1A', overflow: 'hidden',
    },
    weekCardHeaderGrad: { borderRadius: 0 },
    weekCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    weekNumCircle: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
        justifyContent: 'center', alignItems: 'center',
    },
    weekNumText: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_700Bold' },
    weekCardTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    weekCardSub: { color: '#444', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    weekDistChip: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#141414', paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 10, borderWidth: 1, borderColor: '#222',
    },
    weekDistText: { color: '#555', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
    currentWeekBadge: {
        backgroundColor: ACCENT + '20', borderRadius: 8, marginLeft: 8,
        paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: ACCENT + '40',
    },
    currentWeekBadgeText: { color: ACCENT, fontSize: 8, fontFamily: 'Poppins_700Bold', letterSpacing: 1 },
    weekCardDivider: { height: 1, backgroundColor: '#141414' },
    workoutRow: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10,
    },
    workoutRowBorder: { borderBottomWidth: 1, borderBottomColor: '#111' },
    workoutRowType: {
        width: 24, height: 24, borderRadius: 8,
        borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    },
    workoutRowTypeDot: { width: 7, height: 7, borderRadius: 4 },
    workoutRowIcon: {
        width: 30, height: 30, borderRadius: 10, backgroundColor: '#141414',
        justifyContent: 'center', alignItems: 'center',
    },
    workoutRowTitle: { color: '#CCC', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    workoutRowDetail: { color: '#444', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 1 },
    workoutRowRight: { alignItems: 'flex-end', gap: 4 },
    workoutRowDay: { color: '#444', fontSize: 11, fontFamily: 'Poppins_700Bold' },
    workoutDistPill: {
        borderWidth: 1, borderRadius: 8,
        paddingHorizontal: 7, paddingVertical: 2,
    },
    workoutDistPillText: { fontSize: 10, fontFamily: 'Poppins_700Bold' },

    // ── Upsell card ──
    upsellCard: { marginHorizontal: 20, marginBottom: 12, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: ACCENT + '25' },
    upsellInner: { padding: 22 },
    upsellTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    upsellIconCircle: {
        width: 48, height: 48, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    upsellTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    upsellSub: { color: '#555', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 2 },
    upsellFeatures: { gap: 10, marginBottom: 20 },
    upsellFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    upsellFeatureText: { color: '#888', fontSize: 13, fontFamily: 'Poppins_500Medium' },
    upsellBtn: { height: 50, borderRadius: 25, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    upsellBtnText: { color: '#000', fontSize: 14, fontFamily: 'Poppins_700Bold' },

    // ── Modals ──
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    editMenuContainer: { padding: 16, paddingBottom: 32 },
    menuContent: {
        backgroundColor: '#111', borderRadius: 20,
        borderWidth: 1, borderColor: '#1E1E1E', overflow: 'hidden',
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16 },
    menuText: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_500Medium' },
    menuDivider: { height: 1, backgroundColor: '#161616', marginLeft: 50 },
    subModalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    subModalContent: {
        backgroundColor: '#0D0D0D', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24, borderTopWidth: 1, borderColor: '#1A1A1A',
    },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    subTitleText: { color: '#FFF', fontSize: 18, fontFamily: 'Poppins_700Bold' },
    priceOption: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#141414', borderRadius: 16, padding: 16,
        marginBottom: 10, borderWidth: 1, borderColor: '#1E1E1E',
    },
    priceOptionSelected: { borderColor: ACCENT + '80', backgroundColor: ACCENT + '10' },
    priceTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
    trialBtn: {
        backgroundColor: ACCENT, borderRadius: 30,
        height: 52, justifyContent: 'center', alignItems: 'center',
    },
    trialBtnText: { color: '#000', fontSize: 15, fontFamily: 'Poppins_700Bold' },
    habitInput: {
        backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#222',
        color: '#FFF', fontSize: 14, fontFamily: 'Poppins_400Regular',
        paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12,
    },
    habitModalLabel: { color: '#555', fontSize: 12, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
    freqRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    freqBtn: {
        flex: 1, height: 40, borderRadius: 12, backgroundColor: '#141414',
        borderWidth: 1, borderColor: '#222', justifyContent: 'center', alignItems: 'center',
    },
    freqBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    freqBtnText: { color: '#888', fontSize: 14, fontFamily: 'Poppins_700Bold' },
    iconPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
    iconPickerBtn: {
        width: 46, height: 46, borderRadius: 14,
        backgroundColor: '#141414', borderWidth: 1, borderColor: '#222',
        justifyContent: 'center', alignItems: 'center',
    },
    iconPickerBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
});
