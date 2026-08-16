# Vitals — project notes

Working notes for the app: what it is, what changed in the redesign, how it is hosted,
and how Firebase Hosting compares with Vercel and the other options.

The `README.md` covers day-to-day usage. This file covers decisions and infrastructure.

---

## At a glance

| | |
|---|---|
| **Live** | https://vitals-health-tracker-6fc65.web.app |
| **Stack** | React 18 · TypeScript · Vite 8 · Recharts · plain CSS (no Tailwind, no UI kit) |
| **Backend** | Firebase — Auth + Firestore. No server of our own, no API layer |
| **Firebase project** | `vitals-health-tracker-6fc65` (Spark / free plan) |
| **Firestore** | `(default)`, Native mode, **asia-south1** (Mumbai) — location is permanent |
| **Hosting** | Firebase Hosting, deployed from a local build |
| **Repo** | https://github.com/Ahamedshakir02/health-tracker (public) |
| **Tests** | 111 passing (`npm test`) |

The app is a **pure static SPA**. Everything is a file on a CDN; the browser talks to
Firebase directly. There is no server-rendered page and no backend code of ours anywhere.
That single fact drives most of the decisions below.

---

## What we did

### 1. Redesigned the whole UI

A design system was produced in Claude Design and then implemented by hand:

- **Type scale** — Newsreader (serif headings), Hanken Grotesk (UI + tabular numerals),
  IBM Plex Mono (labels). Previously everything was one system-sans weight.
- **Stat tiles** rebuilt as the visual anchor: large tabular numeral, quiet mono label,
  progress meter with four goal states (no-goal / under / on-track / over).
- **Navigation** — the unicode glyphs (`◎ 🏋 ⚖`) were replaced with a real stroked icon
  set (`src/components/icons.tsx`). Sidebar on desktop, icon rail on tablet, bottom tab
  bar on phone.
- **Charts** restyled: mono axis labels, softer gridlines, dashed goal lines, themed
  tooltips.
- **Both themes** reworked — the dark theme is designed for a dark surface, not inverted.
- **Accessibility** — progress state reads via fill *plus* an icon *plus* a word, never
  colour alone; visible focus rings throughout.

### 2. Rebuilt the Trainer around the gym schedule book

The Trainer used to generate an adaptive week from logged data. It now presents the
**Revolution Gym & Fitness Training Schedule Book** exactly as written.

`Gym_Training_Plan.docx` was parsed programmatically into `src/data/trainingPlan.ts`:

- **13 schedules · 46 training days · 85 sections · 360 exercises**
- Every exercise keeps its original section, order, number and coaching cue
- Counts match the book's own stated totals exactly

Every exercise is then mapped to an animated demonstration — see *Animated exercise
demonstrations* below.

On top of that the app adds what paper cannot: pick a schedule and day, tick sets off as
you finish them, and record what you actually lifted per set. Muscle groups are colour
coded onto the existing chart series tokens, so the Trainer reads as the same product as
the rest of the app.

> The old generator still exists at `src/lib/trainer.ts` with its tests, but nothing
> imports it. Delete it if the schedule book is the permanent direction.

### 3. Brought the Firebase backend online

It was not actually working before — the app could sign in but every read and write
would have failed:

- **Cloud Firestore API** had never been enabled on the project → enabled
- **No database existed** → created, `(default)`, Native mode, `asia-south1`
- **Security rules** → `firestore.rules` deployed (owner-only allowlist, server-enforced)
- **Email/Password sign-in** → enabled
- **Google sign-in** → ⚠️ still not enabled, see *Known gaps*

### 4. Hosting and deployment

`firebase.json` had only a `firestore` block. It now has a real `hosting` config: SPA
rewrite, security headers, and cache policy. Deployed and verified live.

### 5. Local-only dev mode

`npm run dev:local` runs the app with Firebase switched off — local JSON, no sign-in.
Implemented as `vite --mode offline` with a committed `.env.offline` of blank keys, which
Vite loads *after* `.env` and therefore overrides. Your real `.env` is untouched.

Useful for UI work: no sign-in round trip, no Firestore reads or writes, no risk to real
data.

---

## How it is hosted

```
   your laptop                 Firebase Hosting              Firebase
  ┌───────────┐   deploy      ┌────────────────┐   HTTPS    ┌──────────┐
  │ npm run   │ ────────────► │  static files  │ ◄────────► │   Auth   │
  │  build    │   dist/       │  on Google CDN │   browser  │ Firestore│
  └───────────┘               └────────────────┘            └──────────┘
```

The build happens **on your machine**. `firebase deploy` uploads the finished `dist/`
folder. There is no build step in the cloud and no CI.

### Headers set on every response

| Header | Why |
|---|---|
| `Content-Security-Policy: frame-ancestors 'none'` | Clickjacking. `index.html` notes this directive is ignored in a `<meta>` tag and must come from the server — this is that. |
| `X-Content-Type-Options: nosniff` | Stop MIME sniffing |
| `Referrer-Policy: strict-origin-when-cross-origin` | Don't leak URLs |
| `X-Robots-Tag: noindex, nofollow` | A private health log has no business in a search index |
| `Permissions-Policy` | Geolocation, mic, camera all denied |

### Cache policy

| Path | Policy | Why |
|---|---|---|
| `/` and everything else | `no-cache, must-revalidate` | The SPA shell must always be current |
| `/assets/**` | `immutable`, 1 year | Vite content-hashes these filenames |
| `/exercise-anim/**` | `immutable`, 1 year | Animation frame filenames are content-hashed too |

> **Gotcha worth remembering:** `cleanUrls: true` means the shell is served at `/`, not at
> `/index.html`. A cache rule targeting `/index.html` silently never matches, and the
> shell inherits Firebase's 1-hour default — so a phone keeps running the *previous*
> deploy for up to an hour after each release. The catch-all rule is what fixes it.

---

## Firebase Hosting vs Vercel vs the rest

Short version: **for this app the difference is small, and Firebase Hosting is the right
default — mainly because everything else is already Firebase.** The one thing Vercel
genuinely buys you is deploy-on-git-push.

### Head to head

| | **Firebase Hosting** (current) | **Vercel** |
|---|---|---|
| How you deploy | `npm run deploy` from your laptop | `git push` → Vercel builds and deploys |
| Preview deploys | Manual channels (`hosting:channel:deploy`) | Automatic, one URL per branch/PR |
| Build location | Your machine | Vercel's cloud |
| Env vars | Local `.env`, baked in at build | Dashboard/CLI, injected at build |
| Config file | `firebase.json` | `vercel.json` |
| Free tier | 10 GB stored, **360 MB/day** transfer | 100 GB/month bandwidth |
| Commercial use on free tier | Allowed | **Not allowed** on Hobby |
| Serverless functions | Needs **Blaze** (paid) | Included on free tier |
| Custom domain + SSL | Free | Free |
| Firebase Auth domains | `web.app` / `firebaseapp.com` **pre-authorised** | Must add your Vercel domain manually or **sign-in breaks** |

### What actually matters here

**Reasons to stay on Firebase Hosting**

- One project, one CLI, one dashboard for hosting *and* Auth *and* Firestore.
- Auth domains work out of the box. On Vercel you must add every deployment domain to
  Firebase Auth → Settings → Authorized domains — and preview URLs change per deploy, so
  Google sign-in on previews is a recurring annoyance.
- One vendor. Nothing else to sign up for, no second bill.
- The free transfer cap (360 MB/day) is generous for a single-user app — but see the note
  on illustrations below.

**Reasons you might move to Vercel**

- **Deploy on push.** Today a deploy requires your laptop. With Vercel, committing is
  deploying — and `.env` stays out of the repo because config lives in the dashboard.
  This is the strongest argument.
- **Preview URLs per branch**, handy for reviewing a redesign on a phone before it's live.
- If you ever want an API route or server-side logic, Vercel gives you that on the free
  tier. Firebase Functions require upgrading to Blaze.

**The one real gotcha if you switch**

Add the Vercel domain to **Firebase Auth → Settings → Authorized domains** before you
switch, or sign-in fails with an unhelpful error. Firestore itself does not care where the
page is served from — the rules are enforced server-side either way.

> **Bandwidth note.** The 222 animation frames are ~4 MB total (they replaced 18 MB of
> PNG plates). Because they're content-hash-named and served `immutable`, each one is
> downloaded once per device, ever. A cold first load on a Trainer day pulls only that
> day's frames, and they're lazy-loaded. This sits well inside Firebase's 360 MB/day.

### The other options, briefly

| | Verdict for this app |
|---|---|
| **Netlify** | Effectively Vercel's twin. Same git-push model, same auth-domain gotcha. No reason to prefer it here. |
| **Cloudflare Pages** | Most generous free bandwidth (unlimited) and a very fast edge. Worth a look if traffic ever grew — overkill for one user. |
| **GitHub Pages** | Free and simple, but no custom headers. You would lose every security header in the table above, including `frame-ancestors`. Not suitable. |
| **A VPS / your own server** | Pointless. There is no server-side code to run. You'd be paying to serve static files worse than a CDN does for free. |

---

## Decisions worth remembering

**Colour tokens are defined twice.** `src/styles.css` carries the design's names
(`--page`, `--ink`, `--s-weight`) *and* the app's older ones (`--surface-N`, `--series-N`)
as aliases. `charts.tsx` passes `'var(--series-1)'` to Recharts as a runtime string, so a
clean rename would have silently blanked every chart. Don't delete the alias block without
grepping `var(--` in `src/**/*.tsx` first.

**Fonts are self-hosted, not Google Fonts.** `index.html` sets `font-src 'self'`. Rather
than widen the CSP, the three families come from `@fontsource*` packages imported in
`main.tsx`. The app makes **zero** third-party requests on load — appropriate for a health
log. Adding a webfont means adding a package, not editing the CSP.

**Exercise media are static files, not database rows.** They live in
`public/exercise-anim/`. Firestore is a document store with a 1 MB cap and no CDN — base64
in documents would be slower, costlier and worse in every way. Firebase Storage would need
Blaze on this project and adds auth, latency and a CSP change to serve files that are
identical for everyone and not private. Static files on a CDN is simply the right shape.

**Animated exercise demonstrations are two stills, not a GIF or a video.** Each movement
loops between a start frame and a finish frame that CSS cross-fades — see
`src/components/ExerciseAnim.tsx`. Two WebP stills are ~30 KB against ~1 MB for the
equivalent GIF, nothing decodes frame by frame on a phone mid-workout, and the browser
owns the loop. The global `prefers-reduced-motion` rule stops the animation, which leaves
the start frame showing — a still photo of the lift, which is the right degraded state.

Frames come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public
domain, 873 exercises, two photographs each). `scripts/build-exercise-media.mjs` maps the
book's shorthand onto that dataset, pulls the frames, re-encodes them to WebP with ffmpeg
and writes both `public/exercise-anim/` and the generated `src/data/exerciseMedia.ts`.
Run it with `npm run build:media`; it needs ffmpeg on PATH and is idempotent.

> The mapping table in that script is **hand-curated and deliberately so.** The book writes
> "Dumbell", "Inc", "Z Bar", "Shruggle" and hides grip variants in brackets; fuzzy matching
> got roughly half of it wrong in confident-looking ways (`Flat Bench Barbell Press` →
> *Barbell Guillotine Bench Press*). The script fails loudly if a plan exercise has no
> alias or an alias points at a name the dataset doesn't have, so a rename can't silently
> blank a card. 201 book names → 111 distinct clips; some genuinely are the same movement.

> **Why the book's own drawings were retired.** The 64 plates were reused across unrelated
> exercises — 201 distinct exercise names shared 64 images — so a card frequently showed a
> movement that wasn't the one named. The drawings are still in git history if the
> aesthetic is ever wanted back.

**Set tracking lives in `localStorage`, not Firestore.** Key
`vitals.trainer.progress.v1`. It is gym scratch state — which sets you ticked, what was on
the bar — not a health measurement, and it would bloat every Firestore write if it rode
along with the rest. Trade-off: it stays on one device.

**`.env` is not committed.** The repo is public. `VITE_` values are public by design
(they're inlined into the bundle and only *identify* the project — `firestore.rules` is the
real boundary), but there's no upside to putting them in a public repo, and you don't need
them there: you build locally and deploy `dist/`. `.env.offline` *is* committed — it
contains nothing but blank keys, which is the point of it.

**A CSS comment containing `*/` breaks the build.** Writing token globs like `--text-*/`
inside a comment closes it early. `tsc` and dev mode pass; only the production minifier
fails. Cost an eyebrow-raising build error once already.

---

## Commands

```bash
npm run dev          # normal dev server, real Firebase, requires sign-in
npm run dev:local    # Firebase off, local JSON, no sign-in — for UI work
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build locally
npm test             # vitest, 111 tests
npm run typecheck    # tsc --noEmit
npm run deploy       # build + deploy hosting
npm run deploy:rules # deploy firestore.rules only
```

Regenerating the training plan from the source document is a one-off script kept outside
the repo; `src/data/trainingPlan.ts` is generated and should not be hand-edited.

---

## Known gaps

- **Google sign-in is not enabled.** "Continue with Google" on the live site will error.
  The Firebase console's provider dialog hangs on a stuck *support email* dropdown.
  To finish: Authentication → Sign-in method → Add new provider → Google → Enable →
  public-facing name `Vitals` → pick a support email → Save. Email/password works today.
- **`src/lib/trainer.ts` is dead code** — the old plan generator, still tested, no longer
  imported. Keep or delete deliberately.
- **Set tracking is device-local** and does not sync between laptop and phone.
- **Tablet rail width** was designed but only lightly verified.
- **No CI.** Tests and typecheck run locally only. If you move to Vercel, or add a GitHub
  Action, wire `npm test && npm run build` into it.
