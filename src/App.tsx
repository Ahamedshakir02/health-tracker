import { lazy, Suspense, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useHealth } from './state/HealthProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { Avatar, firstName } from './components/ui';
import {
  IconBody,
  IconFood,
  IconHabits,
  IconHeart,
  IconMobility,
  IconMovement,
  IconSettings,
  IconToday,
  IconTrainer,
} from './components/icons';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';

/**
 * Sections are loaded when they are first opened.
 *
 * Recharts is by a wide margin the largest thing in the bundle, and it is used
 * by four of the eight sections. Statically importing every page put it in the
 * first load for everyone — including someone opening the Trainer on a phone
 * in a gym, who will never see a chart. Splitting here is what makes the lazy
 * progression panel actually defer anything.
 *
 * Login and Onboarding stay eager: they are the first thing an unauthenticated
 * visitor sees, and a spinner in front of a sign-in form is a worse trade than
 * the few kilobytes they cost.
 */
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Body = lazy(() => import('./pages/Body'));
const Food = lazy(() => import('./pages/Food'));
const Movement = lazy(() => import('./pages/Movement'));
const Daily = lazy(() => import('./pages/Daily'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Trainer = lazy(() => import('./pages/Trainer'));
const Mobility = lazy(() => import('./pages/Mobility'));
import { applyPageMeta } from './lib/pageMeta';
import { markReturningVisitor } from './lib/returningVisitor';

const TABS = [
  { id: 'dashboard', label: 'Today', Icon: IconToday },
  { id: 'trainer', label: 'Trainer', Icon: IconTrainer },
  { id: 'mobility', label: 'Mobility', Icon: IconMobility },
  { id: 'body', label: 'Body', Icon: IconBody },
  { id: 'food', label: 'Food', Icon: IconFood },
  { id: 'movement', label: 'Move', Icon: IconMovement },
  { id: 'daily', label: 'Habits', Icon: IconHabits },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
] as const satisfies readonly { id: string; label: string; Icon: ComponentType }[];

type TabId = (typeof TABS)[number]['id'];

/**
 * The section named by the hash, or null if the hash names nothing.
 *
 * An empty hash is the dashboard — that's the bare `/app` URL. Anything else
 * unrecognised returns null so a stale bookmark gets a "not found" panel rather
 * than being silently redirected to Today, which looks like the app quietly
 * lost your page.
 */
function currentTab(): TabId | null {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return 'dashboard';
  return TABS.find((t) => t.id === hash)?.id ?? null;
}

/**
 * First-load placeholder.
 *
 * A skeleton rather than a spinner or a line of text: the layout it stands in
 * for is a row of stat tiles over a chart over a table, so holding that shape
 * stops the page jumping when the real content lands. `aria-busy` plus one
 * polite message means a screen reader hears "Loading your data" once, rather
 * than reading out a dozen meaningless grey boxes.
 */
function LoadingPanel() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your data…</span>
      <div className="sk-row" aria-hidden="true">
        <div className="sk sk-tile" />
        <div className="sk sk-tile" />
        <div className="sk sk-tile" />
        <div className="sk sk-tile" />
      </div>
      <div className="sk sk-chart" aria-hidden="true" />
      <div className="sk sk-table" aria-hidden="true" />
    </div>
  );
}

/**
 * Signed in, but the address is still unconfirmed.
 *
 * `firestore.rules` refuses an account whose `email_verified` is false, so
 * letting this state through to the app would produce a wall of
 * `permission-denied` errors instead of an explanation. `emailVerified` is
 * baked into the ID token, so clicking the link in a mail client does not
 * update this tab — hence the explicit "I've confirmed it" button, which
 * reloads the account rather than waiting for a refresh that never comes.
 */
function VerifyPanel() {
  const { user, resendVerification, refreshUser, signOut } = useHealth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (done) setNotice(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <main className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            <IconHeart />
          </span>
          <div className="brand-text">
            <span className="brand-name">Vitals</span>
            <span className="brand-sub">Health Tracker</span>
          </div>
        </div>

        <h1 className="auth-title">Confirm your email</h1>
        <p className="auth-sub">
          We sent a link to <strong>{user?.email}</strong>. Click it, then come back here. Your log
          stays locked until the address is confirmed — that is what keeps someone else's address
          from being used to open an account.
        </p>

        <button
          type="button"
          className="btn btn-primary auth-wide"
          disabled={busy}
          onClick={() => void run(refreshUser)}
        >
          {busy ? 'Checking…' : "I've confirmed it"}
        </button>

        {error && (
          <div className="banner error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="banner" role="status">
            <span aria-hidden="true">✓</span>
            <span>{notice}</span>
          </div>
        )}

        <div className="auth-links">
          <button
            type="button"
            className="link"
            disabled={busy}
            onClick={() => void run(resendVerification, 'Sent. Check your inbox and spam folder.')}
          >
            Send the link again
          </button>
          <button type="button" className="link" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}

/** Shown when the URL hash names a section that doesn't exist. */
function NotFoundPanel({ onHome }: { onHome: () => void }) {
  return (
    <div className="notfound">
      <p className="notfound-code" aria-hidden="true">
        404
      </p>
      <h1 className="notfound-title">This section isn't here.</h1>
      <p className="notfound-body">
        The link may be out of date, or the address may have a typo in it. Your log is fine —
        nothing has been lost.
      </p>
      <button type="button" className="btn btn-primary" onClick={onHome}>
        Go to Today
      </button>
    </div>
  );
}

export default function App() {
  const { data, sync, error, storeLabel, authReady, user, emailVerified, firebaseAvailable, offlineMode } =
    useHealth();
  const [tab, setTab] = useState<TabId | null>(currentTab);

  useEffect(() => {
    const onHash = () => setTab(currentTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Keep the tab strip, history menu and bookmarks readable when several
  // sections are open at once.
  useEffect(() => {
    applyPageMeta(tab);
  }, [tab]);

  // Theme preference is applied to <html> so CSS tokens swap in one place. This
  // runs before any early return so the login screen is themed too.
  useEffect(() => {
    const root = document.documentElement;
    if (data.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', data.settings.theme);
  }, [data.settings.theme]);

  // The app is gated: signed in when Firebase is configured, or explicitly
  // running local-only when it is not. Computed before the early returns below
  // because the effect that follows can't sit after them.
  const unlocked = firebaseAvailable ? Boolean(user) && emailVerified : offlineMode;

  // Once someone is actually in, remember it, so a bookmark or home-screen icon
  // pointing at / skips the marketing page next time.
  useEffect(() => {
    if (unlocked) markReturningVisitor();
  }, [unlocked]);

  // Waiting on Firebase to report whether a session already exists. Rendering
  // the login screen first would flash it at an already-signed-in user.
  if (!authReady) {
    return (
      <div className="auth">
        <p className="empty">Checking your session…</p>
      </div>
    );
  }

  // Signed in but unconfirmed is its own state: showing the login form again
  // to someone who has just signed up reads as the sign-up having failed.
  if (firebaseAvailable && user && !emailVerified) return <VerifyPanel />;

  if (!unlocked) return <Login />;

  // Wait for the first load to settle before deciding this is a new account —
  // during `loading` the record is still the default one, and onboarding would
  // flash in front of someone who already has years of data.
  const untouched =
    !data.settings.name &&
    !data.weights.length &&
    !data.meals.length &&
    !data.workouts.length &&
    !data.days.length &&
    !data.sessions.length;
  if (sync !== 'loading' && !data.settings.onboardedAt && untouched) return <Onboarding />;

  const go = (id: TabId) => {
    window.location.hash = `#/${id}`;
    setTab(id);
  };

  // The name they gave, or the address they signed in with — never blank, or
  // the pill reads as a broken control rather than an account.
  const accountName = data.settings.name.trim() || user?.email || 'You';

  const syncDot =
    sync === 'error' ? 'var(--crit)' : sync === 'ready' ? 'var(--good)' : 'var(--warn)';
  const syncText = sync === 'error' ? 'Save failed' : sync === 'saving' ? 'Saving…' : storeLabel;

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Sections">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <IconHeart />
          </span>
          <span className="brand-text">
            <span className="brand-name">Vitals</span>
            <span className="brand-sub">Health Tracker</span>
          </span>
        </div>

        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="navitem"
            // The label is hidden by CSS on a narrow rail and on a phone, which
            // left eight buttons with no accessible name at all — the icon is
            // aria-hidden, so there was nothing else to read.
            aria-label={label}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => go(id)}
          >
            <Icon />
            <span className="nav-text">{label}</span>
          </button>
        ))}

        {/* Which account is open. On a shared laptop the sync dot says the
            data is saving; it does not say whose. */}
        <button
          type="button"
          className="accountpill"
          onClick={() => go('settings')}
          aria-label={`Signed in as ${accountName}. Open settings`}
        >
          <Avatar name={accountName} url={data.settings.avatarUrl} />
          <span className="account-name">{firstName(accountName)}</span>
        </button>

        <div className="syncpill">
          <span className="dot" style={{ background: syncDot }} aria-hidden="true" />
          <span className="sync-text">{syncText}</span>
        </div>
      </nav>

      <main className="main">
        {error && (
          <div className="banner error" role="alert" style={{ marginBottom: 16 }}>
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}
        <ErrorBoundary resetKey={tab ?? 'not-found'}>
          {/* The same skeleton for a section still downloading as for data
              still loading — from the reader's side they are the same wait. */}
          <Suspense fallback={<LoadingPanel />}>
          {sync === 'loading' ? (
            <LoadingPanel />
          ) : tab === null ? (
            <NotFoundPanel onHome={() => go('dashboard')} />
          ) : tab === 'dashboard' ? (
            <Dashboard onNavigate={go} />
          ) : tab === 'trainer' ? (
            <Trainer />
          ) : tab === 'mobility' ? (
            <Mobility />
          ) : tab === 'body' ? (
            <Body />
          ) : tab === 'food' ? (
            <Food />
          ) : tab === 'movement' ? (
            <Movement />
          ) : tab === 'daily' ? (
            <Daily />
          ) : (
            <SettingsPage />
          )}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Phone navigation. The design mocks a five-slot bar, but every section
          has to stay reachable on a phone, so all seven ride the bar here. */}
      <nav className="tabbar" aria-label="Sections">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="tabitem"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => go(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
