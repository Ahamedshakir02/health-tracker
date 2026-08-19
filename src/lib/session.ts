/**
 * Turning a finished workout into a durable record, and reading it back.
 *
 * The Trainer collects ticks and typed numbers in localStorage (see
 * trainerProgress.ts). Everything here is the pure half: converting that
 * scratch into a `WorkoutSession`, storing it without ever creating a
 * duplicate, and answering the three questions the exercise card asks —
 * what did I lift last time, what is my best, and how is it trending.
 */

import type { PlanDay, Schedule } from '../data/trainingPlan';
import { todayISO } from './dates';
import { movementKey } from './movementKey';
import { parseScheme, type ScratchDay } from './trainerProgress';
import { toCanonical } from './units';
import type {
  ISODate,
  SessionExercise,
  SetLog,
  StrengthSession,
  StretchLog,
  WorkoutEntry,
  WorkoutSession,
} from '../types';

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

/** Timestamps carry characters an id should not. */
function stamp(iso: string): string {
  return iso.replace(/[^0-9]/g, '').slice(0, 14);
}

/**
 * Derived from `startedAt`, which is minted once on the first set tick and then
 * never changes. That is what makes promotion idempotent — finishing the same
 * day twice writes the same id, so the upsert replaces rather than appends.
 */
export function strengthSessionId(scheduleId: number, day: number, startedAt: string): string {
  return `s_${scheduleId}_${day}_${stamp(startedAt)}`;
}

export function mobilitySessionId(routineId: string, startedAt: string): string {
  return `m_${routineId}_${stamp(startedAt)}`;
}

/**
 * Identifies "the same workout" across devices, where the ids cannot match
 * because each device minted its own `startedAt`.
 */
export function dedupeKey(session: WorkoutSession): string {
  return session.kind === 'mobility'
    ? `${session.date}|mobility|${session.routineId}`
    : `${session.date}|strength|${session.scheduleId}:${session.day}`;
}

/** Completed sets across the whole session — the tiebreaker when two collide. */
export function completedSets(session: WorkoutSession): number {
  if (session.kind === 'mobility') return session.moves.length;
  return session.exercises.reduce((n, e) => n + e.sets.length, 0);
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Insert or replace, never blindly append.
 *
 * Three cases, in order: same id wins outright (the same device finishing
 * twice); otherwise same dedupe key keeps whichever record has more completed
 * sets, so a phone that logged eight sets is not clobbered by a laptop that
 * logged one; otherwise append.
 *
 * The trade-off is stated plainly: genuinely training the same schedule day
 * twice on one date collapses to a single record. That is rare, and the
 * alternative — silently keeping both — makes a duplicated sync look like a
 * doubled workout, which is worse.
 */
export function upsertSession(list: WorkoutSession[], next: WorkoutSession): WorkoutSession[] {
  const byId = list.findIndex((s) => s.id === next.id);
  if (byId >= 0) {
    const out = list.slice();
    out[byId] = next;
    return out;
  }
  const key = dedupeKey(next);
  const byKey = list.findIndex((s) => dedupeKey(s) === key);
  if (byKey >= 0) {
    if (completedSets(list[byKey]) > completedSets(next)) return list;
    const out = list.slice();
    out[byKey] = next;
    return out;
  }
  return [...list, next];
}

/** Newest first, by date then by start time within the day. */
export function sortSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt),
  );
}

/* -------------------------------------------------------------------------- */
/* Promotion                                                                   */
/* -------------------------------------------------------------------------- */

/** A blank input means "as prescribed", which is what the book assumes. */
function repsFor(typed: string, planned: number): number {
  const n = Number(typed);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : planned;
}

/** A blank weight is 0 kg, which is a real answer for pullups and dips. */
function weightFor(typed: string, units: ScratchDay['units']): number {
  const n = Number(typed);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return toCanonical('weight', n, units);
}

export interface Promoted {
  session: StrengthSession;
  workout: WorkoutEntry;
}

/**
 * The scratch for one day, as a durable record.
 *
 * Returns null when nothing was ticked — an opened-and-abandoned day is not a
 * workout, and writing one would inflate every weekly count.
 */
export function promote(
  scratch: ScratchDay,
  schedule: Schedule,
  day: PlanDay,
  cooldown: StretchLog[] = [],
  now: Date = new Date(),
): Promoted | null {
  const scheme = parseScheme(day.reps);
  const exercises: SessionExercise[] = [];

  day.sections.forEach((section, sectionIndex) => {
    section.exercises.forEach((exercise) => {
      const entry = scratch.entries[`${sectionIndex}:${exercise.n}`];
      if (!entry) return;
      const sets: SetLog[] = [];
      entry.done.forEach((isDone, i) => {
        if (!isDone) return;
        sets.push({
          index: i + 1,
          reps: repsFor(entry.reps?.[i] ?? '', scheme.reps),
          weightKg: weightFor(entry.weight?.[i] ?? '', scratch.units),
        });
      });
      // Only what actually happened. A planned-but-skipped exercise is absent
      // rather than recorded as a row of zeroes.
      if (!sets.length) return;
      exercises.push({
        key: movementKey(section.name, exercise.name),
        name: exercise.name,
        section: section.name,
        sectionIndex,
        n: exercise.n,
        plannedSets: scheme.sets,
        plannedReps: scheme.reps,
        sets,
      });
    });
  });

  const heldCooldown = cooldown.filter((s) => (scratch.cooldown ?? {})[s.key]);
  if (!exercises.length && !heldCooldown.length) return null;

  const finishedAt = now.toISOString();
  const elapsed = Math.round((now.getTime() - Date.parse(scratch.startedAt)) / 60_000);
  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
  // The stale-day sweep promotes hours or days after the fact, so wall-clock
  // elapsed time is meaningless there. Fall back to a set-count estimate, and
  // clamp both ends so neither path can produce an absurd number.
  const durationMin =
    Number.isFinite(elapsed) && elapsed >= 5 && elapsed <= 240
      ? elapsed
      : Math.min(240, Math.max(5, Math.round(totalSets * 2.5)));

  const id = strengthSessionId(scratch.scheduleId, scratch.day, scratch.startedAt);
  const session: StrengthSession = {
    id,
    kind: 'strength',
    date: scratch.date,
    startedAt: scratch.startedAt,
    finishedAt,
    scheduleId: scratch.scheduleId,
    day: scratch.day,
    focus: day.focus,
    exercises,
    durationMin,
    workoutId: `k_${id}`,
  };
  if (heldCooldown.length) session.cooldown = heldCooldown;

  const plannedSets = day.sections.reduce(
    (n, s) => n + s.exercises.length * scheme.sets,
    0,
  );
  const ratio = plannedSets ? totalSets / plannedSets : 0;

  const workout: WorkoutEntry = {
    id: `k_${id}`,
    date: scratch.date,
    type: 'Strength',
    minutes: durationMin,
    intensity: ratio >= 0.8 ? 'high' : 'moderate',
    note: `${schedule.title} · Day ${day.n} — ${day.focus}`,
    sessionId: id,
  };

  return { session, workout };
}

/* -------------------------------------------------------------------------- */
/* Reading history back                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Epley: an estimate of a one-rep max from a set actually performed.
 *
 * Always presented as an estimate. It is a formula fitted to a population, not
 * a measurement of you, and it drifts badly above about ten reps.
 */
export function epley1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  if (!Number.isFinite(reps) || reps < 1) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Every strength session containing a movement, newest first. */
function sessionsWith(
  sessions: WorkoutSession[],
  movement: string,
): { session: StrengthSession; exercise: SessionExercise }[] {
  const out: { session: StrengthSession; exercise: SessionExercise }[] = [];
  for (const session of sortSessions(sessions)) {
    if (session.kind !== 'strength') continue;
    const exercise = session.exercises.find((e) => e.key === movement);
    if (exercise) out.push({ session, exercise });
  }
  return out;
}

export interface LastPerformance {
  date: ISODate;
  sets: SetLog[];
}

/**
 * What you lifted last time, for the line on the exercise card.
 *
 * `excludeDate` keeps today's in-progress session out of it — "last time"
 * meaning "twenty minutes ago" is useless when you are deciding what to load.
 */
export function lastPerformance(
  sessions: WorkoutSession[],
  movement: string,
  excludeDate: ISODate = todayISO(),
): LastPerformance | null {
  for (const { session, exercise } of sessionsWith(sessions, movement)) {
    if (session.date === excludeDate) continue;
    return { date: session.date, sets: exercise.sets };
  }
  return null;
}

export interface BestSet {
  date: ISODate;
  weightKg: number;
  reps: number;
  est1RM: number;
  /** True when nothing was ever loaded, so the record is a rep count. */
  bodyweight: boolean;
}

/**
 * The best set on record.
 *
 * Ranked by estimated 1RM, except for movements that were never loaded —
 * pullups, dips, bench dips — where every estimate is 0 and the honest record
 * is the rep count instead.
 */
export function bestSet(sessions: WorkoutSession[], movement: string): BestSet | null {
  let best: BestSet | null = null;
  let anyLoaded = false;

  // Oldest first, so a strict ` > ` comparison leaves a tie with the session
  // that set the record rather than the one that most recently matched it.
  const history = sessionsWith(sessions, movement).reverse();

  for (const { session, exercise } of history) {
    for (const set of exercise.sets) {
      if (set.weightKg > 0) anyLoaded = true;
      const est1RM = epley1RM(set.weightKg, set.reps);
      const candidate: BestSet = {
        date: session.date,
        weightKg: set.weightKg,
        reps: set.reps,
        est1RM,
        bodyweight: false,
      };
      if (!best) {
        best = candidate;
        continue;
      }
      const better = est1RM > best.est1RM || (est1RM === best.est1RM && set.reps > best.reps);
      // A tie resolves to the earlier date: the record belongs to whoever set
      // it first, not to whoever most recently matched it.
      if (better) best = candidate;
    }
  }

  if (!best) return null;
  if (anyLoaded) return best;

  // Unloaded movement: re-rank on reps alone.
  let byReps: BestSet | null = null;
  for (const { session, exercise } of history) {
    for (const set of exercise.sets) {
      if (!byReps || set.reps > byReps.reps) {
        byReps = {
          date: session.date,
          weightKg: 0,
          reps: set.reps,
          est1RM: 0,
          bodyweight: true,
        };
      }
    }
  }
  return byReps;
}

export interface ProgressPoint {
  date: ISODate;
  /** Heaviest set that day. */
  topSetKg: number;
  /** Best estimated 1RM that day. */
  est1RM: number;
  /** Sets × reps × kg — the volume figure the charts read. */
  volumeKg: number;
}

/** One point per session, oldest first, for the progression chart. */
export function progression(sessions: WorkoutSession[], movement: string): ProgressPoint[] {
  const points = sessionsWith(sessions, movement).map(({ session, exercise }) => {
    let topSetKg = 0;
    let est1RM = 0;
    let volumeKg = 0;
    for (const set of exercise.sets) {
      topSetKg = Math.max(topSetKg, set.weightKg);
      est1RM = Math.max(est1RM, epley1RM(set.weightKg, set.reps));
      volumeKg += set.weightKg * set.reps;
    }
    return { date: session.date, topSetKg, est1RM, volumeKg };
  });
  return points.reverse();
}

/** "40 kg × 12, 12, 10" — the shape the exercise card prints. */
export function describeSets(sets: SetLog[], unitLabel: string, convert: (kg: number) => number): string {
  if (!sets.length) return '';
  const weights = new Set(sets.map((s) => s.weightKg));
  const reps = sets.map((s) => s.reps).join(', ');
  if (weights.size === 1) {
    const kg = sets[0].weightKg;
    return kg > 0 ? `${convert(kg)} ${unitLabel} × ${reps}` : `${reps} reps`;
  }
  return sets
    .map((s) => (s.weightKg > 0 ? `${convert(s.weightKg)}×${s.reps}` : `${s.reps}`))
    .join(', ');
}
