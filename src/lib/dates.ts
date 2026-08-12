import type { ISODate } from '../types';

/** Local-time ISO day, unlike toISOString() which shifts by the UTC offset. */
export function todayISO(d: Date = new Date()): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: ISODate, delta: number): ISODate {
  const d = parseISO(date);
  d.setDate(d.getDate() + delta);
  return todayISO(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Inclusive list of the last `n` days ending today (oldest first). */
export function lastNDays(n: number, end: ISODate = todayISO()): ISODate[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

export function formatShort(date: ISODate): string {
  return parseISO(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatLong(date: ISODate): string {
  return parseISO(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function relativeLabel(date: ISODate): string {
  const diff = daysBetween(date, todayISO());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return formatShort(date);
}
