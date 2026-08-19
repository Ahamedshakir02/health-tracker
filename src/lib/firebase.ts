import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

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

/**
 * Firestore with an IndexedDB cache behind it.
 *
 * This is the difference between a basement gym working and not. Reads are
 * served from the cache when there is no signal, and writes queue locally and
 * flush on reconnect, so ticking off a session underground is not lost. It
 * also cuts billed reads on the free tier, where the daily quota is the real
 * ceiling once sign-up is open.
 *
 * The multi-tab manager is what keeps two open tabs from fighting over the
 * lease — without it the second tab fails to acquire the cache and falls back
 * to memory, silently losing the offline behaviour in exactly the case where
 * someone has the app open on a laptop and a phone-sized window beside it.
 *
 * `initializeFirestore` rather than `getFirestore`, because the cache can only
 * be chosen at creation. It must therefore be the first Firestore call in the
 * process, which the lazy singleton below guarantees.
 */
export function db(): Firestore {
  if (!dbInstance) {
    const instance = ensureApp();
    try {
      dbInstance = initializeFirestore(instance, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      // No IndexedDB — Safari private browsing, or a locked-down profile.
      // Losing the cache costs offline support; refusing to start would cost
      // the whole app, so fall back to a plain in-memory instance.
      dbInstance = getFirestore(instance);
    }
  }
  return dbInstance;
}
