import { DEFAULT_DATA, type DayLog, type HealthData, type MealEntry, type WorkoutEntry } from '../types';
import { lastNDays } from './dates';

/** Deterministic pseudo-random so the demo looks the same every time it loads. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const FOODS: Omit<MealEntry, 'id' | 'date'>[] = [
  { slot: 'breakfast', name: 'Oats, banana & peanut butter', calories: 480, proteinG: 17, carbsG: 62, fatG: 18 },
  { slot: 'breakfast', name: 'Greek yoghurt & berries', calories: 290, proteinG: 24, carbsG: 28, fatG: 8 },
  { slot: 'breakfast', name: 'Two eggs on toast', calories: 380, proteinG: 22, carbsG: 30, fatG: 18 },
  { slot: 'lunch', name: 'Chicken & rice bowl', calories: 620, proteinG: 46, carbsG: 68, fatG: 16 },
  { slot: 'lunch', name: 'Lentil soup & bread', calories: 470, proteinG: 21, carbsG: 65, fatG: 12 },
  { slot: 'lunch', name: 'Tuna salad wrap', calories: 520, proteinG: 34, carbsG: 48, fatG: 20 },
  { slot: 'dinner', name: 'Salmon, potatoes & greens', calories: 700, proteinG: 44, carbsG: 55, fatG: 30 },
  { slot: 'dinner', name: 'Beef stir fry & noodles', calories: 760, proteinG: 42, carbsG: 78, fatG: 28 },
  { slot: 'dinner', name: 'Paneer curry & rice', calories: 690, proteinG: 26, carbsG: 82, fatG: 26 },
  { slot: 'snack', name: 'Protein shake', calories: 180, proteinG: 28, carbsG: 6, fatG: 3 },
  { slot: 'snack', name: 'Apple & almonds', calories: 220, proteinG: 6, carbsG: 24, fatG: 12 },
];

const WORKOUTS: Omit<WorkoutEntry, 'id' | 'date'>[] = [
  { type: 'Run', minutes: 38, intensity: 'moderate', caloriesBurned: 400, distanceKm: 6.4 },
  { type: 'Strength', minutes: 55, intensity: 'high', caloriesBurned: 320 },
  { type: 'Cycling', minutes: 65, intensity: 'moderate', caloriesBurned: 520, distanceKm: 24 },
  { type: 'Yoga', minutes: 30, intensity: 'low', caloriesBurned: 110 },
  { type: 'Walk', minutes: 45, intensity: 'low', caloriesBurned: 180, distanceKm: 4.2 },
  { type: 'HIIT', minutes: 25, intensity: 'high', caloriesBurned: 300 },
];

/** ~90 days of plausible history so the charts have something to say on first run. */
export function sampleData(): HealthData {
  const random = rng(20260812);
  const days = lastNDays(90);
  const habits = DEFAULT_DATA.settings.habits;

  const weights = days
    .filter((_, i) => i % 2 === 0)
    .map((date, i) => {
      // Slow downward drift with day-to-day water noise on top.
      const base = 82.4 - i * 0.085;
      const noise = (random() - 0.5) * 0.9;
      return {
        id: `w_demo_${date}`,
        date,
        weightKg: Math.round((base + noise) * 10) / 10,
        ...(i % 7 === 0
          ? { bodyFatPct: Math.round((22.5 - i * 0.06) * 10) / 10, waistCm: Math.round(88 - i * 0.12) }
          : {}),
      };
    });

  const meals: MealEntry[] = [];
  const workouts: WorkoutEntry[] = [];
  const dayLogs: DayLog[] = [];

  days.forEach((date, dayIndex) => {
    const weekday = new Date(date).getDay();

    // Three meals plus a snack most days.
    const picks = [
      FOODS[Math.floor(random() * 3)],
      FOODS[3 + Math.floor(random() * 3)],
      FOODS[6 + Math.floor(random() * 3)],
    ];
    if (random() > 0.35) picks.push(FOODS[9 + Math.floor(random() * 2)]);
    picks.forEach((food, i) => {
      meals.push({ ...food, id: `m_demo_${date}_${i}`, date });
    });

    // Roughly four sessions a week, rest days on Sunday.
    if (weekday !== 0 && random() > 0.42) {
      const w = WORKOUTS[Math.floor(random() * WORKOUTS.length)];
      workouts.push({ ...w, id: `k_demo_${date}`, date });
    }

    const habitState: Record<string, boolean> = {};
    habits.forEach((h, i) => {
      habitState[h.id] = random() > 0.28 - i * 0.03;
    });

    dayLogs.push({
      date,
      sleepHours: Math.round((6.6 + random() * 2.1) * 4) / 4,
      sleepQuality: (Math.min(5, Math.max(1, Math.round(2 + random() * 3))) as DayLog['sleepQuality']),
      waterMl: 250 * Math.round(6 + random() * 5),
      mood: (Math.min(5, Math.max(1, Math.round(2.5 + random() * 2.5))) as DayLog['mood']),
      steps: Math.round(5200 + random() * 7200),
      restingHr: Math.round(56 + random() * 8),
      habits: habitState,
      ...(dayIndex === days.length - 1 ? { note: 'Felt strong on the run today.' } : {}),
    });
  });

  return {
    version: 1,
    settings: {
      ...DEFAULT_DATA.settings,
      name: '',
      heightCm: 178,
      goals: { ...DEFAULT_DATA.settings.goals, weightKg: 76 },
    },
    weights,
    meals,
    workouts,
    days: dayLogs,
  };
}
