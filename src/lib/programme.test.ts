import { describe, expect, it } from 'vitest';
import { TRAINING_PLAN } from '../data/trainingPlan';
import {
  lastLogged,
  nextDay,
  rotationPosition,
  sessionsLogged,
  skipTo,
  startProgramme,
} from './programme';
import type { Programme, StrengthSession, WorkoutSession } from '../types';

const sched = (id: number) => TRAINING_PLAN.find((s) => s.id === id)!;

function session(over: Partial<StrengthSession> = {}): StrengthSession {
  const startedAt = over.startedAt ?? '2026-08-10T09:00:00.000Z';
  return {
    id: `s_${startedAt}`,
    kind: 'strength',
    date: startedAt.slice(0, 10),
    startedAt,
    scheduleId: 3,
    day: 1,
    focus: 'Chest',
    exercises: [],
    ...over,
  };
}

const prog = (over: Partial<Programme> = {}): Programme => ({
  scheduleId: 3,
  startedAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

describe('nextDay', () => {
  it('opens on the first day when nothing has been logged', () => {
    expect(nextDay(sched(3), [], prog())).toBe(sched(3).days[0].n);
  });

  it('opens on the first day when there is no programme at all', () => {
    expect(nextDay(sched(3), [session({ day: 2 })], undefined)).toBe(sched(3).days[0].n);
  });

  it('does not follow the pointer while you browse another schedule', () => {
    // Programme is Schedule 3; the user is looking at Schedule 5.
    const other = sched(5);
    expect(nextDay(other, [session({ day: 2 })], prog())).toBe(other.days[0].n);
  });

  it('advances one day past the last one logged', () => {
    const s = sched(3);
    expect(nextDay(s, [session({ day: s.days[0].n })], prog())).toBe(s.days[1].n);
  });

  it('wraps back to the top of the rotation after the last day', () => {
    const s = sched(3);
    const last = s.days[s.days.length - 1].n;
    expect(nextDay(s, [session({ day: last })], prog())).toBe(s.days[0].n);
  });

  it('wraps correctly whatever the schedule length', () => {
    // The book runs schedules of 2, 3 and 4 days. Index arithmetic on the
    // array, not on the book's own day numbers, is what makes this hold.
    for (const s of TRAINING_PLAN) {
      const p = prog({ scheduleId: s.id });
      const last = s.days[s.days.length - 1].n;
      expect(nextDay(s, [session({ scheduleId: s.id, day: last })], p)).toBe(s.days[0].n);
    }
  });

  it('reads the newest session, not the newest one in array order', () => {
    const s = sched(3);
    const sessions: WorkoutSession[] = [
      session({ day: s.days[2].n, startedAt: '2026-08-05T09:00:00.000Z' }),
      session({ day: s.days[0].n, startedAt: '2026-08-12T09:00:00.000Z' }),
    ];
    expect(nextDay(s, sessions, prog())).toBe(s.days[1].n);
  });

  it('ignores sessions from a different schedule', () => {
    const s = sched(3);
    const sessions = [session({ scheduleId: 7, day: 4, startedAt: '2026-08-12T09:00:00.000Z' })];
    expect(nextDay(s, sessions, prog())).toBe(s.days[0].n);
  });

  it('ignores sessions logged before the programme was started', () => {
    // Starting the schedule again has to mean starting again.
    const s = sched(3);
    const sessions = [session({ day: s.days[1].n, startedAt: '2026-07-20T09:00:00.000Z' })];
    expect(nextDay(s, sessions, prog())).toBe(s.days[0].n);
  });

  it('ignores a mobility session, which is not part of the rotation', () => {
    const s = sched(3);
    const mobility: WorkoutSession = {
      id: 'm_1',
      kind: 'mobility',
      date: '2026-08-12',
      startedAt: '2026-08-12T09:00:00.000Z',
      routineId: 'hips',
      title: 'Hips',
      moves: [],
    };
    expect(nextDay(s, [mobility], prog())).toBe(s.days[0].n);
  });

  it('falls back to the first day if the book no longer has the day logged', () => {
    expect(nextDay(sched(3), [session({ day: 99 })], prog())).toBe(sched(3).days[0].n);
  });
});

describe('skipTo', () => {
  it('honours an explicit jump before anything is logged after it', () => {
    const s = sched(3);
    const p = skipTo(prog(), s.days[2].n, new Date('2026-08-12T08:00:00.000Z'));
    expect(nextDay(s, [], p)).toBe(s.days[2].n);
  });

  it('is superseded by a session logged after the skip was set', () => {
    const s = sched(3);
    const p = skipTo(prog(), s.days[2].n, new Date('2026-08-12T08:00:00.000Z'));
    const sessions = [session({ day: s.days[0].n, startedAt: '2026-08-12T10:00:00.000Z' })];
    expect(nextDay(s, sessions, p)).toBe(s.days[1].n);
  });

  it('still wins over a session that predates it', () => {
    const s = sched(3);
    const p = skipTo(prog(), s.days[2].n, new Date('2026-08-12T08:00:00.000Z'));
    const sessions = [session({ day: s.days[0].n, startedAt: '2026-08-11T10:00:00.000Z' })];
    expect(nextDay(s, sessions, p)).toBe(s.days[2].n);
  });

  it('is ignored when it names a day the schedule does not have', () => {
    const s = sched(3);
    expect(nextDay(s, [], { ...prog(), skipToDay: 99 })).toBe(s.days[0].n);
  });

  it('stamps the moment it was set, or it would be sticky forever', () => {
    const p = skipTo(prog(), 2, new Date('2026-08-12T08:00:00.000Z'));
    expect(p.skipSetAt).toBe('2026-08-12T08:00:00.000Z');
  });
});

describe('lastLogged', () => {
  it('returns null with no history', () => {
    expect(lastLogged([], prog())).toBeNull();
  });

  it('returns the newest qualifying session', () => {
    const sessions = [
      session({ day: 1, startedAt: '2026-08-05T09:00:00.000Z' }),
      session({ day: 2, startedAt: '2026-08-09T09:00:00.000Z' }),
    ];
    expect(lastLogged(sessions, prog())?.day).toBe(2);
  });
});

describe('sessionsLogged', () => {
  it('counts only this programme, since it started', () => {
    const sessions = [
      session({ startedAt: '2026-07-01T09:00:00.000Z' }), // before it started
      session({ startedAt: '2026-08-05T09:00:00.000Z' }),
      session({ scheduleId: 9, startedAt: '2026-08-06T09:00:00.000Z' }),
    ];
    expect(sessionsLogged(sessions, prog())).toBe(1);
  });
});

describe('rotationPosition', () => {
  it('is 1-based within the schedule', () => {
    const s = sched(3);
    expect(rotationPosition(s, s.days[0].n)).toBe(1);
    expect(rotationPosition(s, s.days[1].n)).toBe(2);
  });

  it('falls back to the first position for an unknown day', () => {
    expect(rotationPosition(sched(3), 99)).toBe(1);
  });
});

describe('startProgramme', () => {
  it('stamps the start, which is what makes "start again" mean something', () => {
    const p = startProgramme(3, new Date('2026-08-19T00:00:00.000Z'));
    expect(p).toEqual({ scheduleId: 3, startedAt: '2026-08-19T00:00:00.000Z' });
  });
});
