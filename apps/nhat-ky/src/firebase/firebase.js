import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function resolveConfig() {
  const fromWindow = window.__NHAT_KY_FIREBASE__ ?? window.__WEB_USER_FIREBASE__;
  if (fromWindow?.apiKey && fromWindow.projectId) return fromWindow;
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
}

const config = resolveConfig();
if (!config?.apiKey || !config?.projectId) {
  throw new Error(
    "Thiếu cấu hình Firebase. Kiểm tra file /nhat-ky/firebase-config.js trên server."
  );
}

export const app = getApps().length ? getApps()[0] : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
