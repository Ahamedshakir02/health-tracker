import { describe, expect, it } from 'vitest';
import {
  bestSet,
  completedSets,
  dedupeKey,
  describeSets,
  epley1RM,
  lastPerformance,
  progression,
  promote,
  sortSessions,
  strengthSessionId,
  upsertSession,
} from './session';
import type { ScratchDay } from './trainerProgress';
import type { PlanDay, Schedule } from '../data/trainingPlan';
import type { StrengthSession, WorkoutSession } from '../types';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const DAY: PlanDay = {
  n: 2,
  focus: 'Chest / Triceps',
  reps: '15 x 3',
  sections: [
    {
      name: 'CHEST',
      exercises: [
        { n: 1, name: 'Flat Bench Barbell Press', cue: '', img: null },
        { n: 2, name: 'Dumbell Fly', cue: '', img: null },
      ],
    },
    {
      name: 'TRICEPS',
      exercises: [{ n: 1, name: 'Pulley Pushdown', cue: '', img: null }],
    },
  ],
};

const SCHEDULE: Schedule = {
  id: 3,
  title: 'Schedule 3',
  subtitle: '',
  days: [DAY],
};

function scratch(over: Partial<ScratchDay> = {}): ScratchDay {
  return {
    date: '2026-08-10',
    scheduleId: 3,
    day: 2,
    startedAt: '2026-08-10T09:00:00.000Z',
    units: 'metric',
    entries: {},
    ...over,
  };
}

function session(over: Partial<StrengthSession> = {}): StrengthSession {
  return {
    id: 's_1',
    kind: 'strength',
    date: '2026-08-01',
    startedAt: '2026-08-01T09:00:00.000Z',
    scheduleId: 3,
    day: 2,
    focus: 'Chest / Triceps',
    exercises: [
      {
        key: 'chest/flat-bench-barbell-press',
        name: 'Flat Bench Barbell Press',
        section: 'CHEST',
        sectionIndex: 0,
        n: 1,
        plannedSets: 3,
        plannedReps: 15,
        sets: [
          { index: 1, reps: 12, weightKg: 40 },
          { index: 2, reps: 12, weightKg: 40 },
          { index: 3, reps: 10, weightKg: 40 },
        ],
      },
    ],
    ...over,
  };
}

/* -------------------------------------------------------------------------- */

describe('epley1RM', () => {
  it('matches hand-worked values', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 3);
    expect(epley1RM(60, 5)).toBeCloseTo(70, 6);
  });

  it('returns the weight itself for a single rep', () => {
    expect(epley1RM(120, 1)).toBe(120);
  });

  it('is zero for anything that is not a real loaded set', () => {
    expect(epley1RM(0, 10)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(Number.NaN, 5)).toBe(0);
    expect(epley1RM(100, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('promote', () => {
  it('returns null when nothing was ticked', () => {
    expect(promote(scratch(), SCHEDULE, DAY)).toBeNull();
    const opened = scratch({
      entries: { '0:1': { done: [false, false, false], weight: ['', '', ''], reps: ['', '', ''] } },
    });
    expect(promote(opened, SCHEDULE, DAY)).toBeNull();
  });

  it('records only the sets actually completed', () => {
    const s = scratch({
      entries: {
        '0:1': { done: [true, true, false], weight: ['40', '40', ''], reps: ['12', '10', ''] },
        '0:2': { done: [false, false, false], weight: ['', '', ''], reps: ['', '', ''] },
      },
    });
    const out = promote(s, SCHEDULE, DAY);
    expect(out).not.toBeNull();
    // The untouched exercise is absent, not a row of zeroes.
    expect(out?.session.exercises).toHaveLength(1);
    expect(out?.session.exercises[0].sets).toEqual([
      { index: 1, reps: 12, weightKg: 40 },
      { index: 2, reps: 10, weightKg: 40 },
    ]);
  });

  it('keeps the set index, so a skipped middle set stays unambiguous', () => {
    const s = scratch({
      entries: {
        '0:1': { done: [true, false, true], weight: ['40', '', '45'], reps: ['12', '', '8'] },
      },
    });
    const sets = promote(s, SCHEDULE, DAY)?.session.exercises[0].sets;
    expect(sets?.map((x) => x.index)).toEqual([1, 3]);
  });

  it('falls back to the prescribed reps when the field is left blank', () => {
    const s = scratch({
      entries: { '0:1': { done: [true], weight: ['40'], reps: [''] } },
    });
    expect(promote(s, SCHEDULE, DAY)?.session.exercises[0].sets[0].reps).toBe(15);
  });

  it('stores a blank weight as 0 kg, which is a real answer', () => {
    const s = scratch({
      entries: { '0:1': { done: [true], weight: [''], reps: ['10'] } },
    });
    expect(promote(s, SCHEDULE, DAY)?.session.exercises[0].sets[0].weightKg).toBe(0);
  });

  it('converts an imperial scratch to canonical kg', () => {
    const s = scratch({
      units: 'imperial',
      entries: { '0:1': { done: [true], weight: ['100'], reps: ['10'] } },
    });
    const kg = promote(s, SCHEDULE, DAY)?.session.exercises[0].sets[0].weightKg;
    expect(kg).toBeCloseTo(45.359, 3);
  });

  it('survives junk in the number fields', () => {
    const s = scratch({
      entries: { '0:1': { done: [true, true], weight: ['abc', '12.'], reps: ['-4', '1e999'] } },
    });
    const sets = promote(s, SCHEDULE, DAY)?.session.exercises[0].sets;
    expect(sets?.[0]).toEqual({ index: 1, reps: 15, weightKg: 0 });
    expect(sets?.[1].weightKg).toBe(12);
    expect(Number.isFinite(sets?.[1].reps)).toBe(true);
  });

  it('is idempotent — promoting the same scratch twice yields the same id', () => {
    const s = scratch({
      entries: { '0:1': { done: [true], weight: ['40'], reps: ['12'] } },
    });
    const a = promote(s, SCHEDULE, DAY);
    const b = promote(s, SCHEDULE, DAY);
    expect(a?.session.id).toBe(b?.session.id);
    expect(a?.workout.id).toBe(b?.workout.id);
    // ...and upserting both leaves exactly one record.
    const list = upsertSession(upsertSession([], a!.session), b!.session);
    expect(list).toHaveLength(1);
  });

  it('links the workout row back to the session', () => {
    const s = scratch({ entries: { '0:1': { done: [true], weight: ['40'], reps: ['12'] } } });
    const out = promote(s, SCHEDULE, DAY)!;
    expect(out.workout.sessionId).toBe(out.session.id);
    expect(out.session.workoutId).toBe(out.workout.id);
    expect(out.workout.type).toBe('Strength');
  });

  it('estimates a sane duration when the clock is useless', () => {
    // The stale-day sweep runs a day later, so elapsed time is meaningless.
    const s = scratch({
      entries: {
        '0:1': { done: [true, true, true], weight: ['40', '40', '40'], reps: ['12', '12', '12'] },
      },
    });
    const out = promote(s, SCHEDULE, DAY, [], new Date('2026-08-12T09:00:00.000Z'))!;
    expect(out.session.durationMin).toBeGreaterThanOrEqual(5);
    expect(out.session.durationMin).toBeLessThanOrEqual(240);
  });

  it('marks a nearly-complete day as hard and a token effort as moderate', () => {
    const full = scratch({
      entries: {
        '0:1': { done: [true, true, true], weight: ['40', '40', '40'], reps: ['', '', ''] },
        '0:2': { done: [true, true, true], weight: ['12', '12', '12'], reps: ['', '', ''] },
        '1:1': { done: [true, true, true], weight: ['25', '25', '25'], reps: ['', '', ''] },
      },
    });
    expect(promote(full, SCHEDULE, DAY)?.workout.intensity).toBe('high');

    const token = scratch({
      entries: { '0:1': { done: [true], weight: ['40'], reps: [''] } },
    });
    expect(promote(token, SCHEDULE, DAY)?.workout.intensity).toBe('moderate');
  });
});

describe('upsertSession', () => {
  it('replaces by id', () => {
    const a = session({ id: 's_1' });
    const b = session({ id: 's_1', focus: 'Legs' });
    const out = upsertSession([a], b);
    expect(out).toHaveLength(1);
    expect((out[0] as StrengthSession).focus).toBe('Legs');
  });

  it('appends a genuinely different session', () => {
    const a = session({ id: 's_1', date: '2026-08-01' });
    const b = session({ id: 's_2', date: '2026-08-03' });
    expect(upsertSession([a], b)).toHaveLength(2);
  });

  it('collapses the same day logged on two devices, keeping the fuller record', () => {
    const phone = session({ id: 's_phone' });
    const laptop = session({
      id: 's_laptop',
      exercises: [{ ...session().exercises[0], sets: [{ index: 1, reps: 12, weightKg: 40 }] }],
    });
    expect(completedSets(phone)).toBe(3);
    expect(completedSets(laptop)).toBe(1);

    // Whichever order they arrive in, the three-set record survives.
    const a = upsertSession([phone], laptop);
    expect(a).toHaveLength(1);
    expect(a[0].id).toBe('s_phone');

    const b = upsertSession([laptop], phone);
    expect(b).toHaveLength(1);
    expect(b[0].id).toBe('s_phone');
  });

  it('does not confuse two different schedule days on the same date', () => {
    const a = session({ id: 's_1', day: 1 });
    const b = session({ id: 's_2', day: 2 });
    expect(dedupeKey(a)).not.toBe(dedupeKey(b));
    expect(upsertSession([a], b)).toHaveLength(2);
  });
});

describe('sortSessions', () => {
  it('is newest first, and breaks a same-day tie on start time', () => {
    const early = session({ id: 'a', date: '2026-08-01', startedAt: '2026-08-01T07:00:00.000Z' });
    const late = session({ id: 'b', date: '2026-08-01', startedAt: '2026-08-01T18:00:00.000Z' });
    const older = session({ id: 'c', date: '2026-07-30' });
    expect(sortSessions([early, older, late]).map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('lastPerformance', () => {
  const key = 'chest/flat-bench-barbell-press';

  it('is null with no history', () => {
    expect(lastPerformance([], key)).toBeNull();
  });

  it('returns the most recent session before today', () => {
    const list: WorkoutSession[] = [
      session({ id: 'a', date: '2026-08-01' }),
      session({ id: 'b', date: '2026-08-04' }),
    ];
    expect(lastPerformance(list, key, '2026-08-10')?.date).toBe('2026-08-04');
  });

  it("ignores today's in-progress session", () => {
    const list: WorkoutSession[] = [
      session({ id: 'a', date: '2026-08-04' }),
      session({ id: 'b', date: '2026-08-10' }),
    ];
    expect(lastPerformance(list, key, '2026-08-10')?.date).toBe('2026-08-04');
  });

  it('ignores a movement that was not in the session', () => {
    expect(lastPerformance([session()], 'legs/barbell-squat', '2026-08-10')).toBeNull();
  });
});

describe('bestSet', () => {
  const key = 'chest/flat-bench-barbell-press';

  it('is null with no history', () => {
    expect(bestSet([], key)).toBeNull();
  });

  it('ranks on estimated 1RM, not raw weight', () => {
    const list: WorkoutSession[] = [
      session({
        id: 'a',
        date: '2026-08-01',
        exercises: [{ ...session().exercises[0], sets: [{ index: 1, reps: 12, weightKg: 60 }] }],
      }),
      session({
        id: 'b',
        date: '2026-08-08',
        exercises: [{ ...session().exercises[0], sets: [{ index: 1, reps: 1, weightKg: 80 }] }],
      }),
    ];
    // 60 x 12 estimates 84 kg; a single at 80 kg estimates 80.
    expect(bestSet(list, key)?.weightKg).toBe(60);
  });

  it('falls back to reps for a movement that was never loaded', () => {
    const list: WorkoutSession[] = [
      session({
        id: 'a',
        date: '2026-08-01',
        exercises: [
          {
            ...session().exercises[0],
            key: 'wings-back/pull-ups',
            sets: [
              { index: 1, reps: 8, weightKg: 0 },
              { index: 2, reps: 11, weightKg: 0 },
            ],
          },
        ],
      }),
    ];
    const best = bestSet(list, 'wings-back/pull-ups');
    expect(best?.bodyweight).toBe(true);
    expect(best?.reps).toBe(11);
  });

  it('leaves a tie with the record that set it first', () => {
    const list: WorkoutSession[] = [
      session({
        id: 'first',
        date: '2026-08-01',
        exercises: [{ ...session().exercises[0], sets: [{ index: 1, reps: 10, weightKg: 50 }] }],
      }),
      session({
        id: 'later',
        date: '2026-08-08',
        exercises: [{ ...session().exercises[0], sets: [{ index: 1, reps: 10, weightKg: 50 }] }],
      }),
    ];
    expect(bestSet(list, key)?.date).toBe('2026-08-01');
  });
});

describe('progression', () => {
  it('is oldest first, one point per session', () => {
    const list: WorkoutSession[] = [
      session({ id: 'a', date: '2026-08-01' }),
      session({ id: 'b', date: '2026-08-08' }),
    ];
    const points = progression(list, 'chest/flat-bench-barbell-press');
    expect(points.map((p) => p.date)).toEqual(['2026-08-01', '2026-08-08']);
    expect(points[0].topSetKg).toBe(40);
    expect(points[0].volumeKg).toBe(40 * 12 + 40 * 12 + 40 * 10);
  });

  it('is empty for a movement never performed', () => {
    expect(progression([session()], 'legs/leg-press')).toEqual([]);
  });
});

describe('describeSets', () => {
  const same = (kg: number) => kg;

  it('collapses a constant weight into one figure', () => {
    expect(
      describeSets(
        [
          { index: 1, reps: 12, weightKg: 40 },
          { index: 2, reps: 12, weightKg: 40 },
          { index: 3, reps: 10, weightKg: 40 },
        ],
        'kg',
        same,
      ),
    ).toBe('40 kg × 12, 12, 10');
  });

  it('spells out a ramping load', () => {
    expect(
      describeSets(
        [
          { index: 1, reps: 12, weightKg: 40 },
          { index: 2, reps: 8, weightKg: 50 },
        ],
        'kg',
        same,
      ),
    ).toBe('40×12, 50×8');
  });

  it('says reps for an unloaded movement', () => {
    expect(describeSets([{ index: 1, reps: 10, weightKg: 0 }], 'kg', same)).toBe('10 reps');
  });

  it('is empty for no sets', () => {
    expect(describeSets([], 'kg', same)).toBe('');
  });
});

describe('strengthSessionId', () => {
  it('is stable for the same start time and unique across days', () => {
    const a = strengthSessionId(3, 2, '2026-08-10T09:00:00.000Z');
    expect(a).toBe(strengthSessionId(3, 2, '2026-08-10T09:00:00.000Z'));
    expect(a).not.toBe(strengthSessionId(3, 3, '2026-08-10T09:00:00.000Z'));
    expect(a).not.toBe(strengthSessionId(4, 2, '2026-08-10T09:00:00.000Z'));
  });
});
