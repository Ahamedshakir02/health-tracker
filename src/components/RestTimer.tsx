import { useEffect, useRef, useState } from 'react';
import { beep } from '../lib/beep';
import { formatRest, remainingSeconds } from '../lib/rest';

/**
 * The rest countdown, pinned to the foot of the Trainer while it runs.
 *
 * It reads `Date.now()` on every tick rather than counting down, so a tab that
 * was backgrounded — or a phone that locked — comes back showing the truth.
 * The interval only decides how often the number is repainted, not what it says.
 */
export default function RestTimer({
  deadline,
  total,
  sound,
  onDismiss,
  onAdd,
}: {
  deadline: number;
  total: number;
  sound: boolean;
  onDismiss: () => void;
  onAdd: (seconds: number) => void;
}) {
  const [left, setLeft] = useState(() => remainingSeconds(deadline, Date.now()));
  const sounded = useRef(false);

  useEffect(() => {
    sounded.current = false;
    setLeft(remainingSeconds(deadline, Date.now()));
    const id = window.setInterval(() => {
      setLeft(remainingSeconds(deadline, Date.now()));
    }, 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  useEffect(() => {
    if (left > 0 || sounded.current) return;
    sounded.current = true;
    if (sound) beep();
  }, [left, sound]);

  const done = left === 0;
  const pct = total > 0 ? Math.min(100, Math.round(((total - left) / total) * 100)) : 100;

  return (
    <div className={`rest${done ? ' is-done' : ''}`} role="status">
      <div className="rest-track" aria-hidden="true">
        <div className="rest-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="rest-row">
        {/* Announced once, at the end. A live countdown would have a screen
            reader speaking over every second of the rest. */}
        <span className="rest-time" aria-hidden="true">
          {formatRest(left)}
        </span>
        <span className="rest-label">{done ? 'Rest over — next set.' : 'Resting'}</span>
        <button type="button" className="btn btn-sm" onClick={() => onAdd(30)}>
          +30s
        </button>
        <button type="button" className="btn btn-sm" onClick={onDismiss}>
          {done ? 'Dismiss' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
