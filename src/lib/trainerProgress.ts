/**
 * Set-by-set progress through the schedule book.
 *
 * This lives in its own localStorage key rather than in the synced health
 * record. It is scratch working state — which sets you have ticked off in the
 * gym today and what you put on the bar — not a health measurement, and it
 * would bloat every Firestore write if it rode along with the rest. The
 * trade-off is that it stays on this device.
 */

const KEY = 'vitals.trainer.progress.v1';

export interface ExerciseProgress {
  /** One entry per set: ticked or not. */
  done: boolean[];
  /** One entry per set: what was actually lifted. Empty string when unfilled. */
  weight: string[];
}

export type ProgressMap = Record<string, ExerciseProgress>;

/** Stable per-exercise key. Section index keeps days with a repeated muscle group distinct. */
export function progressKey(
  scheduleId: number,
  day: number,
  sectionIndex: number,
  exerciseN: number,
): string {
  return `${scheduleId}:${day}:${sectionIndex}:${exerciseN}`;
}

/** "15 x 3" → { reps: 15, sets: 3 }. Falls back to 3 sets when the book is silent. */
export function parseScheme(reps: string): { reps: number; sets: number } {
  const m = /(\d+)\s*[x×]\s*(\d+)/i.exec(reps ?? '');
  if (!m) return { reps: 0, sets: 3 };
  return { reps: Number(m[1]), sets: Number(m[2]) };
}

export function emptyProgress(sets: number): ExerciseProgress {
  return { done: Array(sets).fill(false), weight: Array(sets).fill('') };
}

/** Grows or trims a stored record to the set count the schedule actually calls for. */
export function normalise(entry: ExerciseProgress | undefined, sets: number): ExerciseProgress {
  if (!entry) return emptyProgress(sets);
  const done = Array.from({ length: sets }, (_, i) => entry.done?.[i] ?? false);
  const weight = Array.from({ length: sets }, (_, i) => entry.weight?.[i] ?? '');
  return { done, weight };
}

export function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ProgressMap) : {};
  } catch {
    // Corrupt JSON, or localStorage blocked entirely (private mode). Tracking
    // is a convenience — losing it must never stop the book from rendering.
    return {};
  }
}

export function saveProgress(map: ProgressMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Quota or private mode. Nothing useful to tell the user mid-set.
  }
}
