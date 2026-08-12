# Vitals — health tracker

A private health tracker for weight and body composition, food and macros, workouts
and steps, and sleep / water / mood / habits. React + TypeScript + Vite, with two
storage backends: local JSON out of the box, Firebase Firestore when you configure it.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # typecheck + production bundle into dist/
npm run preview  # serve the built bundle
```

Node 18+ required.

## Try it with data

Settings → **Load demo data** fills 90 days of plausible history so every chart has
something to say. **Delete all data** clears it again.

## Where your data lives

**Local JSON (default).** Everything is kept in `localStorage` under `vitals.health.v1`
and round-trips through a real `.json` file:

- **Export JSON** downloads `vitals-health-YYYY-MM-DD.json` — the complete history in
  one file. That file is your backup.
- **Import JSON** reads one back. Import *replaces* what's currently stored rather
  than merging, so export first if you're unsure.

**Firebase (optional sync).** Fill in `.env` and the app switches to Firestore once
you sign in, syncing live across every device on the same account:

1. Create a project at <https://console.firebase.google.com>.
2. Project settings → Your apps → Web app → copy the config values.
3. Build → Firestore Database → Create database.
4. Build → Authentication → Sign-in method → enable **Email/Password** and **Anonymous**.
5. `cp .env.example .env`, paste the values in, restart the dev server.
6. Paste `firestore.rules` into Firestore → Rules so each account can only read and
   write its own data.

Then Settings → Cloud sync → sign in. To carry local history over, Export JSON while
signed out, sign in, and Import it.

Firestore layout — one document per slice, so logging a meal rewrites only the meals
document:

```
users/{uid}/slices/settings   { value: { ...settings } }
users/{uid}/slices/weights    { value: [ ...WeightEntry ] }
users/{uid}/slices/meals      { value: [ ...MealEntry ] }
users/{uid}/slices/workouts   { value: [ ...WorkoutEntry ] }
users/{uid}/slices/days       { value: [ ...DayLog ] }
```

A Firestore document caps at 1 MB, which is comfortably years of personal logging.
If you ever outgrow it, the slice that grows fastest is `meals` — split it by year
before anything else.

## What's tracked

| Screen | Contents |
|---|---|
| **Today** | Headline tiles, 90-day weight trend, this week's calories, a 7-day table of everything |
| **Body** | Weight, body fat %, waist / chest / hips, BMI, trend chart with a goal line |
| **Food** | Meals by slot, calories and macros, daily targets, one-click re-log of recent foods |
| **Move** | Workouts (type, minutes, intensity, distance, burn), daily steps, active-minute charts |
| **Habits** | Sleep hours and quality, resting HR, water, mood, notes, habit chips with streaks |
| **Settings** | Profile, metric/imperial, theme, all targets, habit management, data and sync |

## Notes on the design

- **Units.** Everything is stored metric (kg, cm, ml, km); imperial is a display-time
  conversion, so switching the toggle never rewrites or rounds your history.
- **Weight trend.** Day-to-day scale weight is mostly water. The raw readings are drawn
  in neutral ink and the 7-day centred rolling mean carries the series colour — the
  trend line is the thing to read.
- **Dates.** ISO calendar days in local time; `toISOString()` is deliberately avoided
  because it shifts the day across the UTC offset.
- **Charts.** Single-hue-per-measure, one y-axis each, target lines rather than second
  axes, tooltips on every plot, and a dark palette stepped for the dark surface rather
  than inverted.

## Layout

```
src/
  components/   charts.tsx (Recharts wrappers), ui.tsx (tiles, fields, pills)
  lib/          calc.ts, dates.ts, units.ts, store.ts, firestoreStore.ts, firebase.ts, sample.ts
  pages/        Dashboard, Body, Food, Movement, Daily, Settings
  state/        HealthProvider.tsx — active store, auth, all mutations
  types.ts      the data model and defaults
firestore.rules per-user access rules
```

This is a personal-tracking tool, not a medical device. BMI bands are the standard
adult ranges and are a rough population signal, not a diagnosis.
