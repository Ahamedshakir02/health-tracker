import type { HealthData, ISODate, Intensity, WorkoutEntry } from '../types';
import { addDays, daysBetween, parseISO, todayISO } from './dates';
import { dayLog, latestWeight, meanOf, sortByDateDesc } from './calc';

/**
 * A training plan generated from what the user has actually logged.
 *
 * Everything here is deterministic and runs offline. That is a deliberate
 * choice, not a limitation: this is a static site, so any model API key would
 * be inlined into the bundle and readable by anyone who opened devtools. A
 * plan built from real logged history is also more use than one built from a
 * paragraph of self-description.
 *
 * The prescriptions follow ordinary training practice — roughly 10% weekly
 * volume progression, a lighter fourth week, hard days separated by easy ones,
 * protein scaled to bodyweight. It is general fitness guidance, not medical
 * advice, and the UI says so.
 */

export type SessionFocus =
  | 'push'
  | 'pull'
  | 'legs'
  | 'upper'
  | 'lower'
  | 'full'
  | 'intervals'
  | 'steady'
  | 'mobility';

export type Verdict = 'push' | 'steady' | 'hold' | 'deload';
export type Phase = 'build' | 'maintain' | 'deload';
export type Direction = 'lose' | 'maintain' | 'gain';

export interface PlannedBlock {
  label: string;
  detail: string;
}

export interface PlannedSession {
  date: ISODate;
  focus: SessionFocus;
  title: string;
  minutes: number;
  intensity: Intensity;
  /** Matches a `WorkoutEntry.type` so a finished session can be logged in one click. */
  logAs: string;
  blocks: PlannedBlock[];
}

export interface ReadinessSignal {
  label: string;
  detail: string;
  status: 'good' | 'warning' | 'serious';
}

export interface Readiness {
  /** 0–100. Built only from the signals that have data behind them. */
  score: number;
  verdict: Verdict;
  signals: ReadinessSignal[];
  /** True when too little is logged for the score to mean much. */
  provisional: boolean;
}

export interface TrainingPlan {
  weekStart: ISODate;
  phase: Phase;
  direction: Direction;
  readiness: Readiness;
  sessions: PlannedSession[];
  restDays: ISODate[];
  plannedMinutes: number;
  /** Mean weekly training minutes over the last 4 weeks. */
  baselineMinutes: number;
  headline: string;
  nutrition: {
    calories: number;
    proteinG: number;
    note: string;
  };
}

// --- history -----------------------------------------------------------------

interface History {
  sessionsPerWeek: number;
  weeklyMinutes: number;
  hardDaysLast3: number;
  consecutiveTrainingDays: number;
  weeksTraining: number;
  favouriteTypes: string[];
}

const HARD: Intensity = 'high';

function workoutsBetween(workouts: WorkoutEntry[], from: ISODate, to: ISODate): WorkoutEntry[] {
  return workouts.filter((w) => w.date >= from && w.date <= to);
}

function readHistory(data: HealthData, today: ISODate): History {
  const fourWeeksAgo = addDays(today, -27);
  const recent = workoutsBetween(data.workouts, fourWeeksAgo, today);
  const minutes = recent.reduce((s, w) => s + (w.minutes || 0), 0);

  const hardDaysLast3 = new Set(
    workoutsBetween(data.workouts, addDays(today, -2), today)
      .filter((w) => w.intensity === HARD)
      .map((w) => w.date),
  ).size;

  // How many days in a row up to today have a session on them.
  const trained = new Set(data.workouts.map((w) => w.date));
  let consecutive = 0;
  let cursor = today;
  while (trained.has(cursor)) {
    consecutive += 1;
    cursor = addDays(cursor, -1);
  }

  const first = [...data.workouts].sort((a, b) => a.date.localeCompare(b.date))[0];
  const weeksTraining = first ? Math.max(1, Math.ceil(daysBetween(first.date, today) / 7)) : 0;

  const counts = new Map<string, number>();
  for (const w of recent) counts.set(w.type, (counts.get(w.type) ?? 0) + 1);
  const favouriteTypes = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);

  return {
    sessionsPerWeek: recent.length / 4,
    weeklyMinutes: minutes / 4,
    hardDaysLast3,
    consecutiveTrainingDays: consecutive,
    weeksTraining,
    favouriteTypes,
  };
}

// --- readiness ---------------------------------------------------------------

/** Each signal contributes its weight scaled by a 0–1 quality, or abstains. */
interface Contribution {
  weight: number;
  quality: number;
  signal: ReadinessSignal;
}

function sleepSignal(data: HealthData, today: ISODate, goalHours: number): Contribution | null {
  const week = Array.from({ length: 7 }, (_, i) => dayLog(data.days, addDays(today, -i)));
  const mean = meanOf(week, (d) => d.sleepHours ?? null);
  if (mean == null || goalHours <= 0) return null;

  const ratio = Math.min(1.1, mean / goalHours);
  const quality = Math.max(0, Math.min(1, (ratio - 0.6) / 0.4));
  return {
    weight: 35,
    quality,
    signal: {
      label: 'Sleep',
      detail: `${mean.toFixed(1)} h average over 7 days against a ${goalHours} h target.`,
      status: ratio >= 0.9 ? 'good' : ratio >= 0.75 ? 'warning' : 'serious',
    },
  };
}

function freshnessSignal(history: History): Contribution {
  const { hardDaysLast3, consecutiveTrainingDays } = history;
  // Two hard days inside 72 hours, or four days on the trot, is a fatigue flag.
  const penalty = Math.min(1, hardDaysLast3 / 2) * 0.6 + Math.min(1, consecutiveTrainingDays / 4) * 0.4;
  const quality = 1 - penalty;
  return {
    weight: 25,
    quality,
    signal: {
      label: 'Freshness',
      detail:
        consecutiveTrainingDays > 0
          ? `${consecutiveTrainingDays} day${consecutiveTrainingDays === 1 ? '' : 's'} trained in a row, ${hardDaysLast3} hard in the last 3.`
          : 'Rested — no session logged yet today or yesterday.',
      status: quality >= 0.7 ? 'good' : quality >= 0.4 ? 'warning' : 'serious',
    },
  };
}

function heartRateSignal(data: HealthData, today: ISODate): Contribution | null {
  const recent = Array.from({ length: 3 }, (_, i) => dayLog(data.days, addDays(today, -i)));
  const baseline = Array.from({ length: 28 }, (_, i) => dayLog(data.days, addDays(today, -i - 3)));
  const now = meanOf(recent, (d) => d.restingHr ?? null);
  const base = meanOf(baseline, (d) => d.restingHr ?? null);
  if (now == null || base == null || base <= 0) return null;

  // A resting heart rate 5+ bpm above your own baseline is the classic
  // under-recovery signal. Below baseline is good but not extra credit.
  const delta = now - base;
  const quality = Math.max(0, Math.min(1, 1 - Math.max(0, delta) / 8));
  return {
    weight: 20,
    quality,
    signal: {
      label: 'Resting heart rate',
      detail:
        delta >= 0
          ? `${now.toFixed(0)} bpm, ${delta.toFixed(0)} above your 4-week baseline.`
          : `${now.toFixed(0)} bpm, ${Math.abs(delta).toFixed(0)} below your 4-week baseline.`,
      status: delta < 3 ? 'good' : delta < 6 ? 'warning' : 'serious',
    },
  };
}

function consistencySignal(history: History, target: number): Contribution | null {
  if (history.weeksTraining === 0) return null;
  const ratio = target > 0 ? Math.min(1.2, history.sessionsPerWeek / target) : 1;
  return {
    weight: 20,
    quality: Math.max(0, Math.min(1, ratio / 1.0)),
    signal: {
      label: 'Consistency',
      detail: `${history.sessionsPerWeek.toFixed(1)} sessions a week over the last month against a target of ${target}.`,
      status: ratio >= 0.85 ? 'good' : ratio >= 0.5 ? 'warning' : 'serious',
    },
  };
}

function assessReadiness(data: HealthData, today: ISODate, history: History): Readiness {
  const { sleepHours, workoutsPerWeek } = data.settings.goals;
  const contributions = [
    sleepSignal(data, today, sleepHours),
    freshnessSignal(history),
    heartRateSignal(data, today),
    consistencySignal(history, workoutsPerWeek),
  ].filter((c): c is Contribution => c !== null);

  // Normalise over the signals that actually reported, so a user who never logs
  // resting heart rate is not permanently capped at 80.
  const totalWeight = contributions.reduce((s, c) => s + c.weight, 0);
  const earned = contributions.reduce((s, c) => s + c.weight * c.quality, 0);
  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 60;

  const verdict: Verdict =
    score >= 80 ? 'push' : score >= 60 ? 'steady' : score >= 40 ? 'hold' : 'deload';

  return {
    score,
    verdict,
    signals: contributions.map((c) => c.signal),
    provisional: totalWeight < 60,
  };
}

// --- plan --------------------------------------------------------------------

function direction(data: HealthData): Direction {
  const goal = data.settings.goals.weightKg;
  const current = latestWeight(data.weights)?.weightKg;
  if (goal == null || current == null) return 'maintain';
  const gap = current - goal;
  if (gap > 1) return 'lose';
  if (gap < -1) return 'gain';
  return 'maintain';
}

/** Which weekdays carry sessions, chosen so hard days are not stacked. */
const DAY_PATTERN: Record<number, number[]> = {
  0: [],
  1: [2],
  2: [1, 4],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Focus rotations, biased by goal: cutting leans on conditioning, gaining on lifting. */
function focusOrder(count: number, dir: Direction): SessionFocus[] {
  const strength: SessionFocus[][] = [
    [],
    ['full'],
    ['upper', 'lower'],
    ['push', 'pull', 'legs'],
    ['upper', 'lower', 'push', 'legs'],
    ['push', 'pull', 'legs', 'upper', 'lower'],
    ['push', 'pull', 'legs', 'upper', 'lower', 'full'],
    ['push', 'pull', 'legs', 'upper', 'lower', 'full', 'mobility'],
  ];
  const base = [...(strength[Math.min(count, 7)] ?? [])];
  if (base.length === 0) return [];

  if (dir === 'lose') {
    // Swap the last one or two strength days for conditioning.
    if (base.length >= 3) base[base.length - 1] = 'intervals';
    if (base.length >= 5) base[base.length - 2] = 'steady';
  } else if (dir === 'maintain' && base.length >= 4) {
    base[base.length - 1] = 'intervals';
  } else if (dir === 'gain' && base.length >= 5) {
    base[base.length - 1] = 'steady';
  }
  return base;
}

const TITLES: Record<SessionFocus, string> = {
  push: 'Push — chest, shoulders, triceps',
  pull: 'Pull — back and biceps',
  legs: 'Legs and posterior chain',
  upper: 'Upper body',
  lower: 'Lower body',
  full: 'Full body',
  intervals: 'Intervals',
  steady: 'Easy steady cardio',
  mobility: 'Mobility and core',
};

const LOG_AS: Record<SessionFocus, string> = {
  push: 'Strength',
  pull: 'Strength',
  legs: 'Strength',
  upper: 'Strength',
  lower: 'Strength',
  full: 'Strength',
  intervals: 'HIIT',
  steady: 'Walk',
  mobility: 'Yoga',
};

const INTENSITY: Record<SessionFocus, Intensity> = {
  push: 'moderate',
  pull: 'moderate',
  legs: 'high',
  upper: 'moderate',
  lower: 'high',
  full: 'moderate',
  intervals: 'high',
  steady: 'low',
  mobility: 'low',
};

/**
 * `sets` scales with the phase, so a deload week is the same movements at
 * reduced volume rather than a different plan the user has to relearn.
 */
function blocksFor(focus: SessionFocus, phase: Phase, minutes: number): PlannedBlock[] {
  const sets = phase === 'deload' ? 2 : phase === 'build' ? 4 : 3;
  const reps = focus === 'legs' || focus === 'lower' ? '6–8' : '8–12';
  const warmup = {
    label: 'Warm-up · 8 min',
    detail:
      focus === 'intervals' || focus === 'steady'
        ? 'Easy pace, building to conversational by the last two minutes.'
        : 'Five minutes easy cardio, then leg swings, arm circles and two light sets of the first movement.',
  };
  const cooldown = {
    label: 'Cool-down · 5 min',
    detail: 'Easy walking until your breathing settles, then hold the tightest two stretches for 45 s each.',
  };

  const main: Record<SessionFocus, PlannedBlock> = {
    push: {
      label: `Main · ${sets} sets`,
      detail: `Bench or push-up ${sets}×${reps}, overhead press ${sets}×${reps}, incline or dip ${sets - 1}×${reps}, triceps finisher 2×12–15. Leave 2 reps in reserve on every set.`,
    },
    pull: {
      label: `Main · ${sets} sets`,
      detail: `Row ${sets}×${reps}, pull-up or lat pulldown ${sets}×${reps}, face pull 3×15, curl 2×12. Pause a beat at the top of each row.`,
    },
    legs: {
      label: `Main · ${sets} sets`,
      detail: `Squat ${sets}×${reps}, Romanian deadlift ${sets}×${reps}, split squat ${sets - 1}×10 each side, calf raise 3×15.`,
    },
    upper: {
      label: `Main · ${sets} sets`,
      detail: `Press ${sets}×${reps}, row ${sets}×${reps}, overhead press ${sets - 1}×${reps}, lat pulldown ${sets - 1}×${reps}, arms 2×12.`,
    },
    lower: {
      label: `Main · ${sets} sets`,
      detail: `Squat ${sets}×${reps}, hip hinge ${sets}×${reps}, lunge ${sets - 1}×10 each side, core 3×30 s.`,
    },
    full: {
      label: `Main · ${sets} sets`,
      detail: `Squat ${sets}×${reps}, press ${sets}×${reps}, row ${sets}×${reps}, hinge ${sets - 1}×${reps}, plank 3×40 s.`,
    },
    intervals: {
      label: 'Main · intervals',
      detail:
        phase === 'deload'
          ? '5 × 45 s hard with 2 min easy between. Stop while it still feels repeatable.'
          : '8 × 60 s hard with 90 s easy between. Same pace on the last rep as the first — that is the test.',
    },
    steady: {
      label: `Main · ${Math.max(20, minutes - 13)} min`,
      detail: 'Conversational pace throughout. If you cannot speak a full sentence, slow down.',
    },
    mobility: {
      label: 'Main · circuit',
      detail: '3 rounds: 90/90 hip switch ×8, thoracic opener ×8, dead bug ×10 each, side plank 30 s each.',
    },
  };

  return [warmup, main[focus], cooldown];
}

/** Monday of the week containing `date`. */
export function weekStartOf(date: ISODate): ISODate {
  const jsDay = parseISO(date).getDay(); // 0 = Sunday
  return addDays(date, jsDay === 0 ? -6 : 1 - jsDay);
}

export function buildPlan(data: HealthData, today: ISODate = todayISO()): TrainingPlan {
  const history = readHistory(data, today);
  const readiness = assessReadiness(data, today, history);
  const dir = direction(data);
  const target = data.settings.goals.workoutsPerWeek;

  // Every fourth week is lighter by design; a poor readiness score pulls one
  // forward. `weeksTraining` starts at 1, so week 4 is the first deload.
  const scheduledDeload = history.weeksTraining > 0 && history.weeksTraining % 4 === 0;
  const phase: Phase =
    readiness.verdict === 'deload' || scheduledDeload
      ? 'deload'
      : readiness.verdict === 'push'
        ? 'build'
        : 'maintain';

  // Session count: the goal, trimmed when the body is asking for less.
  const trim = phase === 'deload' ? 2 : readiness.verdict === 'hold' ? 1 : 0;
  const count = Math.max(0, Math.min(7, target - trim));

  const order = focusOrder(count, dir);
  const days = DAY_PATTERN[count] ?? [];
  const weekStart = weekStartOf(today);

  // Volume: hold to roughly a 10% weekly step up, and never prescribe a jump
  // from nothing to an hour a day.
  const baseline = history.weeklyMinutes;
  const ceiling = baseline > 0 ? baseline * 1.1 : 150;
  const floor = phase === 'deload' ? 0 : 90;
  const weekly = Math.max(floor, Math.min(phase === 'deload' ? baseline * 0.6 : ceiling, 480));
  const perSession = count > 0 ? Math.round(Math.max(20, Math.min(75, weekly / count)) / 5) * 5 : 0;

  // Being told to hold back and then handed a hard interval session is a
  // contradiction the user would rightly ignore. Cap intensity whenever the
  // recovery signals are not asking for more.
  const softenHardDays = phase === 'deload' || readiness.verdict === 'hold';

  const sessions: PlannedSession[] = order.map((focus, i) => ({
    date: addDays(weekStart, days[i]),
    focus,
    title: TITLES[focus],
    minutes: focus === 'mobility' ? Math.min(perSession, 30) : perSession,
    intensity: softenHardDays && INTENSITY[focus] === 'high' ? 'moderate' : INTENSITY[focus],
    logAs: LOG_AS[focus],
    blocks: blocksFor(focus, phase, perSession),
  }));

  const scheduled = new Set(sessions.map((s) => s.date));
  const restDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(
    (d) => !scheduled.has(d),
  );

  return {
    weekStart,
    phase,
    direction: dir,
    readiness,
    sessions,
    restDays,
    plannedMinutes: sessions.reduce((s, x) => s + x.minutes, 0),
    baselineMinutes: Math.round(baseline),
    headline: headlineFor(phase, readiness.verdict, dir, history),
    nutrition: nutritionFor(data, dir, phase),
  };
}

function headlineFor(phase: Phase, verdict: Verdict, dir: Direction, history: History): string {
  if (history.weeksTraining === 0) {
    return 'Nothing logged yet, so this is a starting week: three easy sessions to set a baseline. Log them and next week adapts to what you actually did.';
  }
  if (phase === 'deload') {
    return verdict === 'deload'
      ? 'Your recovery signals are low, so this week pulls the volume back deliberately. Backing off now costs you one week; training through it costs a month.'
      : 'Scheduled lighter week — the fourth in a block. Same movements, less of them.';
  }
  if (phase === 'build') {
    return dir === 'lose'
      ? 'Recovery looks good, so volume steps up about 10%, with conditioning carrying the extra load and lifting protecting the muscle you already have.'
      : 'Recovery looks good, so volume steps up about 10%. Add load before you add reps.';
  }
  return 'Holding volume steady this week. Consistency at this level beats a bigger week you have to recover from.';
}

function nutritionFor(
  data: HealthData,
  dir: Direction,
  phase: Phase,
): TrainingPlan['nutrition'] {
  const goals = data.settings.goals;
  const weight = latestWeight(data.weights)?.weightKg;

  // 1.6 g/kg is the commonly cited floor for preserving muscle; nudge up while
  // in a deficit, where protein matters most.
  const perKg = dir === 'lose' ? 2.0 : dir === 'gain' ? 1.8 : 1.6;
  const proteinG = weight ? Math.round(weight * perKg) : goals.proteinG;

  const calories = goals.calories;
  const note =
    dir === 'lose'
      ? `Aim for about ${proteinG} g of protein — in a deficit that is what decides whether the weight you lose is fat or muscle. Keep the deficit small enough that training quality holds up.`
      : dir === 'gain'
        ? `About ${proteinG} g of protein and a modest surplus. Faster weight gain is mostly not muscle.`
        : `About ${proteinG} g of protein, calories around maintenance.${phase === 'deload' ? ' Do not cut further during a deload week — recovery is the point.' : ''}`;

  return { calories, proteinG, note };
}

/** A planned session turned into a loggable entry, for the one-click "did it" button. */
export function sessionToWorkout(session: PlannedSession, date: ISODate): Omit<WorkoutEntry, 'id'> {
  return {
    date,
    type: session.logAs,
    minutes: session.minutes,
    intensity: session.intensity,
    note: session.title,
  };
}

/** The last few sessions, newest first — shown next to the plan for context. */
export function recentSessions(data: HealthData, limit = 5): WorkoutEntry[] {
  return sortByDateDesc(data.workouts).slice(0, limit);
}
