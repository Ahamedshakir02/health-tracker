import { useEffect, useState } from 'react';
import { useHealth } from './state/HealthProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Body from './pages/Body';
import Food from './pages/Food';
import Movement from './pages/Movement';
import Daily from './pages/Daily';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';

const TABS = [
  { id: 'dashboard', label: 'Today', icon: '◎' },
  { id: 'body', label: 'Body', icon: '⚖' },
  { id: 'food', label: 'Food', icon: '🍽' },
  { id: 'movement', label: 'Move', icon: '🏃' },
  { id: 'daily', label: 'Habits', icon: '✓' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
] as const;

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

  const go = (id: TabId) => {
    window.location.hash = `#/${id}`;
    setTab(id);
  };

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Sections">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ♥
          </span>
          <div>
            <div className="brand-name">Vitals</div>
            <div className="brand-sub">HEALTH TRACKER</div>
          </div>
        </div>

        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="nav-item"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => go(t.id)}
          >
            <span className="nav-icon" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}

        <div className="sidebar-foot">
          <span className="pill">
            <span
              className="pill-dot"
              style={{
                background:
                  sync === 'error'
                    ? 'var(--critical)'
                    : sync === 'ready'
                      ? 'var(--good)'
                      : 'var(--warning)',
              }}
              aria-hidden="true"
            />
            {sync === 'error' ? 'Save failed' : sync === 'saving' ? 'Saving…' : storeLabel}
          </span>
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
    </div>
  );
}
