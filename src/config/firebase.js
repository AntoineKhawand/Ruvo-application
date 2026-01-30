// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// YOUR SPECIFIC KEYS (I copied them from your message)
const firebaseConfig = {
  apiKey: "AIzaSyDKAvnU3DwhQbGI8ay1mscdU0tVl51QTIQ",
  authDomain: "ruvo-app-99c85.firebaseapp.com",
  projectId: "ruvo-app-99c85",
  storageBucket: "ruvo-app-99c85.firebasestorage.app",
  messagingSenderId: "385760905493",
  appId: "1:385760905493:web:c82c94735f4abde3afc11c"
};

// 1. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. Initialize Auth with Persistence (This keeps the user logged in!)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// 3. Initialize Database
const db = getFirestore(app);

export { auth, db };
