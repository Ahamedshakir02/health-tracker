/**
 * Matching stretches to what you just trained.
 *
 * Deterministic on purpose: the same training day always produces the same
 * cool-down. Random selection would be untestable, and in the gym it reads as
 * arbitrary — you cannot learn a routine that changes every time you open it.
 */

import type { PlanDay } from '../data/trainingPlan';
import { ROUTINES, STRETCHES, stretchById, type MobilityArea, type MobilityRoutine, type Stretch } from '../data/mobility';
import { mobilitySessionId } from './session';
import { todayISO } from './dates';
import type { MobilitySession, StretchLog, WorkoutEntry } from '../types';

/**
 * The book's muscle-group headings → the areas they leave tight.
 *
 * Keyed by the exact section names in trainingPlan.ts. `sectionAreas` upper-
 * cases and trims before looking up, so a stray space in the parsed .docx does
 * not silently drop a section's cool-down.
 */
const SECTION_AREAS: Record<string, MobilityArea[]> = {
  CHEST: ['chest', 'shoulders'],
  'WINGS / BACK': ['back', 'shoulders'],
  BICEPS: ['arms'],
  TRICEPS: ['arms', 'shoulders'],
  SHOULDER: ['shoulders', 'neck'],
  FOREARMS: ['arms'],
  LEGS: ['quads', 'hamstrings', 'hips', 'calves'],
};

/** Padding for a day that maps to very little. Never empty-handed. */
const FALLBACK: MobilityArea[] = ['back', 'hips', 'shoulders', 'core'];

const MIN = 4;
const MAX = 6;

export function sectionAreas(section: string): MobilityArea[] {
  return SECTION_AREAS[section.trim().toUpperCase()] ?? [];
}

/** Areas a day works, in the order the day works them. First listed, first out. */
export function areasForDay(day: PlanDay): MobilityArea[] {
  const seen = new Set<MobilityArea>();
  const out: MobilityArea[] = [];
  for (const section of day.sections) {
    for (const area of sectionAreas(section.name)) {
      if (seen.has(area)) continue;
      seen.add(area);
      out.push(area);
    }
  }
  return out;
}

/** The first stretch listed for an area. Stable because STRETCHES is authored in order. */
function firstFor(area: MobilityArea, taken: Set<string>): Stretch | null {
  return STRETCHES.find((s) => s.area === area && !taken.has(s.id)) ?? null;
}

/**
 * Four to six stretches for a training day.
 *
 * One per area first, so a chest-and-triceps day does not spend all six on the
 * shoulders. Only once every area has one does it double up, and it pads from
 * a general list rather than returning two stretches for a day that maps
 * narrowly.
 */
export function cooldownFor(day: PlanDay): Stretch[] {
  const taken = new Set<string>();
  const out: Stretch[] = [];

  const push = (s: Stretch | null) => {
    if (!s || taken.has(s.id) || out.length >= MAX) return;
    taken.add(s.id);
    out.push(s);
  };

  const areas = areasForDay(day);
  for (const area of areas) push(firstFor(area, taken));
  // A second pass over the same areas, in the same order, before reaching for
  // anything generic — what you trained still deserves the attention.
  for (const area of areas) {
    if (out.length >= MIN) break;
    push(firstFor(area, taken));
  }
  for (const area of FALLBACK) {
    if (out.length >= MIN) break;
    push(firstFor(area, taken));
  }
  return out;
}

/** Routines whose areas overlap what the day trained, best match first. */
export function routinesForDay(day: PlanDay): MobilityRoutine[] {
  const areas = new Set(areasForDay(day));
  return ROUTINES.map((r) => ({ r, hits: r.areas.filter((a) => areas.has(a)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.r.id.localeCompare(b.r.id))
    .map((x) => x.r);
}

export function toLog(stretch: Stretch): StretchLog {
  return { key: stretch.id, name: stretch.name, seconds: stretch.holdSeconds };
}

export interface PromotedMobility {
  session: MobilitySession;
  workout: WorkoutEntry;
}

/**
 * A finished routine, as a record.
 *
 * Same contract as `promote` in lib/session.ts: the id is derived from when it
 * started, so pressing "Log this" twice upserts one record rather than two.
 * Returns null when nothing was held — opening a routine is not doing it.
 */
export function promoteMobility(
  routine: MobilityRoutine,
  held: string[],
  startedAt: string,
  now: Date = new Date(),
): PromotedMobility | null {
  const moves = held
    .map(stretchById)
    .filter((s): s is Stretch => s !== null)
    .map(toLog);
  if (!moves.length) return null;

  const id = mobilitySessionId(routine.id, startedAt);
  const elapsed = Math.round((now.getTime() - Date.parse(startedAt)) / 60_000);
  const heldSeconds = moves.reduce((n, m) => n + m.seconds, 0);
  const durationMin =
    Number.isFinite(elapsed) && elapsed >= 1 && elapsed <= 120
      ? elapsed
      : Math.max(1, Math.round(heldSeconds / 60));

  const session: MobilitySession = {
    id,
    kind: 'mobility',
    date: startedAt.slice(0, 10) || todayISO(),
    startedAt,
    finishedAt: now.toISOString(),
    routineId: routine.id,
    title: routine.title,
    moves,
    durationMin,
    workoutId: `k_${id}`,
  };

  const workout: WorkoutEntry = {
    id: `k_${id}`,
    date: session.date,
    // 'Yoga' is already in Movement's type list, so this counts on Today and in
    // the active-minutes chart with no further wiring.
    type: 'Yoga',
    minutes: durationMin,
    intensity: 'low',
    note: `Mobility — ${routine.title}`,
    sessionId: id,
  };

  return { session, workout };
}
