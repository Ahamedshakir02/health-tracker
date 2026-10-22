import { describe, expect, it } from 'vitest';
import { itemMacros, parseScan, scanErrorMessage, totalMacros } from './foodScan';

const rice = {
  name: 'Basmati rice, cooked',
  grams: 180,
  per100g: { calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 },
  confidence: 'high' as const,
};

describe('parseScan', () => {
  it('reads a well-formed reply', () => {
    const out = parseScan(JSON.stringify({ items: [rice], note: 'Oil is a guess' }));
    expect(out.items).toEqual([rice]);
    expect(out.note).toBe('Oil is a guess');
  });

  it('returns no items for junk rather than throwing', () => {
    expect(parseScan('not json').items).toEqual([]);
    expect(parseScan(null).items).toEqual([]);
    expect(parseScan({ items: 'nope' }).items).toEqual([]);
  });

  it('pulls JSON out of a code fence', () => {
    const out = parseScan('```json\n' + JSON.stringify({ items: [rice] }) + '\n```');
    expect(out.items).toHaveLength(1);
  });

  it('drops nameless items and zeroes bad numbers', () => {
    const out = parseScan({
      items: [
        { name: '', grams: 100, per100g: {} },
        { name: 'Curry', grams: -40, per100g: { calories: 'lots', proteinG: 9 } },
      ],
    });
    expect(out.items).toHaveLength(1);
    expect(out.items[0].grams).toBe(0);
    expect(out.items[0].per100g.calories).toBe(0);
    expect(out.items[0].per100g.proteinG).toBe(9);
    expect(out.items[0].confidence).toBe('low');
  });

  it('caps per-100 g figures at what food can physically hold', () => {
    const out = parseScan({ items: [{ name: 'X', grams: 50, per100g: { calories: 4000, fatG: 300 } }] });
    expect(out.items[0].per100g.calories).toBe(900);
    expect(out.items[0].per100g.fatG).toBe(100);
  });
});

describe('itemMacros', () => {
  it('scales per-100 g values to the portion', () => {
    expect(itemMacros(rice)).toEqual({
      calories: 234,
      proteinG: 4.9,
      carbsG: 50.4,
      fatG: 0.5,
      fiberG: 0.7,
    });
  });

  it('follows a corrected portion', () => {
    expect(itemMacros({ ...rice, grams: 100 }).calories).toBe(130);
    expect(itemMacros({ ...rice, grams: 0 }).calories).toBe(0);
  });
});

describe('totalMacros', () => {
  it('adds the plate up', () => {
    const t = totalMacros([rice, { ...rice, grams: 100 }]);
    expect(t.calories).toBe(364);
  });
});

describe('scanErrorMessage', () => {
  it('names the quota limit', () => {
    expect(scanErrorMessage(new Error('429 RESOURCE_EXHAUSTED'))).toMatch(/limit/);
  });

  it('points at setup when the API or App Check refuses', () => {
    expect(scanErrorMessage(new Error('403 PERMISSION_DENIED'))).toMatch(/not switched on/);
  });
});
