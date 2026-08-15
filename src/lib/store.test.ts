import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStore } from './store';
import { DEFAULT_DATA, type WeightEntry } from '../types';

/** Minimal localStorage over a Map — the suite runs in the node environment. */
function installLocalStorage() {
  const map = new Map<string, string>();
  const stub = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = stub;
  return map;
}

describe('LocalStore.saveSection', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('keeps both changes when two sections are saved in the same tick', async () => {
    const store = new LocalStore();
    await store.saveAll(DEFAULT_DATA);

    const settings = { ...DEFAULT_DATA.settings, name: 'Shakir', onboardedAt: '2026-08-15' };
    const weights: WeightEntry[] = [{ id: 'w1', date: '2026-08-15', weightKg: 72.5 }];

    // Fired together, exactly as onboarding does: profile plus a first reading.
    // localStorage holds one blob, so an unsequenced read-modify-write would let
    // the second save overwrite the first with a stale snapshot.
    await Promise.all([store.saveSection('settings', settings), store.saveSection('weights', weights)]);

    const loaded = await store.load();
    expect(loaded.settings.name).toBe('Shakir');
    expect(loaded.settings.onboardedAt).toBe('2026-08-15');
    expect(loaded.weights).toHaveLength(1);
    expect(loaded.weights[0]?.weightKg).toBe(72.5);
  });

  it('applies sequential saves in order', async () => {
    const store = new LocalStore();
    await store.saveAll(DEFAULT_DATA);

    await store.saveSection('settings', { ...DEFAULT_DATA.settings, name: 'first' });
    await store.saveSection('settings', { ...DEFAULT_DATA.settings, name: 'second' });

    expect((await store.load()).settings.name).toBe('second');
  });

  it('round-trips every Settings field the app writes', async () => {
    const store = new LocalStore();
    // validate.ts drops any field it does not know about, so a new Settings key
    // added to the type but not the validator silently fails to persist. This
    // catches that class of bug rather than one instance of it.
    await store.saveSection('settings', {
      ...DEFAULT_DATA.settings,
      name: 'Shakir',
      heightCm: 175,
      birthYear: 2002,
      onboardedAt: '2026-08-15T00:00:00.000Z',
      goals: { ...DEFAULT_DATA.settings.goals, weightKg: 68 },
    });

    const s = (await store.load()).settings;
    expect(s.name).toBe('Shakir');
    expect(s.heightCm).toBe(175);
    expect(s.birthYear).toBe(2002);
    expect(s.onboardedAt).toBe('2026-08-15T00:00:00.000Z');
    expect(s.goals.weightKg).toBe(68);
  });
});
