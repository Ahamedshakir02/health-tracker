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
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth, firebaseConfigured } from '../lib/firebase';
import { FirestoreStore } from '../lib/firestoreStore';
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
  user: User | null;
  /** Replace one slice and persist just that slice. */
  mutate: <K extends Section>(section: K, next: HealthData[K]) => void;
  update: <K extends Section>(section: K, fn: (current: HealthData[K]) => HealthData[K]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (next: HealthData) => Promise<void>;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
  resetData: () => Promise<void>;
  signInAnon: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HealthData>(DEFAULT_DATA);
  const [sync, setSync] = useState<SyncState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseConfigured);

  const localStore = useRef(new LocalStore());
  const store: HealthStore = useMemo(
    () => (user ? new FirestoreStore(user.uid) : localStore.current),
    [user],
  );

  // Firebase auth state drives which store is active.
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth(), (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  // Load whenever the active store changes (sign in / sign out).
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    setSync('loading');
    store
      .load()
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        setSync('ready');
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setSync('error');
      });
    return () => {
      cancelled = true;
    };
  }, [store, authReady]);

  // Live updates from another device on the same account.
  useEffect(() => {
    if (!store.subscribe) return;
    return store.subscribe((incoming) => setData(incoming));
  }, [store]);

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
          setError(e instanceof Error ? e.message : String(e));
          setSync('error');
        });
    },
    [store],
  );

  const mutate = useCallback(
    <K extends Section>(section: K, next: HealthData[K]) => {
      setData((prev) => ({ ...prev, [section]: next }));
      persist(section, next);
    },
    [persist],
  );

  const update = useCallback(
    <K extends Section>(section: K, fn: (current: HealthData[K]) => HealthData[K]) => {
      setData((prev) => {
        const next = fn(prev[section]);
        persist(section, next);
        return { ...prev, [section]: next };
      });
    },
    [persist],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      update('settings', (current) => ({ ...current, ...patch }));
    },
    [update],
  );

  const replaceAll = useCallback(
    async (next: HealthData) => {
      setData(next);
      setSync('saving');
      try {
        await store.saveAll(next);
        setSync('ready');
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setSync('error');
      }
    },
    [store],
  );

  const value: HealthContextValue = {
    data,
    sync,
    error,
    storeKind: store.kind,
    storeLabel: store.label,
    firebaseAvailable: firebaseConfigured,
    user,
    mutate,
    update,
    updateSettings,
    replaceAll,
    exportData: () => exportJSON(data),
    importData: async (file: File) => {
      const parsed = await importJSON(file);
      await replaceAll(parsed);
    },
    resetData: () => replaceAll(normalize(null)),
    signInAnon: async () => {
      await signInAnonymously(auth());
    },
    signInEmail: async (email, password) => {
      await signInWithEmailAndPassword(auth(), email, password);
    },
    signUpEmail: async (email, password) => {
      await createUserWithEmailAndPassword(auth(), email, password);
    },
    signOut: async () => {
      await fbSignOut(auth());
    },
  };

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth(): HealthContextValue {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used inside <HealthProvider>');
  return ctx;
}
