import { FirebaseError } from 'firebase/app';
import { collection, doc, getDocs, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { normalize, type HealthStore } from './store';
import type { HealthData, Section } from '../types';

const SECTIONS: readonly Section[] = ['settings', 'weights', 'meals', 'workouts', 'days'];

/** A document id we did not write. Ignored rather than fed into `normalize`. */
function isSection(id: string): id is Section {
  return (SECTIONS as readonly string[]).includes(id);
}

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
 * Firestore's raw errors are accurate and useless — "Missing or insufficient
 * permissions" says nothing about which rule fired. These are the three that
 * actually happen in this app.
 */
function describe(error: unknown): Error {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return new Error(
          'Firestore refused the write. Check that firestore.rules is deployed and that this ' +
            'account is on the allowlist inside it.',
        );
      case 'unavailable':
        return new Error('Cannot reach Firestore. Your changes are saved on this device.');
      case 'invalid-argument':
        return new Error(
          'That slice is too large for a single Firestore document (1 MB). Export a backup and ' +
            'trim old entries.',
        );
    }
  }
  return error instanceof Error ? error : new Error(String(error));
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
    try {
      const snap = await getDocs(this.slices());
      if (snap.empty) return normalize(null);
      return normalize(this.collect(snap.docs));
    } catch (e) {
      throw describe(e);
    }
  }

  /** Only the five known slice ids are read back; anything else is ignored. */
  private collect(docs: { id: string; data: () => Record<string, unknown> }[]): unknown {
    const raw: Record<string, unknown> = {};
    for (const d of docs) {
      if (isSection(d.id)) raw[d.id] = (d.data() as { value?: unknown }).value;
    }
    return raw;
  }

  async saveSection<K extends Section>(section: K, value: HealthData[K]): Promise<void> {
    try {
      await setDoc(doc(this.slices(), section), { value: stripUndefined(value) });
    } catch (e) {
      throw describe(e);
    }
  }

  async saveAll(data: HealthData): Promise<void> {
    try {
      const batch = writeBatch(db());
      for (const section of SECTIONS) {
        batch.set(doc(this.slices(), section), { value: stripUndefined(data[section]) });
      }
      await batch.commit();
    } catch (e) {
      throw describe(e);
    }
  }

  subscribe(onChange: (data: HealthData) => void): () => void {
    return onSnapshot(
      this.slices(),
      (snap) => {
        // Ignore the echo of our own pending write — only settled server state.
        if (snap.metadata.hasPendingWrites || snap.empty) return;
        onChange(normalize(this.collect(snap.docs)));
      },
      // A listener error is silent by default, which leaves the UI looking live
      // when it is not. Nothing to do but stop pretending.
      () => undefined,
    );
  }
}

/**
 * First sign-in on a fresh account: push whatever is already on this device up
 * to Firestore instead of showing an empty app. Returns the data the app should
 * display — the cloud copy when there is one, the local copy when there is not.
 */
export async function seedFromLocal(
  store: FirestoreStore,
  local: HealthData,
): Promise<HealthData> {
  const remote = await store.load();
  const remoteIsEmpty =
    !remote.weights.length &&
    !remote.meals.length &&
    !remote.workouts.length &&
    !remote.days.length;
  const localHasData =
    local.weights.length || local.meals.length || local.workouts.length || local.days.length;

  if (remoteIsEmpty && localHasData) {
    await store.saveAll(local);
    return local;
  }
  return remote;
}
