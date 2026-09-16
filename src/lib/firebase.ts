import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

function isEmptyConfig() {
  return !firebaseConfig.apiKey;
}

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;

// Initialize immediately
if (!isEmptyConfig()) {
  try {
    const apps = getApps();
    app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    console.log("[Firebase] Initialized successfully");
  } catch (error) {
    console.error("[Firebase] Init error:", error);
  }
}

export { app, db, auth, isEmptyConfig };

export function getFirebase() {
  return { app, db, auth };
}

export const isFirebaseConfigured = () => !isEmptyConfig();
