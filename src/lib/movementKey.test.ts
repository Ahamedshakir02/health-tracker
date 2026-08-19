import { describe, expect, it } from 'vitest';
import { ALIASES, movementKey, rawKey, slug } from './movementKey';
import { TRAINING_PLAN } from '../data/trainingPlan';

describe('slug', () => {
  it('collapses the punctuation the book actually uses', () => {
    expect(slug('WINGS / BACK')).toBe('wings-back');
    expect(slug('Cable Curl (Rev)')).toBe('cable-curl-rev');
    expect(slug('Bar Curl Hold (1,2,..7)')).toBe('bar-curl-hold-1-2-7');
    expect(slug('Bench Press (F, I, D)')).toBe('bench-press-f-i-d');
    expect(slug('Barbell Curl (-)')).toBe('barbell-curl');
    expect(slug('Z Bar French Press (+)')).toBe('z-bar-french-press');
  });

  it('never leaves a leading or trailing separator', () => {
    expect(slug('  Deadlift  ')).toBe('deadlift');
    expect(slug('(Plus)')).toBe('plus');
  });
});

describe('movementKey', () => {
  it('keeps two lifts that merely share a name apart', () => {
    // The book's "Barbell Press" is an overhead press on a shoulder day and a
    // bench press on a chest day. One history for both would be nonsense.
    expect(movementKey('SHOULDER', 'Barbell Press')).not.toBe(
      movementKey('CHEST', 'Barbell Press'),
    );
  });

  it('collapses the curls the book files under two sections', () => {
    expect(movementKey('FOREARMS', 'Hammer Curl')).toBe(movementKey('BICEPS', 'Hammer Curl'));
    expect(movementKey('FOREARMS', 'Cable Curl (Rev)')).toBe(
      movementKey('BICEPS', 'Cable Curl (Rev)'),
    );
    expect(movementKey('FOREARMS', 'Barbell Curl (Rev)')).toBe(
      movementKey('BICEPS', 'Barbell Curl (Rev)'),
    );
  });

  it('is idempotent — aliasing an already-aliased key changes nothing', () => {
    const once = movementKey('FOREARMS', 'Hammer Curl');
    const [section, name] = once.split('/');
    expect(movementKey(section, name)).toBe(once);
  });

  it('does not throw on a section the plan has never carried', () => {
    expect(movementKey('', 'Deadlift')).toBe('/deadlift');
  });
});

describe('against the real plan', () => {
  /** Every (section, name) pair the book actually contains. */
  const pairs = new Set<string>();
  for (const schedule of TRAINING_PLAN)
    for (const day of schedule.days)
      for (const section of day.sections)
        for (const exercise of section.exercises)
          pairs.add(`${section.name}\u0000${exercise.name}`);

  it('gives every exercise a non-empty key', () => {
    for (const pair of pairs) {
      const [section, name] = pair.split('\u0000');
      const key = movementKey(section, name);
      expect(key.length, `${section} / ${name}`).toBeGreaterThan(1);
      expect(key, `${section} / ${name}`).toContain('/');
    }
  });

  it('every alias source and target is a movement the plan really has', () => {
    const raws = new Set(
      [...pairs].map((p) => {
        const [section, name] = p.split('\u0000');
        return rawKey(section, name);
      }),
    );
    for (const [from, to] of Object.entries(ALIASES)) {
      expect(raws.has(from), `alias source ${from} is not in the plan`).toBe(true);
      expect(raws.has(to), `alias target ${to} is not in the plan`).toBe(true);
    }
  });
});
