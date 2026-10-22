/**
 * What the numbers mean for the person they belong to.
 *
 * Everything in calc.ts is arithmetic on what was logged. This file is the
 * step after that: turning a reading into a suggestion or a flag. It is kept
 * separate because every function here encodes a piece of general
 * public-health guidance rather than a fact about the data, and those are the
 * lines someone will want to find, question and change.
 *
 * Three rules hold throughout:
 *
 * - Suggest, never set. Nothing here writes a target; the screens offer the
 *   figure and the person presses the button or does not.
 * - Return null when an input is missing rather than assuming one, for the
 *   same reason bmr() does.
 * - These are population rules of thumb. They are not a diagnosis and the app
 *   says so wherever one is shown.
 */

import { addDays, daysBetween, todayISO } from './dates';
import type { ISODate, Sex, WeightEntry } from '../types';

/** Which way the goal weight is from here. */
export type Direction = 'lose' | 'gain' | 'hold';

/** Closer than this to the goal counts as being there. Scales read ±1 kg of water. */
const AT_GOAL_KG = 1;

export function weightDirection(weightKg?: number, goalKg?: number): Direction | null {
  if (!weightKg || !goalKg) return null;
  const gap = goalKg - weightKg;
  if (Math.abs(gap) < AT_GOAL_KG) return 'hold';
  return gap < 0 ? 'lose' : 'gain';
}

/**
 * Whether a change in weight is the change that was wanted.
 *
 * The app used to paint every loss green and every gain red, which is only
 * right for someone trying to lose. For someone underweight, or bulking, it
 * was congratulating them on the wrong thing. With no goal set there is no
 * verdict to give, and the screens show the number without a colour.
 */
export function changeVerdict(
  deltaKg: number,
  direction: Direction | null,
): 'toward' | 'away' | 'flat' | null {
  if (!direction) return null;
  // Under 50 g is the scale, not the person.
  if (Math.abs(deltaKg) < 0.05) return 'flat';
  if (direction === 'hold') return Math.abs(deltaKg) < AT_GOAL_KG ? 'flat' : 'away';
  return (direction === 'lose') === deltaKg < 0 ? 'toward' : 'away';
}

/**
 * The multiplier that turns resting burn into a day's burn.
 *
 * The standard activity factors, picked from how many sessions a week are
 * planned. The app has no other measure of how active someone is, and the
 * honest alternative to this was asking a question nobody answers accurately.
 */
export function activityFactor(workoutsPerWeek: number): number {
  if (workoutsPerWeek >= 6) return 1.725;
  if (workoutsPerWeek >= 3) return 1.55;
  if (workoutsPerWeek >= 1) return 1.375;
  return 1.2;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** Men are generally advised not to go under this without supervision. */
const FLOOR_MALE = 1500;
/** And women this. */
const FLOOR_FEMALE = 1200;

/** The lowest daily intake it is reasonable to aim for unsupervised. */
export function calorieFloor(sex?: Sex): number {
  return sex === 'male' ? FLOOR_MALE : FLOOR_FEMALE;
}

export interface CalorieSuggestion {
  /** Estimated intake that holds weight steady. */
  maintenance: number;
  /** Suggested daily target for the direction the goal points. */
  target: number;
  direction: Direction;
}

/**
 * A calorie target built from the person rather than a default.
 *
 * Maintenance is resting burn times the activity factor. From there: 500 kcal
 * under to lose, which is roughly half a kilo a week; 300 over to gain, which
 * is slow enough to be mostly muscle if the training is there; or level. The
 * loss figure never drops below the floor for the person's sex, because a
 * target that low is a clinical decision and not one for an app to hand out.
 *
 * Rounded to 50 so it reads as the estimate it is.
 */
export function suggestCalories(input: {
  bmr: number | null;
  workoutsPerWeek: number;
  direction: Direction | null;
  sex?: Sex;
}): CalorieSuggestion | null {
  if (!input.bmr) return null;
  const maintenance = roundTo(input.bmr * activityFactor(input.workoutsPerWeek), 50);
  return suggestFromMaintenance(maintenance, input.direction, input.sex);
}

/** The step from a maintenance figure to a target, shared by both estimates. */
function suggestFromMaintenance(
  maintenance: number,
  direction: Direction | null,
  sex?: Sex,
): CalorieSuggestion {
  const dir = direction ?? 'hold';
  const raw = dir === 'lose' ? maintenance - 500 : dir === 'gain' ? maintenance + 300 : maintenance;
  return { maintenance, target: Math.max(raw, calorieFloor(sex)), direction: dir };
}

/** Roughly the energy in a kilo of body weight. The usual figure, and only a rule of thumb. */
const KCAL_PER_KG = 7700;
/** How far back the logged estimate looks. Four weeks smooths out a bad week. */
const ADAPTIVE_WINDOW_DAYS = 28;
/** Fewer logged food days than this and the average intake is mostly luck. */
const ADAPTIVE_MIN_FOOD_DAYS = 14;
/** Weigh-ins must span at least this long, or water swings swamp the trend. */
const ADAPTIVE_MIN_SPAN_DAYS = 14;
const ADAPTIVE_MIN_WEIGH_INS = 3;

export interface AdaptiveEstimate extends CalorieSuggestion {
  /** Mean intake on the days food was logged. */
  avgIntake: number;
  /** Weight trend over the window, kg per week (negative is a loss). */
  kgPerWeek: number;
  foodDays: number;
  weighIns: number;
}

/**
 * Maintenance calories worked out from what was eaten and what the scale did.
 *
 * If you ate 2 300 a day on average and lost 0.25 kg a week, you burned about
 * 2 300 + 0.25 × 7 700 / 7 ≈ 2 575. After a few weeks of logging this beats any
 * formula, because it is measured on the person rather than predicted for
 * them. It assumes the days that were logged were logged in full; a day with
 * one snack on it drags the average down, which is why the screen says so.
 *
 * The window ends yesterday — today's log is still being written. The weight
 * trend is a least-squares line through every weigh-in in the window, not the
 * first and last reading, so one salty dinner cannot swing it.
 *
 * Null until there is enough to go on, and null if the answer is implausible
 * (under 1 000 or over 6 000), which almost always means partial logging.
 */
export function adaptiveMaintenance(input: {
  meals: { date: ISODate; calories: number }[];
  weights: WeightEntry[];
  direction: Direction | null;
  sex?: Sex;
  today?: ISODate;
}): AdaptiveEstimate | null {
  const today = input.today ?? todayISO();
  const from = addDays(today, -ADAPTIVE_WINDOW_DAYS);
  const inWindow = (date: ISODate) => date >= from && date < today;

  const perDay = new Map<ISODate, number>();
  for (const meal of input.meals) {
    if (!inWindow(meal.date)) continue;
    perDay.set(meal.date, (perDay.get(meal.date) ?? 0) + (meal.calories || 0));
  }
  const foodDays = [...perDay.values()].filter((kcal) => kcal > 0);
  if (foodDays.length < ADAPTIVE_MIN_FOOD_DAYS) return null;
  const avgIntake = foodDays.reduce((a, b) => a + b, 0) / foodDays.length;

  const points = input.weights
    .filter((w) => inWindow(w.date))
    .map((w) => ({ x: daysBetween(from, w.date), y: w.weightKg }));
  if (points.length < ADAPTIVE_MIN_WEIGH_INS) return null;
  const xs = points.map((p) => p.x);
  if (Math.max(...xs) - Math.min(...xs) < ADAPTIVE_MIN_SPAN_DAYS) return null;
  const kgPerDay = slope(points);

  const raw = avgIntake - kgPerDay * KCAL_PER_KG;
  if (raw < 1_000 || raw > 6_000) return null;
  const maintenance = roundTo(raw, 50);
  return {
    ...suggestFromMaintenance(maintenance, input.direction, input.sex),
    avgIntake: Math.round(avgIntake),
    kgPerWeek: Math.round(kgPerDay * 7 * 100) / 100,
    foodDays: foodDays.length,
    weighIns: points.length,
  };
}

/** Least-squares slope. Callers guarantee at least two distinct x values. */
function slope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Daily protein, in grams, for someone who trains.
 *
 * 0.8 g per kg is the figure for not being deficient. The range sports
 * nutrition bodies give for people doing resistance work is 1.2 to 2.0, and
 * 1.6 is where the extra stops buying much. This is a gym app, so that range
 * is the one offered.
 */
export function proteinRange(
  weightKg?: number,
): { low: number; suggested: number; high: number } | null {
  if (!weightKg) return null;
  return {
    low: roundTo(weightKg * 1.2, 5),
    suggested: roundTo(weightKg * 1.6, 5),
    high: roundTo(weightKg * 2.0, 5),
  };
}

/**
 * Kilograms a week, over the readings in the last `days`.
 *
 * Null unless the readings span at least a fortnight: a week of scale weight
 * is mostly water, and a rate drawn from it would be noise with a unit.
 */
export function weeklyRate(
  weights: WeightEntry[],
  days = 30,
  today: ISODate = todayISO(),
): number | null {
  const since = addDays(today, -days);
  const window = [...weights]
    .filter((w) => w.date >= since && w.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (window.length < 2) return null;
  const first = window[0];
  const last = window[window.length - 1];
  const span = daysBetween(first.date, last.date);
  if (Math.abs(span) < 14) return null;
  return ((last.weightKg - first.weightKg) / Math.abs(span)) * 7;
}

/**
 * Whether weight is moving faster than is generally advised.
 *
 * The usual guidance is half a kilo to a kilo a week. Beyond one percent of
 * body weight a week, more of what goes is muscle and water, and it tends not
 * to stay off. The same rate upward is mostly fat however hard the training.
 */
export function paceFlag(
  ratePerWeekKg: number | null,
  weightKg?: number,
): 'fast-loss' | 'fast-gain' | null {
  if (ratePerWeekKg == null || !weightKg) return null;
  const limit = weightKg * 0.01;
  if (ratePerWeekKg < -limit) return 'fast-loss';
  if (ratePerWeekKg > limit) return 'fast-gain';
  return null;
}

export function waistToHeight(waistCm?: number, heightCm?: number): number | null {
  if (!waistCm || !heightCm) return null;
  return waistCm / heightCm;
}

/**
 * Bands for waist-to-height ratio: keep your waist under half your height.
 *
 * It sits beside BMI because BMI cannot tell muscle from fat, and the people
 * using a lifting log are exactly the ones it misjudges. Where the weight is
 * carried says more than how much there is.
 */
export function waistToHeightBand(ratio: number): {
  label: string;
  status: 'good' | 'warning' | 'serious';
} {
  if (ratio < 0.4) return { label: 'Low', status: 'warning' };
  if (ratio < 0.5) return { label: 'Healthy range', status: 'good' };
  if (ratio < 0.6) return { label: 'Increased', status: 'warning' };
  return { label: 'High', status: 'serious' };
}
