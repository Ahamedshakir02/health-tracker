import { useMemo, useState, type FormEvent } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Card, Empty, Field, Segmented, StatTile } from '../components/ui';
import SessionHistory from '../components/SessionHistory';
import { DailyBars, SERIES } from '../components/charts';
import { dailySeries, dayLog, sortByDateDesc, uid, workoutsInLastDays } from '../lib/calc';
import { relativeLabel, todayISO } from '../lib/dates';
import { labels, round, toCanonical, toDisplay } from '../lib/units';
import type { DayLog, Intensity, WorkoutEntry } from '../types';

const TYPES = [
  'Run',
  'Walk',
  'Cycling',
  'Strength',
  'Swim',
  'Yoga',
  'HIIT',
  'Rowing',
  'Sport',
  'Other',
];

const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: 'low', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'Hard' },
];

const RANGES = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
];

const blankForm = () => ({
  date: todayISO(),
  type: 'Run',
  minutes: '',
  intensity: 'moderate' as Intensity,
  caloriesBurned: '',
  distance: '',
  note: '',
});

export default function Movement() {
  const { data, update } = useHealth();
  const units = data.settings.units;
  const goals = data.settings.goals;
  const u = labels(units);
  const [range, setRange] = useState(14);
  const [form, setForm] = useState(blankForm);
  const [steps, setSteps] = useState('');
  // Two independent forms on this page, so two independent error slots.
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const series = useMemo(() => dailySeries(data, range), [data, range]);
  const week = workoutsInLastDays(data.workouts, 7);
  const weekMinutes = week.reduce((s, w) => s + (w.minutes || 0), 0);
  const weekBurn = week.reduce((s, w) => s + (w.caloriesBurned || 0), 0);
  const todaySteps = dayLog(data.days, todayISO()).steps;

  function submit(event: FormEvent) {
    event.preventDefault();
    const minutes = Number(form.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setWorkoutError('Enter how many minutes you trained.');
      return;
    }
    setWorkoutError(null);

    const entry: WorkoutEntry = {
      id: uid('k'),
      date: form.date,
      type: form.type,
      minutes,
      intensity: form.intensity,
    };
    if (form.caloriesBurned) entry.caloriesBurned = Number(form.caloriesBurned);
    if (form.distance) entry.distanceKm = toCanonical('distance', Number(form.distance), units);
    if (form.note.trim()) entry.note = form.note.trim();

    update('workouts', (current) => [...current, entry]);
    setForm({ ...blankForm(), date: form.date, type: form.type, intensity: form.intensity });
  }

  function saveSteps(event: FormEvent) {
    event.preventDefault();
    const value = Number(steps);
    if (!Number.isFinite(value) || value < 0) {
      setStepsError('Enter a step count of zero or more.');
      return;
    }
    setStepsError(null);
    const date = todayISO();
    update('days', (current) => {
      const existing = current.find((d) => d.date === date);
      const next: DayLog = { ...(existing ?? { date, habits: {} }), steps: value };
      return [...current.filter((d) => d.date !== date), next];
    });
    setSteps('');
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Movement</h1>
          <p className="page-sub">Workouts, active minutes and daily steps.</p>
        </div>
        <Segmented options={RANGES} value={range} onChange={setRange} ariaLabel="Chart range" />
      </header>

      <div className="stack">
        <div className="grid grid-stats">
          <StatTile
            label="Workouts this week"
            color={SERIES.activity}
            value={String(week.length)}
            unit={`/ ${goals.workoutsPerWeek}`}
            progress={goals.workoutsPerWeek ? week.length / goals.workoutsPerWeek : null}
            foot="Rolling 7 days"
          />
          <StatTile
            label="Active minutes"
            value={String(weekMinutes)}
            unit="min"
            foot="Last 7 days"
          />
          <StatTile
            label="Calories burned"
            value={weekBurn ? String(Math.round(weekBurn)) : '—'}
            unit={weekBurn ? 'kcal' : undefined}
            foot="Last 7 days, where logged"
          />
          <StatTile
            label="Steps today"
            value={todaySteps != null ? todaySteps.toLocaleString() : '—'}
            unit={goals.steps ? `/ ${goals.steps.toLocaleString()}` : undefined}
            progress={todaySteps != null && goals.steps ? todaySteps / goals.steps : null}
          />
        </div>

        <Card title="Log a workout">
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
              <Field label="Type">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Minutes" error={workoutError ?? undefined}>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  placeholder="45"
                  value={form.minutes}
                  aria-invalid={workoutError ? true : undefined}
                  onChange={(e) => {
                    setForm({ ...form, minutes: e.target.value });
                    if (workoutError) setWorkoutError(null);
                  }}
                  required
                />
              </Field>
              <Field label="Intensity">
                <select
                  value={form.intensity}
                  onChange={(e) => setForm({ ...form, intensity: e.target.value as Intensity })}
                >
                  {INTENSITIES.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Distance (${u.distance})`}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="optional"
                  value={form.distance}
                  onChange={(e) => setForm({ ...form, distance: e.target.value })}
                />
              </Field>
              <Field label="Calories burned">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="optional"
                  value={form.caloriesBurned}
                  onChange={(e) => setForm({ ...form, caloriesBurned: e.target.value })}
                />
              </Field>
              <button className="btn btn-primary" type="submit">
                Save workout
              </button>
            </div>
          </form>

          <hr className="divider" style={{ margin: '16px 0 12px' }} />

          <form onSubmit={saveSteps} className="row">
            <Field label="Steps today" error={stepsError ?? undefined}>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder={todaySteps != null ? String(todaySteps) : '8000'}
                value={steps}
                aria-invalid={stepsError ? true : undefined}
                onChange={(e) => {
                  setSteps(e.target.value);
                  if (stepsError) setStepsError(null);
                }}
                style={{ width: 140 }}
              />
            </Field>
            <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
              Save steps
            </button>
          </form>
        </Card>

        <div className="grid grid-2">
          <Card title="Active minutes" note="Total workout minutes per day">
            <DailyBars
              data={series.map((d) => ({ date: d.date, value: d.activeMinutes }))}
              color={SERIES.activity}
              label="Active minutes"
              format={(v) => `${Math.round(v)} min`}
            />
          </Card>
          <Card title="Steps" note="Against your daily target">
            <DailyBars
              data={series.map((d) => ({ date: d.date, value: d.steps ?? 0 }))}
              color={SERIES.activity}
              target={goals.steps}
              label="Steps"
              format={(v) => Math.round(v).toLocaleString()}
            />
          </Card>
        </div>

        {/* Sessions come from the Trainer and carry the sets themselves. The
            workout table below records that you trained; this records what
            you actually did. */}
        <Card
          title="Training sessions"
          note={
            data.sessions.length
              ? `${data.sessions.length} logged from the Trainer`
              : 'Finish a day in the Trainer to log one'
          }
        >
          {data.sessions.length === 0 ? (
            <Empty emoji="🏋️">
              Nothing logged yet. Tick your sets in the Trainer and press Finish day.
            </Empty>
          ) : (
            <SessionHistory
              sessions={data.sessions}
              unitLabel={u.weight}
              convert={(kg) => round(toDisplay('weight', kg, units), 1)}
              onDelete={(s) => {
                // The paired workout row goes with it, or the dashboard keeps
                // counting a session that no longer exists.
                update('sessions', (current) => current.filter((x) => x.id !== s.id));
                if (s.workoutId) {
                  update('workouts', (current) => current.filter((w) => w.id !== s.workoutId));
                }
              }}
            />
          )}
        </Card>

        <Card title="Workout history" note={`${data.workouts.length} sessions`}>
          {data.workouts.length === 0 ? (
            <Empty emoji="🏃">No workouts logged yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th className="num">Minutes</th>
                    <th>Intensity</th>
                    <th className="num">Distance ({u.distance})</th>
                    <th className="num">Kcal</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {sortByDateDesc(data.workouts)
                    .slice(0, 60)
                    .map((w) => (
                      <tr key={w.id}>
                        <td className="cell-main">{relativeLabel(w.date)}</td>
                        <td>{w.type}</td>
                        <td className="num">{w.minutes}</td>
                        <td>{INTENSITIES.find((i) => i.value === w.intensity)?.label}</td>
                        <td className="num">
                          {w.distanceKm != null
                            ? round(toDisplay('distance', w.distanceKm, units), 2)
                            : '—'}
                        </td>
                        <td className="num">{w.caloriesBurned ?? '—'}</td>
                        <td className="num">
                          <button
                            type="button"
                            className="btn btn-icon"
                            aria-label={`Delete ${w.type} on ${w.date}`}
                            onClick={() =>
                              update('workouts', (current) => current.filter((x) => x.id !== w.id))
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
