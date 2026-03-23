import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

// ✅ Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAZWAcRTnjHZv8vEcT3YT67-uaMu9DlT_Q",
  authDomain: "guardian-140624.firebaseapp.com",
  projectId: "guardian-140624",
  storageBucket: "guardian-140624.firebasestorage.app",
  messagingSenderId: "567680584316",
  appId: "1:567680584316:web:17b95e9ba5bba85f9417f9",
  measurementId: "G-3FBZ554JQB",
};

// 🔥 Initialize Firebase app
const app = initializeApp(firebaseConfig);

// 🔐 Firebase Auth with persistent storage (AsyncStorage)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// 🧠 Firestore DB
const db = getFirestore(app);

export { auth, db };
