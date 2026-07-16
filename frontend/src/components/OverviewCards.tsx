import { Overview } from '../lib/api';
import { fmtBytes, fmtNum, fmtPct } from '../lib/format';

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-2 text-3xl font-extrabold ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function OverviewCards({ ov }: { ov: Overview }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card label="Rows" value={fmtNum(ov.rows)} sub={`${fmtNum(ov.duplicate_rows)} duplicates`} accent="text-white" />
      <Card
        label="Columns"
        value={fmtNum(ov.columns)}
        sub={`${ov.numeric_columns} numeric · ${ov.categorical_columns} categorical`}
        accent="text-brand-300"
      />
      <Card
        label="Missing data"
        value={fmtPct(ov.missing_pct)}
        sub={`${fmtNum(ov.missing_cells)} cells`}
        accent={ov.missing_pct > 5 ? 'text-amber-300' : 'text-emerald-300'}
      />
      <Card label="Memory" value={fmtBytes(ov.memory_bytes)} sub="in-memory size" accent="text-white" />
    </div>
  );
}
