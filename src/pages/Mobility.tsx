import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Empty } from '../components/ui';
import ExerciseAnim from '../components/ExerciseAnim';
import { IconCheck, IconMobility } from '../components/icons';
import { ROUTINES, STRETCHES, routineStretches, type MobilityArea, type MobilityRoutine, type Stretch } from '../data/mobility';
import { promoteMobility } from '../lib/mobility';
import { upsertSession } from '../lib/session';
import { formatRest, remainingSeconds } from '../lib/rest';
import { prime, beep } from '../lib/beep';
import { useWakeLock } from '../lib/wakeLock';
import { useHealth } from '../state/HealthProvider';
import { DEFAULT_TRAINER_PREFS } from '../types';

/**
 * Mobility and stretching.
 *
 * The stretches are the same public-domain photograph pairs the Trainer uses,
 * from the stretching half of free-exercise-db, so this costs nothing in
 * licensing and nothing in new machinery — same manifest shape, same two-frame
 * cross-fade, same component.
 *
 * A routine is played one stretch at a time rather than listed. Standing in a
 * hold with a phone in your hand, a list is the wrong shape: you want the one
 * you are doing, how long is left, and nothing else.
 */

const AREA_LABEL: Record<MobilityArea, string> = {
  hips: 'Hips',
  hamstrings: 'Hamstrings',
  quads: 'Quads',
  calves: 'Calves',
  back: 'Back',
  chest: 'Chest',
  shoulders: 'Shoulders',
  neck: 'Neck',
  arms: 'Arms',
  core: 'Core',
};

const AREA_ORDER = Object.keys(AREA_LABEL) as MobilityArea[];

export default function Mobility() {
  const { data, update } = useHealth();
  const prefs = data.settings.trainer ?? DEFAULT_TRAINER_PREFS;

  const [routine, setRoutine] = useState<MobilityRoutine | null>(null);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  /** Epoch ms the current hold finishes, or null when it is not running. */
  const [deadline, setDeadline] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const [browse, setBrowse] = useState<MobilityArea | null>(null);

  const stretches = useMemo(() => (routine ? routineStretches(routine) : []), [routine]);
  const current: Stretch | undefined = stretches[index];

  useWakeLock(prefs.keepAwake && routine !== null);

  // Same wall-clock rule as the rest timer: the deadline is the truth, the
  // interval only decides how often it is repainted.
  useEffect(() => {
    if (deadline === null) return;
    setLeft(remainingSeconds(deadline, Date.now()));
    const id = window.setInterval(() => setLeft(remainingSeconds(deadline, Date.now())), 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  const advance = useCallback(() => {
    setDeadline(null);
    setIndex((i) => Math.min(i + 1, stretches.length - 1));
  }, [stretches.length]);

  const markHeld = useCallback(
    (id: string) => setHeld((prev) => (prev.includes(id) ? prev : [...prev, id])),
    [],
  );

  // Fires once, when the hold reaches zero.
  const rang = useRef<number | null>(null);
  useEffect(() => {
    if (deadline === null || left > 0 || rang.current === deadline) return;
    rang.current = deadline;
    if (prefs.sound) beep();
    if (current) markHeld(current.id);
    advance();
  }, [left, deadline, prefs.sound, current, markHeld, advance]);

  const start = (r: MobilityRoutine) => {
    setRoutine(r);
    setIndex(0);
    setHeld([]);
    setStartedAt(new Date().toISOString());
    setDeadline(null);
    setSaved(null);
  };

  const stop = () => {
    setRoutine(null);
    setDeadline(null);
    setStartedAt(null);
  };

  const beginHold = () => {
    if (!current) return;
    // Inside the tap, which is the only moment a browser will start audio.
    if (prefs.sound) prime();
    setDeadline(Date.now() + current.holdSeconds * 1000);
  };

  /**
   * Writes the routine as a session and its paired workout row.
   *
   * Sessions first, same order as the Trainer: if the second write fails the
   * history is intact and the missing row is recoverable from `sessionId`.
   */
  const logRoutine = () => {
    if (!routine || !startedAt) return;
    const out = promoteMobility(routine, held, startedAt);
    if (!out) return;
    update('sessions', (current_) => upsertSession(current_, out.session));
    update('workouts', (current_) => [
      ...current_.filter((w) => w.id !== out.workout.id),
      out.workout,
    ]);
    setSaved(`Saved — ${out.session.moves.length} holds, ${out.session.durationMin} min.`);
  };

  const byArea = useMemo(() => {
    const map = new Map<MobilityArea, Stretch[]>();
    for (const s of STRETCHES) {
      const list = map.get(s.area) ?? [];
      list.push(s);
      map.set(s.area, list);
    }
    return map;
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Mobility</h1>
          <p className="page-sub">
            {ROUTINES.length} routines · {STRETCHES.length} stretches
          </p>
        </div>
        {routine && (
          <div className="row">
            <span className="pill accent">
              <IconMobility />
              {routine.title}
            </span>
          </div>
        )}
      </header>

      <div className="stack">
        {routine && current ? (
          <Card
            title={routine.title}
            note={`${index + 1} of ${stretches.length} · ${held.length} held`}
            action={
              <button type="button" className="btn btn-sm" onClick={stop}>
                Close
              </button>
            }
          >
            <article className="hold-card">
              <ExerciseAnim name={current.name} clip={current} phase={index} />
              <div className="hold-body">
                <span className="musc-count">{AREA_LABEL[current.area]}</span>
                <h2 className="hold-name">
                  {current.name}
                  {held.includes(current.id) && (
                    <span className="ex-tick" aria-label="Held">
                      <IconCheck />
                    </span>
                  )}
                </h2>
                <p className="ex-cue">{current.cue}</p>

                <div className="hold-timer">
                  <span className="hold-count" aria-hidden="true">
                    {formatRest(deadline === null ? current.holdSeconds : left)}
                  </span>
                  {deadline === null ? (
                    <button type="button" className="btn btn-primary" onClick={beginHold}>
                      Start hold
                    </button>
                  ) : (
                    <button type="button" className="btn" onClick={() => setDeadline(null)}>
                      Stop
                    </button>
                  )}
                  <span className="hint">
                    {current.holdSeconds}s. Do both sides where there are two.
                  </span>
                </div>

                <div className="hold-nav">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={index === 0}
                    onClick={() => {
                      setDeadline(null);
                      setIndex((i) => Math.max(0, i - 1));
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      markHeld(current.id);
                      advance();
                    }}
                  >
                    Mark held
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={index >= stretches.length - 1}
                    onClick={advance}
                  >
                    Skip
                  </button>
                </div>
              </div>
            </article>

            <div className="finish-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={logRoutine}
                disabled={held.length === 0}
              >
                Log this
              </button>
              <p className="hint finish-note">
                {saved ??
                  (held.length
                    ? `${held.length} of ${stretches.length} held. Log whenever you are done — you do not have to finish the list.`
                    : 'Hold one and it will count. Opening a routine on its own logs nothing.')}
              </p>
            </div>
          </Card>
        ) : (
          <>
            <Card title="Routines" note="Pick one for what you just did, or for how you feel.">
              <div className="routine-grid">
                {ROUTINES.map((r) => (
                  <article className="routine" key={r.id}>
                    <h2 className="routine-title">{r.title}</h2>
                    <p className="routine-meta">
                      {r.minutes} min · {r.stretchIds.length} stretches
                    </p>
                    <p className="routine-areas">
                      {r.areas.map((a) => AREA_LABEL[a]).join(' · ')}
                    </p>
                    <button type="button" className="btn btn-sm" onClick={() => start(r)}>
                      Start
                    </button>
                  </article>
                ))}
              </div>
            </Card>

            <Card title="By area" note="Every stretch in the set, grouped by what it reaches.">
              <nav className="area-rail" aria-label="Body areas">
                {AREA_ORDER.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className="sched-chip"
                    aria-current={browse === a ? 'true' : undefined}
                    onClick={() => setBrowse(browse === a ? null : a)}
                  >
                    <span className="sched-reps">{AREA_LABEL[a]}</span>
                    <span className="sched-meta">{byArea.get(a)?.length ?? 0}</span>
                  </button>
                ))}
              </nav>

              {browse === null ? (
                <Empty emoji="🧘">Pick an area to see its stretches.</Empty>
              ) : (
                <div className="ex-grid">
                  {(byArea.get(browse) ?? []).map((s, i) => (
                    <article className="ex-card" key={s.id}>
                      <ExerciseAnim name={s.name} clip={s} phase={i} />
                      <div className="ex-body">
                        <div className="ex-top">
                          <h3 className="ex-name">{s.name}</h3>
                        </div>
                        <p className="ex-cue">{s.cue}</p>
                        <p className="ex-last">Hold {s.holdSeconds}s</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        <p className="hint">
          Photographs from free-exercise-db, public domain. Stretching is a comfort measure and a
          habit, not a treatment — if something hurts rather than pulls, stop, and see someone
          qualified about it.
        </p>
      </div>
    </>
  );
}
