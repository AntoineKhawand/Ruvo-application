import {
  Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
  Poppins_800ExtraBold, Poppins_900Black
} from '@expo-google-fonts/poppins';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Font from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, StyleSheet, Text, View } from 'react-native';

// --- TEMPORARY SEEDER IMPORTS ---

// --- CONTEXTS ---
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { UserProvider, useUser } from './src/context/UserContext';

// --- SCREENS ---
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

const Stack = createStackNavigator();

// ✅ FIX: Create navigation ref to prevent race conditions
export const navigationRef = createNavigationContainerRef();

const RootNavigator = () => {
  // ✅ FIX: Use 'isLoading' to match your Context
  const { user, userData, isLoading } = useUser();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  // ✅ FIX MEDIUM-01: Show branded loading screen while Auth and Data fully resolve
  // This prevents flash of unauthenticated content and provides a smooth transition
  if (isLoading) {
    return (
      <View style={styles.brandedLoadingContainer}>
        <Image
          source={require('./assets/ruvo_logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#CCFF00" style={{ marginTop: 40 }} />
        <Text style={styles.loadingText}>Preparing your gear...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        setIsNavigationReady(true);
        console.log('✅ NavigationContainer is ready');
      }}
    >
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>

        {user ? (
          // ---------------------------------------------------------
          // SCENARIO A: USER IS LOGGED IN
          // ---------------------------------------------------------
          <>
            {/* CHECK: Has the user finished onboarding? 
                If 'userData.onboardingCompleted' is false -> Force Onboarding 
            */}
            {!userData?.onboardingCompleted ? (
              // >>> User is Logged In, but hasn't finished setup
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            ) : (
              // >>> User is Logged In and Ready -> SHOW MAIN APP
              <>
                <Stack.Screen name="Home" component={HomeScreen} options={{ animationEnabled: false }} />

                {/* Main App Screens */}
                <Stack.Screen name="Community" component={CommunityScreen} options={{ animationEnabled: false }} />
                <Stack.Screen name="Profile" component={ProfileScreen} options={{ animationEnabled: false }} />

                {/* Workout Flow */}
                <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ gestureEnabled: true }} />
                <Stack.Screen name="ActiveRun" component={ActiveRunScreen} />
                <Stack.Screen name="RateEffort" component={RateEffortScreen} />
                <Stack.Screen name="SaveActivity" component={SaveActivityScreen} />
                <Stack.Screen name="Search" component={SearchScreen} />

                {/* Settings & Details */}
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Achievements" component={AchievementsScreen} />
                <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                <Stack.Screen name="SettingsDetail" component={SettingsDetailScreen} />
                <Stack.Screen name="Referral" component={ReferralScreen} />
                <Stack.Screen name="Rewards" component={RewardsScreen} options={{ headerShown: false, animationEnabled: false }} />
                <Stack.Screen name="Plan" component={PlanScreen} options={{ headerShown: false, animationEnabled: false }} />
                <Stack.Screen name="Paywall" component={PaywallScreen} options={{ headerShown: false, presentation: 'modal' }} />
                <Stack.Screen name="PrivacyControls" component={PrivacyControlsScreen} />
                <Stack.Screen name="Gear" component={GearScreen} />

                {/* Community Sub-Screens */}
                <Stack.Screen name="UserProfile" component={UserProfileScreen} />
                <Stack.Screen name="ChatScreen" component={ChatScreen} />
                <Stack.Screen name="TipDetail" component={TipDetailScreen} />
                <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
                <Stack.Screen name="CreateClub" component={CreateClubScreen} />
                <Stack.Screen name="ClubDetail" component={ClubDetailScreen} />
                <Stack.Screen name="AICoach" component={AICoachScreen} />
                <Stack.Screen name="UserList" component={UserListScreen} />
                <Stack.Screen name="Analytics" component={AnalyticsScreen} />
                <Stack.Screen name="FindFriends" component={FindFriendsScreen} options={{ presentation: 'modal', headerShown: false }} />
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

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  // ⚡ FIX: Force Splash Screen to hide after 3 seconds max
  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold,
          Poppins_700Bold, Poppins_800ExtraBold, Poppins_900Black,
        });
      } catch (e) {
        console.warn('Error loading fonts:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // Show placeholder while fonts load
  if (!appIsReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#CCFF00" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <NotificationProvider>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  brandedLoadingContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  logoImage: { width: 200, height: 100 },
  loadingText: { color: '#888', marginTop: 20, fontFamily: 'Poppins_500Medium', fontSize: 14 },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
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
