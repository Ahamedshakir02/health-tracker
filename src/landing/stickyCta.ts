/**
 * The sticky call to action on phones.
 *
 * It appears only once the hero button has scrolled out of view. A sticky bar
 * that duplicates a button already on screen is just clutter covering the
 * content, and on a short phone viewport it would cover the hero itself.
 *
 * Everything is driven by an IntersectionObserver on the hero CTA rather than a
 * scroll handler, so nothing runs on the main thread while you scroll. If the
 * observer isn't available the bar simply stays hidden — the page has three
 * other links to the app.
 */
export function initStickyCta(): void {
  const bar = document.getElementById('sticky-cta');
  const heroCta = document.querySelector('[data-cta="hero-primary"]');
  if (!bar || !heroCta || typeof IntersectionObserver === 'undefined') return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      const show = !entry.isIntersecting;
      bar.hidden = !show;
      // Separate class from `hidden` so the bar can transition in; toggling
      // `hidden` alone would snap it on with no animation.
      bar.classList.toggle('is-shown', show);
    },
    { threshold: 0 },
  );

  observer.observe(heroCta);
}
