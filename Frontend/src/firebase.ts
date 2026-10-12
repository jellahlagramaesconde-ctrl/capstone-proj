import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";

// Read Firebase configurations from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "your-api-key" &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (err) {
    console.warn("Failed to initialize Firebase Auth:", err);
  }
}

export { app, auth };

/**
 * Initializes an invisible RecaptchaVerifier on the specified container DOM element ID
 */
export function initRecaptchaVerifier(containerId: string): RecaptchaVerifier | null {
  if (!auth) return null;
  try {
    // Clear any previous container state
    const existing = (window as any).recaptchaVerifier;
    if (existing) {
      try { existing.clear(); } catch (_) {}
    }

    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved
      },
      "expired-callback": () => {
        console.warn("reCAPTCHA expired, please request code again.");
      },
    });

    (window as any).recaptchaVerifier = verifier;
    return verifier;
  } catch (err) {
    console.error("Error creating RecaptchaVerifier:", err);
    return null;
  }
}

/**
 * Sends SMS verification code via Firebase Phone Auth
 */
export async function sendFirebaseSmsOtp(
  phoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  if (!auth) {
    throw new Error("Firebase Auth is not configured. Please set VITE_FIREBASE_* in Frontend/.env");
  }
  return await signInWithPhoneNumber(auth, phoneNumber, verifier);
}
