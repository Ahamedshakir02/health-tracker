import { useMemo, useState } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Card, Empty, Field, Rating, StatTile, meterPercent } from '../components/ui';
import { IconCheck, IconFlame } from '../components/icons';
import { DailyBars, SERIES, SleepArea } from '../components/charts';
import { dailySeries, dayLog, habitStreak, meanOf } from '../lib/calc';
import { formatShort, lastNDays, relativeLabel, todayISO } from '../lib/dates';
import { labels, round, toDisplay } from '../lib/units';
import type { DayLog } from '../types';

const GLASS_ML = 250;
const MOOD_FACES = ['😞', '🙁', '😐', '🙂', '😄'];
const SLEEP_FACES = ['😵', '😪', '😐', '😌', '🤩'];

export default function Daily() {
  const { data, update } = useHealth();
  const units = data.settings.units;
  const goals = data.settings.goals;
  const u = labels(units);
  const [date, setDate] = useState(todayISO());

  const log = dayLog(data.days, date);
  const series = useMemo(() => dailySeries(data, 14), [data]);
  const activeHabits = data.settings.habits.filter((h) => !h.archived);
  const gridDays = lastNDays(14);

  function patchDay(patch: Partial<DayLog>) {
    update('days', (current) => {
      const existing = current.find((d) => d.date === date);
      const next: DayLog = { ...(existing ?? { date, habits: {} }), ...patch, date };
      return [...current.filter((d) => d.date !== date), next];
    });
  }

  function toggleHabit(habitId: string) {
    patchDay({ habits: { ...log.habits, [habitId]: !log.habits[habitId] } });
  }

  function addWater(ml: number) {
    patchDay({ waterMl: Math.max(0, (log.waterMl ?? 0) + ml) });
  }

  const showVolume = (ml: number) => round(toDisplay('volume', ml, units), 0);
  const avgSleep = meanOf(series, (d) => d.sleepHours);
  const avgWater = meanOf(series, (d) => d.waterMl);
  // Guarded rather than inlined: a water goal of 0 makes this Infinity.
  const waterPercent = meterPercent(goals.waterMl ? (log.waterMl ?? 0) / goals.waterMl : null);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Daily check-in</h1>
          <p className="page-sub">Sleep, water, mood and habits for {relativeLabel(date)}.</p>
        </div>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Check-in date"
          style={{ width: 'auto' }}
        />
      </header>

      <div className="stack">
        <div className="grid grid-stats">
          <StatTile
            label="Sleep"
            color={SERIES.sleep}
            value={log.sleepHours != null ? log.sleepHours.toFixed(1) : '—'}
            unit={log.sleepHours != null ? `/ ${goals.sleepHours} h` : undefined}
            progress={log.sleepHours != null ? log.sleepHours / goals.sleepHours : null}
            foot={avgSleep != null ? `${avgSleep.toFixed(1)} h avg over 14 days` : 'No history yet'}
          />
          <StatTile
            label="Water"
            color={SERIES.weight}
            value={String(showVolume(log.waterMl ?? 0))}
            unit={`/ ${showVolume(goals.waterMl)} ${u.volume}`}
            progress={goals.waterMl ? (log.waterMl ?? 0) / goals.waterMl : null}
            foot={
              avgWater != null
                ? `${showVolume(avgWater)} ${u.volume} avg over 14 days`
                : 'No history yet'
            }
          />
          <StatTile
            label="Mood"
            value={log.mood ? MOOD_FACES[log.mood - 1] : '—'}
            foot={log.mood ? `${log.mood} of 5` : 'Not recorded'}
          />
          <StatTile
            label="Habits done"
            color={SERIES.activity}
            value={`${activeHabits.filter((h) => log.habits[h.id]).length}`}
            unit={`/ ${activeHabits.length}`}
            progress={
              activeHabits.length
                ? activeHabits.filter((h) => log.habits[h.id]).length / activeHabits.length
                : null
            }
          />
        </div>

        <div className="grid grid-2">
          <Card title="Sleep & mood">
            <div className="stack">
              <div className="form-grid">
                <Field label="Hours slept">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="24"
                    inputMode="decimal"
                    placeholder="7.5"
                    value={log.sleepHours ?? ''}
                    onChange={(e) =>
                      patchDay({
                        sleepHours: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Resting heart rate">
                  <input
                    type="number"
                    min="0"
                    max="220"
                    inputMode="numeric"
                    placeholder="bpm"
                    value={log.restingHr ?? ''}
                    onChange={(e) =>
                      patchDay({
                        restingHr: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>

              <div className="field">
                <span className="label">Sleep quality</span>
                <Rating
                  faces={SLEEP_FACES}
                  value={log.sleepQuality}
                  ariaLabel="Sleep quality"
                  onChange={(v) => patchDay({ sleepQuality: v as DayLog['sleepQuality'] })}
                />
              </div>

              <div className="field">
                <span className="label">Mood</span>
                <Rating
                  faces={MOOD_FACES}
                  value={log.mood}
                  ariaLabel="Mood"
                  onChange={(v) => patchDay({ mood: v as DayLog['mood'] })}
                />
              </div>

              <Field label="Note">
                <textarea
                  rows={2}
                  placeholder="Anything worth remembering about today?"
                  value={log.note ?? ''}
                  onChange={(e) => patchDay({ note: e.target.value || undefined })}
                />
              </Field>

              <div>
                <SleepArea
                  data={series.map((d) => ({ date: d.date, value: d.sleepHours }))}
                  target={goals.sleepHours}
                  height={150}
                />
                <p className="hint">Sleep over the last 14 days.</p>
              </div>
            </div>
          </Card>

          <Card title="Water" note={`Target ${showVolume(goals.waterMl)} ${u.volume} a day`}>
            <div className="stack">
              <div>
                <div className="stat-value" style={{ marginBottom: 10 }}>
                  {showVolume(log.waterMl ?? 0)}
                  <span className="stat-unit">{u.volume}</span>
                </div>
                <div
                  className="meter-track"
                  role="progressbar"
                  aria-valuenow={waterPercent ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Water progress"
                >
                  <div
                    className="meter-fill"
                    style={{
                      width: `${waterPercent ?? 0}%`,
                      background: SERIES.weight,
                    }}
                  />
                </div>
              </div>
              <div className="row">
                {/* Stepper counts glasses; the millilitre total stays the stored
                    value so a changed glass size never rewrites history. */}
                <div className="stepper">
                  <button
                    type="button"
                    onClick={() => addWater(-GLASS_ML)}
                    disabled={!log.waterMl}
                    aria-label={`Remove one glass (${showVolume(GLASS_ML)} ${u.volume})`}
                  >
                    −
                  </button>
                  <span className="num" aria-live="polite">
                    {Math.round((log.waterMl ?? 0) / GLASS_ML)}
                    <span className="hint" style={{ marginLeft: 4 }}>
                      glasses
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => addWater(GLASS_ML)}
                    aria-label={`Add one glass (${showVolume(GLASS_ML)} ${u.volume})`}
                  >
                    +
                  </button>
                </div>
                <button type="button" className="btn" onClick={() => addWater(GLASS_ML * 2)}>
                  + Bottle ({showVolume(GLASS_ML * 2)} {u.volume})
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => patchDay({ waterMl: 0 })}
                  disabled={!log.waterMl}
                >
                  Reset
                </button>
              </div>
              <div>
                <DailyBars
                  data={series.map((d) => ({ date: d.date, value: d.waterMl ?? 0 }))}
                  color={SERIES.weight}
                  target={goals.waterMl}
                  label="Water"
                  format={(v) => `${showVolume(v)} ${u.volume}`}
                  height={150}
                />
                <p className="hint">Water over the last 14 days.</p>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Habits" note="Tap to mark done — streaks count consecutive days.">
          {activeHabits.length === 0 ? (
            <Empty emoji="✅">Add habits in Settings to start tracking them.</Empty>
          ) : (
            <div className="stack">
              <div className="row">
                {activeHabits.map((habit) => {
                  const streak = habitStreak(data.days, habit.id);
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      className="habit-chip"
                      aria-pressed={Boolean(log.habits[habit.id])}
                      onClick={() => toggleHabit(habit.id)}
                    >
                      {/* The box is always drawn; CSS fills it in on the pressed
                          state so the chip's shape does not jump on toggle. */}
                      <span className="habit-check" aria-hidden="true">
                        <IconCheck />
                      </span>
                      <span aria-hidden="true">{habit.emoji}</span>
                      {habit.name}
                      {streak > 0 && (
                        <span className="habit-streak">
                          <IconFlame />
                          {streak}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Habit</th>
                      {gridDays.map((d) => (
                        <th key={d} className="num" style={{ fontSize: 10 }}>
                          {formatShort(d).replace(/\s/, ' ')}
                        </th>
                      ))}
                      <th className="num">Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeHabits.map((habit) => (
                      <tr key={habit.id}>
                        <td className="cell-main">
                          <span aria-hidden="true">{habit.emoji}</span> {habit.name}
                        </td>
                        {gridDays.map((d) => {
                          const done = Boolean(dayLog(data.days, d).habits[habit.id]);
                          return (
                            <td key={d} className="num">
                              <span
                                title={`${habit.name} — ${formatShort(d)}: ${done ? 'done' : 'not done'}`}
                                style={{
                                  display: 'inline-block',
                                  width: 16,
                                  height: 16,
                                  borderRadius: 4,
                                  background: done ? 'var(--good)' : 'var(--surface-2)',
                                  border: '1px solid var(--border)',
                                }}
                              />
                              <span className="sr-only">{done ? 'done' : 'not done'}</span>
                            </td>
                          );
                        })}
                        <td className="num">
                          <strong>{habitStreak(data.days, habit.id)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
