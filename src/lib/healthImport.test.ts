import { describe, expect, it } from 'vitest';
import { mergeImport, parseCSV, readHealthExport, type ImportPreview } from './healthImport';
import { DEFAULT_DATA, type HealthData } from '../types';

/** Node's File is available from undici in Node 20+, which is what vitest runs on. */
function fileOf(name: string, content: string): File {
  return new File([content], name, { type: name.endsWith('.xml') ? 'text/xml' : 'text/csv' });
}

describe('parseCSV', () => {
  it('reads plain rows', () => {
    expect(parseCSV('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('honours quoted fields containing commas and newlines', () => {
    expect(parseCSV('a,b\n"x,y","line\nbreak"')).toEqual([
      ['a', 'b'],
      ['x,y', 'line\nbreak'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCSV('a\n"say ""hi"""')).toEqual([['a'], ['say "hi"']]);
  });

  it('handles CRLF and skips blank lines', () => {
    expect(parseCSV('a,b\r\n1,2\r\n\r\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });
});

describe('CSV import', () => {
  it('reads a Google Takeout daily-metrics style export', async () => {
    const csv = [
      'Date,Move Minutes count,Calories (kcal),Distance (m),Step count,Average weight (kg)',
      '2026-03-01,45,2100,6400,9123,81.4',
      '2026-03-02,0,1980,2200,4501,81.2',
    ].join('\n');

    const preview = await readHealthExport(fileOf('Daily activity metrics.csv', csv));
    expect(preview.source).toBe('csv');
    expect(preview.days).toHaveLength(2);
    expect(preview.days[0]).toMatchObject({ date: '2026-03-01', steps: 9123 });
    expect(preview.weights.map((w) => w.weightKg)).toEqual([81.4, 81.2]);
    expect(preview.firstDate).toBe('2026-03-01');
    expect(preview.lastDate).toBe('2026-03-02');
  });

  it('converts pounds, sleep minutes and reports what it ignored', async () => {
    const csv = [
      'Date,Weight (lbs),Sleep minutes,Resting heart rate,Mystery column',
      '2026-03-01,176.4,450,54,xyz',
    ].join('\n');

    const preview = await readHealthExport(fileOf('fitbit.csv', csv));
    expect(preview.weights[0].weightKg).toBeCloseTo(80, 1);
    expect(preview.days[0].sleepHours).toBe(7.5);
    expect(preview.days[0].restingHr).toBe(54);
    expect(preview.skipped).toContain('Mystery column');
  });

  it('prefers resting heart rate over a generic heart rate column', async () => {
    const csv = 'Date,Heart rate,Resting heart rate\n2026-03-01,120,52';
    const preview = await readHealthExport(fileOf('x.csv', csv));
    expect(preview.days[0].restingHr).toBe(52);
  });

  it('sums step counts when a day appears more than once', async () => {
    const csv = 'Date,Steps\n2026-03-01,4000\n2026-03-01,3000';
    const preview = await readHealthExport(fileOf('x.csv', csv));
    expect(preview.days).toHaveLength(1);
    expect(preview.days[0].steps).toBe(7000);
  });

  it('refuses a file with no date column, quoting the header back', async () => {
    await expect(readHealthExport(fileOf('x.csv', 'steps,weight\n100,80'))).rejects.toThrow(
      /No date column/,
    );
  });

  it('skips ambiguous DD/MM vs MM/DD dates rather than guessing', async () => {
    const csv = 'Date,Steps\n05/03/2026,4000\n25/03/2026,5000';
    const preview = await readHealthExport(fileOf('x.csv', csv));
    // Only the unambiguous 25/03 survives, read as 25 March.
    expect(preview.days.map((d) => d.date)).toEqual(['2026-03-25']);
  });

  it('rejects an out-of-range weight instead of storing it', async () => {
    const csv = 'Date,Weight\n2026-03-01,4000';
    const preview = await readHealthExport(fileOf('x.csv', csv));
    expect(preview.weights).toEqual([]);
  });

  it('tells you to unzip an archive', async () => {
    await expect(readHealthExport(fileOf('export.zip', 'PK'))).rejects.toThrow(/Unzip/);
  });
});

describe('Apple Health import', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_GB">
  <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-03-01 08:00:00 +0000" endDate="2026-03-01 09:00:00 +0000" value="3000"/>
  <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-03-01 18:00:00 +0000" endDate="2026-03-01 19:00:00 +0000" value="4500"/>
  <Record type="HKQuantityTypeIdentifierBodyMass" unit="kg" startDate="2026-03-01 07:00:00 +0000" endDate="2026-03-01 07:00:00 +0000" value="80.6"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-03-01 07:00:00 +0000" endDate="2026-03-01 07:00:00 +0000" value="53"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-03-02 23:00:00 +0000" endDate="2026-03-03 06:30:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
  <Record type="HKQuantityTypeIdentifierBloodGlucose" unit="mg/dL" startDate="2026-03-01 07:00:00 +0000" endDate="2026-03-01 07:00:00 +0000" value="90"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="42.5" durationUnit="min" startDate="2026-03-01 17:00:00 +0000"/>
</HealthData>`;

  it('recognises the format from its root element', async () => {
    const preview = await readHealthExport(fileOf('export.xml', xml));
    expect(preview.source).toBe('apple-health');
  });

  it('sums step records into one day', async () => {
    const preview = await readHealthExport(fileOf('export.xml', xml));
    const march1 = preview.days.find((d) => d.date === '2026-03-01');
    expect(march1?.steps).toBe(7500);
    expect(march1?.restingHr).toBe(53);
  });

  it('derives sleep hours from the record span', async () => {
    const preview = await readHealthExport(fileOf('export.xml', xml));
    const night = preview.days.find((d) => d.date === '2026-03-02');
    expect(night?.sleepHours).toBe(7.5);
  });

  it('maps workout activity types to this app names', async () => {
    const preview = await readHealthExport(fileOf('export.xml', xml));
    expect(preview.workouts).toHaveLength(1);
    expect(preview.workouts[0]).toMatchObject({ type: 'Run', minutes: 43, date: '2026-03-01' });
  });

  it('lists record types it did not use', async () => {
    const preview = await readHealthExport(fileOf('export.xml', xml));
    expect(preview.skipped).toContain('BloodGlucose');
  });

  it('rejects an Apple export with nothing this app tracks', async () => {
    const empty = `<HealthData><Record type="HKQuantityTypeIdentifierBloodGlucose" unit="mg/dL" startDate="2026-03-01 07:00:00 +0000" value="90"/></HealthData>`;
    await expect(readHealthExport(fileOf('export.xml', empty))).rejects.toThrow(/none of the record types/);
  });
});

describe('mergeImport', () => {
  const preview = (over: Partial<ImportPreview> = {}): ImportPreview => ({
    source: 'csv',
    days: [],
    weights: [],
    workouts: [],
    found: [],
    skipped: [],
    ...over,
  });

  const current: HealthData = {
    ...DEFAULT_DATA,
    days: [{ date: '2026-03-01', habits: { h1: true }, steps: 5000, sleepHours: 7 }],
    weights: [{ id: 'mine', date: '2026-03-01', weightKg: 80 }],
    workouts: [
      { id: 'k1', date: '2026-03-01', type: 'Run', minutes: 30, intensity: 'moderate' },
    ],
  };

  it('fills empty fields without disturbing what was typed by hand', () => {
    const result = mergeImport(
      current,
      preview({ days: [{ date: '2026-03-01', habits: {}, steps: 9999, restingHr: 55 }] }),
      'fill-gaps',
    );
    const day = result.data.days[0];
    expect(day.steps).toBe(5000); // kept
    expect(day.restingHr).toBe(55); // filled
    expect(day.habits).toEqual({ h1: true }); // untouched
    expect(result.keptExisting).toBe(1);
  });

  it('lets the file win when asked', () => {
    const result = mergeImport(
      current,
      preview({ days: [{ date: '2026-03-01', habits: {}, steps: 9999 }] }),
      'overwrite',
    );
    expect(result.data.days[0].steps).toBe(9999);
    expect(result.data.days[0].sleepHours).toBe(7);
  });

  it('adds days it has never seen', () => {
    const result = mergeImport(
      current,
      preview({ days: [{ date: '2026-03-02', habits: {}, steps: 8000 }] }),
      'fill-gaps',
    );
    expect(result.data.days).toHaveLength(2);
    expect(result.added.days).toBe(1);
  });

  it('keeps one weight per day and prefers the existing reading', () => {
    const incoming = { id: 'imported', date: '2026-03-01', weightKg: 99 };
    expect(mergeImport(current, preview({ weights: [incoming] }), 'fill-gaps').data.weights).toEqual(
      current.weights,
    );
    expect(
      mergeImport(current, preview({ weights: [incoming] }), 'overwrite').data.weights[0].weightKg,
    ).toBe(99);
  });

  it('does not double-log a session already recorded', () => {
    const duplicate = {
      id: 'other',
      date: '2026-03-01',
      type: 'Run',
      minutes: 30,
      intensity: 'moderate' as const,
    };
    const result = mergeImport(current, preview({ workouts: [duplicate] }), 'fill-gaps');
    expect(result.data.workouts).toHaveLength(1);
    expect(result.added.workouts).toBe(0);
  });

  it('appends a genuinely different session on the same day', () => {
    const other = {
      id: 'other',
      date: '2026-03-01',
      type: 'Strength',
      minutes: 45,
      intensity: 'moderate' as const,
    };
    const result = mergeImport(current, preview({ workouts: [other] }), 'fill-gaps');
    expect(result.data.workouts).toHaveLength(2);
    expect(result.added.workouts).toBe(1);
  });

  it('leaves settings and meals alone', () => {
    const result = mergeImport(current, preview({ days: [{ date: '2026-04-01', habits: {} }] }), 'fill-gaps');
    expect(result.data.settings).toBe(current.settings);
    expect(result.data.meals).toBe(current.meals);
  });

  it('returns days in date order', () => {
    const result = mergeImport(
      current,
      preview({
        days: [
          { date: '2026-02-01', habits: {}, steps: 1 },
          { date: '2026-04-01', habits: {}, steps: 2 },
        ],
      }),
      'fill-gaps',
    );
    expect(result.data.days.map((d) => d.date)).toEqual(['2026-02-01', '2026-03-01', '2026-04-01']);
  });
});
