import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Segmented } from '../components/ui';
import ExerciseAnim from '../components/ExerciseAnim';
import { homeExerciseFor } from '../data/homePlans';
import { IconCheck, IconFlame, IconTrainer } from '../components/icons';
import { TRAINING_PLAN, type PlanDay } from '../data/trainingPlan';
import { useHealth } from '../state/HealthProvider';
import { formatShort, todayISO } from '../lib/dates';
import { labels, round, toCanonical, toDisplay } from '../lib/units';
import ProgressionPanel from '../components/ProgressionPanel';
import RestTimer from '../components/RestTimer';
import { prime } from '../lib/beep';
import { endsAt, restEnabled } from '../lib/rest';
import { useWakeLock } from '../lib/wakeLock';
import { movementKey } from '../lib/movementKey';
import { showsFirstMovementOnly } from '../data/exerciseMedia';
import { cooldownFor, toLog } from '../lib/mobility';
import {
  bestSet,
  describeSets,
  epley1RM,
  lastPerformance,
  progression,
  promote,
  upsertSession,
} from '../lib/session';
import { nextDay, rotationPosition, sessionsLogged, skipTo, startProgramme } from '../lib/programme';
import {
  clearHints,
  dayKey,
  hasProgress,
  hintKey,
  loadHints,
  loadPlace,
  loadScratch,
  migrateLegacy,
  newDay,
  normalise,
  parseScheme,
  progressKey,
  savePlace,
  saveScratch,
  stalePromotable,
  type ScratchDay,
  type ScratchStore,
} from '../lib/trainerProgress';
import {
  DEFAULT_TRAINER_PREFS,
  EQUIPMENT_MODES,
  EQUIPMENT_NOTES,
  type EquipmentMode,
  type WorkoutEntry,
  type WorkoutSession,
} from '../types';

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
  const { data, update, updateSettings } = useHealth();
  const units = data.settings.units;
  const u = labels(units);
  const programme = data.settings.programme;
  const prefs = data.settings.trainer ?? DEFAULT_TRAINER_PREFS;
  const setTrainer = (patch: Partial<typeof prefs>) =>
    updateSettings({ trainer: { ...prefs, ...patch } });
  /** kg out of storage, into whatever the user reads in. */
  const toWeight = useCallback((kg: number) => round(toDisplay('weight', kg, units), 1), [units]);

  /**
   * Where to open: where you last were, then your programme, then the start.
   *
   * The saved place comes first because browsing is free — picking a schedule
   * deliberately does not claim it — and without somewhere to record the
   * browse, anyone working through a schedule they had not claimed was sent
   * back to Schedule 1 on every visit.
   *
   * Read once, on mount, and never re-synced. A live update from the other
   * device landing mid-workout must not yank the picker out from under someone
   * holding a loaded bar — the pointer is advisory, and where you are right now
   * is yours.
   */
  const [start] = useState(() => {
    // A stored id is only as good as the plan it was stored against; a schedule
    // that has since gone must fall through rather than strand the page.
    const place = loadPlace();
    const remembered = place && TRAINING_PLAN.find((s) => s.id === place.scheduleId);
    if (remembered && remembered.days.some((d) => d.n === place.dayN)) {
      return { scheduleId: remembered.id, dayN: place.dayN };
    }
    const active =
      programme && TRAINING_PLAN.find((s) => s.id === programme.scheduleId);
    if (active) return { scheduleId: active.id, dayN: nextDay(active, data.sessions, programme) };
    return { scheduleId: TRAINING_PLAN[0]?.id ?? 1, dayN: TRAINING_PLAN[0]?.days[0]?.n ?? 1 };
  });
  const [scheduleId, setScheduleId] = useState<number>(start.scheduleId);
  const [dayN, setDayN] = useState<number>(start.dayN);
  /**
   * The book, or one day of it.
   *
   * Opening straight into 40-odd exercise cards buries the one question you
   * actually arrive with — which day am I doing. So the schedule is a preview
   * first, and the day is something you choose to open.
   *
   * The exception is a day already under way: someone who reloads between sets
   * wants their sets back, not a menu.
   */
  const [view, setView] = useState<'schedule' | 'day'>(() =>
    hasProgress(loadScratch()[dayKey(todayISO(), start.scheduleId, start.dayN)]) ? 'day' : 'schedule',
  );
  const [store, setStore] = useState<ScratchStore>(() => {
    // The undated v1 map is converted to weight hints and removed on first
    // load. It can never become history — it has no dates, so dating it would
    // invent a workout that did not happen.
    migrateLegacy();
    return loadScratch();
  });
  const [hints, setHints] = useState(loadHints);
  const [saved, setSaved] = useState<string | null>(null);
  /** Movement key of the exercise whose progression chart is open, if any. */
  const [openChart, setOpenChart] = useState<string | null>(null);
  /** Epoch ms the current rest finishes, or null when nothing is resting. */
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(0);

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
  // Deterministic: the same training day always suggests the same stretches,
  // so it can be learned rather than re-read every session.
  const cooldown = useMemo(() => (prefs.cooldown ? cooldownFor(day) : []), [day, prefs.cooldown]);
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
  const inSession = Boolean(scratch && hasProgress(scratch) && !scratch.promotedAs);
  // Only while a session is genuinely under way. Holding the lock for someone
  // reading the book on the sofa would flatten their battery for nothing.
  useWakeLock(prefs.keepAwake && inSession);
  const alreadyLogged = Boolean(scratch?.promotedAs);

  const isActive = programme?.scheduleId === schedule.id;
  const logged = programme ? sessionsLogged(data.sessions, programme) : 0;
  /** Where the rotation says you should be, whatever you are currently looking at. */
  const upNext = useMemo(
    () => (isActive ? nextDay(schedule, data.sessions, programme) : null),
    [isActive, schedule, data.sessions, programme],
  );

  /**
   * Browsing is free.
   *
   * Looking at another schedule must not move the pointer — you should be able
   * to read the whole book without losing your place in it.
   */
  const pickSchedule = (id: number) => {
    const s = TRAINING_PLAN.find((x) => x.id === id);
    const n =
      s && programme?.scheduleId === id
        ? nextDay(s, data.sessions, programme)
        : (s?.days[0]?.n ?? 1);
    setScheduleId(id);
    setDayN(n);
    setSaved(null);
    // Choosing a schedule is choosing what to look at, not what to do — it
    // stays on the preview rather than dropping into a day you did not pick.
    setView('schedule');
    // Remembers where you are looking, which is not the same as claiming it —
    // the programme pointer is untouched here, as it always was.
    savePlace({ scheduleId: id, dayN: n });
  };

  const makeActive = () => {
    updateSettings({ programme: startProgramme(schedule.id) });
    setSaved(`${schedule.title} is now your programme.`);
  };

  /**
   * Picking a day by hand.
   *
   * Within your own programme this is recorded as an explicit skip, so
   * reloading mid-workout brings you back to the day you were actually doing
   * rather than the one the rotation would have chosen. It is one settings
   * write per day picked — rare, unlike ticking a set, which is why that stays
   * on the device.
   */
  const pickDay = (n: number) => {
    setDayN(n);
    setSaved(null);
    setView('day');
    savePlace({ scheduleId, dayN: n });
    if (programme && isActive && n !== upNext) {
      updateSettings({ programme: skipTo(programme, n) });
    }
  };

  const toggleSet = (exKey: string, index: number) => {
    let started = false;
    withDay((d) => {
      const entry = normalise(d.entries[exKey], scheme.sets);
      const done = entry.done.slice();
      done[index] = !done[index];
      started = done[index];
      return { ...d, entries: { ...d.entries, [exKey]: { ...entry, done } } };
    });

    // Rest starts when a set is finished, not when one is un-ticked.
    if (!started || !restEnabled(prefs.restSeconds)) return;
    // This call is inside the tap that started the rest, which is the only
    // moment a browser will let an AudioContext start. Priming it later —
    // when the timer actually ends — produces a context that is suspended and
    // silent, with no error to notice.
    if (prefs.sound) prime();
    setRestTotal(prefs.restSeconds);
    setRestEnd(endsAt(Date.now(), prefs.restSeconds));
  };

  const setField = (exKey: string, field: 'weight' | 'reps', index: number, value: string) => {
    withDay((d) => {
      const entry = normalise(d.entries[exKey], scheme.sets);
      const next = entry[field].slice();
      next[index] = value;
      return { ...d, entries: { ...d.entries, [exKey]: { ...entry, [field]: next } } };
    });
  };

  const toggleCooldown = (id: string) => {
    withDay((d) => {
      const current = d.cooldown ?? {};
      return { ...d, cooldown: { ...current, [id]: !current[id] } };
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
    const out = promote(scratch, schedule, day, cooldown.map(toLog));
    if (!out) return;
    commitSession(out.session, out.workout);
    setStore((prev) => ({ ...prev, [key]: { ...scratch, promotedAs: out.session.id } }));
    setRestEnd(null);
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
          {view === 'day' ? (
            <button
              type="button"
              className="pill accent pill-btn"
              onClick={() => setView('schedule')}
            >
              <IconTrainer />
              {schedule.title} · Day {day.n}
              <span className="pill-back">Back to the schedule</span>
            </button>
          ) : (
            <span className="pill accent">
              <IconTrainer />
              {schedule.title}
            </span>
          )}
        </div>
      </header>

      {/* Where you are training changes mid-week more often than the other
          preferences do — a locked gym, a trip — so it is here as well as in
          Settings rather than only there. */}
      <div className="equip-row">
        <span className="equip-label" id="equip-label">
          Training
        </span>
        <Segmented
          ariaLabel="Where you are training"
          value={prefs.equipment}
          onChange={(value: EquipmentMode) => setTrainer({ equipment: value })}
          options={EQUIPMENT_MODES.map((mode) => ({
            value: mode,
            label: EQUIPMENT_NOTES[mode].label,
          }))}
        />
        {prefs.equipment !== 'gym' && (
          <p className="hint equip-note">{EQUIPMENT_NOTES[prefs.equipment].needs}</p>
        )}
      </div>

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
                // Read as text the parts run together — "0115 x 34 days · 29
                // ex". Spelling it out is the only way this is speakable.
                aria-label={`${s.title}, ${s.days[0]?.reps ?? `${sets} sets`}, ${s.days.length} days, ${exercises} exercises`}
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

        {/* The active programme. One schedule is "yours"; the rest are a book
            you can leaf through without losing your place in it. */}
        <div className="prog-row">
          {isActive ? (
            <>
              <span className="pill good">
                <IconCheck />
                Your programme
              </span>
              <p className="hint prog-note">
                {logged
                  ? `${logged} ${logged === 1 ? 'day' : 'days'} logged · up next is Day ${upNext} (${rotationPosition(schedule, upNext ?? 0)} of ${schedule.days.length}).`
                  : `Nothing logged yet — start at Day ${upNext}.`}
              </p>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-sm" onClick={makeActive}>
                Make this my programme
              </button>
              <p className="hint prog-note">
                {programme
                  ? `You are following Schedule ${programme.scheduleId}. Browsing here changes nothing.`
                  : 'Pick one once and the Trainer opens on the next day in the rotation every time.'}
              </p>
            </>
          )}
        </div>

        {/* Day picker for the chosen schedule.

            In the preview it is the whole page: a card per day, with enough on
            it to choose by. In a day it shrinks back to a rail, so you can move
            between days mid-session without going back out. */}
        <nav
          className={view === 'schedule' ? 'day-cards' : 'day-tabs'}
          aria-label={`Days in ${schedule.title}`}
        >
          {schedule.days.map((d) => {
            const count = countExercises(d);
            const doneToday = Boolean(
              data.sessions.some(
                (x) =>
                  x.kind === 'strength' &&
                  x.date === today &&
                  x.scheduleId === schedule.id &&
                  x.day === d.n,
              ),
            );
            return (
              <button
                key={d.n}
                type="button"
                className={view === 'schedule' ? 'day-card' : 'day-tab'}
                aria-label={[
                  `Day ${d.n}`,
                  d.focus,
                  `${d.reps} reps by sets`,
                  `${count} ${count === 1 ? 'exercise' : 'exercises'}`,
                  d.n === upNext ? 'up next' : null,
                  doneToday ? 'logged today' : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                aria-current={view === 'day' && d.n === day.n ? 'page' : undefined}
                onClick={() => pickDay(d.n)}
              >
                <span className="day-n">
                  Day {d.n}
                  {d.n === upNext && !(view === 'day' && d.n === day.n) && (
                    <span className="day-next" aria-label="Up next">
                      •
                    </span>
                  )}
                </span>
                <span className="day-focus">{d.focus}</span>
                {view === 'schedule' && (
                  <span className="day-meta">
                    {d.reps} · {count} {count === 1 ? 'exercise' : 'exercises'}
                    {doneToday && ' · logged today'}
                  </span>
                )}
                <span className="day-swatches" aria-hidden="true">
                  {d.sections.map((s, i) => (
                    <span key={i} className="dot" style={{ background: colorFor(s.name) }} />
                  ))}
                </span>
              </button>
            );
          })}
        </nav>

        {view === 'day' && (
          <>
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

                  // History is keyed by movement, not by position, so the same
                  // lift carries its record across schedules.
                  const mkey = movementKey(section.name, ex.name);

                  // The home editions swap the movement, not the plan. Only
                  // what is shown on the card changes; the key above, the rep
                  // scheme and everything logged stay on the gym movement, so a
                  // week of push-ups lands on the same chart as the bench press
                  // it stands in for.
                  const home = homeExerciseFor(prefs.equipment, section.name, ex.name);
                  const shown = home?.name ?? ex.name;
                  const last = lastPerformance(data.sessions, mkey, today);
                  const best = bestSet(data.sessions, mkey);

                  // The personal record check runs against what is being typed
                  // right now rather than what has been saved — the moment it
                  // is useful is the moment you finish the set, not tonight.
                  let liveBest = 0;
                  let liveReps = 0;
                  entry.done.forEach((isDone, i) => {
                    if (!isDone) return;
                    const w = toCanonical('weight', Number(entry.weight[i] || 0), units);
                    const r = Number(entry.reps[i] || scheme.reps || 0);
                    liveBest = Math.max(liveBest, epley1RM(w, r));
                    if (w === 0) liveReps = Math.max(liveReps, r);
                  });
                  const isPR = Boolean(
                    best &&
                      (liveBest > best.est1RM || (best.bodyweight && liveReps > best.reps)),
                  );
                  const chartOpen = openChart === mkey;

                  return (
                    <article
                      className={`ex-card${complete ? ' is-done' : ''}`}
                      key={exKey}
                      style={{ '--ex-color': color } as React.CSSProperties}
                    >
                      <ExerciseAnim name={shown} section={section.name} phase={ex.n} />

                      <div className="ex-body">
                        <div className="ex-top">
                          <span className="ex-n">{ex.n}</span>
                          <h3 className="ex-name">{shown}</h3>
                          {complete && (
                            <span className="ex-tick" aria-label="Completed">
                              <IconCheck />
                            </span>
                          )}
                        </div>

                        {/* Naming the gym movement is not a footnote. It is how
                            you know which line of the book you are on, and what
                            the substitute is meant to be training. */}
                        {home && <p className="ex-replaces">replaces {ex.name}</p>}

                        <p className="ex-cue">{home ? home.move : ex.cue}</p>

                        {home && (
                          <>
                            <details className="ex-how">
                              <summary>How to do it</summary>
                              <p>
                                <strong>Set up</strong> {home.setup}
                              </p>
                              <p>
                                <strong>Feel it</strong> {home.feel}
                              </p>
                            </details>

                            {/* At home there are no plates to add, so this pair
                                is the whole progression mechanism. */}
                            <dl className="ex-dial">
                              <div>
                                <dt>Harder</dt>
                                <dd>{home.harder}</dd>
                              </div>
                              <div>
                                <dt>Easier</dt>
                                <dd>{home.easier}</dd>
                              </div>
                            </dl>
                          </>
                        )}

                        {/* The book names two movements here; the dataset has a
                            clip for each, not for the pair. Saying so makes an
                            apparent mismatch read as deliberate. */}
                        {!home && showsFirstMovementOnly(ex.name) && (
                          <p className="ex-note">Demonstration shows the first movement.</p>
                        )}

                        {last ? (
                          <p className="ex-last">
                            Last: {describeSets(last.sets, u.weight, toWeight)} —{' '}
                            {formatShort(last.date)}
                          </p>
                        ) : (
                          hint?.some((w) => w.trim()) && (
                            <p className="ex-last">
                              On this device: {hint.filter((w) => w.trim()).join(', ')}
                            </p>
                          )
                        )}

                        <div className="ex-sets">
                          <span className="ex-scheme">
                            {scheme.reps ? `${scheme.reps} reps` : 'reps'} × {scheme.sets}
                          </span>
                          <div className="setchips" role="group" aria-label={`${shown} sets`}>
                            {entry.done.map((isDone, i) => (
                              <button
                                key={i}
                                type="button"
                                className="setchip"
                                aria-pressed={isDone}
                                aria-label={`${shown}, set ${i + 1} of ${scheme.sets}`}
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
                                aria-label={`${shown}, weight for set ${i + 1} in ${u.weight}`}
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
                                aria-label={`${shown}, reps for set ${i + 1}`}
                                onChange={(e) => setField(exKey, 'reps', i, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>

                        {best && (
                          <div className="ex-best">
                            <span className="ex-pb">
                              {best.bodyweight
                                ? `Best ${best.reps} reps`
                                : `Best ${toWeight(best.weightKg)} ${u.weight} × ${best.reps} · est. 1RM ${toWeight(best.est1RM)} ${u.weight}`}
                            </span>
                            {isPR && (
                              <span className="ex-pr" title="Beats your best on record">
                                PR
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm"
                              aria-expanded={chartOpen}
                              onClick={() => setOpenChart(chartOpen ? null : mkey)}
                            >
                              {chartOpen ? 'Hide' : 'Progress'}
                            </button>
                          </div>
                        )}

                        {chartOpen && (
                          <ProgressionPanel
                            points={progression(data.sessions, mkey)}
                            unitLabel={u.weight}
                            convert={toWeight}
                          />
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {cooldown.length > 0 && (
          <section className="musc cooldown">
            <header className="musc-hd">
              <span
                className="musc-swatch"
                style={{ background: 'var(--s-sleep)' }}
                aria-hidden="true"
              />
              <h2 className="musc-name">Cool-down</h2>
              <span className="musc-count">
                {cooldown.length} stretches for what you just trained
              </span>
            </header>

            <div className="ex-grid">
              {cooldown.map((stretch, i) => {
                const done = Boolean(scratch?.cooldown?.[stretch.id]);
                return (
                  <article
                    className={`ex-card${done ? ' is-done' : ''}`}
                    key={stretch.id}
                    style={{ '--ex-color': 'var(--s-sleep)' } as React.CSSProperties}
                  >
                    <ExerciseAnim name={stretch.name} clip={stretch} phase={i} />
                    <div className="ex-body">
                      <div className="ex-top">
                        <h3 className="ex-name">{stretch.name}</h3>
                        {done && (
                          <span className="ex-tick" aria-label="Held">
                            <IconCheck />
                          </span>
                        )}
                      </div>
                      <p className="ex-cue">{stretch.cue}</p>
                      <div className="ex-sets">
                        <span className="ex-scheme">Hold {stretch.holdSeconds}s</span>
                        <button
                          type="button"
                          className="setchip"
                          aria-pressed={done}
                          aria-label={`${stretch.name}, held`}
                          onClick={() => toggleCooldown(stretch.id)}
                        >
                          <IconCheck />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

          </>
        )}

        <p className="hint">
          Transcribed from the Revolution Gym &amp; Fitness schedule book — every exercise in its
          original section and order. Schedule 11 is not in the source book, so the numbering runs
          1–10, then 12, 13, 14. Weights are stored in {u.weight}; reps left blank are recorded as
          the {scheme.reps || 'prescribed'} the book prescribes. Records rank by an estimated one-rep
          max — a formula fitted to a population, not a measurement of you, so treat it as a
          direction rather than a number.
        </p>
      </div>

      {/* Pinned rather than in the flow: the whole point is to be readable
          from wherever you are in the day when the set ends. */}
      {restEnd !== null && (
        <RestTimer
          deadline={restEnd}
          total={restTotal}
          sound={prefs.sound}
          onDismiss={() => setRestEnd(null)}
          onAdd={(secs) => {
            setRestTotal((t) => t + secs);
            setRestEnd((end) => (end === null ? null : end + secs * 1000));
          }}
        />
      )}
    </>
  );
}
