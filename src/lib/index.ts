export { app, db, auth, getFirebase, isFirebaseConfigured, getDb, getAuthInstance, canPlay } from "./firebase";
export {
  cn,
  formatTime,
  generateRoomCode,
  generatePlayerId,
  getAvatarFromName,
  pickAvatar,
  sanitizeNickname,
  normalizeRoomCode,
} from "./utils";

// `Database` lives in `firebase/database` and `Auth` in `firebase/auth`; neither
// is exported from `firebase/app`.
export type { Database } from "firebase/database";
export type { Auth } from "firebase/auth";
export type { FirebaseApp } from "firebase/app";
