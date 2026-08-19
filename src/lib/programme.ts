/**
 * Which day of your schedule comes next.
 *
 * The pointer is *derived*, not stored. `Programme` records only which
 * schedule you are working through and when you started it; the day comes from
 * the sessions you have actually logged. That is a deliberate choice over a
 * `nextDay` counter:
 *
 * - Finishing a day advances the rotation as a side effect of saving the
 *   session. One write, not two — and there is no transaction available on the
 *   free tier to keep a counter in step with the history it describes.
 * - It syncs across devices for free: the phone and the laptop read the same
 *   sessions and reach the same answer.
 * - Browsing Schedule 7 out of curiosity cannot disturb it, because browsing
 *   logs nothing.
 * - Deleting a session rewinds the pointer correctly, which a counter would
 *   get wrong.
 *
 * The one thing derivation cannot express is "I know the app thinks I'm on Day
 * 2, but I want Day 4 today". That is what `skipToDay` is for: an explicit
 * override, honoured until a session logged after it supersedes it.
 */

import type { Schedule } from '../data/trainingPlan';
import type { Programme, StrengthSession, WorkoutSession } from '../types';

/** Strength sessions belonging to a schedule, newest first. */
function sessionsFor(sessions: WorkoutSession[], scheduleId: number): StrengthSession[] {
  return sessions
    .filter((s): s is StrengthSession => s.kind === 'strength' && s.scheduleId === scheduleId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * The most recent day logged against this programme, or null.
 *
 * Sessions started before the programme did are ignored — restarting a
 * schedule from the top has to mean something, otherwise "start again" would
 * silently resume where the last attempt left off.
 */
export function lastLogged(
  sessions: WorkoutSession[],
  programme: Programme,
): StrengthSession | null {
  for (const s of sessionsFor(sessions, programme.scheduleId)) {
    if (s.startedAt >= programme.startedAt) return s;
  }
  return null;
}

/**
 * The day to open on.
 *
 * Read the rotation from `schedule.days` by index rather than doing arithmetic
 * on `d.n`: schedules run 2, 3 and 4 days long, and `n` is the book's own
 * numbering, which is not guaranteed to be a dense 1..n range.
 */
export function nextDay(
  schedule: Schedule,
  sessions: WorkoutSession[],
  programme: Programme | undefined,
): number {
  const first = schedule.days[0]?.n ?? 1;
  if (!programme || programme.scheduleId !== schedule.id) return first;

  const last = lastLogged(sessions, programme);

  // An explicit skip wins until something is logged after it was set.
  if (programme.skipToDay !== undefined) {
    const newerSession = last && programme.skipSetAt && last.startedAt > programme.skipSetAt;
    if (!newerSession && schedule.days.some((d) => d.n === programme.skipToDay)) {
      return programme.skipToDay;
    }
  }

  if (!last) return first;

  const i = schedule.days.findIndex((d) => d.n === last.day);
  if (i < 0) return first;
  return schedule.days[(i + 1) % schedule.days.length]?.n ?? first;
}

/** Sessions logged against this programme since it started. */
export function sessionsLogged(sessions: WorkoutSession[], programme: Programme): number {
  return sessionsFor(sessions, programme.scheduleId).filter(
    (s) => s.startedAt >= programme.startedAt,
  ).length;
}

/** Where you are in the current lap: 1-based position of `day` in the rotation. */
export function rotationPosition(schedule: Schedule, day: number): number {
  const i = schedule.days.findIndex((d) => d.n === day);
  return i < 0 ? 1 : i + 1;
}

export function startProgramme(scheduleId: number, now: Date = new Date()): Programme {
  return { scheduleId, startedAt: now.toISOString() };
}

/**
 * Pin the programme to a specific day.
 *
 * Stamped with the moment it was set so the next logged session can outrank
 * it — without the stamp a skip would be sticky forever and the rotation would
 * never move again.
 */
export function skipTo(programme: Programme, day: number, now: Date = new Date()): Programme {
  return { ...programme, skipToDay: day, skipSetAt: now.toISOString() };
}
