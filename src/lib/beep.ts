/**
 * The end-of-rest tone.
 *
 * Synthesised rather than played from a file: it is two hundred milliseconds of
 * sine wave, and shipping an audio asset for it would cost a request and a
 * cache entry for nothing.
 *
 * The AudioContext has to be created — and resumed — inside a user gesture, or
 * mobile Safari and Chrome both start it suspended and every later beep is
 * silent with no error. `prime()` is called from the tap that starts the rest,
 * which is the gesture.
 */

let ctx: AudioContext | null = null;

type Ctor = typeof AudioContext;

function constructor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Call from inside a user gesture. Safe to call repeatedly. */
export function prime(): void {
  try {
    const Ctor = constructor();
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    // No audio available. The timer is still perfectly usable in silence.
  }
}

export function beep(): void {
  try {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    // Ramped rather than switched: an instant stop is a click, which is
    // unpleasant on earphones and reads as a fault.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Never let a missing tone break a workout.
  }
}
