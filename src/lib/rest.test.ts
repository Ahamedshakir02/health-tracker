import { describe, expect, it } from 'vitest';
import { endsAt, formatRest, remainingSeconds, restEnabled } from './rest';

describe('endsAt', () => {
  it('is the start plus the rest', () => {
    expect(endsAt(1_000, 90)).toBe(91_000);
  });

  it('treats a negative rest as none', () => {
    expect(endsAt(1_000, -30)).toBe(1_000);
  });
});

describe('remainingSeconds', () => {
  it('rounds up, so 0 means genuinely finished', () => {
    expect(remainingSeconds(10_500, 10_000)).toBe(1);
    expect(remainingSeconds(10_001, 10_000)).toBe(1);
    expect(remainingSeconds(10_000, 10_000)).toBe(0);
  });

  it('never goes negative — a tab backgrounded for an hour shows 0, not -3400', () => {
    expect(remainingSeconds(10_000, 3_610_000)).toBe(0);
  });

  it('is computed from the clock, so throttled ticks cannot make it drift', () => {
    const deadline = endsAt(0, 120);
    // One tick fired; four minutes of real time passed.
    expect(remainingSeconds(deadline, 240_000)).toBe(0);
  });
});

describe('formatRest', () => {
  it('pads seconds and not minutes', () => {
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(5)).toBe('0:05');
    expect(formatRest(0)).toBe('0:00');
    expect(formatRest(600)).toBe('10:00');
  });

  it('clamps rather than printing a negative time', () => {
    expect(formatRest(-5)).toBe('0:00');
  });
});

describe('restEnabled', () => {
  it('treats 0 as off, not as unset', () => {
    expect(restEnabled(0)).toBe(false);
    expect(restEnabled(90)).toBe(true);
    expect(restEnabled(undefined)).toBe(false);
  });
});
