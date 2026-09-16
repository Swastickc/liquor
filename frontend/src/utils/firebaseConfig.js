import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const requiredEnvVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

const missing = requiredEnvVars.filter(
  (v) => !import.meta.env[v],
);

if (missing.length > 0) {
  console.warn(`Firebase config missing: ${missing.join(", ")}. Auth will not work.`);
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

// 🛡️ CRASH FIX: initializeApp/getAuth throw synchronously when keys are
// missing or invalid (e.g. Vercel env vars not set). Previously this threw
// uncaught inside the lazy-loaded GoogleAuth chunk with no Error Boundary
// anywhere in the tree, which unmounted the ENTIRE React app to a blank
// white page on /login and /register. Fail soft instead: export null auth
// and a readiness flag so callers can disable Google Sign-In gracefully.
export let auth = null;
export let googleProvider = null;
export const isFirebaseReady = missing.length === 0;

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} catch (err) {
  console.warn("Firebase initialization failed. Google Sign-In disabled.", err);
  auth = null;
  googleProvider = null;
}
