import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { normalize, type HealthStore } from './store';
import { DEFAULT_DATA, type HealthData, type Section } from '../types';

const SECTIONS: Section[] = ['settings', 'weights', 'meals', 'workouts', 'days'];

/** Firestore rejects `undefined`; optional fields must be dropped, not sent as undefined. */
function stripUndefined<T>(input: T): T {
  if (Array.isArray(input)) return input.map(stripUndefined) as unknown as T;
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return input;
}

/**
 * One document per slice under `users/{uid}/slices`, each wrapping its value in
 * a `{ value }` field. Logging a meal therefore rewrites only the meals doc,
 * and `onSnapshot` gives live updates when the same account is open elsewhere.
 */
export class FirestoreStore implements HealthStore {
  readonly kind = 'firebase' as const;
  readonly label = 'Firebase sync';

  constructor(private readonly uid: string) {}

  private slices() {
    return collection(db(), 'users', this.uid, 'slices');
  }

  async load(): Promise<HealthData> {
    const snap = await getDocs(this.slices());
    const raw: Record<string, unknown> = {};
    snap.forEach((d) => {
      raw[d.id] = (d.data() as { value?: unknown }).value;
    });
    if (snap.empty) return normalize(null);
    return normalize(raw);
  }

  async saveSection<K extends Section>(section: K, value: HealthData[K]): Promise<void> {
    await setDoc(doc(this.slices(), section), { value: stripUndefined(value) });
  }

  async saveAll(data: HealthData): Promise<void> {
    const batch = writeBatch(db());
    for (const section of SECTIONS) {
      batch.set(doc(this.slices(), section), { value: stripUndefined(data[section]) });
    }
    await batch.commit();
  }

  subscribe(onChange: (data: HealthData) => void): () => void {
    return onSnapshot(this.slices(), (snap) => {
      // Ignore the echo of our own pending write — only settled server state.
      if (snap.metadata.hasPendingWrites || snap.empty) return;
      const raw: Record<string, unknown> = {};
      snap.forEach((d) => {
        raw[d.id] = (d.data() as { value?: unknown }).value;
      });
      onChange(normalize(raw));
    });
  }
}

/** Seeded on first sign-in so a brand-new account starts from the defaults. */
export async function seedIfEmpty(store: FirestoreStore): Promise<HealthData> {
  const existing = await store.load();
  const isEmpty =
    !existing.weights.length &&
    !existing.meals.length &&
    !existing.workouts.length &&
    !existing.days.length;
  if (isEmpty) await store.saveAll({ ...DEFAULT_DATA, settings: existing.settings });
  return existing;
}
