import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";

const extra =
  (Constants.expoConfig?.extra?.firebaseConfig && Constants.expoConfig.extra) ||
  (Constants.manifest?.extra?.firebaseConfig && Constants.manifest.extra);

const firebaseConfig = extra?.firebaseConfig;

if (!firebaseConfig) {
  throw new Error(
    "Missing Firebase config. Make sure app.json/app.config.js has extra.firebaseConfig"
  );
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Failed to set web auth persistence:", error);
});

const db = getFirestore(app);

export { app, auth, db };