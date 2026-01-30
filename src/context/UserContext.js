import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNotifications } from './NotificationContext';

// --- FIREBASE IMPORTS ---
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

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

const INITIAL_BOTS = [
    { 
        id: 'bot1', name: 'Alex Johnson', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', flag: '🇫🇷', level: 8, 
        achievements: [SYSTEM_BADGES.CLUB_20K, SYSTEM_BADGES.CLUB_10K, SYSTEM_BADGES.EARLY_BIRD], 
        recentRun: { title: 'Tempo Run', date: 'Yesterday', dist: '12.0 km', time: '52m', pace: '4:20 /km', badge: '20k Club Badge Unlocked!' },
        performance: { today: 0, week: 67.8, month: 210.5, year: 2450.0 }, stats: { runs: 42, pace: '4:15' }, gear: SYSTEM_GEAR.NIKE_ALPHA.name, scope: 'Global'
    },
];

const INITIAL_CLUBS = [
    { id: 'c1', name: 'Morning Runners', members: '45 members', icon: 'run', color: '#B2FF59', joined: true, role: 'member', type: 'public', desc: 'We run at dawn! Join us for daily 6AM runs.' },
    { id: 'c2', name: 'Trail Blazers', members: '28 members', icon: 'pine-tree', color: '#448AFF', joined: true, role: 'admin', type: 'private', desc: 'Off-road adventures every weekend.' },
    { id: 'c3', name: 'Marathon Preppers', members: '112 members', icon: 'speedometer', color: '#FFD700', joined: false, role: 'member', type: 'public', desc: 'Training for the big race? This is your tribe.' },
];

const DEFAULT_USER_DATA = {
    name: 'Runner', email: 'user@ruvo.app', avatar: null, level: 1, currentXP: 150, xpToNextLevel: 1000, 
    weeklyDistance: 0, weeklyGoal: 0, lastWeekReset: new Date().toISOString(),
    calories: 0, bpm: 0, earningUnlockProgress: 0, 
    runHistory: [], badges: [SYSTEM_BADGES.NEWCOMER],
    gearList: [{ ...SYSTEM_GEAR.DEFAULT, distance: 0 }],
    allUsers: INITIAL_BOTS, 
    following: ['bot1', 'bot2'], 
    followers: ['bot3', 'bot4', 'bot5', 'bot6'],
    joinedChallenges: ['c1'],
    joinedClubs: ['c1', 'c2'], 
    myCreatedClubs: [], // NEW FIELD TO STORE CUSTOM CLUBS
    requests: [], blocked: [],
    chats: {},
    dob: '1990-01-01', height: 175, weight: 70, gender: 'Male', runFrequency: 3, goal: 'health', experience: 'beginner', 
    location: { city: 'Unknown', country: 'Earth', address: 'Locating...' },
    tipViews: {},
    notificationTime: new Date().toISOString(),
    privacySettings: { profileVisibility: true, hideMaps: false, dataUsage: true },
    isPro: false,
    coins: 0 
};

export const UserProvider = ({ children }) => {
  const { addNotification } = useNotifications(); 
  
  const [user, setUser] = useState(null); 
  const [userData, setUserData] = useState(DEFAULT_USER_DATA); 
  const [clubs, setClubs] = useState(INITIAL_CLUBS);
  const [clubFeeds, setClubFeeds] = useState({}); 
  const [postComments, setPostComments] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // --- 1. FIREBASE AUTH LISTENER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser.uid, currentUser.email);
      } else {
        setUserData(DEFAULT_USER_DATA);
        setClubs(INITIAL_CLUBS);
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
        setUserData({ ...DEFAULT_USER_DATA, ...data });
        
        // 1. Get Custom Created Clubs
        const customClubs = data.myCreatedClubs || [];
        
        // 2. Merge with Default Clubs
        const allClubs = [...customClubs, ...INITIAL_CLUBS];

        // 3. Mark Joined Status correctly
        const joinedIds = data.joinedClubs || [];
        const processedClubs = allClubs.map(c => ({
            ...c,
            joined: joinedIds.includes(c.id)
        }));

        setClubs(processedClubs);

      } else {
        const recoveryProfile = { ...DEFAULT_USER_DATA, uid: uid, email: userEmail || "recovered@ruvo.app", joinedAt: new Date().toISOString() };
        await setDoc(docRef, recoveryProfile);
        setUserData(recoveryProfile);
      }
    } catch (e) {
      console.error("Error fetching Firestore data", e);
    }
  };

  // --- AUTH FUNCTIONS ---
  const signUp = async (email, password, name) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const newProfile = { ...DEFAULT_USER_DATA, uid: uid, name: name, email: email, joinedAt: new Date().toISOString() };
      await setDoc(doc(db, "users", uid), newProfile);
      setUserData(newProfile);
      return true;
    } catch (error) { alert("Sign Up Error: " + error.message); return false; }
  };

  const login = async (email, password) => {
    try { await signInWithEmailAndPassword(auth, email, password); return true; } 
    catch (error) { alert("Login Error: " + error.message); return false; }
  };

  const logout = async () => {
    try { await signOut(auth); setUserData(DEFAULT_USER_DATA); } 
    catch (e) { console.error("Logout Error", e); }
  };

  const updateUserProfile = async (updates) => {
    setUserData(prev => {
        const safePrev = prev || DEFAULT_USER_DATA;
        return { ...safePrev, ...updates };
    });

    if (user) {
        const userRef = doc(db, "users", user.uid);
        try { await updateDoc(userRef, updates); } catch (e) { console.error("Sync Error", e); }
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

  const sendFriendRequest = (id) => { updateUserProfile({ requests: [...(userData.requests || []), id] }); };
  const cancelFriendRequest = (id) => { updateUserProfile({ requests: (userData.requests || []).filter(r => r !== id) }); };
  
  const unfollowUser = (id) => {
      const newFollowing = (userData.following || []).filter(userId => userId !== id);
      updateUserProfile({ following: newFollowing });
  };

  const addPostComment = (postId, text) => {
      const newComment = { id: Date.now().toString(), user: userData.name, avatar: userData.avatar, text, time: 'Just now' };
      setPostComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), newComment] }));
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

  // --- UPDATED ADD NEW CLUB (SAVES TO FIREBASE NOW) ---
  const addNewClub = (newClub) => {
      // 1. Update UI List immediately
      setClubs(prev => [newClub, ...prev]);

      // 2. Prepare Data to Save
      const updatedCreatedClubs = [newClub, ...(userData.myCreatedClubs || [])];
      const updatedJoinedIds = [newClub.id, ...(userData.joinedClubs || [])];

      // 3. Save to Firebase User Profile
      updateUserProfile({ 
          myCreatedClubs: updatedCreatedClubs,
          joinedClubs: updatedJoinedIds 
      });
  };

  // 1. Add Post to Club Feed
  const addClubPost = (clubId, text, image) => {
      const newPost = {
        id: Date.now().toString(),
        user: userData.name,
        avatar: userData.avatar,
        time: 'Just now',
        content: text,
        image: image,
        likes: 0,
        comments: 0,
        liked: false
      };
      setClubFeeds(prev => ({
        ...prev,
        [clubId]: [newPost, ...(prev[clubId] || [])]
      }));
  };

  // 2. Toggle Like on Club Post
  const toggleClubPostLike = (clubId, postId) => {
      setClubFeeds(prev => {
        const feed = prev[clubId] || [];
        const updatedFeed = feed.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              liked: !post.liked,
              likes: post.liked ? post.likes - 1 : post.likes + 1
            };
          }
          return post;
        });
        return { ...prev, [clubId]: updatedFeed };
      });
  };

  // Placeholders
  const addTemporaryUsers = () => {}; 
  const addClubComment = () => {};
  const updateClub = () => {};
  const deleteClub = () => {};
  const detectLocation = async () => "Beirut, Lebanon";
  const addRunToHistory = () => {};
  const scheduleSmartReminders = () => {};

  return (
    <UserContext.Provider value={{ 
        user, userData, setUserData, isLoading, signUp, login, logout, updateUserProfile,
        clubs, postComments, clubFeeds,
        
        // Actions
        addGear, selectDefaultGear, deleteGear, updateGear,
        sendMessage, blockUser, unblockUser, sendFriendRequest, cancelFriendRequest, unfollowUser,
        addPostComment, toggleClubMembership, addNewClub,
        detectLocation, addRunToHistory, scheduleSmartReminders,

        // Restored & Enabled Helpers
        addTemporaryUsers, addClubPost, addClubComment, toggleClubPostLike, updateClub, deleteClub
    }}>
      {children}
    </UserContext.Provider>
  );
};