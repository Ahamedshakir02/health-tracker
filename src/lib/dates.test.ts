import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatWeekday,
  lastNDays,
  parseISO,
  relativeLabel,
  todayISO,
} from './dates';

// The suite runs in America/Los_Angeles (see vitest.config.ts), so anything
// that reaches for `new Date('YYYY-MM-DD')` lands a day early and fails here.

describe('parseISO', () => {
  it('reads an ISO day as local midnight, not UTC midnight', () => {
    const d = parseISO('2026-03-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it('disagrees with the built-in UTC parse, which is the whole point', () => {
    expect(parseISO('2026-03-15').getDate()).not.toBe(new Date('2026-03-15').getDate());
  });
});

describe('todayISO', () => {
  it('round-trips a local date', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(todayISO(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('reports the local day even late at night, where toISOString would roll over', () => {
    const lateEvening = new Date(2026, 5, 30, 23, 30);
    expect(todayISO(lateEvening)).toBe('2026-06-30');
    expect(lateEvening.toISOString().slice(0, 10)).toBe('2026-07-01');
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('crosses a year boundary backwards', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('survives the spring-forward DST transition', () => {
    // 2026-03-08 is the US spring-forward date: that local day is only 23h long.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('survives the autumn fall-back transition', () => {
    // 2026-11-01 is 25h long locally.
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });
});

describe('daysBetween', () => {
  it('counts forward and backward', () => {
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
    expect(daysBetween('2026-01-08', '2026-01-01')).toBe(-7);
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('rounds off the DST hour rather than reporting 6.96 days', () => {
    expect(daysBetween('2026-03-05', '2026-03-12')).toBe(7);
    expect(daysBetween('2026-10-29', '2026-11-05')).toBe(7);
  });
});

describe('lastNDays', () => {
  it('is inclusive of the end date and ordered oldest first', () => {
    expect(lastNDays(3, '2026-01-03')).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('returns exactly n entries across a DST boundary', () => {
    const days = lastNDays(10, '2026-03-12');
    expect(days).toHaveLength(10);
    expect(new Set(days).size).toBe(10);
  });
});

describe('formatWeekday', () => {
  it('names the day that was asked for, not the one before it', () => {
    expect(formatWeekday('2026-03-15')).toContain('15');
    // 2026-03-15 is a Sunday in local time; the UTC misparse would say Saturday.
    expect(formatWeekday('2026-03-15').toLowerCase()).toContain('sun');
  });
});

describe('relativeLabel', () => {
  it('labels today and yesterday relative to the local day', () => {
    const today = todayISO();
    expect(relativeLabel(today)).toBe('Today');
    expect(relativeLabel(addDays(today, -1))).toBe('Yesterday');
    expect(relativeLabel(addDays(today, 1))).toBe('Tomorrow');
  });
});
