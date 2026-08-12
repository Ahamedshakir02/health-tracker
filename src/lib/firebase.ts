import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/** Blank, whitespace or a literal "undefined" all mean "not set". */
function read(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed !== 'undefined' ? trimmed : undefined;
}

const config = {
  apiKey: read(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: read(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: read(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: read(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: read(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: read(import.meta.env.VITE_FIREBASE_APP_ID),
};

/**
 * `authDomain` is required as well as the three identity keys — without it the
 * SDK initialises happily and then fails at sign-in with an opaque
 * `auth/internal-error`, which is a miserable thing to debug.
 */
const REQUIRED = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;

/** Which required `.env` values are still blank — surfaced on the login screen. */
export const missingFirebaseKeys: string[] = REQUIRED.filter((k) => !config[k]).map(
  (k) => `VITE_FIREBASE_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`,
);

/** True when .env has been filled in with a real Firebase web app config. */
export const firebaseConfigured = missingFirebaseKeys.length === 0;

/**
 * Addresses permitted to sign in. This is a convenience gate that produces a
 * clear error in the UI — it is NOT the security boundary, because anything in
 * the bundle can be edited by whoever is holding the browser. The real
 * enforcement is the matching allowlist in `firestore.rules`, which Firebase
 * applies server-side on every read and write.
 */
export const ALLOWED_EMAILS: readonly string[] = (
  read(import.meta.env.VITE_ALLOWED_EMAIL) ?? 'ahamedshakir02@gmail.com'
)
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!firebaseConfigured) {
    throw new Error(
      `Firebase is not configured. Copy .env.example to .env and set: ${missingFirebaseKeys.join(', ')}`,
    );
  }
  if (!app) app = initializeApp(config as Required<typeof config>);
  return app;
}

export function auth(): Auth {
  if (!authInstance) authInstance = getAuth(ensureApp());
  return authInstance;
}

export function db(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(ensureApp());
  return dbInstance;
}
