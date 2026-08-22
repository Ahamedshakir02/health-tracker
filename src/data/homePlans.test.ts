import { describe, expect, it } from 'vitest';
import { TRAINING_PLAN } from './trainingPlan';
import { HOME_PLANS, homeExerciseFor } from './homePlans';
import { movementKey } from '../lib/movementKey';
import { EQUIPMENT_NOTES, type EquipmentMode } from '../types';

/**
 * The home editions are an overlay on the gym book, so the thing worth testing
 * is not the prose — it is that the overlay still covers the book. A schedule
 * regenerated from the .docx, or a movementKey alias added later, could leave a
 * card with no substitute; in the app that shows as the gym exercise appearing
 * in the middle of a home workout, which is exactly the failure nobody notices
 * until they are standing in their kitchen looking for a lat pulldown machine.
 */

const HOME_MODES = ['household', 'bodyweight'] as const satisfies readonly EquipmentMode[];

/** Every (section, name) the book actually contains, deduplicated. */
const pairs = (() => {
  const out = new Map<string, { section: string; name: string }>();
  for (const schedule of TRAINING_PLAN)
    for (const day of schedule.days)
      for (const section of day.sections)
        for (const exercise of section.exercises) {
          const entry = { section: section.name.trim(), name: exercise.name.trim() };
          out.set(movementKey(entry.section, entry.name), entry);
        }
  return [...out.values()];
})();

describe('home plan coverage', () => {
  it('covers every movement in the book, in both editions', () => {
    const missing: string[] = [];
    for (const mode of HOME_MODES)
      for (const { section, name } of pairs)
        if (!homeExerciseFor(mode, section, name)) missing.push(`${mode}: ${section} / ${name}`);

    expect(missing).toEqual([]);
  });

  it('has no substitution the book cannot reach', () => {
    const reachable = new Set(pairs.map((p) => movementKey(p.section, p.name)));
    for (const mode of HOME_MODES) {
      const orphans = Object.keys(HOME_PLANS[mode]).filter((key) => !reachable.has(key));
      expect(orphans, `${mode} has substitutions for movements the book does not contain`).toEqual(
        [],
      );
    }
  });

  it('keys everything through movementKey, so aliases resolve', () => {
    // 202 section-qualified pairs collapse to 199 once the three curl variants
    // filed under both BICEPS and FOREARMS are aliased together. If this drifts,
    // either the book or ALIASES changed and the overlay needs regenerating.
    expect(pairs).toHaveLength(199);
    for (const mode of HOME_MODES) expect(Object.keys(HOME_PLANS[mode])).toHaveLength(199);
  });
});

describe('home plan content', () => {
  it('gives every substitute a way up and a way down', () => {
    // The Harder/Easier pair is the whole progression mechanism at home — you
    // cannot add plates — so an entry missing one is not a cosmetic gap.
    for (const mode of HOME_MODES)
      for (const [key, exercise] of Object.entries(HOME_PLANS[mode]))
        for (const field of ['name', 'setup', 'move', 'feel', 'harder', 'easier'] as const)
          expect(exercise[field].trim(), `${mode} ${key} ${field}`).not.toBe('');
  });

  it('needs no equipment at all in bodyweight mode', () => {
    // A bodyweight substitute that says "backpack" or "chair" has been copied
    // from the household edition — the two documents were parsed in order and
    // getting them the wrong way round is the plausible mistake.
    //
    // Doorways and walls are deliberately not on this list. The bodyweight
    // edition asks for "your body, the floor and a wall", and it does use a
    // door frame to lean on — but always with a wall corner offered instead, so
    // it is architecture rather than equipment.
    const kit = /\b(backpack|chair|table|bottle|towel|shopping bag|book)s?\b/i;
    const offenders = Object.entries(HOME_PLANS.bodyweight)
      .filter(([, e]) => kit.test(e.name))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });
});

describe('homeExerciseFor', () => {
  it('returns null in gym mode, so callers fall back to the book', () => {
    for (const { section, name } of pairs) expect(homeExerciseFor('gym', section, name)).toBeNull();
  });

  it('tells the two Barbell Presses apart by section', () => {
    // The book files an overhead press and a bench press under one name. This
    // is the reason the overlay is keyed on section as well as name; collapsing
    // them would put a chest movement in the middle of a shoulder day.
    for (const mode of HOME_MODES) {
      const chest = homeExerciseFor(mode, 'CHEST', 'Barbell Press');
      const shoulder = homeExerciseFor(mode, 'SHOULDER', 'Barbell Press');
      expect(chest).not.toBeNull();
      expect(shoulder).not.toBeNull();
      expect(chest?.name).not.toBe(shoulder?.name);
    }
  });

  it('returns null for a movement the book does not contain', () => {
    expect(homeExerciseFor('household', 'CHEST', 'Not A Real Exercise')).toBeNull();
  });
});

describe('equipment notes', () => {
  it('describes what each mode assumes you have', () => {
    for (const mode of ['gym', ...HOME_MODES] as const) {
      expect(EQUIPMENT_NOTES[mode].label.trim()).not.toBe('');
      expect(EQUIPMENT_NOTES[mode].needs.trim()).not.toBe('');
    }
  });
});
