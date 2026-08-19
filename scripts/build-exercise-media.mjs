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
 *
 * `--verify` prints every book name beside the dataset entry it maps to,
 * without downloading anything, so the table below can be eyeballed after an
 * edit:
 *   node scripts/build-exercise-media.mjs --verify
 *
 * Accepted approximations — the dataset has no closer match, and these are
 * deliberate rather than unnoticed:
 *
 *   Smith Press Back          → standing barbell behind-neck press
 *   Machine Squat             → Hack Squat
 *   Wrist Curl Machine        → Cable Wrist Curl
 *   Z Bar French Press (+)    → Seated Triceps Press
 *   Parallel Bar Stretch      → Dips - Chest Version (in this book that *is*
 *                               chest dips on parallel bars, so it is correct)
 *
 * And the supersets, which show only the first movement of the pair:
 * Bench Dips / Close Grip Pushups · Pec Deck with Pushups · Chinups + Barbell
 * Curl · Cable Overhead with Pulley Pushdown · Flat Bar Bench Press and
 * Dumbell Fly. The cards say so, rather than leaving it looking broken.
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
const MOBILITY = join(ROOT, 'src', 'data', 'mobility.ts');
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
  // The book means a free-weight fly here. A cable machine is the literal
  // opposite of "free weight".
  'Free Weight': 'Dumbbell Flyes',
  Pullover: 'Straight-Arm Dumbbell Pullover',
  'Dumbell Pullover': 'Bent-Arm Dumbbell Pullover',
  'Barbell Pullover': 'Bent-Arm Barbell Pullover',
  'Parallel Bar Stretch': 'Dips - Chest Version',
  'Smith Press': 'Smith Machine Bench Press',

  // ── WINGS / BACK ─────────────────────────────────────────────────────────
  'Back Pullups': 'Pullups',
  'Pull Ups': 'Pullups',
  Chinups: 'Chin-Up',
  // "Reverse" in the book means pronated, which is a pull-up. A chin-up is
  // supinated — the opposite grip.
  'Reverse Chinups': 'Pullups',
  'Chinups + Barbell Curl': 'Chin-Up',
  'Front Lat Pull Down': 'Wide-Grip Lat Pulldown',
  'Lat Pull Down Front': 'Wide-Grip Lat Pulldown',
  'Lat Pulldown': 'Wide-Grip Lat Pulldown',
  // Same movement as 'Lat Pull Down Front' above, two spellings apart. They
  // must not map to different grips.
  'Lat Pulldown Front': 'Wide-Grip Lat Pulldown',
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
  // The one genuinely ambiguous name in the book: 'Barbell Press' appears
  // under SHOULDER and again under CHEST, where it is a bench press. The
  // plain key above serves the shoulder day; this qualified key overrides it
  // on the chest day. Section-qualified keys always win.
  'CHEST|Barbell Press': 'Barbell Bench Press - Medium Grip',
  'Barbell Press Front': 'Barbell Shoulder Press',
  'Barbell Back Press': 'Standing Barbell Press Behind Neck',
  'Smith Press Back': 'Standing Barbell Press Behind Neck',
  // Wrong equipment and wrong posture: the book says seated, with dumbbells.
  'Seated Dumbell Press Back': 'Seated Dumbbell Press',
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
  // The old target's second half is a front raise, not a press.
  'Side Lateral Raise with Dumbell Press': 'Side Lateral Raise',
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

/**
 * The stretch set, hand-picked from free-exercise-db's 123 stretching entries.
 *
 * Sixty-one of them, not all 123: the dataset repeats the same stretch seated,
 * standing and lying, and it carries a run of "-SMR" foam-roller drills that
 * are not stretches and need a roller nobody has brought. What is left covers
 * every area a training day can leave tight, with a couple of options each.
 *
 * `hold` and `cue` are written here rather than taken from the dataset. Its own
 * `instructions` run to four or five sentences — correct, and far too long to
 * read off a card mid-hold.
 */
const STRETCHES = [
  // -- HIPS -----------------------------------------------------------------
  { db: 'Ankle On The Knee', area: 'hips', hold: 30, cue: 'Ankle across the far knee, pull the thigh in until the hip opens.' },
  { db: 'Knee Across The Body', area: 'hips', hold: 30, cue: 'Flat on your back, draw the knee across. Both shoulders stay down.' },
  { db: 'Lying Glute', area: 'hips', hold: 30, cue: 'Figure four, hands behind the thigh, pull it toward your chest.' },
  { db: 'Seated Glute', area: 'hips', hold: 30, cue: 'Sit tall, ankle on knee, lean forward from the hips not the back.' },
  { db: 'Lying Bent Leg Groin', area: 'hips', hold: 45, cue: 'Soles together, knees fall open. Let gravity do it, do not push.' },
  { db: 'Side Lying Groin Stretch', area: 'hips', hold: 30, cue: 'Bottom leg straight along the floor, ease the inner thigh long.' },
  { db: 'Kneeling Hip Flexor', area: 'hips', hold: 30, cue: 'Tuck the tailbone under first, then press the hip forward.' },
  { db: 'Standing Hip Flexors', area: 'hips', hold: 30, cue: 'Square the hips, squeeze the back glute, stand tall.' },
  { db: 'IT Band and Glute Stretch', area: 'hips', hold: 30, cue: 'Cross the leg over and lean away until the outer hip pulls.' },
  { db: "World's Greatest Stretch", area: 'hips', hold: 30, cue: 'Deep lunge, elbow inside the foot, then rotate up and open.' },

  // -- HAMSTRINGS -----------------------------------------------------------
  { db: '90/90 Hamstring', area: 'hamstrings', hold: 30, cue: 'Hip and knee at ninety, straighten the knee slowly until it bites.' },
  { db: 'Lying Hamstring', area: 'hamstrings', hold: 30, cue: 'Leg up, hands behind the thigh. The other leg stays flat.' },
  { db: 'Seated Hamstring', area: 'hamstrings', hold: 30, cue: 'Hinge from the hips with a long back. Do not round to reach further.' },
  { db: 'Standing Toe Touches', area: 'hamstrings', hold: 30, cue: 'Soft knees, hang from the hips, let the head go heavy.' },
  { db: "Runner's Stretch", area: 'hamstrings', hold: 30, cue: 'Front leg straight, toes up, hinge over it.' },
  { db: 'Leg-Up Hamstring Stretch', area: 'hamstrings', hold: 30, cue: 'Heel on a bench, leg straight, hinge over it with a flat back.' },
  { db: 'Seated Hamstring and Calf Stretch', area: 'hamstrings', hold: 30, cue: 'Reach for the toes and pull them back toward you.' },

  // -- QUADS ----------------------------------------------------------------
  { db: 'All Fours Quad Stretch', area: 'quads', hold: 30, cue: 'Heel to the backside, knee under the hip, ribs down.' },
  { db: 'Quad Stretch', area: 'quads', hold: 30, cue: 'Knees together, pull the heel in. Hold a wall if you wobble.' },
  { db: 'Lying Prone Quadriceps', area: 'quads', hold: 30, cue: 'Face down, heel to backside. Keep the hip on the floor.' },
  { db: 'On Your Side Quad Stretch', area: 'quads', hold: 30, cue: 'Bottom leg tucked for balance, top heel drawn back.' },
  { db: 'Standing Elevated Quad Stretch', area: 'quads', hold: 30, cue: 'Rear foot on a bench, sink straight down.' },

  // -- CALVES ---------------------------------------------------------------
  { db: 'Calf Stretch Hands Against Wall', area: 'calves', hold: 30, cue: 'Back leg straight, heel down, hips forward.' },
  { db: 'Standing Gastrocnemius Calf Stretch', area: 'calves', hold: 30, cue: 'Back knee locked. That is what reaches the upper calf.' },
  { db: 'Standing Soleus And Achilles Stretch', area: 'calves', hold: 30, cue: 'Same position, back knee bent. Lower calf and Achilles.' },
  { db: 'Seated Calf Stretch', area: 'calves', hold: 30, cue: 'Towel or band round the ball of the foot, pull it back.' },
  { db: 'Ankle Circles', area: 'calves', hold: 20, cue: 'Slow and full, both directions. Draw the biggest circle you can.' },

  // -- BACK -----------------------------------------------------------------
  { db: "Child's Pose", area: 'back', hold: 45, cue: 'Hips to heels, arms long, breathe into the low back.' },
  { db: 'Cat Stretch', area: 'back', hold: 30, cue: 'Arch and round one vertebra at a time, with the breath.' },
  { db: 'Hug Knees To Chest', area: 'back', hold: 30, cue: 'Both knees in, rock gently side to side.' },
  { db: "Dancer's Stretch", area: 'back', hold: 30, cue: 'Seated twist. Rotate from the ribs, not the neck.' },
  { db: 'Standing Pelvic Tilt', area: 'back', hold: 30, cue: 'Tuck the tailbone, flatten the low back, hold.' },
  { db: 'Overhead Lat', area: 'back', hold: 30, cue: 'Arm overhead, lean away, feel it down the side of the ribs.' },
  { db: 'Chair Lower Back Stretch', area: 'back', hold: 30, cue: 'Sit, feet planted, fold forward and let the low back open.' },
  { db: 'Side-Lying Floor Stretch', area: 'back', hold: 30, cue: 'Top arm reaches long, let the shoulder settle.' },
  { db: 'Middle Back Stretch', area: 'back', hold: 30, cue: 'Round the upper back and push the hands away.' },
  { db: 'Upper Back Stretch', area: 'back', hold: 30, cue: 'Clasp the hands, press forward, separate the shoulder blades.' },
  { db: 'Spinal Stretch', area: 'back', hold: 30, cue: 'Long spine, gentle rotation, hold at the first resistance.' },

  // -- CHEST ----------------------------------------------------------------
  { db: 'Behind Head Chest Stretch', area: 'chest', hold: 30, cue: 'Hands behind the head, elbows wide, chest up.' },
  { db: 'Chest And Front Of Shoulder Stretch', area: 'chest', hold: 30, cue: 'Forearm on the frame, step through, turn away.' },
  { db: 'Elbows Back', area: 'chest', hold: 30, cue: 'Hands clasped behind, lift them and open the collarbones.' },
  { db: 'Dynamic Chest Stretch', area: 'chest', hold: 30, cue: 'Swing the arms wide and back. Controlled, not thrown.' },

  // -- SHOULDERS ------------------------------------------------------------
  { db: 'Shoulder Stretch', area: 'shoulders', hold: 30, cue: 'Arm across the body, pull above the elbow, not on the joint.' },
  { db: 'Seated Front Deltoid', area: 'shoulders', hold: 30, cue: 'Hands behind on the floor, slide the hips forward.' },
  { db: 'Round The World Shoulder Stretch', area: 'shoulders', hold: 30, cue: 'Big slow arc through the full range. Stop where it pinches.' },
  { db: 'Shoulder Circles', area: 'shoulders', hold: 30, cue: 'Shrug up, roll back, drop. Ten each way.' },
  { db: 'Arm Circles', area: 'shoulders', hold: 30, cue: 'Small to large, forward then back.' },
  { db: 'Upward Stretch', area: 'shoulders', hold: 30, cue: 'Reach overhead, palms up, lengthen through the ribs.' },
  { db: 'Chair Upper Body Stretch', area: 'shoulders', hold: 30, cue: 'Hands on the back of a chair, drop the chest between the arms.' },

  // -- NECK -----------------------------------------------------------------
  { db: 'Chin To Chest Stretch', area: 'neck', hold: 30, cue: 'Chin down, hands resting on the head. No pulling.' },
  { db: 'Side Neck Stretch', area: 'neck', hold: 30, cue: 'Ear to shoulder, opposite shoulder stays down.' },

  // -- ARMS -----------------------------------------------------------------
  { db: 'Overhead Triceps', area: 'arms', hold: 30, cue: 'Elbow to the ceiling, hand down the spine, ease the elbow back.' },
  { db: 'Triceps Stretch', area: 'arms', hold: 30, cue: 'Same shape. Ribs stay down, do not arch to get further.' },
  { db: 'Standing Biceps Stretch', area: 'arms', hold: 30, cue: 'Arm back and straight, thumb down, turn away from it.' },
  { db: 'Seated Biceps', area: 'arms', hold: 30, cue: 'Hands behind, fingers back, walk the hips forward.' },
  { db: 'Kneeling Forearm Stretch', area: 'arms', hold: 30, cue: 'Palms down, fingers toward the knees, sit back slowly.' },
  { db: 'Wrist Circles', area: 'arms', hold: 20, cue: 'Both directions, full range. Worth it after a heavy grip day.' },

  // -- CORE -----------------------------------------------------------------
  { db: 'Overhead Stretch', area: 'core', hold: 30, cue: 'Reach tall and lengthen from the hip to the fingertips.' },
  { db: 'Standing Lateral Stretch', area: 'core', hold: 30, cue: 'Bend straight sideways. Do not let the hips drift out.' },
  { db: 'Torso Rotation', area: 'core', hold: 30, cue: 'Hips face forward, rotate the ribs. Slow both ways.' },
  { db: 'Lower Back Curl', area: 'core', hold: 30, cue: 'Curl up gently, hold at the top of the breath.' },
];

/**
 * Routines, named for when you would reach for one rather than for anatomy.
 * The order inside a routine is the order to do them in: standing work first,
 * floor work last, so you are not up and down off the mat.
 */
const ROUTINES = [
  { id: 'post-leg', title: 'After a leg day', db: [
    'Standing Gastrocnemius Calf Stretch', 'Standing Soleus And Achilles Stretch',
    'Standing Hip Flexors', 'Quad Stretch', "Runner's Stretch",
    'Lying Hamstring', 'Lying Glute', 'Lying Bent Leg Groin', "Child's Pose",
  ] },
  { id: 'post-push', title: 'After chest, shoulders or triceps', db: [
    'Elbows Back', 'Behind Head Chest Stretch', 'Chest And Front Of Shoulder Stretch',
    'Shoulder Stretch', 'Overhead Triceps', 'Seated Front Deltoid',
  ] },
  { id: 'post-pull', title: 'After back or biceps', db: [
    'Overhead Lat', 'Chair Lower Back Stretch', 'Upper Back Stretch',
    'Standing Biceps Stretch', 'Kneeling Forearm Stretch', "Child's Pose",
  ] },
  { id: 'desk', title: 'Desk neck and shoulders', db: [
    'Chin To Chest Stretch', 'Side Neck Stretch', 'Shoulder Circles',
    'Elbows Back', 'Chair Upper Body Stretch', 'Torso Rotation',
  ] },
  { id: 'lower-back', title: 'Low back relief', db: [
    'Standing Pelvic Tilt', 'Cat Stretch', 'Hug Knees To Chest',
    "Dancer's Stretch", 'Lying Glute', 'Lying Hamstring', "Child's Pose",
  ] },
  { id: 'morning', title: 'Morning loosen-up', db: [
    'Arm Circles', 'Shoulder Circles', 'Ankle Circles', 'Cat Stretch',
    'Standing Lateral Stretch', 'Standing Toe Touches',
  ] },
  { id: 'full-body', title: 'Full body reset', db: [
    'Shoulder Circles', 'Behind Head Chest Stretch', 'Shoulder Stretch',
    'Overhead Triceps', 'Standing Lateral Stretch', 'Overhead Lat',
    'Standing Hip Flexors', 'Quad Stretch', 'Standing Toe Touches',
    'Standing Gastrocnemius Calf Stretch', 'Lying Glute', "Child's Pose",
  ] },
];

/**
 * Book entries that name two movements. The dataset has one clip per movement,
 * so these show the first of the pair — which is fine as long as the card says
 * so rather than leaving it looking like a bad match.
 */
const SUPERSETS = [
  'Bench Dips / Close Grip Pushups',
  'Pec Deck with Pushups',
  'Chinups + Barbell Curl',
  'Cable Overhead with Pulley Pushdown',
  'Flat Bar Bench Press and Dumbell Fly',
];

/** Stable id from a stretch name: "Child's Pose" -> "childs-pose". */
function stretchId(name) {
  return name
    .toLowerCase()
    // Apostrophes vanish rather than becoming a hyphen: "child-s-pose" reads
    // like a typo in a URL, and these ids are stored in session records.
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Every distinct (section, name) pair in the generated plan.
 *
 * Section as well as name, because one book name — 'Barbell Press' — appears
 * under two muscle headings and means a different lift under each. Everything
 * else resolves on the name alone.
 */
async function planExercises() {
  const src = await readFile(PLAN, 'utf8');
  const marker = 'TRAINING_PLAN: Schedule[] = ';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`Could not find "${marker}" in ${PLAN}`);
  const plan = JSON.parse(src.slice(start + marker.length, src.lastIndexOf(']') + 1));

  const pairs = new Map();
  for (const s of plan)
    for (const d of s.days)
      for (const sec of d.sections)
        for (const e of sec.exercises) {
          const name = e.name.trim();
          const section = sec.name.trim();
          pairs.set(`${section}|${name}`, { section, name });
        }
  return [...pairs.values()];
}

/** Section-qualified alias first, then the plain name. */
function aliasFor(section, name) {
  return ALIAS[`${section}|${name}`] ?? ALIAS[name];
}

/** `--verify`: print the whole mapping without downloading a byte. */
async function verify() {
  const pairs = await planExercises();
  const rows = pairs
    .map((p) => ({ ...p, target: aliasFor(p.section, p.name) }))
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
  let section = null;
  for (const row of rows) {
    if (row.section !== section) {
      section = row.section;
      console.log(`\n${section}`);
    }
    const qualified = ALIAS[`${row.section}|${row.name}`] ? ' *' : '';
    console.log(`  ${row.name.padEnd(42)} -> ${row.target ?? '(UNMAPPED)'}${qualified}`);
  }
  const unmapped = rows.filter((r) => !r.target);
  console.log(`\n${rows.length} pairs, ${new Set(rows.map((r) => r.target)).size} clips` +
    `, ${unmapped.length} unmapped   (* = section-qualified override)`);
  if (unmapped.length) process.exitCode = 1;
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

  const pairs = await planExercises();
  const names = [...new Set(pairs.map((p) => p.name))];
  // Every name needs a plain alias even when a qualified one exists: the plain
  // key is the fallback `clipFor` lands on when it is called without a section.
  const missing = names.filter((n) => !ALIAS[n]);
  if (missing.length) {
    throw new Error(
      `${missing.length} plan exercises have no alias:\n  ${missing.join('\n  ')}`,
    );
  }
  const strayNotes = SUPERSETS.filter((n) => !names.includes(n));
  if (strayNotes.length) {
    throw new Error(
      `Superset notes name exercises the book does not have:\n  ${strayNotes.join('\n  ')}`,
    );
  }
  const qualified = Object.keys(ALIAS).filter((k) => k.includes('|'));
  console.log(
    `${names.length} plan exercises (${qualified.length} section-qualified) → ` +
      `${new Set(pairs.map((p) => aliasFor(p.section, p.name))).size} distinct clips`,
  );

  // One download+encode per distinct dataset entry, not per plan name.
  const targets = [...new Set(pairs.map((p) => aliasFor(p.section, p.name)))];

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  let bytes = 0;
  const clips = new Map();

  /**
   * Downloads both frames of one dataset entry, re-encodes them and records the
   * clip. Shared by the schedule exercises and the stretch set — both are the
   * same two-frame contract, and a second copy of this would be a second place
   * for the encoding settings to drift.
   */
  const buildClip = async (dbName) => {
    if (clips.has(dbName)) return;
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
  };

  await pool(targets, CONCURRENCY, buildClip);
  console.log('');
  // Counted before the stretches join the same map, or the manifest header
  // reports the stretch frames as schedule clips.
  const exerciseClips = clips.size;

  // Stretches ride the same pipeline: same dataset, same two frames, same
  // encoder, same content-hashed filenames under /exercise-anim.
  const stretchTargets = [...new Set(STRETCHES.map((x) => x.db))];
  const badStretches = stretchTargets.filter((n) => !byName.has(n));
  if (badStretches.length) {
    throw new Error(`Stretches not in dataset:\n  ${badStretches.join('\n  ')}`);
  }
  const routed = new Set(ROUTINES.flatMap((r) => r.db));
  const orphanRoutes = [...routed].filter((n) => !stretchTargets.includes(n));
  if (orphanRoutes.length) {
    throw new Error(`Routines reference unlisted stretches:\n  ${orphanRoutes.join('\n  ')}`);
  }
  console.log(`${stretchTargets.length} stretches across ${ROUTINES.length} routines`);
  await pool(stretchTargets, CONCURRENCY, buildClip);
  console.log('');

  // A handful of dataset entries ship the same photograph twice. They look
  // like a two-frame loop right up until the card renders and nothing moves,
  // so they are caught here rather than noticed in the gym. Frames are
  // content-hashed, which makes the check a string comparison.
  const still = [...clips.entries()].filter(([, c]) => c.a === c.b).map(([n]) => n);
  if (still.length) {
    throw new Error(
      `${still.length} entr${still.length === 1 ? 'y has' : 'ies have'} two identical frames ` +
        `and would not animate:\n  ${still.join('\n  ')}`,
    );
  }
  await rm(scratch, { recursive: true, force: true });

  // Manifest keyed by the book's own exercise name — trainingPlan.ts is
  // generated from the .docx and must not be hand-edited.
  const row = (key, dbName) => {
    const c = clips.get(dbName);
    return `  ${JSON.stringify(key)}: { a: '${c.a}', b: '${c.b}', source: ${JSON.stringify(c.source)} },`;
  };
  // The plain key for every name, then a section-qualified key wherever the
  // section changes the answer. Order does not matter — the lookup tries the
  // qualified key first regardless.
  const rows = [
    ...names.sort((a, b) => a.localeCompare(b)).map((n) => row(n, ALIAS[n])),
    ...pairs
      .filter((p) => ALIAS[`${p.section}|${p.name}`])
      .sort((a, b) => `${a.section}|${a.name}`.localeCompare(`${b.section}|${b.name}`))
      .map((p) => row(`${p.section}|${p.name}`, ALIAS[`${p.section}|${p.name}`])),
  ].join('\n');

  await writeFile(
    MANIFEST,
    `// GENERATED by scripts/build-exercise-media.mjs — do not hand-edit.
// Frames from free-exercise-db (public domain): https://github.com/yuhonas/free-exercise-db
// ${names.length} exercises · ${exerciseClips} distinct clips · files live in /exercise-anim.

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

/**
 * Clip for a book exercise, or null if the plan gains a name we haven't mapped.
 *
 * Pass the muscle section where you have it. One book name — 'Barbell Press' —
 * appears under two headings and means a different lift under each, so the
 * section-qualified key is tried first and the plain name is the fallback.
 */
/**
 * Book entries naming two movements, where the clip shows only the first.
 * The card prints a note, so an apparent mismatch reads as deliberate.
 */
const SUPERSETS = new Set(${JSON.stringify(SUPERSETS)});

export function showsFirstMovementOnly(name: string): boolean {
  return SUPERSETS.has(name.trim());
}

export function clipFor(name: string, section?: string): ExerciseClip | null {
  const key = name.trim();
  if (section) {
    const qualified = EXERCISE_MEDIA[\`\${section.trim()}|\${key}\`];
    if (qualified) return qualified;
  }
  return EXERCISE_MEDIA[key] ?? null;
}
`,
    'utf8',
  );

  const stretchRows = STRETCHES.map((x) => {
    const c = clips.get(x.db);
    return (
      `  { id: '${stretchId(x.db)}', name: ${JSON.stringify(x.db)}, area: '${x.area}', ` +
      `holdSeconds: ${x.hold}, cue: ${JSON.stringify(x.cue)}, ` +
      `a: '${c.a}', b: '${c.b}', source: ${JSON.stringify(c.source)} },`
    );
  }).join('\n');

  const holdById = new Map(STRETCHES.map((x) => [stretchId(x.db), x.hold]));
  const areaById = new Map(STRETCHES.map((x) => [stretchId(x.db), x.area]));
  const routineRows = ROUTINES.map((r) => {
    const ids = r.db.map(stretchId);
    const areas = [...new Set(ids.map((id) => areaById.get(id)))];
    // Holds plus ten seconds each to move between them, rounded to the minute.
    const seconds = ids.reduce((n, id) => n + holdById.get(id) + 10, 0);
    return (
      `  { id: ${JSON.stringify(r.id)}, title: ${JSON.stringify(r.title)}, ` +
      `areas: [${areas.map((a) => `'${a}'`).join(', ')}], ` +
      `minutes: ${Math.max(1, Math.round(seconds / 60))}, ` +
      `stretchIds: [${ids.map((i) => `'${i}'`).join(', ')}] },`
    );
  }).join('\n');

  await writeFile(
    MOBILITY,
    `// GENERATED by scripts/build-exercise-media.mjs — do not hand-edit.
// Frames from free-exercise-db (public domain): https://github.com/yuhonas/free-exercise-db
// ${STRETCHES.length} stretches · ${ROUTINES.length} routines · frames live in /exercise-anim.

/** The body areas a training day can leave tight. */
export type MobilityArea =
  | 'hips'
  | 'hamstrings'
  | 'quads'
  | 'calves'
  | 'back'
  | 'chest'
  | 'shoulders'
  | 'neck'
  | 'arms'
  | 'core';

/** Same two-frame contract as ExerciseClip, plus how long to hold it. */
export interface Stretch {
  id: string;
  name: string;
  area: MobilityArea;
  /** Seconds per side. Written by hand — the dataset does not carry one. */
  holdSeconds: number;
  /** One line, readable mid-hold. The dataset's own instructions are far longer. */
  cue: string;
  a: string;
  b: string;
  source: string;
}

export interface MobilityRoutine {
  id: string;
  title: string;
  areas: MobilityArea[];
  /** Holds plus ten seconds between each, to the nearest minute. */
  minutes: number;
  stretchIds: string[];
}

export const STRETCHES: Stretch[] = [
${stretchRows}
];

export const ROUTINES: MobilityRoutine[] = [
${routineRows}
];

const BY_ID = new Map(STRETCHES.map((s) => [s.id, s]));

export function stretchById(id: string): Stretch | null {
  return BY_ID.get(id) ?? null;
}

/** The stretches of a routine, in order, skipping any that have gone missing. */
export function routineStretches(routine: MobilityRoutine): Stretch[] {
  return routine.stretchIds.map(stretchById).filter((s): s is Stretch => s !== null);
}

export function stretchesForArea(area: MobilityArea): Stretch[] {
  return STRETCHES.filter((s) => s.area === area);
}
`,
    'utf8',
  );

  const files = (await readdir(OUT_DIR)).length;
  console.log(`Wrote ${files} frames (${(bytes / 1024 / 1024).toFixed(1)} MB) → public/exercise-anim`);
  console.log(`Wrote manifest → src/data/exerciseMedia.ts`);
  console.log(`Wrote ${STRETCHES.length} stretches → src/data/mobility.ts`);
}

const task = process.argv.includes('--verify') ? verify : main;

task().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
