/**
 * Builds the animated exercise media set.
 *
 * Every exercise in the schedule book gets a two-frame loop — the start and
 * the finish of the movement — which the Trainer cross-fades to animate. The
 * frames come from free-exercise-db (public domain, 873 exercises, two photos
 * each); this script maps the book's shorthand onto that dataset, pulls the
 * frames, and re-encodes them as WebP.
 *
 * Output filenames are content hashes, so `/exercise-anim/**` can be cached
 * forever — same contract as the retired `/exercises` plates.
 *
 * Requires ffmpeg on PATH. Re-runnable and idempotent:
 *   node scripts/build-exercise-media.mjs
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'exercise-anim');
const MANIFEST = join(ROOT, 'src', 'data', 'exerciseMedia.ts');
const PLAN = join(ROOT, 'src', 'data', 'trainingPlan.ts');

const DB_JSON = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const DB_IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

/** Frame width in CSS pixels × 2 for retina. Cards cap the image at 190px tall. */
const FRAME_WIDTH = 440;
const WEBP_QUALITY = 80;
const CONCURRENCY = 8;

/**
 * The book's shorthand → free-exercise-db exercise name.
 *
 * Hand-curated: the book writes "Dumbell", "Inc", "Z Bar", "Shruggle" and
 * abbreviates grip variants in brackets, none of which fuzzy-match reliably.
 * Where the book names a variant the dataset doesn't carry (half-range presses,
 * supersets, "1,2,..7" holds) this points at the parent movement — the loop is
 * showing you the shape of the lift, not the rep scheme.
 */
const ALIAS = {
  // ── CHEST ────────────────────────────────────────────────────────────────
  'Flat Bench Barbell Press': 'Barbell Bench Press - Medium Grip',
  'Flat Barbell Bench Press': 'Barbell Bench Press - Medium Grip',
  'Flat Bench Press': 'Barbell Bench Press - Medium Grip',
  'Half Flat Bench Press': 'Barbell Bench Press - Medium Grip',
  'Bench Press (F, I, D)': 'Barbell Bench Press - Medium Grip',
  'Flat Bar Bench Press and Dumbell Fly': 'Barbell Bench Press - Medium Grip',
  'Bench Press (Rev)': 'Reverse Triceps Bench Press',
  'Inc Barbell Press': 'Barbell Incline Bench Press - Medium Grip',
  'Incline Barbell Press': 'Barbell Incline Bench Press - Medium Grip',
  'Incline Chest Press': 'Leverage Incline Chest Press',
  'Seated Inc Chest Press': 'Leverage Incline Chest Press',
  'Seated Chest Press': 'Leverage Chest Press',
  'Seated Machine Chest Press': 'Leverage Chest Press',
  'Seated Chest Press Mid Hand': 'Cable Chest Press',
  'Inclined Dumbell Press': 'Incline Dumbbell Press',
  'Dumbell Press (Inc)': 'Incline Dumbbell Press',
  'Incline Half Dumbell Press': 'Incline Dumbbell Press',
  'Bench Press (Inc) Dumbell Bench Press': 'Incline Dumbbell Press',
  'Dumbell Press': 'Dumbbell Bench Press',
  'Flat Dumbell Press': 'Dumbbell Bench Press',
  'Flat Bench Dumbell Press': 'Dumbbell Bench Press',
  'Dumbell Press (H)': 'Dumbbell Bench Press with Neutral Grip',
  'Dumbell Press (One by One)': 'One Arm Dumbbell Bench Press',
  'Dumbell Press (Dec) Seated': 'Decline Dumbbell Bench Press',
  'Dec Bar Bench Press': 'Decline Barbell Bench Press',
  'Decline Bar Bench Press': 'Decline Barbell Bench Press',
  'Decline Barbell Press': 'Decline Barbell Bench Press',
  'Barbell Press (Dec)': 'Decline Barbell Bench Press',
  'Decline Dumbell Fly': 'Decline Dumbbell Flyes',
  'Dumbell Fly': 'Dumbbell Flyes',
  'Flat Dumbell Fly': 'Dumbbell Flyes',
  'Flat Dumbell Bench Fly': 'Dumbbell Flyes',
  'Flat Fly': 'Dumbbell Flyes',
  'Pec Deck': 'Butterfly',
  Butterfly: 'Butterfly',
  'Pec Deck with Pushups': 'Butterfly',
  'Reverse Butterfly': 'Reverse Machine Flyes',
  'Cable Crossover': 'Cable Crossover',
  'Free Weight': 'Cable Crossover',
  Pullover: 'Straight-Arm Dumbbell Pullover',
  'Dumbell Pullover': 'Bent-Arm Dumbbell Pullover',
  'Barbell Pullover': 'Bent-Arm Barbell Pullover',
  'Parallel Bar Stretch': 'Dips - Chest Version',
  'Smith Press': 'Smith Machine Bench Press',

  // ── WINGS / BACK ─────────────────────────────────────────────────────────
  'Back Pullups': 'Pullups',
  'Pull Ups': 'Pullups',
  Chinups: 'Chin-Up',
  'Reverse Chinups': 'Chin-Up',
  'Chinups + Barbell Curl': 'Chin-Up',
  'Front Lat Pull Down': 'Wide-Grip Lat Pulldown',
  'Lat Pull Down Front': 'Wide-Grip Lat Pulldown',
  'Lat Pulldown': 'Wide-Grip Lat Pulldown',
  'Lat Pulldown Front': 'Close-Grip Front Lat Pulldown',
  'Lat Pull Down Back': 'Wide-Grip Pulldown Behind The Neck',
  'Lat Pulldown Back': 'Wide-Grip Pulldown Behind The Neck',
  'Lat Pulldown (Rev)': 'Underhand Cable Pulldowns',
  'Reverse Lat Pull Down': 'Underhand Cable Pulldowns',
  'Reverse Latpull Down': 'Underhand Cable Pulldowns',
  'Reverse Latpulldown': 'Underhand Cable Pulldowns',
  'D Bar Lat Pull Down Front': 'V-Bar Pulldown',
  'T Bar Latpull Down': 'V-Bar Pulldown',
  'Lat Side Pullover': 'Straight-Arm Pulldown',
  'Seated Lower Pull': 'Seated Cable Rows',
  'Seated Lowerpull': 'Seated Cable Rows',
  'Mid Row': 'Seated Cable Rows',
  'D Bar Rowing': 'Seated One-arm Cable Pulley Rows',
  'T Bar Rowing': 'Lying T-Bar Row',
  'T Bar Pull': 'T-Bar Row with Handle',
  'Dumbell Rowing': 'Bent Over Two-Dumbbell Row',
  'Independent Row': 'Leverage High Row',
  'Incline Independent Row': 'Dumbbell Incline Row',
  'Spider Row': 'Incline Bench Pull',
  'Spider Row (Bar)': 'Incline Bench Pull',
  Deadlift: 'Barbell Deadlift',
  Shrugs: 'Barbell Shrug',
  Shruggle: 'Barbell Shrug',
  'Barbell Shruggle': 'Barbell Shrug',
  'Shruggle Smith': 'Smith Machine Behind the Back Shrug',
  'Upright Row': 'Upright Barbell Row',
  'Cable Upright Row': 'Upright Cable Row',
  'Machine Upright Row': 'Smith Machine Upright Row',

  // ── BICEPS ───────────────────────────────────────────────────────────────
  'Barbell Curl': 'Barbell Curl',
  'Barbell Curl (-)': 'Barbell Curl',
  'Barbell Curl (Plus)': 'Barbell Curl',
  'Barbell Curl Superset (Plus)': 'Barbell Curl',
  'Bar Curl Hold (1,2,..7)': 'Barbell Curl',
  'Z Barbell Curl': 'EZ-Bar Curl',
  'Z Bar Curl': 'EZ-Bar Curl',
  'Z Bar Curl (Close)': 'Close-Grip EZ Bar Curl',
  'Z Bar Lying Curl': 'Barbell Curls Lying Against An Incline',
  'Barbell Curl Rev (-)': 'Reverse Barbell Curl',
  'Barbell Curl (Rev)': 'Reverse Barbell Curl',
  'Barbell Rev Curl': 'Reverse Barbell Curl',
  'Barbell Reverse Curl': 'Reverse Barbell Curl',
  'Reverse Barbell Curl': 'Reverse Barbell Curl',
  'Dumbell Curl': 'Dumbbell Bicep Curl',
  'Dumbell Curl Super Set (3 Part)': 'Dumbbell Bicep Curl',
  'Onearm Dumbell Curl': 'Dumbbell Alternate Bicep Curl',
  'Onearm Dumbell Curl (Hold)': 'Dumbbell Alternate Bicep Curl',
  'Incline Dumbell Curl': 'Incline Dumbbell Curl',
  '2 Arm Dumbell Curl (Inc)': 'Incline Dumbbell Curl',
  'Inc Dumbell Curl Two Arm': 'Incline Dumbbell Curl',
  'Seated Dumbell Curl': 'Seated Dumbbell Curl',
  'Hammer Curl': 'Hammer Curls',
  'Dumbell Hammer Curl': 'Hammer Curls',
  '2 Arm Dumbell Hammer': 'Hammer Curls',
  'Seated Hammer Curl': 'Alternate Hammer Curl',
  'Hammer Concentration': 'Cross Body Hammer Curl',
  Concentration: 'Concentration Curls',
  'D Bar Concentration': 'Concentration Curls',
  'Preacher Curl': 'Preacher Curl',
  'Preacher Curl (-)': 'Preacher Curl',
  'Preacher Curl (Z)': 'Preacher Curl',
  'Manual Preacher Curl': 'Preacher Curl',
  'Machine Preacher Curl': 'Machine Preacher Curls',
  'One Arm Preacher Curl': 'One Arm Dumbbell Preacher Curl',
  'Cable Curl': 'Standing Biceps Cable Curl',
  'Cable Curl (D Bar)': 'Standing Biceps Cable Curl',
  'V Bar Cable Curl': 'Standing Biceps Cable Curl',
  '3 Part Cable Curl': 'Standing Biceps Cable Curl',
  'Cable Curl (W C)': 'Cable Hammer Curls - Rope Attachment',
  'Cable Upper Curl': 'High Cable Curls',
  'D Bar Upper Curl': 'High Cable Curls',
  'Cable Curl (Rev)': 'Reverse Cable Curl',
  'Cable Curl Reverse': 'Reverse Cable Curl',
  'Cable Reverse Curl': 'Reverse Cable Curl',
  'Reverse Cable Curl': 'Reverse Cable Curl',
  'Spider Biceps Curl': 'Spider Curl',

  // ── TRICEPS ──────────────────────────────────────────────────────────────
  'Skull Crusher': 'EZ-Bar Skullcrusher',
  'Z Bar Lying Press': 'EZ-Bar Skullcrusher',
  'Skull Crusher (Machine)': 'Machine Triceps Extension',
  'Machine French Press': 'Machine Triceps Extension',
  'Pulley Pushdown': 'Triceps Pushdown',
  'Pulley Pushdown (Minus)': 'Triceps Pushdown',
  'Widebar Pulley Pushdown': 'Triceps Pushdown',
  'Pulley Pushdown (W C)': 'Triceps Pushdown - Rope Attachment',
  'D Bar Pulley Pushdown': 'Triceps Pushdown - V-Bar Attachment',
  'V Bar Pulley Push Down': 'Triceps Pushdown - V-Bar Attachment',
  'Cable Overhead': 'Cable Rope Overhead Triceps Extension',
  'Cable Overhead with Pulley Pushdown': 'Cable Rope Overhead Triceps Extension',
  'V Bar Overhead': 'Triceps Overhead Extension with Rope',
  'Wide Bar Overhead': 'Standing Overhead Barbell Triceps Extension',
  'Widebar Overhead': 'Standing Overhead Barbell Triceps Extension',
  'Barbell French Press': 'Standing Overhead Barbell Triceps Extension',
  'Z Bar French Press (+)': 'Seated Triceps Press',
  'Seated Dumbell Extension': 'Seated Triceps Press',
  'Kick Back': 'Tricep Dumbbell Kickback',
  Kickback: 'Tricep Dumbbell Kickback',
  '2 Arm Kick Back': 'Tricep Dumbbell Kickback',
  'Kickback Twist': 'Tricep Dumbbell Kickback',
  'Bench Dips': 'Bench Dips',
  'Bench Dips / Close Grip Pushups': 'Bench Dips',
  'Parallel Dips': 'Parallel Bar Dip',
  'Close Grip Bar Press': 'Close-Grip Barbell Bench Press',
  'Triceps Close Grip': 'Close-Grip Barbell Bench Press',
  'Z Bar Close Grip': 'Close-Grip EZ-Bar Press',
  'Lying Press (F, I, D)': 'Lying Triceps Press',
  'Lying Dumbell Extension': 'Lying Dumbbell Tricep Extension',
  'Dumbell Extension': 'Standing Dumbbell Triceps Extension',
  'Dumbell Extension Minus': 'Standing Dumbbell Triceps Extension',
  'One Arm Dumbell Extension': 'Dumbbell One-Arm Triceps Extension',

  // ── SHOULDER ─────────────────────────────────────────────────────────────
  'Barbell Press': 'Barbell Shoulder Press',
  'Barbell Press Front': 'Barbell Shoulder Press',
  'Barbell Back Press': 'Standing Barbell Press Behind Neck',
  'Smith Press Back': 'Standing Barbell Press Behind Neck',
  'Seated Dumbell Press Back': 'Standing Barbell Press Behind Neck',
  'Machine Shoulder Press': 'Machine Shoulder (Military) Press',
  'Shoulder Press Machine': 'Machine Shoulder (Military) Press',
  'Smith Shoulder Press': 'Smith Machine Overhead Shoulder Press',
  'Standing Press Smith': 'Smith Machine Overhead Shoulder Press',
  'Smith Press Front': 'Smith Machine Overhead Shoulder Press',
  'Seated Dumbell Press': 'Seated Dumbbell Press',
  'Standing Dumbell Press': 'Standing Dumbbell Press',
  'Arnold Press': 'Arnold Dumbbell Press',
  'Cross Dumbell Press': 'Arnold Dumbbell Press',
  'Side Lateral': 'Side Lateral Raise',
  'Side Lateral Raise': 'Side Lateral Raise',
  'Side Raise': 'Side Lateral Raise',
  'Side Lateral (One Arm)': 'One-Arm Side Laterals',
  'Side Lateral Raise with Dumbell Press': 'Side Laterals to Front Raise',
  'Lateral Bentover': 'Bent Over Dumbbell Rear Delt Raise With Head On Bench',
  'Dumbell Front Raise': 'Front Dumbbell Raise',
  'Barbell Front Raise': 'Standing Front Barbell Raise Over Head',

  // ── FOREARMS ─────────────────────────────────────────────────────────────
  'Wrist Curl': 'Palms-Up Barbell Wrist Curl Over A Bench',
  'Back Wrist Curl': 'Palms-Down Wrist Curl Over A Bench',
  'Wrist Curl Machine': 'Cable Wrist Curl',

  // ── LEGS ─────────────────────────────────────────────────────────────────
  'Barbell Squat': 'Barbell Squat',
  'Barbell Squats': 'Barbell Squat',
  'Leg Squat': 'Barbell Squat',
  'Machine Squat': 'Hack Squat',
  'Smith Squat': 'Smith Machine Squat',
  'Front Squats': 'Front Barbell Squat',
  'Dumbell Front Squat': 'Goblet Squat',
  'Sumo Squat': 'Plie Dumbbell Squat',
  'Leg Press': 'Leg Press',
  'Leg Extension': 'Leg Extensions',
  Extension: 'Leg Extensions',
  'Leg Curl': 'Lying Leg Curls',
  'Barbell Lunges': 'Barbell Lunge',
  'Dumbell Lunges': 'Dumbbell Lunges',
  'Calf Raise': 'Standing Calf Raises',
};

/** Pulls the 201 distinct exercise names out of the generated plan. */
async function planExerciseNames() {
  const src = await readFile(PLAN, 'utf8');
  const marker = 'TRAINING_PLAN: Schedule[] = ';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`Could not find "${marker}" in ${PLAN}`);
  const plan = JSON.parse(src.slice(start + marker.length, src.lastIndexOf(']') + 1));

  const names = new Set();
  for (const s of plan)
    for (const d of s.days)
      for (const sec of d.sections) for (const e of sec.exercises) names.add(e.name.trim());
  return [...names];
}

async function fetchBuffer(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i === attempts) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

/** Runs `jobs` with a fixed worker pool, preserving input order in the result. */
async function pool(jobs, limit, worker) {
  const out = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await worker(jobs[i], i);
      }
    }),
  );
  return out;
}

async function main() {
  const scratch = join(tmpdir(), `exmedia-${process.pid}`);
  await mkdir(scratch, { recursive: true });

  console.log('Fetching free-exercise-db …');
  const db = JSON.parse((await fetchBuffer(DB_JSON)).toString('utf8'));
  const byName = new Map(db.map((e) => [e.name, e]));

  // Every alias target must exist, or a typo silently drops an exercise.
  const badTargets = [...new Set(Object.values(ALIAS))].filter((n) => !byName.has(n));
  if (badTargets.length) {
    throw new Error(`Alias targets not in dataset:\n  ${badTargets.join('\n  ')}`);
  }

  const names = await planExerciseNames();
  const missing = names.filter((n) => !ALIAS[n]);
  if (missing.length) {
    throw new Error(
      `${missing.length} plan exercises have no alias:\n  ${missing.join('\n  ')}`,
    );
  }
  console.log(`${names.length} plan exercises → ${new Set(Object.values(ALIAS)).size} distinct clips`);

  // One download+encode per distinct dataset entry, not per plan name.
  const targets = [...new Set(names.map((n) => ALIAS[n]))];

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  let bytes = 0;
  const clips = new Map();

  await pool(targets, CONCURRENCY, async (dbName) => {
    const entry = byName.get(dbName);
    const frames = (entry.images || []).slice(0, 2);
    if (frames.length < 2) throw new Error(`${dbName} has ${frames.length} frame(s), need 2`);

    const hashes = [];
    for (const [i, rel] of frames.entries()) {
      const jpg = join(scratch, `${entry.id}-${i}.jpg`);
      const webp = join(scratch, `${entry.id}-${i}.webp`);
      await writeFile(jpg, await fetchBuffer(DB_IMG + encodeURI(rel)));
      await run('ffmpeg', [
        '-y', '-v', 'error',
        '-i', jpg,
        '-vf', `scale=${FRAME_WIDTH}:-2:flags=lanczos`,
        '-c:v', 'libwebp', '-quality', String(WEBP_QUALITY),
        webp,
      ]);
      const buf = await readFile(webp);
      const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16);
      await writeFile(join(OUT_DIR, `${hash}.webp`), buf);
      bytes += buf.length;
      hashes.push(`${hash}.webp`);
    }
    clips.set(dbName, { a: hashes[0], b: hashes[1], source: entry.id });
    process.stdout.write('.');
  });

  console.log('');
  await rm(scratch, { recursive: true, force: true });

  // Manifest keyed by the book's own exercise name — trainingPlan.ts is
  // generated from the .docx and must not be hand-edited.
  const rows = names
    .sort((a, b) => a.localeCompare(b))
    .map((n) => {
      const c = clips.get(ALIAS[n]);
      return `  ${JSON.stringify(n)}: { a: '${c.a}', b: '${c.b}', source: ${JSON.stringify(c.source)} },`;
    })
    .join('\n');

  await writeFile(
    MANIFEST,
    `// GENERATED by scripts/build-exercise-media.mjs — do not hand-edit.
// Frames from free-exercise-db (public domain): https://github.com/yuhonas/free-exercise-db
// ${names.length} exercises · ${clips.size} distinct clips · files live in /exercise-anim.

/** The two ends of a movement. The Trainer cross-fades a↔b to animate it. */
export interface ExerciseClip {
  /** Start-position frame, content-hashed filename under /exercise-anim. */
  a: string;
  /** Finish-position frame. */
  b: string;
  /** free-exercise-db id the frames came from, for tracing a bad match. */
  source: string;
}

const EXERCISE_MEDIA: Record<string, ExerciseClip> = {
${rows}
};

/** Clip for a book exercise name, or null if the plan gains a name we haven't mapped. */
export function clipFor(name: string): ExerciseClip | null {
  return EXERCISE_MEDIA[name.trim()] ?? null;
}
`,
    'utf8',
  );

  const files = (await readdir(OUT_DIR)).length;
  console.log(`Wrote ${files} frames (${(bytes / 1024 / 1024).toFixed(1)} MB) → public/exercise-anim`);
  console.log(`Wrote manifest → src/data/exerciseMedia.ts`);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
