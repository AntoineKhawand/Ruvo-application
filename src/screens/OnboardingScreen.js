import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  LogBox,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useNotifications } from '../context/NotificationContext';
import { useUser } from '../context/UserContext';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';

LogBox.ignoreLogs(['expo-notifications:', 'Permissions module']);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 6;
const ACCENT = COLORS.accent;

// ─────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ route, navigation }) {
  const { user, loginWithGoogle, updateUserProfile, registerForPushNotificationsAsync } = useUser();
  const { resetNotifications } = useNotifications();

  const { userName: initialName } = route.params || {};
  const isPreRegistered = !!user;

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // ── Step 1 ──
  const [goal, setGoal] = useState('Get Fitter');
  const [targetRaceDate, setTargetRaceDate] = useState(null);
  const [showRaceDatePicker, setShowRaceDatePicker] = useState(false);

  // ── Step 2 (NEW) ──
  const [experience, setExperience] = useState('Beginner');

  // ── Step 3 ──
  const [name, setName] = useState(initialName || user?.displayName || '');
  const [gender, setGender] = useState('Male');
  const [dateOfBirth, setDateOfBirth] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [unitSystem, setUnitSystem] = useState('metric');

  // ── Step 4 ──
  const [frequency, setFrequency] = useState(3);

  // ── Step 5 ──
  const defaultTime = (() => { const t = new Date(); t.setMinutes(t.getMinutes() + 2); return t; })();
  const [preferredTime, setPreferredTime] = useState(defaultTime);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);

  // ── Step 6 ──
  const [permissions, setPermissions] = useState({ location: false, notifications: false });
  const [isLocating, setIsLocating] = useState(false);
  const [pushToken, setPushToken] = useState(null);

  const essentialGranted = permissions.location && permissions.notifications;

  // ── Static data ──
  const RACE_GOALS = ['Run my First 5K', 'Run a Faster 10K', 'Train for Half-Marathon'];
  const isRaceGoal = RACE_GOALS.includes(goal);

  const weekDays = [
    { short: 'M', full: 'Monday',    trigger: 2 },
    { short: 'T', full: 'Tuesday',   trigger: 3 },
    { short: 'W', full: 'Wednesday', trigger: 4 },
    { short: 'T', full: 'Thursday',  trigger: 5 },
    { short: 'F', full: 'Friday',    trigger: 6 },
    { short: 'S', full: 'Saturday',  trigger: 7 },
    { short: 'S', full: 'Sunday',    trigger: 1 },
  ];

  const goals = [
    { id: 'Get Fitter',              icon: 'fitness-outline',  desc: 'Build a healthy running routine' },
    { id: 'Run my First 5K',         icon: 'walk-outline',     desc: 'Complete your first 5K race with confidence' },
    { id: 'Run a Faster 10K',        icon: 'flash-outline',    desc: 'Improve your 10K time with speed work' },
    { id: 'Train for Half-Marathon', icon: 'trophy-outline',   desc: 'Build endurance for 13.1 miles' },
  ];

  const experienceLevels = [
    { id: 'Beginner',     icon: 'leaf-outline',  title: 'Beginner',     desc: 'I rarely run or just started' },
    { id: 'Intermediate', icon: 'walk-outline',  title: 'Intermediate', desc: 'I run 1–3× a week consistently' },
    { id: 'Advanced',     icon: 'flash-outline', title: 'Advanced',     desc: 'I run 4+ times a week or have race history' },
  ];

  const freqMessages = [
    "Perfect! We'll start from the beginning.",
    'Great start! A solid foundation to build on.',
    'Nice! You\'re getting into a healthy rhythm.',
    'Strong! You\'re building a serious habit.',
    'Awesome! You\'re committed to your fitness.',
    'Wow! You\'re a dedicated runner.',
    'Incredible! You\'re pushing the limits.',
    'Elite level! You\'re unstoppable.',
  ];

  // ── Stagger animation for goal cards ──
  const fadeAnims = useRef(goals.map(() => new Animated.Value(0))).current;
  const slideAnims = useRef(goals.map(() => new Animated.Value(24))).current;
  if (step === 1 && fadeAnims[0]._value === 0) {
    Animated.stagger(80, goals.map((_, i) =>
      Animated.parallel([
        Animated.timing(fadeAnims[i], { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(slideAnims[i], { toValue: 0, speed: 14, bounciness: 3, useNativeDriver: true }),
      ])
    )).start();
  }

  // ─────────────────────────────────────────────────────────────────
  // PERMISSION HANDLERS
  // ─────────────────────────────────────────────────────────────────
  const toggleLocation = async (value) => {
    if (!value) { setPermissions(p => ({ ...p, location: false })); return; }
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissions(p => ({ ...p, location: true }));
        successFeedback();
      } else {
        errorFeedback();
        Alert.alert('Permission Required', 'Location is needed to track your runs.', [
          { text: 'Cancel', style: 'cancel', onPress: () => setPermissions(p => ({ ...p, location: false })) },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        setPermissions(p => ({ ...p, location: false }));
      }
    } catch { setPermissions(p => ({ ...p, location: false })); }
    finally { setIsLocating(false); }
  };

  const toggleNotifications = async (value) => {
    if (!value) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setPermissions(p => ({ ...p, notifications: false }));
      return;
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') {
      errorFeedback();
      Alert.alert('Permission Required', 'Notifications are disabled. Enable them in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      setPermissions(p => ({ ...p, notifications: false }));
      return;
    }
    setPermissions(p => ({ ...p, notifications: true }));
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Setup Complete! ✅', body: 'Ruvo notifications are active.', sound: true },
      trigger: null,
    });
    const token = await registerForPushNotificationsAsync();
    if (token) setPushToken(token);
    const hour = preferredTime.getHours();
    const minute = preferredTime.getMinutes();
    if (selectedDays.length > 0) {
      await Promise.all(selectedDays.map(i => Notifications.scheduleNotificationAsync({
        content: { title: 'Time to Run! 🏃‍♂️', body: `It's ${weekDays[i].full}. Let's hit your goal: ${goal}!`, sound: true },
        trigger: { weekday: weekDays[i].trigger, hour, minute, repeats: true },
      })));
    } else {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Daily Reminder', body: "Don't forget to run today!", sound: true },
        trigger: { hour, minute, repeats: true },
      });
    }
    successFeedback();
  };

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────
  const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDateLong = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const computeAge = (dob) => new Date().getFullYear() - new Date(dob).getFullYear();

  const toggleDay = (index) => {
    lightTap();
    setSelectedDays(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index].sort()
    );
  };

  const buildProfile = () => ({
    name,
    gender,
    weight: parseFloat(weight) || 70,
    height: parseFloat(height) || 175,
    dob: dateOfBirth.toISOString(),
    age: computeAge(dateOfBirth),
    experience,
    unitSystem,
    runFrequency: frequency,
    selectedDays: selectedDays.map(i => weekDays[i].full),
    runDays: selectedDays.map(i => weekDays[i].full),
    goal,
    targetRaceDate: targetRaceDate?.toISOString() || null,
    notificationTime: preferredTime.toISOString(),
    pushToken: pushToken || null,
    level: 1,
    currentXP: 0,
    runHistory: [],
    weeklyDistance: 0,
    earningUnlockProgress: 0,
    onboardingCompleted: true,
  });

  // ─────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────────
  const handleContinue = () => {
    lightTap();
    if (step === 3 && (!name.trim() || !weight.trim() || !height.trim())) {
      errorFeedback();
      return Alert.alert('Required Fields', 'Please fill in your name, weight, and height.');
    }
    if (step === 5 && selectedDays.length === 0) {
      errorFeedback();
      return Alert.alert('Select Training Days', 'Please select at least one day.');
    }
    if (step === 6 && isPreRegistered && essentialGranted) {
      handleFinalSave(); return;
    }
    setStep(s => s + 1);
  };

  const handleFinalSave = async () => {
    lightTap();
    resetNotifications();
    setSaving(true);
    try {
      await updateUserProfile(buildProfile());
    } catch {
      errorFeedback();
      Alert.alert('Save Failed', "We couldn't save your profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEmailSignup = () => {
    lightTap();
    resetNotifications();
    navigation.navigate('OnboardingSignUp', { onboardingData: buildProfile() });
  };

  // ─────────────────────────────────────────────────────────────────
  // STEP 1 — GOAL
  // ─────────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <BackBtn onPress={() => { lightTap(); navigation.canGoBack() && navigation.goBack(); }} />
      <Text style={styles.heading}>{"What's your primary\nrunning goal?"}</Text>
      <Text style={styles.subHeading}>Choose one — your entire plan is built around it.</Text>

      <View style={{ gap: 12, marginTop: 4 }}>
        {goals.map((item, i) => {
          const selected = goal === item.id;
          return (
            <Animated.View key={item.id} style={{ opacity: fadeAnims[i], transform: [{ translateY: slideAnims[i] }] }}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.goalCard, selected && styles.goalCardSelected]}
                onPress={() => { lightTap(); setGoal(item.id); }}
              >
                <View style={[styles.goalIconBox, selected && styles.goalIconBoxActive]}>
                  <Ionicons name={item.icon} size={22} color={selected ? '#000' : ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.id}</Text>
                  <Text style={styles.cardDesc}>{item.desc}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color={ACCENT} />}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* Conditional race date */}
      {isRaceGoal && (
        <View style={styles.raceDateCard}>
          <View style={styles.raceDateHeader}>
            <Ionicons name="flag-outline" size={16} color={ACCENT} />
            <Text style={styles.raceDateLabel}>Race day (optional)</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.raceDateBtn, targetRaceDate && styles.raceDateBtnSet]}
            onPress={() => { lightTap(); setShowRaceDatePicker(true); }}
          >
            <Text style={[styles.raceDateBtnText, targetRaceDate && styles.raceDateBtnTextSet]}>
              {targetRaceDate ? formatDateLong(targetRaceDate) : 'Set a target race date'}
            </Text>
            <Ionicons name="calendar-outline" size={16} color={targetRaceDate ? '#000' : ACCENT} />
          </TouchableOpacity>
          {targetRaceDate && (
            <TouchableOpacity onPress={() => setTargetRaceDate(null)} style={styles.raceDateClear}>
              <Text style={styles.raceDateClearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {Platform.OS === 'ios' && showRaceDatePicker && (
        <IosDateModal value={targetRaceDate || new Date()} mode="date" min={new Date()} onChange={(_, d) => { if (d) setTargetRaceDate(d); }} onClose={() => setShowRaceDatePicker(false)} />
      )}
      {Platform.OS === 'android' && showRaceDatePicker && (
        <DateTimePicker value={targetRaceDate || new Date()} mode="date" minimumDate={new Date()} onChange={(_, d) => { setShowRaceDatePicker(false); if (d) setTargetRaceDate(d); }} />
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────
  // STEP 2 — FITNESS LEVEL (NEW)
  // ─────────────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <BackBtn onPress={() => { lightTap(); setStep(1); }} />
      <Text style={styles.heading}>{"What's your\ncurrent level?"}</Text>
      <Text style={styles.subHeading}>This shapes your training intensity from day one.</Text>

      <View style={{ gap: 14, marginTop: 8 }}>
        {experienceLevels.map(lvl => {
          const sel = experience === lvl.id;
          return (
            <TouchableOpacity
              key={lvl.id}
              activeOpacity={0.75}
              style={[styles.levelCard, sel && styles.levelCardSelected]}
              onPress={() => { lightTap(); setExperience(lvl.id); }}
            >
              <LinearGradient
                colors={sel ? [ACCENT, '#AADE00'] : ['#1E1E1E', '#141414']}
                style={styles.levelIconBox}
              >
                <Ionicons name={lvl.icon} size={26} color={sel ? '#000' : '#FFF'} />
              </LinearGradient>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={[styles.levelTitle, sel && { color: ACCENT }]}>{lvl.title}</Text>
                <Text style={styles.levelDesc}>{lvl.desc}</Text>
              </View>
              {sel && <Ionicons name="checkmark-circle" size={22} color={ACCENT} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────
  // STEP 3 — BIO + UNITS
  // ─────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <BackBtn onPress={() => { lightTap(); setStep(2); }} />
      <Text style={styles.heading}>Tell us about you.</Text>
      <Text style={styles.subHeading}>Powers calorie tracking, HR zones, and training load.</Text>

      <FieldLabel>Display Name *</FieldLabel>
      <TextInput
        style={styles.textInput}
        placeholder="e.g. Alex"
        placeholderTextColor="#555"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <FieldLabel>Gender</FieldLabel>
      <View style={styles.pillRow}>
        {['Male', 'Female', 'Other'].map(g => (
          <TouchableOpacity
            key={g}
            activeOpacity={0.75}
            style={[styles.pill, gender === g && styles.pillActive]}
            onPress={() => { lightTap(); setGender(g); }}
          >
            <Text style={[styles.pillText, gender === g && styles.pillTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FieldLabel>Date of Birth</FieldLabel>
      <TouchableOpacity activeOpacity={0.8} style={styles.dateRow} onPress={() => { lightTap(); setShowDatePicker(true); }}>
        <Text style={styles.dateText}>{formatDateLong(dateOfBirth)}</Text>
        <Ionicons name="calendar-outline" size={20} color={ACCENT} />
      </TouchableOpacity>
      {Platform.OS === 'ios' && showDatePicker && (
        <IosDateModal value={dateOfBirth} mode="date" onChange={(_, d) => { if (d) setDateOfBirth(d); }} onClose={() => setShowDatePicker(false)} />
      )}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker value={dateOfBirth} mode="date" onChange={(_, d) => { setShowDatePicker(false); if (d) setDateOfBirth(d); }} themeVariant="dark" accentColor={ACCENT} />
      )}

      <View style={styles.measureRow}>
        <View style={{ flex: 1 }}>
          <FieldLabel>Weight *</FieldLabel>
          <View style={styles.measureBox}>
            <TextInput
              style={styles.measureInput}
              placeholder={unitSystem === 'metric' ? '70' : '154'}
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
            />
            <Text style={styles.measureUnit}>{unitSystem === 'metric' ? 'kg' : 'lbs'}</Text>
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <FieldLabel>Height *</FieldLabel>
          <View style={styles.measureBox}>
            <TextInput
              style={styles.measureInput}
              placeholder={unitSystem === 'metric' ? '175' : '69'}
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={height}
              onChangeText={setHeight}
            />
            <Text style={styles.measureUnit}>{unitSystem === 'metric' ? 'cm' : 'in'}</Text>
          </View>
        </View>
      </View>

      <FieldLabel>Units</FieldLabel>
      <View style={styles.unitRow}>
        {[
          { id: 'metric',   label: 'Metric',   sub: 'km · kg · cm' },
          { id: 'imperial', label: 'Imperial', sub: 'mi · lbs · in' },
        ].map(u => (
          <TouchableOpacity
            key={u.id}
            activeOpacity={0.75}
            style={[styles.unitCard, unitSystem === u.id && styles.unitCardActive]}
            onPress={() => { lightTap(); setUnitSystem(u.id); }}
          >
            <Text style={[styles.unitLabel, unitSystem === u.id && styles.unitLabelActive]}>{u.label}</Text>
            <Text style={styles.unitSub}>{u.sub}</Text>
            {unitSystem === u.id && (
              <Ionicons name="checkmark-circle" size={16} color={ACCENT} style={{ position: 'absolute', top: 10, right: 10 }} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────
  // STEP 4 — FREQUENCY (chips, no PanResponder)
  // ─────────────────────────────────────────────────────────────────
  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <BackBtn onPress={() => { lightTap(); setStep(3); }} />
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <View style={styles.stepIconCircle}>
          <Ionicons name="pulse" size={44} color={ACCENT} />
        </View>
      </View>
      <Text style={[styles.heading, { textAlign: 'center' }]}>Set your rhythm</Text>
      <Text style={[styles.subHeading, { textAlign: 'center' }]}>How many times a week do you currently run?</Text>

      <View style={styles.freqGrid}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(num => {
          const sel = frequency === num;
          return (
            <TouchableOpacity
              key={num}
              activeOpacity={0.75}
              style={[styles.freqChip, sel && styles.freqChipActive]}
              onPress={() => { lightTap(); setFrequency(num); }}
            >
              <Text style={[styles.freqNum, sel && styles.freqNumActive]}>{num}</Text>
              <Text style={[styles.freqSub, sel && styles.freqSubActive]}>
                {num === 0 ? 'never' : num === 1 ? 'day' : 'days'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.freqBanner}>
        <Ionicons name="sparkles" size={15} color={ACCENT} style={{ marginRight: 10 }} />
        <Text style={styles.freqBannerText}>{freqMessages[frequency]}</Text>
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────
  // STEP 5 — TRAINING DAYS + TIME
  // ─────────────────────────────────────────────────────────────────
  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <BackBtn onPress={() => { lightTap(); setStep(4); }} />
      <Text style={styles.heading}>{"Let's plan\nyour week"}</Text>
      <Text style={styles.subHeading}>Which days are you available to train?</Text>

      <View style={styles.daysRow}>
        {weekDays.map((day, i) => {
          const sel = selectedDays.includes(i);
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.75}
              style={[styles.dayChip, sel && styles.dayChipActive]}
              onPress={() => toggleDay(i)}
            >
              <Text style={[styles.dayShort, sel && styles.dayShortActive]}>{day.short}</Text>
              <Text style={[styles.dayFull, sel && styles.dayFullActive]}>{day.full.slice(0, 3)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedDays.length > 0 && (
        <View style={styles.daysChosen}>
          <Ionicons name="checkmark-circle" size={14} color={ACCENT} />
          <Text style={styles.daysChosenText}>
            {selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''}: {selectedDays.map(i => weekDays[i].full.slice(0, 3)).join(', ')}
          </Text>
        </View>
      )}

      <View style={styles.timeCard}>
        <Text style={styles.timeCardLabel}>Preferred run time</Text>
        <TouchableOpacity activeOpacity={0.85} style={styles.timeBtn} onPress={() => { lightTap(); setShowTimePicker(true); }}>
          <Text style={styles.timeBtnText}>{formatTime(preferredTime)}</Text>
          <Ionicons name="time-outline" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      {Platform.OS === 'ios' && showTimePicker && (
        <IosDateModal value={preferredTime} mode="time" onChange={(_, d) => { if (d) setPreferredTime(d); }} onClose={() => setShowTimePicker(false)} timeMode />
      )}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker value={preferredTime} mode="time" display="default" onChange={(_, d) => { setShowTimePicker(false); if (d) setPreferredTime(d); }} />
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────
  // STEP 6 — PERMISSIONS + ACCOUNT
  // ─────────────────────────────────────────────────────────────────
  const renderStep6 = () => (
    <View style={styles.stepContainer}>
      <BackBtn onPress={() => { lightTap(); setStep(5); }} />
      <Text style={styles.heading}>Almost ready!</Text>
      <Text style={styles.subHeading}>Grant permissions for the best experience.</Text>

      <Text style={styles.permSection}>Required</Text>
      <PermRow
        icon="location"
        title="Location Access"
        desc="Track your runs accurately with GPS."
        value={permissions.location}
        onValueChange={toggleLocation}
        loading={isLocating}
      />
      <PermRow
        icon="notifications"
        title="Notifications"
        desc="Get workout reminders on your schedule."
        value={permissions.notifications}
        onValueChange={toggleNotifications}
      />

      <Text style={[styles.permSection, { marginTop: 10 }]}>Optional</Text>
      <View style={[styles.permCard, { opacity: 0.55 }]}>
        <View style={styles.permIcon}><Ionicons name="watch" size={20} color={ACCENT} /></View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.permTitle}>Wearables & Health</Text>
          <Text style={styles.permDesc}>Connect later in Settings → Devices.</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#444" />
      </View>

      <Text style={styles.sectionHeader}>{isPreRegistered ? 'All Set!' : 'Create Your Account'}</Text>

      {isPreRegistered ? (
        <View>
          <Text style={styles.welcomeText}>
            Welcome, <Text style={{ color: '#FFF', fontFamily: 'Poppins_700Bold' }}>{name || 'Runner'}</Text>! 🎉
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.cta, (!essentialGranted || saving) && styles.ctaDisabled]}
            onPress={handleFinalSave}
            disabled={!essentialGranted || saving}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.ctaText}>Get Started</Text>
            }
          </TouchableOpacity>
          {!essentialGranted && <Text style={styles.permHint}>Enable Location & Notifications to continue.</Text>}
        </View>
      ) : !essentialGranted ? (
        <Text style={styles.disabledHint}>Enable Location and Notifications above to create your account.</Text>
      ) : (
        <View style={{ gap: 12, marginTop: 8 }}>
          <TouchableOpacity activeOpacity={0.85} style={styles.cta} onPress={handleEmailSignup}>
            <Text style={styles.ctaText}>Continue with Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.ctaOutline}
            onPress={async () => {
              lightTap();
              setSaving(true);
              try {
                const res = await loginWithGoogle();
                if (res?.success) {
                  successFeedback();
                  await updateUserProfile(buildProfile());
                } else if (['SIGN_IN_CANCELLED', '12501'].includes(res?.error?.code)) {
                  errorFeedback();
                  Alert.alert('Cancelled', 'Google sign-in was cancelled.');
                } else {
                  errorFeedback();
                  Alert.alert('Sign Up Failed', 'Google sign-in failed. Please try again.');
                }
              } catch {
                errorFeedback();
                Alert.alert('Sign Up Failed', 'An unexpected error occurred.');
              } finally {
                setSaving(false);
              }
            }}
          >
            <Ionicons name="logo-google" size={20} color="#FFF" />
            <Text style={styles.ctaOutlineText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────
  // ROOT RENDER
  // ─────────────────────────────────────────────────────────────────
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#060F00', '#000000', '#00060F']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Progress bar */}
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.progressSeg, i < step && styles.progressSegActive]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</Text>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
        </ScrollView>

        {step < 6 && (
          <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom) }]}>
            <TouchableOpacity activeOpacity={0.85} style={styles.cta} onPress={handleContinue}>
              <Text style={styles.ctaText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// SHARED SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────
const BackBtn = ({ onPress }) => (
  <TouchableOpacity activeOpacity={0.7} style={styles.backBtn} onPress={onPress}>
    <Ionicons name="chevron-back" size={22} color={COLORS.accent} />
  </TouchableOpacity>
);

const FieldLabel = ({ children }) => <Text style={styles.fieldLabel}>{children}</Text>;

const PermRow = ({ icon, title, desc, value, onValueChange, loading }) => (
  <View style={styles.permCard}>
    <View style={styles.permIcon}><Ionicons name={icon} size={20} color={COLORS.accent} /></View>
    <View style={{ flex: 1, marginLeft: 14 }}>
      <Text style={styles.permTitle}>{title}</Text>
      <Text style={styles.permDesc}>{desc}</Text>
    </View>
    {loading
      ? <ActivityIndicator size="small" color={COLORS.accent} />
      : <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#333', true: COLORS.accent }} thumbColor="#FFF" ios_backgroundColor="#333" />
    }
  </View>
);

const IosDateModal = ({ value, mode, min, onChange, onClose, timeMode }) => (
  <Modal transparent animationType="fade" visible>
    <View style={styles.iosOverlay}>
      <View style={styles.iosSheet}>
        {timeMode && <Text style={styles.iosSheetTitle}>Select Time</Text>}
        <DateTimePicker
          value={value}
          mode={mode}
          display={timeMode ? 'spinner' : 'inline'}
          onChange={onChange}
          themeVariant="dark"
          accentColor={COLORS.accent}
          minimumDate={min}
          style={timeMode ? {} : { height: 320, width: 300 }}
        />
        <TouchableOpacity activeOpacity={0.85} onPress={onClose} style={styles.iosConfirmBtn}>
          <Text style={styles.iosConfirmText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Progress
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 2 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#1E1E1E' },
  progressSegActive: { backgroundColor: COLORS.accent },
  stepLabel: { color: '#444', fontSize: 11, fontFamily: 'Poppins_500Medium', textAlign: 'right', paddingRight: 24, marginBottom: 4 },

  // Layout
  stepContainer: { padding: 24, paddingTop: 10 },
  footer: { paddingHorizontal: 24, paddingTop: 10, position: 'absolute', bottom: 0, left: 0, right: 0 },

  // Back button
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center', marginBottom: 22, borderWidth: 1, borderColor: '#2A2A2A' },

  // Typography
  heading: { fontFamily: 'Poppins_800ExtraBold', fontSize: 30, color: '#FFF', marginBottom: 8, lineHeight: 38 },
  subHeading: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#777', marginBottom: 20, lineHeight: 22 },
  fieldLabel: { fontFamily: 'Poppins_600SemiBold', color: '#888', fontSize: 11, marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionHeader: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: '#FFF', marginTop: 22, marginBottom: 12 },

  // ── Step 1 — Goals ──
  goalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C0C0C', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#1E1E1E' },
  goalCardSelected: { backgroundColor: 'rgba(204,255,0,0.06)', borderColor: COLORS.accent },
  goalIconBox: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  goalIconBoxActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  cardTitle: { fontFamily: 'Poppins_700Bold', color: '#FFF', fontSize: 14, marginBottom: 2 },
  cardDesc: { fontFamily: 'Poppins_400Regular', color: '#555', fontSize: 12 },

  raceDateCard: { backgroundColor: 'rgba(204,255,0,0.04)', borderRadius: 16, padding: 16, marginTop: 18, borderWidth: 1, borderColor: 'rgba(204,255,0,0.18)' },
  raceDateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  raceDateLabel: { color: '#AAA', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  raceDateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: '#2A2A2A' },
  raceDateBtnSet: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  raceDateBtnText: { color: '#888', fontFamily: 'Poppins_500Medium', fontSize: 14 },
  raceDateBtnTextSet: { color: '#000', fontFamily: 'Poppins_700Bold' },
  raceDateClear: { alignSelf: 'flex-end', marginTop: 8 },
  raceDateClearText: { color: '#444', fontSize: 11, fontFamily: 'Poppins_400Regular' },

  // ── Step 2 — Level ──
  levelCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C0C0C', padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#1E1E1E' },
  levelCardSelected: { borderColor: COLORS.accent, backgroundColor: 'rgba(204,255,0,0.05)' },
  levelIconBox: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  levelTitle: { fontFamily: 'Poppins_700Bold', color: '#FFF', fontSize: 16, marginBottom: 2 },
  levelDesc: { fontFamily: 'Poppins_400Regular', color: '#555', fontSize: 12 },

  // ── Step 3 — Bio ──
  textInput: { backgroundColor: '#0C0C0C', color: '#FFF', padding: 16, borderRadius: 14, fontFamily: 'Poppins_500Medium', fontSize: 15, borderWidth: 1, borderColor: '#2A2A2A' },
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#0C0C0C', borderWidth: 1, borderColor: '#2A2A2A' },
  pillActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  pillText: { fontFamily: 'Poppins_600SemiBold', color: '#666', fontSize: 14 },
  pillTextActive: { color: '#000' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0C0C0C', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  dateText: { color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 15 },
  measureRow: { flexDirection: 'row' },
  measureBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C0C0C', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A', overflow: 'hidden' },
  measureInput: { flex: 1, color: '#FFF', padding: 15, fontFamily: 'Poppins_500Medium', fontSize: 15 },
  measureUnit: { color: '#555', fontFamily: 'Poppins_600SemiBold', fontSize: 12, paddingRight: 12 },
  unitRow: { flexDirection: 'row', gap: 12 },
  unitCard: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#0C0C0C', borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center', position: 'relative' },
  unitCardActive: { backgroundColor: 'rgba(204,255,0,0.07)', borderColor: COLORS.accent },
  unitLabel: { color: '#777', fontFamily: 'Poppins_700Bold', fontSize: 14 },
  unitLabelActive: { color: COLORS.accent },
  unitSub: { color: '#444', fontFamily: 'Poppins_400Regular', fontSize: 11, marginTop: 3 },

  // ── Step 4 — Frequency ──
  stepIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(204,255,0,0.07)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(204,255,0,0.18)' },
  freqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 8, paddingHorizontal: 4 },
  freqChip: { width: (width - 48 - 12 * 3) / 4, aspectRatio: 1, borderRadius: 16, backgroundColor: '#0C0C0C', borderWidth: 1, borderColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center' },
  freqChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  freqNum: { color: '#FFF', fontFamily: 'Poppins_800ExtraBold', fontSize: 26, lineHeight: 30 },
  freqNumActive: { color: '#000' },
  freqSub: { color: '#444', fontFamily: 'Poppins_400Regular', fontSize: 10, marginTop: 2 },
  freqSubActive: { color: 'rgba(0,0,0,0.6)' },
  freqBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(204,255,0,0.05)', borderRadius: 14, padding: 14, marginTop: 24, borderWidth: 1, borderColor: 'rgba(204,255,0,0.12)' },
  freqBannerText: { flex: 1, color: '#CCC', fontFamily: 'Poppins_500Medium', fontSize: 13, lineHeight: 20 },

  // ── Step 5 — Days ──
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, marginTop: 6 },
  dayChip: { flex: 1, marginHorizontal: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#0C0C0C', borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center' },
  dayChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  dayShort: { color: '#777', fontFamily: 'Poppins_700Bold', fontSize: 13 },
  dayShortActive: { color: '#000' },
  dayFull: { color: '#333', fontFamily: 'Poppins_400Regular', fontSize: 9, marginTop: 3 },
  dayFullActive: { color: 'rgba(0,0,0,0.5)' },
  daysChosen: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  daysChosenText: { color: COLORS.accent, fontFamily: 'Poppins_500Medium', fontSize: 12 },
  timeCard: { backgroundColor: '#0C0C0C', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  timeCardLabel: { color: '#666', fontFamily: 'Poppins_600SemiBold', fontSize: 12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  timeBtn: { backgroundColor: COLORS.accent, borderRadius: 12, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  timeBtnText: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#000' },

  // ── Step 6 — Permissions ──
  permSection: { fontFamily: 'Poppins_600SemiBold', color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  permCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C0C0C', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1E1E1E' },
  permIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(204,255,0,0.08)', justifyContent: 'center', alignItems: 'center' },
  permTitle: { fontFamily: 'Poppins_700Bold', color: '#FFF', fontSize: 14 },
  permDesc: { fontFamily: 'Poppins_400Regular', color: '#555', fontSize: 12, marginTop: 1 },
  welcomeText: { fontFamily: 'Poppins_400Regular', color: '#777', marginBottom: 18, fontSize: 14 },
  disabledHint: { fontFamily: 'Poppins_400Regular', color: '#444', fontSize: 13, marginTop: 8, lineHeight: 20 },
  permHint: { color: '#555', fontFamily: 'Poppins_400Regular', fontSize: 12, textAlign: 'center', marginTop: 10 },

  // ── CTA Buttons ──
  cta: { backgroundColor: COLORS.accent, paddingVertical: 17, borderRadius: 30, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', boxShadow: "0 4px 20px rgba(204, 255, 0, 0.28)" },
  ctaText: { fontFamily: 'Poppins_700Bold', color: '#000', fontSize: 16, letterSpacing: 0.3 },
  ctaDisabled: { backgroundColor: '#1A1A1A', opacity: 0.5, boxShadow: 'none' },
  ctaOutline: { borderWidth: 1, borderColor: '#333', paddingVertical: 16, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaOutlineText: { fontFamily: 'Poppins_600SemiBold', color: '#FFF', fontSize: 15, marginLeft: 10 },

  // ── iOS date/time modal ──
  iosOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.88)' },
  iosSheet: { backgroundColor: '#141414', borderRadius: 22, padding: 22, alignItems: 'center', width: 340, borderWidth: 1, borderColor: '#2A2A2A' },
  iosSheetTitle: { color: '#FFF', fontSize: 17, fontFamily: 'Poppins_600SemiBold', marginBottom: 12 },
  iosConfirmBtn: { marginTop: 20, backgroundColor: COLORS.accent, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 24 },
  iosConfirmText: { color: '#000', fontFamily: 'Poppins_700Bold', fontSize: 15 },
});
