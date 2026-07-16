import { Component, ReactNode } from 'react';
import { Icon } from './ui';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('Uncaught UI error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[70vh] items-center justify-center p-6">
          <div className="w-full max-w-md animate-scale-in rounded-2xl border border-line bg-surface p-8 text-center shadow-card-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
              <Icon name="alert" className="h-7 w-7" />
            </div>
            <h1 className="text-lg font-bold text-fg">This view crashed</h1>
            <p className="mt-2 text-sm text-muted">
              An unexpected error interrupted the interface. Reloading usually resolves it.
            </p>
            <p className="mt-3 break-words rounded-lg bg-surface2 p-2 font-mono text-[11px] text-subtle">
              {this.state.error.message}
            </p>
            <button className="btn-primary mt-5 w-full" onClick={() => window.location.reload()}>
              <Icon name="refresh" className="h-4 w-4" /> Reload workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
