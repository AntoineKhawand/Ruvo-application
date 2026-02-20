import {
  Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
  Poppins_800ExtraBold, Poppins_900Black
} from '@expo-google-fonts/poppins';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';

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

// ✅ FIX: Prevent splash screen from auto-hiding — we'll hide it manually
// Wrapped in try/catch because this runs at MODULE LEVEL (before React)
// If it crashes here, the entire app is a permanent black screen
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.warn('SplashScreen.preventAutoHideAsync failed:', e);
}

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

const RootNavigator = () => {
  const { user, userData, isLoading } = useUser();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#CCFF00" />
        <Text style={{ color: '#666', marginTop: 20, fontFamily: 'Poppins_500Medium' }}>Loading Ruvo...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
        {user ? (
          <>
            {!userData?.onboardingCompleted ? (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            ) : (
              <>
                <Stack.Screen name="Home" component={HomeScreen} options={{ animationEnabled: false }} />
                <Stack.Screen name="Community" component={CommunityScreen} options={{ animationEnabled: false }} />
                <Stack.Screen name="Profile" component={ProfileScreen} options={{ animationEnabled: false }} />
                <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ gestureEnabled: true }} />
                <Stack.Screen name="ActiveRun" component={ActiveRunScreen} />
                <Stack.Screen name="RateEffort" component={RateEffortScreen} />
                <Stack.Screen name="SaveActivity" component={SaveActivityScreen} />
                <Stack.Screen name="Search" component={SearchScreen} />
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
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="OnboardingSignUp" component={OnboardingSignUpScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const AppContent = () => {
  const { user, userData, scheduleSmartReminders } = useUser();
  const { scheduleReminder, checkInactivity } = useNotifications();
  const appState = useRef(AppState.currentState);
  const userDataRef = useRef(userData);
  const userRef = useRef(user);
  const scheduleSmartRemindersRef = useRef(scheduleSmartReminders);
  const scheduleReminderRef = useRef(scheduleReminder);

  useEffect(() => {
    userDataRef.current = userData;
    userRef.current = user;
    scheduleSmartRemindersRef.current = scheduleSmartReminders;
    scheduleReminderRef.current = scheduleReminder;
  }, [userData, user, scheduleSmartReminders, scheduleReminder]);

  useEffect(() => {
    if (user && userData?.runHistory?.[0]) {
      checkInactivity(userData.runHistory[0].date);
    }
  }, [user?.uid, userData?.runHistory?.[0]?.date]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' && userRef.current) {
        const payload = await scheduleSmartRemindersRef.current();
        if (payload) {
          await scheduleReminderRef.current(payload);
        }
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  return <RootNavigator />;
};

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    let didFinish = false;

    // 🛡️ MASTER TIMEOUT: App MUST render within 5 seconds no matter what
    const masterTimeout = setTimeout(() => {
      if (!didFinish) {
        console.warn('⚠️ MASTER TIMEOUT: Force-rendering app after 5s');
        didFinish = true;
        try { SplashScreen.hideAsync(); } catch (e) { /* ignore */ }
        setAppIsReady(true);
      }
    }, 5000);

    async function prepare() {
      try {
        console.log('🚀 App: Loading fonts...');
        await Font.loadAsync({
          Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold,
          Poppins_700Bold, Poppins_800ExtraBold, Poppins_900Black,
        });
        console.log('✅ App: Fonts loaded');
      } catch (e) {
        console.warn('Error loading fonts:', e);
      } finally {
        if (!didFinish) {
          didFinish = true;
          clearTimeout(masterTimeout);
          console.log('🚀 App: Hiding splash screen...');
          try { await SplashScreen.hideAsync(); } catch (e) { console.warn('SplashScreen.hideAsync failed:', e); }
          console.log('✅ App: Splash screen hidden');
          setAppIsReady(true);
        }
      }
    }
    prepare();

    return () => clearTimeout(masterTimeout);
  }, []);

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
});