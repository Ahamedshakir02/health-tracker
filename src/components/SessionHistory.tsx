import { formatShort, relativeLabel } from '../lib/dates';
import { describeSets, sortSessions } from '../lib/session';
import type { WorkoutSession } from '../types';

/**
 * Training sessions, newest first, each expanding to the sets logged.
 *
 * This is the payoff for storing sessions at all: the workout table above it
 * records that you trained for fifty minutes, which tells you nothing about
 * whether you are getting stronger. `<details>` does the expanding — it is
 * keyboard-operable and screen-reader-announced without a line of state.
 */
export default function SessionHistory({
  sessions,
  unitLabel,
  convert,
  onDelete,
  limit = 40,
}: {
  sessions: WorkoutSession[];
  unitLabel: string;
  convert: (kg: number) => number;
  onDelete: (session: WorkoutSession) => void;
  limit?: number;
}) {
  return (
    <ul className="sess-list">
      {sortSessions(sessions)
        .slice(0, limit)
        .map((s) => {
          const title = s.kind === 'strength' ? s.focus : s.title;
          const sets =
            s.kind === 'strength' ? s.exercises.reduce((n, e) => n + e.sets.length, 0) : 0;
          const sub =
            s.kind === 'strength'
              ? `Schedule ${s.scheduleId} · Day ${s.day} · ${s.exercises.length} exercises · ${sets} sets`
              : `${s.moves.length} stretches`;
          return (
            <li className="sess" key={s.id}>
              <details>
                <summary className="sess-hd">
                  <span className="sess-when">{relativeLabel(s.date)}</span>
                  <span className="sess-title">{title}</span>
                  <span className="sess-meta">
                    {sub}
                    {s.durationMin ? ` · ${s.durationMin} min` : ''}
                  </span>
                </summary>

                <div className="sess-body">
                  {s.kind === 'strength' ? (
                    <table className="sess-table">
                      <tbody>
                        {s.exercises.map((e, i) => (
                          <tr key={`${e.key}-${i}`}>
                            <td className="cell-main">{e.name}</td>
                            <td className="sess-sec">{e.section}</td>
                            <td className="num">{describeSets(e.sets, unitLabel, convert)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="hint">
                      {s.moves.map((m) => `${m.name} ${m.seconds}s`).join(' · ') || 'No holds logged.'}
                    </p>
                  )}

                  {s.kind === 'strength' && s.cooldown?.length ? (
                    <p className="hint">
                      Cool-down: {s.cooldown.map((m) => m.name).join(', ')}
                    </p>
                  ) : null}

                  <div className="sess-foot">
                    <span className="hint">Logged {formatShort(s.date)}</span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onDelete(s)}
                      aria-label={`Delete session on ${s.date}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
    </ul>
  );
}
