import { describe, expect, it } from 'vitest';
import { TRAINING_PLAN } from './trainingPlan';
import { STRETCHES } from './mobility';
import { clipFor, showsFirstMovementOnly } from './exerciseMedia';

/**
 * The manifest is generated, so these are not testing the generator's
 * arithmetic — they are testing that the file on disk and the frames on disk
 * still agree with the plan the app renders. A regenerated manifest that lost
 * an exercise, or a frame deleted by hand, fails here rather than rendering an
 * empty card.
 */

// Enumerated through Vite's own glob rather than node's fs: this file is
// compiled with the app's browser-only type set, and pulling node globals into
// it would make them available to the app code beside it.
const frames = new Set(
  Object.keys(import.meta.glob('../../public/exercise-anim/*.webp')).map(
    (path) => path.split('/').pop() as string,
  ),
);

const pairs = TRAINING_PLAN.flatMap((s) =>
  s.days.flatMap((d) =>
    d.sections.flatMap((sec) => sec.exercises.map((e) => ({ section: sec.name, name: e.name }))),
  ),
);

describe('exercise media', () => {
  it('has a clip for every exercise in the book', () => {
    for (const { section, name } of pairs) {
      expect(clipFor(name, section), `no clip for ${section} / ${name}`).not.toBeNull();
    }
  });

  it('points at frames that are actually on disk', () => {
    for (const { section, name } of pairs) {
      const clip = clipFor(name, section)!;
      expect(frames.has(clip.a), `missing frame ${clip.a} for ${name}`).toBe(true);
      expect(frames.has(clip.b), `missing frame ${clip.b} for ${name}`).toBe(true);
    }
  });

  it('never gives a movement the same frame twice — it would not animate', () => {
    for (const { section, name } of pairs) {
      const clip = clipFor(name, section)!;
      expect(clip.a, `${name} has two identical frames`).not.toBe(clip.b);
    }
  });

  it('lets the section override the plain name', () => {
    // 'Barbell Press' is a shoulder press under SHOULDER and a bench press
    // under CHEST. This is the one name in the book where that is true.
    const shoulder = clipFor('Barbell Press', 'SHOULDER')!;
    const chest = clipFor('Barbell Press', 'CHEST')!;
    expect(chest.source).not.toBe(shoulder.source);
    expect(chest.source).toContain('Bench_Press');
  });

  it('falls back to the plain name when no section is given', () => {
    expect(clipFor('Barbell Press')).toEqual(clipFor('Barbell Press', 'SHOULDER'));
  });

  it('ignores a section that has no override', () => {
    expect(clipFor('Deadlift', 'WINGS / BACK')).toEqual(clipFor('Deadlift'));
  });

  it('returns null for a name the book does not have', () => {
    expect(clipFor('Zercher Squat')).toBeNull();
  });

  it('tolerates stray whitespace, which the .docx parse can leave behind', () => {
    expect(clipFor('  Deadlift  ')).toEqual(clipFor('Deadlift'));
  });
});

describe('the six corrected demonstrations', () => {
  const expected: [string, string | undefined, string][] = [
    ['Free Weight', 'CHEST', 'Dumbbell_Flyes'],
    ['Barbell Press', 'CHEST', 'Barbell_Bench_Press'],
    ['Reverse Chinups', 'FOREARMS', 'Pullups'],
    ['Lat Pulldown Front', 'WINGS / BACK', 'Wide-Grip_Lat_Pulldown'],
    ['Seated Dumbell Press Back', 'SHOULDER', 'Seated_Dumbbell_Press'],
    ['Side Lateral Raise with Dumbell Press', 'SHOULDER', 'Side_Lateral_Raise'],
  ];

  it.each(expected)('%s shows %s', (name, section, source) => {
    expect(clipFor(name, section)?.source).toContain(source);
  });

  it('keeps the two spellings of the front lat pulldown on the same clip', () => {
    expect(clipFor('Lat Pulldown Front')).toEqual(clipFor('Lat Pull Down Front'));
  });
});

describe('superset notes', () => {
  it('flags only entries the book actually contains', () => {
    const names = new Set(pairs.map((p) => p.name));
    const flagged = [...names].filter(showsFirstMovementOnly);
    expect(flagged.length).toBeGreaterThan(0);
    for (const n of flagged) expect(names.has(n)).toBe(true);
  });

  it('does not flag an ordinary single movement', () => {
    expect(showsFirstMovementOnly('Deadlift')).toBe(false);
  });
});

describe('stretch frames', () => {
  it('are on disk too', () => {
    for (const s of STRETCHES) {
      expect(frames.has(s.a), `missing frame ${s.a} for ${s.name}`).toBe(true);
      expect(frames.has(s.b), `missing frame ${s.b} for ${s.name}`).toBe(true);
    }
  });
});

describe('no orphan frames', () => {
  it('ships nothing that is never referenced', () => {
    const used = new Set<string>();
    for (const { section, name } of pairs) {
      const c = clipFor(name, section)!;
      used.add(c.a);
      used.add(c.b);
    }
    for (const s of STRETCHES) {
      used.add(s.a);
      used.add(s.b);
    }
    const orphans = [...frames].filter((f) => !used.has(f));
    expect(orphans, `orphaned frames: ${orphans.join(', ')}`).toHaveLength(0);
  });
});
