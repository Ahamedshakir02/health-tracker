import { useMemo, useState, type FormEvent } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Card, Empty, Field, Segmented, StatTile } from '../components/ui';
import { DailyBars, MacroStack, SERIES } from '../components/charts';
import { byDate, dailySeries, sortByDateDesc, sumMacros, uid } from '../lib/calc';
import { relativeLabel, todayISO } from '../lib/dates';
import type { MealEntry, MealSlot } from '../types';

const SLOTS: { value: MealSlot; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
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
});

export default function Food() {
  const { data, update } = useHealth();
  const goals = data.settings.goals;
  const [date, setDate] = useState(todayISO());
  const [range, setRange] = useState(14);
  const [form, setForm] = useState(() => blankForm());

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

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    addMeal({
      name: form.name.trim(),
      slot: form.slot,
      calories: Number(form.calories) || 0,
      proteinG: Number(form.proteinG) || 0,
      carbsG: Number(form.carbsG) || 0,
      fatG: Number(form.fatG) || 0,
    });
    setForm(blankForm(form.slot));
  }

  const remaining = goals.calories - totals.calories;

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
        <div className="grid grid-stats">
          <StatTile
            label="Calories"
            color={SERIES.food}
            value={String(Math.round(totals.calories))}
            unit={`/ ${goals.calories}`}
            progress={goals.calories ? totals.calories / goals.calories : null}
            foot={
              remaining >= 0
                ? `${Math.round(remaining)} kcal left`
                : `${Math.round(-remaining)} kcal over`
            }
          />
          <StatTile
            label="Protein"
            color={SERIES.weight}
            value={String(Math.round(totals.proteinG))}
            unit={`/ ${goals.proteinG} g`}
            progress={goals.proteinG ? totals.proteinG / goals.proteinG : null}
            foot={`${Math.round((totals.proteinG * 4 * 100) / Math.max(totals.calories, 1))}% of intake`}
          />
          <StatTile
            label="Carbs"
            color={SERIES.food}
            value={String(Math.round(totals.carbsG))}
            unit="g"
            foot={`${Math.round((totals.carbsG * 4 * 100) / Math.max(totals.calories, 1))}% of intake`}
          />
          <StatTile
            label="Fat"
            color={SERIES.sleep}
            value={String(Math.round(totals.fatG))}
            unit="g"
            foot={`${Math.round((totals.fatG * 9 * 100) / Math.max(totals.calories, 1))}% of intake`}
          />
        </div>

        <Card title="Add food" note="Macros are optional — calories alone still count.">
          <form onSubmit={submit}>
            <div className="form-grid">
              <Field label="What did you eat?">
                <input
                  type="text"
                  placeholder="Greek yoghurt & berries"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              <button className="btn btn-primary" type="submit">
                Add
              </button>
            </div>
          </form>

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

        <Card title={`${relativeLabel(date)}'s meals`} note={`${dayMeals.length} entries`}>
          {dayMeals.length === 0 ? (
            <Empty emoji="🍽️">Nothing logged for this day yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Food</th>
                    <th>Meal</th>
                    <th className="num">Kcal</th>
                    <th className="num">P</th>
                    <th className="num">C</th>
                    <th className="num">F</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.flatMap((slot) =>
                    dayMeals
                      .filter((m) => m.slot === slot.value)
                      .map((m) => (
                        <tr key={m.id}>
                          <td className="cell-main">{m.name}</td>
                          <td>{slot.label}</td>
                          <td className="num">{Math.round(m.calories)}</td>
                          <td className="num">{Math.round(m.proteinG)}</td>
                          <td className="num">{Math.round(m.carbsG)}</td>
                          <td className="num">{Math.round(m.fatG)}</td>
                          <td className="num">
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
                          </td>
                        </tr>
                      )),
                  )}
                  <tr>
                    <td className="cell-main">
                      <strong>Total</strong>
                    </td>
                    <td />
                    <td className="num">
                      <strong>{Math.round(totals.calories)}</strong>
                    </td>
                    <td className="num">
                      <strong>{Math.round(totals.proteinG)}</strong>
                    </td>
                    <td className="num">
                      <strong>{Math.round(totals.carbsG)}</strong>
                    </td>
                    <td className="num">
                      <strong>{Math.round(totals.fatG)}</strong>
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
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
