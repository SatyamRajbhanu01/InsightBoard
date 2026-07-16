import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './lib/api';
import { useTheme } from './lib/theme';
import { Icon, Logo, Spinner, ThemeToggle } from './components/ui';
import Landing from './components/Landing';
import NotFound from './components/NotFound';

const Dashboard = lazy(() => import('./components/Dashboard'));

function ReadyBadge() {
  const [state, setState] = useState<'checking' | 'ready' | 'degraded' | 'down'>('checking');
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .ready()
      .then((r) => {
        if (!alive) return;
        setState(r.status === 'ready' ? 'ready' : 'degraded');
        setCount(r.datasets);
      })
      .catch(() => alive && setState('down'));
    return () => {
      alive = false;
    };
  }, []);

  const dot =
    state === 'ready'
      ? 'bg-emerald-400'
      : state === 'checking'
        ? 'bg-amber-400 animate-pulse'
        : state === 'degraded'
          ? 'bg-amber-400'
          : 'bg-rose-400';
  const label =
    state === 'ready'
      ? `API ready${count !== null ? ` · ${count} datasets` : ''}`
      : state === 'checking'
        ? 'Checking API…'
        : state === 'degraded'
          ? 'API degraded'
          : 'API offline';

  return (
    <span
      className="hidden items-center gap-2 rounded-full border border-line bg-surface2/60 px-3 py-1.5 text-xs font-medium text-muted md:inline-flex"
      title={label}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function Header() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const onDashboard = location.pathname.startsWith('/d/');

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="focus-ring flex items-center gap-2.5 rounded-lg" aria-label="InsightBoard home">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight text-fg">
            Insight<span className="text-brand-400">Board</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <ReadyBadge />
          {onDashboard && (
            <button className="btn-ghost hidden h-9 sm:inline-flex" onClick={() => navigate('/')}>
              <Icon name="arrowLeft" className="h-4 w-4" /> New dataset
            </button>
          )}
          <a
            className="btn-subtle hidden h-9 sm:inline-flex"
            href="/docs"
            target="_blank"
            rel="noreferrer"
            title="Open the API reference"
          >
            API docs <Icon name="external" className="h-3.5 w-3.5" />
          </a>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </div>
    </header>
  );
}

function DashboardRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner label="Loading workspace…" />
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}

export default function App() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/d/:id" element={<DashboardRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="border-t border-line py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-subtle sm:flex-row">
          <span>InsightBoard — CSV analytics workspace</span>
          <span className="flex items-center gap-1.5">
            Powered by
            <span className="font-medium text-muted">FastAPI</span>·
            <span className="font-medium text-muted">pandas</span>·
            <span className="font-medium text-muted">React</span>·
            <span className="font-medium text-muted">Recharts</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
