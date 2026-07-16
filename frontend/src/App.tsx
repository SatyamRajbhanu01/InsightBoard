import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Landing from './components/Landing';
import { api, DatasetMeta } from './lib/api';

export default function App() {
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = () => {
    setLoadingSamples(true);
    api
      .listDatasets()
      .then(setDatasets)
      .catch(() => setDatasets([]))
      .finally(() => setLoadingSamples(false));
  };

  useEffect(refresh, []);

  const select = (id: string) => {
    setSelected(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const samples = datasets.filter((d) => d.source === 'sample');

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-900/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            className="flex items-center gap-2"
            onClick={() => setSelected(null)}
            aria-label="Go to home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-lg font-black text-white">
              ▟
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">
              Insight<span className="text-brand-300">Board</span>
            </span>
          </button>
          <nav className="flex items-center gap-3">
            {selected && (
              <button className="btn-ghost" onClick={() => setSelected(null)}>
                ← New dataset
              </button>
            )}
            <a
              className="hidden text-sm text-slate-400 hover:text-white sm:block"
              href="/api/health"
              target="_blank"
              rel="noreferrer"
            >
              API
            </a>
          </nav>
        </div>
      </header>

      <main>
        {selected ? (
          <Dashboard id={selected} />
        ) : (
          <Landing samples={samples} loadingSamples={loadingSamples} onSelect={select} />
        )}
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
        InsightBoard · Built with FastAPI · React · Recharts · pandas
      </footer>
    </div>
  );
}
