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
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the built bundle
npm test           # unit tests (vitest)
npm run typecheck  # types only
npm run audit      # fail on any high-severity dependency advisory
```

Node 20.19+ required (Vite 8).

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

**Firebase (sync + sign-in).** Fill in `.env` and the app gates itself behind a login
screen and syncs live across every device on the account:

1. Create a project at <https://console.firebase.google.com>.
2. Project settings → Your apps → Web app → copy the config values.
3. Build → Firestore Database → Create database.
4. Build → Authentication → Sign-in method → enable **Google** and **Email/Password**.
   Leave **Anonymous** off — this app refuses accounts with no email address.
5. `cp .env.example .env`, paste the values in, set `VITE_ALLOWED_EMAIL`, restart the
   dev server.
6. Paste `firestore.rules` into Firestore → Rules and Publish.

The first time you sign in on a device that already has local history, that history is
pushed up to the empty account rather than being replaced by a blank one.

## Access control

The app is private to a single address. That is enforced in two places, and only the
second one counts:

| Where | What it does |
|---|---|
| `VITE_ALLOWED_EMAIL` (`src/lib/firebase.ts`) | Produces a readable error and signs the wrong account straight back out. Cosmetic — it ships in the bundle and can be edited by anyone holding the browser. |
| `owners()` in `firestore.rules` | The real boundary. Firebase checks it server-side on every read and write, so a tampered client gets `permission-denied` and nothing else. |

**Both must be changed together** when the owner address changes, then
`firebase deploy --only firestore:rules`.

The rules also restrict writes to the five known slice documents and require each to be
exactly `{ value: … }`, so an account cannot repurpose the database as general storage.
If you only ever sign in with Google, uncomment the `email_verified` line in
`firestore.rules` to tighten it further — do not do that while using an unverified
email/password account, or you will lock yourself out of your own data.

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
| **Trainer** | Readiness score, a generated week of sessions with per-block detail, deload logic |
| **Body** | Weight, body fat %, waist / chest / hips, BMI, trend chart with a goal line |
| **Food** | Meals by slot, calories and macros, daily targets, one-click re-log of recent foods |
| **Move** | Workouts (type, minutes, intensity, distance, burn), daily steps, active-minute charts |
| **Habits** | Sleep hours and quality, resting HR, water, mood, notes, habit chips with streaks |
| **Settings** | Profile, units, theme, targets, habits, health-data import, data and account |

## Trainer

The Trainer screen builds a week from what you have actually logged rather than from a
questionnaire. It is deterministic and runs entirely offline — deliberately, because this
is a static site and any model API key would be inlined into the bundle for anyone to
read.

It reads four signals and normalises over whichever ones have data behind them, so not
logging resting heart rate does not permanently cap your score:

| Signal | Weight | What moves it |
|---|---|---|
| Sleep | 35 | 7-day mean against your sleep target |
| Freshness | 25 | Hard sessions in the last 72 h, consecutive training days |
| Resting heart rate | 20 | Last 3 days against your own 28-day baseline |
| Consistency | 20 | Sessions per week over the last month against your target |

The score picks a verdict — push, steady, hold, deload — which sets the number of
sessions and caps intensity. Volume steps up by about 10% a week against your real
4-week average, every fourth week is lighter, and the split leans toward conditioning
or lifting depending on whether your goal weight is below or above where you are.

It is general fitness guidance, not medical advice.

## Importing from Google Fit, Apple Health and the rest

There is no live link on offer, and the reason is worth stating plainly: Google retired
the Fit REST API, and its replacement — Health Connect — is an on-device Android
datastore with no web-facing API at all. Apple Health is the same. A page running in a
browser has nothing to connect to. Every one of those apps does export a file, so
Settings → **Connect health data** reads those:

| App | File |
|---|---|
| Google Fit | [Takeout](https://takeout.google.com) → Fit → `Daily activity metrics.csv` |
| Apple Health | Health → profile → Export All Health Data → `export.xml` |
| Health Connect | Its own backup is an encrypted archive — export CSV from Fitbit / Garmin / Samsung Health instead |
| Anything else | Any CSV with a date column; the importer reads the headers |

Steps, weight, sleep, resting heart rate, water and workouts are picked up; the preview
lists what was found and what was ignored before anything is written. Merging defaults
to **fill gaps only**, which never overwrites something you typed by hand — devices
disagree constantly, and silently replacing a corrected weight with a bad scale reading
is how people stop trusting an app.

Apple exports are scanned linearly rather than parsed into a DOM: a few years of history
is routinely several hundred MB, which a DOM would not survive.

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
  components/   charts.tsx (Recharts wrappers), ui.tsx (tiles, fields, pills),
                ErrorBoundary.tsx, HealthLink.tsx (export import UI)
  lib/          calc.ts, dates.ts, units.ts, validate.ts, store.ts,
                firestoreStore.ts, firebase.ts, trainer.ts, healthImport.ts, sample.ts
                *.test.ts alongside each
  pages/        Dashboard, Trainer, Body, Food, Movement, Daily, Settings, Login
  state/        HealthProvider.tsx — active store, auth, all mutations
  types.ts      the data model and defaults
firestore.rules the enforced access rules
```

Every path that takes data the app did not create — imported JSON, a health export,
whatever is already in localStorage or Firestore — goes through `lib/validate.ts`, which
rebuilds each record field by field and drops anything that fails. Non-finite numbers are
rejected outright: `Number('1e999')` is `Infinity`, and `JSON.stringify` writes that back
as `null`.

This is a personal-tracking tool, not a medical device. BMI bands are the standard
adult ranges and are a rough population signal, not a diagnosis.
