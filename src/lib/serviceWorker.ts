/**
 * Registers the worker that lets the installed app open with no signal
 * (src/sw/sw.js). Production builds only: in `npm run dev` the files it would
 * cache do not exist, and a worker left over from a build would serve stale
 * modules over the dev server's.
 *
 * Scoped to /app so the public landing page is never controlled by it.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // After load, so installing it (which downloads every section) never
  // competes with the first paint.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/app' }).catch((err: unknown) => {
      // The app works without it, just not offline.
      console.warn('Vitals: offline support is unavailable.', err);
    });
  });
}
