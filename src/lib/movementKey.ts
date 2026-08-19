/**
 * Stable identity for a movement, across every schedule that contains it.
 *
 * The schedule book names the same lift several ways — "Flat Bench Press",
 * "Flat Bench Barbell Press" and "Bench Press (F, I, D)" are one press — and
 * files a handful of movements under two muscle sections. History, personal
 * records and the progression chart all need one key per lift, or a chart of
 * your bench is split three ways and says nothing.
 *
 * The key is derived, not stored in the plan: `src/data/trainingPlan.ts` is
 * generated from the .docx and must not be hand-edited.
 */

import type { PlanDay } from '../data/trainingPlan';

/**
 * 'WINGS / BACK' -> 'wings-back', 'Cable Curl (Rev)' -> 'cable-curl-rev'.
 *
 * Punctuation is dropped rather than encoded: the book writes "(Rev)", "(-)",
 * "(Plus)", "1,2,..7" and "F, I, D", none of which mean anything to a key, and
 * all of which would make it unreadable in a debugger.
 */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * `${section}/${name}`, always both.
 *
 * Qualifying only the names that are currently ambiguous looks tidier and is a
 * trap: adding one exercise later could flip a name from unique to ambiguous,
 * and every session already recorded under the bare name would be orphaned
 * from its own history. Always qualify, then collapse the few genuine
 * duplicates with ALIASES below.
 */
export function rawKey(section: string, name: string): string {
  return `${slug(section)}/${slug(name)}`;
}

/**
 * The movements the book files under two sections that are the same lift.
 *
 * The book lists these curl variants under both BICEPS and FOREARMS depending
 * on the day's emphasis, but the movement is identical, so they must share one
 * history. Everything collapses onto the BICEPS filing.
 *
 * `Barbell Press` is deliberately NOT here: under SHOULDER it is an overhead
 * press and under CHEST it is a bench press. Those are two different lifts that
 * happen to share a name, and merging their histories would be nonsense.
 */
export const ALIASES: Readonly<Record<string, string>> = {
  'forearms/hammer-curl': 'biceps/hammer-curl',
  'forearms/barbell-curl-rev': 'biceps/barbell-curl-rev',
  'forearms/cable-curl-rev': 'biceps/cable-curl-rev',
};

/** The key a session record should store. Idempotent — aliasing twice is safe. */
export function movementKey(section: string, name: string): string {
  const raw = rawKey(section, name);
  return ALIASES[raw] ?? raw;
}

/** Every distinct movement in a day, in the order it is performed. */
export function movementsInDay(day: PlanDay): { key: string; name: string; section: string }[] {
  const out: { key: string; name: string; section: string }[] = [];
  for (const section of day.sections) {
    for (const exercise of section.exercises) {
      out.push({
        key: movementKey(section.name, exercise.name),
        name: exercise.name,
        section: section.name,
      });
    }
  }
  return out;
}
