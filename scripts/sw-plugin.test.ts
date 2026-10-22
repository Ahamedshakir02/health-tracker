import { describe, expect, it } from 'vitest';
import { precacheUrls, renderWorker, type BundleItem } from './sw-plugin';

function chunk(fileName: string, extra: Partial<BundleItem> = {}): BundleItem {
  return {
    type: 'chunk',
    fileName,
    imports: [],
    dynamicImports: [],
    viteMetadata: { importedCss: new Set(), importedAssets: new Set() },
    ...extra,
  };
}

function bundleOf(...items: BundleItem[]): Record<string, BundleItem> {
  return Object.fromEntries(items.map((item) => [item.fileName, item]));
}

describe('precacheUrls', () => {
  const bundle = bundleOf(
    chunk('assets/app-1.js', {
      name: 'app',
      isEntry: true,
      imports: ['assets/firebase-2.js'],
      dynamicImports: ['assets/Trainer-3.js'],
      viteMetadata: {
        importedCss: new Set(['assets/app-1.css']),
        importedAssets: new Set(['assets/noto-4.woff2', 'assets/noto-4.woff']),
      },
    }),
    chunk('assets/firebase-2.js'),
    chunk('assets/Trainer-3.js', { imports: ['assets/firebase-2.js', 'assets/wakeLock-5.js'] }),
    chunk('assets/wakeLock-5.js'),
    chunk('assets/landing-6.js', { name: 'landing', isEntry: true }),
    { type: 'asset', fileName: 'assets/app-1.css' },
  );

  it('follows static and lazy imports out from the entry', () => {
    const urls = precacheUrls(bundle, 'app');
    expect(urls).toContain('/assets/firebase-2.js');
    expect(urls).toContain('/assets/Trainer-3.js');
    // Reached only through a lazy section's own import.
    expect(urls).toContain('/assets/wakeLock-5.js');
  });

  it("takes each chunk's CSS and fonts, but not the woff fallback", () => {
    const urls = precacheUrls(bundle, 'app');
    expect(urls).toContain('/assets/app-1.css');
    expect(urls).toContain('/assets/noto-4.woff2');
    expect(urls).not.toContain('/assets/noto-4.woff');
  });

  it('leaves out the landing page', () => {
    expect(precacheUrls(bundle, 'app')).not.toContain('/assets/landing-6.js');
  });

  it('lists each file once, in a stable order', () => {
    const urls = precacheUrls(bundle, 'app');
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toEqual([...urls].sort());
  });

  it('fails the build when the entry is missing', () => {
    expect(() => precacheUrls(bundle, 'nope')).toThrow(/no entry chunk named "nope"/);
  });
});

describe('renderWorker', () => {
  const template = 'const VERSION = self.__VERSION__;\nconst PRECACHE = self.__PRECACHE__;';

  it('writes the list and a version into the template', () => {
    const out = renderWorker(template, ['/app', '/assets/a.js']);
    expect(out).toContain('const PRECACHE = ["/app","/assets/a.js"];');
    expect(out).toMatch(/const VERSION = "[0-9a-f]{12}";/);
  });

  it('changes the version only when the list changes', () => {
    const a = renderWorker(template, ['/assets/a.js']);
    expect(renderWorker(template, ['/assets/a.js'])).toBe(a);
    expect(renderWorker(template, ['/assets/b.js'])).not.toBe(a);
  });
});
