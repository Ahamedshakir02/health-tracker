import { describe, expect, it } from 'vitest';
import { copyMeals, mealFromFood, upsertFood } from './foods';
import type { MealEntry, SavedFood } from '../types';

const oats: SavedFood = {
  id: 'f1',
  name: 'Oats',
  portion: '1 bowl',
  calories: 155,
  proteinG: 5.3,
  carbsG: 27,
  fatG: 2.7,
};

describe('mealFromFood', () => {
  it('logs one portion under the food name', () => {
    expect(mealFromFood(oats, 1, 'breakfast')).toEqual({
      name: 'Oats',
      slot: 'breakfast',
      calories: 155,
      proteinG: 5.3,
      carbsG: 27,
      fatG: 2.7,
    });
  });

  it('scales every number and names the portion', () => {
    const meal = mealFromFood(oats, 1.5, 'lunch');
    expect(meal.name).toBe('Oats ×1.5');
    expect(meal.calories).toBe(233);
    expect(meal.proteinG).toBe(8);
    expect(meal.carbsG).toBe(40.5);
  });

  it('scales fibre when the food has it', () => {
    expect(mealFromFood({ ...oats, fiberG: 4 }, 2, 'breakfast').fiberG).toBe(8);
    expect(mealFromFood(oats, 2, 'breakfast')).not.toHaveProperty('fiberG');
  });

  it('treats a nonsense portion as one', () => {
    expect(mealFromFood(oats, 0, 'snack').calories).toBe(155);
    expect(mealFromFood(oats, Number.NaN, 'snack').calories).toBe(155);
  });
});

describe('upsertFood', () => {
  it('puts the newest first', () => {
    const egg = { ...oats, id: 'f2', name: 'Egg' };
    expect(upsertFood([oats], egg).map((f) => f.id)).toEqual(['f2', 'f1']);
  });

  it('replaces a food saved again under the same name', () => {
    const fixed = { ...oats, id: 'f9', name: ' oats ', calories: 160 };
    const out = upsertFood([oats], fixed);
    expect(out).toHaveLength(1);
    expect(out[0].calories).toBe(160);
  });
});

describe('copyMeals', () => {
  const meal = (id: string, date: string, slot: MealEntry['slot']): MealEntry => ({
    id,
    date,
    slot,
    name: id,
    calories: 100,
    proteinG: 1,
    carbsG: 1,
    fatG: 1,
  });
  const meals = [
    meal('a', '2026-10-20', 'breakfast'),
    meal('b', '2026-10-20', 'lunch'),
    meal('c', '2026-10-19', 'breakfast'),
  ];
  let n = 0;
  const makeId = () => `new${(n += 1)}`;

  it('copies a whole day with new ids and the new date', () => {
    const out = copyMeals(meals, '2026-10-20', '2026-10-21', makeId);
    expect(out.map((m) => m.name)).toEqual(['a', 'b']);
    expect(out.every((m) => m.date === '2026-10-21' && m.id.startsWith('new'))).toBe(true);
  });

  it('copies one meal when given a slot', () => {
    const out = copyMeals(meals, '2026-10-20', '2026-10-21', makeId, 'lunch');
    expect(out.map((m) => m.name)).toEqual(['b']);
  });

  it('copies nothing from an empty day', () => {
    expect(copyMeals(meals, '2026-10-01', '2026-10-21', makeId)).toEqual([]);
  });
});
