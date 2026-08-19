/**
 * Per-section document title and description.
 *
 * The tracker is one HTML document with hash routing, so nothing updates the
 * title on its own — every section would otherwise read "Vitals · Health
 * Tracker" in the tab strip, in the history menu, and in a bookmark. This is
 * for people with fifteen tabs open, not for search engines: /app is noindex,
 * and the description here never reaches a crawler.
 */

export interface PageMeta {
  /** Appended with the site name to form the document title. */
  title: string;
  description: string;
}

const SITE = 'Vitals';

export const PAGE_META: Record<string, PageMeta> = {
  dashboard: {
    title: 'Today',
    description: 'Your headline numbers, weight trend and everything logged this week.',
  },
  trainer: {
    title: 'Trainer',
    description: 'The gym schedule book — pick a day, tick sets off, record what you lifted.',
  },
  mobility: {
    title: 'Mobility',
    description: 'Stretch routines by body area, with a guided hold timer.',
  },
  body: {
    title: 'Body',
    description: 'Weight, body fat and measurements, with a trend chart against your goal.',
  },
  food: {
    title: 'Food',
    description: 'Meals by slot with calories and macros against your daily targets.',
  },
  movement: {
    title: 'Move',
    description: 'Workouts, steps and active minutes.',
  },
  daily: {
    title: 'Habits',
    description: 'Sleep, water, mood and the small daily things.',
  },
  settings: {
    title: 'Settings',
    description: 'Units, targets, theme, and exporting or clearing your data.',
  },
};

const NOT_FOUND: PageMeta = {
  title: 'Page not found',
  description: 'That section does not exist.',
};

/**
 * Writes the title and description into the document. Called on every route
 * change; creates the meta tag if the document somehow lacks one.
 */
export function applyPageMeta(tab: string | null): void {
  const meta = (tab && PAGE_META[tab]) || NOT_FOUND;

  document.title = `${meta.title} · ${SITE}`;

  let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'description';
    document.head.appendChild(tag);
  }
  tag.content = meta.description;
}
