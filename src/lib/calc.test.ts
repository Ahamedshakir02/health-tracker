import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bmi,
  bmiBand,
  dailySeries,
  dayLog,
  habitStreak,
  meanOf,
  rollingMean,
  sortByDateDesc,
  sumMacros,
  uid,
  weightChange,
  workoutsInLastDays,
} from './calc';
import { DEFAULT_DATA, type DayLog, type HealthData, type MealEntry } from '../types';

const meal = (date: string, over: Partial<MealEntry> = {}): MealEntry => ({
  id: `m_${date}_${over.name ?? ''}`,
  date,
  slot: 'lunch',
  name: 'Lunch',
  calories: 500,
  proteinG: 30,
  carbsG: 50,
  fatG: 20,
  ...over,
});

describe('sumMacros', () => {
  it('sums an empty list to zero rather than NaN', () => {
    expect(sumMacros([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('adds each macro independently', () => {
    const totals = sumMacros([meal('2026-01-01'), meal('2026-01-01', { calories: 100 })]);
    expect(totals.calories).toBe(600);
    expect(totals.proteinG).toBe(60);
  });
});

describe('rollingMean', () => {
  it('smooths towards the centre of the window', () => {
    const points = [
      { date: '2026-01-01', value: 80 },
      { date: '2026-01-02', value: 82 },
      { date: '2026-01-03', value: 81 },
    ];
    const out = rollingMean(points, 3);
    expect(out[1].value).toBeCloseTo(81, 5);
  });

  it('returns the point itself when it is alone in the window', () => {
    expect(rollingMean([{ date: '2026-01-01', value: 80 }], 7)).toEqual([
      { date: '2026-01-01', value: 80 },
    ]);
  });

  it('handles unsorted input', () => {
    const out = rollingMean(
      [
        { date: '2026-01-03', value: 81 },
        { date: '2026-01-01', value: 80 },
      ],
      7,
    );
    expect(out.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-03']);
  });

  it('returns an empty series for no points', () => {
    expect(rollingMean([], 7)).toEqual([]);
  });
});

describe('meanOf', () => {
  it('ignores nulls instead of counting them as zero', () => {
    const rows = [{ v: 8 }, { v: null }, { v: 6 }];
    expect(meanOf(rows, (r) => r.v)).toBe(7);
  });

  it('returns null when nothing is logged', () => {
    expect(meanOf([{ v: null }], (r) => r.v)).toBeNull();
  });

  it('ignores NaN', () => {
    expect(meanOf([{ v: NaN }, { v: 4 }], (r) => r.v)).toBe(4);
  });
});

describe('bmi', () => {
  it('computes the standard ratio', () => {
    expect(bmi(80, 180)).toBeCloseTo(24.69, 2);
  });

  it('bands on the standard adult cutoffs', () => {
    expect(bmiBand(17).status).toBe('warning');
    expect(bmiBand(22).status).toBe('good');
    expect(bmiBand(27).status).toBe('warning');
    expect(bmiBand(33).status).toBe('serious');
    // Boundaries belong to the band above them.
    expect(bmiBand(18.5).label).toBe('Healthy range');
    expect(bmiBand(25).label).toBe('Overweight');
  });
});

describe('sortByDateDesc', () => {
  it('puts the newest first without mutating the input', () => {
    const input = [{ date: '2026-01-01' }, { date: '2026-02-01' }];
    const out = sortByDateDesc(input);
    expect(out[0].date).toBe('2026-02-01');
    expect(input[0].date).toBe('2026-01-01');
  });
});

describe('dayLog', () => {
  it('returns an empty log for a day with nothing recorded', () => {
    expect(dayLog([], '2026-01-01')).toEqual({ date: '2026-01-01', habits: {} });
  });
});

describe('date-relative calculations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Local noon, so the fake clock cannot straddle a local day boundary.
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  describe('weightChange', () => {
    it('reports the delta between the first and last reading in the window', () => {
      const weights = [
        { id: 'a', date: '2026-03-10', weightKg: 82 },
        { id: 'b', date: '2026-03-14', weightKg: 80 },
      ];
      expect(weightChange(weights, 7)).toEqual({ delta: -2, from: 82, to: 80 });
    });

    it('needs two readings', () => {
      expect(weightChange([{ id: 'a', date: '2026-03-14', weightKg: 80 }], 7)).toBeNull();
      expect(weightChange([], 7)).toBeNull();
    });

    it('ignores readings older than the window', () => {
      const weights = [
        { id: 'old', date: '2025-01-01', weightKg: 95 },
        { id: 'b', date: '2026-03-14', weightKg: 80 },
      ];
      expect(weightChange(weights, 7)).toBeNull();
    });
  });

  describe('habitStreak', () => {
    const day = (date: string, done: boolean): DayLog => ({ date, habits: { h1: done } });

    it('counts consecutive days ending today', () => {
      const days = [day('2026-03-13', true), day('2026-03-14', true), day('2026-03-15', true)];
      expect(habitStreak(days, 'h1')).toBe(3);
    });

    it('still counts a streak when today has not been logged yet', () => {
      const days = [day('2026-03-13', true), day('2026-03-14', true)];
      expect(habitStreak(days, 'h1')).toBe(2);
    });

    it('breaks on a missed day', () => {
      const days = [day('2026-03-12', true), day('2026-03-14', true)];
      expect(habitStreak(days, 'h1')).toBe(1);
    });

    it('is zero when the last two days are both missed', () => {
      expect(habitStreak([day('2026-03-10', true)], 'h1')).toBe(0);
      expect(habitStreak([], 'h1')).toBe(0);
    });
  });

  describe('workoutsInLastDays', () => {
    it('spans 7 inclusive days ending today', () => {
      const run = (id: string, date: string) => ({
        id,
        date,
        type: 'Run',
        minutes: 30,
        intensity: 'low' as const,
      });
      const out = workoutsInLastDays(
        [
          run('today', '2026-03-15'),
          run('oldest-in', '2026-03-09'),
          run('just-out', '2026-03-08'),
        ],
        7,
      );
      expect(out.map((w) => w.id)).toEqual(['today', 'oldest-in']);
    });
  });

  describe('dailySeries', () => {
    const data: HealthData = {
      ...DEFAULT_DATA,
      meals: [meal('2026-03-15'), meal('2026-03-15', { calories: 300, proteinG: 10 })],
      workouts: [
        {
          id: 'w',
          date: '2026-03-14',
          type: 'Run',
          minutes: 40,
          intensity: 'moderate',
          caloriesBurned: 400,
        },
      ],
      days: [{ date: '2026-03-15', habits: {}, sleepHours: 7.5, steps: 9000 }],
      weights: [{ id: 'x', date: '2026-03-15', weightKg: 80 }],
    };

    it('emits one row per day, oldest first, ending today', () => {
      const series = dailySeries(data, 7);
      expect(series).toHaveLength(7);
      expect(series[0].date).toBe('2026-03-09');
      expect(series[6].date).toBe('2026-03-15');
    });

    it('aggregates each day and leaves unlogged metrics null', () => {
      const series = dailySeries(data, 7);
      const today = series[6];
      expect(today.calories).toBe(800);
      expect(today.proteinG).toBe(40);
      expect(today.sleepHours).toBe(7.5);
      expect(today.weightKg).toBe(80);
      expect(today.mood).toBeNull();

      const yesterday = series[5];
      expect(yesterday.activeMinutes).toBe(40);
      expect(yesterday.caloriesBurned).toBe(400);
      expect(yesterday.calories).toBe(0);
      expect(yesterday.steps).toBeNull();
    });
  });
});

describe('uid', () => {
  it('is prefixed and unique across a tight loop', () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid('w')));
    expect(ids.size).toBe(500);
    expect([...ids].every((id) => id.startsWith('w_'))).toBe(true);
  });
});
