/**
 * Cookieless analytics for the public landing page.
 *
 * Three rules this follows, in order of how much they matter:
 *
 * 1. **Landing page only.** The signed-in app under /app loads no analytics at
 *    all. Page-view counts for a marketing page are a reasonable thing to want;
 *    behavioural data about someone's health log is not.
 * 2. **No cookies, no storage.** Nothing is written to the device, which is why
 *    there is no consent banner on this site — under GDPR/ePrivacy the banner
 *    exists to get consent for storing or reading data on your device, and this
 *    stores nothing. Swapping in a provider that sets a cookie or an ID in
 *    localStorage breaks that reasoning and *would* require a banner.
 * 3. **Off unless configured.** With no VITE_ANALYTICS_SRC the page makes zero
 *    third-party requests, which is also the default for anyone who clones this
 *    repo.
 *
 * To turn it on, point VITE_ANALYTICS_SRC at a privacy-first, cookieless
 * counter — Plausible and Umami are the obvious two, self-hosted or otherwise —
 * set VITE_ANALYTICS_SITE to the site identifier it expects, and add that host
 * to `script-src`/`connect-src` in the CSP block in index.html. The CSP is
 * deliberately not pre-widened: an origin listed there but unused is an open
 * door with nothing behind it.
 */

/** Honours Do Not Track and Global Privacy Control before anything loads. */
function optedOut(): boolean {
  const nav = navigator as Navigator & { doNotTrack?: string; globalPrivacyControl?: boolean };
  return (
    nav.doNotTrack === '1' ||
    (window as Window & { doNotTrack?: string }).doNotTrack === '1' ||
    nav.globalPrivacyControl === true
  );
}

export function initAnalytics(): void {
  const src = import.meta.env.VITE_ANALYTICS_SRC;
  const site = import.meta.env.VITE_ANALYTICS_SITE;

  // Unconfigured is the default and the happy path: nothing loads.
  if (!src || optedOut()) return;

  const tag = document.createElement('script');
  tag.src = src;
  tag.defer = true;
  // Plausible reads data-domain; Umami reads data-website-id. Setting both is
  // harmless — each ignores the attribute it doesn't know about.
  if (site) {
    tag.dataset.domain = site;
    tag.dataset.websiteId = site;
  }
  document.head.appendChild(tag);
}
