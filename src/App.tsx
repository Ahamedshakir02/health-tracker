import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useHealth } from './state/HealthProvider';
import ErrorBoundary from './components/ErrorBoundary';
import {
  IconBody,
  IconFood,
  IconHabits,
  IconHeart,
  IconMovement,
  IconSettings,
  IconToday,
  IconTrainer,
} from './components/icons';
import Dashboard from './pages/Dashboard';
import Body from './pages/Body';
import Food from './pages/Food';
import Movement from './pages/Movement';
import Daily from './pages/Daily';
import SettingsPage from './pages/Settings';
import Trainer from './pages/Trainer';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';

const TABS = [
  { id: 'dashboard', label: 'Today', Icon: IconToday },
  { id: 'trainer', label: 'Trainer', Icon: IconTrainer },
  { id: 'body', label: 'Body', Icon: IconBody },
  { id: 'food', label: 'Food', Icon: IconFood },
  { id: 'movement', label: 'Move', Icon: IconMovement },
  { id: 'daily', label: 'Habits', Icon: IconHabits },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
] as const satisfies readonly { id: string; label: string; Icon: ComponentType }[];

type TabId = (typeof TABS)[number]['id'];

function currentTab(): TabId {
  const hash = window.location.hash.replace('#/', '');
  return (TABS.find((t) => t.id === hash)?.id ?? 'dashboard') as TabId;
}

export default function App() {
  const { data, sync, error, storeLabel, authReady, user, firebaseAvailable, offlineMode } =
    useHealth();
  const [tab, setTab] = useState<TabId>(currentTab);

  useEffect(() => {
    const onHash = () => setTab(currentTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Theme preference is applied to <html> so CSS tokens swap in one place. This
  // runs before any early return so the login screen is themed too.
  useEffect(() => {
    const root = document.documentElement;
    if (data.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', data.settings.theme);
  }, [data.settings.theme]);

  // Waiting on Firebase to report whether a session already exists. Rendering
  // the login screen first would flash it at an already-signed-in user.
  if (!authReady) {
    return (
      <div className="auth">
        <p className="empty">Checking your session…</p>
      </div>
    );
  }

  // The app is gated: signed in when Firebase is configured, or explicitly
  // running local-only when it is not.
  const unlocked = firebaseAvailable ? Boolean(user) : offlineMode;
  if (!unlocked) return <Login />;

  // Wait for the first load to settle before deciding this is a new account —
  // during `loading` the record is still the default one, and onboarding would
  // flash in front of someone who already has years of data.
  const untouched =
    !data.settings.name &&
    !data.weights.length &&
    !data.meals.length &&
    !data.workouts.length &&
    !data.days.length;
  if (sync !== 'loading' && !data.settings.onboardedAt && untouched) return <Onboarding />;

  const go = (id: TabId) => {
    window.location.hash = `#/${id}`;
    setTab(id);
  };

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
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => go(id)}
          >
            <Icon />
            <span className="nav-text">{label}</span>
          </button>
        ))}

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
        <ErrorBoundary resetKey={tab}>
          {sync === 'loading' ? (
            <p className="empty">Loading your data…</p>
          ) : tab === 'dashboard' ? (
            <Dashboard onNavigate={go} />
          ) : tab === 'trainer' ? (
            <Trainer />
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
