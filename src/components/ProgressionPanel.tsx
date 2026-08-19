import { lazy, Suspense } from 'react';
import type { ProgressPoint } from '../lib/session';

/**
 * The progression chart, loaded only when someone opens one.
 *
 * Recharts is the largest dependency in the bundle by a wide margin, and the
 * Trainer is the one page you use standing in a gym on a phone connection. A
 * static import here would drag the whole charting library into that first
 * load for a panel most sessions never open.
 */
const ProgressionChart = lazy(() =>
  import('./charts').then((m) => ({ default: m.ProgressionChart })),
);

export default function ProgressionPanel({
  points,
  unitLabel,
  convert,
}: {
  points: ProgressPoint[];
  unitLabel: string;
  convert: (kg: number) => number;
}) {
  // One point is a dot, not a trend. Say so rather than drawing a chart that
  // implies a line through a single reading.
  if (points.length < 2) {
    return <p className="hint">One session logged so far — the chart needs two to show a line.</p>;
  }
  return (
    <Suspense fallback={<div className="chart-loading">Loading chart…</div>}>
      <ProgressionChart data={points} unitLabel={unitLabel} convert={convert} />
    </Suspense>
  );
}
