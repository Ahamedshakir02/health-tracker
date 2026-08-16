/**
 * Entry point for the public landing page at `/`.
 *
 * Deliberately tiny and React-free: the page is static HTML, so shipping a
 * framework to run a scroll listener would be silly. It also means the landing
 * page shares no bundle with the app — someone reading the marketing copy never
 * downloads Firebase.
 */

// Same self-hosted families as the app, so `font-src 'self'` holds here too.
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/newsreader';

import './landing.css';
import { initAnalytics } from './analytics';
import { initStickyCta } from './stickyCta';

initStickyCta();
initAnalytics();
