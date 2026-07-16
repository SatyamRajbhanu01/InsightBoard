import { useMemo, useState } from 'react';
import { ColumnProfile } from '../lib/api';
import { fmtNum, fmtPct } from '../lib/format';
import { seriesColor } from '../lib/viz';
import { EmptyState, Icon } from './ui';

function MissingBar({ pct }: { pct: number }) {
  const color = pct > 20 ? 'bg-rose-400' : pct > 5 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function NumericBody({ col }: { col: ColumnProfile }) {
  const s = col.stats!;
  const items: [string, number | null][] = [
    ['Mean', s.mean],
    ['Median', s.median],
    ['Std', s.std],
    ['Min', s.min],
    ['Q1', s.q1],
    ['Q3', s.q3],
    ['Max', s.max],
  ];
  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k}>
          <div className="text-[10px] font-medium uppercase tracking-wide text-subtle">{k}</div>
          <div className="num text-sm font-semibold text-fg">{fmtNum(v)}</div>
        </div>
      ))}
    </div>
  );
}

function CategoricalBody({ col }: { col: ColumnProfile }) {
  const top = col.top_values ?? [];
  const max = Math.max(1, ...top.map((t) => t.count));
  if (top.length === 0) {
    return <div className="py-2 text-sm text-subtle">No value samples available.</div>;
  }
  return (
    <div className="space-y-2">
      {top.slice(0, 6).map((t, i) => (
        <div key={t.value} className="flex items-center gap-2.5">
          <div className="w-28 truncate text-xs text-muted" title={t.value}>
            {t.value}
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(t.count / max) * 100}%`, background: seriesColor(i) }}
            />
          </div>
          <div className="num w-12 text-right text-xs text-muted">{fmtNum(t.count)}</div>
        </div>
      ))}
    </div>
  );
}

type Filter = 'all' | 'numeric' | 'categorical';

export default function ProfilePanel({ columns }: { columns: ColumnProfile[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return columns.filter((c) => {
      if (filter === 'numeric' && !c.is_numeric) return false;
      if (filter === 'categorical' && c.is_numeric) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [columns, filter, query]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `All (${columns.length})` },
    { key: 'numeric', label: `Numeric (${columns.filter((c) => c.is_numeric).length})` },
    { key: 'categorical', label: `Categorical (${columns.filter((c) => !c.is_numeric).length})` },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 rounded-xl border border-line bg-surface2/60 p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.key ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a column…"
            aria-label="Search columns"
            className="input w-44 pl-8"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No columns match" hint="Adjust the filter or search term." icon="search" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((col) => (
            <div key={col.name} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-fg" title={col.name}>
                    {col.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`chip ${
                        col.is_numeric ? 'text-brand-300' : 'text-teal-300'
                      }`}
                    >
                      {col.is_numeric ? 'numeric' : 'categorical'}
                    </span>
                    <span className="chip font-mono">{col.dtype}</span>
                    <span className="chip num">{fmtNum(col.unique)} unique</span>
                  </div>
                </div>
              </div>

              {col.is_numeric && col.stats ? <NumericBody col={col} /> : <CategoricalBody col={col} />}

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px] text-subtle">
                  <span>Missing</span>
                  <span className="num">{fmtPct(col.missing_pct)}</span>
                </div>
                <MissingBar pct={col.missing_pct} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
