import { useState, type FormEvent } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Field, Segmented } from '../components/ui';
import { IconCheck, IconHeart } from '../components/icons';
import { uid } from '../lib/calc';
import { todayISO } from '../lib/dates';
import { labels, round, toCanonical, toDisplay } from '../lib/units';
import type { Goals, Sex, UnitSystem } from '../types';

/**
 * First-run questions, shown once after the first sign-in.
 *
 * Everything here writes into `settings` — the app already models exactly these
 * fields, so onboarding is a friendlier front door to the Settings screen
 * rather than a second place where profile data lives. The starting weight is
 * the one exception: it becomes a real weight entry, so the trend chart has a
 * point to start from instead of an empty state on day one.
 */

const STEPS = ['You', 'Body', 'Targets'] as const;

/** Blank rather than 0 so a cleared number field doesn't read as a real zero. */
type NumStr = string;

function num(value: NumStr): number | undefined {
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function Onboarding() {
  const { data, updateSettings, update } = useHealth();
  const [step, setStep] = useState(0);

  const [name, setName] = useState(data.settings.name ?? '');
  const [units, setUnits] = useState<UnitSystem>(data.settings.units);
  const [height, setHeight] = useState<NumStr>('');
  const [birthYear, setBirthYear] = useState<NumStr>('');
  const [sex, setSex] = useState<Sex | undefined>(data.settings.sex);
  const [weight, setWeight] = useState<NumStr>('');
  const [goalWeight, setGoalWeight] = useState<NumStr>('');

  const d = data.settings.goals;
  const [calories, setCalories] = useState<NumStr>(String(d.calories));
  const [proteinG, setProteinG] = useState<NumStr>(String(d.proteinG));
  const [sleepHours, setSleepHours] = useState<NumStr>(String(d.sleepHours));
  const [steps, setSteps] = useState<NumStr>(String(d.steps));
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState<NumStr>(String(d.workoutsPerWeek));

  const u = labels(units);
  const showWater = round(toDisplay('volume', d.waterMl, units), 0);
  const [water, setWater] = useState<NumStr>(String(showWater));

  const finish = (skipped: boolean) => {
    if (skipped) {
      updateSettings({ onboardedAt: new Date().toISOString() });
      return;
    }

    const heightCm = num(height) != null ? toCanonical('length', num(height)!, units) : undefined;
    const weightKg = num(weight) != null ? toCanonical('weight', num(weight)!, units) : undefined;
    const goalKg =
      num(goalWeight) != null ? toCanonical('weight', num(goalWeight)!, units) : undefined;
    const waterMl = num(water) != null ? toCanonical('volume', num(water)!, units) : d.waterMl;

    const goals: Goals = {
      ...d,
      weightKg: goalKg,
      calories: num(calories) ?? d.calories,
      proteinG: num(proteinG) ?? d.proteinG,
      waterMl,
      sleepHours: num(sleepHours) ?? d.sleepHours,
      steps: num(steps) ?? d.steps,
      workoutsPerWeek: num(workoutsPerWeek) ?? d.workoutsPerWeek,
    };

    updateSettings({
      name: name.trim(),
      units,
      heightCm,
      birthYear: num(birthYear),
      sex,
      goals,
      onboardedAt: new Date().toISOString(),
    });

    // A starting weight is worth turning into a real reading — it gives the
    // trend chart a first point instead of an empty state.
    if (weightKg != null) {
      const today = todayISO();
      update('weights', (rows) => [
        ...rows.filter((w) => w.date !== today),
        { id: uid('w'), date: today, weightKg },
      ]);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish(false);
  };

  return (
    <div className="auth">
      <main className="auth-card onboard-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            <IconHeart />
          </span>
          <div className="brand-text">
            <span className="brand-name">Vitals</span>
            <span className="brand-sub">Health Tracker</span>
          </div>
        </div>

        <div>
          <h1 className="auth-title">
            {step === 0 ? 'Welcome' : step === 1 ? 'About you' : 'Your daily targets'}
          </h1>
          <p className="auth-sub">
            {step === 0
              ? 'A few questions so the numbers mean something. You can change any of it later in Settings.'
              : step === 1
                ? 'Used for BMI, unit conversion and your weight trend. All optional.'
                : 'These drive every progress meter and target line in the app.'}
          </p>
        </div>

        <ol className="onboard-steps" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`onboard-step${i === step ? ' is-current' : ''}${i < step ? ' is-done' : ''}`}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="onboard-dot" aria-hidden="true">
                {i < step ? <IconCheck /> : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        <form className="auth-form" onSubmit={onSubmit}>
          {step === 0 && (
            <>
              <Field label="What should we call you?" hint="Shown as a greeting on the Today screen.">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                  autoFocus
                />
              </Field>
              <Field label="Units">
                <Segmented
                  ariaLabel="Units"
                  value={units}
                  onChange={setUnits}
                  options={[
                    { value: 'metric', label: 'Metric (kg, cm)' },
                    { value: 'imperial', label: 'Imperial (lb, in)' },
                  ]}
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label={`Height (${u.length})`} hint="Used for BMI.">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Optional"
                  autoFocus
                />
              </Field>
              <Field label="Birth year">
                <input
                  type="number"
                  inputMode="numeric"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field
                label="Sex"
                hint="Only used for the resting-calorie estimate, which is 166 kcal different either way."
              >
                <Segmented
                  ariaLabel="Sex"
                  value={sex ?? ''}
                  onChange={(value: string) => setSex(value === '' ? undefined : (value as Sex))}
                  options={[
                    { value: '', label: 'Prefer not to say' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                  ]}
                />
              </Field>
              <Field
                label={`Current weight (${u.weight})`}
                hint="Logged as today's reading so your trend starts here."
              >
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label={`Goal weight (${u.weight})`}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={goalWeight}
                  onChange={(e) => setGoalWeight(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <div className="form-grid">
              <Field label="Calories (kcal)">
                <input
                  type="number"
                  inputMode="numeric"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Protein (g)">
                <input
                  type="number"
                  inputMode="numeric"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                />
              </Field>
              <Field label={`Water (${u.volume})`}>
                <input
                  type="number"
                  inputMode="numeric"
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                />
              </Field>
              <Field label="Sleep (hours)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                />
              </Field>
              <Field label="Steps">
                <input
                  type="number"
                  inputMode="numeric"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                />
              </Field>
              <Field label="Workouts per week">
                <input
                  type="number"
                  inputMode="numeric"
                  value={workoutsPerWeek}
                  onChange={(e) => setWorkoutsPerWeek(e.target.value)}
                />
              </Field>
            </div>
          )}

          <div className="onboard-actions">
            {step > 0 && (
              <button type="button" className="btn" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button type="submit" className="btn btn-primary auth-wide">
              {step < STEPS.length - 1 ? 'Continue' : 'Start tracking'}
            </button>
          </div>
        </form>

        <p className="auth-foot">
          <button type="button" className="link" onClick={() => finish(true)}>
            Skip for now
          </button>
        </p>
      </main>
    </div>
  );
}
