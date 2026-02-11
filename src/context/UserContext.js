import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useNotifications } from './NotificationContext';

// --- FIREBASE IMPORTS ---
// GoogleSignin disabled for Expo Go compatibility
// import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { recalculatePlanAfterBreak } from '../services/aiCoach'; // <--- Added missing import
import { checkNewBadges } from '../services/badgeService'; // <--- Import Badge Service
import { sendPushNotification } from '../services/notificationService';
import { processReferralReward, validateReferralCode } from '../services/referralService';

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
  allUsers: [], // Will be populated from Firestore
  following: ['bot1', 'bot2'],
  followers: ['bot3', 'bot4', 'bot5', 'bot6'],
  joinedChallenges: ['c1'],
  joinedClubs: ['c1', 'c2'],
  myCreatedClubs: [], // NEW FIELD TO STORE CUSTOM CLUBS
  requests: [], blocked: [],
  chats: {},
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


// --- GOOGLE SIGN IN CONFIG (Disabled for Expo Go) ---
// Google Sign-In requires native modules not available in Expo Go
/*
try {
  GoogleSignin.configure({
    webClientId: '385760905493-be6m37hdo6rhh86v1tb8id0o73imjc71.apps.googleusercontent.com',
  });
} catch (e) {
  console.log('Google Sign-In not available in Expo Go');
}
*/


export const UserProvider = ({ children }) => {
  const { addNotification, checkRunReminders, sendClubReminder } = useNotifications();

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(DEFAULT_USER_DATA);
  const [clubs, setClubs] = useState([]); // Will be populated from Firestore
  const [clubFeeds, setClubFeeds] = useState({});
  const [postComments, setPostComments] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeRunData, setActiveRunData] = useState(null); // For tracking active run session

  // --- 1. FIREBASE AUTH LISTENER ---
  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {

      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser.uid, currentUser.email);
        await initRevenueCat(currentUser.uid); // <--- Init RevenueCat

        // Sync Pro Status
        const isPro = await checkSubscriptionStatus(); // This helper should also check 'Ruvo Pro'
        if (isPro) {
          setUserData(prev => ({ ...prev, isPro: true }));
        }

      } else {
        setUserData(DEFAULT_USER_DATA);
        setClubs([]); // Empty when logged out
      }

      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // --- 2. FETCH DATA (UPDATED TO LOAD CUSTOM CLUBS) ---
  const fetchUserData = async (uid, userEmail) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() || {};

        // BACKFILL: Generate Referral Code if missing (Format: NAME1234)
        if (!data.referralCode) {
          const firstName = (data.name || 'RUNNER').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const newCode = `${firstName}${randomSuffix}`;

          // Update Firestore immediately
          await setDoc(docRef, { referralCode: newCode }, { merge: true });
          data.referralCode = newCode;
        }

        setUserData({ ...DEFAULT_USER_DATA, ...data });

        // Fetch clubs from Firestore
        fetchClubsFromFirestore(data.joinedClubs || []).catch(err => {
          console.log("Clubs fetch error:", err.message);
          setClubs([]);
        });

      } else {
        setUserData(DEFAULT_USER_DATA);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  // --- 8. PUSH NOTIFICATIONS ---
  const registerForPushNotificationsAsync = async () => {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        // alert('Failed to get push token for push notification!');
        return null;
      }

      // Get the token
      // We don't need to specify projectId explicitly if EAS/app.json is configured correctly,
      // but passing undefined usually defaults to the project config
      try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

      } catch (e) {
        console.error("Error getting push token:", e);
        return null;
      }
    } else {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    return token;
  };




  // ⚠️ TEMPORARILY DISABLED: fetchClubsFromFirestore function
  // Re-enable after creating Firestore 'clubs' collection

  const fetchClubsFromFirestore = async (joinedClubIds = []) => {
    try {
      const clubsRef = collection(db, "clubs");
      const clubsQuery = query(clubsRef, limit(50));

      const querySnapshot = await getDocs(clubsQuery);
      const clubsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        joined: joinedClubIds.includes(doc.id)
      }));

      setClubs(clubsData);
    } catch (e) {
      console.error("Error fetching clubs from Firestore:", e);
      setClubs([]);
    }
  };



  // --- AUTH FUNCTIONS ---
  const signUp = async (email, password, name, referralCodeInput) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

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
        uid: userCredential.user.uid,
        name: name,
        email: email,
        joinedAt: new Date().toISOString(),
        referralCode: newReferralCode,
        referredBy: referredBy
      };

      await setDoc(doc(db, "users", userCredential.user.uid), newProfile);
      setUserData(newProfile);
      setUser(userCredential.user);
    } catch (error) {
      console.error(error);
      Alert.alert("Signup Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try { await signInWithEmailAndPassword(auth, email, password); return true; }
    catch (error) { alert("Login Error: " + error.message); return false; }
  };

  const loginWithGoogle = async () => {
    // Google Sign-In not available in Expo Go
    alert('Google Sign-In requires a development build.\n\nPlease use Email/Password login instead.');
    return { success: false };
  };

  const logout = async () => {
    try { await signOut(auth); setUserData(DEFAULT_USER_DATA); }
    catch (e) { console.error("Logout Error", e); }
  };

  const updateUserProfile = async (updates) => {
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

  const sendMessage = (recipientId, text, image = null) => {
    const newMessage = { id: Date.now().toString(), text: text, senderId: 'currentUser', timestamp: new Date().toISOString(), image: image };
    setUserData(prev => {
      const safePrev = prev || DEFAULT_USER_DATA;
      const currentChats = safePrev.chats || {};
      const conversation = currentChats[recipientId] || [];
      const updatedChats = { ...currentChats, [recipientId]: [...conversation, newMessage] };
      if (user) {
        const userRef = doc(db, "users", user.uid);
        updateDoc(userRef, { chats: updatedChats }).catch(e => console.error(e));
      }
      return { ...safePrev, chats: updatedChats };
    });
  };

  const blockUser = (userId) => {
    const newBlocked = [...(userData.blocked || []), userId];
    updateUserProfile({ blocked: newBlocked });
  };
  const unblockUser = (userId) => {
    const newBlocked = (userData.blocked || []).filter(id => id !== userId);
    updateUserProfile({ blocked: newBlocked });
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

      // Check privacy permission
      if (!checkPrivacyPermission(targetUserData, 'follow')) {
        Alert.alert(
          "Cannot Follow",
          "This user's privacy settings don't allow new followers."
        );
        return;
      }

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



  const toggleClubMembership = (clubId) => {
    const updatedClubs = clubs.map(club => {
      if (club.id === clubId) {
        return { ...club, joined: !club.joined };
      }
      return club;
    });
    setClubs(updatedClubs);
    const joinedIds = updatedClubs.filter(c => c.joined).map(c => c.id);
    updateUserProfile({ joinedClubs: joinedIds });
  };

  // ✅ UPDATED: Add New Club (Saves to Firestore clubs collection)
  const addNewClub = async (newClub) => {
    try {
      // 1. Save club to Firestore clubs collection
      const clubData = {
        ...newClub,
        createdBy: user?.uid || 'unknown',
        createdAt: serverTimestamp(),
        memberCount: 1,
        members: [user?.uid]
      };

      await addDoc(collection(db, "clubs"), clubData);

      // 2. Update UI immediately
      setClubs(prev => [{ ...clubData, joined: true }, ...prev]);

      // 3. Update user's joinedClubs
      const updatedJoinedIds = [newClub.id, ...(userData.joinedClubs || [])];
      updateUserProfile({ joinedClubs: updatedJoinedIds });

    } catch (e) {
      console.error("Error creating club:", e);
      alert("Failed to create club. Please try again.");
    }
  };

  // ✅ NEW: Add Post (Saves to Firestore posts collection)
  const addPost = async (postData) => {
    try {
      await addDoc(collection(db, 'posts'), {
        ...postData,
        createdAt: serverTimestamp(),
        timestamp: Date.now(), // Client-side timestamp for immediate sorting if needed
        likes: 0,
        comments: 0
      });

      return true;
    } catch (e) {
      console.error("Error adding post:", e);
      return false; // Return false so caller knows it failed (though we swallow error here)
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
        text: text.trim(),
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
        text: postData.text || '',
        image: postData.image || null,
        achievement: postData.achievement || null,
        event: postData.event || null,
        likes: 0,
        likedBy: [],
        createdAt: serverTimestamp()
      });
      console.log(`✅ Club post added to ${clubId}`);

      // --- SIMULATED NOTIFICATION (Self-Check) ---
      if (userData.notificationSettings?.clubUpdates !== false) {
        sendClubReminder("Run Club", `New post in ${clubId} (Demo)`);
      } else {
        console.log("🔕 Club updates disabled, skipping notification.");
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
  const addClubComment = () => { };
  const updateClub = () => { };
  const deleteClub = () => { };
  const detectLocation = async () => "Beirut, Lebanon";
  // 3. Add Run to History (with Gamification)
  const addRunToHistory = async (runEntry, calculatedUpdates = {}) => {
    if (!user?.uid) return [];

    try {
      // A. Save to Firestore
      const userRef = doc(db, "users", user.uid);

      // Merge calculated updates (coins, gear, totalKm) with our core updates
      const firebaseUpdates = {
        runHistory: arrayUnion(runEntry),
        totalRuns: increment(1),
        weeklyDistance: increment(runEntry.distance || 0),
        currentXP: increment((runEntry.distance || 0) * 10),
        ...calculatedUpdates
      };

      await updateDoc(userRef, firebaseUpdates);

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
          Notifications.scheduleNotificationAsync({
            content: {
              title: "🏆 New Badge Unlocked!",
              body: `You earned: ${badge.name}`,
              data: { type: 'achievement', badgeId: badge.id }
            },
            trigger: null
          });
        });
      }

      // Update local state for the run
      setUserData(prev => ({
        ...prev,
        runHistory: [runEntry, ...(prev.runHistory || [])],
        weeklyDistance: (prev.weeklyDistance || 0) + (runEntry.distance || 0),
        currentXP: (prev.currentXP || 0) + ((runEntry.distance || 0) * 10),
        ...calculatedUpdates // Apply calculated local updates (e.g. gearList array)
      }));

      return newBadges; // Return to screen for UI animation

    } catch (e) {
      console.error("Error saving run:", e);
      return [];
    }
  };

  const scheduleSmartReminders = () => { };

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
      console.error("Error incrementing tip view:", e);
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
      const success = await purchasePackage(pack); // <--- Real Purchase
      if (success) {
        await updateDoc(doc(db, "users", user.uid), { isPro: true });
        setUserData(prev => ({ ...prev, isPro: true }));
        console.log("✅ Upgraded to Pro via RevenueCat");
        return true;
      }
    } catch (e) {
      console.error("Error upgrading to Pro:", e);
      return false;
    }
  };

  const restorePro = async () => {
    try {
      const success = await restorePurchases();
      if (success) {
        await updateDoc(doc(db, "users", user.uid), { isPro: true });
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

  return (
    <UserContext.Provider value={{
      user, userData, setUserData, isLoading, signUp, login, loginWithGoogle, logout, updateUserProfile,
      clubs, postComments, clubFeeds,

      // Actions
      addGear, selectDefaultGear, deleteGear, updateGear,
      sendMessage, blockUser, unblockUser, sendFriendRequest, cancelFriendRequest, followUser, unfollowUser,
      toggleLike, addPostComment, toggleClubMembership, addNewClub, addPost,
      detectLocation, addRunToHistory, scheduleSmartReminders,

      // Privacy
      updatePrivacySettings, checkPrivacyPermission,

      // Restored & Enabled Helpers
      addTemporaryUsers, addClubComment, updateClub, deleteClub,

      // New/Re-exposed
      activeRunData,
      setActiveRunData,
      addClubPost,
      toggleClubPostLike,
      registerForPushNotificationsAsync,
      incrementTipView,
      toggleTipBookmark,

      // Pro
      upgradeToPro, restorePro, // <--- Added restorePro

      // AI Coaching
      updateTrainingPlan
    }}>
      {children}
    </UserContext.Provider>
  );
};
