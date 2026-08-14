import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatShort } from '../lib/dates';
import { Legend } from './ui';

export const SERIES = {
  weight: 'var(--series-1)',
  food: 'var(--series-2)',
  activity: 'var(--series-3)',
  sleep: 'var(--series-4)',
} as const;

// Axis labels are set in the mono face at a small size, matching the design's
// `.axlab` treatment — the tick text reads as a label, not as data.
const AXIS = {
  stroke: 'var(--line)',
  tick: { fill: 'var(--axis)', fontSize: 10, fontFamily: 'var(--mono)' },
};

interface TooltipRow {
  key: string;
  label: string;
  color?: string;
  format: (value: number) => string;
}

/** Shared crosshair tooltip. Values wear text tokens; the swatch carries identity. */
function ChartTooltip({ rows }: { rows: TooltipRow[] }) {
  return function Content(props: {
    active?: boolean;
    label?: string | number;
    payload?: { payload?: Record<string, unknown> }[];
  }) {
    if (!props.active || !props.payload?.length) return null;
    const point = props.payload[0]?.payload as Record<string, unknown> | undefined;
    if (!point) return null;
    return (
      <div className="tooltip">
        <div className="tooltip-title">{formatShort(String(props.label ?? point.date))}</div>
        {rows.map((row) => {
          const raw = point[row.key];
          const value = typeof raw === 'number' ? raw : null;
          return (
            <div className="tooltip-row" key={row.key}>
              <span className="tooltip-key">
                {row.color && (
                  <span
                    className="legend-swatch"
                    style={{ background: row.color }}
                    aria-hidden="true"
                  />
                )}
                {row.label}
              </span>
              <span>{value == null ? '—' : row.format(value)}</span>
            </div>
          );
        })}
      </div>
    );
  };
}

const CURSOR = { stroke: 'var(--line-2)', strokeWidth: 1 };
const BAR_CURSOR = { fill: 'var(--sunken)', opacity: 0.55 };

export interface WeightPoint {
  date: string;
  weightKg: number | null;
  trend: number | null;
}

export function WeightChart({
  data,
  unitLabel,
  convert,
  goal,
}: {
  data: WeightPoint[];
  unitLabel: string;
  convert: (kg: number) => number;
  goal?: number;
}) {
  const fmt = (v: number) => `${convert(v).toFixed(1)} ${unitLabel}`;
  const values = data.flatMap((d) => [d.weightKg, d.trend]).filter((v): v is number => v != null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const pad = Math.max((max - min) * 0.25, 0.5);

  return (
    <>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShort}
              stroke={AXIS.stroke}
              tick={AXIS.tick}
              minTickGap={28}
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tickFormatter={(v: number) => convert(v).toFixed(0)}
              stroke={AXIS.stroke}
              tick={AXIS.tick}
              width={44}
            />
            <Tooltip
              cursor={CURSOR}
              content={ChartTooltip({
                rows: [
                  { key: 'weightKg', label: 'Logged', color: 'var(--text-muted)', format: fmt },
                  { key: 'trend', label: '7-day trend', color: SERIES.weight, format: fmt },
                ],
              })}
            />
            {goal != null && (
              <ReferenceLine
                y={goal}
                stroke="var(--good)"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: 'Goal',
                  position: 'insideTopLeft',
                  fill: 'var(--text-secondary)',
                  fontSize: 11,
                }}
              />
            )}
            {/* Raw readings recede in neutral ink; the trend carries the series
                colour, so the two are never distinguished by hue alone. */}
            <Line
              type="linear"
              dataKey="weightKg"
              stroke="var(--text-muted)"
              strokeWidth={1}
              strokeOpacity={0.4}
              dot={{ r: 2.5, fill: 'var(--text-muted)', stroke: 'var(--surface-1)', strokeWidth: 1 }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="trend"
              stroke={SERIES.weight}
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={[
          { label: 'Logged readings', color: 'var(--text-muted)' },
          { label: '7-day trend', color: SERIES.weight },
        ]}
      />
    </>
  );
}

export interface DailyBarPoint {
  date: string;
  value: number;
}

/** Single-measure daily bars with an optional target line. One series → no legend. */
export function DailyBars({
  data,
  color,
  target,
  targetLabel = 'Target',
  label,
  format,
  height = 200,
}: {
  data: DailyBarPoint[];
  color: string;
  target?: number;
  targetLabel?: string;
  label: string;
  format: (value: number) => string;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -12 }} barGap={2}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShort}
            stroke={AXIS.stroke}
            tick={AXIS.tick}
            minTickGap={22}
          />
          <YAxis stroke={AXIS.stroke} tick={AXIS.tick} width={46} />
          <Tooltip
            cursor={BAR_CURSOR}
            content={ChartTooltip({ rows: [{ key: 'value', label, color, format }] })}
          />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke="var(--text-secondary)"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{
                value: targetLabel,
                position: 'insideTopLeft',
                fill: 'var(--text-secondary)',
                fontSize: 11,
              }}
            />
          )}
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={34}>
            {data.map((point) => (
              <Cell
                key={point.date}
                fill={color}
                fillOpacity={point.value > 0 ? 1 : 0}
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface MacroPoint {
  date: string;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Stacked macro grams per day. 2px surface gap between segments. */
export function MacroStack({ data, height = 200 }: { data: MacroPoint[]; height?: number }) {
  const grams = (v: number) => `${Math.round(v)} g`;
  return (
    <>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShort}
              stroke={AXIS.stroke}
              tick={AXIS.tick}
              minTickGap={22}
            />
            <YAxis stroke={AXIS.stroke} tick={AXIS.tick} width={40} />
            <Tooltip
              cursor={BAR_CURSOR}
              content={ChartTooltip({
                rows: [
                  { key: 'proteinG', label: 'Protein', color: SERIES.weight, format: grams },
                  { key: 'carbsG', label: 'Carbs', color: SERIES.food, format: grams },
                  { key: 'fatG', label: 'Fat', color: SERIES.sleep, format: grams },
                ],
              })}
            />
            <Bar
              dataKey="proteinG"
              stackId="m"
              fill={SERIES.weight}
              stroke="var(--surface-1)"
              strokeWidth={2}
              isAnimationActive={false}
              maxBarSize={34}
            />
            <Bar
              dataKey="carbsG"
              stackId="m"
              fill={SERIES.food}
              stroke="var(--surface-1)"
              strokeWidth={2}
              isAnimationActive={false}
              maxBarSize={34}
            />
            <Bar
              dataKey="fatG"
              stackId="m"
              fill={SERIES.sleep}
              stroke="var(--surface-1)"
              strokeWidth={2}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              maxBarSize={34}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={[
          { label: 'Protein', color: SERIES.weight },
          { label: 'Carbs', color: SERIES.food },
          { label: 'Fat', color: SERIES.sleep },
        ]}
      />
    </>
  );
}

export function SleepArea({
  data,
  target,
  height = 200,
}: {
  data: { date: string; value: number | null }[];
  target: number;
  height?: number;
}) {
  const hours = (v: number) => `${v.toFixed(1)} h`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.sleep} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SERIES.sleep} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShort}
            stroke={AXIS.stroke}
            tick={AXIS.tick}
            minTickGap={22}
          />
          <YAxis stroke={AXIS.stroke} tick={AXIS.tick} width={38} domain={[0, 'dataMax + 1']} />
          <Tooltip
            cursor={CURSOR}
            content={ChartTooltip({
              rows: [{ key: 'value', label: 'Sleep', color: SERIES.sleep, format: hours }],
            })}
          />
          <ReferenceLine
            y={target}
            stroke="var(--text-secondary)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{
              value: 'Target',
              position: 'insideTopLeft',
              fill: 'var(--text-secondary)',
              fontSize: 11,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={SERIES.sleep}
            strokeWidth={2.5}
            fill="url(#sleepFill)"
            dot={{ r: 3, fill: SERIES.sleep, stroke: 'var(--surface-1)', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
