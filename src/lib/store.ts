import { DEFAULT_DATA, type HealthData, type Section } from '../types';

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
 * Merges a partial/older payload onto the defaults so a missing field in a
 * hand-edited or older JSON export never crashes a screen.
 */
export function normalize(raw: unknown): HealthData {
  const input = (raw ?? {}) as Partial<HealthData>;
  const settings = { ...DEFAULT_DATA.settings, ...(input.settings ?? {}) };
  settings.goals = { ...DEFAULT_DATA.settings.goals, ...(input.settings?.goals ?? {}) };
  settings.habits = input.settings?.habits?.length
    ? input.settings.habits
    : DEFAULT_DATA.settings.habits;
  return {
    version: 1,
    settings,
    weights: Array.isArray(input.weights) ? input.weights : [],
    meals: Array.isArray(input.meals) ? input.meals : [],
    workouts: Array.isArray(input.workouts) ? input.workouts : [],
    days: Array.isArray(input.days) ? input.days.map((d) => ({ ...d, habits: d.habits ?? {} })) : [],
  };
}

/**
 * JSON storage. Keeps the working copy in localStorage so a refresh doesn't
 * lose anything, and round-trips through a downloadable .json file for backup
 * and for moving between machines.
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
    } catch {
      /* private mode / quota — the in-memory copy and JSON export still work */
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
  a.click();
  URL.revokeObjectURL(url);
}

export async function importJSON(file: File): Promise<HealthData> {
  const text = await file.text();
  return normalize(JSON.parse(text));
}
