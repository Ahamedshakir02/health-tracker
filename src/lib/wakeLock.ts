import { useEffect, useRef } from 'react';

/**
 * Keeps the screen on while a session is in progress.
 *
 * Two things make this less simple than it looks. The lock is released by the
 * browser whenever the tab is hidden and is *not* restored when it comes back,
 * so it has to be re-requested on `visibilitychange` or the screen dims the
 * first time you answer a message. And the API is absent on older iOS, where
 * the only correct behaviour is to do nothing quietly — a permission-style
 * warning about a nicety would be worse than the nicety being missing.
 */

interface Sentinel {
  released: boolean;
  release: () => Promise<void>;
}

interface WakeLockNavigator {
  wakeLock?: { request: (type: 'screen') => Promise<Sentinel> };
}

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export function useWakeLock(active: boolean): void {
  const held = useRef<Sentinel | null>(null);

  useEffect(() => {
    if (!active || !wakeLockSupported()) return;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (held.current && !held.current.released) return;
      try {
        held.current = await (navigator as WakeLockNavigator).wakeLock!.request('screen');
      } catch {
        // Denied, or the battery saver refused. Nothing to say about it.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      const sentinel = held.current;
      held.current = null;
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
    };
  }, [active]);
}
