// src/config/firebase.js
import * as SecureStore from 'expo-secure-store';
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// YOUR SPECIFIC KEYS
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// 1. Initialize Firebase (Singleton Pattern)
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Custom persistence adapter using SecureStore
const secureStoreAdapter = {
  getItem: async (key) => {
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => {
    await SecureStore.deleteItemAsync(key);
  }
};

let auth;
try {
  // Check if auth is already initialized to avoid "Auth already initialized" error
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(secureStoreAdapter)
  });
} catch (e) {
  // If already initialized, just get instance
  auth = getAuth(app);
}

// 3. Initialize Database
const db = getFirestore(app);

// 4. Initialize Storage
const storage = getStorage(app);
const functions = getFunctions(app);

export { auth, db, functions, storage };

