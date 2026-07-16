import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { api, BarData, ColumnProfile, Correlation, HistogramData, ScatterData } from '../lib/api';
import { ErrorBanner, EmptyState, Select, Spinner } from './ui';

const AXIS = { stroke: '#64748b', fontSize: 11 };
const GRID = '#1f294a';

function ChartCard({
  title,
  controls,
  children,
}: {
  title: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">{title}</h3>
        <div className="flex flex-wrap items-end gap-3">{controls}</div>
      </div>
      {children}
    </div>
  );
}

const tooltipStyle = {
  background: '#0b1020',
  border: '1px solid #26315a',
  borderRadius: 12,
  color: '#e8ecf6',
  fontSize: 12,
};

/* -------------------- Histogram -------------------- */
function HistogramChart({ id, numericCols }: { id: string; numericCols: string[] }) {
  const [col, setCol] = useState(numericCols[0] ?? '');
  const [data, setData] = useState<HistogramData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!col) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    api
      .histogram(id, col)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, col]);

  return (
    <ChartCard
      title="Distribution"
      controls={
        <Select
          label="Column"
          value={col}
          onChange={setCol}
          options={numericCols.map((c) => ({ value: c, label: c }))}
        />
      }
    >
      <div className="h-64">
        {loading && <Spinner label="Loading…" />}
        {err && <ErrorBanner message={err} />}
        {!loading && !err && data && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.bins} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="bin" tick={AXIS} interval="preserveStartEnd" tickLine={false} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="count" fill="#5a8cff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

/* -------------------- Categorical bar -------------------- */
function CategoryBarChart({ id, catCols }: { id: string; catCols: string[] }) {
  const [col, setCol] = useState(catCols[0] ?? '');
  const [data, setData] = useState<BarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!col) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    api
      .bar(id, col)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, col]);

  if (catCols.length === 0) {
    return (
      <ChartCard title="Top categories">
        <EmptyState title="No categorical columns" hint="This dataset is all numeric." />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Top categories"
      controls={
        <Select
          label="Column"
          value={col}
          onChange={setCol}
          options={catCols.map((c) => ({ value: c, label: c }))}
        />
      }
    >
      <div className="h-64">
        {loading && <Spinner label="Loading…" />}
        {err && <ErrorBanner message={err} />}
        {!loading && !err && data && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.data}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
            >
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                tick={AXIS}
                width={100}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="count" fill="#8eb4ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

/* -------------------- Scatter -------------------- */
function ScatterPlot({ id, numericCols }: { id: string; numericCols: string[] }) {
  const [x, setX] = useState(numericCols[0] ?? '');
  const [y, setY] = useState(numericCols[1] ?? numericCols[0] ?? '');
  const [data, setData] = useState<ScatterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!x || !y) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    api
      .scatter(id, x, y)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, x, y]);

  if (numericCols.length < 2) {
    return (
      <ChartCard title="Scatter">
        <EmptyState title="Need two numeric columns" hint="Not enough numeric columns to plot." />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Scatter"
      controls={
        <>
          <Select label="X axis" value={x} onChange={setX} options={numericCols.map((c) => ({ value: c, label: c }))} />
          <Select label="Y axis" value={y} onChange={setY} options={numericCols.map((c) => ({ value: c, label: c }))} />
        </>
      }
    >
      <div className="h-64">
        {loading && <Spinner label="Loading…" />}
        {err && <ErrorBanner message={err} />}
        {!loading && !err && data && (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis type="number" dataKey="x" name={x} tick={AXIS} tickLine={false} />
              <YAxis type="number" dataKey="y" name={y} tick={AXIS} tickLine={false} axisLine={false} />
              <ZAxis range={[36, 36]} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={data.points} fill="#5a8cff" fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

/* -------------------- Correlation heatmap -------------------- */
function corrColor(v: number | null): string {
  if (v === null) return 'transparent';
  // diverging: blue (neg) -> slate (0) -> orange (pos)
  const t = Math.max(-1, Math.min(1, v));
  if (t >= 0) {
    const a = 0.12 + t * 0.78;
    return `rgba(90,140,255,${a})`;
  }
  const a = 0.12 + Math.abs(t) * 0.78;
  return `rgba(244,114,95,${a})`;
}

function CorrelationHeatmap({ corr }: { corr: Correlation }) {
  const { columns, matrix } = corr;
  if (columns.length < 2) {
    return (
      <ChartCard title="Correlation heatmap">
        <EmptyState title="Need two numeric columns" />
      </ChartCard>
    );
  }
  return (
    <ChartCard title="Correlation heatmap">
      <div className="overflow-auto">
        <table className="border-separate border-spacing-1 text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-ink-800/60" />
              {columns.map((c) => (
                <th key={c} className="max-w-[64px] truncate px-1 text-slate-400" title={c}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={columns[i]}>
                <td className="sticky left-0 max-w-[90px] truncate bg-ink-800/60 pr-2 text-right text-slate-400" title={columns[i]}>
                  {columns[i]}
                </td>
                {row.map((v, j) => (
                  <td
                    key={j}
                    className="h-10 w-12 rounded text-center font-semibold text-slate-100"
                    style={{ background: corrColor(v) }}
                    title={`${columns[i]} ↔ ${columns[j]}: ${v ?? '—'}`}
                  >
                    {v === null ? '—' : v.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
        <span className="inline-block h-3 w-6 rounded" style={{ background: 'rgba(244,114,95,0.8)' }} /> negative
        <span className="inline-block h-3 w-6 rounded" style={{ background: 'rgba(90,140,255,0.8)' }} /> positive
      </div>
    </ChartCard>
  );
}

export default function Charts({
  id,
  columns,
  correlation,
}: {
  id: string;
  columns: ColumnProfile[];
  correlation: Correlation;
}) {
  const numericCols = useMemo(() => columns.filter((c) => c.is_numeric).map((c) => c.name), [columns]);
  const catCols = useMemo(() => columns.filter((c) => !c.is_numeric).map((c) => c.name), [columns]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {numericCols.length > 0 ? (
        <HistogramChart id={id} numericCols={numericCols} />
      ) : (
        <ChartCard title="Distribution">
          <EmptyState title="No numeric columns" />
        </ChartCard>
      )}
      <CategoryBarChart id={id} catCols={catCols} />
      <ScatterPlot id={id} numericCols={numericCols} />
      <CorrelationHeatmap corr={correlation} />
    </div>
  );
}
