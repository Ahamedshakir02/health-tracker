/**
 * Rest between sets.
 *
 * The countdown is derived from a wall-clock deadline, never from a counter
 * that a `setInterval` decrements. Browsers throttle timers in a backgrounded
 * tab — to once a minute, on a phone with the screen off — so a decrementing
 * counter would show two minutes remaining after five real minutes had passed.
 * Storing the deadline and subtracting `Date.now()` is correct whatever the
 * browser does with the ticks in between.
 */

/** When a rest started now would finish. */
export function endsAt(startedAtMs: number, seconds: number): number {
  return startedAtMs + Math.max(0, seconds) * 1000;
}

/** Whole seconds left, never negative. */
export function remainingSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/** "1:30". Minutes are not padded; seconds always are. */
export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 0 turns the timer off entirely, so it has to be distinguishable from unset. */
export function restEnabled(seconds: number | undefined): boolean {
  return typeof seconds === 'number' && seconds > 0;
}
