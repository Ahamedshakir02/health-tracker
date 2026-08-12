/** All dates are ISO calendar days: 'YYYY-MM-DD'. */
export type ISODate = string;

export type UnitSystem = 'metric' | 'imperial';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Intensity = 'low' | 'moderate' | 'high';

/**
 * Canonical storage units are always metric (kg, cm, ml, minutes).
 * Imperial is a display-time conversion only — see `lib/units.ts`.
 */
export interface WeightEntry {
  id: string;
  date: ISODate;
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  chestCm?: number;
  hipCm?: number;
  note?: string;
}

export interface MealEntry {
  id: string;
  date: ISODate;
  slot: MealSlot;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface WorkoutEntry {
  id: string;
  date: ISODate;
  type: string;
  minutes: number;
  intensity: Intensity;
  caloriesBurned?: number;
  distanceKm?: number;
  note?: string;
}

/** One row per calendar day for the metrics that are logged once daily. */
export interface DayLog {
  date: ISODate;
  sleepHours?: number;
  sleepQuality?: 1 | 2 | 3 | 4 | 5;
  waterMl?: number;
  mood?: 1 | 2 | 3 | 4 | 5;
  steps?: number;
  restingHr?: number;
  /** habitId -> done */
  habits: Record<string, boolean>;
  note?: string;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  archived?: boolean;
}

export interface Goals {
  weightKg?: number;
  calories: number;
  proteinG: number;
  waterMl: number;
  sleepHours: number;
  steps: number;
  workoutsPerWeek: number;
}

export interface Settings {
  name: string;
  heightCm?: number;
  birthYear?: number;
  units: UnitSystem;
  theme: 'system' | 'light' | 'dark';
  goals: Goals;
  habits: Habit[];
}

export interface HealthData {
  version: 1;
  settings: Settings;
  weights: WeightEntry[];
  meals: MealEntry[];
  workouts: WorkoutEntry[];
  days: DayLog[];
}

/** The four independently-persisted slices, so one meal write doesn't rewrite everything. */
export type Section = 'settings' | 'weights' | 'meals' | 'workouts' | 'days';

export const DEFAULT_HABITS: Habit[] = [
  { id: 'h_stretch', name: 'Stretch', emoji: '🧘' },
  { id: 'h_vitamins', name: 'Vitamins', emoji: '💊' },
  { id: 'h_outside', name: 'Time outside', emoji: '🌤️' },
  { id: 'h_noalcohol', name: 'No alcohol', emoji: '🚫' },
];

export const DEFAULT_DATA: HealthData = {
  version: 1,
  settings: {
    name: '',
    units: 'metric',
    theme: 'system',
    goals: {
      calories: 2200,
      proteinG: 130,
      waterMl: 2500,
      sleepHours: 8,
      steps: 8000,
      workoutsPerWeek: 4,
    },
    habits: DEFAULT_HABITS,
  },
  weights: [],
  meals: [],
  workouts: [],
  days: [],
};
