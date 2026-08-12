import type { DayLog, HealthData, ISODate, WeightEntry, WorkoutEntry } from '../types';
import { todayISO } from './dates';
import { isoDate, num } from './validate';
import { uid } from './calc';

/**
 * Bringing data in from Google Fit, Health Connect and Apple Health.
 *
 * There is no live link to be had here, and it is worth being precise about
 * why. Google retired the Fit REST API; its replacement, Health Connect, is an
 * on-device Android datastore with no web-facing API at all. Apple Health is
 * likewise on-device with no public server. A page running in a browser has
 * nothing to connect *to* — the only supported way out of any of those apps is
 * an export file.
 *
 * So that is what this reads:
 *   - Apple Health  -> export.xml (from Health app -> profile -> Export)
 *   - Google Fit    -> Takeout CSV (Daily activity metrics)
 *   - Health Connect / Fitbit / Garmin / Samsung -> any CSV with a date column
 *
 * The CSV path is deliberately header-driven rather than format-specific,
 * because every one of those exporters names its columns differently and they
 * all change them periodically.
 */

export const MAX_HEALTH_IMPORT_BYTES = 120 * 1024 * 1024;

export type ImportSource = 'apple-health' | 'csv';

export interface ImportPreview {
  source: ImportSource;
  /** What was found, ready to merge. */
  days: DayLog[];
  weights: WeightEntry[];
  workouts: WorkoutEntry[];
  /** Human-readable "steps: 412 days" lines for the confirmation screen. */
  found: { label: string; count: number }[];
  firstDate?: ISODate;
  lastDate?: ISODate;
  /** Columns or record types present in the file that this importer ignored. */
  skipped: string[];
}

// --- shared accumulation -----------------------------------------------------

/** Collects per-day values, summing what should be summed and averaging the rest. */
class DayAccumulator {
  private steps = new Map<ISODate, number>();
  private water = new Map<ISODate, number>();
  private sleep = new Map<ISODate, number>();
  private hr = new Map<ISODate, { total: number; n: number }>();

  addSteps(date: ISODate, value: number) {
    this.steps.set(date, (this.steps.get(date) ?? 0) + value);
  }
  addWater(date: ISODate, ml: number) {
    this.water.set(date, (this.water.get(date) ?? 0) + ml);
  }
  addSleep(date: ISODate, hours: number) {
    this.sleep.set(date, (this.sleep.get(date) ?? 0) + hours);
  }
  addRestingHr(date: ISODate, bpm: number) {
    const cur = this.hr.get(date) ?? { total: 0, n: 0 };
    this.hr.set(date, { total: cur.total + bpm, n: cur.n + 1 });
  }

  counts() {
    return {
      steps: this.steps.size,
      water: this.water.size,
      sleep: this.sleep.size,
      restingHr: this.hr.size,
    };
  }

  build(): DayLog[] {
    const dates = new Set([
      ...this.steps.keys(),
      ...this.water.keys(),
      ...this.sleep.keys(),
      ...this.hr.keys(),
    ]);
    const out: DayLog[] = [];
    for (const date of dates) {
      const log: DayLog = { date, habits: {} };
      const steps = this.steps.get(date);
      const water = this.water.get(date);
      const sleep = this.sleep.get(date);
      const hr = this.hr.get(date);
      if (steps !== undefined) log.steps = Math.round(steps);
      if (water !== undefined) log.waterMl = Math.round(water);
      // Cap at 24 h: overlapping sleep records are common in Apple exports where
      // a watch and a phone both wrote the same night.
      if (sleep !== undefined) log.sleepHours = Math.min(24, Math.round(sleep * 4) / 4);
      if (hr && hr.n > 0) log.restingHr = Math.round(hr.total / hr.n);
      out.push(log);
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
}

/** Apple writes '2026-03-15 08:12:33 +0000'; CSVs write anything at all. */
function dateOf(raw: string): ISODate | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const direct = isoDate(trimmed.slice(0, 10));
  if (direct) return direct;

  // DD/MM/YYYY and MM/DD/YYYY are ambiguous. Only accept the unambiguous half —
  // guessing wrong would silently misfile months of history.
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(trimmed);
  if (slash) {
    const [, a, b, y] = slash;
    const first = Number(a);
    const second = Number(b);
    if (first > 12 && second <= 12) {
      return isoDate(`${y}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`);
    }
    if (second > 12 && first <= 12) {
      return isoDate(`${y}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`);
    }
    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return todayISO(parsed);
}

// --- CSV ---------------------------------------------------------------------

/** Minimal RFC-4180 reader: quoted fields, doubled quotes, embedded commas. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

type Metric = 'date' | 'steps' | 'weightKg' | 'sleepHours' | 'restingHr' | 'waterMl' | 'activeMin';
type Unit = 'kg' | 'lb' | 'g' | 'hours' | 'min' | 'ms' | 'ml' | 'l' | 'floz';

/**
 * Header matchers, most specific first. Order matters: "active minutes" has to
 * beat a bare "minutes", and "resting heart rate" has to beat "heart rate",
 * which is a daily average and means something quite different.
 */
const COLUMN_RULES: { metric: Metric; test: RegExp }[] = [
  { metric: 'date', test: /^(date|day|start(\s|_)?time|time|datetime|timestamp)$/ },
  { metric: 'steps', test: /step/ },
  { metric: 'restingHr', test: /resting.*(heart|hr|pulse)|(heart|hr).*resting/ },
  { metric: 'sleepHours', test: /sleep/ },
  { metric: 'weightKg', test: /weight|body\s*mass(?!\s*index)/ },
  { metric: 'waterMl', test: /water|hydration/ },
  { metric: 'activeMin', test: /(active|move|exercise|workout).*(minute|min\b|duration)/ },
];

/**
 * Units come from a separate pass rather than from the metric rules. Doing it
 * in one regex meant "Average weight (kg)" matched a grams pattern — it ends in
 * `g)` — and every reading was divided by 1000 and then silently discarded for
 * being out of range. Matching the unit token on its own boundary is both
 * clearer and harder to get wrong.
 */
function unitOf(header: string, metric: Metric): Unit | undefined {
  if (metric === 'weightKg') {
    if (/\blbs?\b|\bpounds?\b/.test(header)) return 'lb';
    if (/\bkgs?\b|\bkilo(gram)?s?\b/.test(header)) return 'kg';
    if (/\(g\)|\bgram(me)?s?\b/.test(header)) return 'g';
    return 'kg';
  }
  if (metric === 'sleepHours') {
    if (/\bms\b|millisecond/.test(header)) return 'ms';
    if (/\bmin(ute)?s?\b/.test(header)) return 'min';
    return 'hours';
  }
  if (metric === 'waterMl') {
    if (/\bfl\.?\s*oz\b|fluid\s*ounce/.test(header)) return 'floz';
    if (/\bl\b|\blit(re|er)s?\b/.test(header)) return 'l';
    return 'ml';
  }
  return undefined;
}

function classify(header: string): { metric: Metric; unit?: Unit } | null {
  const key = header.trim().toLowerCase();
  if (!key) return null;
  for (const rule of COLUMN_RULES) {
    if (rule.test.test(key)) return { metric: rule.metric, unit: unitOf(key, rule.metric) };
  }
  return null;
}

function numeric(raw: string): number | undefined {
  const cleaned = raw.trim().replace(/[, ]/g, '');
  if (!cleaned) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

function importCSV(text: string): ImportPreview {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('That CSV has no data rows in it.');

  const header = rows[0];
  const mapped = header.map(classify);
  const dateCol = mapped.findIndex((m) => m?.metric === 'date');
  if (dateCol === -1) {
    throw new Error(
      `No date column found. The header row was: ${header.slice(0, 8).join(', ')}${header.length > 8 ? '…' : ''}`,
    );
  }

  const skipped = header.filter((h, i) => h.trim() && !mapped[i]);
  const daysAcc = new DayAccumulator();
  const weightByDate = new Map<ISODate, number>();
  const activeByDate = new Map<ISODate, number>();

  for (const row of rows.slice(1)) {
    const date = dateOf(row[dateCol] ?? '');
    if (!date) continue;

    for (let col = 0; col < mapped.length; col += 1) {
      const rule = mapped[col];
      if (!rule || rule.metric === 'date') continue;
      const value = numeric(row[col] ?? '');
      if (value === undefined || value <= 0) continue;

      switch (rule.metric) {
        case 'steps':
          daysAcc.addSteps(date, value);
          break;
        case 'weightKg': {
          const kg =
            rule.unit === 'lb' ? value * 0.45359237 : rule.unit === 'g' ? value / 1000 : value;
          if (num(kg, 20, 500) !== undefined) weightByDate.set(date, kg);
          break;
        }
        case 'sleepHours': {
          const hours =
            rule.unit === 'min' ? value / 60 : rule.unit === 'ms' ? value / 3_600_000 : value;
          if (hours > 0 && hours <= 24) daysAcc.addSleep(date, hours);
          break;
        }
        case 'restingHr':
          if (num(value, 25, 220) !== undefined) daysAcc.addRestingHr(date, value);
          break;
        case 'waterMl':
          daysAcc.addWater(
            date,
            rule.unit === 'l' ? value * 1000 : rule.unit === 'floz' ? value * 29.5735 : value,
          );
          break;
        case 'activeMin':
          activeByDate.set(date, (activeByDate.get(date) ?? 0) + value);
          break;
      }
    }
  }

  const weights: WeightEntry[] = [...weightByDate.entries()].map(([date, kg]) => ({
    id: uid('w'),
    date,
    weightKg: Math.round(kg * 10) / 10,
  }));

  // A daily "active minutes" total is not a session, so it is imported as one
  // generic entry per day rather than pretending to know what was done.
  const workouts: WorkoutEntry[] = [...activeByDate.entries()]
    .filter(([, minutes]) => minutes >= 5)
    .map(([date, minutes]) => ({
      id: uid('k'),
      date,
      type: 'Other',
      minutes: Math.min(1440, Math.round(minutes)),
      intensity: 'moderate' as const,
      note: 'Imported active minutes',
    }));

  const days = daysAcc.build();
  const counts = daysAcc.counts();

  return {
    source: 'csv',
    days,
    weights,
    workouts,
    found: [
      { label: 'Days with steps', count: counts.steps },
      { label: 'Weight readings', count: weights.length },
      { label: 'Nights of sleep', count: counts.sleep },
      { label: 'Resting heart rate days', count: counts.restingHr },
      { label: 'Days with water', count: counts.water },
      { label: 'Activity sessions', count: workouts.length },
    ].filter((f) => f.count > 0),
    ...dateRange([...days, ...weights, ...workouts]),
    skipped,
  };
}

// --- Apple Health XML --------------------------------------------------------

const APPLE_WORKOUT_NAMES: Record<string, string> = {
  Running: 'Run',
  Walking: 'Walk',
  Cycling: 'Cycling',
  Swimming: 'Swim',
  TraditionalStrengthTraining: 'Strength',
  FunctionalStrengthTraining: 'Strength',
  HighIntensityIntervalTraining: 'HIIT',
  Yoga: 'Yoga',
  Rowing: 'Rowing',
  Elliptical: 'Other',
};

/** Precompiled once — these run millions of times on a real export. */
const ATTR = {
  type: /\btype="([^"]*)"/,
  unit: /\bunit="([^"]*)"/,
  startDate: /\bstartDate="([^"]*)"/,
  endDate: /\bendDate="([^"]*)"/,
  value: /\bvalue="([^"]*)"/,
  activity: /\bworkoutActivityType="([^"]*)"/,
  duration: /\bduration="([^"]*)"/,
};

function attrOf(attrs: string, re: RegExp): string | undefined {
  return re.exec(attrs)?.[1];
}

/**
 * Scanned with a regex rather than DOMParser on purpose. A few years of Apple
 * Health is routinely 300–800 MB of XML with millions of `<Record>` elements;
 * building a DOM for that reliably runs the tab out of memory, while a linear
 * scan over the string stays flat.
 */
function importAppleHealth(text: string): ImportPreview {
  const daysAcc = new DayAccumulator();
  const weightByDate = new Map<ISODate, number>();
  const workouts: WorkoutEntry[] = [];
  const seenTypes = new Set<string>();
  const usedTypes = new Set<string>();

  // Grab each element's attribute block, then read attributes individually.
  // One combined regex with optional groups looked tidier and was wrong: the
  // lazy `[^>]*?` between groups happily consumed `endDate="…"` and left the
  // optional capture empty, so every sleep record silently produced no
  // duration. Attributes are unordered in XML; parse them as such.
  const recordRe = /<Record\b([^>]*)>/g;

  for (const m of text.matchAll(recordRe)) {
    const attrs = m[1];
    const fullType = attrOf(attrs, ATTR.type);
    if (!fullType) continue;
    const type = fullType.replace(/^HK(?:Quantity|Category)TypeIdentifier/, '');
    if (type === fullType) continue; // not a record type this export uses

    seenTypes.add(type);
    const startDate = attrOf(attrs, ATTR.startDate);
    if (!startDate) continue;
    const date = dateOf(startDate);
    if (!date) continue;

    const unit = attrOf(attrs, ATTR.unit);
    const endDate = attrOf(attrs, ATTR.endDate);
    const value = numeric(attrOf(attrs, ATTR.value) ?? '');

    switch (type) {
      case 'StepCount':
        if (value !== undefined) {
          daysAcc.addSteps(date, value);
          usedTypes.add(type);
        }
        break;
      case 'BodyMass': {
        if (value === undefined) break;
        const kg = /lb/i.test(unit ?? '') ? value * 0.45359237 : value;
        if (num(kg, 20, 500) !== undefined) {
          weightByDate.set(date, kg);
          usedTypes.add(type);
        }
        break;
      }
      case 'RestingHeartRate':
        if (value !== undefined && num(value, 25, 220) !== undefined) {
          daysAcc.addRestingHr(date, value);
          usedTypes.add(type);
        }
        break;
      case 'DietaryWater':
        if (value !== undefined) {
          // Apple records water in litres or fl oz depending on locale.
          const ml = /fl_oz|floz/i.test(unit ?? '') ? value * 29.5735 : value * 1000;
          daysAcc.addWater(date, ml);
          usedTypes.add(type);
        }
        break;
      case 'SleepAnalysis': {
        // Category records carry no numeric value — the duration is the span.
        if (!endDate) break;
        const hours = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 3_600_000;
        if (hours > 0 && hours <= 24) {
          daysAcc.addSleep(date, hours);
          usedTypes.add(type);
        }
        break;
      }
    }
  }

  const workoutRe = /<Workout\b([^>]*)>/g;
  for (const m of text.matchAll(workoutRe)) {
    const attrs = m[1];
    const activity = (attrOf(attrs, ATTR.activity) ?? '').replace(/^HKWorkoutActivityType/, '');
    const startDate = attrOf(attrs, ATTR.startDate);
    if (!activity || !startDate) continue;
    const date = dateOf(startDate);
    const minutes = numeric(attrOf(attrs, ATTR.duration) ?? '');
    if (!date || minutes === undefined || minutes <= 0) continue;
    workouts.push({
      id: uid('k'),
      date,
      type: APPLE_WORKOUT_NAMES[activity] ?? 'Other',
      minutes: Math.min(1440, Math.round(minutes)),
      intensity: 'moderate',
      note: `Imported from Apple Health (${activity})`,
    });
  }

  const weights: WeightEntry[] = [...weightByDate.entries()].map(([date, kg]) => ({
    id: uid('w'),
    date,
    weightKg: Math.round(kg * 10) / 10,
  }));
  const days = daysAcc.build();
  const counts = daysAcc.counts();

  if (days.length === 0 && weights.length === 0 && workouts.length === 0) {
    throw new Error(
      'That looks like an Apple Health export, but none of the record types this app tracks were in it.',
    );
  }

  return {
    source: 'apple-health',
    days,
    weights,
    workouts,
    found: [
      { label: 'Days with steps', count: counts.steps },
      { label: 'Weight readings', count: weights.length },
      { label: 'Nights of sleep', count: counts.sleep },
      { label: 'Resting heart rate days', count: counts.restingHr },
      { label: 'Days with water', count: counts.water },
      { label: 'Workouts', count: workouts.length },
    ].filter((f) => f.count > 0),
    ...dateRange([...days, ...weights, ...workouts]),
    skipped: [...seenTypes].filter((t) => !usedTypes.has(t)).sort().slice(0, 12),
  };
}

function dateRange(items: { date: ISODate }[]): { firstDate?: ISODate; lastDate?: ISODate } {
  if (!items.length) return {};
  const sorted = items.map((i) => i.date).sort();
  return { firstDate: sorted[0], lastDate: sorted[sorted.length - 1] };
}

// --- entry point -------------------------------------------------------------

export async function readHealthExport(file: File): Promise<ImportPreview> {
  if (file.size > MAX_HEALTH_IMPORT_BYTES) {
    throw new Error(
      `That file is ${(file.size / 1024 / 1024).toFixed(0)} MB, over the ${MAX_HEALTH_IMPORT_BYTES / 1024 / 1024} MB ceiling.`,
    );
  }
  if (/\.zip$/i.test(file.name)) {
    throw new Error(
      'Unzip the export first and pick the file inside — export.xml for Apple Health, or the CSV for Google Takeout.',
    );
  }

  const text = await file.text();
  if (/<HealthData/i.test(text.slice(0, 4096))) return importAppleHealth(text);
  if (/\.xml$/i.test(file.name)) {
    throw new Error('That XML is not an Apple Health export — the file you want is export.xml.');
  }
  return importCSV(text);
}

// --- merge -------------------------------------------------------------------

export type MergeMode = 'fill-gaps' | 'overwrite';

export interface MergeResult {
  data: HealthData;
  added: { days: number; weights: number; workouts: number };
  keptExisting: number;
}

/**
 * Merges imported records into the existing data.
 *
 * 'fill-gaps' is the default and the safe one: anything you typed by hand wins,
 * and the import only fills fields that are empty. Devices disagree constantly
 * — a phone and a watch will both claim a step count for the same day — and
 * quietly overwriting a hand-corrected weight with a bad scale reading is
 * exactly the sort of thing that makes people stop trusting an app.
 */
export function mergeImport(
  current: HealthData,
  preview: ImportPreview,
  mode: MergeMode,
): MergeResult {
  const added = { days: 0, weights: 0, workouts: 0 };
  let keptExisting = 0;

  // --- day logs: field-level merge
  const dayByDate = new Map(current.days.map((d) => [d.date, d]));
  for (const incoming of preview.days) {
    const existing = dayByDate.get(incoming.date);
    if (!existing) {
      dayByDate.set(incoming.date, incoming);
      added.days += 1;
      continue;
    }
    const merged: DayLog = { ...existing };
    let touched = false;
    for (const field of ['steps', 'sleepHours', 'restingHr', 'waterMl'] as const) {
      const value = incoming[field];
      if (value === undefined) continue;
      if (existing[field] !== undefined && mode !== 'overwrite') {
        keptExisting += 1;
        continue;
      }
      merged[field] = value;
      touched = true;
    }
    if (touched) {
      dayByDate.set(incoming.date, merged);
      added.days += 1;
    }
  }

  // --- weights: one per day, existing entry wins unless overwriting
  const weightByDate = new Map(current.weights.map((w) => [w.date, w]));
  for (const incoming of preview.weights) {
    if (weightByDate.has(incoming.date) && mode !== 'overwrite') {
      keptExisting += 1;
      continue;
    }
    weightByDate.set(incoming.date, incoming);
    added.weights += 1;
  }

  // --- workouts: append, but skip anything that looks like the same session
  const signature = new Set(current.workouts.map((w) => `${w.date}|${w.type}|${w.minutes}`));
  const workouts = [...current.workouts];
  for (const incoming of preview.workouts) {
    const key = `${incoming.date}|${incoming.type}|${incoming.minutes}`;
    if (signature.has(key)) {
      keptExisting += 1;
      continue;
    }
    signature.add(key);
    workouts.push(incoming);
    added.workouts += 1;
  }

  return {
    data: {
      ...current,
      days: [...dayByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      weights: [...weightByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      workouts,
    },
    added,
    keptExisting,
  };
}
