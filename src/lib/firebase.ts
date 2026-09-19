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

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    const apps = getApps();
    app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
  } catch (error) {
    console.error("[partyverse] Firebase init failed:", error);
  }
}

/**
 * `db` is nullable because the app must still render (with a setup notice) when
 * the env vars are missing. Call sites that genuinely need the database go
 * through this so the null check happens once, in one place, with a useful
 * message — instead of being cast away at every `ref(db, ...)` call.
 */
export function getDb(): Database {
  if (!db) throw new Error("Firebase is not configured. Copy .env.example to .env.local and add your project keys.");
  return db;
}

export function getAuthInstance(): Auth {
  if (!auth) throw new Error("Firebase Auth is not configured. Copy .env.example to .env.local and add your project keys.");
  return auth;
}

/** True when the app can actually talk to a room. UI uses this to show a setup notice. */
export function canPlay(): boolean {
  return db !== null && auth !== null;
}

export { app, db, auth };

export function getFirebase() {
  return { app, db, auth };
}
