import { describe, expect, it } from 'vitest';
import {
  activityFactor,
  adaptiveMaintenance,
  calorieFloor,
  changeVerdict,
  paceFlag,
  proteinRange,
  suggestCalories,
  waistToHeight,
  waistToHeightBand,
  weeklyRate,
  weightDirection,
} from './guidance';
import type { WeightEntry } from '../types';

const reading = (date: string, weightKg: number): WeightEntry => ({ id: `w_${date}`, date, weightKg });

describe('weightDirection', () => {
  it('has no opinion without both a weight and a goal', () => {
    expect(weightDirection(80, undefined)).toBeNull();
    expect(weightDirection(undefined, 75)).toBeNull();
  });

  it('points at the goal', () => {
    expect(weightDirection(80, 75)).toBe('lose');
    expect(weightDirection(60, 66)).toBe('gain');
  });

  it('calls it level within a kilo of the goal', () => {
    expect(weightDirection(75.6, 75)).toBe('hold');
    expect(weightDirection(74.2, 75)).toBe('hold');
  });
});

describe('changeVerdict', () => {
  it('gives no verdict when there is no goal to judge against', () => {
    expect(changeVerdict(-1, null)).toBeNull();
  });

  it('treats a loss as progress only for someone trying to lose', () => {
    expect(changeVerdict(-0.6, 'lose')).toBe('toward');
    expect(changeVerdict(-0.6, 'gain')).toBe('away');
  });

  it('treats a gain as progress for someone trying to gain', () => {
    expect(changeVerdict(0.4, 'gain')).toBe('toward');
    expect(changeVerdict(0.4, 'lose')).toBe('away');
  });

  it('ignores a change smaller than the scale can resolve', () => {
    expect(changeVerdict(0.04, 'lose')).toBe('flat');
  });

  it('flags drift either way for someone holding steady', () => {
    expect(changeVerdict(0.5, 'hold')).toBe('flat');
    expect(changeVerdict(1.4, 'hold')).toBe('away');
    expect(changeVerdict(-1.4, 'hold')).toBe('away');
  });
});

describe('activityFactor', () => {
  it('steps up with sessions a week', () => {
    expect(activityFactor(0)).toBe(1.2);
    expect(activityFactor(2)).toBe(1.375);
    expect(activityFactor(4)).toBe(1.55);
    expect(activityFactor(6)).toBe(1.725);
  });
});

describe('suggestCalories', () => {
  it('returns nothing when resting burn is unknown', () => {
    expect(suggestCalories({ bmr: null, workoutsPerWeek: 4, direction: 'lose' })).toBeNull();
  });

  it('takes 500 off maintenance to lose', () => {
    // 1740 × 1.55 = 2697 → 2700
    expect(suggestCalories({ bmr: 1740, workoutsPerWeek: 4, direction: 'lose', sex: 'male' })).toEqual({
      maintenance: 2700,
      target: 2200,
      direction: 'lose',
    });
  });

  it('adds 300 to gain and holds level otherwise', () => {
    expect(suggestCalories({ bmr: 1740, workoutsPerWeek: 4, direction: 'gain' })?.target).toBe(3000);
    expect(suggestCalories({ bmr: 1740, workoutsPerWeek: 4, direction: 'hold' })?.target).toBe(2700);
    expect(suggestCalories({ bmr: 1740, workoutsPerWeek: 4, direction: null })?.target).toBe(2700);
  });

  it('never suggests a loss target under the floor', () => {
    // 1150 × 1.2 = 1380 → 1400, minus 500 is 900: below both floors.
    expect(
      suggestCalories({ bmr: 1150, workoutsPerWeek: 0, direction: 'lose', sex: 'female' })?.target,
    ).toBe(1200);
    expect(
      suggestCalories({ bmr: 1150, workoutsPerWeek: 0, direction: 'lose', sex: 'male' })?.target,
    ).toBe(1500);
  });
});

describe('calorieFloor', () => {
  it('uses the lower floor unless the person is male', () => {
    expect(calorieFloor('male')).toBe(1500);
    expect(calorieFloor('female')).toBe(1200);
    expect(calorieFloor(undefined)).toBe(1200);
  });
});

describe('proteinRange', () => {
  it('needs a weight', () => {
    expect(proteinRange(undefined)).toBeNull();
  });

  it('gives 1.2 to 2.0 g per kg, suggesting 1.6', () => {
    expect(proteinRange(80)).toEqual({ low: 95, suggested: 130, high: 160 });
  });
});

describe('weeklyRate', () => {
  const today = '2026-10-12';

  it('needs two readings a fortnight apart', () => {
    expect(weeklyRate([], 30, today)).toBeNull();
    expect(weeklyRate([reading('2026-10-12', 78)], 30, today)).toBeNull();
    expect(weeklyRate([reading('2026-10-05', 79), reading('2026-10-12', 78)], 30, today)).toBeNull();
  });

  it('is the change per seven days across the span', () => {
    // 2 kg down over 28 days is half a kilo a week.
    const rate = weeklyRate([reading('2026-09-14', 80), reading('2026-10-12', 78)], 30, today);
    expect(rate).toBeCloseTo(-0.5, 5);
  });

  it('ignores readings older than the window', () => {
    const rate = weeklyRate(
      [reading('2026-06-01', 95), reading('2026-09-14', 80), reading('2026-10-12', 78)],
      30,
      today,
    );
    expect(rate).toBeCloseTo(-0.5, 5);
  });
});

describe('paceFlag', () => {
  it('says nothing without a rate or a weight', () => {
    expect(paceFlag(null, 80)).toBeNull();
    expect(paceFlag(-2, undefined)).toBeNull();
  });

  it('flags more than one percent of body weight a week, either way', () => {
    expect(paceFlag(-0.5, 80)).toBeNull();
    expect(paceFlag(-0.9, 80)).toBe('fast-loss');
    expect(paceFlag(0.9, 80)).toBe('fast-gain');
  });
});

describe('waistToHeight', () => {
  it('needs both measurements', () => {
    expect(waistToHeight(86, undefined)).toBeNull();
    expect(waistToHeight(undefined, 180)).toBeNull();
  });

  it('is waist over height', () => {
    expect(waistToHeight(90, 180)).toBe(0.5);
  });

  it('bands at 0.4, 0.5 and 0.6', () => {
    expect(waistToHeightBand(0.38).status).toBe('warning');
    expect(waistToHeightBand(0.47)).toEqual({ label: 'Healthy range', status: 'good' });
    expect(waistToHeightBand(0.5).label).toBe('Increased');
    expect(waistToHeightBand(0.62)).toEqual({ label: 'High', status: 'serious' });
  });
});

describe('adaptiveMaintenance', () => {
  const today = '2026-10-29';
  // 20 logged days in the window at 2 300 kcal.
  const meals = Array.from({ length: 20 }, (_, i) => ({
    date: `2026-10-${String(i + 5).padStart(2, '0')}`,
    calories: 2300,
  }));
  // Losing 0.5 kg a week, weighed every 4 days.
  const weights = [0, 4, 8, 12, 16, 20, 24].map((d) =>
    reading(`2026-10-${String(d + 2).padStart(2, '0')}`, 80 - (0.5 / 7) * d),
  );

  it('adds the energy of the weight lost to what was eaten', () => {
    const out = adaptiveMaintenance({ meals, weights, direction: 'lose', sex: 'male', today });
    expect(out).not.toBeNull();
    // 2300 + 0.5 × 7700 / 7 = 2850
    expect(out!.maintenance).toBe(2850);
    expect(out!.target).toBe(2350);
    expect(out!.kgPerWeek).toBe(-0.5);
    expect(out!.foodDays).toBe(20);
  });

  it('holds back with too few food days', () => {
    expect(
      adaptiveMaintenance({ meals: meals.slice(0, 10), weights, direction: null, today }),
    ).toBeNull();
  });

  it('holds back when the weigh-ins span under two weeks', () => {
    expect(
      adaptiveMaintenance({ meals, weights: weights.slice(0, 3), direction: null, today }),
    ).toBeNull();
  });

  it('refuses an implausible answer from partial logging', () => {
    const tiny = meals.map((m) => ({ ...m, calories: 300 }));
    expect(adaptiveMaintenance({ meals: tiny, weights, direction: null, today })).toBeNull();
  });

  it('ignores today, which is still being logged', () => {
    const withToday = [...meals, { date: today, calories: 9000 }];
    expect(
      adaptiveMaintenance({ meals: withToday, weights, direction: null, today })!.avgIntake,
    ).toBe(2300);
  });
});
