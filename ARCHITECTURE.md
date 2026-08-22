# Architecture

How Vitals is put together and why. `README.md` covers what it does;
`PROJECT_NOTES.md` records specific decisions and their reasoning. This file is
the map between them — read it first if you are new to the codebase.

---

## The shape of it in one paragraph

Vitals is a React SPA with no backend of its own. It talks directly to Firebase
for authentication and storage, and everything else is static files on a CDN.
There is no server to deploy, no API layer, and no build step beyond Vite. The
site is served as **two separate applications** from one Firebase Hosting
project: a public, React-free marketing page at `/`, and the private tracker at
`/app`.

```
                         Firebase Hosting (CDN)
                                  │
        ┌─────────────────────────┼──────────────────────────┐
        │                         │                          │
   /  /privacy  /terms          /app  /app/**            /exercise-anim/**
   404 fallback                   │                      /screens  /og.png
        │                         │                          │
  static HTML                React SPA                  static assets
  ~4 KB of JS            (React, Recharts, Firebase)     (immutable cache)
        │                         │
   cookieless             ┌───────┴────────┐
   analytics              │                │
   (opt-in)         Firebase Auth     Cloud Firestore
                    (Google or email) (one doc per section,
                                        cached in IndexedDB)
                          │                │
                          └── firestore.rules ──┘
                              per-account isolation,
                              enforced server-side
```

---

## Two applications, one origin

The split is deliberate and enforced by the build, not by convention.

| | Public site | Tracker |
|---|---|---|
| **Entry** | `index.html`, `privacy.html`, `terms.html`, `404.html` | `app.html` |
| **Served at** | `/`, `/privacy`, `/terms` | `/app`, `/app/**` |
| **JS** | ~4 KB (`src/landing/`) | React + Recharts + Firebase |
| **Indexed** | Yes — sitemap, OG tags, canonical | No — `X-Robots-Tag: noindex` |
| **Third-party** | Optional cookieless analytics | None at all |

`vite.config.ts` declares all five HTML files as rollup inputs. They share only
the font files, so someone reading the marketing copy never downloads Firebase,
and the tracker never loads an analytics script. The `noindex` header is scoped
to `/app{,/**}` in `firebase.json` rather than applied site-wide, which is what
lets the marketing pages be indexable while the health log is not.

> **Why `base: '/'` and not `'./'`.** Relative asset URLs resolve against the
> current path, so `/app/` with a trailing slash would look for
> `/app/assets/…`. Absolute paths are correct at every depth.

### Sending returning users past the marketing page

Firebase Hosting is a CDN and cannot know who is signed in, and the landing page
ships no Firebase to ask. Instead the app writes one flag to `localStorage` when
it unlocks (`src/lib/returningVisitor.ts`), and a small **inline, synchronous**
script in `index.html` reads it and calls `location.replace('/app')`.

It has to be inline and synchronous, because a module script is deferred until
the document has parsed — which is precisely the flash of marketing copy the
redirect exists to avoid. That means `script-src 'self'` does not cover it, so
the CSP carries a sha256 of the script's exact bytes. `npm run build` runs
`scripts/csp-hash.mjs --check` and **fails** if the two have drifted;
`npm run build:csp` rewrites the hash.

Three guards keep it from trapping anyone:

- `?home` always shows the landing page
- a same-origin `document.referrer` means the visitor clicked through from
  within the site and asked for this page, so they stay
- the flag is set only when the app actually *unlocks*, never merely on visiting
  `/app` — a visitor who lands on the sign-in screen and leaves has not started
  using anything, and would otherwise be redirected past the landing page
  forever

---

## Routing

There is no router library. `App.tsx` reads `window.location.hash`, maps it to
one of eight tab ids, and renders the matching page component. Every section is
`React.lazy`, so opening the Trainer does not download the charting library.

- `#/trainer` → the Trainer section
- no hash → Today
- **anything unrecognised → `null`**, which renders `NotFoundPanel`

That last case matters: falling back to the dashboard for an unknown hash makes
a stale bookmark look like the app silently lost your page. Hash routing also
means Firebase only ever needs to serve one document for the whole tracker —
the rewrite in `firebase.json` maps `/app/**` to `app.html` and the client takes
it from there.

`src/lib/pageMeta.ts` writes `document.title` and the meta description on every
route change. This is for humans with fifteen tabs open, not for crawlers —
`/app` is `noindex` and no search engine ever sees those descriptions.

---

## State and storage

One React context (`src/state/HealthProvider.tsx`) owns all application data and
exposes it through `useHealth()`. There is no Redux, no query cache, and no
per-page fetching — the whole record is small enough to hold in memory.

The storage layer is an interface with two implementations:

```
        HealthStore (src/lib/store.ts)
                  │
      ┌───────────┴────────────┐
 LocalStore              FirestoreStore
 (localStorage)          (src/lib/firestoreStore.ts)
 offline / no config     signed in
```

`HealthProvider` picks one at startup based on whether Firebase is configured
and whether a session exists, so every page component is written against the
same shape regardless of where the data actually lives. `npm run dev:local`
forces `LocalStore` by blanking the Firebase env vars — useful for UI work with
no sign-in round trip and no risk to real data.

Data is split into five sections (`settings`, `weights`, `meals`, `workouts`,
`days`) and stored as one Firestore document per section, so a change to today's
meals doesn't rewrite years of weight history.

### Two things deliberately kept out of Firestore

- **Trainer set-ticking** lives in `localStorage` (`src/lib/trainerProgress.ts`)
  while a workout is in progress. It changes many times a minute mid-workout;
  syncing every tap would be a lot of writes for state that is worthless the
  next day, and would fail outright underground. It is keyed by date, and
  "Finish day" promotes it once into the synced `sessions` slice
  (`src/lib/session.ts`). Finished sessions **do** sync; the in-progress
  scratch does not.
- **Which day comes next** is derived from `sessions`, not stored
  (`src/lib/programme.ts`). `settings.programme` records only which schedule is
  active and when it started. One write instead of two, no counter to fall out
  of step with the history it describes, and both devices reach the same answer
  from the same data.
- **Exercise media** are static files, not database rows — see below.

---

## Security model

Anyone can sign up. What they cannot do is read anybody else's data.

Storage has always been uid-scoped — `users/{uid}/slices/{sliceId}` — so
isolation is the shape of the database, not a filter applied over a shared one.
`firestore.rules` is the **enforcement**: it requires an authenticated request
whose `uid` matches the path and whose token carries a verified email address,
and refuses every path outside that tree. Firebase applies it server-side on
every read and write.

The client-side checks in `App.tsx` and `HealthProvider.tsx` are
**convenience** — they produce a readable message instead of an opaque
`permission-denied`. Anything in the bundle can be edited by whoever holds the
browser, so none of it is a boundary. Never move a check out of the rules file
on the grounds that the client already does it.

> `email_verified` is a claim baked into the **ID token**, not a field read
> live. Calling `reload()` on the user object is not enough — the app must call
> `getIdToken(true)` after verification or the account stays locked out until
> the token happens to refresh, up to an hour later.

Beyond that: a strict CSP in each HTML head (the tracker's allows the Firebase
origins; the public pages allow nothing), `frame-ancestors 'none'` as a real
HTTP header, no source maps in the deployed bundle, and self-hosted fonts so
`font-src 'self'` holds.

---

## Generated assets

Three build scripts produce files that are committed to the repo. None runs
during `npm run build` — they are run by hand when their inputs change, and
their outputs are checked in so a clone builds without network access or ffmpeg.

| Script | Produces | Needs |
|---|---|---|
| `scripts/build-exercise-media.mjs` | `public/exercise-anim/` (330 frames), `src/data/exerciseMedia.ts` and `src/data/mobility.ts` | ffmpeg, network |
| `scripts/build-home-plans.mjs` | `src/data/homePlans.ts` | the two home-edition `.docx` files |
| `scripts/build-icons.mjs` | `favicon.ico`, `apple-touch-icon.png`, `icon-192/512.png` | nothing |

`src/data/trainingPlan.ts` is also generated — parsed from the original
`Gym_Training_Plan.docx` — and marked do-not-hand-edit. Exercise media is keyed
by exercise **name** in a separate manifest specifically so that file never has
to be touched.

Everything under `public/exercise-anim/` is content-hash named and served
`immutable` for a year. Regenerating a clip changes its filename, so a stale
copy can never be served.

---

## One plan, three sets of movements

The book has two home editions. Each restates it exercise for exercise — the
same 13 schedules, 46 training days and 360 slots, in the same order at the same
rep counts — with every gym movement swapped for one you can do with household
items, or with nothing at all.

So they are **not** extra schedules. `src/data/homePlans.ts` is an overlay keyed
by movement, and `trainingPlan.ts` stays the single description of the plan's
structure. `TrainerPrefs.equipment` picks which set of movements the Trainer
draws, and only the exercise on each card changes.

Two consequences worth knowing before touching it:

- **The key is `movementKey(section, name)`, not the exercise name.** `Barbell
  Press` is a bench press under CHEST and an overhead press under SHOULDER, and
  the editions substitute them differently.
- **Logging stays on the gym movement.** Set records, personal records and the
  progression chart are keyed to the exercise being replaced, so a week at home
  lands on the same chart as the gym movement it stands in for rather than
  splitting your history by whichever room you trained in.

`scripts/build-home-plans.mjs` will not emit anything unless all 360 slots line
up with `trainingPlan.ts` in order. The `.docx` carries no ids, only position,
so position is the only thing that can be checked — and a table that had drifted
one row would put a chair dip where a squat belongs with nothing downstream able
to tell.

`EQUIPMENT_NOTES` lives in `src/types.ts`, not in the generated file, so that
naming the three modes does not pull ~19 kB of substitution tables onto every
page that mentions them.

---

## Rendering the exercise animations

Each exercise loops between two photographs — the start and finish of the
movement — cross-faded by CSS in `src/components/ExerciseAnim.tsx`. Not a GIF
and not a video: two WebP stills are ~30 KB against ~1 MB for the equivalent
GIF, and the browser owns the loop rather than decoding frames on a phone
mid-workout. A single shared `IntersectionObserver` gates the animation so only
on-screen cards animate, and the global reduced-motion rule stops the loop,
leaving the start frame showing.

---

## Testing

`vitest` covers the pure logic — dates, unit conversion, calculations, the
storage normaliser, health-data import, and the retired trainer generator.
Components and Firebase are not tested; the value is in the arithmetic, which is
where a silent regression would actually hurt.

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # tsc -b && vite build
```

---

## Deploying

```bash
npm run deploy      # build + firebase deploy --only hosting
```

Committing does **not** deploy. Hosting is a separate step and nothing reaches
the live site until `firebase deploy` runs.

Cache headers are the subtle part. The default is `no-cache, must-revalidate`
for everything, with hashed assets overriding it to a year. `cleanUrls: true`
means a page is served at `/`, which a rule targeting `/index.html` never
matches — without the catch-all default, a phone keeps running the previous
deploy indefinitely.

---

## Where to change things

| To change… | Go to |
|---|---|
| A page in the tracker | `src/pages/` |
| Shared inputs, cards, tiles | `src/components/ui.tsx` |
| Colours, spacing, breakpoints | `src/styles.css` (tokens at the top) |
| The marketing page | `index.html` + `src/landing/landing.css` |
| Legal copy | `privacy.html`, `terms.html` |
| An exercise → animation mapping | `ALIAS` in `scripts/build-exercise-media.mjs`, then re-run it (`--verify` prints the table first) |
| The stretch set or a routine | `STRETCHES` / `ROUTINES` in `scripts/build-exercise-media.mjs`, then re-run it |
| Which stretches follow a training day | `SECTION_AREAS` in `src/lib/mobility.ts` |
| A home substitution | the home-edition `.docx`, then re-run `scripts/build-home-plans.mjs` |
| What a training mode is called, or assumes you have | `EQUIPMENT_NOTES` in `src/types.ts` |
| Who can sign in | `firestore.rules` — nowhere else |
| Cache or security headers | `firebase.json` |
