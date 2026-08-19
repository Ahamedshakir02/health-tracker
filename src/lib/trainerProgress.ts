/**
 * Set-by-set working state, mid-workout.
 *
 * This stays in localStorage rather than riding the synced health record. It
 * changes many times a minute in the gym, and a Firestore write per tap would
 * burn the free tier on state that is worthless an hour later — and would fail
 * outright in the basement where most of it is typed. It is promoted to a
 * durable `sessions` record once, when the day is finished (see lib/session.ts).
 *
 * What changed from v1, and why the key changed with it: v1 was a single flat
 * map keyed `scheduleId:day:sectionIndex:exerciseN` with **no date in it**. It
 * was therefore overwritten in place — training Schedule 3 Day 1 today wiped
 * what you did last week, the ticks never cleared, and nothing could ever be
 * read back as history. v2 is keyed by date first, which is the whole fix.
 */

import { todayISO } from './dates';
import type { ISODate, UnitSystem } from '../types';

const KEY = 'vitals.trainer.scratch.v2';
/** The undated v1 map. Read once, converted to weight hints, then removed. */
const LEGACY_KEY = 'vitals.trainer.progress.v1';
/** Weight hints recovered from v1, so the numbers on screen are not lost. */
const HINTS_KEY = 'vitals.trainer.lastWeights.v1';

/** Keep a few days so an unfinished session is still promotable tomorrow. */
const MAX_DAYS = 8;

export interface ScratchEntry {
  /** One per set: ticked or not. */
  done: boolean[];
  /** One per set: what went on the bar, as typed. Empty string when unfilled. */
  weight: string[];
  /** One per set: reps actually done, as typed. Empty falls back to the scheme. */
  reps: string[];
}

export interface ScratchDay {
  date: ISODate;
  scheduleId: number;
  day: number;
  /**
   * Minted once, on the first tick, and never regenerated. This is what makes
   * promotion idempotent: the session id is derived from it, so a re-render, a
   * StrictMode double-effect and a second tap on "Finish day" all produce the
   * same record rather than three.
   */
  startedAt: string;
  /**
   * The unit system in force when these strings were typed. Without it, a user
   * who flips to imperial mid-workout has half their sets silently converted
   * from the wrong starting point.
   */
  units: UnitSystem;
  /** `${sectionIndex}:${exerciseN}` -> entry. Positions cannot collide. */
  entries: Record<string, ScratchEntry>;
  /** Stretch key -> held. */
  cooldown?: Record<string, boolean>;
  /** Set the instant a session record is written. The idempotency latch. */
  promotedAs?: string;
}

/** Key: `${date}|${scheduleId}|${day}`. */
export type ScratchStore = Record<string, ScratchDay>;

export function dayKey(date: ISODate, scheduleId: number, day: number): string {
  return `${date}|${scheduleId}|${day}`;
}

/** Stable per-exercise key *within a day*. Position, not identity. */
export function progressKey(sectionIndex: number, exerciseN: number): string {
  return `${sectionIndex}:${exerciseN}`;
}

/** "15 x 3" → { reps: 15, sets: 3 }. Falls back to 3 sets when the book is silent. */
export function parseScheme(reps: string): { reps: number; sets: number } {
  const m = /(\d+)\s*[x×]\s*(\d+)/i.exec(reps ?? '');
  if (!m) return { reps: 0, sets: 3 };
  return { reps: Number(m[1]), sets: Number(m[2]) };
}

export function emptyProgress(sets: number): ScratchEntry {
  return {
    done: Array(sets).fill(false),
    weight: Array(sets).fill(''),
    reps: Array(sets).fill(''),
  };
}

/** Grows or trims a stored record to the set count the schedule actually calls for. */
export function normalise(entry: ScratchEntry | undefined, sets: number): ScratchEntry {
  if (!entry) return emptyProgress(sets);
  return {
    done: Array.from({ length: sets }, (_, i) => entry.done?.[i] ?? false),
    weight: Array.from({ length: sets }, (_, i) => entry.weight?.[i] ?? ''),
    reps: Array.from({ length: sets }, (_, i) => entry.reps?.[i] ?? ''),
  };
}

export function newDay(
  date: ISODate,
  scheduleId: number,
  day: number,
  units: UnitSystem,
): ScratchDay {
  return {
    date,
    scheduleId,
    day,
    startedAt: new Date().toISOString(),
    units,
    entries: {},
  };
}

/** Any set ticked at all. Below this there is nothing worth recording. */
export function hasProgress(scratch: ScratchDay): boolean {
  for (const entry of Object.values(scratch.entries)) {
    if (entry.done?.some(Boolean)) return true;
  }
  return Object.values(scratch.cooldown ?? {}).some(Boolean);
}

function isScratchDay(value: unknown): value is ScratchDay {
  if (!value || typeof value !== 'object') return false;
  const d = value as Partial<ScratchDay>;
  return typeof d.date === 'string' && typeof d.entries === 'object' && d.entries !== null;
}

export function loadScratch(): ScratchStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: ScratchStore = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isScratchDay(v)) out[k] = v;
    }
    return out;
  } catch {
    // Corrupt JSON, or localStorage blocked entirely (private mode). Tracking
    // is a convenience — losing it must never stop the book from rendering.
    return {};
  }
}

/**
 * Drops days that are promoted and no longer today's, then caps the map.
 *
 * Called on every save, which is what stops the store growing without bound —
 * the bug that made v1 look permanently half-finished.
 */
export function prune(store: ScratchStore, today: ISODate = todayISO()): ScratchStore {
  const keep = Object.entries(store)
    .filter(([, d]) => d.date === today || !d.promotedAs)
    .sort((a, b) => b[1].date.localeCompare(a[1].date))
    .slice(0, MAX_DAYS);
  return Object.fromEntries(keep);
}

export function saveScratch(store: ScratchStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prune(store)));
  } catch {
    // Quota or private mode. Nothing useful to tell the user mid-set.
  }
}

/**
 * Days that were started, have something ticked, are not today's, and were
 * never promoted. This is the "walked out of the gym and never tapped finish"
 * case, and it is the only path that writes a session the user did not ask for.
 */
export function stalePromotable(store: ScratchStore, today: ISODate = todayISO()): ScratchDay[] {
  return Object.values(store)
    .filter((d) => d.date < today && !d.promotedAs && hasProgress(d))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Weight hints recovered from the retired v1 map.
 *
 * v1 has no dates, so it cannot honestly become history — dating it "today"
 * would invent a workout that never happened, and every chart and personal
 * record downstream would be built on it. What it does still hold is *what you
 * were lifting*, which is genuinely useful, so it is converted to a
 * device-local hint map that pre-fills the weight inputs and is shown as
 * "from this device" until real history exists.
 */
export type WeightHints = Record<string, string[]>;

export function hintKey(scheduleId: number, day: number, sectionIndex: number, n: number): string {
  return `${scheduleId}:${day}:${sectionIndex}:${n}`;
}

export function loadHints(): WeightHints {
  try {
    const raw = localStorage.getItem(HINTS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as WeightHints) : {};
  } catch {
    return {};
  }
}

/** Runs once. Converts v1 to hints, then removes it so this never runs again. */
export function migrateLegacy(): void {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    const hints: WeightHints = {};
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const weight = (v as { weight?: unknown })?.weight;
        if (Array.isArray(weight) && weight.some((w) => typeof w === 'string' && w.trim())) {
          hints[k] = weight.map((w) => (typeof w === 'string' ? w : ''));
        }
      }
    }
    if (Object.keys(hints).length) {
      localStorage.setItem(HINTS_KEY, JSON.stringify(hints));
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // A failed migration must not stop the app booting. Worst case the old key
    // stays put, inert, and is tried again next load.
  }
}

/** Called once real sessions exist — the hints have been superseded. */
export function clearHints(): void {
  try {
    localStorage.removeItem(HINTS_KEY);
  } catch {
    /* nothing to do */
  }
}
