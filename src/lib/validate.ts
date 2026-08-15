import type {
  DayLog,
  Goals,
  Habit,
  HealthData,
  ISODate,
  Intensity,
  MealEntry,
  MealSlot,
  Settings,
  UnitSystem,
  WeightEntry,
  WorkoutEntry,
} from '../types';
import { DEFAULT_DATA, DEFAULT_HABITS } from '../types';
import { parseISO, todayISO } from './dates';

/**
 * Everything here treats its input as hostile. Two paths feed the app data it
 * did not create: an imported `.json` file, and whatever is sitting in
 * localStorage or Firestore from an older build or a hand edit. A single
 * `null` where an object was expected used to be enough to white-screen a page,
 * and `Number('1e999')` still parses as `Infinity`, which `JSON.stringify`
 * silently turns into `null` on the way back out.
 *
 * So: every record is rebuilt field by field, anything unrecognised is dropped
 * rather than passed through, and numbers must be finite and in range.
 */

/** Hard ceiling on an imported file. A 5 MB export is already ~20 years of logs. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Caps on collection length, so a malformed file cannot lock up rendering. */
const MAX_ENTRIES = 50_000;
const MAX_HABITS = 200;
const MAX_NAME = 200;
const MAX_NOTE = 2_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A real, finite number inside `[min, max]`. Rejects NaN, ±Infinity and numeric strings. */
export function num(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

/** As `num`, but rounded to a whole number. */
export function int(value: unknown, min: number, max: number): number | undefined {
  const n = num(value, min, max);
  return n === undefined ? undefined : Math.round(n);
}

export function str(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || undefined;
}

/** Strict `YYYY-MM-DD` that also has to be a real calendar day — 2025-02-31 is rejected. */
export function isoDate(value: unknown): ISODate | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return todayISO(parsed) === value ? value : undefined;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/** 1–5 rating used for mood and sleep quality. */
function rating(value: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  const n = int(value, 1, 5);
  return n === undefined ? undefined : (n as 1 | 2 | 3 | 4 | 5);
}

const SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const INTENSITIES: readonly Intensity[] = ['low', 'moderate', 'high'];
const UNITS: readonly UnitSystem[] = ['metric', 'imperial'];
const THEMES = ['system', 'light', 'dark'] as const;

/** Falls back to a generated id so a record with a missing id is still usable. */
function idOf(value: unknown, prefix: string, index: number): string {
  return str(value, 128) ?? `${prefix}_recovered_${index}`;
}

function weightEntry(raw: unknown, index: number): WeightEntry | null {
  if (!isRecord(raw)) return null;
  const date = isoDate(raw.date);
  const weightKg = num(raw.weightKg, 0, 1_000);
  if (!date || weightKg === undefined) return null;

  const entry: WeightEntry = { id: idOf(raw.id, 'w', index), date, weightKg };
  const bodyFatPct = num(raw.bodyFatPct, 0, 100);
  const waistCm = num(raw.waistCm, 0, 500);
  const chestCm = num(raw.chestCm, 0, 500);
  const hipCm = num(raw.hipCm, 0, 500);
  const note = str(raw.note, MAX_NOTE);
  if (bodyFatPct !== undefined) entry.bodyFatPct = bodyFatPct;
  if (waistCm !== undefined) entry.waistCm = waistCm;
  if (chestCm !== undefined) entry.chestCm = chestCm;
  if (hipCm !== undefined) entry.hipCm = hipCm;
  if (note !== undefined) entry.note = note;
  return entry;
}

function mealEntry(raw: unknown, index: number): MealEntry | null {
  if (!isRecord(raw)) return null;
  const date = isoDate(raw.date);
  if (!date) return null;
  return {
    id: idOf(raw.id, 'm', index),
    date,
    slot: oneOf(raw.slot, SLOTS) ?? 'snack',
    name: str(raw.name, MAX_NAME) ?? 'Untitled',
    calories: num(raw.calories, 0, 100_000) ?? 0,
    proteinG: num(raw.proteinG, 0, 10_000) ?? 0,
    carbsG: num(raw.carbsG, 0, 10_000) ?? 0,
    fatG: num(raw.fatG, 0, 10_000) ?? 0,
  };
}

function workoutEntry(raw: unknown, index: number): WorkoutEntry | null {
  if (!isRecord(raw)) return null;
  const date = isoDate(raw.date);
  const minutes = num(raw.minutes, 0, 1_440);
  if (!date || minutes === undefined) return null;

  const entry: WorkoutEntry = {
    id: idOf(raw.id, 'k', index),
    date,
    type: str(raw.type, MAX_NAME) ?? 'Other',
    minutes,
    intensity: oneOf(raw.intensity, INTENSITIES) ?? 'moderate',
  };
  const caloriesBurned = num(raw.caloriesBurned, 0, 50_000);
  const distanceKm = num(raw.distanceKm, 0, 1_000);
  const note = str(raw.note, MAX_NOTE);
  if (caloriesBurned !== undefined) entry.caloriesBurned = caloriesBurned;
  if (distanceKm !== undefined) entry.distanceKm = distanceKm;
  if (note !== undefined) entry.note = note;
  return entry;
}

/** `habits` is a free-form id -> bool map, so it needs its own scrub. */
function habitMap(raw: unknown): Record<string, boolean> {
  if (!isRecord(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    // `__proto__` and friends would be inert on a fresh object literal, but an
    // id that long is junk anyway and there is no reason to carry it around.
    if (!key || key.length > 128) continue;
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

function dayLog(raw: unknown): DayLog | null {
  if (!isRecord(raw)) return null;
  const date = isoDate(raw.date);
  if (!date) return null;

  const log: DayLog = { date, habits: habitMap(raw.habits) };
  const sleepHours = num(raw.sleepHours, 0, 24);
  const waterMl = num(raw.waterMl, 0, 100_000);
  const steps = int(raw.steps, 0, 500_000);
  const restingHr = int(raw.restingHr, 0, 300);
  const sleepQuality = rating(raw.sleepQuality);
  const mood = rating(raw.mood);
  const note = str(raw.note, MAX_NOTE);
  if (sleepHours !== undefined) log.sleepHours = sleepHours;
  if (waterMl !== undefined) log.waterMl = waterMl;
  if (steps !== undefined) log.steps = steps;
  if (restingHr !== undefined) log.restingHr = restingHr;
  if (sleepQuality !== undefined) log.sleepQuality = sleepQuality;
  if (mood !== undefined) log.mood = mood;
  if (note !== undefined) log.note = note;
  return log;
}

function habit(raw: unknown, index: number): Habit | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name, MAX_NAME);
  if (!name) return null;
  const entry: Habit = {
    id: idOf(raw.id, 'h', index),
    name,
    // Emoji fields are rendered as text by React, so the only risk is layout.
    emoji: str(raw.emoji, 8) ?? '⭐',
  };
  if (raw.archived === true) entry.archived = true;
  return entry;
}

function goals(raw: unknown): Goals {
  const base = DEFAULT_DATA.settings.goals;
  if (!isRecord(raw)) return { ...base };
  const out: Goals = {
    calories: num(raw.calories, 0, 100_000) ?? base.calories,
    proteinG: num(raw.proteinG, 0, 10_000) ?? base.proteinG,
    waterMl: num(raw.waterMl, 0, 100_000) ?? base.waterMl,
    sleepHours: num(raw.sleepHours, 0, 24) ?? base.sleepHours,
    steps: int(raw.steps, 0, 500_000) ?? base.steps,
    workoutsPerWeek: int(raw.workoutsPerWeek, 0, 14) ?? base.workoutsPerWeek,
  };
  const weightKg = num(raw.weightKg, 0, 1_000);
  if (weightKg !== undefined) out.weightKg = weightKg;
  return out;
}

export function settings(raw: unknown): Settings {
  const base = DEFAULT_DATA.settings;
  if (!isRecord(raw)) return { ...base, goals: { ...base.goals }, habits: [...DEFAULT_HABITS] };

  const cleanedHabits = Array.isArray(raw.habits)
    ? raw.habits
        .slice(0, MAX_HABITS)
        .map(habit)
        .filter((h): h is Habit => h !== null)
    : [];

  const out: Settings = {
    name: str(raw.name, MAX_NAME) ?? '',
    units: oneOf(raw.units, UNITS) ?? base.units,
    theme: oneOf(raw.theme, THEMES) ?? base.theme,
    goals: goals(raw.goals),
    habits: cleanedHabits.length ? cleanedHabits : [...DEFAULT_HABITS],
  };
  const heightCm = num(raw.heightCm, 0, 300);
  const birthYear = int(raw.birthYear, 1900, new Date().getFullYear());
  if (heightCm !== undefined) out.heightCm = heightCm;
  if (birthYear !== undefined) out.birthYear = birthYear;
  // Anything not listed here is dropped on load, so a new Settings field must be
  // added in both places or it silently fails to persist.
  const onboardedAt = str(raw.onboardedAt, 40);
  if (onboardedAt !== undefined) out.onboardedAt = onboardedAt;
  return out;
}

function collection<T>(raw: unknown, build: (item: unknown, index: number) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (let i = 0; i < raw.length && out.length < MAX_ENTRIES; i += 1) {
    const built = build(raw[i], i);
    if (built) out.push(built);
  }
  return out;
}

/**
 * Weights and day logs are one-per-date by construction — the forms replace
 * rather than append. An imported file need not honour that, and a duplicate
 * date makes the charts and the `find`-based lookups disagree, so collapse to
 * the last entry for each day.
 */
function dedupeByDate<T extends { date: ISODate }>(items: T[]): T[] {
  const byDate = new Map<ISODate, T>();
  for (const item of items) byDate.set(item.date, item);
  return [...byDate.values()];
}

/**
 * The one entry point every storage backend goes through. Anything that does
 * not survive validation is dropped, so the returned value always matches
 * `HealthData` exactly.
 */
export function healthData(raw: unknown): HealthData {
  const input = isRecord(raw) ? raw : {};
  return {
    version: 1,
    settings: settings(input.settings),
    weights: dedupeByDate(collection(input.weights, weightEntry)),
    meals: collection(input.meals, mealEntry),
    workouts: collection(input.workouts, workoutEntry),
    days: dedupeByDate(collection(input.days, dayLog)),
  };
}
