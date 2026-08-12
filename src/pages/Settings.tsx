import { useRef, useState, type FormEvent } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Card, Field, Pill, Segmented } from '../components/ui';
import { sampleData } from '../lib/sample';
import { labels, round, toCanonical, toDisplay } from '../lib/units';
import { uid } from '../lib/calc';
import type { Habit, UnitSystem } from '../types';

export default function SettingsPage() {
  const {
    data,
    updateSettings,
    exportData,
    importData,
    resetData,
    replaceAll,
    storeKind,
    firebaseAvailable,
    user,
    signInAnon,
    signInEmail,
    signUpEmail,
    signOut,
  } = useHealth();

  const settings = data.settings;
  const goals = settings.goals;
  const units = settings.units;
  const u = labels(units);
  const fileInput = useRef<HTMLInputElement>(null);

  const [newHabit, setNewHabit] = useState({ name: '', emoji: '⭐' });
  const [auth, setAuth] = useState({ email: '', password: '', mode: 'signin' as 'signin' | 'signup' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setGoal = (patch: Partial<typeof goals>) =>
    updateSettings({ goals: { ...goals, ...patch } });

  function addHabit(event: FormEvent) {
    event.preventDefault();
    if (!newHabit.name.trim()) return;
    const habit: Habit = {
      id: uid('h'),
      name: newHabit.name.trim(),
      emoji: newHabit.emoji.trim() || '⭐',
    };
    updateSettings({ habits: [...settings.habits, habit] });
    setNewHabit({ name: '', emoji: '⭐' });
  }

  async function runAuth(event: FormEvent) {
    event.preventDefault();
    setAuthError(null);
    setBusy(true);
    try {
      if (auth.mode === 'signup') await signUpEmail(auth.email, auth.password);
      else await signInEmail(auth.email, auth.password);
      setAuth({ ...auth, password: '' });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function guestSignIn() {
    setAuthError(null);
    setBusy(true);
    try {
      await signInAnon();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Profile, targets, habits and where your data lives.</p>
        </div>
      </header>

      <div className="stack">
        <Card title="Profile">
          <div className="form-grid">
            <Field label="Name">
              <input
                type="text"
                placeholder="Optional"
                value={settings.name}
                onChange={(e) => updateSettings({ name: e.target.value })}
              />
            </Field>
            <Field label={`Height (${u.length})`} hint="Used for BMI">
              <input
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                value={
                  settings.heightCm != null
                    ? round(toDisplay('length', settings.heightCm, units), 1)
                    : ''
                }
                onChange={(e) =>
                  updateSettings({
                    heightCm:
                      e.target.value === ''
                        ? undefined
                        : toCanonical('length', Number(e.target.value), units),
                  })
                }
              />
            </Field>
            <Field label="Birth year">
              <input
                type="number"
                min="1900"
                max="2030"
                inputMode="numeric"
                placeholder="Optional"
                value={settings.birthYear ?? ''}
                onChange={(e) =>
                  updateSettings({
                    birthYear: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>

          <hr className="divider" style={{ margin: '16px 0 12px' }} />

          <div className="row" style={{ gap: 24 }}>
            <div className="field">
              <span className="label">Units</span>
              <Segmented
                ariaLabel="Unit system"
                value={units}
                onChange={(value: UnitSystem) => updateSettings({ units: value })}
                options={[
                  { value: 'metric' as UnitSystem, label: 'Metric (kg, cm)' },
                  { value: 'imperial' as UnitSystem, label: 'Imperial (lb, in)' },
                ]}
              />
            </div>
            <div className="field">
              <span className="label">Theme</span>
              <Segmented
                ariaLabel="Theme"
                value={settings.theme}
                onChange={(value) => updateSettings({ theme: value })}
                options={[
                  { value: 'system' as const, label: 'System' },
                  { value: 'light' as const, label: 'Light' },
                  { value: 'dark' as const, label: 'Dark' },
                ]}
              />
            </div>
          </div>
        </Card>

        <Card title="Daily targets" note="These drive every progress meter and target line.">
          <div className="form-grid">
            <Field label={`Goal weight (${u.weight})`}>
              <input
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                placeholder="Optional"
                value={goals.weightKg != null ? round(toDisplay('weight', goals.weightKg, units), 1) : ''}
                onChange={(e) =>
                  setGoal({
                    weightKg:
                      e.target.value === ''
                        ? undefined
                        : toCanonical('weight', Number(e.target.value), units),
                  })
                }
              />
            </Field>
            <Field label="Calories (kcal)">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={goals.calories}
                onChange={(e) => setGoal({ calories: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Protein (g)">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={goals.proteinG}
                onChange={(e) => setGoal({ proteinG: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label={`Water (${u.volume})`}>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={round(toDisplay('volume', goals.waterMl, units), 0)}
                onChange={(e) =>
                  setGoal({ waterMl: toCanonical('volume', Number(e.target.value) || 0, units) })
                }
              />
            </Field>
            <Field label="Sleep (hours)">
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                inputMode="decimal"
                value={goals.sleepHours}
                onChange={(e) => setGoal({ sleepHours: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Steps">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={goals.steps}
                onChange={(e) => setGoal({ steps: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Workouts per week">
              <input
                type="number"
                min="0"
                max="14"
                inputMode="numeric"
                value={goals.workoutsPerWeek}
                onChange={(e) => setGoal({ workoutsPerWeek: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Habits" note="Shown as chips on the daily check-in.">
          <div className="stack">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Habit</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {settings.habits.map((habit) => (
                    <tr key={habit.id}>
                      <td className="cell-main">
                        <span aria-hidden="true">{habit.emoji}</span> {habit.name}
                      </td>
                      <td>
                        {habit.archived ? <Pill>Hidden</Pill> : <Pill status="good">Active</Pill>}
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            updateSettings({
                              habits: settings.habits.map((h) =>
                                h.id === habit.id ? { ...h, archived: !h.archived } : h,
                              ),
                            })
                          }
                        >
                          {habit.archived ? 'Show' : 'Hide'}
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-icon"
                          aria-label={`Delete habit ${habit.name}`}
                          onClick={() =>
                            updateSettings({
                              habits: settings.habits.filter((h) => h.id !== habit.id),
                            })
                          }
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form onSubmit={addHabit} className="form-grid">
              <Field label="Emoji">
                <input
                  type="text"
                  maxLength={4}
                  value={newHabit.emoji}
                  onChange={(e) => setNewHabit({ ...newHabit, emoji: e.target.value })}
                />
              </Field>
              <Field label="New habit">
                <input
                  type="text"
                  placeholder="Read 20 minutes"
                  value={newHabit.name}
                  onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                />
              </Field>
              <button className="btn" type="submit">
                Add habit
              </button>
            </form>
          </div>
        </Card>

        <Card
          title="Cloud sync"
          note={
            firebaseAvailable
              ? 'Firebase is configured for this build.'
              : 'Firebase keys are not set — the app is running on local JSON only.'
          }
        >
          {!firebaseAvailable ? (
            <div className="stack">
              <p className="hint">
                To turn on sync: copy <code>.env.example</code> to <code>.env</code>, paste your
                Firebase web config, enable Firestore and the Email/Password + Anonymous sign-in
                providers, then restart the dev server. Everything you log locally can be carried
                over with Export → Import.
              </p>
            </div>
          ) : user ? (
            <div className="stack">
              <div className="row">
                <Pill status="good">Signed in</Pill>
                <span className="hint">
                  {user.isAnonymous ? 'Guest account (this device only until you link an email)' : user.email}
                </span>
              </div>
              <p className="hint">
                Your data lives in Firestore under <code>users/{user.uid}</code> and syncs live to
                any other device signed into the same account.
              </p>
              <div className="row">
                <button type="button" className="btn" onClick={() => void signOut()}>
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="stack">
              <p className="hint">
                Sign in to sync across devices. Without signing in, everything stays in local JSON on
                this device.
              </p>
              <form onSubmit={runAuth} className="form-grid">
                <Field label="Email">
                  <input
                    type="email"
                    autoComplete="email"
                    value={auth.email}
                    onChange={(e) => setAuth({ ...auth, email: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    autoComplete={auth.mode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={6}
                    value={auth.password}
                    onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                    required
                  />
                </Field>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {auth.mode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              </form>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    setAuth({ ...auth, mode: auth.mode === 'signup' ? 'signin' : 'signup' })
                  }
                >
                  {auth.mode === 'signup' ? 'I already have an account' : 'Create an account instead'}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => void guestSignIn()} disabled={busy}>
                  Continue as guest
                </button>
              </div>
              {authError && (
                <div className="banner error" role="alert">
                  <span aria-hidden="true">⚠</span>
                  <span>{authError}</span>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card
          title="Your data"
          note={storeKind === 'firebase' ? 'Syncing to Firestore' : 'Stored locally as JSON'}
        >
          <div className="stack">
            <div className="row">
              <button type="button" className="btn" onClick={exportData}>
                Export JSON
              </button>
              <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
                Import JSON
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await importData(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (confirm('Replace everything currently logged with 90 days of demo data?')) {
                    void replaceAll(sampleData());
                  }
                }}
              >
                Load demo data
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (confirm('Delete everything? Export first if you want a backup.')) {
                    void resetData();
                  }
                }}
              >
                Delete all data
              </button>
            </div>
            <p className="hint">
              Export writes a single <code>.json</code> file containing every entry — that file is
              the backup, and importing it anywhere restores the full history. Import replaces the
              current contents rather than merging.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
