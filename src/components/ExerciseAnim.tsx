import { useEffect, useRef, useState } from 'react';
import { clipFor } from '../data/exerciseMedia';

/**
 * The animated demonstration on an exercise card.
 *
 * free-exercise-db gives two photographs per movement — the start and the
 * finish — so the "animation" is a cross-fade between them rather than a video
 * or a GIF. That is deliberate: two WebP stills are ~30 KB against ~1 MB for
 * the equivalent GIF, and the browser handles the loop, so nothing has to be
 * decoded frame by frame on a phone mid-workout.
 *
 * A card only animates while it is on screen. The global
 * `prefers-reduced-motion` rule in styles.css stops the loop, which leaves the
 * start frame showing — a still photo of the movement, which is the sensible
 * degraded state.
 */

/** One observer for every card on the page, rather than one per card. */
let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, (visible: boolean) => void>();

function watch(el: Element, onChange: (visible: boolean) => void): () => void {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) callbacks.get(entry.target)?.(entry.isIntersecting);
      },
      // Start the loop just before the card is scrolled into view.
      { rootMargin: '100px 0px' },
    );
  }
  callbacks.set(el, onChange);
  observer.observe(el);
  return () => {
    observer?.unobserve(el);
    callbacks.delete(el);
  };
}

interface Props {
  /** The book's exercise name, used to look up the clip and to caption it. */
  name: string;
  /**
   * A clip supplied directly, for media that is not in the exercise manifest —
   * the stretch set, which lives in its own generated file but has the same
   * two-frame shape. Given one, the name lookup is skipped.
   */
  clip?: { a: string; b: string } | null;
  /**
   * Offsets the loop so a grid of cards doesn't pulse in lockstep. Any stable
   * per-card number works; the position in the day is the obvious one.
   */
  phase?: number;
}

export default function ExerciseAnim({ name, clip: given, phase = 0 }: Props) {
  const clip = given ?? clipFor(name);
  const ref = useRef<HTMLElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setLive(true);
      return;
    }
    return watch(el, setLive);
  }, []);

  // A name with no mapped clip renders nothing rather than an empty grey box.
  if (!clip) return null;

  const base = `${import.meta.env.BASE_URL}exercise-anim/`;

  return (
    <figure
      ref={ref}
      className={`ex-fig${live ? ' is-live' : ''}`}
      style={{ '--clip-phase': `-${(phase % 5) * 320}ms` } as React.CSSProperties}
    >
      <img
        className="ex-frame"
        src={`${base}${clip.a}`}
        alt={`${name} — start position`}
        loading="lazy"
        decoding="async"
      />
      <img
        className="ex-frame ex-frame-end"
        src={`${base}${clip.b}`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
    </figure>
  );
}
