/* eslint-disable no-restricted-globals */
/**
 * The service worker behind /app. Its one job is that the installed app opens
 * with no signal, because the gym basement is where it gets used most.
 *
 * This is the template. The build fills in the two placeholders below with the
 * deploy's own file list and version (scripts/sw-plugin.ts) and writes the
 * result to dist/sw.js. In `npm run dev` nothing registers it.
 *
 * Three rules, one per kind of request:
 *
 * - The shell (/app and anything under it) is network first. Hosting serves it
 *   `no-cache, must-revalidate` so a deploy is picked up on the next open; a
 *   cache-first shell here would undo that and leave a phone on last week's
 *   bundle. The cached copy is only for when the network does not answer.
 * - /assets/** is content-hashed and immutable, so it is cache first. Every
 *   file the app can load is put in the cache at install, lazy sections too,
 *   or a section never opened online would fail to open offline.
 * - /exercise-anim/** is immutable as well, but 6 MB, so it is cached as each
 *   clip is first seen rather than all at install.
 *
 * Firebase's own requests are cross-origin and never touched: Firestore keeps
 * its own offline cache and write queue (lib/firebase.ts).
 */

const VERSION = self.__VERSION__;
const PRECACHE = self.__PRECACHE__;

const SHELL_CACHE = `vitals-shell-${VERSION}`;
// Named without the version: clip filenames are content hashes, so one cached
// under an old deploy is still correct under the next.
const ANIM_CACHE = 'vitals-anim';
const SHELL = '/app';
// How long a navigation waits on the network before opening the cached shell.
// Long enough for slow gym wifi to win, short enough that one bar of signal
// does not leave a blank screen.
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // `reload` skips the HTTP cache, so a shell left over in it from an
      // earlier deploy is never what gets stored.
      await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('vitals-shell-') && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (url.pathname === SHELL || url.pathname.startsWith(`${SHELL}/`)) {
      event.respondWith(shell(request));
    }
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  } else if (url.pathname.startsWith('/exercise-anim/')) {
    event.respondWith(cacheFirst(request, ANIM_CACHE));
  } else if (PRECACHE.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

async function shell(request) {
  const cache = await caches.open(SHELL_CACHE);
  const network = fetch(request).then((response) => {
    // Every path under /app is the same document, so one copy is kept under
    // /app whichever path fetched it.
    if (response.ok) cache.put(SHELL, response.clone());
    return response;
  });
  // If the timeout wins, a later network failure has nobody waiting on it.
  network.catch(() => {});

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, NETWORK_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([network, timeout]);
    if (response) return response;
  } catch {
    // Offline: fall through to the cached copy.
  } finally {
    clearTimeout(timer);
  }

  const cached = await cache.match(SHELL);
  // Nothing cached yet means the first visit is the one with no signal; let
  // the network's own answer, or its error page, through.
  return cached ?? network;
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}
