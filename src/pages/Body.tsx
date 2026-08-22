import { useMemo, useState, type FormEvent } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Card, Empty, Field, Pill, Segmented, StatTile } from '../components/ui';
import { SERIES, WeightChart } from '../components/charts';
import { addDays, relativeLabel, todayISO } from '../lib/dates';
import {
  ageFrom,
  bmi,
  bmiBand,
  bmr,
  latestWeight,
  rollingMean,
  sortByDateDesc,
  uid,
  weightChange,
} from '../lib/calc';
import { labels, round, toCanonical, toDisplay } from '../lib/units';
import type { WeightEntry } from '../types';

const RANGES = [
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 365, label: '1y' },
];

const blankForm = () => ({
  date: todayISO(),
  weight: '',
  bodyFat: '',
  waist: '',
  chest: '',
  hip: '',
  note: '',
});

export default function Body() {
  const { data, update } = useHealth();
  const { units, goals, heightCm } = {
    units: data.settings.units,
    goals: data.settings.goals,
    heightCm: data.settings.heightCm,
  };
  const u = labels(units);
  const [range, setRange] = useState(90);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState<string | null>(null);

  const showWeight = (kg: number) => toDisplay('weight', kg, units).toFixed(1);
  const showLength = (cm: number) => round(toDisplay('length', cm, units), 1);

  const latest = latestWeight(data.weights);
  const week = weightChange(data.weights, 7);
  const month = weightChange(data.weights, 30);

  const chartData = useMemo(() => {
    const since = addDays(todayISO(), -(range - 1));
    const inRange = [...data.weights]
      .filter((w) => w.date >= since)
      .sort((a, b) => a.date.localeCompare(b.date));
    const trend = rollingMean(
      inRange.map((w) => ({ date: w.date, value: w.weightKg })),
      7,
    );
    return inRange.map((w, i) => ({
      date: w.date,
      weightKg: w.weightKg,
      trend: trend[i]?.value ?? null,
    }));
  }, [data.weights, range]);

  const bmiValue = latest && heightCm ? bmi(latest.weightKg, heightCm) : null;
  const band = bmiValue ? bmiBand(bmiValue) : null;
  // Null until every term is present — see the note on bmr(). The tile says
  // which one is missing rather than showing a number built on assumptions.
  const restingBurn = bmr({
    weightKg: latest?.weightKg,
    heightCm,
    age: ageFrom(data.settings.birthYear),
    sex: data.settings.sex,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const weight = Number(form.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      setError('Enter a weight above zero.');
      return;
    }
    setError(null);

    const entry: WeightEntry = {
      id: uid('w'),
      date: form.date,
      weightKg: toCanonical('weight', weight, units),
    };
    if (form.bodyFat) entry.bodyFatPct = Number(form.bodyFat);
    if (form.waist) entry.waistCm = toCanonical('length', Number(form.waist), units);
    if (form.chest) entry.chestCm = toCanonical('length', Number(form.chest), units);
    if (form.hip) entry.hipCm = toCanonical('length', Number(form.hip), units);
    if (form.note.trim()) entry.note = form.note.trim();

    // One reading per day — a re-entry corrects that day rather than stacking.
    update('weights', (current) => [...current.filter((w) => w.date !== entry.date), entry]);
    setForm({ ...blankForm(), date: form.date });
  }

  const deltaLabel = (change: { delta: number } | null) => {
    if (!change) return 'Not enough readings';
    const value = showWeight(Math.abs(change.delta));
    if (Math.abs(change.delta) < 0.05) return 'No change';
    return `${change.delta > 0 ? '▲' : '▼'} ${value} ${u.weight}`;
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Body</h1>
          <p className="page-sub">Weight, composition and measurements over time.</p>
        </div>
        <Segmented options={RANGES} value={range} onChange={setRange} ariaLabel="Chart range" />
      </header>

      <div className="stack">
        <div className="grid grid-stats">
          <StatTile
            label="Current weight"
            color={SERIES.weight}
            value={latest ? showWeight(latest.weightKg) : '—'}
            unit={latest ? u.weight : undefined}
            foot={latest ? `Logged ${relativeLabel(latest.date)}` : 'No readings yet'}
          />
          <StatTile label="Last 7 days" value={deltaLabel(week)} foot="First to latest reading" />
          <StatTile label="Last 30 days" value={deltaLabel(month)} foot="First to latest reading" />
          <StatTile
            label="Body fat"
            value={
              sortByDateDesc(data.weights).find((w) => w.bodyFatPct != null)?.bodyFatPct?.toFixed(1) ??
              '—'
            }
            unit={data.weights.some((w) => w.bodyFatPct != null) ? '%' : undefined}
            foot="Most recent measurement"
          />
          <StatTile
            label="BMI"
            value={bmiValue ? bmiValue.toFixed(1) : '—'}
            foot={
              band ? (
                <Pill status={band.status}>{band.label}</Pill>
              ) : (
                'Add your height in Settings'
              )
            }
          />
          <StatTile
            label="Resting burn"
            value={restingBurn ? String(restingBurn) : '—'}
            unit={restingBurn ? 'kcal/day' : undefined}
            foot={
              restingBurn
                ? 'Mifflin-St Jeor, at complete rest'
                : 'Needs height, birth year and sex in Settings'
            }
          />
        </div>

        <Card
          title="Weight trend"
          note="Scale weight bounces with hydration — read the trend line, not the dots."
        >
          {chartData.length >= 2 ? (
            <WeightChart
              data={chartData}
              unitLabel={u.weight}
              convert={(kg) => toDisplay('weight', kg, units)}
              goal={goals.weightKg}
            />
          ) : (
            <Empty emoji="📈">Log at least two readings to see a trend.</Empty>
          )}
        </Card>

        <Card title="Log a reading" note="Re-entering a date replaces that day's reading.">
          <form onSubmit={submit}>
            <div className="form-grid">
              <Field label="Date">
                <input
                  type="date"
                  value={form.date}
                  max={todayISO()}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </Field>
              <Field label={`Weight (${u.weight})`} error={error ?? undefined}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={form.weight}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => {
                    setForm({ ...form, weight: e.target.value });
                    // Clear as soon as they start fixing it — an error that
                    // persists while you type reads as "still wrong".
                    if (error) setError(null);
                  }}
                  required
                />
              </Field>
              <Field label="Body fat (%)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="70"
                  inputMode="decimal"
                  placeholder="optional"
                  value={form.bodyFat}
                  onChange={(e) => setForm({ ...form, bodyFat: e.target.value })}
                />
              </Field>
              <Field label={`Waist (${u.length})`}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  placeholder="optional"
                  value={form.waist}
                  onChange={(e) => setForm({ ...form, waist: e.target.value })}
                />
              </Field>
              <Field label={`Chest (${u.length})`}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  placeholder="optional"
                  value={form.chest}
                  onChange={(e) => setForm({ ...form, chest: e.target.value })}
                />
              </Field>
              <Field label={`Hips (${u.length})`}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  placeholder="optional"
                  value={form.hip}
                  onChange={(e) => setForm({ ...form, hip: e.target.value })}
                />
              </Field>
              <button className="btn btn-primary" type="submit">
                Save reading
              </button>
            </div>
          </form>
        </Card>

        <Card title="History" note={`${data.weights.length} readings`}>
          {data.weights.length === 0 ? (
            <Empty emoji="⚖️">Nothing logged yet — add your first reading above.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Weight ({u.weight})</th>
                    <th className="num">Body fat</th>
                    <th className="num">Waist ({u.length})</th>
                    <th className="num">Chest ({u.length})</th>
                    <th className="num">Hips ({u.length})</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {sortByDateDesc(data.weights)
                    .slice(0, 60)
                    .map((w) => (
                      <tr key={w.id}>
                        <td className="cell-main">{relativeLabel(w.date)}</td>
                        <td className="num">{showWeight(w.weightKg)}</td>
                        <td className="num">{w.bodyFatPct != null ? `${w.bodyFatPct}%` : '—'}</td>
                        <td className="num">{w.waistCm != null ? showLength(w.waistCm) : '—'}</td>
                        <td className="num">{w.chestCm != null ? showLength(w.chestCm) : '—'}</td>
                        <td className="num">{w.hipCm != null ? showLength(w.hipCm) : '—'}</td>
                        <td className="num">
                          <button
                            type="button"
                            className="btn btn-icon"
                            aria-label={`Delete reading from ${w.date}`}
                            onClick={() =>
                              update('weights', (current) => current.filter((x) => x.id !== w.id))
                            }
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
