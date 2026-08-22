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
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, firebaseConfigured } from '../lib/firebase';
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
  /**
   * Google always reports a verified address; an email/password account stays
   * unverified until the confirmation link is clicked. Firestore refuses to
   * serve an unverified account, so the app must not pretend it is signed in.
   */
  emailVerified: boolean;
  /** Re-sends the confirmation link to the signed-in but unverified account. */
  resendVerification: () => Promise<void>;
  /** Re-reads the account from Firebase, to pick up a link clicked elsewhere. */
  refreshUser: () => Promise<void>;
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
  signUpEmail: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Erase every document under this account, then delete the account itself. */
  deleteAccount: () => Promise<void>;
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

  /**
   * Firestore refuses an unverified account, so building a FirestoreStore for
   * one would make the first read fail with `permission-denied` instead of
   * showing the "confirm your address" screen. Fall back to the local store
   * until the address is confirmed.
   */
  const store: HealthStore = useMemo(
    () => (user?.emailVerified ? new FirestoreStore(user.uid) : localStore.current),
    [user],
  );

  // Firebase auth state drives which store is active.
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth(), (next) => {
      setUser(next);
      setAuthReady(true);
    });
  }, []);

  /**
   * Poll for confirmation while the waiting screen is up.
   *
   * The link is usually clicked in a mail app, not in this tab, so nothing here
   * would ever learn about it. Only while the tab is visible and only while
   * actually waiting — this stops the moment the account is confirmed.
   */
  useEffect(() => {
    if (!user || user.emailVerified) return;
    let stopped = false;
    const tick = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      const current = auth().currentUser;
      if (!current) return;
      try {
        await current.reload();
        const next = auth().currentUser;
        if (next?.emailVerified) {
          await next.getIdToken(true);
          setUser(next);
        }
      } catch {
        // Offline, or the account was deleted elsewhere. The manual button
        // is still there; a failed poll is not worth reporting.
      }
    };
    const id = setInterval(() => void tick(), 5_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [user]);

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

  /**
   * Fill in what the account already knows about you.
   *
   * Sign-up collects a name and Google hands back a name and a picture, but
   * none of it is in the settings slice until something puts it there. This
   * runs after the load has settled rather than inside the sign-in calls,
   * because those resolve before the store has been read and would be writing
   * over data they cannot see yet.
   *
   * Only ever fills a blank. A name typed in Settings is the user's own answer
   * and must survive signing in again — the auth profile is a starting point,
   * not the source of truth.
   */
  useEffect(() => {
    if (!user || sync !== 'ready') return;
    const current = dataRef.current.settings;
    const patch: Partial<Settings> = {};
    const displayName = user.displayName?.trim();
    if (displayName && !current.name.trim()) patch.name = displayName;
    if (user.photoURL?.startsWith('https://') && !current.avatarUrl) patch.avatarUrl = user.photoURL;
    if (Object.keys(patch).length) updateSettings(patch);
  }, [user, sync, updateSettings]);

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
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth(), provider);
    } catch (e) {
      throw new Error(authMessage(e));
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth(), email, password);
    } catch (e) {
      throw new Error(authMessage(e));
    }
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string, name: string) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth(), email, password);
      // On the auth record as well as in the settings slice. Google accounts
      // arrive with a displayName; without this, email accounts stay anonymous
      // everywhere the account itself is shown rather than the app's own data.
      const displayName = name.trim();
      if (displayName) await updateProfile(credential.user, { displayName });
      // Firestore will refuse this account until the link is clicked, so send
      // it as part of signing up rather than making it a separate step the
      // user has to discover.
      await sendEmailVerification(credential.user);
    } catch (e) {
      throw new Error(authMessage(e));
    }
  }, []);

  const resendVerification = useCallback(async () => {
    const current = auth().currentUser;
    if (!current) return;
    try {
      await sendEmailVerification(current);
    } catch (e) {
      throw new Error(authMessage(e));
    }
  }, []);

  /**
   * Turns the "confirm your email" screen into the app once the link is clicked.
   *
   * Two separate things are stale here and both have to be refreshed, which is
   * the trap: `reload()` updates the local User object, but `email_verified` is
   * a claim baked into the **ID token**, and that token is what firestore.rules
   * actually reads. Without the forced `getIdToken(true)` the UI unlocks while
   * every read and write still fails `permission-denied` — for up to an hour,
   * until the token would have refreshed on its own.
   */
  const refreshUser = useCallback(async () => {
    const current = auth().currentUser;
    if (!current) return;
    await current.reload();
    const next = auth().currentUser;
    if (next?.emailVerified) await next.getIdToken(true);
    setUser(next);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth(), email);
    } catch (e) {
      throw new Error(authMessage(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth());
  }, []);

  /**
   * Erase the account and everything in it.
   *
   * Data first, account second: deleting the auth user first would leave the
   * Firestore documents orphaned and unreachable, because the rules key on the
   * uid that no longer exists. Firebase refuses `delete()` on a stale session
   * with `auth/requires-recent-login`, which is translated rather than shown
   * raw — the user has to sign in again, not read an error code.
   */
  const deleteAccount = useCallback(async () => {
    const current = auth().currentUser;
    if (!current) return;
    if (store instanceof FirestoreStore) await store.deleteAll();
    localStore.current.saveAll(normalize(null)).catch(() => undefined);
    try {
      await current.delete();
    } catch (e) {
      if (e instanceof FirebaseError && e.code === 'auth/requires-recent-login') {
        await fbSignOut(auth());
        throw new Error(
          'Your data has been deleted. For security, Firebase needs a fresh sign-in before it ' +
            'will remove the account itself — sign in once more and delete again.',
        );
      }
      throw new Error(authMessage(e));
    }
  }, [store]);

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
      emailVerified: Boolean(user?.emailVerified),
      resendVerification,
      refreshUser,
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
      deleteAccount,
    }),
    [
      data,
      sync,
      error,
      store,
      authReady,
      user,
      resendVerification,
      refreshUser,
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
      deleteAccount,
    ],
  );

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth(): HealthContextValue {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used inside <HealthProvider>');
  return ctx;
}
