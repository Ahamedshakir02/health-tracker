import { useEffect, useRef, useState } from 'react';
import { useHealth } from '../state/HealthProvider';
import { IconPlus } from './icons';
import { TRAINING_PLAN } from '../data/trainingPlan';
import { addWater, byDate, dayLog, latestWeight, sumMacros } from '../lib/calc';
import { todayISO } from '../lib/dates';
import { nextDay } from '../lib/programme';
import { labels, round, toDisplay } from '../lib/units';

/** The two amounts worth a button of their own: a glass and a bottle. */
const WATER_ML = [250, 500];

type Destination = 'trainer' | 'food' | 'body' | 'daily' | 'movement';

/**
 * The phone's "+" button and the sheet behind it.
 *
 * On a phone the thing you came to do is usually one tap of logging, and it is
 * rarely on the page you happen to be looking at. The sheet is that shortcut:
 * four ways into a page, water logged in place because it needs no other
 * field, and the day's training at the bottom where the thumb already is.
 *
 * It is a native <dialog> opened with showModal(), which is what gives it a
 * focus trap, Escape to close, and an inert page behind it without any of
 * that being written here.
 */
export default function QuickLog({ onNavigate }: { onNavigate: (id: Destination) => void }) {
  const { data, update } = useHealth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // showModal() rather than the `open` attribute: only the method makes the
  // rest of the page inert and puts the dialog in the top layer.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const { units, goals, programme } = data.settings;
  const u = labels(units);
  const today = todayISO();
  const log = dayLog(data.days, today);
  const eaten = sumMacros(data.meals.filter(byDate(today))).calories;
  const left = goals.calories - eaten;
  const latest = latestWeight(data.weights);
  const showVolume = (ml: number) => round(toDisplay('volume', ml, units), 0);

  const schedule = programme && TRAINING_PLAN.find((s) => s.id === programme.scheduleId);
  const upNext = schedule
    ? schedule.days.find((d) => d.n === nextDay(schedule, data.sessions, programme))
    : undefined;

  const go = (id: Destination) => {
    setOpen(false);
    onNavigate(id);
  };

  const links: { id: Destination; title: string; note: string }[] = [
    {
      id: 'food',
      title: 'Meal',
      note: goals.calories
        ? `${Math.abs(Math.round(left)).toLocaleString()} kcal ${left >= 0 ? 'left' : 'over'}`
        : `${Math.round(eaten).toLocaleString()} kcal today`,
    },
    {
      id: 'body',
      title: 'Weight',
      note: latest
        ? `${toDisplay('weight', latest.weightKg, units).toFixed(1)} ${u.weight} last`
        : 'No readings yet',
    },
    {
      id: 'daily',
      title: 'Sleep and mood',
      note: log.sleepHours != null ? `${log.sleepHours.toFixed(1)} h last night` : 'Not logged',
    },
    { id: 'movement', title: 'Other workout', note: 'A run, a swim, a game' },
  ];

  return (
    <>
      <button
        type="button"
        className="fab"
        onClick={() => setOpen(true)}
        aria-label="Quick log"
        aria-haspopup="dialog"
      >
        <IconPlus />
      </button>

      <dialog
        ref={dialog}
        className="sheet"
        aria-labelledby="quicklog-title"
        onClose={() => setOpen(false)}
        // A click that lands on the dialog element itself is a click on the
        // backdrop: everything visible is inside .sheet-body.
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="sheet-body">
          <div className="sheet-hd">
            <h2 id="quicklog-title" className="sheet-title">
              Log something
            </h2>
            <button type="button" className="btn btn-icon" onClick={() => setOpen(false)}>
              <span aria-hidden="true">✕</span>
              <span className="sr-only">Close</span>
            </button>
          </div>

          <div className="sheet-grid">
            {links.map((link) => (
              <button
                key={link.id}
                type="button"
                className="sheet-tile"
                onClick={() => go(link.id)}
              >
                <strong>{link.title}</strong>
                <span>{link.note}</span>
              </button>
            ))}
          </div>

          <div className="sheet-row">
            <div className="sheet-row-text">
              <strong>Water</strong>
              <span>
                {showVolume(log.waterMl ?? 0).toLocaleString()} of{' '}
                {showVolume(goals.waterMl).toLocaleString()} {u.volume}
              </span>
            </div>
            {WATER_ML.map((ml) => (
              <button
                key={ml}
                type="button"
                className="btn"
                onClick={() => update('days', (days) => addWater(days, today, ml))}
                aria-label={`Add ${showVolume(ml)} ${u.volume} of water`}
              >
                +{showVolume(ml)}
              </button>
            ))}
          </div>

          <button type="button" className="btn btn-primary sheet-train" onClick={() => go('trainer')}>
            {schedule && upNext ? `Day ${upNext.n} — ${upNext.focus}` : 'Open Train'}
          </button>
        </div>
      </dialog>
    </>
  );
}
