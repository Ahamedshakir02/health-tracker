/**
 * Builds dist/sw.js from src/sw/sw.js.
 *
 * The worker has to know every file the app can load, so the whole app can be
 * put in the cache at install. Those names are content hashes that only exist
 * once the bundle does, so this runs at the end of the build: it walks out
 * from the app entry through every static and lazy import, collects each
 * chunk's JS, CSS and the fonts the CSS pulls in, and writes the list into the
 * worker. The landing page's chunks are not reachable from the app entry, so
 * they stay out.
 *
 * The version is a hash of that list, so a deploy that changes any file gets a
 * new cache and the old one is cleared; a deploy that changes nothing keeps it.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** The parts of a bundle entry this reads. Rolldown's output types satisfy it. */
export interface BundleItem {
  type: 'chunk' | 'asset';
  fileName: string;
  name?: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  viteMetadata?: { importedCss: Set<string>; importedAssets: Set<string> };
}

/**
 * Files outside the bundle that the shell needs: the document itself (stored
 * under /app, which the worker serves for every path under it), and the icons
 * and manifest that app.html links.
 */
export const SHELL_FILES = [
  '/app',
  '/site.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
];

/** Every bundle file reachable from the named entry, as root-relative URLs. */
export function precacheUrls(bundle: Record<string, BundleItem>, entryName: string): string[] {
  const entry = Object.values(bundle).find(
    (item) => item.type === 'chunk' && item.isEntry && item.name === entryName,
  );
  if (!entry) throw new Error(`sw-plugin: no entry chunk named "${entryName}" in the bundle`);

  const files = new Set<string>();
  const seen = new Set<string>();
  const queue = [entry.fileName];

  while (queue.length) {
    const fileName = queue.pop()!;
    if (seen.has(fileName)) continue;
    seen.add(fileName);

    const chunk = bundle[fileName];
    if (!chunk || chunk.type !== 'chunk') continue;

    files.add(fileName);
    chunk.viteMetadata?.importedCss.forEach((f) => files.add(f));
    chunk.viteMetadata?.importedAssets.forEach((f) => files.add(f));
    queue.push(...(chunk.imports ?? []), ...(chunk.dynamicImports ?? []));
  }

  return [...files]
    // Every browser that can install the app reads woff2; the woff beside it
    // in the CSS is a fallback none of them will ever fetch.
    .filter((f) => !f.endsWith('.woff'))
    .sort()
    .map((f) => `/${f}`);
}

/** Fills the template's two placeholders. */
export function renderWorker(template: string, urls: string[]): string {
  const version = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12);
  return template
    .replace('self.__VERSION__', JSON.stringify(version))
    .replace('self.__PRECACHE__', JSON.stringify(urls));
}

export default function serviceWorker(entryName = 'app'): Plugin {
  return {
    name: 'vitals-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const template = readFileSync(resolve(import.meta.dirname, '../src/sw/sw.js'), 'utf8');
      const urls = [...SHELL_FILES, ...precacheUrls(bundle as Record<string, BundleItem>, entryName)];
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: renderWorker(template, urls) });
    },
  };
}
