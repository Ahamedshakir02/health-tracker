import type { ISODate, MealEntry, MealSlot, SavedFood } from '../types';

/** The portions offered when logging a saved food. */
export const PORTIONS = [
  { value: 0.5, label: '½' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1½' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A saved food as a meal, at a portion. Calories round to whole numbers and
 * grams to one decimal, so half a 155 kcal egg is 78 kcal rather than 77.5.
 */
export function mealFromFood(
  food: SavedFood,
  portion: number,
  slot: MealSlot,
): Omit<MealEntry, 'id' | 'date'> {
  const factor = Number.isFinite(portion) && portion > 0 ? portion : 1;
  const label = factor === 1 ? food.name : `${food.name} ×${factor}`;
  return {
    name: label,
    slot,
    calories: Math.round(food.calories * factor),
    proteinG: round1(food.proteinG * factor),
    carbsG: round1(food.carbsG * factor),
    fatG: round1(food.fatG * factor),
    ...(food.fiberG ? { fiberG: round1(food.fiberG * factor) } : {}),
  };
}

const key = (name: string) => name.trim().toLowerCase();

/**
 * Add a food to the list, replacing one with the same name rather than keeping
 * two. Saving "Oats" again with new numbers is a correction, not a second food.
 * The newest goes first, since it is the one most likely to be logged next.
 */
export function upsertFood(foods: SavedFood[], food: SavedFood): SavedFood[] {
  return [food, ...foods.filter((f) => key(f.name) !== key(food.name))];
}

/**
 * Copies of one day's meals onto another, with fresh ids. Pass a slot to copy
 * just that meal ("same breakfast as yesterday"), or none for the whole day.
 */
export function copyMeals(
  meals: MealEntry[],
  from: ISODate,
  to: ISODate,
  makeId: () => string,
  slot?: MealSlot,
): MealEntry[] {
  return meals
    .filter((m) => m.date === from && (slot === undefined || m.slot === slot))
    .map((m) => ({ ...m, id: makeId(), date: to }));
}
