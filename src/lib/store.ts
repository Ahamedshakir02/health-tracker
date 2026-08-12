import type { HealthData, Section } from '../types';
import { MAX_IMPORT_BYTES, healthData } from './validate';

export interface HealthStore {
  readonly kind: 'local' | 'firebase';
  /** Human-readable label for the status pill in the header. */
  readonly label: string;
  load(): Promise<HealthData>;
  /** Persist one slice. Callers pass the full slice value after mutation. */
  saveSection<K extends Section>(section: K, value: HealthData[K]): Promise<void>;
  /** Persist everything (used by import / reset). */
  saveAll(data: HealthData): Promise<void>;
  /** Optional live updates from other devices. Returns an unsubscribe fn. */
  subscribe?(onChange: (data: HealthData) => void): () => void;
}

const LOCAL_KEY = 'vitals.health.v1';

/**
 * Rebuilds a full `HealthData` from whatever was handed in, dropping anything
 * that does not validate. A missing field in a hand-edited or older export can
 * therefore never crash a screen. See `lib/validate.ts` for the field rules.
 */
export function normalize(raw: unknown): HealthData {
  return healthData(raw);
}

/**
 * JSON storage. Keeps the working copy in localStorage so a refresh doesn't
 * lose anything, and round-trips through a downloadable .json file for backup
 * and for moving between machines.
 *
 * Note that localStorage is plain text and readable by anything running on the
 * same origin — it is convenience storage for a personal device, not a vault.
 */
export class LocalStore implements HealthStore {
  readonly kind = 'local' as const;
  readonly label = 'Local JSON';

  async load(): Promise<HealthData> {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return normalize(null);
      return normalize(JSON.parse(raw));
    } catch {
      // Corrupt JSON or localStorage blocked entirely (private mode, or an
      // embedding context with storage partitioned off). Start clean rather
      // than failing to boot.
      return normalize(null);
    }
  }

  async saveSection<K extends Section>(section: K, value: HealthData[K]): Promise<void> {
    const current = await this.load();
    await this.saveAll({ ...current, [section]: value });
  }

  async saveAll(data: HealthData): Promise<void> {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch (e) {
      // Quota is the one failure worth reporting — silently dropping writes
      // once the store is full is how people lose a month of logs.
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        throw new Error(
          'This browser is out of local storage. Export your data, then delete some entries.',
        );
      }
      /* private mode / storage disabled — the in-memory copy and export still work */
    }
  }
}

export function exportJSON(data: HealthData): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vitals-health-${stamp}.json`;
  a.rel = 'noopener';
  // Firefox only fires the download for an anchor that is actually in the
  // document, and revoking the URL in the same tick cancels the download in
  // several browsers — so attach, click, then clean up on the next turn.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importJSON(file: File): Promise<HealthData> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Imports are capped at ${
        MAX_IMPORT_BYTES / 1024 / 1024
      } MB.`,
    );
  }

  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON. Pick a file exported from Vitals.");
  }

  const data = normalize(parsed);
  const total =
    data.weights.length + data.meals.length + data.workouts.length + data.days.length;
  if (total === 0) {
    throw new Error('No usable entries were found in that file — nothing was changed.');
  }
  return data;
}
