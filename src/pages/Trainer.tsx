import { useMemo, useState } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Card, Empty, Pill, StatTile } from '../components/ui';
import { SERIES } from '../components/charts';
import { uid } from '../lib/calc';
import { formatWeekday, relativeLabel, todayISO } from '../lib/dates';
import { buildPlan, recentSessions, sessionToWorkout, type PlannedSession } from '../lib/trainer';
import type { WorkoutEntry } from '../types';

const PHASE_COPY = {
  build: { label: 'Build week', status: 'good' as const },
  maintain: { label: 'Steady week', status: 'good' as const },
  deload: { label: 'Deload week', status: 'warning' as const },
};

const DIRECTION_COPY = {
  lose: 'Training around a weight-loss goal',
  gain: 'Training around a weight-gain goal',
  maintain: 'Training to maintain',
};

const VERDICT_COPY = {
  push: 'Good to push',
  steady: 'Train as planned',
  hold: 'Hold back a little',
  deload: 'Back off this week',
};

export default function Trainer() {
  const { data, update } = useHealth();
  const today = todayISO();
  const plan = useMemo(() => buildPlan(data, today), [data, today]);
  const recent = useMemo(() => recentSessions(data), [data]);
  const [justLogged, setJustLogged] = useState<string | null>(null);

  const logged = new Set(data.workouts.map((w) => w.date));

  function logSession(session: PlannedSession) {
    // Log against today when the plan day has already passed or is still to
    // come — you did the work now, not on the day the plan named it.
    const date = session.date <= today ? session.date : today;
    const entry: WorkoutEntry = { ...sessionToWorkout(session, date), id: uid('k') };
    update('workouts', (current) => [...current, entry]);
    setJustLogged(session.date + session.focus);
  }

  const phase = PHASE_COPY[plan.phase];

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Trainer</h1>
          <p className="page-sub">
            A week built from what you have actually logged — {DIRECTION_COPY[plan.direction].toLowerCase()}.
          </p>
        </div>
        <Pill status={phase.status}>{phase.label}</Pill>
      </header>

      <div className="stack">
        <div className="grid grid-stats">
          <StatTile
            label="Readiness"
            color={SERIES.activity}
            value={String(plan.readiness.score)}
            unit="/ 100"
            progress={plan.readiness.score / 100}
            foot={VERDICT_COPY[plan.readiness.verdict]}
          />
          <StatTile
            label="Planned this week"
            color={SERIES.food}
            value={String(plan.plannedMinutes)}
            unit="min"
            foot={`${plan.sessions.length} session${plan.sessions.length === 1 ? '' : 's'}`}
          />
          <StatTile
            label="Your recent average"
            value={plan.baselineMinutes ? String(plan.baselineMinutes) : '—'}
            unit={plan.baselineMinutes ? 'min/wk' : undefined}
            foot="Last 4 weeks, actual"
          />
          <StatTile
            label="Protein target"
            color={SERIES.weight}
            value={String(plan.nutrition.proteinG)}
            unit="g/day"
            foot="Scaled to your bodyweight"
          />
        </div>

        <Card title="This week" note={`Week of ${formatWeekday(plan.weekStart)}`}>
          <p className="trainer-headline">{plan.headline}</p>
        </Card>

        <Card
          title="Readiness signals"
          note={
            plan.readiness.provisional
              ? 'Provisional — log sleep and resting heart rate for a sharper read.'
              : 'Drawn from your sleep, recent load and resting heart rate.'
          }
        >
          {plan.readiness.signals.length === 0 ? (
            <Empty emoji="🩺">
              Nothing to read yet. Log a few check-ins and this starts telling you when to push and
              when to back off.
            </Empty>
          ) : (
            <div className="signals">
              {plan.readiness.signals.map((signal) => (
                <div className="signal" key={signal.label}>
                  <Pill status={signal.status}>{signal.label}</Pill>
                  <span>{signal.detail}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {plan.sessions.length === 0 ? (
          <Card title="Sessions">
            <Empty emoji="🛌">
              This week is a full rest week — either your workout target is zero, or your recovery
              signals asked for it. Raise the target in Settings if that is not what you wanted.
            </Empty>
          </Card>
        ) : (
          <div className="stack">
            {plan.sessions.map((session) => {
              const key = session.date + session.focus;
              const done = logged.has(session.date);
              return (
                <Card
                  key={key}
                  title={session.title}
                  note={`${formatWeekday(session.date)} · ${session.minutes} min · ${session.intensity} intensity`}
                  action={
                    done || justLogged === key ? (
                      <Pill status="good">Logged</Pill>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => logSession(session)}
                      >
                        Mark done
                      </button>
                    )
                  }
                >
                  <ol className="blocks">
                    {session.blocks.map((block) => (
                      <li key={block.label}>
                        <span className="block-label">{block.label}</span>
                        <span className="block-detail">{block.detail}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
              );
            })}
          </div>
        )}

        <div className="grid grid-2">
          <Card title="Rest days" note="Scheduled, not accidental">
            {plan.restDays.length === 0 ? (
              <p className="hint">No rest day this week — that is only sustainable for a while.</p>
            ) : (
              <div className="row">
                {plan.restDays.map((d) => (
                  <Pill key={d}>{formatWeekday(d)}</Pill>
                ))}
              </div>
            )}
            <p className="hint" style={{ marginTop: 10 }}>
              Rest days are where the adaptation happens. A walk and a good night's sleep count as
              doing them properly.
            </p>
          </Card>

          <Card title="Eating alongside it" note={`Around ${plan.nutrition.calories} kcal a day`}>
            <p className="hint">{plan.nutrition.note}</p>
          </Card>
        </div>

        <Card title="Recently logged" note="What the plan above is reading from">
          {recent.length === 0 ? (
            <Empty emoji="📓">
              No sessions logged yet. Mark one done above, or add it on the Move screen.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th className="num">Minutes</th>
                    <th>Intensity</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((w) => (
                    <tr key={w.id}>
                      <td className="cell-main">{relativeLabel(w.date)}</td>
                      <td>{w.type}</td>
                      <td className="num">{w.minutes}</td>
                      <td>{w.intensity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="hint">
          This plan is generated from your own logs using ordinary training practice — about 10%
          weekly progression, a lighter fourth week, hard days spaced apart, protein scaled to
          bodyweight. It is general fitness guidance, not medical advice. If you are injured,
          pregnant, or managing a health condition, take it to a professional who can actually
          examine you.
        </p>
      </div>
    </>
  );
}
