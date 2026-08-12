import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Changing this resets the boundary — used to clear the error on navigation. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * A render error in one screen used to take the whole app down to a blank page,
 * which also hid the fact that the data underneath was still intact. This keeps
 * the shell alive and offers the two things that actually recover the session:
 * reload, or export the data so a bad record can be edited out by hand.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry in this app by design — the console is the only sink.
    console.error('Vitals crashed while rendering:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash" role="alert">
        <h1 className="page-title">Something broke on this screen</h1>
        <p className="page-sub">
          Your logged data is untouched — this is a display error, not a data loss.
        </p>
        <pre className="crash-detail">{error.message}</pre>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              window.location.hash = '#/settings';
              this.setState({ error: null });
            }}
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }
}
