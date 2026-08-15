import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui';
import { IconCheck, IconFlame, IconTrainer } from '../components/icons';
import { TRAINING_PLAN, type PlanDay } from '../data/trainingPlan';
import {
  loadProgress,
  normalise,
  parseScheme,
  progressKey,
  saveProgress,
  type ProgressMap,
} from '../lib/trainerProgress';

/**
 * The Revolution Gym & Fitness schedule book, rendered as the Trainer section.
 *
 * The content is the book's, unchanged — every schedule, day, section and
 * exercise in its original order, with the book's own illustrations. What this
 * adds is the working surface the paper version can't have: pick a schedule and
 * a day, tick sets off as you finish them, and record what you actually lifted.
 */

/** One colour per muscle group, drawn from the chart series so the app reads as one system. */
const MUSCLE_COLOR: Record<string, string> = {
  CHEST: 'var(--s-energy)',
  'WINGS / BACK': 'var(--s-weight)',
  BICEPS: 'var(--s-activity)',
  TRICEPS: 'var(--accent)',
  SHOULDER: 'var(--s-sleep)',
  FOREARMS: 'var(--serious)',
  LEGS: 'var(--good)',
};

function colorFor(name: string): string {
  return MUSCLE_COLOR[name.toUpperCase()] ?? 'var(--ink-3)';
}

/** Exercises in a day, across all its sections. */
function countExercises(day: PlanDay): number {
  return day.sections.reduce((n, s) => n + s.exercises.length, 0);
}

export default function Trainer() {
  const [scheduleId, setScheduleId] = useState<number>(TRAINING_PLAN[0]?.id ?? 1);
  const [dayN, setDayN] = useState<number>(1);
  const [progress, setProgress] = useState<ProgressMap>(loadProgress);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const schedule = useMemo(
    () => TRAINING_PLAN.find((s) => s.id === scheduleId) ?? TRAINING_PLAN[0],
    [scheduleId],
  );
  const day = useMemo(
    () => schedule.days.find((d) => d.n === dayN) ?? schedule.days[0],
    [schedule, dayN],
  );

  const scheme = parseScheme(day.reps);

  // Progress across the selected day, counted in sets rather than exercises so
  // a half-finished movement still moves the bar.
  const tally = useMemo(() => {
    let done = 0;
    let total = 0;
    let exercisesDone = 0;
    day.sections.forEach((section, si) => {
      section.exercises.forEach((ex) => {
        const entry = normalise(progress[progressKey(schedule.id, day.n, si, ex.n)], scheme.sets);
        const d = entry.done.filter(Boolean).length;
        done += d;
        total += scheme.sets;
        if (d === scheme.sets) exercisesDone += 1;
      });
    });
    return { done, total, exercisesDone, exercises: countExercises(day) };
  }, [day, progress, schedule.id, scheme.sets]);

  const pct = tally.total ? Math.round((tally.done / tally.total) * 100) : 0;

  const pickSchedule = (id: number) => {
    setScheduleId(id);
    setDayN(1);
  };

  const toggleSet = (key: string, index: number) => {
    setProgress((prev) => {
      const entry = normalise(prev[key], scheme.sets);
      const done = entry.done.slice();
      done[index] = !done[index];
      return { ...prev, [key]: { ...entry, done } };
    });
  };

  const setWeight = (key: string, index: number, value: string) => {
    setProgress((prev) => {
      const entry = normalise(prev[key], scheme.sets);
      const weight = entry.weight.slice();
      weight[index] = value;
      return { ...prev, [key]: { ...entry, weight } };
    });
  };

  const resetDay = () => {
    setProgress((prev) => {
      const next = { ...prev };
      day.sections.forEach((section, si) => {
        section.exercises.forEach((ex) => {
          delete next[progressKey(schedule.id, day.n, si, ex.n)];
        });
      });
      return next;
    });
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Trainer</h1>
          <p className="page-sub">
            Revolution Gym &amp; Fitness — {TRAINING_PLAN.length} schedules, 360 exercises
          </p>
        </div>
        <div className="row">
          <span className="pill accent">
            <IconTrainer />
            {schedule.title} · Day {day.n}
          </span>
        </div>
      </header>

      <div className="stack">
        {/* Schedule picker. Horizontal rail so all thirteen stay one tap away. */}
        <nav className="sched-rail" aria-label="Schedules">
          {TRAINING_PLAN.map((s) => {
            const sets = parseScheme(s.days[0]?.reps ?? '').sets;
            const exercises = s.days.reduce((n, d) => n + countExercises(d), 0);
            return (
              <button
                key={s.id}
                type="button"
                className="sched-chip"
                aria-current={s.id === schedule.id ? 'true' : undefined}
                onClick={() => pickSchedule(s.id)}
              >
                <span className="sched-n">{String(s.id).padStart(2, '0')}</span>
                <span className="sched-reps">{s.days[0]?.reps || `× ${sets}`}</span>
                <span className="sched-meta">
                  {s.days.length} days · {exercises} ex
                </span>
              </button>
            );
          })}
        </nav>

        {/* Day picker for the chosen schedule. */}
        <nav className="day-tabs" aria-label={`Days in ${schedule.title}`}>
          {schedule.days.map((d) => (
            <button
              key={d.n}
              type="button"
              className="day-tab"
              aria-current={d.n === day.n ? 'page' : undefined}
              onClick={() => setDayN(d.n)}
            >
              <span className="day-n">Day {d.n}</span>
              <span className="day-focus">{d.focus}</span>
              <span className="day-swatches" aria-hidden="true">
                {d.sections.map((s, i) => (
                  <span key={i} className="dot" style={{ background: colorFor(s.name) }} />
                ))}
              </span>
            </button>
          ))}
        </nav>

        <Card
          title={`Day ${day.n} — ${day.focus}`}
          note={`${day.reps} reps × sets · ${tally.exercises} exercises · ${tally.total} sets`}
          action={
            <button type="button" className="btn btn-sm" onClick={resetDay} disabled={!tally.done}>
              Reset day
            </button>
          }
        >
          <div className="daybar">
            <div
              className="meter-track"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Day progress"
            >
              <div className="meter-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="meter-cap">
              <span className={`meter-state ${pct === 100 ? 'st-good' : 'st-under'}`}>
                {pct === 100 ? <IconCheck /> : <IconFlame />}
                {pct === 100 ? 'Day complete' : `${tally.done} of ${tally.total} sets`}
              </span>
              <span>
                {tally.exercisesDone}/{tally.exercises} exercises · {pct}%
              </span>
            </div>
          </div>
        </Card>

        {day.sections.map((section, si) => {
          const color = colorFor(section.name);
          return (
            <section className="musc" key={`${section.name}-${si}`}>
              <header className="musc-hd">
                <span className="musc-swatch" style={{ background: color }} aria-hidden="true" />
                <h2 className="musc-name">{section.name}</h2>
                <span className="musc-count">{section.exercises.length} exercises</span>
              </header>

              <div className="ex-grid">
                {section.exercises.map((ex) => {
                  const key = progressKey(schedule.id, day.n, si, ex.n);
                  const entry = normalise(progress[key], scheme.sets);
                  const complete = entry.done.every(Boolean);
                  return (
                    <article
                      className={`ex-card${complete ? ' is-done' : ''}`}
                      key={key}
                      style={{ '--ex-color': color } as React.CSSProperties}
                    >
                      {ex.img && (
                        <figure className="ex-fig">
                          <img
                            src={`${import.meta.env.BASE_URL}exercises/${ex.img}`}
                            alt={`${ex.name} — working position`}
                            loading="lazy"
                            decoding="async"
                          />
                        </figure>
                      )}

                      <div className="ex-body">
                        <div className="ex-top">
                          <span className="ex-n">{ex.n}</span>
                          <h3 className="ex-name">{ex.name}</h3>
                          {complete && (
                            <span className="ex-tick" aria-label="Completed">
                              <IconCheck />
                            </span>
                          )}
                        </div>

                        <p className="ex-cue">{ex.cue}</p>

                        <div className="ex-sets">
                          <span className="ex-scheme">
                            {scheme.reps ? `${scheme.reps} reps` : 'reps'} ×{' '}
                            {scheme.sets}
                          </span>
                          <div className="setchips" role="group" aria-label={`${ex.name} sets`}>
                            {entry.done.map((isDone, i) => (
                              <button
                                key={i}
                                type="button"
                                className="setchip"
                                aria-pressed={isDone}
                                aria-label={`${ex.name}, set ${i + 1} of ${scheme.sets}`}
                                onClick={() => toggleSet(key, i)}
                              >
                                {i + 1}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* The book's own "Weight — set 1 / 2 / 3" blanks. */}
                        <div className="ex-weights">
                          {entry.weight.map((w, i) => (
                            <input
                              key={i}
                              className="wt"
                              type="text"
                              inputMode="decimal"
                              placeholder="—"
                              value={w}
                              aria-label={`${ex.name}, weight for set ${i + 1}`}
                              onChange={(e) => setWeight(key, i, e.target.value)}
                            />
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        <p className="hint">
          Transcribed from the Revolution Gym &amp; Fitness schedule book — every exercise in its
          original section and order. Schedule 11 is not in the source book, so the numbering runs
          1–10, then 12, 13, 14. Ticked sets and weights are kept on this device.
        </p>
      </div>
    </>
  );
}
