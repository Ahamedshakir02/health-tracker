import type { ReactNode } from 'react';
import { IconAlert, IconCheck, IconMinus } from './icons';

/**
 * A 0–1 fraction as a whole percentage clamped to 0–100, or null when there is
 * nothing meaningful to draw. Guards the case where a goal has been set to zero:
 * `logged / 0` is Infinity (or NaN at 0/0), which renders as `width: NaN%` and
 * an `aria-valuenow="Infinity"` that screen readers announce as gibberish.
 */
export function meterPercent(progress: number | null | undefined): number | null {
  if (progress == null || !Number.isFinite(progress)) return null;
  return Math.round(Math.min(100, Math.max(0, progress * 100)));
}

export function Card({
  title,
  note,
  action,
  footer,
  children,
  className = '',
}: {
  title?: string;
  note?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-hd">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {note && <p className="card-note">{note}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="card-bd">{children}</div>
      {footer && <div className="card-ft">{footer}</div>}
    </section>
  );
}

/**
 * Goal states for a stat tile's meter. The design requires the state to be
 * legible without colour, so each one carries a word and (where it matters) an
 * icon rather than relying on the fill colour alone.
 */
type GoalState = { key: string; label: string; icon: ReactNode | null };

function goalState(percentRaw: number, overIsBad: boolean): GoalState {
  if (percentRaw > 105) {
    return overIsBad
      ? { key: 'st-over', label: 'Over', icon: <IconAlert /> }
      : { key: 'st-good', label: 'Done', icon: <IconCheck /> };
  }
  if (percentRaw >= 90) return { key: 'st-at', label: 'On track', icon: <IconCheck /> };
  return { key: 'st-under', label: 'Under', icon: <IconMinus /> };
}

export function StatTile({
  label,
  value,
  unit,
  foot,
  color,
  progress,
  icon,
  overIsBad = false,
}: {
  label: string;
  value: string;
  unit?: string;
  foot?: ReactNode;
  color?: string;
  /** 0–1; renders a meter under the value when present. */
  progress?: number | null;
  icon?: ReactNode;
  /** True where exceeding the goal is a miss (calories) rather than a win. */
  overIsBad?: boolean;
}) {
  const percent = meterPercent(progress);
  // The clamped percent drives the bar; the raw one decides the state, so going
  // 40% over a goal still reads as "Over" and not as a full bar at 100%.
  const raw = progress != null && Number.isFinite(progress) ? progress * 100 : null;
  const state = raw != null ? goalState(raw, overIsBad) : null;

  // Not every tile has a measurement to show. A sentence ("Not enough readings")
  // set at the 44px numeral size wraps to three lines and wrecks the tile, and a
  // bare em dash at that size reads as a drawn rule rather than as "no data".
  const isEmpty = value.trim() === '—';
  const isText = !isEmpty && !/\d/.test(value);
  const valueClass = `stat-value${isEmpty ? ' stat-value-empty' : isText ? ' stat-value-text' : ''}`;

  return (
    <div className="stat">
      {color && <span className="stat-accent" style={{ background: color }} aria-hidden="true" />}
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon}
      </div>
      <div className={valueClass}>
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {foot && <div className="stat-foot">{foot}</div>}
      <div className="meter">
        {percent != null && (
          <div
            className="meter-track"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label} progress`}
          >
            <div
              className={`meter-fill${state?.key === 'st-over' ? ' over' : ''}`}
              style={{
                width: `${percent}%`,
                background: state?.key === 'st-over' ? undefined : (color ?? 'var(--accent)'),
              }}
            />
          </div>
        )}
        <div className="meter-cap">
          {state ? (
            <span className={`meter-state ${state.key}`}>
              {state.icon}
              {state.label}
            </span>
          ) : (
            <span className="meter-state st-under">No goal</span>
          )}
          {percent != null && <span>{percent}%</span>}
        </div>
      </div>
    </div>
  );
}

export function Empty({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-emoji" aria-hidden="true">
        {emoji}
      </span>
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Rating({
  value,
  onChange,
  faces,
  ariaLabel,
}: {
  value?: number;
  onChange: (value: number) => void;
  faces: string[];
  ariaLabel: string;
}) {
  return (
    <div className="rating" role="group" aria-label={ariaLabel}>
      {faces.map((face, i) => {
        const score = i + 1;
        return (
          <button
            key={score}
            type="button"
            aria-pressed={value === score}
            aria-label={`${ariaLabel}: ${score} of ${faces.length}`}
            onClick={() => onChange(score)}
          >
            {face}
          </button>
        );
      })}
    </div>
  );
}

export function Pill({
  status,
  children,
}: {
  status?: 'good' | 'warning' | 'serious' | 'critical' | 'accent';
  children: ReactNode;
}) {
  return (
    <span className={`pill ${status ?? ''}`}>
      {status && <span className="pill-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <span className="legend-item" key={item.label}>
          <span className="legend-swatch" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}
