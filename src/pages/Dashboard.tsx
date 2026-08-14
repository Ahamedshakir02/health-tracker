import { useMemo } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Card, Empty, StatTile } from '../components/ui';
import {
  IconArrowDown,
  IconArrowUp,
  IconDroplet,
  IconFlame,
  IconHabits,
  IconMoon,
  IconScale,
  IconTrainer,
} from '../components/icons';
import { DailyBars, SERIES, WeightChart } from '../components/charts';
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
import { addDays, formatLong, formatWeekday, todayISO } from '../lib/dates';
import { labels, round, toDisplay } from '../lib/units';

export default function Dashboard({ onNavigate }: { onNavigate: (id: 'body' | 'food' | 'movement' | 'daily') => void }) {
  const { data } = useHealth();
  const { units, goals, name, heightCm } = data.settings;
  const u = labels(units);
  const today = todayISO();

  const series = useMemo(() => dailySeries(data, 30), [data]);
  const last7 = series.slice(-7);

  const todayMacros = sumMacros(data.meals.filter(byDate(today)));
  const log = dayLog(data.days, today);
  const latest = latestWeight(data.weights);
  const week = weightChange(data.weights, 7);
  const weekWorkouts = workoutsInLastDays(data.workouts, 7);
  const activeHabits = data.settings.habits.filter((h) => !h.archived);
  const habitsDone = activeHabits.filter((h) => log.habits[h.id]).length;

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
  const avgSleep = meanOf(last7, (d) => d.sleepHours);
  const hasAnything =
    data.weights.length || data.meals.length || data.workouts.length || data.days.length;

  const showWeight = (kg: number) => toDisplay('weight', kg, units).toFixed(1);
  const showVolume = (ml: number) => round(toDisplay('volume', ml, units), 0);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">{name ? `Hello, ${name}` : 'Today'}</h1>
          <p className="page-sub">{formatLong(today)}</p>
        </div>
        <div className="row">
          {(
            [
              ['food', 'Food'],
              ['movement', 'Workout'],
              ['body', 'Weight'],
              ['daily', 'Check-in'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className="quickadd" onClick={() => onNavigate(id)}>
              <span className="plus" aria-hidden="true">
                +
              </span>
              {label}
            </button>
          ))}
        </div>
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
        <div className="grid grid-stats">
          <StatTile
            label="Weight"
            color={SERIES.weight}
            icon={<IconScale />}
            value={latest ? showWeight(latest.weightKg) : '—'}
            unit={latest ? u.weight : undefined}
            foot={
              week ? (
                <>
                  <span className={`stat-delta ${week.delta > 0 ? 'up' : 'down'}`}>
                    {week.delta > 0 ? <IconArrowUp /> : <IconArrowDown />}
                    {showWeight(Math.abs(week.delta))} {u.weight}
                  </span>{' '}
                  in 7 days
                </>
              ) : (
                'Log twice to see a trend'
              )
            }
          />
          <StatTile
            label="Calories today"
            color={SERIES.food}
            icon={<IconFlame />}
            overIsBad
            value={String(Math.round(todayMacros.calories))}
            unit={`/ ${goals.calories}`}
            progress={goals.calories ? todayMacros.calories / goals.calories : null}
            foot={`${Math.round(todayMacros.proteinG)} g protein of ${goals.proteinG} g`}
          />
          <StatTile
            label="Workouts this week"
            color={SERIES.activity}
            icon={<IconTrainer />}
            value={String(weekWorkouts.length)}
            unit={`/ ${goals.workoutsPerWeek}`}
            progress={goals.workoutsPerWeek ? weekWorkouts.length / goals.workoutsPerWeek : null}
            foot={`${weekWorkouts.reduce((s, w) => s + (w.minutes || 0), 0)} active minutes`}
          />
          <StatTile
            label="Sleep last night"
            color={SERIES.sleep}
            icon={<IconMoon />}
            value={log.sleepHours != null ? log.sleepHours.toFixed(1) : '—'}
            unit={log.sleepHours != null ? 'h' : undefined}
            progress={log.sleepHours != null ? log.sleepHours / goals.sleepHours : null}
            foot={avgSleep != null ? `${avgSleep.toFixed(1)} h avg this week` : 'Not logged'}
          />
          <StatTile
            label="Water today"
            color={SERIES.weight}
            icon={<IconDroplet />}
            value={String(showVolume(log.waterMl ?? 0))}
            unit={`/ ${showVolume(goals.waterMl)} ${u.volume}`}
            progress={goals.waterMl ? (log.waterMl ?? 0) / goals.waterMl : null}
          />
          <StatTile
            label="Habits today"
            color={SERIES.activity}
            icon={<IconHabits />}
            value={String(habitsDone)}
            unit={`/ ${activeHabits.length}`}
            progress={activeHabits.length ? habitsDone / activeHabits.length : null}
          />
        </div>

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
