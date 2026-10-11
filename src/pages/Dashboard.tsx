import { useMemo, type ReactNode } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Avatar, Card, Empty, firstName, meterPercent } from '../components/ui';
import { IconArrowDown, IconArrowUp, IconCheck, IconPlus } from '../components/icons';
import { DailyBars, SERIES, WeightChart } from '../components/charts';
import { TRAINING_PLAN } from '../data/trainingPlan';
import {
  byDate,
  dailySeries,
  dayLog,
  latestWeight,
  meanOf,
  rollingMean,
  sumMacros,
  weightChange,
  workoutsInLastDays,
} from '../lib/calc';
import { addDays, formatLong, formatWeekday, lastNDays, parseISO, todayISO } from '../lib/dates';
import { nextDay } from '../lib/programme';
import { labels, round, toDisplay } from '../lib/units';
import type { DayLog } from '../types';

/** One glass. The same size the Check-in page counts in. */
const GLASS_ML = 250;

type Section = 'trainer' | 'body' | 'food' | 'movement' | 'daily' | 'settings';

/**
 * One line of the day: what it is, where it stands against its target, and the
 * single action that moves it. `progress` is null when there is no target to
 * measure against, which draws an empty track rather than a misleading full one.
 */
interface LedgerRow {
  id: string;
  label: string;
  value: ReactNode;
  unit?: string;
  progress: number | null;
  color: string;
  action: string;
  onAction: () => void;
}

export default function Dashboard({ onNavigate }: { onNavigate: (id: Section) => void }) {
  const { data, user, update } = useHealth();
  const { units, goals, name, heightCm, programme } = data.settings;
  const u = labels(units);
  const today = todayISO();
  const accountName = name.trim() || user?.email || 'You';

  const series = useMemo(() => dailySeries(data, 30), [data]);
  const last7 = series.slice(-7);

  const todayMacros = sumMacros(data.meals.filter(byDate(today)));
  const log = dayLog(data.days, today);
  const latest = latestWeight(data.weights);
  const week = weightChange(data.weights, 7);
  const weekWorkouts = workoutsInLastDays(data.workouts, 7);
  const activeHabits = data.settings.habits.filter((h) => !h.archived);
  const habitsDone = activeHabits.filter((h) => log.habits[h.id]).length;
  const stepsToday = series[series.length - 1]?.steps ?? null;

  const weightPoints = useMemo(() => {
    const since = addDays(today, -89);
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
  }, [data.weights, today]);

  const avgCalories = meanOf(
    last7.filter((d) => d.calories > 0),
    (d) => d.calories,
  );
  const hasAnything =
    data.weights.length || data.meals.length || data.workouts.length || data.days.length;

  // The week strip. Seven days ending today, each carrying a dot that says
  // what kind of day it was: a training day, a day that got logged, or a day
  // with nothing in it. It reads as a row rather than as seven controls
  // because there is no per-day view to send anyone to — the strip is there to
  // show the shape of the week, not to navigate it.
  const workoutDates = useMemo(
    () => new Set(data.workouts.map((w) => w.date)),
    [data.workouts],
  );
  const weekStrip = useMemo(
    () =>
      lastNDays(7, today).map((date) => {
        const d = series.find((row) => row.date === date);
        const logged = Boolean(
          d && (d.calories || d.weightKg != null || d.activeMinutes || d.sleepHours != null),
        );
        return {
          date,
          weekday: formatWeekday(date).slice(0, 3),
          dayOfMonth: parseISO(date).getDate(),
          trained: workoutDates.has(date),
          logged,
          isToday: date === today,
        };
      }),
    [series, today, workoutDates],
  );

  // What the Trainer would open on. Derived the same way it derives it, so the
  // plate here and the page behind its button can never disagree.
  const schedule = programme && TRAINING_PLAN.find((s) => s.id === programme.scheduleId);
  const upNext = schedule
    ? schedule.days.find((d) => d.n === nextDay(schedule, data.sessions, programme))
    : undefined;
  const trainedToday = workoutDates.has(today);

  const showWeight = (kg: number) => toDisplay('weight', kg, units).toFixed(1);
  const showVolume = (ml: number) => round(toDisplay('volume', ml, units), 0);

  // A glass of water is the one thing worth logging without leaving the page:
  // it happens eight times a day and needs no other field.
  const addGlass = () =>
    update('days', (current) => {
      const existing = current.find((d) => d.date === today);
      const next: DayLog = {
        ...(existing ?? { date: today, habits: {} }),
        waterMl: (existing?.waterMl ?? 0) + GLASS_ML,
        date: today,
      };
      return [...current.filter((d) => d.date !== today), next];
    });

  const rows: LedgerRow[] = [
    {
      id: 'calories',
      label: 'Calories',
      value: Math.round(todayMacros.calories).toLocaleString(),
      unit: `/ ${goals.calories.toLocaleString()} kcal`,
      progress: goals.calories ? todayMacros.calories / goals.calories : null,
      color: SERIES.food,
      action: 'Add a meal',
      onAction: () => onNavigate('food'),
    },
    {
      id: 'protein',
      label: 'Protein',
      value: Math.round(todayMacros.proteinG),
      unit: `/ ${goals.proteinG} g`,
      progress: goals.proteinG ? todayMacros.proteinG / goals.proteinG : null,
      color: SERIES.food,
      action: 'Add a meal',
      onAction: () => onNavigate('food'),
    },
    {
      id: 'water',
      label: 'Water',
      value: showVolume(log.waterMl ?? 0).toLocaleString(),
      unit: `/ ${showVolume(goals.waterMl).toLocaleString()} ${u.volume}`,
      progress: goals.waterMl ? (log.waterMl ?? 0) / goals.waterMl : null,
      color: SERIES.sleep,
      action: `Add a glass (${showVolume(GLASS_ML)} ${u.volume})`,
      onAction: addGlass,
    },
    {
      id: 'sleep',
      label: 'Sleep',
      value: log.sleepHours != null ? log.sleepHours.toFixed(1) : '—',
      unit: `/ ${goals.sleepHours} h`,
      progress:
        log.sleepHours != null && goals.sleepHours ? log.sleepHours / goals.sleepHours : null,
      color: SERIES.sleep,
      action: "Log last night's sleep",
      onAction: () => onNavigate('daily'),
    },
    {
      id: 'steps',
      label: 'Steps',
      value: stepsToday != null ? stepsToday.toLocaleString() : '—',
      unit: `/ ${goals.steps.toLocaleString()}`,
      progress: stepsToday != null && goals.steps ? stepsToday / goals.steps : null,
      color: SERIES.activity,
      action: "Enter today's steps",
      onAction: () => onNavigate('movement'),
    },
    {
      id: 'habits',
      label: 'Habits',
      value: habitsDone,
      unit: `/ ${activeHabits.length}`,
      progress: activeHabits.length ? habitsDone / activeHabits.length : null,
      color: SERIES.activity,
      action: 'Tick off habits',
      onAction: () => onNavigate('daily'),
    },
    {
      id: 'weight',
      label: 'Weight',
      value: latest ? showWeight(latest.weightKg) : '—',
      unit: latest ? u.weight : undefined,
      progress: null,
      color: SERIES.weight,
      action: 'Log a weight reading',
      onAction: () => onNavigate('body'),
    },
  ];

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">{name ? `Hello, ${firstName(name)}` : 'Today'}</h1>
          <p className="page-sub">{formatLong(today)}</p>
        </div>
        {/* The rail carries the account button on a wide screen. A phone has
            no rail, so this is the way into Settings there. */}
        <button
          type="button"
          className="accountpill mobile-only"
          onClick={() => onNavigate('settings')}
          aria-label={`Signed in as ${accountName}. Open settings`}
        >
          <Avatar name={accountName} url={data.settings.avatarUrl} size={30} />
        </button>
      </header>

      {!hasAnything && (
        <div className="banner" style={{ marginBottom: 18 }}>
          <span aria-hidden="true">👋</span>
          <span>
            Nothing logged yet. Start with a weight reading or today's first meal — the charts fill
            in as you go. Set your targets and units in Settings.
          </span>
        </div>
      )}

      <div className="stack">
        <ol className="weekstrip" aria-label="This week">
          {weekStrip.map((d) => (
            <li
              key={d.date}
              className={`weekday${d.isToday ? ' is-today' : ''}`}
              aria-current={d.isToday ? 'date' : undefined}
            >
              <span className="weekday-name">{d.weekday}</span>
              <span className="weekday-num">{d.dayOfMonth}</span>
              <span
                className={`weekday-dot${d.trained ? ' trained' : d.logged ? ' logged' : ''}`}
                aria-hidden="true"
              />
              <span className="sr-only">
                {d.trained ? 'trained' : d.logged ? 'logged' : 'nothing logged'}
              </span>
            </li>
          ))}
        </ol>

        {/* The first thing Today answers is "what am I doing in the gym", so
            the plate comes before any number. One button, and it is the only
            saffron on the page. */}
        <section className="nextup" aria-label="Training">
          <div className="nextup-text">
            <p className="nextup-over">
              {trainedToday ? (
                <>
                  <IconCheck /> Trained today
                </>
              ) : schedule && upNext ? (
                `Up next · ${schedule.title} · ${upNext.reps}`
              ) : (
                `${TRAINING_PLAN.length} schedules in the book`
              )}
            </p>
            <h2 className="nextup-title">
              {schedule && upNext ? `Day ${upNext.n} — ${upNext.focus}` : 'Pick a schedule'}
            </h2>
            <p className="nextup-sub">
              {schedule
                ? `${weekWorkouts.length} of ${goals.workoutsPerWeek} sessions done this week`
                : 'Make one yours and Today lines up the next day for you.'}
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate('trainer')}>
            {!schedule ? 'Open Train' : trainedToday ? 'Open the next day' : 'Start session'}
          </button>
        </section>

        {/* Everything else about the day as one list: a name, where it stands,
            and a single button that moves it. */}
        <section className="card ledger" aria-label="The day so far">
          {rows.map((row) => {
            const pct = meterPercent(row.progress);
            return (
              <div className="ledger-row" key={row.id}>
                <span className="ledger-name">{row.label}</span>
                <span className="ledger-val">
                  {row.value}
                  {row.unit && <small> {row.unit}</small>}
                </span>
                {row.id === 'weight' ? (
                  <span className="ledger-note">
                    {week ? (
                      <>
                        <span className={`stat-delta ${week.delta > 0 ? 'up' : 'down'}`}>
                          {week.delta > 0 ? <IconArrowUp /> : <IconArrowDown />}
                          {showWeight(Math.abs(week.delta))} {u.weight}
                        </span>{' '}
                        in 7 days
                      </>
                    ) : (
                      'Log twice to see a trend'
                    )}
                  </span>
                ) : (
                  <span className="meter-track" aria-hidden="true">
                    <span
                      className="meter-fill"
                      style={{ width: `${pct ?? 0}%`, background: row.color }}
                    />
                  </span>
                )}
                <button
                  type="button"
                  className="ledger-add"
                  onClick={row.onAction}
                  aria-label={row.action}
                  title={row.action}
                >
                  <IconPlus />
                </button>
              </div>
            );
          })}
        </section>

        <div className="grid grid-2">
          <Card title="Weight trend" note="Last 90 days">
            {weightPoints.length >= 2 ? (
              <WeightChart
                data={weightPoints}
                unitLabel={u.weight}
                convert={(kg) => toDisplay('weight', kg, units)}
                goal={goals.weightKg}
              />
            ) : (
              <Empty emoji="⚖️">
                Log a couple of weight readings and the trend line appears here.
              </Empty>
            )}
          </Card>

          <Card
            title="Calories this week"
            note={avgCalories != null ? `${Math.round(avgCalories)} kcal daily average` : undefined}
          >
            <DailyBars
              data={last7.map((d) => ({ date: d.date, value: d.calories }))}
              color={SERIES.food}
              target={goals.calories}
              label="Calories"
              format={(v) => `${Math.round(v)} kcal`}
            />
          </Card>
        </div>

        <Card title="Last 7 days" note="Everything logged, side by side">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="num">Weight ({u.weight})</th>
                  <th className="num">Calories</th>
                  <th className="num">Protein (g)</th>
                  <th className="num">Active (min)</th>
                  <th className="num">Steps</th>
                  <th className="num">Sleep (h)</th>
                  <th className="num">Water ({u.volume})</th>
                </tr>
              </thead>
              <tbody>
                {[...last7].reverse().map((d) => (
                  <tr key={d.date}>
                    <td className="cell-main nowrap">{formatWeekday(d.date)}</td>
                    <td className="num">{d.weightKg != null ? showWeight(d.weightKg) : '—'}</td>
                    <td className="num">{d.calories ? Math.round(d.calories) : '—'}</td>
                    <td className="num">{d.proteinG ? Math.round(d.proteinG) : '—'}</td>
                    <td className="num">{d.activeMinutes || '—'}</td>
                    <td className="num">{d.steps != null ? d.steps.toLocaleString() : '—'}</td>
                    <td className="num">{d.sleepHours != null ? d.sleepHours.toFixed(1) : '—'}</td>
                    <td className="num">{d.waterMl != null ? showVolume(d.waterMl) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {heightCm == null && (
          <p className="hint">
            Tip: add your height in Settings to see BMI alongside your weight readings.
          </p>
        )}
      </div>
    </>
  );
}
