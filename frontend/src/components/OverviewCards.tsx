import { Overview } from '../lib/api';
import { fmtBytes, fmtNum, fmtPct } from '../lib/format';
import { Icon } from './ui';

function KpiTile({
  label,
  value,
  sub,
  icon,
  accent,
  tone = 'text-fg',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent: string;
  tone?: string;
}) {
  return (
    <div className="card group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-card-lg">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-surface2 ${tone}`}>
          <Icon name={icon} className="h-4 w-4" />
        </div>
      </div>
      <div className={`num mt-3 text-3xl font-extrabold tracking-tight ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default function OverviewCards({ ov }: { ov: Overview }) {
  const missingTone =
    ov.missing_pct > 20 ? 'text-rose-400' : ov.missing_pct > 5 ? 'text-amber-400' : 'text-emerald-400';
  const missingAccent =
    ov.missing_pct > 20 ? 'bg-rose-400' : ov.missing_pct > 5 ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiTile
        label="Rows"
        value={fmtNum(ov.rows)}
        sub={`${fmtNum(ov.duplicate_rows)} duplicate${ov.duplicate_rows === 1 ? '' : 's'}`}
        icon="table"
        accent="bg-brand-500"
        tone="text-brand-300"
      />
      <KpiTile
        label="Columns"
        value={fmtNum(ov.columns)}
        sub={`${ov.numeric_columns} numeric · ${ov.categorical_columns} categorical`}
        icon="layers"
        accent="bg-teal-400"
        tone="text-teal-300"
      />
      <KpiTile
        label="Missing data"
        value={fmtPct(ov.missing_pct)}
        sub={`${fmtNum(ov.missing_cells)} cells`}
        icon="alert"
        accent={missingAccent}
        tone={missingTone}
      />
      <KpiTile
        label="In-memory size"
        value={fmtBytes(ov.memory_bytes)}
        sub="pandas footprint"
        icon="database"
        accent="bg-violet-400"
        tone="text-violet-300"
      />
    </div>
  );
}
