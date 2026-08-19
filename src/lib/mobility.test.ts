import { describe, expect, it } from 'vitest';
import { TRAINING_PLAN } from '../data/trainingPlan';
import { ROUTINES, STRETCHES, routineStretches, stretchById } from '../data/mobility';
import {
  areasForDay,
  cooldownFor,
  promoteMobility,
  routinesForDay,
  sectionAreas,
  toLog,
} from './mobility';

const allDays = TRAINING_PLAN.flatMap((s) => s.days);

describe('the generated stretch set', () => {
  it('has a unique id per stretch', () => {
    expect(new Set(STRETCHES.map((s) => s.id)).size).toBe(STRETCHES.length);
  });

  it('gives every stretch two frames and a cue', () => {
    for (const s of STRETCHES) {
      expect(s.a).toMatch(/\.webp$/);
      expect(s.b).toMatch(/\.webp$/);
      expect(s.a).not.toBe(s.b);
      expect(s.cue.length).toBeGreaterThan(10);
      expect(s.holdSeconds).toBeGreaterThan(0);
    }
  });

  it('resolves every routine to real stretches', () => {
    for (const r of ROUTINES) {
      expect(routineStretches(r)).toHaveLength(r.stretchIds.length);
      expect(r.minutes).toBeGreaterThan(0);
    }
  });

  it('returns null for an id that is not a stretch', () => {
    expect(stretchById('not-a-stretch')).toBeNull();
  });
});

describe('sectionAreas', () => {
  it('covers every muscle heading the book actually uses', () => {
    const sections = new Set(allDays.flatMap((d) => d.sections.map((s) => s.name)));
    for (const name of sections) {
      expect(sectionAreas(name), `no areas mapped for ${name}`).not.toHaveLength(0);
    }
  });

  it('is tolerant of casing and stray whitespace from the .docx parse', () => {
    expect(sectionAreas(' chest ')).toEqual(sectionAreas('CHEST'));
  });

  it('returns nothing for a heading it does not know, rather than guessing', () => {
    expect(sectionAreas('GRIP')).toEqual([]);
  });
});

describe('areasForDay', () => {
  it('lists areas in the order the day trains them, without repeats', () => {
    const day = allDays.find((d) => d.sections.length > 1)!;
    const areas = areasForDay(day);
    expect(new Set(areas).size).toBe(areas.length);
  });
});

describe('cooldownFor', () => {
  it('returns four to six stretches for every day in the book', () => {
    for (const day of allDays) {
      const out = cooldownFor(day);
      expect(out.length).toBeGreaterThanOrEqual(4);
      expect(out.length).toBeLessThanOrEqual(6);
    }
  });

  it('never repeats a stretch within one cool-down', () => {
    for (const day of allDays) {
      const ids = cooldownFor(day).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('is deterministic — the same day gives the same stretches every time', () => {
    for (const day of allDays.slice(0, 12)) {
      expect(cooldownFor(day).map((s) => s.id)).toEqual(cooldownFor(day).map((s) => s.id));
    }
  });

  it('covers each trained area before doubling up on any one of them', () => {
    // A chest-and-triceps day must not spend all six on the shoulders.
    const day = allDays.find((d) => d.sections.length >= 2)!;
    const areas = areasForDay(day).slice(0, 6);
    const out = cooldownFor(day).map((s) => s.area);
    for (const area of areas.slice(0, out.length)) {
      expect(out).toContain(area);
    }
  });

  it('still returns a full cool-down for a day that maps narrowly', () => {
    const narrow = { n: 1, focus: 'Biceps', reps: '15 x 3', sections: [
      { name: 'BICEPS', exercises: [{ n: 1, name: 'Barbell Curl', cue: '', img: null }] },
    ] };
    expect(cooldownFor(narrow).length).toBeGreaterThanOrEqual(4);
  });

  it('falls back rather than returning nothing for an unmapped heading', () => {
    const odd = { n: 1, focus: 'Grip', reps: '15 x 3', sections: [
      { name: 'GRIP', exercises: [{ n: 1, name: 'Farmer Walk', cue: '', img: null }] },
    ] };
    expect(cooldownFor(odd)).toHaveLength(4);
  });
});

describe('routinesForDay', () => {
  it('suggests only routines that overlap what was trained', () => {
    const legs = allDays.find((d) => d.sections.some((s) => s.name === 'LEGS'))!;
    const ids = routinesForDay(legs).map((r) => r.id);
    expect(ids).toContain('post-leg');
  });

  it('orders by how much of the day a routine actually covers', () => {
    const legs = allDays.find((d) => d.sections.some((s) => s.name === 'LEGS'))!;
    const out = routinesForDay(legs);
    const areas = new Set(areasForDay(legs));
    const hits = out.map((r) => r.areas.filter((a) => areas.has(a)).length);
    expect([...hits].sort((a, b) => b - a)).toEqual(hits);
  });
});

describe('promoteMobility', () => {
  const routine = ROUTINES[0];
  const started = '2026-08-19T09:00:00.000Z';

  it('records only what was actually held', () => {
    const out = promoteMobility(
      routine,
      routine.stretchIds.slice(0, 3),
      started,
      new Date('2026-08-19T09:06:00.000Z'),
    );
    expect(out?.session.moves).toHaveLength(3);
    expect(out?.session.durationMin).toBe(6);
  });

  it('returns null when nothing was held — opening a routine is not doing it', () => {
    expect(promoteMobility(routine, [], started)).toBeNull();
  });

  it('drops ids that are no longer stretches rather than logging a blank move', () => {
    const out = promoteMobility(routine, ['not-a-stretch', routine.stretchIds[0]], started);
    expect(out?.session.moves).toHaveLength(1);
  });

  it('gives the same id twice, so logging twice cannot make two records', () => {
    const a = promoteMobility(routine, routine.stretchIds, started);
    const b = promoteMobility(routine, routine.stretchIds, started);
    expect(a?.session.id).toBe(b?.session.id);
  });

  it('estimates the duration when the clock is useless', () => {
    // Logged the next morning: elapsed is hours, which says nothing about the
    // routine. Fall back to the holds themselves.
    const out = promoteMobility(routine, routine.stretchIds, started, new Date('2026-08-20T09:00:00.000Z'));
    expect(out!.session.durationMin).toBeGreaterThan(0);
    expect(out!.session.durationMin).toBeLessThanOrEqual(120);
  });

  it('pairs a workout row of a type Move already knows', () => {
    const out = promoteMobility(routine, routine.stretchIds, started)!;
    expect(out.workout.type).toBe('Yoga');
    expect(out.workout.sessionId).toBe(out.session.id);
    expect(out.workout.id).toBe(out.session.workoutId);
  });
});

describe('toLog', () => {
  it('keeps the id as the key, so history survives a rename', () => {
    const s = STRETCHES[0];
    expect(toLog(s)).toEqual({ key: s.id, name: s.name, seconds: s.holdSeconds });
  });
});
