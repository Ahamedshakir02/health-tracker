/** All dates are ISO calendar days: 'YYYY-MM-DD'. */
export type ISODate = string;

export type UnitSystem = 'metric' | 'imperial';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * Which set of movements the Trainer shows.
 *
 * The gym book has two home editions that restate it exercise for exercise —
 * same schedules, same days, same order, same rep counts, every movement
 * swapped for one you can do at home. So this selects a presentation of one
 * plan, not a different plan. The substitutions live in `data/homePlans.ts`.
 */
export type EquipmentMode = 'gym' | 'household' | 'bodyweight';

/** The same three, as a value — validation needs to test membership. */
export const EQUIPMENT_MODES = [
  'gym',
  'household',
  'bodyweight',
] as const satisfies readonly EquipmentMode[];

/**
 * What each mode calls itself, and what it assumes you have to hand.
 *
 * Here rather than in `data/homePlans.ts` so that naming the modes does not
 * drag the substitution tables in with it. Settings shows these three lines and
 * nothing else; the tables are ~19 kB gzipped and belong only to the Trainer.
 */
export const EQUIPMENT_NOTES: Record<EquipmentMode, { label: string; needs: string }> = {
  gym: { label: 'Gym', needs: 'The gym floor and its equipment, as the book is written.' },
  household: {
    label: 'Household items',
    needs:
      'A sturdy chair, a table, a doorway, a wall, a step, a towel, a backpack loaded with books, water bottles or shopping bags.',
  },
  bodyweight: { label: 'Bodyweight only', needs: 'Your body, the floor and a wall. Nothing else.' },
};
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
  /**
   * Set when this row was created by finishing a Trainer day or a mobility
   * routine, so the two can be updated or removed together instead of drifting
   * apart. Must be listed in validate.ts or it is dropped on the first load.
   */
  sessionId?: string;
}

/**
 * A set that was actually completed in the gym.
 *
 * `index` is the set's 1-based position in the exercise, kept explicitly so a
 * skipped middle set stays unambiguous — sets 1 and 3 done is not the same
 * record as sets 1 and 2 done, and an array with a hole cannot say which.
 */
export interface SetLog {
  index: number;
  reps: number;
  /** Canonical kg, like every other measurement. 0 is real — pullups, dips. */
  weightKg: number;
}

export interface SessionExercise {
  /** Stable movement identity across schedules — see lib/movementKey.ts. */
  key: string;
  /**
   * Name and section as they were when this was recorded. Denormalised on
   * purpose: regenerating trainingPlan.ts must never rewrite what your logbook
   * says you did.
   */
  name: string;
  section: string;
  sectionIndex: number;
  n: number;
  plannedSets: number;
  plannedReps: number;
  /** Only the sets actually completed. An untouched exercise is omitted. */
  sets: SetLog[];
}

/** One stretch held in a cool-down or a mobility routine. */
export interface StretchLog {
  key: string;
  name: string;
  seconds: number;
}

/** A training day from the schedule book, as it was actually performed. */
export interface StrengthSession {
  id: string;
  kind: 'strength';
  date: ISODate;
  /** ISO timestamp of the first set ticked. Seeds `id`, so promotion is idempotent. */
  startedAt: string;
  finishedAt?: string;
  scheduleId: number;
  day: number;
  focus: string;
  exercises: SessionExercise[];
  /** The cool-down, folded in rather than logged as a second session. */
  cooldown?: StretchLog[];
  durationMin?: number;
  /** The WorkoutEntry written alongside, so the pair stays linked. */
  workoutId?: string;
}

/** A stretching routine run on its own from the Mobility section. */
export interface MobilitySession {
  id: string;
  kind: 'mobility';
  date: ISODate;
  startedAt: string;
  finishedAt?: string;
  routineId: string;
  title: string;
  moves: StretchLog[];
  durationMin?: number;
  workoutId?: string;
}

export type WorkoutSession = StrengthSession | MobilitySession;

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

/**
 * The schedule you are actually working through.
 *
 * Note there is no `nextDay` counter here. Which day comes next is *derived*
 * from the sessions you have logged (see lib/programme.ts), so finishing a day
 * advances the rotation as a side effect of saving the session — one write, no
 * second document to keep in step, and it syncs across devices for free.
 */
export interface Programme {
  scheduleId: number;
  /** Sessions logged before this don't count toward the rotation. */
  startedAt: string;
  /** Explicit "jump to day N", honoured until a newer session overrides it. */
  skipToDay?: number;
  skipSetAt?: string;
}

/** In-gym preferences. Change rarely, so they ride the settings slice. */
export interface TrainerPrefs {
  /** Rest countdown in seconds. 0 turns the timer off. */
  restSeconds: number;
  sound: boolean;
  /** Hold a screen wake lock while a session is in progress. */
  keepAwake: boolean;
  /** Append a matched cool-down to the foot of each training day. */
  cooldown: boolean;
  /**
   * Which set of movements the Trainer shows. The schedule, its days, their
   * order and their rep counts are the same in all three — only the exercise
   * on each card changes. See `src/data/homePlans.ts`.
   */
  equipment: EquipmentMode;
}

/**
 * Biological sex, for the equations that need it.
 *
 * Only where it changes a number: BMR, and the Navy body-fat estimate. Asked
 * once, optional, and the estimates say they are estimates when it is absent
 * rather than quietly assuming one.
 */
export type Sex = 'male' | 'female';

export interface Settings {
  name: string;
  /**
   * The account's picture, when the provider supplied one. Google gives a
   * photoURL; email sign-up has none and falls back to initials.
   */
  avatarUrl?: string;
  sex?: Sex;
  heightCm?: number;
  birthYear?: number;
  units: UnitSystem;
  theme: 'system' | 'light' | 'dark';
  goals: Goals;
  habits: Habit[];
  programme?: Programme;
  trainer?: TrainerPrefs;
  /**
   * Set once the first-run questions have been answered or skipped. Absence is
   * what triggers onboarding, so it must be written even on skip — otherwise a
   * user who genuinely wants no name gets asked on every sign-in.
   */
  onboardedAt?: string;
}

export interface HealthData {
  version: 1;
  settings: Settings;
  weights: WeightEntry[];
  meals: MealEntry[];
  workouts: WorkoutEntry[];
  days: DayLog[];
  sessions: WorkoutSession[];
}

/** The independently-persisted slices, so one meal write doesn't rewrite everything. */
export type Section = 'settings' | 'weights' | 'meals' | 'workouts' | 'days' | 'sessions';

export const DEFAULT_TRAINER_PREFS: TrainerPrefs = {
  restSeconds: 90,
  sound: true,
  keepAwake: true,
  cooldown: true,
  equipment: 'gym',
};

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
  sessions: [],
};
