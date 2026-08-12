import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPlan, weekStartOf } from './trainer';
import { addDays } from './dates';
import { DEFAULT_DATA, type DayLog, type HealthData, type WorkoutEntry } from '../types';

const TODAY = '2026-03-18'; // a Wednesday

function withData(over: Partial<HealthData> = {}): HealthData {
  return { ...DEFAULT_DATA, ...over };
}

const session = (date: string, over: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
  id: `k_${date}_${over.type ?? ''}`,
  date,
  type: 'Strength',
  minutes: 45,
  intensity: 'moderate',
  ...over,
});

/** n days of logs ending yesterday, so "today" is never pre-filled. */
function logs(count: number, build: (date: string, i: number) => Partial<DayLog>): DayLog[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(TODAY, -(i + 1));
    return { date, habits: {}, ...build(date, i) };
  });
}

describe('weekStartOf', () => {
  it('returns the Monday of the containing week', () => {
    expect(weekStartOf('2026-03-18')).toBe('2026-03-16'); // Wed -> Mon
    expect(weekStartOf('2026-03-16')).toBe('2026-03-16'); // Mon -> itself
  });

  it('treats Sunday as the end of its week, not the start of the next', () => {
    expect(weekStartOf('2026-03-22')).toBe('2026-03-16');
  });
});

describe('buildPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 18, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('produces a starting week when nothing has been logged', () => {
    const plan = buildPlan(withData(), TODAY);
    expect(plan.sessions.length).toBeGreaterThan(0);
    expect(plan.baselineMinutes).toBe(0);
    expect(plan.headline).toMatch(/starting week/i);
  });

  it('schedules exactly the target number of sessions when readiness is good', () => {
    const data = withData({
      workouts: [session(addDays(TODAY, -10)), session(addDays(TODAY, -12))],
      days: logs(14, () => ({ sleepHours: 8, restingHr: 55 })),
    });
    const plan = buildPlan(data, TODAY);
    expect(plan.sessions).toHaveLength(DEFAULT_DATA.settings.goals.workoutsPerWeek);
  });

  it('never puts two sessions on the same day', () => {
    const plan = buildPlan(withData(), TODAY);
    expect(new Set(plan.sessions.map((s) => s.date)).size).toBe(plan.sessions.length);
  });

  it('accounts for all seven days between sessions and rest', () => {
    const plan = buildPlan(withData(), TODAY);
    expect(plan.sessions.length + plan.restDays.length).toBe(7);
  });

  it('schedules everything inside the plan week', () => {
    const plan = buildPlan(withData(), TODAY);
    const end = addDays(plan.weekStart, 6);
    for (const s of plan.sessions) {
      expect(s.date >= plan.weekStart).toBe(true);
      expect(s.date <= end).toBe(true);
    }
  });

  it('drops to a deload when sleep has been short for a week', () => {
    const data = withData({
      workouts: [session(addDays(TODAY, -1), { intensity: 'high' }), session(TODAY, { intensity: 'high' })],
      days: logs(7, () => ({ sleepHours: 3.5 })),
    });
    const plan = buildPlan(data, TODAY);
    expect(plan.readiness.score).toBeLessThan(50);
    expect(plan.phase).toBe('deload');
    expect(plan.sessions.length).toBeLessThan(DEFAULT_DATA.settings.goals.workoutsPerWeek);
  });

  it('prescribes no high-intensity work once the verdict is hold or worse', () => {
    // Chronically short sleep with no training logged: still "fresh", but not
    // in any state to be given intervals.
    const data = withData({ days: logs(7, () => ({ sleepHours: 3 })) });
    const plan = buildPlan(data, TODAY);
    expect(['hold', 'deload']).toContain(plan.readiness.verdict);
    expect(plan.sessions.every((s) => s.intensity !== 'high')).toBe(true);
  });

  it('flags an elevated resting heart rate against the personal baseline', () => {
    const data = withData({
      days: [
        ...logs(3, () => ({ restingHr: 68, sleepHours: 8 })),
        ...Array.from({ length: 25 }, (_, i) => ({
          date: addDays(TODAY, -(i + 4)),
          habits: {},
          restingHr: 55,
          sleepHours: 8,
        })),
      ],
    });
    const plan = buildPlan(data, TODAY);
    const hr = plan.readiness.signals.find((s) => s.label === 'Resting heart rate');
    expect(hr?.status).toBe('serious');
  });

  it('keeps the weekly step-up near 10% of the recent baseline', () => {
    // 4 weeks at 200 min/week.
    const workouts = Array.from({ length: 16 }, (_, i) =>
      session(addDays(TODAY, -(i + 1) * 2), { minutes: 50, id: `k${i}` }),
    );
    const data = withData({ workouts, days: logs(14, () => ({ sleepHours: 8, restingHr: 52 })) });
    const plan = buildPlan(data, TODAY);
    if (plan.phase === 'build') {
      expect(plan.plannedMinutes).toBeLessThanOrEqual(Math.round(plan.baselineMinutes * 1.35));
    }
    expect(plan.plannedMinutes).toBeGreaterThan(0);
  });

  it('reads the goal direction from goal weight versus current weight', () => {
    const cutting = withData({
      weights: [{ id: 'w', date: addDays(TODAY, -1), weightKg: 90 }],
      settings: { ...DEFAULT_DATA.settings, goals: { ...DEFAULT_DATA.settings.goals, weightKg: 80 } },
    });
    expect(buildPlan(cutting, TODAY).direction).toBe('lose');

    const gaining = withData({
      weights: [{ id: 'w', date: addDays(TODAY, -1), weightKg: 70 }],
      settings: { ...DEFAULT_DATA.settings, goals: { ...DEFAULT_DATA.settings.goals, weightKg: 78 } },
    });
    expect(buildPlan(gaining, TODAY).direction).toBe('gain');

    expect(buildPlan(withData(), TODAY).direction).toBe('maintain');
  });

  it('scales the protein target to bodyweight and pushes it up in a deficit', () => {
    const data = withData({
      weights: [{ id: 'w', date: addDays(TODAY, -1), weightKg: 80 }],
      settings: { ...DEFAULT_DATA.settings, goals: { ...DEFAULT_DATA.settings.goals, weightKg: 72 } },
    });
    expect(buildPlan(data, TODAY).nutrition.proteinG).toBe(160); // 80 kg x 2.0
  });

  it('gives every session real content and a loggable type', () => {
    const plan = buildPlan(withData(), TODAY);
    for (const s of plan.sessions) {
      expect(s.blocks.length).toBeGreaterThanOrEqual(3);
      expect(s.blocks.every((b) => b.detail.length > 20)).toBe(true);
      expect(s.minutes).toBeGreaterThan(0);
      expect(s.logAs).toBeTruthy();
    }
  });

  it('plans a full rest week when the workout target is zero', () => {
    const data = withData({
      settings: {
        ...DEFAULT_DATA.settings,
        goals: { ...DEFAULT_DATA.settings.goals, workoutsPerWeek: 0 },
      },
    });
    const plan = buildPlan(data, TODAY);
    expect(plan.sessions).toEqual([]);
    expect(plan.restDays).toHaveLength(7);
  });

  it('does not let the readiness score leave 0–100 when data is sparse', () => {
    for (const data of [withData(), withData({ days: logs(1, () => ({ sleepHours: 1 })) })]) {
      const { score } = buildPlan(data, TODAY).readiness;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('marks the score provisional until enough signals report', () => {
    expect(buildPlan(withData(), TODAY).readiness.provisional).toBe(true);
    const rich = withData({
      workouts: [session(addDays(TODAY, -3))],
      days: logs(28, () => ({ sleepHours: 7.5, restingHr: 55 })),
    });
    expect(buildPlan(rich, TODAY).readiness.provisional).toBe(false);
  });
});
