import {
    Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
    Poppins_800ExtraBold, Poppins_900Black
} from '@expo-google-fonts/poppins';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack'; // Kept your original Stack
import * as Font from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// --- CONTEXTS ---
import { NotificationProvider } from './src/context/NotificationContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { UserProvider } from './src/context/UserContext';

// --- SCREENS ---
import AchievementsScreen from './src/screens/AchievementsScreen';
import ActiveRunScreen from './src/screens/ActiveRunScreen';
import AICoachScreen from './src/screens/AICoachScreen';
import ChatScreen from './src/screens/ChatScreen';
import ClubDetailScreen from './src/screens/ClubDetailScreen';
import CreateClubScreen from './src/screens/CreateClubScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import GearScreen from './src/screens/GearScreen';
import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import OnboardingSignUpScreen from './src/screens/OnboardingSignUpScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import PlanScreen from './src/screens/PlanScreen'; // NEW: Imported Plan Screen
import PrivacyControlsScreen from './src/screens/PrivacyControlsScreen';
import RateEffortScreen from './src/screens/RateEffortScreen';
import ReferralScreen from './src/screens/ReferralScreen';
import RewardsScreen from './src/screens/RewardsScreen';
import SaveActivityScreen from './src/screens/SaveActivityScreen';
import SettingsDetailScreen from './src/screens/SettingsDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import TipDetailScreen from './src/screens/TipDetailScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import WorkoutDetailScreen from './src/screens/WorkoutDetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import ProfileScreen from './src/screens/ProfileScreen';



const Stack = createStackNavigator();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, 
          Poppins_700Bold, Poppins_800ExtraBold, Poppins_900Black,
        });
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
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
          <NavigationContainer>
            <StatusBar style="light" />
            <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false, gestureEnabled: false }}>
              
              {/* --- AUTH & ONBOARDING --- */}
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="SignUp" component={SignUpScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="OnboardingSignUp" component={OnboardingSignUpScreen} />
              
              {/* --- MAIN APP --- */}
              <Stack.Screen name="Home" component={HomeScreen} options={{ animationEnabled: false }} />
              <Stack.Screen name="Community" component={CommunityScreen} options={{ animationEnabled: false }} />
              <Stack.Screen name="Profile" component={ProfileScreen} options={{ animationEnabled: false }} />
              
              {/* --- WORKOUT FLOW --- */}
              <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ gestureEnabled: true }} />
              <Stack.Screen name="ActiveRun" component={ActiveRunScreen} />
              <Stack.Screen name="RateEffort" component={RateEffortScreen} />
              <Stack.Screen name="SaveActivity" component={SaveActivityScreen} />

              {/* --- SETTINGS & PROFILE DETAILS --- */}
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
              
              {/* --- COMMUNITY SCREENS --- */}
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen name="ChatScreen" component={ChatScreen} /> 
              <Stack.Screen name="TipDetail" component={TipDetailScreen} />
              <Stack.Screen name="CreateClub" component={CreateClubScreen} />
              <Stack.Screen name="ClubDetail" component={ClubDetailScreen} />
              <Stack.Screen name="AICoach" component={AICoachScreen} />

            </Stack.Navigator>
          </NavigationContainer>
        </UserProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

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