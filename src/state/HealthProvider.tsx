import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { ALLOWED_EMAILS, auth, firebaseConfigured, isAllowedEmail } from '../lib/firebase';
import { FirestoreStore, seedFromLocal } from '../lib/firestoreStore';
import { LocalStore, exportJSON, importJSON, normalize, type HealthStore } from '../lib/store';
import { DEFAULT_DATA, type HealthData, type Section, type Settings } from '../types';

export type SyncState = 'loading' | 'ready' | 'saving' | 'error';

interface HealthContextValue {
  data: HealthData;
  sync: SyncState;
  error: string | null;
  storeKind: 'local' | 'firebase';
  storeLabel: string;
  firebaseAvailable: boolean;
  /** Firebase has reported the initial auth state — until then, show a splash. */
  authReady: boolean;
  user: User | null;
  /** Set when a sign-in succeeded but the address is not on the allowlist. */
  accessDenied: string | null;
  /** Chosen explicitly when Firebase is unconfigured: run on local JSON only. */
  offlineMode: boolean;
  useOffline: () => void;
  /** Replace one slice and persist just that slice. */
  mutate: <K extends Section>(section: K, next: HealthData[K]) => void;
  update: <K extends Section>(section: K, fn: (current: HealthData[K]) => HealthData[K]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (next: HealthData) => Promise<void>;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
  resetData: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const HealthContext = createContext<HealthContextValue | null>(null);

/** Firebase auth codes are stable identifiers, not sentences. Translate the common ones. */
function authMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'That email and password do not match an account.';
      case 'auth/invalid-email':
        return 'That does not look like an email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a minute and try again.';
      case 'auth/email-already-in-use':
        return 'An account already exists for that address — sign in instead.';
      case 'auth/weak-password':
        return 'Pick a password of at least six characters.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the Google popup. Allow popups for this site and retry.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled.';
      case 'auth/network-request-failed':
        return 'Cannot reach Firebase. Check your connection.';
      case 'auth/operation-not-allowed':
        return 'That sign-in method is disabled in the Firebase console.';
      case 'auth/unauthorized-domain':
        return 'This domain is not in the Firebase console under Authentication → Settings → Authorized domains.';
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const NOT_ALLOWED = (email: string) =>
  new Error(`${email} is not permitted to sign in to this app.`);

/**
 * Local-only mode survives a refresh but not a new tab or a restart —
 * sessionStorage rather than localStorage, so the choice has to be made again
 * next time rather than quietly becoming permanent.
 */
const OFFLINE_KEY = 'vitals.offline';

function readOfflineChoice(): boolean {
  try {
    return sessionStorage.getItem(OFFLINE_KEY) === '1';
  } catch {
    return false;
  }
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HealthData>(DEFAULT_DATA);
  const [sync, setSync] = useState<SyncState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(readOfflineChoice);

  const localStore = useRef(new LocalStore());

  /**
   * Mirrors `data` synchronously. React state updaters must be pure — the
   * previous version persisted from inside `setData`, which fires twice under
   * StrictMode and issues a duplicate write on every edit. Reading current
   * state from a ref keeps the updater pure and the write count at one.
   */
  const dataRef = useRef<HealthData>(DEFAULT_DATA);

  const commit = useCallback((next: HealthData) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const store: HealthStore = useMemo(
    () => (user ? new FirestoreStore(user.uid) : localStore.current),
    [user],
  );

  // Firebase auth state drives which store is active. An account that is not on
  // the allowlist is signed straight back out — the same rule is enforced
  // server-side in firestore.rules, this is just the friendly half.
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth(), (next) => {
      if (next && !isAllowedEmail(next.email)) {
        setAccessDenied(next.email ?? 'that account');
        setUser(null);
        setAuthReady(true);
        void fbSignOut(auth());
        return;
      }
      if (next) setAccessDenied(null);
      setUser(next);
      setAuthReady(true);
    });
  }, []);

  // Load whenever the active store changes (sign in / sign out).
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    setSync('loading');

    const read = async (): Promise<HealthData> => {
      if (store instanceof FirestoreStore) {
        // First sign-in on an empty account carries this device's history up
        // instead of presenting a blank app.
        return seedFromLocal(store, await localStore.current.load());
      }
      return store.load();
    };

    read()
      .then((loaded) => {
        if (cancelled) return;
        commit(loaded);
        setSync('ready');
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(errorMessage(e));
        setSync('error');
      });

    return () => {
      cancelled = true;
    };
  }, [store, authReady, commit]);

  // Live updates from another device on the same account.
  useEffect(() => {
    if (!store.subscribe) return;
    return store.subscribe(commit);
  }, [store, commit]);

  const persist = useCallback(
    <K extends Section>(section: K, value: HealthData[K]) => {
      setSync('saving');
      store
        .saveSection(section, value)
        .then(() => {
          setSync('ready');
          setError(null);
        })
        .catch((e: unknown) => {
          setError(errorMessage(e));
          setSync('error');
        });
    },
    [store],
  );

  const mutate = useCallback(
    <K extends Section>(section: K, next: HealthData[K]) => {
      commit({ ...dataRef.current, [section]: next });
      persist(section, next);
    },
    [commit, persist],
  );

  const update = useCallback(
    <K extends Section>(section: K, fn: (current: HealthData[K]) => HealthData[K]) => {
      mutate(section, fn(dataRef.current[section]));
    },
    [mutate],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      update('settings', (current) => ({ ...current, ...patch }));
    },
    [update],
  );

  const replaceAll = useCallback(
    async (next: HealthData) => {
      commit(next);
      setSync('saving');
      try {
        await store.saveAll(next);
        setSync('ready');
        setError(null);
      } catch (e) {
        setError(errorMessage(e));
        setSync('error');
        throw e;
      }
    },
    [commit, store],
  );

  const importData = useCallback(
    async (file: File) => {
      // Parse and validate before touching state, so a bad file leaves the
      // current data exactly where it was.
      const parsed = await importJSON(file);
      await replaceAll(parsed);
    },
    [replaceAll],
  );

  const signInGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
      ...(ALLOWED_EMAILS.length === 1 ? { login_hint: ALLOWED_EMAILS[0] } : {}),
    });
    try {
      const credential = await signInWithPopup(auth(), provider);
      if (!isAllowedEmail(credential.user.email)) {
        await fbSignOut(auth());
        throw NOT_ALLOWED(credential.user.email ?? 'That account');
      }
    } catch (e) {
      throw new Error(authMessage(e));
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    if (!isAllowedEmail(email)) throw NOT_ALLOWED(email);
    try {
      await signInWithEmailAndPassword(auth(), email, password);
    } catch (e) {
      throw new Error(authMessage(e));
    }
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    if (!isAllowedEmail(email)) throw NOT_ALLOWED(email);
    try {
      await createUserWithEmailAndPassword(auth(), email, password);
    } catch (e) {
      throw new Error(authMessage(e));
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!isAllowedEmail(email)) throw NOT_ALLOWED(email);
    try {
      await sendPasswordResetEmail(auth(), email);
    } catch (e) {
      throw new Error(authMessage(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth());
  }, []);

  const useOffline = useCallback(() => {
    try {
      sessionStorage.setItem(OFFLINE_KEY, '1');
    } catch {
      /* storage blocked — the choice just won't survive a refresh */
    }
    setOfflineMode(true);
  }, []);
  const exportData = useCallback(() => exportJSON(dataRef.current), []);
  const resetData = useCallback(() => replaceAll(normalize(null)), [replaceAll]);

  const value = useMemo<HealthContextValue>(
    () => ({
      data,
      sync,
      error,
      storeKind: store.kind,
      storeLabel: store.label,
      firebaseAvailable: firebaseConfigured,
      authReady,
      user,
      accessDenied,
      offlineMode,
      useOffline,
      mutate,
      update,
      updateSettings,
      replaceAll,
      exportData,
      importData,
      resetData,
      signInGoogle,
      signInEmail,
      signUpEmail,
      resetPassword,
      signOut,
    }),
    [
      data,
      sync,
      error,
      store,
      authReady,
      user,
      accessDenied,
      offlineMode,
      useOffline,
      mutate,
      update,
      updateSettings,
      replaceAll,
      exportData,
      importData,
      resetData,
      signInGoogle,
      signInEmail,
      signUpEmail,
      resetPassword,
      signOut,
    ],
  );

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth(): HealthContextValue {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used inside <HealthProvider>');
  return ctx;
}
