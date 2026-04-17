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
  ImageBackground,
  LogBox,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/legacy-theme.js';
import { useNotifications } from '../context/NotificationContext'; // <--- 1. IMPORT
import { useUser } from '../context/UserContext';
import { errorFeedback, lightTap, successFeedback } from '../utils/haptics';

LogBox.ignoreLogs(['expo-notifications:', 'Permissions module']);

// --- CONFIGURATION ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const { width } = Dimensions.get('window');
const SLIDER_WIDTH = width - 48;

export default function OnboardingScreen({ route, navigation }) {
  const { setUserData, detectLocation, user, loginWithGoogle, updateUserProfile, registerForPushNotificationsAsync } = useUser();
  const { resetNotifications } = useNotifications(); // <--- 2. GET RESET FUNCTION

  const { userName: initialName } = route.params || {};
  const isPreRegistered = !!user;

  const [step, setStep] = useState(1);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const [goal, setGoal] = useState('Get Fitter');
  const [name, setName] = useState(initialName || user?.displayName || '');
  const [gender, setGender] = useState('Male');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const [dateOfBirth, setDateOfBirth] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Time & Frequency
  const defaultTime = new Date();
  defaultTime.setMinutes(defaultTime.getMinutes() + 2);
  const [preferredTime, setPreferredTime] = useState(defaultTime);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [frequency, setFrequency] = useState(3);
  const [selectedDays, setSelectedDays] = useState([]);
  const [isLocating, setIsLocating] = useState(false);

  const [permissions, setPermissions] = useState({
    location: false,
    notifications: false,
    devices: false,
  });

  const [pushToken, setPushToken] = useState(null);

  const areAllPermissionsEnabled = permissions.location && permissions.notifications && permissions.devices;

  const weekDays = [
    { short: 'M', full: 'Monday', trigger: 2 },
    { short: 'T', full: 'Tuesday', trigger: 3 },
    { short: 'W', full: 'Wednesday', trigger: 4 },
    { short: 'T', full: 'Thursday', trigger: 5 },
    { short: 'F', full: 'Friday', trigger: 6 },
    { short: 'S', full: 'Saturday', trigger: 7 },
    { short: 'S', full: 'Sunday', trigger: 1 }
  ];

  const goals = [
    { id: 'Get Fitter', icon: 'fitness', desc: 'Build your fitness healthy routine' },
    { id: 'Run my First 5K', icon: 'walk', desc: 'Complete your first 5K race with confidence' },
    { id: 'Run a Faster 10K', icon: 'flash', desc: 'Improve your 10K time with speed work' },
    { id: 'Train for Half-Marathon', icon: 'trophy', desc: 'Build endurance for 13.1 miles' },
  ];

  // --- ANIMATIONS ---
  const fadeAnims = useRef(goals.map(() => new Animated.Value(0))).current;
  const translateYAnims = useRef(goals.map(() => new Animated.Value(20))).current;

  // Trigger stagger animation when step 1 mounts
  if (step === 1 && fadeAnims.length > 0 && fadeAnims[0]._value === 0) {
    Animated.stagger(100, goals.map((_, i) =>
      Animated.parallel([
        Animated.timing(fadeAnims[i], { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(translateYAnims[i], { toValue: 0, speed: 12, bounciness: 4, useNativeDriver: true })
      ])
    )).start();
  }

  // --- HANDLERS ---
  const toggleLocationPermission = async (value) => {
    if (value) {
      setIsLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setPermissions(prev => ({ ...prev, location: true }));
          successFeedback();
        } else {
          errorFeedback();
          Alert.alert(
            'Permission Required',
            'Location access is needed to track your runs. Please enable it in Settings.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setPermissions(prev => ({ ...prev, location: false })) },
              { text: 'Open Settings', onPress: () => { lightTap(); Linking.openSettings(); } }
            ]
          );
          setPermissions(prev => ({ ...prev, location: false }));
        }
      } catch (e) {
        console.warn('Location permission error:', e);
        setPermissions(prev => ({ ...prev, location: false }));
      } finally {
        setIsLocating(false);
      }
    } else {
      setPermissions(prev => ({ ...prev, location: false }));
    }
  };

  const toggleNotificationPermission = async (value) => {
    if (value) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        errorFeedback();
        Alert.alert(
          "Permission Required",
          "Notifications are disabled for this app. Please enable them in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => { lightTap(); Linking.openSettings(); } }
          ]
        );
        setPermissions(prev => ({ ...prev, notifications: false }));
        return;
      }

      setPermissions(prev => ({ ...prev, notifications: true }));
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Local Notification Test
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Setup Complete! ✅",
          body: "Notifications are active.",
          sound: true,
        },
        trigger: null,
      });

      // Register for Push Token
      const token = await registerForPushNotificationsAsync();
      if (token) setPushToken(token);

      const hour = preferredTime.getHours();
      const minute = preferredTime.getMinutes();
      const timeString = formatTime(preferredTime);
      let scheduledMessage = "";

      if (selectedDays.length > 0) {
        for (let dayIndex of selectedDays) {
          const dayData = weekDays[dayIndex];
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Time to Run! 🏃‍♂️",
              body: `It's ${dayData.full}. Let's hit your goal: ${goal}!`,
              sound: true,
            },
            trigger: {
              weekday: dayData.trigger,
              hour: hour,
              minute: minute,
              repeats: true,
            },
          });
        }
        scheduledMessage = `Reminders set for ${timeString} on ${selectedDays.map(i => weekDays[i].short).join(', ')}`;
      } else {
        await Notifications.scheduleNotificationAsync({
          content: { title: "Daily Reminder", body: "Don't forget to run today!", sound: true },
          trigger: { hour: hour, minute: minute, repeats: true },
        });
        scheduledMessage = `Daily reminders set for ${timeString}.`;
      }

      successFeedback();
      Alert.alert("Success", `Notifications Active!\n\n${scheduledMessage}`);

    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setPermissions(prev => ({ ...prev, notifications: false }));
    }
  };

  const toggleDeviceSync = (value) => {
    if (value) {
      const title = Platform.OS === 'ios' ? "Sync Apple Health" : "Connect Garmin";
      const msg = Platform.OS === 'ios'
        ? "Ruvo wants to read your workout data from Apple Health."
        : "Redirecting to Garmin Connect to authorize...";

      Alert.alert(title, msg, [
        { text: "Cancel", onPress: () => { lightTap(); setPermissions(p => ({ ...p, devices: false })); }, style: "cancel" },
        {
          text: Platform.OS === 'ios' ? "Allow" : "Connect", onPress: () => {
            lightTap();
            setPermissions(p => ({ ...p, devices: true }));
            successFeedback();
            Alert.alert("Connected", "Device linked successfully.");
          }
        }
      ]);
    } else {
      setPermissions(prev => ({ ...prev, devices: false }));
    }
  };

  // --- HELPERS ---
  const onTimeChange = (event, selectedDate) => {
    const currentDate = selectedDate || preferredTime;
    if (Platform.OS === 'android') setShowTimePicker(false);
    setPreferredTime(currentDate);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || dateOfBirth;
    if (Platform.OS === 'android') setShowDatePicker(false);
    setDateOfBirth(currentDate);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    let day = '' + d.getDate();
    let month = '' + (d.getMonth() + 1);
    const year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [day, month, year].join(' - ');
  };

  const isBioValid = () => name.trim() !== '' && weight.trim() !== '' && height.trim() !== '';
  const isDaysValid = () => selectedDays.length > 0;

  const handleContinue = () => {
    lightTap();
    if (step === 2 && !isBioValid()) { errorFeedback(); return Alert.alert('Required Fields', 'Please fill in your name, weight, and height.'); }
    if (step === 4 && !isDaysValid()) { errorFeedback(); return Alert.alert('Select Training Days', 'Please select at least one day.'); }
    if (step === 5 && isPreRegistered && areAllPermissionsEnabled) { handleFinalSave(); return; }
    setStep(step + 1);
  };

  const handleFinalSave = async () => {
    lightTap();
    // 3. WIPE PREVIOUS NOTIFICATIONS ON SIGN UP
    resetNotifications();

    setSaving(true);
    try {
      await updateUserProfile({
        name,
        weight: parseFloat(weight) || 70,
        height: parseFloat(height) || 175,
        gender,
        dob: dateOfBirth.toISOString(),
        runFrequency: frequency,
        selectedDays: selectedDays.map(i => weekDays[i].full),
        goal,
        level: 1,
        currentXP: 0,
        runHistory: [],
        weeklyDistance: 0,
        earningUnlockProgress: 0,
        notificationTime: preferredTime.toISOString(),
        pushToken: pushToken || null,
        onboardingCompleted: true,
      });
      // Navigation handled automatically by auth state change in App.js
    } catch (e) {
      errorFeedback();
      Alert.alert("Save Failed", "We couldn't save your profile. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEmailSignup = () => {
    lightTap();
    // 4. ALSO WIPE HERE TO BE SAFE
    resetNotifications();

    const onboardingData = { name, gender, weight, height, dateOfBirth: dateOfBirth.toISOString(), frequency, userGoal: goal, selectedDays, pushToken };
    navigation.navigate('OnboardingSignUp', { onboardingData });
  }

  const toggleDay = (index) => {
    lightTap();
    if (selectedDays.includes(index)) setSelectedDays(selectedDays.filter(i => i !== index));
    else setSelectedDays([...selectedDays, index].sort());
  };
  const getSelectedDaysString = () => selectedDays.length === 0 ? "Tap days to select" : "Selected: " + selectedDays.map(i => weekDays[i].full).join(', ');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => setScrollEnabled(false),
      onPanResponderMove: (evt, gestureState) => {
        const locationX = gestureState.moveX - 24;
        let percentage = locationX / SLIDER_WIDTH;
        if (percentage < 0) percentage = 0;
        if (percentage > 1) percentage = 1;
        const value = Math.round(percentage * 7);
        setFrequency(value);
      },
      onPanResponderRelease: () => setScrollEnabled(true),
      onPanResponderTerminate: () => setScrollEnabled(true),
    })
  ).current;

  const frequencyMessages = [
    "Perfect! We'll start from the beginning.",
    "Great start! A solid foundation to build on.",
    "Nice! You're getting into a healthy rhythm.",
    "Strong! You're building a serious habit.",
    "Awesome! You're committed to your fitness.",
    "Wow! You're a dedicated runner.",
    "Incredible! You're pushing the limits.",
    "Elite level! You're unstoppable.",
  ];

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity activeOpacity={0.7} style={styles.backButton} onPress={() => { lightTap(); if (navigation.canGoBack()) navigation.goBack(); }}><Ionicons name="chevron-back" size={24} color={COLORS.accent} /></TouchableOpacity>
      <Text style={styles.heading}>What's your primary goal?</Text>
      <Text style={styles.subHeading}>Choose your running goal to get a personalized training plan designed just for you.</Text>
      <View style={{ marginTop: 20 }}>
        {goals.map((item, index) => (
          <Animated.View key={item.id} style={{ opacity: fadeAnims[index], transform: [{ translateY: translateYAnims[index] }] }}>
            <TouchableOpacity activeOpacity={0.7} style={[styles.goalCard, goal === item.id && styles.goalCardSelected, { marginBottom: 16 }]} onPress={() => { lightTap(); setGoal(item.id); }}>
              <View style={styles.iconBox}><Ionicons name={item.icon} size={24} color={goal === item.id ? COLORS.accent : '#FFD700'} /></View>
              <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.id}</Text><Text style={styles.cardDesc}>{item.desc}</Text></View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity activeOpacity={0.7} style={styles.backButton} onPress={() => { lightTap(); setStep(1); }}><Ionicons name="chevron-back" size={24} color={COLORS.accent} /></TouchableOpacity>
      <Text style={styles.heading}>Tell us a bit about you.</Text>
      <Text style={styles.label}>What should we call you? *</Text>
      <TextInput style={styles.textInput} placeholder="e.g. Alex" placeholderTextColor="#666" value={name} onChangeText={setName} />
      <Text style={styles.label}>Gender *</Text>
      <View style={styles.row}>
        {['Male', 'Female'].map((g) => (
          <TouchableOpacity activeOpacity={0.7} key={g} style={[styles.halfButton, gender === g && styles.buttonActive, { borderRadius: 30, paddingVertical: 12 }]} onPress={() => { lightTap(); setGender(g); }}>
            <Text style={[styles.buttonText, gender === g && { color: '#000' }]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Date of Birth *</Text>
      <View style={[styles.textInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' }]}>
        <Text style={{ color: '#FFF', fontFamily: 'Poppins_500Medium', fontSize: 16 }}>{formatDate(dateOfBirth)}</Text>
        <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowDatePicker(true); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="calendar-outline" size={24} color={COLORS.accent} style={{ marginRight: 5 }} />
          <Ionicons name="chevron-down-outline" size={16} color="#AAA" />
        </TouchableOpacity>
      </View>
      {Platform.OS === 'ios' && showDatePicker && (
        <Modal transparent={true} animationType="fade" visible={showDatePicker}>
          <View style={styles.iosModalOverlay}><View style={styles.iosModalContent}>
            <DateTimePicker value={dateOfBirth} mode="date" display="inline" onChange={onDateChange} themeVariant="dark" accentColor={COLORS.accent} style={{ height: 320, width: 300 }} />
            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowDatePicker(false); }} style={styles.iosModalButton}><Text style={styles.iosModalButtonText}>Confirm</Text></TouchableOpacity>
          </View></View>
        </Modal>
      )}
      {Platform.OS === 'android' && showDatePicker && <DateTimePicker value={dateOfBirth} mode="date" display="default" onChange={onDateChange} themeVariant="dark" accentColor={COLORS.accent} />}
      <View style={[styles.row, { gap: 16, marginTop: 15 }]}>
        <View style={{ flex: 1 }}><Text style={styles.label}>Weight (kg) *</Text><TextInput style={styles.textInput} placeholder="70" placeholderTextColor="#666" keyboardType="numeric" value={weight} onChangeText={setWeight} /></View>
        <View style={{ flex: 1 }}><Text style={styles.label}>Height (cm) *</Text><TextInput style={styles.textInput} placeholder="175" placeholderTextColor="#666" keyboardType="numeric" value={height} onChangeText={setHeight} /></View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity activeOpacity={0.7} style={styles.backButton} onPress={() => { lightTap(); setStep(2); }}><Ionicons name="chevron-back" size={24} color={COLORS.accent} /></TouchableOpacity>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(204, 255, 0, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="pulse" size={50} color={COLORS.accent} />
        </View>
      </View>
      <Text style={[styles.heading, { textAlign: 'center' }]}>Set your rhythm</Text>
      <Text style={[styles.subHeading, { textAlign: 'center' }]}>How many times a week do you currently run?</Text>
      <View style={styles.sliderWrapper}>
        <View style={styles.sliderNumbersRow}>{[0, 1, 2, 3, 4, 5, 6, 7].map((num) => (<View key={num} style={styles.numberContainer}>{frequency === num && <View style={styles.activeNumberCircle} />}<Text style={[styles.sliderText, frequency === num && styles.sliderTextActive]}>{num}</Text></View>))}</View>
        <View style={styles.touchArea} {...panResponder.panHandlers}>
          <View style={styles.trackBg} />
          <LinearGradient colors={[COLORS.accent, '#FFFF00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.trackGradient, { width: `${(frequency / 7) * 100}%` }]} />
          <View style={[styles.thumb, { left: `${(frequency / 7) * 95}%` }]} />
        </View>
      </View>
      <Text style={[styles.helperText, { marginTop: 30, color: '#AAA' }]}>{frequencyMessages[frequency]}</Text>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity activeOpacity={0.7} style={styles.backButton} onPress={() => { lightTap(); setStep(3); }}><Ionicons name="chevron-back" size={24} color={COLORS.accent} /></TouchableOpacity>
      <Text style={styles.heading}>Let's Personalize your plan</Text>
      <Text style={styles.subHeading}>Which days are you available to train?</Text>
      <Text style={styles.miniLabel}>Tap to select multiple days *</Text>
      <View style={[styles.daysRow, { justifyContent: 'space-between' }]}>
        {weekDays.map((day, index) => {
          const isSelected = selectedDays.includes(index);
          return (
            <TouchableOpacity activeOpacity={0.7} key={index} style={[styles.dayButton, { width: 42, height: 42, borderRadius: 10 }, isSelected && styles.dayButtonSelected]} onPress={() => toggleDay(index)}>
              <Text style={[styles.dayText, isSelected && { color: '#000', fontFamily: 'Poppins_600SemiBold' }]}>{day.short}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <Text style={styles.greenText}>{getSelectedDaysString()}</Text>
      <View style={{ marginTop: 40 }}>
        <View style={{ backgroundColor: '#1E1E1E', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#333' }}>
          <Text style={[styles.subHeading, { marginBottom: 15, color: '#FFF', fontFamily: 'Poppins_600SemiBold' }]}>At what time?</Text>
          <TouchableOpacity activeOpacity={0.7} style={[styles.timePickerButton, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 55, justifyContent: 'space-between' }]} onPress={() => { lightTap(); setShowTimePicker(true); }}>
            <Text style={[styles.timePickerText, { flex: 1, textAlign: 'left', fontFamily: 'Poppins_600SemiBold' }]}>{formatTime(preferredTime)}</Text>
            <Ionicons name="time-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
      {Platform.OS === 'ios' && showTimePicker && (
        <Modal transparent={true} animationType="fade" visible={showTimePicker}>
          <View style={styles.iosModalOverlay}><View style={styles.iosModalContent}>
            <Text style={{ color: '#FFF', fontSize: 18, marginBottom: 10, fontFamily: 'Poppins_600SemiBold' }}>Select Time</Text>
            <DateTimePicker value={preferredTime} mode="time" display="spinner" onChange={onTimeChange} themeVariant="dark" textColor="#FFF" />
            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightTap(); setShowTimePicker(false); }} style={styles.iosModalButton}><Text style={styles.iosModalButtonText}>Confirm</Text></TouchableOpacity>
          </View></View>
        </Modal>
      )}
      {Platform.OS === 'android' && showTimePicker && <DateTimePicker value={preferredTime} mode="time" display="default" onChange={onTimeChange} />}
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity activeOpacity={0.7} style={styles.backButton} onPress={() => { lightTap(); setStep(4); }}><Ionicons name="chevron-back" size={24} color={COLORS.accent} /></TouchableOpacity>
      <Text style={styles.heading}>Almost ready!</Text>
      <Text style={styles.subHeading}>Let's set up your account and permissions for the best experience.</Text>
      <Text style={styles.sectionHeader}>Enable Permissions</Text>

      <View style={styles.permCard}>
        <View style={styles.permIconBox}><Ionicons name="location" size={20} color={COLORS.accent} /></View>
        <View style={{ flex: 1, paddingHorizontal: 15 }}><Text style={styles.permTitle}>Location Access</Text><Text style={styles.permDesc}>Track your runs accurately.</Text></View>
        {isLocating ? <ActivityIndicator size="small" color={COLORS.accent} /> : <Switch value={permissions.location} onValueChange={toggleLocationPermission} trackColor={{ false: "#767577", true: COLORS.accent }} thumbColor={"#f4f3f4"} />}
      </View>

      <View style={styles.permCard}>
        <View style={styles.permIconBox}><Ionicons name="notifications" size={20} color={COLORS.accent} /></View>
        <View style={{ flex: 1, paddingHorizontal: 15 }}><Text style={styles.permTitle}>Notifications</Text><Text style={styles.permDesc}>Get workout reminders.</Text></View>
        <Switch value={permissions.notifications} onValueChange={toggleNotificationPermission} trackColor={{ false: "#767577", true: COLORS.accent }} thumbColor={"#f4f3f4"} />
      </View>

      <View style={styles.permCard}>
        <View style={styles.permIconBox}><Ionicons name="watch" size={20} color={COLORS.accent} /></View>
        <View style={{ flex: 1, paddingHorizontal: 15 }}><Text style={styles.permTitle}>Connect Devices</Text><Text style={styles.permDesc}>Sync Apple Health / Garmin.</Text></View>
        <Switch value={permissions.devices} onValueChange={toggleDeviceSync} trackColor={{ false: "#767577", true: COLORS.accent }} thumbColor={"#f4f3f4"} />
      </View>

      <View style={styles.authSection}>
        <Text style={styles.sectionHeader}>{isPreRegistered ? 'All Set!' : 'Create Your Account'}</Text>

        {/* SCENARIO A: User Signed Up at the Start */}
        {isPreRegistered ? (
          <View style={{ marginTop: 10 }}>
            {/* --- CHANGE IS HERE: We use 'name' instead of 'user.email' --- */}
            <Text style={{ fontFamily: 'Poppins_400Regular', color: '#AAA', marginBottom: 20 }}>
              Welcome to Ruvo, <Text style={{ color: '#FFF', fontFamily: 'Poppins_700Bold' }}>{name || 'Runner'}</Text>!
            </Text>

            <TouchableOpacity activeOpacity={0.7} style={[styles.continueButton, saving && { opacity: 0.6 }]} onPress={handleFinalSave} disabled={saving}>
              <Text style={styles.continueText}>{saving ? 'Saving...' : 'Get Started'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* SCENARIO B: User is a Guest */
          !areAllPermissionsEnabled ? (
            <Text style={styles.disabledText}>Please enable all permissions above to proceed to account creation.</Text>
          ) : (
            <View>
              <View style={[styles.authSection, { marginTop: 10 }]}>
                {isPreRegistered ? (
                  <Text style={styles.disabledText}>Your profile has been generated. Tap continue to complete setup.</Text>
                ) : (
                  <View style={styles.authButtonsContainer}>
                    <TouchableOpacity activeOpacity={0.7} style={styles.continueButton} onPress={handleEmailSignup}>
                      <Text style={styles.continueText}>Continue with Email</Text>
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7} style={styles.authButtonWhite} onPress={() => { lightTap(); Alert.alert("Apple", "Social Login Simulated"); }}>
                      <Ionicons name="logo-apple" size={20} color="#000" />
                      <Text style={styles.authTextBlack}>Continue with Apple</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} style={styles.authButtonOutline} onPress={async () => {
                      lightTap();
                      setSaving(true);
                      try {
                        const res = await loginWithGoogle();
                        if (res?.success) {
                          successFeedback();
                          await updateUserProfile({
                            name, gender, weight: parseFloat(weight) || 70, height: parseFloat(height) || 175,
                            dob: dateOfBirth.toISOString(), runFrequency: frequency, selectedDays: selectedDays.map(i => weekDays[i].full), goal, level: 1, currentXP: 0, runHistory: [], weeklyDistance: 0, earningUnlockProgress: 0, pushToken: pushToken || null, onboardingCompleted: true
                          });
                        } else if (res?.error?.code === 'SIGN_IN_CANCELLED' || res?.error?.code === '12501') {
                          errorFeedback();
                          Alert.alert("Sign in cancelled", "You cancelled the Google sign-in process.");
                        } else {
                          errorFeedback();
                          Alert.alert("Sign Up Failed", "Google sign-in failed. Please try again.");
                        }
                      } catch (e) {
                        errorFeedback();
                        Alert.alert("Sign Up Failed", "An unexpected error occurred. Please try again.");
                      } finally {
                        setSaving(false);
                      }
                    }}>
                      <Ionicons name="logo-google" size={20} color="#FFF" />
                      <Text style={styles.authTextWhite}>Continue with Google</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )
        )}
      </View>
    </View>
  );

  const showContinueButton = step < 5;

  return (
    <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1599447421405-0e5a10c0071e?q=80&w=2560&auto=format&fit=crop' }} style={styles.background} blurRadius={5}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

          {/* Top Progress Bar */}
          <View style={styles.progressBarContainer}>
            {[1, 2, 3, 4, 5].map((s) => (
              <View key={s} style={[styles.progressSegment, step >= s && styles.progressSegmentActive]} />
            ))}
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 10 }} scrollEnabled={step === 5} showsVerticalScrollIndicator={false}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
          </ScrollView>
          <View style={styles.footer}>
            {showContinueButton && (
              <TouchableOpacity activeOpacity={0.7} style={[styles.continueButton, step === 5 && !areAllPermissionsEnabled && styles.buttonDisabled]} onPress={handleContinue} disabled={step === 5 && !areAllPermissionsEnabled}>
                <Text style={styles.continueText}>Continue</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' }, container: { flex: 1 }, stepContainer: { padding: 24, paddingTop: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  heading: { fontFamily: 'Poppins_800ExtraBold', fontSize: 32, color: '#FFF', marginBottom: 10, lineHeight: 40 },
  subHeading: { fontFamily: 'Poppins_400Regular', fontSize: 16, color: '#AAA', marginBottom: 30, lineHeight: 24 },
  miniLabel: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#888', marginBottom: 15 },
  sectionHeader: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: '#FFF', marginTop: 10, marginBottom: 10 },
  label: { fontFamily: 'Poppins_600SemiBold', color: '#FFF', marginTop: 15, marginBottom: 8 },
  textInput: { backgroundColor: '#1E1E1E', color: '#FFF', padding: 16, borderRadius: 12, fontFamily: 'Poppins_500Medium', fontSize: 16, borderWidth: 1, borderColor: '#333', width: '100%' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfButton: { width: '48%', backgroundColor: '#1E1E1E', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  buttonActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  buttonText: { fontFamily: 'Poppins_700Bold', color: '#FFF' },
  timePickerButton: { backgroundColor: COLORS.accent, borderRadius: 12, height: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  timePickerText: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#000', textAlign: 'center' },
  iosModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  iosModalContent: { backgroundColor: '#1C1C1E', borderRadius: 20, padding: 20, alignItems: 'center', width: 340 },
  iosModalButton: { marginTop: 20, backgroundColor: COLORS.accent, paddingVertical: 10, paddingHorizontal: 30, borderRadius: 20 },
  iosModalButtonText: { color: '#000', fontFamily: 'Poppins_700Bold' },
  goalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  goalCardSelected: { backgroundColor: 'rgba(204, 255, 0, 0.1)', borderColor: COLORS.accent },
  iconBox: { marginRight: 15 },
  cardTitle: { fontFamily: 'Poppins_700Bold', color: '#FFF', fontSize: 16, marginBottom: 4 },
  cardDesc: { fontFamily: 'Poppins_400Regular', color: '#888', fontSize: 12 },
  sliderWrapper: { marginTop: 40 },
  sliderNumbersRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' },
  numberContainer: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  activeNumberCircle: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(204, 255, 0, 0.3)', alignItems: 'center', justifyContent: 'center' },
  sliderText: { fontFamily: 'Poppins_600SemiBold', color: '#666', fontSize: 16, zIndex: 1, textAlign: 'center' },
  sliderTextActive: { color: COLORS.accent, fontSize: 20, fontFamily: 'Poppins_900Black', textAlign: 'center' },
  touchArea: { height: 60, justifyContent: 'center', width: '100%' },
  trackBg: { height: 4, backgroundColor: '#444', borderRadius: 2, width: '100%', position: 'absolute' },
  trackGradient: { height: 4, borderRadius: 2, position: 'absolute' },
  thumb: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.accent, position: 'absolute', top: 14, marginLeft: -16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 2, elevation: 3 },
  helperText: { fontFamily: 'Poppins_500Medium', textAlign: 'center', color: '#FFF', marginTop: 20, fontSize: 16 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  dayButton: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#555', justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  dayButtonSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  dayText: { fontFamily: 'Poppins_700Bold', color: '#FFF' },
  greenText: { fontFamily: 'Poppins_500Medium', color: COLORS.accent, fontSize: 14, marginTop: 10 },
  permCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 16, marginBottom: 12 },
  permIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(204, 255, 0, 0.1)', justifyContent: 'center', alignItems: 'center' },
  permTitle: { fontFamily: 'Poppins_700Bold', color: '#FFF', fontSize: 15 },
  permDesc: { fontFamily: 'Poppins_400Regular', color: '#888', fontSize: 12 },
  authSection: { marginTop: 0, marginBottom: 0 },
  disabledText: { fontFamily: 'Poppins_400Regular', color: '#666', fontSize: 14, marginTop: 5, lineHeight: 20 },
  authButtonsContainer: { marginTop: 10 },
  authButtonWhite: { width: '100%', backgroundColor: '#FFF', padding: 16, borderRadius: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  authButtonOutline: { width: '100%', borderWidth: 1, borderColor: '#555', padding: 16, borderRadius: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  authTextBlack: { fontFamily: 'Poppins_600SemiBold', color: '#000', fontSize: 16, marginLeft: 10 },
  authTextWhite: { fontFamily: 'Poppins_600SemiBold', color: '#FFF', fontSize: 16, marginLeft: 10 },
  footer: { padding: 24, position: 'absolute', bottom: 0, width: '100%' },
  continueButton: { backgroundColor: COLORS.accent, padding: 18, borderRadius: 30, alignItems: 'center', marginBottom: 20, width: '100%', shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  continueText: { fontFamily: 'Poppins_600SemiBold', color: '#000', fontSize: 16, letterSpacing: 1 },
  buttonDisabled: { backgroundColor: '#444' },
  progressBarContainer: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginTop: 10, width: '100%' },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#333' },
  progressSegmentActive: { backgroundColor: COLORS.accent },
});