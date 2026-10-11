/**
 * Entry point for the public landing page at `/`.
 *
 * Deliberately tiny and React-free: the page is static HTML, so shipping a
 * framework to run a scroll listener would be silly. It also means the landing
 * page shares no bundle with the app — someone reading the marketing copy never
 * downloads Firebase.
 */

// Same self-hosted families as the app, so `font-src 'self'` holds here too.
// The landing page sets no body copy in the number face, so it skips it.
import '@fontsource/baloo-chettan-2/latin-700.css';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-500.css';
import '@fontsource/noto-sans/latin-600.css';
import '@fontsource/noto-sans-mono/latin-400.css';
import '@fontsource/noto-sans-mono/latin-500.css';

import './landing.css';
import { initAnalytics } from './analytics';
import { initStickyCta } from './stickyCta';

initStickyCta();
initAnalytics();
