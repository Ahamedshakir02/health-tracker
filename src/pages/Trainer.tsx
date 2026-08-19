import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../components/ui';
import ExerciseAnim from '../components/ExerciseAnim';
import { IconCheck, IconFlame, IconTrainer } from '../components/icons';
import { TRAINING_PLAN, type PlanDay } from '../data/trainingPlan';
import { useHealth } from '../state/HealthProvider';
import { todayISO } from '../lib/dates';
import { labels } from '../lib/units';
import { promote, upsertSession } from '../lib/session';
import {
  clearHints,
  dayKey,
  hasProgress,
  hintKey,
  loadHints,
  loadScratch,
  migrateLegacy,
  newDay,
  normalise,
  parseScheme,
  progressKey,
  saveScratch,
  stalePromotable,
  type ScratchDay,
  type ScratchStore,
} from '../lib/trainerProgress';
import type { WorkoutEntry, WorkoutSession } from '../types';

/**
 * The Revolution Gym & Fitness schedule book, rendered as the Trainer section.
 *
 * The content is the book's, unchanged — every schedule, day, section and
 * exercise in its original order. What this adds is what the paper version
 * can't have: an animated demonstration of every movement (see ExerciseAnim),
 * and a working surface — pick a schedule and a day, tick sets off as you
 * finish them, and record what you actually lifted.
 *
 * Ticks and typed numbers go to localStorage while you are in the gym (see
 * lib/trainerProgress.ts); "Finish day" is what turns them into a durable,
 * synced record. That split is deliberate: a Firestore write per tap would
 * burn the free tier on state that is worthless tomorrow, and would fail
 * outright in a basement with no signal.
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
  const { data, update } = useHealth();
  const units = data.settings.units;
  const u = labels(units);

  const [scheduleId, setScheduleId] = useState<number>(TRAINING_PLAN[0]?.id ?? 1);
  const [dayN, setDayN] = useState<number>(1);
  const [store, setStore] = useState<ScratchStore>(() => {
    // The undated v1 map is converted to weight hints and removed on first
    // load. It can never become history — it has no dates, so dating it would
    // invent a workout that did not happen.
    migrateLegacy();
    return loadScratch();
  });
  const [hints, setHints] = useState(loadHints);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    saveScratch(store);
  }, [store]);

  // Real history supersedes the recovered v1 hints, so drop them once it exists.
  useEffect(() => {
    if (data.sessions.length && Object.keys(hints).length) {
      clearHints();
      setHints({});
    }
  }, [data.sessions.length, hints]);

  const schedule = useMemo(
    () => TRAINING_PLAN.find((s) => s.id === scheduleId) ?? TRAINING_PLAN[0],
    [scheduleId],
  );
  const day = useMemo(
    () => schedule.days.find((d) => d.n === dayN) ?? schedule.days[0],
    [schedule, dayN],
  );

  const scheme = parseScheme(day.reps);
  const today = todayISO();
  const key = dayKey(today, schedule.id, day.n);
  const scratch = store[key];

  /**
   * Writes a promoted session and its paired workout row.
   *
   * Sessions first: if the second write fails, the history is intact and the
   * missing workout row is recoverable from `sessionId`. Reversed, a workout
   * would count on the dashboard with nothing behind it.
   */
  const commitSession = useCallback(
    (session: WorkoutSession, workout: WorkoutEntry) => {
      update('sessions', (current) => upsertSession(current, session));
      update('workouts', (current) => [
        ...current.filter((w) => w.id !== workout.id),
        workout,
      ]);
    },
    [update],
  );

  /**
   * Promote anything left over from a previous day.
   *
   * This is the "walked out of the gym and never tapped finish" case. It runs
   * once per mount, guarded by a ref: without the guard StrictMode's double
   * effect would run it twice, and while the upsert would still collapse the
   * result, doing the work twice is pointless.
   */
  const swept = useRef(false);
  useEffect(() => {
    if (swept.current) return;
    swept.current = true;
    const stale = stalePromotable(store, today);
    if (!stale.length) return;

    setStore((prev) => {
      const next = { ...prev };
      for (const entry of stale) {
        const sch = TRAINING_PLAN.find((s) => s.id === entry.scheduleId);
        const d = sch?.days.find((x) => x.n === entry.day);
        if (!sch || !d) continue;
        const out = promote(entry, sch, d);
        if (!out) continue;
        commitSession(out.session, out.workout);
        next[dayKey(entry.date, entry.scheduleId, entry.day)] = {
          ...entry,
          promotedAs: out.session.id,
        };
      }
      return next;
    });
    // Intentionally mount-only: this is a catch-up sweep, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Creates today's scratch on the first interaction, not on render. */
  const withDay = (fn: (d: ScratchDay) => ScratchDay) => {
    setStore((prev) => {
      const current = prev[key] ?? newDay(today, schedule.id, day.n, units);
      return { ...prev, [key]: fn(current) };
    });
    setSaved(null);
  };

  // Progress across the selected day, counted in sets rather than exercises so
  // a half-finished movement still moves the bar.
  const tally = useMemo(() => {
    let done = 0;
    let total = 0;
    let exercisesDone = 0;
    day.sections.forEach((section, si) => {
      section.exercises.forEach((ex) => {
        const entry = normalise(scratch?.entries[progressKey(si, ex.n)], scheme.sets);
        const d = entry.done.filter(Boolean).length;
        done += d;
        total += scheme.sets;
        if (d === scheme.sets) exercisesDone += 1;
      });
    });
    return { done, total, exercisesDone, exercises: countExercises(day) };
  }, [day, scratch, scheme.sets]);

  const pct = tally.total ? Math.round((tally.done / tally.total) * 100) : 0;
  const alreadyLogged = Boolean(scratch?.promotedAs);

  const pickSchedule = (id: number) => {
    setScheduleId(id);
    setDayN(1);
    setSaved(null);
  };

  const toggleSet = (exKey: string, index: number) => {
    withDay((d) => {
      const entry = normalise(d.entries[exKey], scheme.sets);
      const done = entry.done.slice();
      done[index] = !done[index];
      return { ...d, entries: { ...d.entries, [exKey]: { ...entry, done } } };
    });
  };

  const setField = (exKey: string, field: 'weight' | 'reps', index: number, value: string) => {
    withDay((d) => {
      const entry = normalise(d.entries[exKey], scheme.sets);
      const next = entry[field].slice();
      next[index] = value;
      return { ...d, entries: { ...d.entries, [exKey]: { ...entry, [field]: next } } };
    });
  };

  const resetDay = () => {
    setStore((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSaved(null);
  };

  /**
   * Turn today's ticks into a record.
   *
   * Safe to press twice: the session id is derived from the start time held in
   * the scratch, so a second press writes the same id and the upsert replaces
   * rather than appends.
   */
  const finishDay = () => {
    if (!scratch) return;
    const out = promote(scratch, schedule, day);
    if (!out) return;
    commitSession(out.session, out.workout);
    setStore((prev) => ({ ...prev, [key]: { ...scratch, promotedAs: out.session.id } }));
    setSaved(
      `Saved — ${out.session.exercises.reduce((n, e) => n + e.sets.length, 0)} sets, ${out.session.durationMin} min.`,
    );
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
              onClick={() => {
                setDayN(d.n);
                setSaved(null);
              }}
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
              <span aria-live="polite">
                {tally.exercisesDone}/{tally.exercises} exercises · {pct}%
              </span>
            </div>
          </div>

          <div className="finish-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={finishDay}
              disabled={!scratch || !hasProgress(scratch)}
            >
              {alreadyLogged ? 'Update today’s record' : 'Finish day'}
            </button>
            <p className="hint finish-note">
              {saved ??
                (alreadyLogged
                  ? 'Logged. Tick more sets and update it if you carry on.'
                  : 'Ticks stay on this device until you finish — then the day is saved and synced.')}
            </p>
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
                  const exKey = progressKey(si, ex.n);
                  const entry = normalise(scratch?.entries[exKey], scheme.sets);
                  const complete = entry.done.every(Boolean);
                  const hint = hints[hintKey(schedule.id, day.n, si, ex.n)];
                  return (
                    <article
                      className={`ex-card${complete ? ' is-done' : ''}`}
                      key={exKey}
                      style={{ '--ex-color': color } as React.CSSProperties}
                    >
                      <ExerciseAnim name={ex.name} phase={ex.n} />

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

                        {hint?.some((w) => w.trim()) && (
                          <p className="ex-last">
                            On this device: {hint.filter((w) => w.trim()).join(', ')}
                          </p>
                        )}

                        <div className="ex-sets">
                          <span className="ex-scheme">
                            {scheme.reps ? `${scheme.reps} reps` : 'reps'} × {scheme.sets}
                          </span>
                          <div className="setchips" role="group" aria-label={`${ex.name} sets`}>
                            {entry.done.map((isDone, i) => (
                              <button
                                key={i}
                                type="button"
                                className="setchip"
                                aria-pressed={isDone}
                                aria-label={`${ex.name}, set ${i + 1} of ${scheme.sets}`}
                                onClick={() => toggleSet(exKey, i)}
                              >
                                {i + 1}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* The book's own "Weight — set 1 / 2 / 3" blanks, with the
                            reps beside them so a session records what happened
                            rather than what was prescribed. */}
                        <div className="ex-logs">
                          {entry.weight.map((w, i) => (
                            <div className="ex-log" key={i}>
                              <span className="ex-log-n" aria-hidden="true">
                                {i + 1}
                              </span>
                              <input
                                className="wt"
                                type="number"
                                min="0"
                                step="0.5"
                                inputMode="decimal"
                                placeholder={u.weight}
                                value={w}
                                aria-label={`${ex.name}, weight for set ${i + 1} in ${u.weight}`}
                                onChange={(e) => setField(exKey, 'weight', i, e.target.value)}
                              />
                              <input
                                className="wt"
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                placeholder={scheme.reps ? String(scheme.reps) : 'reps'}
                                value={entry.reps[i]}
                                aria-label={`${ex.name}, reps for set ${i + 1}`}
                                onChange={(e) => setField(exKey, 'reps', i, e.target.value)}
                              />
                            </div>
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
          1–10, then 12, 13, 14. Weights are stored in {u.weight}; reps left blank are recorded as
          the {scheme.reps || 'prescribed'} the book prescribes.
        </p>
      </div>
    </>
  );
}
