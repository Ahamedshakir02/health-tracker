import type { ReactNode } from 'react';

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
  children,
  className = '',
}: {
  title?: string;
  note?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {note && <p className="card-note">{note}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  unit,
  foot,
  color,
  progress,
}: {
  label: string;
  value: string;
  unit?: string;
  foot?: ReactNode;
  color?: string;
  /** 0–1; renders a meter under the value when present. */
  progress?: number | null;
}) {
  const percent = meterPercent(progress);
  return (
    <div className="stat">
      <div className="stat-label">
        {color && <span className="stat-dot" style={{ background: color }} aria-hidden="true" />}
        {label}
      </div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {percent != null && (
        <div
          className="meter"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} progress`}
        >
          <div
            className="meter-fill"
            style={{
              width: `${percent}%`,
              background: color ?? 'var(--accent)',
            }}
          />
        </div>
      )}
      {foot && <div className="stat-foot">{foot}</div>}
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
  status?: 'good' | 'warning' | 'serious' | 'critical';
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
