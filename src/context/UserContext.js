import * as AuthSession from 'expo-auth-session';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { useNotifications } from './NotificationContext';

// --- FIREBASE IMPORTS ---
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../config/firebase';
import { recalculatePlanAfterBreak } from '../services/aiCoach'; // <--- Added missing import
import { checkNewBadges } from '../services/badgeService'; // <--- Import Badge Service
import { checkChallengeCompletion, fetchActiveChallenges } from '../services/challengeService';
import { sendPushNotification } from '../services/notificationService';
import { processReferralReward, validateReferralCode } from '../services/referralService';
import { checkSubscriptionStatus, deleteRevenueCatCustomer, initRevenueCat, purchasePackage, restorePurchases } from '../services/revenueCat'; // <--- Import RevenueCat
import { requestHealthPermissions, fetchTodayStats } from '../services/healthService';
import { whoopService } from '../services/whoopService';
import { ouraService } from '../services/ouraService';
import { sanitizeInput } from '../utils/sanitize';
import { getPendingRuns, isRetryableError, removePendingRun, savePendingRun } from '../utils/pendingRuns';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

// --- SYSTEM CONSTANTS ---
export const SYSTEM_BADGES = {
  NEWCOMER: { name: 'Newcomer', icon: 'star', desc: 'Joined the app' },
  CLUB_5K: { name: '5K Club', icon: 'medal', desc: 'Ran 5km in one go' },
  CLUB_10K: { name: '10K Finisher', icon: 'trophy', desc: 'Ran 10km in one go' },
  CLUB_20K: { name: '20k Club', icon: 'ribbon', desc: 'Ran 20km in a week' },
  NIGHT_OWL: { name: 'Night Owl', icon: 'moon', desc: 'Ran after 8 PM' },
  EARLY_BIRD: { name: 'Early Bird', icon: 'sunny', desc: 'Ran before 7 AM' },
  STREAK_7: { name: '7 Day Streak', icon: 'flame', desc: 'Ran 7 days in a row' },
};

export const SYSTEM_GEAR = {
  DEFAULT: { id: 'g1', name: 'Default Sneakers', limit: 500, isDefault: true },
  NIKE_PEGASUS: { id: 'g2', name: 'Nike Pegasus 40', limit: 800, isDefault: false },
  ADIDAS_ULTRA: { id: 'g3', name: 'Adidas Ultraboost', limit: 800, isDefault: false },
  HOKA_CLIFTON: { id: 'g4', name: 'Hoka Clifton 9', limit: 600, isDefault: false },
  NIKE_ALPHA: { id: 'g5', name: 'Nike Alphafly 3', limit: 400, isDefault: false },
  BROOKS_GHOST: { id: 'g6', name: 'Brooks Ghost 15', limit: 700, isDefault: false },
};


// ✅ REMOVED: INITIAL_BOTS and INITIAL_CLUBS
// Data now fetched from Firestore in real-time


const DEFAULT_USER_DATA = {
  name: 'Runner', email: 'user@ruvo.app',
  onboardingCompleted: false,
  avatar: null, level: 1, currentXP: 150, xpToNextLevel: 1000,
  bio: '',
  city: '',
  weeklyDistance: 0, weeklyGoal: 0, lastWeekReset: new Date().toISOString(),
  calories: 0, bpm: 0, earningUnlockProgress: 0,
  runHistory: [], badges: [SYSTEM_BADGES.NEWCOMER],
  gearList: [{ ...SYSTEM_GEAR.DEFAULT, distance: 0 }],
  following: [],
  followers: [],
  joinedChallenges: ['c1'],
  joinedClubs: [],
  myCreatedClubs: [], // NEW FIELD TO STORE CUSTOM CLUBS
  requests: [], blocked: [], mutedUsers: [], // ✅ Added mutedUsers to schema
  chats: {},
  username: null,
  dob: '1990-01-01', height: 175, weight: 70, gender: 'Male', runFrequency: 3, goal: 'health', experience: 'beginner',
  location: { city: 'Unknown', country: 'Earth', address: 'Locating...' },
  runningPreferences: {
    preferredTime: 'morning',
    favoriteDistance: '5k',
    weeklyGoal: 0
  },
  tipViews: {},
  notificationTime: new Date().toISOString(),
  privacySettings: {
    profileVisibility: 'public',
    showActivityOnFeed: true,
    showLocationOnMap: true,
    showStatsToOthers: true,
    whoCanFollow: 'everyone',
    whoCanComment: 'everyone',
    whoCanSeeClubs: 'everyone'
  },
  isPro: false,
  wallet: { coins: 0 },
  referralCode: null, // Will be generated on signup
  referralStats: { totalInvites: 0, coinsEarned: 0 },
  coins: 0 // Deprecated, use wallet.coins but kept for backward compatibility if used elsewhere
};


// --- GOOGLE SIGN IN CONFIG ---
try {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '385760905493-be6m37hdo6rhh86v1tb8id0o73imjc71.apps.googleusercontent.com',
    offlineAccess: true,
  });
  console.log('✅ GoogleSignin configured');
} catch (e) {
  console.warn('Google Sign-In configure failed:', e.message);
}


export const UserProvider = ({ children }) => {
  const { addNotification, checkRunReminders, sendClubReminder } = useNotifications();

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(DEFAULT_USER_DATA);
  const [clubs, setClubs] = useState([]); // Will be populated from Firestore
  const [clubFeeds, setClubFeeds] = useState({});
  const [postComments, setPostComments] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeRunData, setActiveRunData] = useState(null); // For tracking active run session

  // --- HEALTH SDK STATES ---
  const [healthData, setHealthData] = useState({ steps: 0, restingHR: null });
  const [whoopData, setWhoopData] = useState(null);
  const [ouraData, setOuraData] = useState(null);

  // ✅ ADD THIS: Reference to hold our real-time database listener
  const unsubUserDataRef = useRef(null);

  // --- SESSION LOCK STATE ---
  const [isLocked, setIsLocked] = useState(false);
  const backgroundTimeRef = useRef(null);

  const unlockApp = () => setIsLocked(false);

  // --- 🔒 SESSION TIMEOUT LISTENER (30 MIN) & REVENUCAT LISTENER ---
  useEffect(() => {
    if (!user) return;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background') {
        backgroundTimeRef.current = Date.now();
      } else if (nextAppState === 'active') {
        // Session Timeout Logic
        if (backgroundTimeRef.current) {
          const elapsed = Date.now() - backgroundTimeRef.current;
          if (elapsed > 1800000) { // 30 mins = 1.8M ms
            setIsLocked(true);
          }
        }
        backgroundTimeRef.current = null;

        // RevenueCat Entitlements Refresh
        console.log('🔄 App foregrounded - Refreshing RevenueCat entitlements...');
        try {
          const isPro = await checkSubscriptionStatus();
          setUserData(prev => ({ ...prev, isPro }));
          console.log(`✅ Pro Status: ${isPro}`);
        } catch (error) {
          console.error('❌ Failed to refresh RevenueCat status:', error);
          setUserData(prev => ({ ...prev, isPro: false }));
        }
      }
    });

    return () => subscription.remove();
  }, [user]);

  // --- 1. FIREBASE AUTH LISTENER ---
  useEffect(() => {
    console.log("🔥 UserContext: Initializing...");

    let isMounted = true;
    let authResolved = false;

    // Safety timeout: if auth never resolves (e.g., SecureStore hanging), force guest mode
    const authTimeout = setTimeout(() => {
      if (!authResolved && isMounted) {
        console.warn("⚠️ Auth timeout reached (10s) — defaulting to guest mode");
        setIsLoading(false);
      }
    }, 10000);

    // On iOS, Firebase auth tokens persist in the Keychain and survive app reinstalls.
    // Force sign-out on a genuinely fresh install so new users always see WelcomeScreen.
    const INSTALL_KEY = '@ruvo_install_marker';
    const ensureFreshInstallSignedOut = async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const marker = await AsyncStorage.getItem(INSTALL_KEY);
        if (!marker) {
          await signOut(auth).catch(() => {});
          await AsyncStorage.setItem(INSTALL_KEY, '1');
          console.log('🆕 Fresh install detected — cleared any persisted auth session');
        }
      } catch (e) {
        console.warn('Install marker check failed:', e.message);
      }
    };
    ensureFreshInstallSignedOut();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      authResolved = true;
      clearTimeout(authTimeout);
      console.log("🔥 Auth State:", currentUser ? "Logged In" : "Guest");

      try {
        if (currentUser) {
          setUser(currentUser);

          // ✅ Start real-time listener and save the unsubscribe function
          unsubUserDataRef.current = subscribeToUserData(currentUser.uid, currentUser.email);

          // RevenueCat (with timeout, non-blocking)
          try {
            await Promise.race([
              (async () => {
                await initRevenueCat(currentUser.uid);
                const isPro = await checkSubscriptionStatus();
                setUserData(prev => ({ ...prev, isPro }));
              })(),
              new Promise((_, reject) => setTimeout(() => reject(new Error("RC Timeout")), 3000))
            ]);
          } catch (rcError) {
            console.warn("⚠️ RevenueCat Skipped:", rcError.message);
            setUserData(prev => ({ ...prev, isPro: false }));
            // Fail silently in background without bothering the user
          }

          // Retry any runs that were saved offline
          retryPendingRuns().catch(() => {});
        } else {
          // User logged out — stop the real-time listener before clearing state
          if (unsubUserDataRef.current) {
            unsubUserDataRef.current();
            unsubUserDataRef.current = null;
          }
          setUser(null);
          setUserData(DEFAULT_USER_DATA);
          setClubs([]);
          setIsLoading(false); // <--- Stop loading for guest users
        }
      } catch (error) {
        console.error("Auth Error:", error);
        setIsLoading(false); // <--- Stop loading if Auth throws an error
      }
      // Removed 'finally' block: If currentUser exists, we keep isLoading=true 
      // until 'subscribeToUserData' finishes fetching the profile.
    });

    return () => {
      isMounted = false;
      clearTimeout(authTimeout);
      unsubscribe();
    };
  }, []);

  // ==========================================
  // AUDIT LOGGING
  // ==========================================
  const logSensitiveAction = async (actionType, details = {}) => {
    if (!user?.uid) return;
    try {
      const auditRef = collection(db, "users", user.uid, "auditLog");
      await addDoc(auditRef, {
        action: actionType,
        timestamp: serverTimestamp(),
        device: Platform.OS,
        details: details,
      });
      console.log(`🔒 Audit Log: ${actionType}`);
    } catch (e) {
      console.error("Failed to write audit log:", e);
    }
  };

  // --- ACCOUNT DELETION ---
  const deleteAccount = async () => {
    try {
      setIsLoading(true);

      // 1. Log the deletion intention first (before ref is gone)
      await logSensitiveAction("ACCOUNT_DELETION");

      // 2. Call secure deletion proxy
      const deleteAccountData = httpsCallable(functions, 'deleteAccountData');
      await deleteAccountData();

      // 3. Unlink devices from active RevenueCat customer
      await deleteRevenueCatCustomer();

      // 4. Clear local states just like a logout
      setUserData(null);
      setUser(null);

    } catch (e) {
      console.error("Failed to delete account:", e);
      Alert.alert("Deletion Failed", "Please check your network connection and try again.");
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // --- 8. PUSH NOTIFICATIONS (Moved Up) ---
  const registerForPushNotificationsAsync = async () => {
    let token;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Ruvo Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#CCFF00',
        sound: 'default',
      });
    }

    if (true) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return null;

      try {
        // Simplified: Just try to get token without project ID first (often works in dev)
        // or hardcode it if needed, but for now let's just avoid the crashy import
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } catch (e) {
        console.error("Error getting push token:", e);
        return null;
      }
    }
    return token;
  };

  // --- 2. REAL-TIME DATA FETCHING ---
  const subscribeToUserData = (uid, userEmail) => {
    // 1. Point to the user's document
    const docRef = doc(db, "users", uid);

    // 2. Attach the listener (returns a function to cancel it later)
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() || {};
        let updates = {};

        // --- OPTIMISTIC UPDATES (Calculate in memory) ---
        const fakeBots = ['bot1', 'bot2', 'bot3', 'bot4', 'bot5', 'bot6'];
        if ((data.following || []).some(id => fakeBots.includes(id)) || (data.followers || []).some(id => fakeBots.includes(id))) {
          data.following = (data.following || []).filter(id => !fakeBots.includes(id));
          data.followers = (data.followers || []).filter(id => !fakeBots.includes(id));
          updates.following = data.following;
          updates.followers = data.followers;
        }

        if (!data.referralCode) {
          const firstName = (data.name || 'RUNNER').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          data.referralCode = `${firstName}${randomSuffix}`;
          updates.referralCode = data.referralCode;
        }

        // Clean up broken local URIs from previous avatar saves
        if (data.avatar && (data.avatar.startsWith('file://') || data.avatar.startsWith('content://'))) {
          data.avatar = null;
          updates.avatar = null;
        }

        // ✅ SET STATE: This triggers a UI re-render instantly whenever DB changes!
        setUserData({ ...DEFAULT_USER_DATA, ...data, uid });
        setIsLoading(false); // Stop loading screen on first successful fetch

        // --- BACKGROUND MAINTENANCE ---
        if (Object.keys(updates).length > 0) {
          updateDoc(docRef, updates).catch(e => console.log("Background maintenance error:", e));
        }

        // Keep clubs in sync
        fetchClubsFromFirestore(data.joinedClubs || [], uid).catch(err => {
          console.log("Clubs fetch error:", err.message);
        });

      } else {
        // Document doesn't exist yet. This can happen during the brief window between
        // Firebase Auth creating the user and signUp()'s setDoc() completing.
        // Do NOT reset userData or stop loading here — the signUp() finally block and
        // the next onSnapshot (fired after setDoc completes) will handle state resolution.
        console.warn("⚠️ User document not found — waiting for Firestore write to complete.");
      }
    }, (error) => {
      console.error("❌ Error listening to user data:", error);
      setIsLoading(false);
    });

    return unsubscribe;
  };

// --- 8. PUSH NOTIFICATIONS ---



  // ✅ CLUB DATA FETCHING ENABLED

  const fetchClubsFromFirestore = async (joinedClubIds = [], currentUserId) => {
    try {

      // Create query dynamically
      const clubsRef = collection(db, "clubs");
      const q = query(clubsRef, limit(50));
      const querySnapshot = await getDocs(q);
      
      // If no clubs found, seedDefaults
      if (querySnapshot.empty) {
        console.log("No clubs found. Seeding defaults...");
        const { seedClubs } = await import('../services/clubService');
        await seedClubs();
        // Re-fetch after seeding
        const reQuery = await getDocs(q);
        if (reQuery.empty) {
          setClubs([]);
          return;
        }
        // Map the re-fetched data
        const validClubIds = new Set();
        const clubsData = reQuery.docs.map(doc => {
          const data = doc.data();
          validClubIds.add(doc.id);
          const requests = data.pendingRequests || [];
          const targetId = currentUserId || user?.uid;

          return {
            ...data,
            id: doc.id,
            joined: joinedClubIds.includes(doc.id),
            requestSent: targetId ? requests.includes(targetId) : false
          };
        });
        setClubs(clubsData);
        return;
      }
      
      const validClubIds = new Set();
      const clubsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        validClubIds.add(doc.id);
        const requests = data.pendingRequests || [];
        // Use passed ID or fallback to current user state (though likely stale if just logging in)
        const targetId = currentUserId || user?.uid;

        return {
          ...data,
          id: doc.id,
          joined: joinedClubIds.includes(doc.id),
          requestSent: targetId ? requests.includes(targetId) : false
        };
      });

      setClubs(clubsData);

      // --- SELF-HEAL: Remove invalid club IDs from user profile ---
      const validJoinedClubs = joinedClubIds.filter(id => validClubIds.has(id));
      if (validJoinedClubs.length !== joinedClubIds.length) {
        console.log("Found invalid club IDs, cleaning up...", joinedClubIds, "->", validJoinedClubs);
        setUserData(prev => ({ ...prev, joinedClubs: validJoinedClubs }));

        // Update Firestore
        if (currentUserId || user?.uid) {
          const userRef = doc(db, "users", currentUserId || user.uid);
          updateDoc(userRef, { joinedClubs: validJoinedClubs }).catch(e => console.error("Auto-cleanup error", e));
        }
      }

    } catch (e) {
      console.error("Error fetching clubs from Firestore:", e);
      setClubs([]);
    }
  };



  // --- AUTH FUNCTIONS ---
  const signUp = async (email, password, name, referralCodeInput, profileOverrides = {}) => {
    // Do NOT call setIsLoading(true) before createUserWithEmailAndPassword.
    // If it fails (email-already-in-use, weak password, etc.) and setIsLoading(true)
    // was already set, the NavigationContainer unmounts and remounts at the initial
    // screen, navigating the user away from OnboardingSignUpScreen.
    // setIsLoading(true) is only called after Firebase successfully creates the account.
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Account created — now safe to show loading while we write the Firestore profile.
      // This prevents the race where onAuthStateChanged fires before the doc exists.
      setIsLoading(true);

      // GENERATE UNIQUE REFERRAL CODE (Format: NAME1234)
      const firstName = (name || 'RUNNER').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 1000-9999
      const newReferralCode = `${firstName}${randomSuffix}`;

      let referredBy = null;

      // PROCESS REFERRAL IF CODE PROVIDED
      if (referralCodeInput) {
        const referrer = await validateReferralCode(referralCodeInput);
        if (referrer) {
          referredBy = referrer.uid;
          // Give coins to referrer
          await processReferralReward(referrer.uid, userCredential.user.uid, referralCodeInput);
        }
      }

      const newProfile = {
        ...DEFAULT_USER_DATA,
        ...profileOverrides,
        uid: userCredential.user.uid,
        name: name,
        nameLowercase: name ? name.toLowerCase() : '',
        email: email,
        joinedAt: new Date().toISOString(),
        referralCode: newReferralCode,
        referredBy: referredBy
      };

      // ✅ FIX MEDIUM-02: Add { merge: true } for safety
      // ✅ FIX CRITICAL-02: Ensure this completes BEFORE onAuthStateChanged processes
      await setDoc(doc(db, "users", userCredential.user.uid), newProfile, { merge: true });

      // Update local state immediately after Firestore write succeeds
      setUserData(newProfile);
      setUser(userCredential.user);

      console.log("✅ Signup complete - Profile created in Firestore");
      return { success: true };
    } catch (error) {
      console.error("Signup Error:", error);
      // Return the error to allow screens to display inline messages
      return { success: false, error };
    } finally {
      // ✅ FIX CRITICAL-02: Loading state is only released AFTER Firestore write completes
      // This prevents the race condition where onAuthStateChanged fires before profile exists
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Success: onAuthStateChanged + subscribeToUserData will call setIsLoading(false)
      return true;
    } catch (error) {
      // Reset loading immediately — onAuthStateChanged won't fire on a failed attempt
      setIsLoading(false);
      return false;
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // signIn() will throw if the user cancels in older SDKs (<= 15).
      // In v16+, it successfully resolves with { type: 'cancelled' } instead of throwing!
      let signInResult;
      try {
        signInResult = await GoogleSignin.signIn();
      } catch (signInError) {
        if (signInError.code === 'SIGN_IN_CANCELLED' || signInError.code === '12501') {
          setIsLoading(false); // Must reset — onAuthStateChanged won't fire for a cancel
          return { success: false, error: { code: 'SIGN_IN_CANCELLED' } };
        }
        throw signInError;
      }

      // v16+ cancellation and no-credential cases
      if (signInResult?.type === 'cancelled') {
        setIsLoading(false);
        return { success: false, error: { code: 'SIGN_IN_CANCELLED' } };
      }
      if (signInResult?.type === 'noSavedCredentialFound') {
        setIsLoading(false);
        throw new Error('No Saved Credential. Please tap Sign In again.');
      }

      // If we reach here, signIn() succeeded, so the user IS signed in.
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens?.idToken || signInResult?.data?.idToken || signInResult?.idToken;

      if (!idToken) {
        console.error('Missing ID Token. Tokens response:', JSON.stringify(tokens));
        throw new Error('No ID token returned from Google Sign-In');
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, googleCredential);
      return { success: true, user: result.user };
    } catch (error) {
      setIsLoading(false);
      console.error('❌ Google Sign-In Error:', error);
      if (error.code !== 'SIGN_IN_CANCELLED' && error.code !== '12501') {
        Alert.alert('Google Sign-In Failed', `Error: ${error.message || 'Network or configuration issue'}`);
      }
      return { success: false, error };
    }
  };

  const loginWithFacebook = async () => {
    try {
      const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '1107758504810502';
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'ruvoapplication' });
      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=email,public_profile`;

      console.log('🎉 Starting Facebook OAuth Session with redirect:', redirectUri);

      // Using WebBrowser.openAuthSessionAsync which is the underlying reliable method for AuthSession.startAsync
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        // Parse the access token from the redirect URL hash
        const responseUrl = result.url;
        const accessToken = responseUrl.match(/access_token=([^&]+)/)?.[1];

        if (accessToken) {
          const facebookCredential = FacebookAuthProvider.credential(accessToken);
          const fbResult = await signInWithCredential(auth, facebookCredential);
          return { success: true, user: fbResult.user };
        }
      }
      return { success: false };
    } catch (error) {
      console.error('❌ Facebook Login Error:', error);
      Alert.alert('Facebook Login Failed', error.message || 'An unexpected error occurred.');
      return { success: false, error };
    }
  };

  const logout = async () => {
    try {
      // ✅ Stop listening to the database BEFORE logging out
      if (unsubUserDataRef.current) {
        unsubUserDataRef.current();
        unsubUserDataRef.current = null;
      }
      await signOut(auth);
      setUserData(DEFAULT_USER_DATA);
      setClubs([]);
    }
    catch (e) { console.error("Logout Error", e); }
  };

  const updateUserProfile = async (updates) => {
    // Inject nameLowercase if name is being updated
    if (updates.name) {
      updates.nameLowercase = updates.name.toLowerCase();
    }

    // Handle username change atomically via a Firestore transaction
    if ('username' in updates) {
      const newUsername = updates.username?.toLowerCase().trim() || null;
      updates.username = newUsername;

      if (newUsername && newUsername !== userData.username) {
        const usernameRef = doc(db, "usernames", newUsername);
        const existing = await getDoc(usernameRef);
        if (existing.exists() && existing.data().uid !== user.uid) {
          throw new Error('USERNAME_TAKEN');
        }
        // Release old username slot
        if (userData.username) {
          await deleteDoc(doc(db, "usernames", userData.username));
        }
        await setDoc(usernameRef, { uid: user.uid });
      } else if (!newUsername && userData.username) {
        await deleteDoc(doc(db, "usernames", userData.username));
      }
    }

    // 1. Optimistic Update
    setUserData(prev => {
      const safePrev = prev || DEFAULT_USER_DATA;
      return { ...safePrev, ...updates };
    });

    if (user) {
      const userRef = doc(db, "users", user.uid);
      try {
        await updateDoc(userRef, updates);

        // 2. Propagate changes to posts (if name or avatar ACTUALLY changed)
        const nameChanged = updates.name && updates.name !== userData.name;
        const avatarChanged = updates.avatar !== undefined && updates.avatar !== userData.avatar;

        if (nameChanged || avatarChanged) {
          // We do this asynchronously to not block the UI
          // Check if we need to update posts
          // Note: In a production app, this should be done via Cloud Functions
          const postsRef = collection(db, "posts");
          const q = query(postsRef, where("userId", "==", user.uid));

          const querySnapshot = await getDocs(q);

          // Batch writes (limit 500 per batch)
          const batch = writeBatch(db);
          let count = 0;

          querySnapshot.forEach((doc) => {
            const postRef = doc.ref;
            const postUpdates = {};
            // Only update fields that actually changed
            if (nameChanged) postUpdates.user = updates.name; // 'user' field in posts stores the name
            if (avatarChanged) postUpdates.avatar = updates.avatar;

            batch.update(postRef, postUpdates);
            count++;
          });

          if (count > 0) {
            await batch.commit();
            console.log(`Updated ${count} posts with new profile info`);
          }
        }

        // 3. Update Reminders if preferences OR notification settings changed
        if (updates.runningPreferences || updates.notificationSettings) {

          // Debug Log
          console.log("🔄 Syncing Notifications:", {
            prefs: updates.runningPreferences || userData.runningPreferences,
            settings: updates.notificationSettings || userData.notificationSettings
          });

          const safePrefs = updates.runningPreferences || userData.runningPreferences;
          const safeSettings = updates.notificationSettings || userData.notificationSettings || {};

          // Defaults to TRUE if undefined
          const runRemindersEnabled = safeSettings.workoutReminders !== false;
          const tipsEnabled = safeSettings.tips !== false;

          // Schedule new reminders based on preferred time
          checkRunReminders(safePrefs, runRemindersEnabled);
          scheduleDailyTips(tipsEnabled);
        }

      } catch (e) {
        console.error("Sync Error", e);
      }
    }
  };

  // --- FEATURE FUNCTIONS ---
  const addGear = (name, limit) => {
    const newShoe = { id: Date.now().toString(), name: name, limit: parseInt(limit) || 800, distance: 0, isDefault: (userData.gearList || []).length === 0 };
    const newGearList = [...(userData.gearList || []), newShoe];
    updateUserProfile({ gearList: newGearList });
  };
  const selectDefaultGear = (shoeId) => {
    const newGearList = (userData.gearList || []).map(shoe => ({ ...shoe, isDefault: shoe.id === shoeId }));
    updateUserProfile({ gearList: newGearList });
  };
  const deleteGear = (shoeId) => {
    const newGearList = (userData.gearList || []).filter(shoe => shoe.id !== shoeId);
    updateUserProfile({ gearList: newGearList });
  };
  const updateGear = (shoeId, updates) => {
    const newGearList = (userData.gearList || []).map(shoe => shoe.id === shoeId ? { ...shoe, ...updates } : shoe);
    updateUserProfile({ gearList: newGearList });
  };

  const sendMessage = async (recipientId, text, image = null) => {
    if (!user || (!text && !image)) return;

    // Generate a consistent chatId by sorting the IDs
    const chatId = [user.uid, recipientId].sort().join('_');

    const messageDoc = {
      text: sanitizeInput(text) || '',
      senderId: user.uid,
      timestamp: new Date().toISOString(),
      serverTime: serverTimestamp(),
      ...(image && { image })
    };

    try {
      // 1. Update/Create Chat Metadata
      const chatRef = doc(db, "chats", chatId);
      await setDoc(chatRef, {
        users: [user.uid, recipientId],
        lastMessage: text || (image ? 'Sent an image' : ''),
        lastUpdated: serverTimestamp()
      }, { merge: true });

      // 2. Add message to the subcollection
      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, messageDoc);

    } catch (e) {
      console.error("Failed to send message:", e);
      Alert.alert("Error", "Failed to send message. Please check your connection.");
    }
  };

  const blockUser = (userId) => {
    const newBlocked = [...(userData.blocked || []), userId];
    updateUserProfile({ blocked: newBlocked });
  };
  const unblockUser = (userId) => {
    const newBlocked = (userData.blocked || []).filter(id => id !== userId);
    updateUserProfile({ blocked: newBlocked });
  };

  // --- MUTE USERS (PHASE 19) ---
  const muteUser = (userId) => {
    const newMuted = [...(userData.mutedUsers || []), userId];
    updateUserProfile({ mutedUsers: newMuted });
  };
  const unmuteUser = (userId) => {
    const newMuted = (userData.mutedUsers || []).filter(id => id !== userId);
    updateUserProfile({ mutedUsers: newMuted });
  };

  // --- PRIVACY SETTINGS ---
  const updatePrivacySettings = async (settings) => {
    const currentSettings = userData.privacySettings || {};
    const updatedSettings = { ...currentSettings, ...settings };
    await updateUserProfile({ privacySettings: updatedSettings });
  };

  const checkPrivacyPermission = (targetUserData, permissionType) => {
    if (!targetUserData || !user) return false;

    // Always allow viewing own content
    if (targetUserData.uid === user.uid) return true;

    const privacy = targetUserData.privacySettings || {};
    const isFriend = (targetUserData.followers || []).includes(user.uid);

    switch (permissionType) {
      case 'viewProfile':
        if (privacy.profileVisibility === 'private') return false;
        if (privacy.profileVisibility === 'friends') return isFriend;
        return true; // public

      case 'viewActivity':
        return privacy.showActivityOnFeed !== false;

      case 'viewStats':
        if (privacy.showStatsToOthers === false) return false;
        return true;

      case 'comment':
        if (privacy.whoCanComment === 'nobody') return false;
        if (privacy.whoCanComment === 'friends') return isFriend;
        return true; // everyone

      case 'follow':
        if (privacy.whoCanFollow === 'nobody') return false;
        if (privacy.whoCanFollow === 'friends') return isFriend;
        return true; // everyone

      case 'viewClubs':
        if (privacy.whoCanSeeClubs === 'friends') return isFriend;
        return true; // everyone or not set

      default:
        return true;
    }
  };


  const sendFriendRequest = (id) => { updateUserProfile({ requests: [...(userData.requests || []), id] }); };
  const cancelFriendRequest = (id) => { updateUserProfile({ requests: (userData.requests || []).filter(r => r !== id) }); };

  // --- FOLLOW/UNFOLLOW WITH FIRESTORE BATCH WRITES ---
  const followUser = async (targetUserId) => {
    if (!user?.uid || !targetUserId) return;
    if (user.uid === targetUserId) {
      console.warn("Cannot follow yourself");
      return;
    }

    try {
      // Check if target user is blocked
      if (userData.blocked?.includes(targetUserId)) {
        console.warn("Cannot follow blocked user");
        return;
      }

      // Fetch target user data to check privacy settings
      const targetUserSnap = await getDoc(doc(db, "users", targetUserId));
      if (!targetUserSnap.exists()) {
        console.error("Target user not found");
        return;
      }

      const targetUserData = targetUserSnap.data();

      // Check if we're blocked by target user
      if (targetUserData.blocked?.includes(user.uid)) {
        console.warn("You are blocked by this user");
        return;
      }

      // Privacy system deferred to v1.1 — all follows permitted for launch


      const batch = writeBatch(db);

      // Update current user's following array
      batch.update(doc(db, "users", user.uid), {
        following: arrayUnion(targetUserId)
      });

      // Update target user's followers array
      batch.update(doc(db, "users", targetUserId), {
        followers: arrayUnion(user.uid)
      });

      await batch.commit();
      console.log(`✅ Followed user: ${targetUserId}`);

      // --- PUSH NOTIFICATION ---
      // Check if target user allows follower notifications (Default: TRUE)
      const notifyFollows = targetUserData.notificationSettings?.newFollowers !== false;

      if (targetUserData.pushToken && notifyFollows) {
        sendPushNotification(
          targetUserData.pushToken,
          "New Follower! 🏃‍♂️",
          `${userData.name} started following you.`,
          { type: 'profile', userId: user.uid }
        );
      }

      // Update local state
      setUserData(prev => ({
        ...prev,
        following: [...(prev.following || []), targetUserId]
      }));
    } catch (error) {
      console.error("Error following user:", error);
    }
  };

  const unfollowUser = async (targetUserId) => {
    if (!user?.uid || !targetUserId) return;

    try {
      const batch = writeBatch(db);

      // Remove from current user's following array
      batch.update(doc(db, "users", user.uid), {
        following: arrayRemove(targetUserId)
      });

      // Remove from target user's followers array
      batch.update(doc(db, "users", targetUserId), {
        followers: arrayRemove(user.uid)
      });

      await batch.commit();
      console.log(`✅ Unfollowed user: ${targetUserId}`);

      // Update local state
      setUserData(prev => ({
        ...prev,
        following: (prev.following || []).filter(id => id !== targetUserId)
      }));
    } catch (error) {
      console.error("Error unfollowing user:", error);
    }
  };

  // ✅ UPDATED: Toggle Club Membership (Handles Public Join / Private Request)
  const toggleClubMembership = async (clubId) => {
    try {
      const clubRef = doc(db, "clubs", clubId);
      const clubSnap = await getDoc(clubRef);

      // 1. Check if club exists (Handle Ghost Clubs)
      if (!clubSnap.exists()) {
        console.log(`Club ${clubId} does not exist. Removing from profile.`);
        setClubs(prev => prev.filter(c => c.id !== clubId));
        const cleanedJoined = (userData.joinedClubs || []).filter(id => id !== clubId);
        setUserData(prev => ({ ...prev, joinedClubs: cleanedJoined }));
        updateUserProfile({ joinedClubs: cleanedJoined });
        Alert.alert("Club Removed", "This club no longer exists.");
        return;
      }

      const clubData = clubSnap.data();
      const isJoined = userData.joinedClubs?.includes(clubId);
      const isPrivate = clubData.type === 'private';
      const pendingRequests = clubData.pendingRequests || [];
      const hasPendingRequest = pendingRequests.includes(user.uid);

      if (isJoined) {
        // LEAVE CLUB (Same for Public & Private)
        setClubs(prevClubs => prevClubs.map(club =>
          club.id === clubId ? { ...club, joined: false, members: (club.members || []).filter(m => m !== user.uid) } : club
        ));

        await updateDoc(clubRef, {
          members: arrayRemove(user.uid),
          memberCount: increment(-1)
        });

        const updatedJoined = userData.joinedClubs.filter(id => id !== clubId);
        setUserData(prev => ({ ...prev, joinedClubs: updatedJoined }));
        updateUserProfile({ joinedClubs: updatedJoined });
        Alert.alert("Left Club", `You have left ${clubData.name}.`);

      } else if (hasPendingRequest) {
        // CANCEL REQUEST
        setClubs(prevClubs => prevClubs.map(club =>
          club.id === clubId ? { ...club, requestSent: false } : club
        ));

        await updateDoc(clubRef, {
          pendingRequests: arrayRemove(user.uid)
        });
        Alert.alert("Request Cancelled", "Your join request has been cancelled.");

      } else {
        // JOIN / REQUEST
        if (isPrivate) {
          // SEND REQUEST
          setClubs(prevClubs => prevClubs.map(club =>
            club.id === clubId ? { ...club, requestSent: true } : club
          ));

          await updateDoc(clubRef, {
            pendingRequests: arrayUnion(user.uid)
          });
          Alert.alert("Request Sent", "This is a private club. Your request has been sent to the admin.");

        } else {
          // JOIN INSTANTLY (Public)
          setClubs(prevClubs => prevClubs.map(club =>
            club.id === clubId ? { ...club, joined: true, members: [...(club.members || []), user.uid] } : club
          ));

          await updateDoc(clubRef, {
            members: arrayUnion(user.uid),
            memberCount: increment(1)
          });

          const updatedJoined = [...(userData.joinedClubs || []), clubId];
          setUserData(prev => ({ ...prev, joinedClubs: updatedJoined }));
          updateUserProfile({ joinedClubs: updatedJoined });
        }
      }

    } catch (error) {
      console.error("Error toggling club membership:", error);
      Alert.alert("Error", "Could not update club membership.");
    }
  };

  // ✅ UPDATED: Add New Club (Saves to Firestore clubs collection)
  const addNewClub = async (newClub) => {
    try {
      // 1. Save club to Firestore clubs collection
      const clubData = {
        ...newClub,
        name: sanitizeInput(newClub.name),
        createdBy: user?.uid || 'unknown',
        admins: [user?.uid],        // Required by Firestore rules
        createdAt: serverTimestamp(),
        memberCount: 1,
        members: [user?.uid],
        pendingRequests: []
      };

      const docRef = await addDoc(collection(db, "clubs"), clubData);

      // 2. Update local state
      const newClubWithId = { ...clubData, id: docRef.id, joined: true };
      setClubs(prev => [...prev, newClubWithId]);

      // 3. Update User Profile
      const updatedJoined = [...(userData.joinedClubs || []), docRef.id];
      setUserData(prev => ({ ...prev, joinedClubs: updatedJoined }));
      updateUserProfile({ joinedClubs: updatedJoined });

    } catch (error) {
      console.error("Error creating club:", error);
      Alert.alert("Error", "Could not create club.");
    }
  };

  // ✅ NEW: Accept Club Request
  const acceptClubRequest = async (clubId, userId) => {
    try {
      const clubRef = doc(db, "clubs", clubId);

      await updateDoc(clubRef, {
        members: arrayUnion(userId),
        memberCount: increment(1),
        pendingRequests: arrayRemove(userId)
      });

      // Also update the user's joinedClubs
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        joinedClubs: arrayUnion(clubId)
      });

      // Update local state if we are tracking this club
      setClubs(prev => prev.map(c => {
        if (c.id === clubId) {
          const newPending = (c.pendingRequests || []).filter(id => id !== userId);
          return { ...c, pendingRequests: newPending, memberCount: (c.memberCount || 0) + 1 };
        }
        return c;
      }));

      Alert.alert("Success", "User accepted.");

    } catch (error) {
      console.error("Error accepting request:", error);
      Alert.alert("Error", "Could not accept request.");
    }
  };

  // ✅ NEW: Decline Club Request
  const declineClubRequest = async (clubId, userId) => {
    try {
      const clubRef = doc(db, "clubs", clubId);

      await updateDoc(clubRef, {
        pendingRequests: arrayRemove(userId)
      });

      // Update local state
      setClubs(prev => prev.map(c => {
        if (c.id === clubId) {
          const newPending = (c.pendingRequests || []).filter(id => id !== userId);
          return { ...c, pendingRequests: newPending };
        }
        return c;
      }));

      Alert.alert("Success", "User declined.");

    } catch (error) {
      console.error("Error declining request:", error);
      Alert.alert("Error", "Could not decline request.");
    }
  };





  // ✅ NEW: Toggle Like (Transactional)
  const toggleLike = async (postId) => {
    if (!user) return;
    const postRef = doc(db, 'posts', postId);

    try {
      const result = await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) {
          throw "Post does not exist!";
        }

        const data = postDoc.data();
        const likedBy = data.likedBy || [];
        const isLiked = likedBy.includes(user.uid);

        if (isLiked) {
          // Unlike
          transaction.update(postRef, {
            likes: increment(-1),
            likedBy: arrayRemove(user.uid)
          });
          return { status: 'unliked', authorId: data.userId };
        } else {
          // Like
          transaction.update(postRef, {
            likes: increment(1),
            likedBy: arrayUnion(user.uid)
          });
          return { status: 'liked', authorId: data.userId };
        }
      });

      // --- PUSH NOTIFICATION ---
      if (result.status === 'liked' && result.authorId !== user.uid) {
        const authorSnap = await getDoc(doc(db, "users", result.authorId));
        if (authorSnap.exists()) {
          const authorData = authorSnap.data();

          // Check Settings (Default: TRUE)
          const notifyActivity = authorData.notificationSettings?.communityActivity !== false;

          if (authorData.pushToken && notifyActivity) {
            sendPushNotification(
              authorData.pushToken,
              "New Cheer! 👏",
              `${userData.name} cheered for your run!`,
              { type: 'post', postId: postId }
            );
          }
        }
      }

      return true;
    } catch (e) {
      console.error("Like transaction failed: ", e);
      return false;
    }
  };

  // ✅ NEW: Add Real Comment (Subcollection)
  const addPostComment = async (postId, text) => {
    if (!user || !text.trim()) return;

    try {
      // 1. Add comment to subcollection
      const commentsRef = collection(db, 'posts', postId, 'comments');
      await addDoc(commentsRef, {
        userId: user.uid,
        user: userData.name,
        avatar: userData.avatar,
        text: sanitizeInput(text),
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString() // Fallback
      });

      // 2. Increment comment count on parent post
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        comments: increment(1)
      });

      // --- PUSH NOTIFICATION ---
      // We need to fetch the post to know the author
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        const postData = postSnap.data();
        if (postData.userId !== user.uid) {
          const authorSnap = await getDoc(doc(db, "users", postData.userId));
          if (authorSnap.exists()) {
            const authorData = authorSnap.data();

            // Check Settings (Default: TRUE)
            const notifyActivity = authorData.notificationSettings?.communityActivity !== false;

            if (authorData.pushToken && notifyActivity) {
              sendPushNotification(
                authorData.pushToken,
                "New Comment 💬",
                `${userData.name} commented: "${text.trim()}"`,
                { type: 'post', postId: postId }
              );
            }
          }
        }
      }

      return true;
    } catch (e) {
      console.error("Error adding comment: ", e);
      return false;
    }
  };

  // 1. Add Post to Club Feed (Firestore)
  const addClubPost = async (clubId, postData) => {
    if (!user?.uid || !clubId) return;

    try {
      await addDoc(collection(db, "clubs", clubId, "posts"), {
        userId: user.uid,
        userName: userData.name || 'Unknown',
        userAvatar: userData.avatar,
        role: postData.role || 'Member',
        text: sanitizeInput(postData.text) || '',
        image: postData.image || null,
        achievement: postData.achievement || null,
        event: postData.event || null,
        likes: 0,
        likedBy: [],
        createdAt: serverTimestamp()
      });
      console.log(`✅ Club post added to ${clubId}`);

      // Notify only if the user has club updates enabled
      if (userData.notificationSettings?.clubUpdates !== false) {
        const clubName = postData.clubName || clubs?.find(c => c.id === clubId)?.name || 'your club';
        sendClubReminder(clubName, `${userData.name || 'Someone'} shared a new post`);
      }
    } catch (error) {
      console.error("Error adding club post:", error);
    }
  };

  // 2. Toggle Like on Club Post (Firestore)
  const toggleClubPostLike = async (clubId, postId) => {
    if (!user?.uid || !clubId || !postId) return;

    try {
      const postRef = doc(db, "clubs", clubId, "posts", postId);
      const postSnap = await getDoc(postRef);

      if (postSnap.exists()) {
        const isLiked = postSnap.data().likedBy?.includes(user.uid);

        await updateDoc(postRef, {
          likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
          likes: increment(isLiked ? -1 : 1)
        });

        console.log(`✅ ${isLiked ? 'Unliked' : 'Liked'} club post: ${postId}`);
      }
    } catch (error) {
      console.error("Error toggling club post like:", error);
    }
  };

  // Placeholders
  const addTemporaryUsers = () => { };
  // ✅ IMPLEMENTED: Update Club Details
  const updateClub = async (clubId, updates) => {
    if (!user?.uid) return;
    try {
      const clubRef = doc(db, "clubs", clubId);

      // Clean up the text if they are changing the name or description
      if (updates.name) updates.name = sanitizeInput(updates.name);
      if (updates.description) updates.description = sanitizeInput(updates.description);

      await updateDoc(clubRef, updates);

      // Update local state instantly so the UI feels snappy
      setClubs(prev => prev.map(c => c.id === clubId ? { ...c, ...updates } : c));
      Alert.alert("Success", "Club updated successfully.");
    } catch (error) {
      console.error("Error updating club:", error);
      Alert.alert("Error", "Could not update club details.");
    }
  };

  // ✅ IMPLEMENTED: Delete a Club
  const deleteClub = async (clubId) => {
    if (!user?.uid) return;
    try {
      // 1. Delete the club from Firestore
      await deleteDoc(doc(db, "clubs", clubId));

      // 2. Remove it from the local state list of clubs
      setClubs(prev => prev.filter(c => c.id !== clubId));

      // 3. Remove it from the user's joinedClubs array
      const updatedJoined = (userData.joinedClubs || []).filter(id => id !== clubId);
      setUserData(prev => ({ ...prev, joinedClubs: updatedJoined }));
      await updateUserProfile({ joinedClubs: updatedJoined });

      Alert.alert("Deleted", "The club has been successfully deleted.");
    } catch (error) {
      console.error("Error deleting club:", error);
      Alert.alert("Error", "Could not delete the club.");
    }
  };

  // ✅ IMPLEMENTED: Add Comment to a Club Post
  const addClubComment = async (clubId, postId, text) => {
    if (!user?.uid || !text.trim()) return false;
    try {
      // 1. Add comment to the specific club post's subcollection
      const commentsRef = collection(db, "clubs", clubId, "posts", postId, "comments");
      await addDoc(commentsRef, {
        userId: user.uid,
        userName: userData.name || 'Unknown',
        userAvatar: userData.avatar,
        text: sanitizeInput(text),
        createdAt: serverTimestamp()
      });

      // 2. Increment comment count on the parent post
      const postRef = doc(db, "clubs", clubId, "posts", postId);
      await updateDoc(postRef, {
        comments: increment(1)
      });

      return true;
    } catch (error) {
      console.error("Error adding club comment:", error);
      return false;
    }
  };
  // ✅ Save Route (For Discovery Mode)
  const saveRoute = async (routeData) => {
    if (!user?.uid) return;
    try {
      await addDoc(collection(db, "users", user.uid, "saved_routes"), {
        ...routeData,
        savedAt: serverTimestamp()
      });
      Alert.alert("Route Saved", "You can view this in your profile.");
    } catch (e) {
      console.error("Error saving route:", e);
      Alert.alert("Error", "Could not save route.");
    }
  };

  const detectLocation = async () => "Beirut, Lebanon";

  // ✅ Add Post to Main Feed (Firestore posts collection)
  const addPost = async (postData) => {
    if (!user?.uid) return null;

    try {
      const safePostData = { ...postData };
      if (safePostData.title) safePostData.title = sanitizeInput(safePostData.title);
      if (safePostData.description) safePostData.description = sanitizeInput(safePostData.description);
      if (safePostData.text) safePostData.text = sanitizeInput(safePostData.text);
      if (safePostData.desc) safePostData.desc = sanitizeInput(safePostData.desc);

      const newPost = {
        userName: userData?.name || 'Unknown',
        userAvatar: userData?.avatar || '',
        ...safePostData,
        userId: user.uid, // Always use auth UID — must come after spread to prevent overwrite
        likes: 0,
        comments: 0,
        likedBy: [],
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString() // Fallback for sorting
      };

      const docRef = await addDoc(collection(db, "posts"), newPost);
      console.log(`✅ Post created with ID: ${docRef.id}`);

      return { ...newPost, id: docRef.id };
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Could not create post. Please try again.");
      return null;
    }
  };

  // Retry runs saved offline (called on login/auth restore)
  const retryPendingRuns = async () => {
    const pending = await getPendingRuns();
    if (!pending.length) return;
    console.log(`[PendingRuns] Retrying ${pending.length} queued run(s)...`);
    const saveRunActivity = httpsCallable(functions, 'saveRunActivity');
    for (const item of pending) {
      try {
        await saveRunActivity({ runEntry: item.runEntry, calculatedUpdates: item.calculatedUpdates });
        await removePendingRun(item.id);
        console.log('[PendingRuns] Synced queued run:', item.id);
      } catch (err) {
        // Stop retrying on this startup if still offline
        if (isRetryableError(err)) break;
        // Non-retryable error (bad data) — remove so it doesn't block forever
        await removePendingRun(item.id);
        console.warn('[PendingRuns] Dropped unretryable run:', item.id, err.message);
      }
    }
  };

  // 3. Add Run to History (with Gamification)
  const addRunToHistory = async (runEntry, calculatedUpdates = {}) => {
    if (!user?.uid) return { newBadges: [], earnedXp: 0, earnedCoins: 0, coinBreakdown: null };

    try {
      // A. Call Secure Cloud Function
      const saveRunActivity = httpsCallable(functions, 'saveRunActivity');
      let result;
      try {
        result = await saveRunActivity({ runEntry, calculatedUpdates });
      } catch (callError) {
        if (isRetryableError(callError)) {
          const queuedId = await savePendingRun(runEntry, calculatedUpdates);
          console.log('[addRunToHistory] Network error — run queued offline:', queuedId);
          return { queued: true, newBadges: [], earnedXp: 0, earnedCoins: 0, coinBreakdown: null };
        }
        throw callError;
      }
      const { earnedXp, earnedCoins, coinBreakdown, levelsGained = 0, newLevel = userData.level } = result.data;

      const distance = runEntry.distance || 0;
      const userRef = doc(db, "users", user.uid);

      // B. Check for Badges
      const history = userData.runHistory || [];
      const currentBadges = userData.badges || [];
      const newBadges = checkNewBadges(runEntry, history, currentBadges);

      if (newBadges.length > 0) {
        // Save new badges
        await updateDoc(userRef, {
          badges: arrayUnion(...newBadges)
        });

        // Update local state immediately
        setUserData(prev => ({
          ...prev,
          badges: [...(prev.badges || []), ...newBadges]
        }));

        // Send Local Notification
        newBadges.forEach(badge => {
          // Badge unlock notification (optional - can be implemented in NotificationContext)
        });
      }

      // Immediately reflect the new run in local state so ProfileScreen updates without
      // waiting for the Firestore onSnapshot round-trip.
      setUserData(prev => ({
        ...prev,
        runHistory: [runEntry, ...(prev.runHistory || [])],
      }));

      // Return the breakdown for UI display
      return { newBadges, earnedXp, earnedCoins, coinBreakdown, levelsGained, newLevel };
    } catch (error) {
      console.error("addRunToHistory error:", error);
      return { newBadges: [], earnedXp: 0, earnedCoins: 0, coinBreakdown: null };
    }
  };

  // --- SMART NOTIFICATION LOGIC ---
  const scheduleSmartReminders = async () => {
    try {
      if (!userData || !userData.preferences?.runReminders) return null;

      const { preferredTime } = userData.preferences;
      const timeMap = { 'morning': 7, 'afternoon': 14, 'evening': 18, 'night': 20 };
      const hour = timeMap[preferredTime] || 18;

      // 1. Check if ran today
      const today = new Date().toDateString();
      const lastRun = userData.runHistory?.[0];
      const lastRunDate = lastRun ? new Date(lastRun.date).toDateString() : null;

      if (lastRunDate === today) {
        console.log("✅ User ran today. Skipping reminder.");
        return null;
      }

      // 2. Get Plan Context
      let message = "Time to conquer your miles! 🏃";
      if (userData.trainingPlan?.activeGoal) {
        message = `Keep up your ${userData.trainingPlan.activeGoal} training! A short run today gets you closer.`;
      }

      // 3. Return Payload
      return {
        title: "Run Reminder 👟",
        body: message,
        hour,
        minute: 0
      };
    } catch (error) {
      console.error("⚠️ Background task error in scheduleSmartReminders:", error);
      // Return null so the AppState listener safely does nothing instead of crashing
      return null;
    }
  };

  // 7. Schedule Smart Run Reminders (Called from UserContext or Home)
  // See NotificationContext for logic

  const scheduleDailyTips = async (isEnabled) => {
    // 1. Cancel existing
    // Note: We'd need to track IDs to cancel specific ones, or just cancel all. 
    // For simplicity in this demo, checkRunReminders cancels ALL. 
    // So if we run this, we might nuke run reminders.
    // Ideally, NotificationContext should expose specific cancel methods.
    // BUT: expo-notifications cancelAll cancels everything.

    if (!isEnabled) {
      console.log("🔕 Daily tips disabled.");
      return;
    }

    // 2. Schedule for 9:00 AM
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Daily Running Tip 💡",
          body: "Consistency is key! Check out today's advice.",
          data: { type: 'tip' }
        },
        trigger: {
          type: 'calendar',
          hour: 9,
          minute: 0,
          repeats: true,
        },
      });
      console.log("🔔 Daily Tip scheduled for 9:00 AM");
    } catch (e) {
      console.log("Error scheduling tip:", e);
    }
  };

  const incrementTipView = async (tipId) => {
    if (!user) return;
    try {
      const currentViews = userData.tipViews || {};
      const newViews = { ...currentViews, [tipId]: (currentViews[tipId] || 0) + 1 };
      await updateDoc(doc(db, "users", user.uid), { tipViews: newViews });
      setUserData(prev => ({ ...prev, tipViews: newViews }));
    } catch (e) {
      // console.log("Tip view inc:", e.message);
    }
  };

  const toggleTipBookmark = async (tipId) => {
    if (!user) return;
    try {
      const isSaved = userData.savedTips?.includes(tipId);

      await updateDoc(doc(db, "users", user.uid), {
        savedTips: isSaved ? arrayRemove(tipId) : arrayUnion(tipId)
      });

      setUserData(prev => ({
        ...prev,
        savedTips: isSaved
          ? (prev.savedTips || []).filter(id => id !== tipId)
          : [...(prev.savedTips || []), tipId]
      }));
    } catch (e) {
      console.error("Error toggling tip bookmark:", e);
    }
  };

  const upgradeToPro = async (pack) => {
    if (!user) return;
    try {
      const success = await purchasePackage(pack);
      if (success) {
        setUserData(prev => ({ ...prev, isPro: true }));
        console.log("✅ Upgraded to Pro via RevenueCat (Local state only)");
        return true;
      }
      // success is false — user cancelled, or purchasePackage already showed an alert
      return false;
    } catch (e) {
      console.error("Error upgrading to Pro:", e);
      throw e; // Don't swallow — let PaywallScreen show the error alert
    }
  };

  const restorePro = async () => {
    try {
      const success = await restorePurchases();
      if (success) {
        // ✅ FIX CRITICAL-04: Do NOT write isPro to Firestore
        // RevenueCat is the single source of truth
        setUserData(prev => ({ ...prev, isPro: true }));
        return true;
      }
    } catch (e) {
      console.error("Restore failed", e);
    }
    return false;
  };

  // --- AI COACHING LOGIC ---
  const generateWeekPlan = (goal, status, weekOffset = 0, availableDays = ['Mon', 'Wed', 'Fri']) => {
    // Ensure we have at least some days, default to MWF if empty
    const days = (availableDays && availableDays.length > 0) ? availableDays : ['Mon', 'Wed', 'Fri'];

    // Helper to get a day from the array (cycling if needed)
    const getDay = (idx) => days[idx % days.length];

    // 1. Handle "Injured" or "Recovery" Status
    if (status === 'Injured' || goal === 'Recovery') {
      return {
        focus: 'Recovery',
        totalDist: '0-5km',
        workouts: [
          { day: getDay(0), title: 'Rest Day', detail: 'Focus on sleep', icon: 'bed', isRest: true },
          { day: getDay(1), title: 'Recovery Walk', detail: '20 min low impact', icon: 'walk', isRest: false },
          { day: getDay(Math.min(2, days.length - 1)), title: 'Mobility Work', detail: '15 min stretching', icon: 'body-outline', isRest: false },
        ]
      };
    }

    // 2. Handle "Vacation" or "Maintenance" Status
    if (status === 'Vacation' || goal === 'Maintenance') {
      return {
        focus: 'Maintenance',
        totalDist: '10-15km',
        workouts: days.slice(0, 2).map((d, i) => ({
          day: d,
          title: i === 0 ? 'Scenic Run' : 'Short Jog',
          detail: i === 0 ? '30 min easy' : '20 min easy',
          icon: i === 0 ? 'image' : 'walk',
          isRest: false
        }))
      };
    }

    // 3. Active Training Logic (Base)
    const phases = ['Base Building', 'Load Increase', 'Peak Week', 'Taper'];
    const phase = phases[weekOffset % 4];
    const volMult = [1, 1.1, 1.2, 0.8][weekOffset % 4];

    let baseDist = 5;
    if (goal === 'Half Marathon') baseDist = 10;
    if (goal === 'Marathon') baseDist = 15;

    // Distribute workouts across available days
    // Priorities: 1. Long Run (Last Day), 2. Speed Work (Mid Week), 3. Easy Runs (Others)
    const workouts = [];

    // A. Long Run (Always on the last available day)
    const longRunDay = days[days.length - 1];
    workouts.push({
      day: longRunDay,
      title: 'Long Run',
      detail: `${Math.round(baseDist * 1.5 * volMult)}km Steady`,
      icon: 'map',
      isRest: false
    });

    // B. Speed Work (If > 1 day, put it in the middle)
    if (days.length > 1) {
      const speedDay = days[Math.floor((days.length - 1) / 2)];
      workouts.push({
        day: speedDay,
        title: 'Speed Work',
        detail: `${Math.round(baseDist * 0.6 * volMult)}km Intervals`,
        icon: 'stopwatch',
        isRest: false
      });
    }

    // C. Fill remaining days with Easy Runs/Recovery
    days.forEach(d => {
      if (d !== longRunDay && (days.length <= 1 || d !== days[Math.floor((days.length - 1) / 2)])) {
        workouts.push({
          day: d,
          title: 'Easy Run',
          detail: `${Math.round(baseDist * 0.8 * volMult)}km Zone 2`,
          icon: 'walk',
          isRest: false
        });
      }
    });

    // Sort workouts by day order for display (Mon -> Sun)
    const dayOrder = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };
    workouts.sort((a, b) => dayOrder[a.day] - dayOrder[b.day]);

    return {
      focus: phase,
      totalDist: `${Math.round(baseDist * days.length * volMult)}km`, // Approx total
      workouts: workouts
    };
  };

  const updateTrainingPlan = async (newStatus, newGoal = null) => {
    if (!user) return;

    const currentPlan = userData.trainingPlan || {};
    const oldStatus = currentPlan.status || 'Active';
    const activeGoal = newGoal || currentPlan.activeGoal || userData.goal || '10k';
    const status = newStatus || oldStatus;
    const currentRunDays = userData.runDays || ['Mon', 'Wed', 'Fri'];

    let trainingPlan = { ...currentPlan };
    let updates = {};

    // A. HANDLING RETURN TO ACTIVE (From Injury/Vacation)
    if (oldStatus !== 'Active' && status === 'Active') {
      const statusChangedAt = currentPlan.statusChangedAt ? new Date(currentPlan.statusChangedAt) : new Date();
      const now = new Date();
      const daysOff = Math.floor((now - statusChangedAt) / (1000 * 60 * 60 * 24)) || 1;

      console.log(`User returning from ${oldStatus}. Days off: ${daysOff}`);

      // 1. REGENERATE A FRESH ACTIVE PLAN (Standard Schedule)
      const freshWeeks = [];
      for (let i = 0; i < 4; i++) {
        freshWeeks.push({
          weekNum: i + 1,
          ...generateWeekPlan(activeGoal, 'Active', i, currentRunDays)
        });
      }

      const freshPlan = {
        generatedAt: new Date().toISOString(),
        weeks: freshWeeks,
        activeGoal: activeGoal,
        status: 'Active'
      };

      // 2. APPLY RECOVERY LOGIC TO FRESH PLAN
      trainingPlan = recalculatePlanAfterBreak(daysOff, oldStatus, activeGoal, freshPlan);

      updates = {
        trainingPlan: {
          ...trainingPlan,
          status: 'Active',
          activeGoal: activeGoal,
          generatedAt: new Date().toISOString()
        },
        goal: activeGoal
      };

      Alert.alert("Welcome Back!", `We've flagged you as away for ${daysOff} days and adjusted your plan.`);

    }
    // B. HANDLING SWITCH TO INJURY/VACATION
    else if (status !== 'Active') {
      // Regenerate schedule to reflect Recovery/Maintenance focus
      const weeks = [];
      for (let i = 0; i < 4; i++) {
        weeks.push({
          weekNum: i + 1,
          ...generateWeekPlan(activeGoal, status, i, currentRunDays)
        });
      }

      trainingPlan = {
        generatedAt: new Date().toISOString(),
        activeGoal: activeGoal,
        status: status,
        statusChangedAt: new Date().toISOString(),
        weeks
      };

      updates = {
        trainingPlan,
        goal: status === 'Injured' ? 'Recovery' : 'Maintenance'
      };
    }
    // C. STANDARD UPDATE (New Goal or Initial Setup)
    else {
      const weeks = [];
      for (let i = 0; i < 4; i++) {
        weeks.push({
          weekNum: i + 1,
          ...generateWeekPlan(activeGoal, status, i, currentRunDays)
        });
      }

      trainingPlan = {
        generatedAt: new Date().toISOString(),
        activeGoal: activeGoal,
        status: 'Active',
        weeks
      };

      updates = {
        trainingPlan,
        goal: activeGoal
      };
    }

    try {
      await updateUserProfile(updates);
      return trainingPlan;
    } catch (e) {
      console.error("Error updating training plan:", e);
      Alert.alert("Error", "Failed to update your plan. Please try again.");
      return null;
    }
  };

  // --- HEALTH & DEVICE INTEGRATIONS ---
  const refreshHealthData = async () => {
    try {
      const hasPermissions = await requestHealthPermissions();
      if (!hasPermissions) {
        setHealthData({ steps: 0, restingHR: null });
        return;
      }
      
      const stats = await fetchTodayStats();
      if (stats) {
        setHealthData({ steps: stats.steps, restingHR: stats.restingHR });
      }
    } catch (e) {
      console.error("Health refresh error:", e);
    }
  };

  const connectWhoop = async () => {
    const success = await whoopService.authenticate();
    return success;
  };

  const connectOura = async () => {
    const success = await ouraService.authenticate();
    return success;
  };

  const contextValue = useMemo(() => ({
    user, userData, setUserData, isLoading, signUp, login, loginWithGoogle, loginWithFacebook, logout, deleteAccount, updateUserProfile,
    clubs, postComments, clubFeeds, activeRunData, setActiveRunData,
    healthData, whoopData, ouraData, refreshHealthData, connectWhoop, connectOura,
    isLocked, unlockApp,

    toggleLike, addPostComment, addPost, saveRoute, detectLocation, addRunToHistory,
    registerForPushNotificationsAsync, incrementTipView, toggleTipBookmark,
    upgradeToPro, restorePro, blockUser, unblockUser, muteUser, unmuteUser,
    refreshUser: () => console.log("Data is real-time now, manual refresh not needed!"),
    updateTrainingPlan, logSensitiveAction,

    // ✅ Real implementations (Added the "ghost" features here)
    addGear, selectDefaultGear, deleteGear, updateGear,
    sendMessage, addNewClub, addClubPost,
    followUser, unfollowUser,
    toggleClubMembership, toggleClubPostLike,
    acceptClubRequest, declineClubRequest,
    scheduleSmartReminders,
    sendFriendRequest,        // Fixed!
    cancelFriendRequest,      // Fixed!
    updatePrivacySettings,    // Fixed!
    checkPrivacyPermission,   // Fixed!
    addClubComment,           // Fixed!
    updateClub,               // Fixed!
    deleteClub,               // Fixed!

    // Genuinely disabled/unimplemented features
    addTemporaryUsers: () => { },
  }), [
    user, userData, isLoading, clubs, postComments, clubFeeds, activeRunData, isLocked,
    healthData, whoopData, ouraData
  ]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};
