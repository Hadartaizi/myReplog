// database/firebase.js
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";

// ✅ בודק גם expoConfig וגם manifest
const extra =
  (Constants.expoConfig?.extra?.firebaseConfig && Constants.expoConfig.extra) ||
  (Constants.manifest?.extra?.firebaseConfig && Constants.manifest.extra);

const firebaseConfig = extra?.firebaseConfig;

if (!firebaseConfig) {
  throw new Error(
    "Missing Firebase config. Make sure app.json/app.config.js has extra.firebaseConfig"
  );
}

// אתחול אפליקציית Firebase
const app = initializeApp(firebaseConfig);

// אתחול Auth עם שמירת סשן ב-AsyncStorage
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// אתחול Firestore
export const db = getFirestore(app);

// לוגים לבדיקה (אפשר להסיר אחרי שהכל עובד)
console.log("expoConfig:", Constants.expoConfig);
console.log("manifest:", Constants.manifest);
console.log("extra:", extra);
console.log("firebaseConfig:", firebaseConfig);
