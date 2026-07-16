import { ColumnProfile } from '../lib/api';
import { fmtNum, fmtPct } from '../lib/format';

function MissingBar({ pct }: { pct: number }) {
  const color = pct > 20 ? 'bg-rose-400' : pct > 5 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
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
    <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k}>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
          <div className="text-sm font-semibold text-slate-100">{fmtNum(v)}</div>
        </div>
      ))}
    </div>
  );
}

function CategoricalBody({ col }: { col: ColumnProfile }) {
  const top = col.top_values ?? [];
  const max = Math.max(1, ...top.map((t) => t.count));
  return (
    <div className="space-y-1.5">
      {top.slice(0, 6).map((t) => (
        <div key={t.value} className="flex items-center gap-2">
          <div className="w-28 truncate text-xs text-slate-300" title={t.value}>
            {t.value}
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-brand-400" style={{ width: `${(t.count / max) * 100}%` }} />
          </div>
          <div className="w-10 text-right text-xs tabular-nums text-slate-400">{t.count}</div>
        </div>
      ))}
    </div>
  );
}

export default function ProfilePanel({ columns }: { columns: ColumnProfile[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {columns.map((col) => (
        <div key={col.name} className="card p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-white" title={col.name}>
                {col.name}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="chip">{col.is_numeric ? 'numeric' : 'categorical'}</span>
                <span className="chip">{col.dtype}</span>
                <span className="chip">{fmtNum(col.unique)} unique</span>
              </div>
            </div>
          </div>

          {col.is_numeric && col.stats ? <NumericBody col={col} /> : <CategoricalBody col={col} />}

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Missing</span>
              <span>{fmtPct(col.missing_pct)}</span>
            </div>
            <MissingBar pct={col.missing_pct} />
          </div>
        </div>
      ))}
    </div>
  );
}
