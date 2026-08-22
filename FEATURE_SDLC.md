# Vitals — feature SDLC plan

What to build next in the health tracker, run through a full lifecycle: baseline,
requirements, design fit, prioritisation, test strategy, release plan, and maintenance.

Written against the repo as of commit `358ac3e` (18 Aug 2026). No code changes were made
to produce this document. Companion to `README.md` (what it does), `ARCHITECTURE.md` (how
it fits together) and `PROJECT_NOTES.md` (why).

> **Status, 19 Aug 2026.** Items **1, 4, 5, 13 and 17** have since shipped, along with
> mobility (which this document does not cover — see the note under Epic F) and a
> correction to six exercise demonstrations. The baseline table below is left as it was
> written, because a plan that quietly rewrites its own starting point stops being
> evidence of anything; what has changed since is marked ✅ in §3 instead.

---

## 1. Baseline — what exists today

| | |
|---|---|
| Stack | React 18 · TS · Vite 8 · Recharts · Firebase Auth + Firestore · plain CSS |
| Shape | Pure static SPA on Firebase Hosting (Spark/free). No server, no API layer, no CI |
| Screens | Today · Trainer · Body · Food · Move · Habits · Settings (+ Login, Onboarding) |
| Data | 5 slices — `settings`, `weights`, `meals`, `workouts`, `days` — one Firestore doc each |
| Trainer | 13 schedules · 46 days · 360 exercises · 111 animation clips |
| Tests | 111 vitest specs, pure logic only (`calc`, `dates`, `units`, `validate`, `store`, `healthImport`, `trainer`) |
| Code | ~7.5k lines of `src` excluding generated data |

**Known gaps already recorded in the repo:** Google sign-in never enabled; `src/lib/trainer.ts`
is dead code with live tests; Trainer set-ticking is device-local; tablet rail lightly verified;
no CI.

**Gaps found during this audit, not yet written down anywhere:**

1. **`site.webmanifest` exists but there is no service worker.** The app is installable but
   not offline-capable — which is the one place it is used most (a gym basement).
2. **Firestore offline persistence is not enabled.** `firebase.ts` uses the default
   memory cache, so a dropped connection loses the read cache on reload.
3. **Slice writes are last-write-wins on the whole array.** Two devices editing meals in the
   same window: the second `setDoc` replaces the first one's array wholesale. Currently
   invisible because there is one user on one device at a time; it becomes real the moment
   phone-and-laptop use overlaps.
4. **`Permissions-Policy` in `firebase.json` denies `camera`.** Any barcode or progress-photo
   feature needs that header edited first, or `getUserMedia` fails with a policy error that
   looks like a code bug.
5. **`firestore.rules` hard-codes the five slice ids.** Any new slice is `permission-denied`
   until the rules are deployed — and rules must go out *before* the hosting bundle, not with it.
6. **Recharts is the largest dependency** and is imported by pages that are all in one bundle;
   there is no route-level code splitting.

### The constraints any new feature has to respect

These are not preferences, they are load-bearing decisions in the existing design:

- **No server.** Anything needing a client secret (OAuth to Fitbit/Strava/Withings, an LLM key,
  scheduled push) does not fit the current deployment without adding Firebase Functions (needs
  the Blaze plan and a card on file) or an outside worker.
- **Zero third-party requests inside `/app`.** Stated in `PROJECT_NOTES.md` and enforced by CSP.
  A food database lookup breaks this — deliberately or not, it has to be a decision.
- **Everything stored metric**, imperial is display-time only (`lib/units.ts`).
- **Every foreign byte goes through `lib/validate.ts`**, rebuilt field by field. New record
  types need a new validator or they are a hole in that guarantee.
- **1 MB per Firestore document.** `meals` grows fastest.
- **Single mutation path:** `useHealth().update(section, fn)`. New data should ride that, not
  invent a second write path.

---

## 2. Requirements

Six epics, ordered by how much value they unlock per unit of work. Each has user stories,
acceptance criteria, the design change it implies, and its risks.

---

### Epic A — Make the gym data count

*The single highest-value gap in the product.* The Trainer already collects set-by-set weights
in the gym and then throws them away into a localStorage scratch key that never syncs and is
never read back. Every "serious lifter" feature in every competing app is downstream of that
one array.

**Stories**

- As a lifter, when I open an exercise I want to see *what I lifted last time* so I know what
  to load.
- As a lifter, I want a chart of estimated 1RM / top-set weight per exercise over time.
- As a lifter, I want a personal-record badge when I beat my best on a movement.
- As a lifter, I want a rest timer that starts when I tick a set.
- As a lifter, I want the screen to stay awake between sets.
- As a lifter, I want today's session to appear in Move / Today as a logged workout without
  typing it twice.

**Acceptance criteria**

- Completing a day in Trainer writes one durable session record: date, schedule, day, and per
  exercise the set/rep/weight actually recorded.
- Sessions survive a reinstall and appear on a second device within 5 s.
- Exercise card shows "Last: 40 kg × 12, 12, 10 — 4 Aug" when history exists, nothing when it
  doesn't.
- 1RM uses Epley (`w × (1 + r/30)`) and is labelled an estimate.
- Rest timer is per-user-configurable, survives a screen lock, and is silenced by
  `prefers-reduced-motion`/mute settings.
- Nothing regresses for a user with zero history.

**Design**

- New slice `sessions` → `users/{uid}/slices/sessions` `{ value: WorkoutSession[] }`.
  ```ts
  interface SetLog { reps: number; weightKg: number; done: boolean }
  interface SessionExercise { name: string; sectionIndex: number; n: number; sets: SetLog[] }
  interface WorkoutSession {
    id: string; date: ISODate; scheduleId: number; day: number;
    exercises: SessionExercise[]; durationMin?: number;
  }
  ```
- **Store weight in kg**, converting at the input like every other field — the current scratch
  key stores raw strings, which is fine for scratch and wrong for history.
- Keep `trainerProgress.ts` as the live in-session buffer. Promote to a `sessions` record on
  "finish day", or on first write of a new date. That keeps the write volume argument in
  `PROJECT_NOTES.md` intact: one Firestore write per session, not one per tap.
- Requires: `validate.ts` validator, `firestore.rules` `isKnownSlice` +`'sessions'`,
  `store.ts` `Section` union, `firestoreStore.ts` `SECTIONS`, migration for existing
  localStorage progress (best-effort: it has no dates, so import as "unknown date" or drop).
- Rest timer: `setTimeout` plus an `AudioContext` beep; **Screen Wake Lock API** for the awake
  screen (`navigator.wakeLock.request('screen')`, released on `visibilitychange`, feature-detected
  — no support on some older iOS, degrade silently).

**Risks** — 1 MB cap: a session is ~1–2 KB, so ~500+ sessions before it matters; shard by year
when it does. Set-log promotion must be idempotent or a re-render duplicates a session.

**Effort** — 4–6 days. History read-back and the chart are the bulk; timer and wake lock are an
afternoon each.

---

### Epic B — Make food logging fast enough to actually do

Today every meal is four hand-typed numbers. That is the reason food logs get abandoned in
week two. Four changes, in increasing cost:

**B1 — Saved foods + portion multiplier (no network, ~1 day).**
A `foods` list in `settings` (or its own slice): name, macros per 100 g / per serving. Logging
becomes "pick + ×1.5". The Food page already has "one-click re-log of recent foods" — this is
that, made durable and editable, with quantity.

**B2 — Copy a day / copy a meal (half a day).** "Same breakfast as yesterday" is one tap.

**B3 — Barcode scan → Open Food Facts (~2–3 days, and a privacy decision).**
[Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/) is free, needs no
API key, is CC-licensed and returns `nutriments` per 100 g, including good coverage of packaged
Indian products.

  - `BarcodeDetector` is Chrome/Android only — **not implemented in Safari on iOS**
    ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)). iOS needs a WASM
    decoder (`zxing-wasm`, lazy-loaded, ~300 KB) or a manual-entry fallback. Feature-detect,
    don't assume.
  - **Blockers before a line of code:** `Permissions-Policy` in `firebase.json` currently denies
    `camera`; CSP `connect-src` and `img-src` need the Open Food Facts origins.
  - **Privacy call:** this is the first third-party request inside `/app`. Off by default, behind
    a Settings toggle with a plain-English note ("looking up a barcode tells Open Food Facts you
    scanned that product"), keeps the guarantee honest.

**B4 — Free-text logging ("2 rotis, dal, one banana") (needs a server; see Epic F).**

**Acceptance criteria (B1–B3)** — a saved food logs in ≤2 taps; a scanned barcode prefills name
and macros and is editable before saving; an unknown barcode offers manual entry rather than an
error; nothing is written to Open Food Facts unless the user explicitly contributes.

---

### Epic C — Make the data say something

The app is a good logbook and a mute analyst. Everything here is pure arithmetic over data
already held, which is exactly where this codebase's test strategy is strongest.

- **Adaptive TDEE** — weekly average intake ± weight-trend slope × 7700 kcal/kg. After ~3 weeks
  of logs this is a far better maintenance number than any BMR formula, and it is ~40 lines in
  `calc.ts`. Show it beside the calorie goal with a confidence note (needs ≥14 days of both).
- **Energy balance tile** — intake vs goal vs estimated burn, weekly rather than daily, because
  daily is noise.
- **Weekly review** — one screen, Monday-dated: weight trend delta, adherence %, workout count,
  sleep mean, longest habit streak, the one number that moved most. Also the natural payload for
  a future notification.
- **Correlations, carefully** — sleep vs mood, sleep vs resting HR, steps vs weight trend.
  Present as a scatter plus an r value with an explicit "this is not causation, n=42 days" label.
  Refuse to draw below a minimum n.
- **Navy body-fat estimate** from waist/neck/height, offered next to the manual BF% field.
  Needs one new measurement (`neckCm`) on `WeightEntry`.
- **CSV export and a printable weekly/annual PDF.** JSON export exists; CSV is what a
  spreadsheet or a doctor's office actually wants. Printable = a CSS `@media print` sheet, not a
  PDF library.

**Effort** — 3–5 days for the lot. **Risk** — none technically; the risk is presenting a
correlation as a finding. Wording is the deliverable as much as the maths.

---

### Epic D — Work anywhere, remind me

- **D1 — Service worker (1–2 days, highest value in this epic).** Precache the hashed
  `/assets/**` and `/exercise-anim/**` (already `immutable`), network-first for the shell so a
  deploy is picked up, and an offline banner. Careful: the hosting default is
  `no-cache, must-revalidate` on the shell — the SW must not undo that with a stale-while-revalidate
  on `app.html`, or a phone runs last week's bundle. Use `vite-plugin-pwa` or ~80 hand-written
  lines; hand-written is more in keeping with the rest of this repo and avoids a CSP surprise.
- **D2 — Firestore persistent cache (an hour).** Switch `getFirestore` to `initializeFirestore(app,
  { localCache: persistentLocalCache() })`. Writes queue offline and flush on reconnect. This is
  the cheapest reliability win in the whole document.
- **D3 — Conflict handling (1 day).** With D2 live, two-device use becomes realistic and the
  whole-array overwrite in §1.3 becomes a real data-loss path. Cheapest sound fix: keep a
  per-slice `updatedAt` and merge by record `id` on conflict rather than replacing the array.
- **D4 — Reminders.** Honest constraints: iOS delivers Web Push **only to a PWA the user has
  added to the Home Screen**, and only after a user-gesture permission grant
  ([MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide),
  [Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)); there
  is no Notification Triggers API anywhere, so *scheduled* push needs a server to send it —
  Firebase Cloud Messaging + a scheduled Cloud Function, i.e. the Blaze plan. Sensible ladder:
  (a) in-app nudges and a badge while the tab is open — free, today; (b) Android/desktop
  `periodicSync` — free, partial coverage; (c) real scheduled push — costs a plan upgrade, do it
  last and only if (a) proves the habit.

---

### Epic E — Make it defensible

Not features; the things that stop features from breaking each other.

| Item | Why | Effort |
|---|---|---|
| **GitHub Actions CI** — `npm run typecheck && npm test && npm run build` on push/PR | Named as a known gap; 111 tests only run when someone remembers | 2 h |
| **Deploy from CI** via a Firebase service account, or move hosting to a git-push provider | Today a deploy needs your laptop | 2–4 h |
| **Route-level code splitting** — `React.lazy` the chart-heavy pages | Recharts dominates the bundle; Trainer users don't need it | 3 h |
| **Delete `src/lib/trainer.ts` + its 194 test lines** | Dead code with live tests is a false confidence signal | 15 min |
| **Enable Google sign-in** | "Continue with Google" errors on the live site today | 15 min |
| **A11y pass on Trainer** — set chips as real toggle buttons with `aria-pressed`, live region for the day meter | The rest of the app is careful here; the newest screen is least verified | 1 day |
| **Lighthouse/bundle budget in CI** | Prevents the slow slide | 2 h |

---

### Epic F — Strategic, decide before building

These change what the product *is*, not just what it does. None should start before A–E.

- **Multi-user.** `firestore.rules` is a single-address allowlist; opening up means
  `request.auth.uid == userId` plus a self-service onboarding path, an abuse story, a privacy
  policy that means it, and a support burden. It is a product decision disguised as a rules edit.
- **Wearable sync (Fitbit / Strava / Withings / Oura).** All four have real web OAuth APIs, unlike
  Apple Health and Health Connect. All four need a client secret exchanged server-side → a
  Cloudflare Worker (free) or Firebase Functions (Blaze). Realistically 3–5 days per provider
  including token refresh. Start with **Strava** (best docs, workouts are the least tediously
  logged data) or **Withings** (weight, which is the app's spine).
- **Confirmed: still no web path to Apple Health or Health Connect.** Google Fit's REST API is
  retired and Health Connect is an on-device Android datastore with no web-facing API
  ([Android developers](https://developer.android.com/health-and-fitness/health-connect/migration/fit)).
  The file-import approach in `healthImport.ts` remains correct and should stay the documented answer.
- **Natural-language / photo food logging.** Needs an LLM key, therefore a server, therefore the
  same worker as above; also the strongest possible break of the no-third-party promise, since it
  ships your food log to a model provider. Worth it only if B1–B3 prove insufficient.

---

## 3. Prioritisation

Value is "how much better is the app for its one user"; effort is solo-dev days.

| # | Item | Epic | Value | Effort | Do |
|---|---|---|---|---|---|
| 1 | Firestore persistent cache | D2 | High | 0.2 d | ✅ **Done** — with the multi-tab manager |
| 2 | Enable Google sign-in · delete dead trainer.ts | E | Med | 0.2 d | ◐ `trainer.ts` deleted; the app side is finished, the provider is still a console click — steps in `PROJECT_NOTES.md` |
| 3 | GitHub Actions CI | E | High | 0.3 d | ✅ **Done** — typecheck, tests, build |
| 4 | Workout history + "last time" + PRs | A | **Highest** | 4–6 d | ✅ **Done** — `sessions` slice, `lib/session.ts` |
| 5 | Rest timer + wake lock | A | High | 1 d | ✅ **Done** |
| 6 | Service worker / offline | D1 | High | 1–2 d | Sprint 2 |
| 7 | Saved foods + portions + copy day | B1/B2 | High | 1.5 d | Sprint 2 |
| 8 | Adaptive TDEE + energy balance | C | High | 1.5 d | Sprint 2 |
| 9 | Weekly review screen | C | Med | 1 d | Sprint 3 |
| 10 | CSV export + printable report | C | Med | 1 d | Sprint 3 |
| 11 | Barcode → Open Food Facts | B3 | Med-High | 2–3 d | Sprint 3 (after the privacy call) |
| 12 | Conflict-safe merge writes | D3 | Med | 1 d | Sprint 3 |
| 13 | Code splitting + a11y pass | E | Med | 1.5 d | ✅ **Done** — routes split (329 → 180 kB); Trainer a11y pass done |
| 14 | Correlations + Navy BF% | C | Med | 1.5 d | Sprint 4 |
| 15 | Push reminders | D4 | Med | 2 d + plan upgrade | Backlog |
| 16 | Wearable OAuth (Strava/Withings) | F | Med | 3–5 d each | Backlog |
| 17 | Multi-user | F | ? | 5 d+ | ✅ **Done** — open sign-up, verified email required, per-uid isolation |
| 18 | NL/photo food logging | F | Med | 3 d + server | Backlog |

Items 1–3 are under a day combined and remove three named gaps. Do them before anything else.

**What shipped on 19 Aug 2026**, against this table:

- **17 · Multi-user.** The decision was *open sign-up*. Google, or email and password with
  a verified address; each account private under its own uid. The two hard-coded email
  allowlists are gone; `firestore.rules` is the only place that decides anything now.
- **4 · The gym data counts.** A `sessions` slice stores what was actually lifted, set by
  set, in kilograms like every other measurement. Exercise cards show last time and your
  best set; a progression chart opens on demand.
- **New · Keep your place.** One schedule is *yours* and the Trainer opens on the next day
  in the rotation. The pointer is derived from the sessions logged rather than stored, so
  it cannot drift out of step with the history it describes.
- **5 · Rest timer and wake lock**, both off-switchable, both wall-clock based.
- **1 · Firestore persistent cache**, and **13 ·** route-level code splitting.
- **New · Mobility.** 7 routines, 61 stretches, and an automatic cool-down matched to the
  muscles each training day worked. Not in this plan at all — see below.
- **New · Six corrected demonstrations**, plus section-qualified media keys so one book
  name can mean two different lifts.

Mobility was added at the owner's request and deliberately outside the priority order
above. The general advice that it is a content business you cannot afford is about apps
that must film original instructor video; here the stretch photographs were already in the
public-domain dataset the exercise media comes from, so it cost a build-script change and
no licensing at all.

---

## 4. Decisions needed from you before Sprint 3

1. **Does `/app` stay free of third-party requests?** Barcode lookup, wearables and NL logging
   all break it. A Settings-gated opt-in preserves the spirit; an unconditional fetch does not.
2. **Stay on the Spark plan?** Scheduled push and Cloud Functions both need Blaze. A Cloudflare
   Worker keeps you free but adds a second vendor.
3. **Is this a personal tool or a product?** Everything in Epic F is only worth building under
   the second answer, and the security model changes shape.
4. **Is the schedule book permanent?** If yes, delete `trainer.ts` and stop maintaining its tests.

---

## 5. Test strategy

The existing rule — test the arithmetic, skip the components — is the right one and should hold.
Per epic:

| Area | Test | Where |
|---|---|---|
| Session records | round-trip through `validate.ts`; unknown/garbage fields dropped; kg conversion at boundaries | `validate.test.ts`, new `sessions.test.ts` |
| PR / 1RM | Epley against hand-worked values; ties; single-rep sets; zero weight | `calc.test.ts` |
| Adaptive TDEE | known synthetic series → known kcal; refuses below n=14; handles gaps | `calc.test.ts` |
| Merge-by-id conflict | two divergent arrays → union, newest wins per id, no dupes | new `merge.test.ts` |
| Open Food Facts mapping | fixture responses → `MealEntry`; missing `nutriments`; per-serving vs per-100g | new `offMap.test.ts`, fixtures committed, no live network in tests |
| Service worker | manual: build, preview, DevTools offline, hard reload, confirm the shell updates after a redeploy | checklist below |
| Regression floor | `npm run typecheck && npm test && npm run build` green in CI on every push | GitHub Actions |

Add one thing not currently present: a **smoke test that boots the app with `LocalStore` and
demo data** and asserts each route renders without throwing. Cheap (Playwright or a jsdom render),
and it catches the class of bug the current suite structurally cannot.

---

## 6. Release plan

Deploys are manual and hosting-only (`npm run deploy`). Two ordering rules matter:

1. **Rules before bundle.** Any new slice: `npm run deploy:rules` first, verify in the console,
   *then* deploy hosting. Reversed, the live app writes to a slice the rules refuse and users see
   `permission-denied`.
2. **Header changes are a separate, verified step.** `Permissions-Policy` (camera) and CSP edits in
   `firebase.json` / the HTML heads take effect on deploy and fail silently in dev — check the
   live response headers, and remember `npm run build` fails if the inline-script CSP hash drifted.

**Per-release checklist**

- [ ] `npm run typecheck && npm test && npm run build && npm run audit`
- [ ] Export a JSON backup of live data before any release that touches the data model
- [ ] Preview channel (`firebase hosting:channel:deploy preview`) and check on a phone
- [ ] Rules deployed and verified, if the slice list changed
- [ ] Deploy hosting; hard-reload; confirm the new bundle hash is live
- [ ] Verify one write and one read against real Firestore

**Rollback** — `firebase hosting:rollback` (or re-deploy the previous `dist/`) restores the
bundle in seconds. Data is the hard part: rules and slice shape do not roll back cleanly, which
is why the backup step is unconditional. New slices should be **additive only** — never rename or
repurpose an existing one — so an older bundle continues to work against a newer database.

**Versioning** — bump `package.json` per release and tag it. There is no CI today, so the tag is
the only record of what is actually live.

---

## 7. Maintenance

- **Weekly:** nothing. That is the point of a static SPA.
- **Monthly:** `npm run audit`; check Firestore usage against the free-tier quota; export a backup.
- **Per feature:** update `README.md` (what), `ARCHITECTURE.md` (how) and `PROJECT_NOTES.md` (why).
  This repo's documentation is unusually good and it is worth the discipline to keep it that way.
- **Watch:** `meals` slice size — shard by year before 1 MB; the `sessions` slice next.
- **Dependencies:** Vite and Firebase majors are the two that will actually break; both are pinned
  by caret ranges today, so CI on push is what catches a bad transitive update.

---

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Two-device edit silently drops entries | Med (rises with offline support) | High — lost health data | D3 merge-by-id before promoting multi-device use |
| New slice deployed before rules | Med | Med — app appears broken | Rules-first ordering in the checklist |
| Firestore doc hits 1 MB | Low now | High — writes fail outright | Size warning in Settings; shard by year |
| Camera/CSP header not updated | High if barcode is built | Low — obvious at test time | Header change is its own step, verified live |
| Barcode leaks grocery data to a third party | Certain if unconditional | Med — breaks a stated promise | Opt-in toggle + plain-English note |
| Bundle grows until first paint suffers on 3G | Med | Med | Code splitting + a size budget in CI |
| Free-tier bandwidth exceeded | Low (single user) | Low | Frames are immutable and cached; watch after any multi-user move |

---

## 9. Research notes (verified August 2026)

- **Open Food Facts** — free, no API key, v2 `product/{barcode}.json` returns `product_name` and
  per-100 g `nutriments`. Practical for packaged goods, thin for home-cooked and restaurant food,
  which is why saved foods (B1) matters more than the scanner (B3).
- **BarcodeDetector** — Chrome/Edge/Android yes, **Safari and Firefox no**; a WASM decoder is the
  cross-platform answer. Feature-detect and lazy-load it.
- **iOS Web Push** — works only for a PWA installed to the Home Screen, after an explicit
  permission grant from a user gesture. No API anywhere schedules a local notification for later,
  so recurring reminders need a server to push them.
- **Apple Health / Health Connect** — still no web-facing API in either direction. Google Fit's
  REST API is retired; Health Connect is on-device Android storage. File import remains the only
  route, and the current implementation (linear scan of the Apple XML rather than DOM parsing) is
  the right call for multi-hundred-MB exports.
- **Wearable vendor APIs** — Fitbit, Strava, Withings and Oura all offer OAuth web APIs; all
  require a server-side secret exchange, so none is reachable from a purely static SPA.

Sources: [Open Food Facts API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/) ·
[MDN BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector) ·
[MagicBell — PWA iOS limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) ·
[Pushpad — iOS web push requirements](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications) ·
[Android — Fit to Health Connect migration](https://developer.android.com/health-and-fitness/health-connect/migration/fit) ·
[Withings public API](https://developer.withings.com/developer-guide/v3/withings-solutions/app-to-app-solution/) ·
[Fitbit OAuth 2.0](https://dev.fitbit.com/apps/oauthinteractivetutorial)

---

## 10. Suggested first sprint

Two weeks, and the app is meaningfully different at the end of it:

1. Day 1 — persistent Firestore cache, Google sign-in, delete `trainer.ts`, CI workflow.
2. Days 2–7 — `sessions` slice end to end: validator, rules, promotion from scratch state,
   "last time" on the exercise card, per-exercise progression chart, PR badge.
3. Days 8–9 — rest timer and wake lock.
4. Day 10 — docs updated, backup taken, preview channel, release.
