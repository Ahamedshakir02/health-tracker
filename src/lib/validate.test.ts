import { describe, expect, it } from 'vitest';
import { healthData, isoDate, num, settings } from './validate';
import { DEFAULT_DATA } from '../types';

describe('num', () => {
  it('accepts a finite number in range', () => {
    expect(num(42, 0, 100)).toBe(42);
    expect(num(0, 0, 100)).toBe(0);
  });

  it('rejects the values JSON round-tripping quietly turns into null', () => {
    expect(num(Infinity, 0, 1e9)).toBeUndefined();
    expect(num(-Infinity, 0, 1e9)).toBeUndefined();
    expect(num(NaN, 0, 1e9)).toBeUndefined();
  });

  it('rejects numeric strings rather than coercing them', () => {
    expect(num('42', 0, 100)).toBeUndefined();
  });

  it('rejects out-of-range values', () => {
    expect(num(-1, 0, 100)).toBeUndefined();
    expect(num(101, 0, 100)).toBeUndefined();
  });
});

describe('isoDate', () => {
  it('accepts a real calendar day', () => {
    expect(isoDate('2026-03-15')).toBe('2026-03-15');
    expect(isoDate('2028-02-29')).toBe('2028-02-29');
  });

  it('rejects a day that does not exist', () => {
    expect(isoDate('2026-02-31')).toBeUndefined();
    expect(isoDate('2027-02-29')).toBeUndefined();
    expect(isoDate('2026-13-01')).toBeUndefined();
  });

  it('rejects anything that is not exactly YYYY-MM-DD', () => {
    expect(isoDate('2026-3-15')).toBeUndefined();
    expect(isoDate('15/03/2026')).toBeUndefined();
    expect(isoDate('2026-03-15T00:00:00Z')).toBeUndefined();
    expect(isoDate(20260315)).toBeUndefined();
    expect(isoDate(null)).toBeUndefined();
  });
});

describe('healthData', () => {
  it('returns the defaults for junk input', () => {
    for (const junk of [null, undefined, 42, 'nope', [], true]) {
      const out = healthData(junk);
      expect(out.version).toBe(1);
      expect(out.weights).toEqual([]);
      expect(out.settings.goals.calories).toBe(DEFAULT_DATA.settings.goals.calories);
    }
  });

  it('drops entries that are not objects instead of crashing', () => {
    const out = healthData({
      weights: [null, 'x', 42, [], { date: '2026-01-01', weightKg: 80 }],
    });
    expect(out.weights).toHaveLength(1);
    expect(out.weights[0].weightKg).toBe(80);
  });

  it('drops records missing the fields the screens depend on', () => {
    const out = healthData({
      weights: [{ weightKg: 80 }, { date: '2026-01-01' }],
      meals: [{ name: 'no date' }],
      workouts: [{ date: '2026-01-01' }],
      days: [{ sleepHours: 8 }],
    });
    expect(out.weights).toEqual([]);
    expect(out.meals).toEqual([]);
    expect(out.workouts).toEqual([]);
    expect(out.days).toEqual([]);
  });

  it('rejects out-of-range numbers rather than storing them', () => {
    const out = healthData({
      weights: [{ date: '2026-01-01', weightKg: 80, bodyFatPct: 900 }],
      days: [{ date: '2026-01-01', sleepHours: 99, steps: -5, mood: 12 }],
    });
    expect(out.weights[0].bodyFatPct).toBeUndefined();
    expect(out.days[0].sleepHours).toBeUndefined();
    expect(out.days[0].steps).toBeUndefined();
    expect(out.days[0].mood).toBeUndefined();
  });

  it('substitutes a default for an unrecognised enum value', () => {
    const out = healthData({
      meals: [{ date: '2026-01-01', name: 'Toast', slot: 'brunch', calories: 200 }],
      workouts: [{ date: '2026-01-01', minutes: 30, intensity: 'extreme' }],
    });
    expect(out.meals[0].slot).toBe('snack');
    expect(out.workouts[0].intensity).toBe('moderate');
  });

  it('keeps only boolean habit ticks', () => {
    const out = healthData({
      days: [{ date: '2026-01-01', habits: { a: true, b: 'yes', c: 1, d: false } }],
    });
    expect(out.days[0].habits).toEqual({ a: true, d: false });
  });

  it('survives a habits field that is not a map at all', () => {
    const out = healthData({ days: [{ date: '2026-01-01', habits: 'nope' }] });
    expect(out.days[0].habits).toEqual({});
  });

  it('collapses duplicate dates in the one-per-day collections', () => {
    const out = healthData({
      weights: [
        { date: '2026-01-01', weightKg: 80 },
        { date: '2026-01-01', weightKg: 81 },
      ],
      days: [
        { date: '2026-01-01', steps: 100 },
        { date: '2026-01-01', steps: 200 },
      ],
    });
    expect(out.weights).toHaveLength(1);
    expect(out.weights[0].weightKg).toBe(81);
    expect(out.days).toHaveLength(1);
    expect(out.days[0].steps).toBe(200);
  });

  it('never lets a crafted key reach the prototype', () => {
    const out = healthData({
      days: [{ date: '2026-01-01', habits: { __proto__: true, constructor: true, ok: true } }],
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(out.days[0].habits)).toBe(Object.prototype);
    expect(out.days[0].habits.ok).toBe(true);
  });

  it('keeps a valid record intact', () => {
    const entry = {
      id: 'w_1',
      date: '2026-01-01',
      weightKg: 80.5,
      bodyFatPct: 18.2,
      waistCm: 84,
      note: 'after holiday',
    };
    expect(healthData({ weights: [entry] }).weights[0]).toEqual(entry);
  });
});

describe('settings', () => {
  it('falls back to the default habits when none survive validation', () => {
    expect(settings({ habits: [null, {}, { emoji: '🔥' }] }).habits).toEqual(
      DEFAULT_DATA.settings.habits,
    );
  });

  it('keeps valid habits and defaults a missing emoji', () => {
    const out = settings({ habits: [{ id: 'h1', name: 'Walk' }] });
    expect(out.habits).toEqual([{ id: 'h1', name: 'Walk', emoji: '⭐' }]);
  });

  it('ignores an unknown theme or unit system', () => {
    const out = settings({ theme: 'neon', units: 'furlongs' });
    expect(out.theme).toBe('system');
    expect(out.units).toBe('metric');
  });

  it('trims and caps free text', () => {
    expect(settings({ name: '  Sam  ' }).name).toBe('Sam');
    expect(settings({ name: 'x'.repeat(5000) }).name).toHaveLength(200);
  });

  it('keeps a known sex and drops anything else', () => {
    expect(settings({ sex: 'female' }).sex).toBe('female');
    expect(settings({ sex: 'male' }).sex).toBe('male');
    expect(settings({ sex: 'yes' }).sex).toBeUndefined();
  });

  it('only accepts an https avatar', () => {
    const ok = 'https://lh3.googleusercontent.com/a/photo';
    expect(settings({ avatarUrl: ok }).avatarUrl).toBe(ok);
    // The URL goes straight into an <img src>. A javascript: or data: URL
    // arriving from a tampered export must not reach it.
    expect(settings({ avatarUrl: 'javascript:alert(1)' }).avatarUrl).toBeUndefined();
    expect(settings({ avatarUrl: 'data:image/svg+xml,<svg/>' }).avatarUrl).toBeUndefined();
    expect(settings({ avatarUrl: 'http://example.com/a.png' }).avatarUrl).toBeUndefined();
  });

  it('rejects an impossible birth year', () => {
    expect(settings({ birthYear: 1200 }).birthYear).toBeUndefined();
    expect(settings({ birthYear: 3000 }).birthYear).toBeUndefined();
    expect(settings({ birthYear: 1994 }).birthYear).toBe(1994);
  });
});

describe('trainer preferences', () => {
  it('keeps a known equipment mode and falls back on anything else', () => {
    expect(settings({ trainer: { equipment: 'household' } }).trainer?.equipment).toBe('household');
    expect(settings({ trainer: { equipment: 'bodyweight' } }).trainer?.equipment).toBe('bodyweight');
    // An unknown mode would send homeExerciseFor looking up a variant that
    // does not exist, so it has to land on 'gym' rather than pass through.
    expect(settings({ trainer: { equipment: 'kettlebells' } }).trainer?.equipment).toBe('gym');
    expect(settings({ trainer: { equipment: null } }).trainer?.equipment).toBe('gym');
  });

  it('defaults the equipment mode when the trainer slice is older than it', () => {
    // Anyone signed in before home mode shipped has a stored slice with no
    // `equipment` key at all; they must land in the gym, not in a blank mode.
    expect(settings({ trainer: { restSeconds: 60 } }).trainer?.equipment).toBe('gym');
  });
});
