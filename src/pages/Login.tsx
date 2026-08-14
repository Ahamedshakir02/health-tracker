import { useState, type FormEvent } from 'react';
import { useHealth } from '../state/HealthProvider';
import { Field } from '../components/ui';
import { IconHeart } from '../components/icons';
import { missingFirebaseKeys } from '../lib/firebase';

type Mode = 'signin' | 'signup' | 'reset';

const HEADING: Record<Mode, string> = {
  signin: 'Sign in',
  signup: 'Create your account',
  reset: 'Reset your password',
};

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function Login() {
  const {
    firebaseAvailable,
    accessDenied,
    useOffline,
    signInGoogle,
    signInEmail,
    signUpEmail,
    resetPassword,
  } = useHealth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Every sign-in path funnels through here so busy/error handling is identical. */
  async function run(action: () => Promise<void>, done?: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      if (done) setNotice(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === 'reset') {
      void run(
        () => resetPassword(email),
        'If that address has an account, a reset link is on its way.',
      );
      return;
    }
    const action = mode === 'signup' ? signUpEmail : signInEmail;
    void run(async () => {
      await action(email, password);
      setPassword('');
    });
  }

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
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

        {!firebaseAvailable ? (
          <>
            <h1 className="auth-title">Sign-in is not set up yet</h1>
            <p className="auth-sub">
              Cloud sync needs a Firebase web config. Copy <code>.env.example</code> to{' '}
              <code>.env</code>, fill it in, and restart the dev server.
            </p>
            <div className="banner error" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>
                Still missing:{' '}
                {missingFirebaseKeys.map((key, i) => (
                  <span key={key}>
                    {i > 0 && ', '}
                    <code>{key}</code>
                  </span>
                ))}
              </span>
            </div>
            <button type="button" className="btn btn-primary auth-wide" onClick={useOffline}>
              Continue on this device only
            </button>
            <p className="hint auth-foot">
              Local mode keeps everything in this browser as JSON. You can export it and import it
              again once sign-in works.
            </p>
          </>
        ) : (
          <>
            <h1 className="auth-title">{HEADING[mode]}</h1>
            <p className="auth-sub">
              This tracker is private to a single account. Other addresses are refused here and by
              the database rules.
            </p>

            {accessDenied && (
              <div className="banner error" role="alert">
                <span aria-hidden="true">⛔</span>
                <span>
                  <strong>{accessDenied}</strong> is not the owner of this tracker, so it was signed
                  back out.
                </span>
              </div>
            )}

            {mode !== 'reset' && (
              <>
                <button
                  type="button"
                  className="btn auth-wide auth-google"
                  onClick={() => void run(signInGoogle)}
                  disabled={busy}
                >
                  <GoogleMark />
                  Continue with Google
                </button>
                <div className="auth-or">
                  <span>or</span>
                </div>
              </>
            )}

            <form onSubmit={submit} className="auth-form">
              <Field label="Email">
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              {mode !== 'reset' && (
                <Field label="Password">
                  <input
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={6}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              )}

              <button type="submit" className="btn btn-primary auth-wide" disabled={busy}>
                {busy ? 'Working…' : HEADING[mode]}
              </button>
            </form>

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
              {mode !== 'signin' && (
                <button type="button" className="link" onClick={() => go('signin')}>
                  Back to sign in
                </button>
              )}
              {mode === 'signin' && (
                <>
                  <button type="button" className="link" onClick={() => go('reset')}>
                    Forgot password?
                  </button>
                  <button type="button" className="link" onClick={() => go('signup')}>
                    First time here?
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
