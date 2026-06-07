import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
});

import {
  Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
  Poppins_800ExtraBold, Poppins_900Black
} from '@expo-google-fonts/poppins';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import * as Font from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Image, StyleSheet, Text, View, LogBox } from 'react-native';

LogBox.ignoreLogs([
  'VirtualizedLists should never be nested', // Suppress the ScrollView nesting warning without breaking UI
]);

// --- TEMPORARY SEEDER IMPORTS ---

// --- CONTEXTS ---
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { UserProvider, useUser } from './src/context/UserContext';

import AchievementsScreen from './src/screens/AchievementsScreen';
import ActiveRunScreen from './src/screens/ActiveRunScreen';
import AICoachScreen from './src/screens/AICoachScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import ChatScreen from './src/screens/ChatScreen';
import ClubDetailScreen from './src/screens/ClubDetailScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import CreateClubScreen from './src/screens/CreateClubScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import FindFriendsScreen from './src/screens/FindFriendsScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import GearScreen from './src/screens/GearScreen';
import HelpCenterScreen from './src/screens/HelpCenterScreen';
import HomeScreen from './src/screens/HomeScreen';
import LockScreen from './src/screens/LockScreen';
import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import OnboardingSignUpScreen from './src/screens/OnboardingSignUpScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import PlanScreen from './src/screens/PlanScreen';
import PrivacyControlsScreen from './src/screens/PrivacyControlsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import RateEffortScreen from './src/screens/RateEffortScreen';
import ReferralScreen from './src/screens/ReferralScreen';
import RewardsScreen from './src/screens/RewardsScreen';
import MyRedemptionsScreen from './src/screens/MyRedemptionsScreen';
import SaveActivityScreen from './src/screens/SaveActivityScreen';
import SearchScreen from './src/screens/SearchScreen';
import SettingsDetailScreen from './src/screens/SettingsDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import TipDetailScreen from './src/screens/TipDetailScreen';
import UserListScreen from './src/screens/UserListScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import WorkoutDetailScreen from './src/screens/WorkoutDetailScreen';
import RunDetailScreen from './src/screens/RunDetailScreen';

import ConnectedDevicesScreen from './src/screens/ConnectedDevicesScreen';

const Stack = createStackNavigator();

// ✅ FIX: Create navigation ref to prevent race conditions
export const navigationRef = createNavigationContainerRef();

// ─── Branded loading screen ───────────────────────────────────────
const LOAD_PHRASES = [
  'Lacing up…',
  'Syncing your runs…',
  'Loading your stats…',
  'Almost ready…',
];

function BrandedLoadingScreen() {
  const rotate1  = useRef(new Animated.Value(0)).current;
  const rotate2  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate1, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.timing(rotate2, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setPhraseIdx(i => (i + 1) % LOAD_PHRASES.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  const spin1 = rotate1.interpolate({ inputRange: [0, 1], outputRange: ['0deg',   '360deg'] });
  const spin2 = rotate2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg']   });

  return (
    <View style={ls.container}>
      {/* Logo with breathing pulse */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 52 }}>
        <Image
          source={require('./assets/images/Ruvo Logo Original.png')}
          style={{ width: 140, height: 44 }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Double-ring spinner */}
      <View style={ls.ringWrapper}>
        <Animated.View style={[ls.ringOuter, { transform: [{ rotate: spin1 }] }]} />
        <Animated.View style={[ls.ringInner, { transform: [{ rotate: spin2 }] }]} />
        <View style={ls.centerDot} />
      </View>

      {/* Cycling copy */}
      <Animated.Text style={[ls.phrase, { opacity: fadeAnim }]}>
        {LOAD_PHRASES[phraseIdx]}
      </Animated.Text>

      {/* Bottom tagline */}
      <Text style={ls.tagline}>RUN FURTHER TOGETHER</Text>
    </View>
  );
}

const RootNavigator = () => {
  // ✅ FIX: Use 'isLoading' to match your Context
  const { user, userData, isLoading } = useUser();

  if (isLoading) {
    return <BrandedLoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: {
          open: { animation: 'timing', config: { duration: 260, easing: Easing.out(Easing.poly(4)) } },
          close: { animation: 'timing', config: { duration: 220, easing: Easing.in(Easing.poly(4)) } },
        },
      }}>

        {user ? (
          // ---------------------------------------------------------
          // SCENARIO A: USER IS LOGGED IN
          // ---------------------------------------------------------
          <>
            {!userData?.onboardingCompleted ? (
              <>
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                <Stack.Screen name="OnboardingSignUp" component={OnboardingSignUpScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="Home" component={HomeScreen} options={{ animationEnabled: false }} />

                {/* Main App Screens */}
                <Stack.Screen name="Community" component={CommunityScreen} options={{ animationEnabled: false }} />
                <Stack.Screen name="Profile" component={ProfileScreen} options={{ animationEnabled: false }} />

                {/* Workout Flow */}
                <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ gestureEnabled: true }} />
                <Stack.Screen name="RunDetail" component={RunDetailScreen} options={{ gestureEnabled: true }} />
                <Stack.Screen name="ActiveRun" component={ActiveRunScreen} options={{
                  gestureEnabled: false,
                  cardStyleInterpolator: ({ current: { progress } }) => ({
                    cardStyle: {
                      opacity: progress,
                      transform: [
                        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) },
                        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                      ],
                    },
                  }),
                  transitionSpec: {
                    open: { animation: 'spring', config: { damping: 18, stiffness: 200, mass: 0.8 } },
                    close: { animation: 'timing', config: { duration: 200, easing: Easing.in(Easing.poly(4)) } },
                  },
                }} />
                <Stack.Screen name="RateEffort" component={RateEffortScreen} />
                <Stack.Screen name="SaveActivity" component={SaveActivityScreen} />
                <Stack.Screen name="Search" component={SearchScreen} />

                {/* Settings & Details */}
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Achievements" component={AchievementsScreen} />
                <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                <Stack.Screen name="SettingsDetail" component={SettingsDetailScreen} />
                <Stack.Screen name="Referral" component={ReferralScreen} />
                <Stack.Screen name="Rewards" component={RewardsScreen} options={{ animationEnabled: false }} />
                <Stack.Screen name="MyRedemptions" component={MyRedemptionsScreen} />
                <Stack.Screen name="Plan" component={PlanScreen} options={{ animationEnabled: false }} />
                <Stack.Screen name="Paywall" component={PaywallScreen} options={{
                  headerShown: false,
                  gestureEnabled: true,
                  gestureDirection: 'vertical',
                  cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
                  transitionSpec: {
                    open: { animation: 'spring', config: { damping: 20, stiffness: 180, mass: 0.8 } },
                    close: { animation: 'timing', config: { duration: 220, easing: Easing.in(Easing.poly(4)) } },
                  },
                }} />
                <Stack.Screen name="PrivacyControls" component={PrivacyControlsScreen} />
                <Stack.Screen name="Gear" component={GearScreen} />
                <Stack.Screen name="ConnectedDevices" component={ConnectedDevicesScreen} />

                {/* Community Sub-Screens */}
                <Stack.Screen name="UserProfile" component={UserProfileScreen} />
                <Stack.Screen name="ChatScreen" component={ChatScreen} />
                <Stack.Screen name="TipDetail" component={TipDetailScreen} />
                <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
                <Stack.Screen name="CreateClub" component={CreateClubScreen} options={{
                  gestureEnabled: true,
                  gestureDirection: 'vertical',
                  cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
                  transitionSpec: {
                    open: { animation: 'spring', config: { damping: 20, stiffness: 180, mass: 0.8 } },
                    close: { animation: 'timing', config: { duration: 220, easing: Easing.in(Easing.poly(4)) } },
                  },
                }} />
                <Stack.Screen name="ClubDetail" component={ClubDetailScreen} />
                <Stack.Screen name="AICoach" component={AICoachScreen} />
                <Stack.Screen name="UserList" component={UserListScreen} />
                <Stack.Screen name="Analytics" component={AnalyticsScreen} />
                <Stack.Screen name="FindFriends" component={FindFriendsScreen} options={{
                  headerShown: false,
                  gestureEnabled: true,
                  gestureDirection: 'vertical',
                  cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
                  transitionSpec: {
                    open: { animation: 'spring', config: { damping: 20, stiffness: 180, mass: 0.8 } },
                    close: { animation: 'timing', config: { duration: 220, easing: Easing.in(Easing.poly(4)) } },
                  },
                }} />
              </>
            )}
          </>
        ) : (
          // ---------------------------------------------------------
          // SCENARIO B: GUEST / NOT LOGGED IN
          // ---------------------------------------------------------
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

            {/* Allow Guests to access Onboarding via "Start Journey" */}
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="OnboardingSignUp" component={OnboardingSignUpScreen} />
          </>
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
};

//Wrapper to access Context and handle Lifecycle
const AppContent = () => {
  const { user, userData, scheduleSmartReminders, isLocked } = useUser();
  const { scheduleReminder, checkInactivity } = useNotifications();
  const appState = useRef(AppState.currentState);

  // Refs to access latest state in listener without re-binding
  const userDataRef = useRef(userData);
  const userRef = useRef(user);
  const scheduleSmartRemindersRef = useRef(scheduleSmartReminders);
  const scheduleReminderRef = useRef(scheduleReminder);

  // Update refs on render
  useEffect(() => {
    userDataRef.current = userData;
    userRef.current = user;
    scheduleSmartRemindersRef.current = scheduleSmartReminders;
    scheduleReminderRef.current = scheduleReminder;
  }, [userData, user, scheduleSmartReminders, scheduleReminder]);

  // 1. Check Inactivity ONLY when last run date changes
  useEffect(() => {
    if (user && userData?.runHistory?.[0]) {
      checkInactivity(userData.runHistory[0].date);
    }
  }, [user?.uid, userData?.runHistory?.[0]?.date]); // Specific dependency to avoid loops

  // 2. Listen for State Changes (Run ONCE)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // When going to background, schedule the next reminder
      if (nextAppState === 'background' && userRef.current) {
        const payload = await scheduleSmartRemindersRef.current();
        if (payload) {
          await scheduleReminderRef.current(payload);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []); // Empty dependency array = Stable listener

  if (isLocked) {
    return <LockScreen />;
  }

  return <RootNavigator />;
};

// --- SECURITY ---
let JailMonkey = null;
try {
  JailMonkey = require('jail-monkey').default;
} catch (e) {
  console.warn('JailMonkey not available:', e.message);
}

import { SecurityContext } from './src/context/SecurityContext';
export { SecurityContext }; // re-export for backward compatibility




function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [isCompromised, setIsCompromised] = useState(false);
  const securityContextValue = useMemo(() => ({ isCompromised }), [isCompromised]);

  useEffect(() => {
    async function prepare() {
      try {
        // 1. Check for Jailbreak/Root
        try {
          if (JailMonkey && JailMonkey.isJailBroken()) {
            console.warn("🚨 WARNING: Compromised device detected (Jailbreak/Root)");
            setIsCompromised(true);
          }
        } catch (jailErr) {
          // JailMonkey not available on emulator — ignore
        }

        // 2. Load Fonts
        await Font.loadAsync({
          Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold,
          Poppins_700Bold, Poppins_800ExtraBold, Poppins_900Black,
        });
      } catch (e) {
        console.warn('Error during app boot:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // Show placeholder while fonts/security load
  if (!appIsReady) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={require('./assets/images/Ruvo Logo Original.png')} style={{ width: 160, height: 50, marginBottom: 40 }} resizeMode="contain" />
        <ActivityIndicator size="large" color="#CCFF00" />
      </View>
    );
  }

  return (
    <SecurityContext.Provider value={securityContextValue}>
      <ThemeProvider>
        <NotificationProvider>
          <UserProvider>
            <AppContent />
          </UserProvider>
        </NotificationProvider>
      </ThemeProvider>
    </SecurityContext.Provider>
  );
}


export default Sentry.wrap(App);

// Branded loading screen styles
const ls = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringWrapper: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  ringOuter: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#CCFF00',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  ringInner: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(204,255,0,0.35)',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  centerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CCFF00',
  },
  phrase: {
    color: '#888',
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  tagline: {
    position: 'absolute',
    bottom: 60,
    color: '#2A2A2A',
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 3,
  },
});

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  placeholderScreen: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#FFFFFF', fontFamily: 'Poppins_700Bold' },
  tabBarContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 35,
    height: 75,
    boxShadow: "0 10px 10px rgba(0, 0, 0, 0.5)",
  },
  tabItemsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  tabLabel: { fontFamily: 'Poppins_500Medium', fontSize: 10, marginTop: 4 },
});
