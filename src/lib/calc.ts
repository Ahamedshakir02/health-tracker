import type {
  DayLog,
  HealthData,
  ISODate,
  MealEntry,
  Sex,
  WeightEntry,
  WorkoutEntry,
} from '../types';
import { addDays, daysBetween, lastNDays, todayISO } from './dates';

export interface Macros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const EMPTY_MACROS: Macros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function sumMacros(meals: MealEntry[]): Macros {
  return meals.reduce<Macros>(
    (acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      proteinG: acc.proteinG + (m.proteinG || 0),
      carbsG: acc.carbsG + (m.carbsG || 0),
      fatG: acc.fatG + (m.fatG || 0),
    }),
    { ...EMPTY_MACROS },
  );
}

export const byDate =
  <T extends { date: ISODate }>(date: ISODate) =>
  (item: T) =>
    item.date === date;

export function dayLog(days: DayLog[], date: ISODate): DayLog {
  return days.find((d) => d.date === date) ?? { date, habits: {} };
}

/** Newest first. */
export function sortByDateDesc<T extends { date: ISODate }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.date.localeCompare(a.date));
}

export function latestWeight(weights: WeightEntry[]): WeightEntry | undefined {
  return sortByDateDesc(weights)[0];
}

/**
 * Centred-window rolling mean. Day-to-day scale weight is mostly water noise,
 * so the trend line is what's actually readable — the raw points stay visible
 * underneath it.
 */
export function rollingMean(
  points: { date: ISODate; value: number }[],
  windowDays = 7,
): { date: ISODate; value: number }[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const half = Math.floor(windowDays / 2);
  return sorted.map((p) => {
    const inWindow = sorted.filter((q) => Math.abs(daysBetween(q.date, p.date)) <= half);
    const mean = inWindow.reduce((s, q) => s + q.value, 0) / inWindow.length;
    return { date: p.date, value: mean };
  });
}

/** Change over the window, using the first and last readings actually present. */
export function weightChange(
  weights: WeightEntry[],
  days: number,
): { delta: number; from: number; to: number } | null {
  const since = addDays(todayISO(), -days);
  const window = [...weights]
    .filter((w) => w.date >= since)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (window.length < 2) return null;
  const from = window[0].weightKg;
  const to = window[window.length - 1].weightKg;
  return { delta: to - from, from, to };
}

/** Consecutive days ending today (or yesterday, so a not-yet-logged today doesn't reset it). */
export function habitStreak(days: DayLog[], habitId: string): number {
  const done = new Set(days.filter((d) => d.habits?.[habitId]).map((d) => d.date));
  const today = todayISO();
  let cursor = done.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function workoutsInLastDays(workouts: WorkoutEntry[], days: number): WorkoutEntry[] {
  const since = addDays(todayISO(), -(days - 1));
  return workouts.filter((w) => w.date >= since);
}

export interface DailySeriesPoint {
  date: ISODate;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  activeMinutes: number;
  caloriesBurned: number;
  sleepHours: number | null;
  waterMl: number | null;
  steps: number | null;
  mood: number | null;
  weightKg: number | null;
}

/** One row per calendar day across the window — the shape every chart reads from. */
export function dailySeries(data: HealthData, days: number): DailySeriesPoint[] {
  const window = lastNDays(days);
  return window.map((date) => {
    const macros = sumMacros(data.meals.filter(byDate(date)));
    const dayWorkouts = data.workouts.filter(byDate(date));
    const log = dayLog(data.days, date);
    const weight = data.weights.find(byDate(date));
    return {
      date,
      ...macros,
      activeMinutes: dayWorkouts.reduce((s, w) => s + (w.minutes || 0), 0),
      caloriesBurned: dayWorkouts.reduce((s, w) => s + (w.caloriesBurned || 0), 0),
      sleepHours: log.sleepHours ?? null,
      waterMl: log.waterMl ?? null,
      steps: log.steps ?? null,
      mood: log.mood ?? null,
      weightKg: weight?.weightKg ?? null,
    };
  });
}

/** Mean of the non-null values only — a blank day shouldn't drag an average to zero. */
export function meanOf<T>(rows: T[], pick: (row: T) => number | null): number | null {
  const values = rows.map(pick).filter((v): v is number => v !== null && !Number.isNaN(v));
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiBand(value: number): { label: string; status: 'good' | 'warning' | 'serious' } {
  if (value < 18.5) return { label: 'Underweight', status: 'warning' };
  if (value < 25) return { label: 'Healthy range', status: 'good' };
  if (value < 30) return { label: 'Overweight', status: 'warning' };
  return { label: 'Obese', status: 'serious' };
}

/**
 * Resting energy expenditure, kcal/day, by Mifflin-St Jeor.
 *
 * Chosen over Harris-Benedict because it is the more accurate of the two on
 * modern populations, and over anything body-composition based because that
 * would need a body-fat figure the app does not reliably have.
 *
 * Returns null rather than a number whenever an input is missing. Every term
 * matters here — sex alone is a 166 kcal swing — so a "estimate" built by
 * quietly assuming the absent ones would be worse than showing nothing, and
 * indistinguishable from one that was actually calculated.
 */
export function bmr(input: {
  weightKg?: number;
  heightCm?: number;
  age?: number;
  sex?: Sex;
}): number | null {
  const { weightKg, heightCm, age, sex } = input;
  if (!weightKg || !heightCm || !age || !sex) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === 'male' ? 5 : -161));
}

/** Age in whole years from a birth year, or undefined if there is none. */
export function ageFrom(birthYear: number | undefined, today = new Date()): number | undefined {
  if (!birthYear) return undefined;
  const years = today.getFullYear() - birthYear;
  // A birth year is all the app asks for, so the answer is only ever accurate
  // to a year. Anything outside a plausible human range is bad data, not age.
  return years >= 0 && years < 130 ? years : undefined;
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
