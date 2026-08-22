/**
 * Generates src/data/homePlans.ts from the two home-edition .docx files.
 *
 *   node scripts/build-home-plans.mjs [household.docx] [noequipment.docx]
 *
 * The home editions are not new schedules. Each is a restatement of the gym
 * book — the same 13 schedules, 46 training days and 360 exercise slots, in the
 * same order with the same rep counts — with every gym exercise swapped for one
 * you can do at home, each row naming the gym exercise it replaces.
 *
 * So the output is an overlay keyed by movement, not a second plan. That is why
 * this reads src/data/trainingPlan.ts and refuses to emit anything unless all
 * 360 slots line up in order: a substitution table that has quietly drifted one
 * row out of step would put a chair dip where a squat should be, and nothing
 * downstream could tell.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN = join(ROOT, 'src/data/trainingPlan.ts');
const OUT = join(ROOT, 'src/data/homePlans.ts');

const DEFAULTS = {
  household: join(homedir(), 'Downloads', 'Home_Plan_Household.docx'),
  bodyweight: join(homedir(), 'Downloads', 'Home_Plan_NoEquipment.docx'),
};

// ── .docx reading ──────────────────────────────────────────────────────────
//
// A .docx is a zip. Rather than take a dependency to read two files once, this
// walks the central directory itself: find the end-of-central-directory record,
// step through the entries, and inflate the one we want. Only the two
// compression methods Word actually emits are handled — stored and deflate.

/** The bytes of one file inside a zip archive. */
function unzipEntry(buf, wanted) {
  // The EOCD record is at the end, after a comment of unknown length, so scan
  // back for its signature rather than assuming it sits at a fixed offset.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file: no end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    if (name === wanted) {
      // The local header repeats the name and extra fields, and its extra
      // field length can differ from the central one, so read it from there.
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + compressedSize);
      if (method === 0) return raw;
      if (method === 8) return inflateRawSync(raw);
      throw new Error(`Unsupported zip compression method ${method} for ${name}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} not found in archive`);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text) {
  return text
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e]);
}

/**
 * The visible text of one `<w:p>`, as a single line.
 *
 * Tabs and breaks become spaces: they are layout inside a sentence, and a
 * newline in the middle of "Set up" would break the label detection below.
 */
function paragraphText(xml) {
  const out = [];
  for (const m of xml.matchAll(/<w:(t|tab|br)(?:\s[^>]*?)?(\/?)>/g)) {
    if (m[1] === 't' && m[2] !== '/') {
      const open = xml.indexOf('>', m.index) + 1;
      const close = xml.indexOf('</w:t>', open);
      out.push(decode(xml.slice(open, close)));
    } else {
      out.push(' ');
    }
  }
  return out.join('').replace(/\s+/g, ' ').trim();
}

/** Every `<w:p>` in a fragment, as trimmed lines, blanks dropped. */
function paragraphs(xml) {
  return [...xml.matchAll(/<w:p(?:\s[^>]*?)?>([\s\S]*?)<\/w:p>/g)]
    .map((m) => paragraphText(m[1]))
    .filter(Boolean);
}

/** Every table row in the document, as an array of cells of paragraph lines. */
function tableRows(xml) {
  const rows = [];
  for (const row of xml.matchAll(/<w:tr(?:\s[^>]*?)?>([\s\S]*?)<\/w:tr>/g)) {
    const cells = [...row[1].matchAll(/<w:tc(?:\s[^>]*?)?>([\s\S]*?)<\/w:tc>/g)].map((c) =>
      paragraphs(c[1]),
    );
    if (cells.length) rows.push(cells);
  }
  return rows;
}

// ── the exercise rows ──────────────────────────────────────────────────────

/**
 * Pulls the label/value pairs out of a cell whose paragraphs alternate between
 * a heading and its prose: "Set up", the setup, "Move", the move, and so on.
 *
 * Matching on the labels rather than on position means a cell that has picked
 * up an extra empty run, or lost one, fails loudly at the emptiness check below
 * instead of silently shifting every field along by one.
 */
function labelled(lines, labels) {
  const out = {};
  let current = null;
  for (const line of lines) {
    const hit = labels.find((l) => l.toLowerCase() === line.toLowerCase());
    if (hit) {
      current = hit;
      out[hit] = [];
    } else if (current) {
      out[current].push(line);
    }
  }
  return Object.fromEntries(labels.map((l) => [l, (out[l] ?? []).join(' ').trim()]));
}

/** The substitution rows of one home edition, in document order. */
function readEdition(buf, file) {
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const rows = [];

  for (const cells of tableRows(xml)) {
    // An exercise row is the four-column one: number, the substitute and what
    // it replaces, how to do it, and the harder/easier pair. Header rows and
    // the front-matter tables have a different shape or no "replaces" line.
    if (cells.length < 4) continue;
    const [numCell, nameCell, howCell, dialCell] = cells;
    if (!/^\d+$/.test(numCell[0] ?? '')) continue;

    const replacesAt = nameCell.findIndex((l) => /^replaces\b/i.test(l));
    if (replacesAt < 1) continue;

    const name = nameCell.slice(0, replacesAt).join(' ').trim();
    const replaces = nameCell[replacesAt].replace(/^replaces\s*/i, '').trim();
    const how = labelled(howCell, ['Set up', 'Move', 'Feel it']);
    const dial = labelled(dialCell, ['Harder', 'Easier']);

    const entry = {
      n: Number(numCell[0]),
      name,
      replaces,
      setup: how['Set up'],
      move: how.Move,
      feel: how['Feel it'],
      harder: dial.Harder,
      easier: dial.Easier,
    };

    for (const [field, value] of Object.entries(entry)) {
      if (value === '' || value == null) {
        throw new Error(`${file}: row ${rows.length + 1} ("${name}") has an empty ${field}`);
      }
    }
    rows.push(entry);
  }

  return rows;
}

// ── the gym plan it has to line up with ────────────────────────────────────

/** 'WINGS / BACK' -> 'wings-back'. Must match src/lib/movementKey.ts. */
function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Kept in step with ALIASES in src/lib/movementKey.ts by homePlans.test.ts,
// which imports the real movementKey and asserts every key here resolves.
const ALIASES = {
  'forearms/hammer-curl': 'biceps/hammer-curl',
  'forearms/barbell-curl-rev': 'biceps/barbell-curl-rev',
  'forearms/cable-curl-rev': 'biceps/cable-curl-rev',
};

function movementKey(section, name) {
  const raw = `${slug(section)}/${slug(name)}`;
  return ALIASES[raw] ?? raw;
}

/** Every exercise slot in the gym book, in the order it is performed. */
async function planSlots() {
  const src = await readFile(PLAN, 'utf8');
  const marker = 'TRAINING_PLAN: Schedule[] = ';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`Could not find "${marker}" in ${PLAN}`);
  const plan = JSON.parse(src.slice(start + marker.length, src.lastIndexOf(']') + 1));

  const slots = [];
  for (const s of plan)
    for (const d of s.days)
      for (const sec of d.sections)
        for (const e of sec.exercises)
          slots.push({
            section: sec.name.trim(),
            name: e.name.trim(),
            where: `Schedule ${s.id} day ${d.n} ${sec.name} "${e.name}"`,
          });
  return slots;
}

// ── alignment ──────────────────────────────────────────────────────────────

/**
 * Walks the gym book and the home edition in lockstep and builds the overlay.
 *
 * Both the count and every individual name must agree. The one legitimate
 * many-to-one is `Barbell Press`, which the book files under CHEST as a bench
 * press and under SHOULDER as an overhead press; keying on the section-
 * qualified movement key is what keeps those two apart.
 */
function align(slots, rows, label) {
  if (rows.length !== slots.length) {
    throw new Error(
      `${label}: found ${rows.length} exercise rows, but the gym plan has ${slots.length} slots`,
    );
  }

  const variant = new Map();
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const row = rows[i];
    if (row.replaces.toLowerCase() !== slot.name.toLowerCase()) {
      throw new Error(
        `${label}: slot ${i + 1} is out of step — ${slot.where}, but the document says it replaces "${row.replaces}"`,
      );
    }

    const key = movementKey(slot.section, slot.name);
    const entry = {
      name: row.name,
      setup: row.setup,
      move: row.move,
      feel: row.feel,
      harder: row.harder,
      easier: row.easier,
    };
    const seen = variant.get(key);
    if (seen && seen.name !== entry.name) {
      throw new Error(
        `${label}: ${key} is substituted two different ways — "${seen.name}" and "${entry.name}"`,
      );
    }
    if (!seen) variant.set(key, entry);
  }
  return variant;
}

// ── emit ───────────────────────────────────────────────────────────────────

// EQUIPMENT_NOTES is deliberately not emitted here. Naming the modes must not
// drag these tables into every page that mentions them, so the labels live in
// src/types.ts and this file stays purely the substitutions.

const ts = (value) => JSON.stringify(value);

function emit(variants, slotCount) {
  const body = Object.entries(variants)
    .map(([mode, map]) => {
      const entries = [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([key, e]) =>
            `  ${ts(key)}: {\n` +
            `    name: ${ts(e.name)},\n` +
            `    setup: ${ts(e.setup)},\n` +
            `    move: ${ts(e.move)},\n` +
            `    feel: ${ts(e.feel)},\n` +
            `    harder: ${ts(e.harder)},\n` +
            `    easier: ${ts(e.easier)},\n` +
            `  },`,
        )
        .join('\n');
      return `const ${mode.toUpperCase()}: HomeVariant = {\n${entries}\n};`;
    })
    .join('\n\n');

  const counts = Object.entries(variants)
    .map(([mode, map]) => `${map.size} ${mode}`)
    .join(' · ');

  return `// GENERATED by scripts/build-home-plans.mjs — do not hand-edit.
// Home editions of the Revolution Gym & Fitness book: ${counts} substitutions
// across the same ${slotCount} exercise slots as src/data/trainingPlan.ts.
//
// These are not extra schedules. Each home edition restates the whole book with
// every gym exercise swapped for one you can do at home, in the same order and
// at the same rep counts, so the plan structure is shared and only the movement
// on each card changes. That is why this is an overlay keyed by movement rather
// than a second copy of the plan.

import { movementKey } from '../lib/movementKey';
import type { EquipmentMode } from '../types';

/** One home substitute, as the home edition describes it. */
export interface HomeExercise {
  /** What you actually do, in place of the gym movement. */
  name: string;
  setup: string;
  move: string;
  /** Where it should be felt — the book's "Feel it" line. */
  feel: string;
  /**
   * The way up and the way down. At home you cannot add plates, so these are
   * the weight dial: the book's own answer to a movement getting too easy.
   */
  harder: string;
  easier: string;
}

/**
 * Keyed by movementKey(section, gym name), not by the bare name.
 *
 * The section-qualified key is doing real work: 'Barbell Press' is a bench
 * press under CHEST and an overhead press under SHOULDER, and the two editions
 * substitute them differently. Keying on the name alone would collapse them.
 */
type HomeVariant = Record<string, HomeExercise>;

${body}

export const HOME_PLANS: Record<Exclude<EquipmentMode, 'gym'>, HomeVariant> = {
  household: HOUSEHOLD,
  bodyweight: BODYWEIGHT,
};

/**
 * The substitute for one gym movement, or null to show the gym movement itself.
 *
 * Null in gym mode, and null for anything unmapped — a caller that falls back
 * to the book's own exercise on null degrades to the gym card rather than to a
 * blank one.
 */
export function homeExerciseFor(
  mode: EquipmentMode,
  section: string,
  name: string,
): HomeExercise | null {
  if (mode === 'gym') return null;
  return HOME_PLANS[mode][movementKey(section, name)] ?? null;
}
`;
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const [householdPath = DEFAULTS.household, bodyweightPath = DEFAULTS.bodyweight] =
    process.argv.slice(2);

  const slots = await planSlots();
  console.log(`Gym plan: ${slots.length} exercise slots.`);

  const variants = {};
  for (const [mode, path] of [
    ['household', householdPath],
    ['bodyweight', bodyweightPath],
  ]) {
    const rows = readEdition(await readFile(path), path);
    const map = align(slots, rows, mode);
    variants[mode] = map;
    console.log(`${mode}: ${rows.length}/${slots.length} slots aligned, ${map.size} substitutions.`);
  }

  await writeFile(OUT, emit(variants, slots.length), 'utf8');
  console.log(`Wrote ${OUT}`);
}

await main();
