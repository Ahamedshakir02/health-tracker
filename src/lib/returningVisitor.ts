/**
 * The "you already use this" flag.
 *
 * The landing page at `/` is the front door for people who have never seen
 * Vitals. For someone who actually uses it, `/` is just a wall between them and
 * their log — and since the tracker moved to `/app`, an old bookmark or a
 * home-screen icon pointing at `/` lands on marketing copy instead.
 *
 * The landing page cannot ask Firebase who is signed in: it ships no Firebase
 * at all, and adding it would cost ~340 KB and widen the CSP on a public page
 * for the sake of a redirect. So the app leaves a mark here instead, and the
 * landing page reads it synchronously with no network involved.
 *
 * This is functional storage, not tracking. It holds no identifier — just the
 * fact that this browser has opened the tracker at least once. See the
 * inline script in index.html for the reading half.
 */

/** Must match the literal in index.html's inline redirect script. */
export const RETURNING_KEY = 'vitals.returning';

/**
 * Called once the app is actually unlocked — signed in, or explicitly running
 * local-only. Deliberately *not* called merely because someone opened `/app`:
 * sign-up is invite-only, so a curious visitor who clicks through from the
 * landing page would otherwise be redirected past it forever and stranded on a
 * sign-in screen they cannot pass.
 */
export function markReturningVisitor(): void {
  try {
    localStorage.setItem(RETURNING_KEY, '1');
  } catch {
    // Private browsing, or storage disabled. The redirect simply won't happen,
    // which is the same as the current behaviour — nothing to recover from.
  }
}
