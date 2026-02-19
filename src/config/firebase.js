// src/config/firebase.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// YOUR SPECIFIC KEYS
const firebaseConfig = {
  apiKey: "AIzaSyDKAvnU3DwhQbGI8ay1mscdU0tVl51QTIQ",
  authDomain: "ruvo-app-99c85.firebaseapp.com",
  projectId: "ruvo-app-99c85",
  storageBucket: "ruvo-app-99c85.firebasestorage.app",
  messagingSenderId: "385760905493",
  appId: "1:385760905493:web:c82c94735f4abde3afc11c"
};

// 1. Initialize Firebase (Singleton Pattern)
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// 2. Initialize Auth with Persistence (Lazy Load if possible)
let auth;
try {
  // Check if auth is already initialized to avoid "Auth already initialized" error
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  // If already initialized, just get instance
  auth = getAuth(app);
}

// 3. Initialize Database
const db = getFirestore(app);

// 4. Initialize Storage
const storage = getStorage(app);

export { auth, db, storage };

