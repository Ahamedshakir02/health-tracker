import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dayKey,
  emptyProgress,
  hasProgress,
  loadHints,
  loadScratch,
  migrateLegacy,
  newDay,
  normalise,
  parseScheme,
  progressKey,
  prune,
  saveScratch,
  stalePromotable,
  type ScratchDay,
  type ScratchStore,
} from './trainerProgress';

/**
 * A minimal in-memory localStorage. jsdom is not configured for this suite —
 * the repo tests pure logic in a node environment — so the storage half is
 * stubbed rather than the environment swapped.
 */
function stubStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  vi.stubGlobal('localStorage', storage);
  return map;
}

let store: Map<string, string>;

beforeEach(() => {
  store = stubStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function day(over: Partial<ScratchDay> = {}): ScratchDay {
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

describe('parseScheme', () => {
  it('reads the book’s own notation', () => {
    expect(parseScheme('15 x 3')).toEqual({ reps: 15, sets: 3 });
    expect(parseScheme('12 × 4')).toEqual({ reps: 12, sets: 4 });
    expect(parseScheme('10 x 3 (Slow movements)')).toEqual({ reps: 10, sets: 3 });
  });

  it('falls back to three sets when the book is silent', () => {
    expect(parseScheme('')).toEqual({ reps: 0, sets: 3 });
    expect(parseScheme('as many as you can')).toEqual({ reps: 0, sets: 3 });
  });
});

describe('normalise', () => {
  it('creates a blank record of the right length', () => {
    expect(normalise(undefined, 3)).toEqual(emptyProgress(3));
  });

  it('grows to the set count the schedule calls for', () => {
    const grown = normalise({ done: [true], weight: ['40'], reps: ['12'] }, 4);
    expect(grown.done).toEqual([true, false, false, false]);
    expect(grown.weight).toEqual(['40', '', '', '']);
    expect(grown.reps).toEqual(['12', '', '', '']);
  });

  it('trims when a schedule prescribes fewer sets', () => {
    const trimmed = normalise(
      { done: [true, true, true, true], weight: ['1', '2', '3', '4'], reps: ['', '', '', ''] },
      2,
    );
    expect(trimmed.done).toEqual([true, true]);
    expect(trimmed.weight).toEqual(['1', '2']);
  });

  it('tolerates a v1-shaped record with no reps array', () => {
    const entry = { done: [true, false], weight: ['40', ''] } as never;
    expect(normalise(entry, 2).reps).toEqual(['', '']);
  });
});

describe('hasProgress', () => {
  it('is false for an opened but untouched day', () => {
    expect(hasProgress(day())).toBe(false);
    expect(
      hasProgress(day({ entries: { '0:1': { done: [false], weight: [''], reps: [''] } } })),
    ).toBe(false);
  });

  it('is true once any set is ticked', () => {
    expect(
      hasProgress(day({ entries: { '0:1': { done: [false, true], weight: ['', ''], reps: ['', ''] } } })),
    ).toBe(true);
  });

  it('counts a cool-down that was held', () => {
    expect(hasProgress(day({ cooldown: { 'stretch/child-s-pose': true } }))).toBe(true);
  });
});

describe('keys', () => {
  it('separates two days of the same schedule', () => {
    expect(dayKey('2026-08-10', 3, 1)).not.toBe(dayKey('2026-08-10', 3, 2));
  });

  it('separates the same schedule day on two dates — the v1 bug', () => {
    expect(dayKey('2026-08-03', 3, 1)).not.toBe(dayKey('2026-08-10', 3, 1));
  });

  it('separates a repeated muscle group within one day', () => {
    expect(progressKey(0, 1)).not.toBe(progressKey(1, 1));
  });
});

describe('prune', () => {
  it("keeps today's record even after it has been promoted", () => {
    const s: ScratchStore = {
      [dayKey('2026-08-10', 3, 2)]: day({ promotedAs: 's_3_2_x' }),
    };
    expect(Object.keys(prune(s, '2026-08-10'))).toHaveLength(1);
  });

  it('drops an older record once it is safely promoted', () => {
    const s: ScratchStore = {
      [dayKey('2026-08-01', 3, 2)]: day({ date: '2026-08-01', promotedAs: 's_3_2_x' }),
    };
    expect(prune(s, '2026-08-10')).toEqual({});
  });

  it('keeps an older record that was never promoted, so it can still be', () => {
    const s: ScratchStore = {
      [dayKey('2026-08-09', 3, 2)]: day({ date: '2026-08-09' }),
    };
    expect(Object.keys(prune(s, '2026-08-10'))).toHaveLength(1);
  });

  it('caps the store so it cannot grow without bound', () => {
    const s: ScratchStore = {};
    for (let i = 1; i <= 20; i += 1) {
      const date = `2026-08-${String(i).padStart(2, '0')}`;
      s[dayKey(date, 3, 1)] = day({ date });
    }
    const kept = prune(s, '2026-08-25');
    expect(Object.keys(kept).length).toBeLessThanOrEqual(8);
    // The newest survive — an unfinished session from last month is not worth
    // holding on to at the cost of yesterday's.
    expect(Object.values(kept).map((d) => d.date)).toContain('2026-08-20');
  });
});

describe('stalePromotable', () => {
  it("ignores today's session, which is still in progress", () => {
    const s: ScratchStore = {
      [dayKey('2026-08-10', 3, 2)]: day({
        entries: { '0:1': { done: [true], weight: ['40'], reps: ['12'] } },
      }),
    };
    expect(stalePromotable(s, '2026-08-10')).toHaveLength(0);
  });

  it('finds a previous day that was never finished', () => {
    const s: ScratchStore = {
      [dayKey('2026-08-09', 3, 2)]: day({
        date: '2026-08-09',
        entries: { '0:1': { done: [true], weight: ['40'], reps: ['12'] } },
      }),
    };
    expect(stalePromotable(s, '2026-08-10')).toHaveLength(1);
  });

  it('ignores a day that was opened and abandoned without a single tick', () => {
    const s: ScratchStore = {
      [dayKey('2026-08-09', 3, 2)]: day({ date: '2026-08-09' }),
    };
    expect(stalePromotable(s, '2026-08-10')).toHaveLength(0);
  });

  it('ignores a day already promoted, so it cannot be logged twice', () => {
    const s: ScratchStore = {
      [dayKey('2026-08-09', 3, 2)]: day({
        date: '2026-08-09',
        promotedAs: 's_3_2_x',
        entries: { '0:1': { done: [true], weight: ['40'], reps: ['12'] } },
      }),
    };
    expect(stalePromotable(s, '2026-08-10')).toHaveLength(0);
  });

  it('returns oldest first, so promotion happens in the order it happened', () => {
    const mk = (date: string) =>
      day({ date, entries: { '0:1': { done: [true], weight: ['40'], reps: ['12'] } } });
    const s: ScratchStore = {
      [dayKey('2026-08-09', 3, 2)]: mk('2026-08-09'),
      [dayKey('2026-08-07', 3, 1)]: mk('2026-08-07'),
    };
    expect(stalePromotable(s, '2026-08-10').map((d) => d.date)).toEqual([
      '2026-08-07',
      '2026-08-09',
    ]);
  });
});

describe('round trip', () => {
  it('saves and reloads', () => {
    const s: ScratchStore = { [dayKey('2026-08-10', 3, 2)]: day() };
    saveScratch(s);
    expect(loadScratch()).toEqual(s);
  });

  it('returns an empty store rather than throwing on corrupt JSON', () => {
    store.set('vitals.trainer.scratch.v2', '{not json');
    expect(loadScratch()).toEqual({});
  });

  it('drops entries that are not a scratch day at all', () => {
    store.set('vitals.trainer.scratch.v2', JSON.stringify({ a: 5, b: null, c: day() }));
    expect(Object.keys(loadScratch())).toEqual(['c']);
  });
});

describe('migrateLegacy', () => {
  const V1 = 'vitals.trainer.progress.v1';

  it('does nothing when there is no v1 key', () => {
    migrateLegacy();
    expect(loadHints()).toEqual({});
  });

  it('keeps the weights as hints and removes the undated v1 map', () => {
    store.set(
      V1,
      JSON.stringify({
        '3:1:0:1': { done: [true, true, false], weight: ['40', '40', ''] },
        '3:1:0:2': { done: [false], weight: [''] },
      }),
    );
    migrateLegacy();

    // v1 has no dates, so it must never become a session — only a hint.
    expect(store.has(V1)).toBe(false);
    expect(loadHints()).toEqual({ '3:1:0:1': ['40', '40', ''] });
  });

  it('runs once — a second call finds nothing left to do', () => {
    store.set(V1, JSON.stringify({ '3:1:0:1': { done: [true], weight: ['40'] } }));
    migrateLegacy();
    const after = loadHints();
    migrateLegacy();
    expect(loadHints()).toEqual(after);
  });

  it('still clears v1 when it holds nothing worth keeping', () => {
    store.set(V1, JSON.stringify({ '3:1:0:1': { done: [true], weight: ['', ''] } }));
    migrateLegacy();
    expect(store.has(V1)).toBe(false);
    expect(loadHints()).toEqual({});
  });

  it('survives a corrupt v1 blob', () => {
    store.set(V1, 'not json at all');
    expect(() => migrateLegacy()).not.toThrow();
  });
});

describe('newDay', () => {
  it('mints a start time, which is what makes promotion idempotent', () => {
    const a = newDay('2026-08-10', 3, 2, 'metric');
    expect(Number.isNaN(Date.parse(a.startedAt))).toBe(false);
    expect(a.entries).toEqual({});
  });

  it('captures the unit system in force, so a mid-session toggle is survivable', () => {
    expect(newDay('2026-08-10', 3, 2, 'imperial').units).toBe('imperial');
  });
});
