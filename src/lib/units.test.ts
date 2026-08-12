import { describe, expect, it } from 'vitest';
import { labels, round, toCanonical, toDisplay } from './units';
import type { UnitLabels } from './units';

const KINDS: (keyof UnitLabels)[] = ['weight', 'length', 'volume', 'distance'];

describe('unit conversion', () => {
  it('is a no-op in metric, which is the canonical system', () => {
    for (const kind of KINDS) {
      expect(toDisplay(kind, 12.34, 'metric')).toBe(12.34);
      expect(toCanonical(kind, 12.34, 'metric')).toBe(12.34);
    }
  });

  it('round-trips imperial without drift', () => {
    for (const kind of KINDS) {
      const back = toCanonical(kind, toDisplay(kind, 80.5, 'imperial'), 'imperial');
      expect(back).toBeCloseTo(80.5, 10);
    }
  });

  it('uses the real conversion factors', () => {
    expect(toDisplay('weight', 100, 'imperial')).toBeCloseTo(220.462, 3);
    expect(toDisplay('length', 180, 'imperial')).toBeCloseTo(70.866, 3);
    expect(toDisplay('distance', 5, 'imperial')).toBeCloseTo(3.107, 3);
    expect(toDisplay('volume', 500, 'imperial')).toBeCloseTo(16.907, 3);
  });

  it('labels each system', () => {
    expect(labels('metric').weight).toBe('kg');
    expect(labels('imperial').weight).toBe('lb');
    expect(labels('imperial').volume).toBe('fl oz');
  });
});

describe('round', () => {
  it('rounds to the requested precision', () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.2345, 0)).toBe(1);
    expect(round(1.25, 1)).toBe(1.3);
  });

  it('defaults to one decimal place', () => {
    expect(round(1.26)).toBe(1.3);
  });
});
