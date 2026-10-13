import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** When this value changes, a caught error is cleared — pass the current route so navigating away recovers. */
  resetKey?: string;
};
type State = { error: Error | null };

/**
 * Catches exceptions thrown while rendering, so one broken component can't unmount the whole app.
 * It does NOT catch errors in event handlers or in async code (a rejected promise) — those still
 * need their own handling at the call site.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const btn = 'px-5 py-2 rounded-xl border border-white/10 bg-white/6 text-fg2 text-[13px] font-semibold cursor-pointer';
    return (
      <div role="alert" className="flex flex-col items-center justify-center text-center gap-3 px-8 h-screen">
        <p className="font-semibold" style={{ color: '#E0685C' }}>Something broke</p>
        <p className="text-fg3 text-[13px]">This page hit an unexpected error. Reloading usually fixes it.</p>
        {import.meta.env.DEV && <pre className="text-fg4 text-[11px] max-w-md whitespace-pre-wrap">{error.message}</pre>}
        <div className="flex gap-2 mt-1">
          <button onClick={() => window.location.reload()} className={btn}>Reload</button>
          <a href="/" className={btn}>Go home</a>
        </div>
      </div>
    );
  }
}
