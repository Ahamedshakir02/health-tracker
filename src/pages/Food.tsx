import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Card, Field, Segmented, meterPercent } from '../components/ui';
import { IconPlus } from '../components/icons';
import { MyFoods } from '../components/MyFoods';
import { FoodScan } from '../components/FoodScan';
import { DailyBars, MacroStack, SERIES } from '../components/charts';
import { byDate, dailySeries, sortByDateDesc, sumMacros, uid } from '../lib/calc';
import { addDays, relativeLabel, todayISO } from '../lib/dates';
import { copyMeals, mealFromFood, upsertFood } from '../lib/foods';
import type { MealEntry, MealSlot, SavedFood } from '../types';

/**
 * The four slots, in the order a day runs. The colours are the four series
 * tokens rather than four greens: the bar at the top of the page stacks them
 * edge to edge, and neighbours have to differ in lightness in both themes.
 */
const SLOTS: { value: MealSlot; label: string; color: string }[] = [
  { value: 'breakfast', label: 'Breakfast', color: 'var(--s-weight)' },
  { value: 'lunch', label: 'Lunch', color: 'var(--s-activity)' },
  { value: 'dinner', label: 'Dinner', color: 'var(--s-energy)' },
  { value: 'snack', label: 'Snack', color: 'var(--s-sleep)' },
];

const RANGES = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
];

const blankForm = (slot: MealSlot = 'breakfast') => ({
  name: '',
  slot,
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fiberG: '',
});

export default function Food() {
  const { data, update, updateSettings, firebaseAvailable } = useHealth();
  const goals = data.settings.goals;
  const [date, setDate] = useState(todayISO());
  const [range, setRange] = useState(14);
  const [form, setForm] = useState(() => blankForm());
  const [error, setError] = useState<string | null>(null);
  const [saveFood, setSaveFood] = useState(false);
  const foods = data.settings.foods ?? [];
  const yesterday = addDays(date, -1);
  const nameInput = useRef<HTMLInputElement>(null);

  const dayMeals = data.meals.filter(byDate(date));
  const totals = sumMacros(dayMeals);
  const series = useMemo(() => dailySeries(data, range), [data, range]);

  /** Most-used distinct foods, newest first — one click to log again. */
  const recent = useMemo(() => {
    const seen = new Map<string, MealEntry>();
    for (const meal of sortByDateDesc(data.meals)) {
      const key = meal.name.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, meal);
      if (seen.size >= 8) break;
    }
    return [...seen.values()];
  }, [data.meals]);

  function addMeal(entry: Omit<MealEntry, 'id' | 'date'>) {
    const meal: MealEntry = { ...entry, id: uid('m'), date };
    update('meals', (current) => [...current, meal]);
  }

  function logFood(food: SavedFood, portion: number) {
    addMeal(mealFromFood(food, portion, form.slot));
  }

  /** Yesterday's meals onto the day on screen: one slot, or the whole day. */
  function copyYesterday(slot?: MealSlot) {
    const copies = copyMeals(data.meals, yesterday, date, () => uid('m'), slot);
    if (copies.length) update('meals', (current) => [...current, ...copies]);
  }
  const hasYesterday = (slot?: MealSlot) =>
    data.meals.some((m) => m.date === yesterday && (slot === undefined || m.slot === slot));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Give the meal a name so you can recognise it later.');
      return;
    }
    setError(null);
    addMeal({
      name: form.name.trim(),
      slot: form.slot,
      calories: Number(form.calories) || 0,
      proteinG: Number(form.proteinG) || 0,
      carbsG: Number(form.carbsG) || 0,
      fatG: Number(form.fatG) || 0,
      ...(Number(form.fiberG) > 0 ? { fiberG: Number(form.fiberG) } : {}),
    });
    if (saveFood) {
      updateSettings({
        foods: upsertFood(foods, {
          id: uid('f'),
          name: form.name.trim(),
          calories: Number(form.calories) || 0,
          proteinG: Number(form.proteinG) || 0,
          carbsG: Number(form.carbsG) || 0,
          fatG: Number(form.fatG) || 0,
          ...(Number(form.fiberG) > 0 ? { fiberG: Number(form.fiberG) } : {}),
        }),
      });
    }
    setForm(blankForm(form.slot));
  }

  const remaining = goals.calories - totals.calories;
  const bySlot = SLOTS.map((slot) => {
    const meals = dayMeals.filter((m) => m.slot === slot.value);
    return { ...slot, meals, calories: sumMacros(meals).calories };
  });
  // The bar is measured against the target until the day goes over it, and
  // against the day itself after that — so it fills, then stays full.
  const barScale = Math.max(goals.calories, totals.calories, 1);
  const share = (grams: number, kcalPerGram: number) =>
    Math.round((grams * kcalPerGram * 100) / Math.max(totals.calories, 1));
  const proteinPct = meterPercent(goals.proteinG ? totals.proteinG / goals.proteinG : null);
  const carbsPct = meterPercent(goals.carbsG ? totals.carbsG / goals.carbsG : null);
  const fatPct = meterPercent(goals.fatG ? totals.fatG / goals.fatG : null);

  /** The "+" on a meal: aim the form at that slot and put the cursor in it. */
  function startAdd(slot: MealSlot) {
    setForm((current) => ({ ...current, slot }));
    nameInput.current?.focus();
    nameInput.current?.scrollIntoView({ block: 'center' });
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Food</h1>
          <p className="page-sub">Meals, calories and macros for {relativeLabel(date)}.</p>
        </div>
        <div className="row">
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Log date"
            style={{ width: 'auto' }}
          />
        </div>
      </header>

      <div className="stack">
        {/* The page's one question is "how much is left", so that is the one
            large number. The bar under it shows where the rest went. */}
        <section className="card budget" aria-label="Calories and macros">
          <div className="budget-main">
            <p className="budget-figure">
              <strong>
                {Math.round(goals.calories ? Math.abs(remaining) : totals.calories).toLocaleString()}
              </strong>{' '}
              {goals.calories
                ? `kcal ${remaining >= 0 ? 'left' : 'over'} of ${goals.calories.toLocaleString()}`
                : 'kcal eaten'}
            </p>
            <div
              className="budget-bar"
              role="img"
              aria-label={`${Math.round(totals.calories)} kcal eaten: ${bySlot
                .map((s) => `${s.label.toLowerCase()} ${Math.round(s.calories)}`)
                .join(', ')}`}
            >
              {bySlot
                .filter((s) => s.calories > 0)
                .map((s) => (
                  <span
                    key={s.value}
                    style={{ width: `${(s.calories / barScale) * 100}%`, background: s.color }}
                  />
                ))}
            </div>
            <ul className="budget-legend">
              {bySlot.map((s) => (
                <li key={s.value}>
                  <span className="dot" style={{ background: s.color }} aria-hidden="true" />
                  {s.label} {s.meals.length ? Math.round(s.calories) : '—'}
                </li>
              ))}
            </ul>
          </div>
          <dl className="budget-macros">
            <div>
              <dt>Protein</dt>
              <dd>
                {Math.round(totals.proteinG)} <small>/ {goals.proteinG} g</small>
              </dd>
              <span className="meter-track" aria-hidden="true">
                <span
                  className="meter-fill"
                  style={{ width: `${proteinPct ?? 0}%`, background: 'var(--s-weight)' }}
                />
              </span>
            </div>
            <div>
              <dt>Carbs</dt>
              <dd>
                {Math.round(totals.carbsG)}{' '}
                <small>
                  {goals.carbsG ? `/ ${goals.carbsG} g` : 'g'} · {share(totals.carbsG, 4)}%
                </small>
              </dd>
              {carbsPct != null && (
                <span className="meter-track" aria-hidden="true">
                  <span
                    className="meter-fill"
                    style={{ width: `${carbsPct}%`, background: 'var(--s-activity)' }}
                  />
                </span>
              )}
            </div>
            <div>
              <dt>Fat</dt>
              <dd>
                {Math.round(totals.fatG)}{' '}
                <small>
                  {goals.fatG ? `/ ${goals.fatG} g` : 'g'} · {share(totals.fatG, 9)}%
                </small>
              </dd>
              {fatPct != null && (
                <span className="meter-track" aria-hidden="true">
                  <span
                    className="meter-fill"
                    style={{ width: `${fatPct}%`, background: 'var(--s-energy)' }}
                  />
                </span>
              )}
            </div>
            <div>
              <dt>Fiber</dt>
              <dd>
                {Math.round(totals.fiberG)} <small>g</small>
              </dd>
            </div>
          </dl>
        </section>

        {/* The day as it was eaten: four meals, each with its own total and its
            own way in. An empty slot stays on the page — "not logged" is
            information, and it is where the next "+" is. */}
        {dayMeals.length === 0 && hasYesterday() && (
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => copyYesterday()}>
              Copy everything from the day before
            </button>
          </div>
        )}

        <div className="meals">
          {bySlot.map((s) => (
            <section className="card meal" key={s.value} aria-label={s.label}>
              <header className="meal-hd">
                <h2 className="meal-name">{s.label}</h2>
                {s.meals.length > 0 || !hasYesterday(s.value) ? (
                  <span className="meal-total">
                    {s.meals.length ? `${Math.round(s.calories)} kcal` : 'Not logged'}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => copyYesterday(s.value)}
                    aria-label={`Same ${s.label.toLowerCase()} as the day before`}
                  >
                    Same as day before
                  </button>
                )}
                <button
                  type="button"
                  className="ledger-add"
                  aria-label={`Add to ${s.label.toLowerCase()}`}
                  onClick={() => startAdd(s.value)}
                >
                  <IconPlus />
                </button>
              </header>
              {s.meals.length > 0 && (
                <ul className="meal-items">
                  {s.meals.map((m) => (
                    <li key={m.id}>
                      <span className="meal-item-name">{m.name}</span>
                      <span className="meal-item-macros">
                        P {Math.round(m.proteinG)} · C {Math.round(m.carbsG)} · F{' '}
                        {Math.round(m.fatG)}
                      </span>
                      <span className="meal-item-kcal">{Math.round(m.calories)}</span>
                      <button
                        type="button"
                        className="btn btn-icon"
                        aria-label={`Delete ${m.name}`}
                        onClick={() =>
                          update('meals', (current) => current.filter((x) => x.id !== m.id))
                        }
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <FoodScan
          available={firebaseAvailable}
          slot={form.slot}
          slots={SLOTS}
          onSlotChange={(slot) => setForm((current) => ({ ...current, slot }))}
          onLog={(entries) => {
            const stamped = entries.map((e) => ({ ...e, id: uid('m'), date }));
            update('meals', (current) => [...current, ...stamped]);
          }}
        />

        <Card title="Add food" note="Macros are optional — calories alone still count.">
          <form onSubmit={submit}>
            <div className="form-grid">
              <Field label="What did you eat?" error={error ?? undefined}>
                <input
                  type="text"
                  placeholder="Greek yoghurt & berries"
                  ref={nameInput}
                  value={form.name}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (error) setError(null);
                  }}
                  required
                />
              </Field>
              <Field label="Meal">
                <select
                  value={form.slot}
                  onChange={(e) => setForm({ ...form, slot: e.target.value as MealSlot })}
                >
                  {SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Calories">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.calories}
                  onChange={(e) => setForm({ ...form, calories: e.target.value })}
                />
              </Field>
              <Field label="Protein (g)">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.proteinG}
                  onChange={(e) => setForm({ ...form, proteinG: e.target.value })}
                />
              </Field>
              <Field label="Carbs (g)">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.carbsG}
                  onChange={(e) => setForm({ ...form, carbsG: e.target.value })}
                />
              </Field>
              <Field label="Fat (g)">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.fatG}
                  onChange={(e) => setForm({ ...form, fatG: e.target.value })}
                />
              </Field>
              <Field label="Fiber (g)">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.fiberG}
                  onChange={(e) => setForm({ ...form, fiberG: e.target.value })}
                />
              </Field>
              <label className="pref">
                <input
                  type="checkbox"
                  checked={saveFood}
                  onChange={(e) => setSaveFood(e.target.checked)}
                />
                <span>Save to my foods</span>
              </label>
              <button className="btn btn-primary" type="submit">
                Add to {SLOTS.find((x) => x.value === form.slot)?.label.toLowerCase()}
              </button>
            </div>
          </form>

          <hr className="divider" style={{ margin: '16px 0 12px' }} />
          <p className="label" style={{ marginBottom: 8 }}>
            My foods
          </p>
          <MyFoods
            foods={foods}
            slotLabel={SLOTS.find((x) => x.value === form.slot)?.label ?? ''}
            onLog={logFood}
            onRemove={(id) => updateSettings({ foods: foods.filter((f) => f.id !== id) })}
          />

          {recent.length > 0 && (
            <>
              <hr className="divider" style={{ margin: '16px 0 12px' }} />
              <p className="label" style={{ marginBottom: 8 }}>
                Log again
              </p>
              <div className="row">
                {recent.map((meal) => (
                  <button
                    key={meal.id}
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      addMeal({
                        name: meal.name,
                        slot: meal.slot,
                        calories: meal.calories,
                        proteinG: meal.proteinG,
                        carbsG: meal.carbsG,
                        fatG: meal.fatG,
                        ...(meal.fiberG ? { fiberG: meal.fiberG } : {}),
                      })
                    }
                  >
                    {meal.name} · {meal.calories} kcal
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>

        <div className="grid grid-2">
          <Card
            title="Daily calories"
            note="Against your target"
            action={
              <Segmented
                options={RANGES}
                value={range}
                onChange={setRange}
                ariaLabel="Calorie chart range"
              />
            }
          >
            <DailyBars
              data={series.map((d) => ({ date: d.date, value: d.calories }))}
              color={SERIES.food}
              target={goals.calories}
              label="Calories"
              format={(v) => `${Math.round(v)} kcal`}
            />
          </Card>

          <Card title="Macro split" note="Grams per day">
            <MacroStack
              data={series.map((d) => ({
                date: d.date,
                proteinG: d.proteinG,
                carbsG: d.carbsG,
                fatG: d.fatG,
              }))}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
