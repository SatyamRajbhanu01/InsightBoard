import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
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
import { useTheme } from '../lib/theme';
import { chartTheme, corrColor, seriesColor, VIZ } from '../lib/viz';
import { EmptyState, ErrorState, Icon, Select, Skeleton } from './ui';

function ChartCard({
  title,
  icon,
  controls,
  children,
}: {
  title: string;
  icon: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Icon name={icon} className="h-4 w-4 text-brand-300" /> {title}
        </h3>
        <div className="flex flex-wrap items-end gap-3">{controls}</div>
      </div>
      {children}
    </div>
  );
}

function ChartFrame({
  loading,
  error,
  onRetry,
  hasData,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  hasData: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="h-64">
      {loading && <Skeleton className="h-full w-full" />}
      {!loading && !!error && <ErrorState error={error} onRetry={onRetry} />}
      {!loading && !error && !hasData && <EmptyState title="No data to plot" icon="chart" />}
      {!loading && !error && hasData && children}
    </div>
  );
}

/* -------------------- Histogram -------------------- */
function HistogramChart({ id, numericCols }: { id: string; numericCols: string[] }) {
  const { theme } = useTheme();
  const ct = chartTheme(theme);
  const [col, setCol] = useState(numericCols[0] ?? '');
  const [data, setData] = useState<HistogramData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const load = () => {
    if (!col) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    api
      .histogram(id, col)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  };
  useEffect(load, [id, col]);

  return (
    <ChartCard
      title="Distribution"
      icon="chart"
      controls={
        <Select label="Column" value={col} onChange={setCol} options={numericCols.map((c) => ({ value: c, label: c }))} />
      }
    >
      <ChartFrame loading={loading} error={err} onRetry={load} hasData={!!data && data.bins.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.bins} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
            <CartesianGrid stroke={ct.grid} vertical={false} />
            <XAxis dataKey="bin" tick={ct.axis} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: ct.grid }} />
            <YAxis tick={ct.axis} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={ct.tooltip} cursor={{ fill: ct.cursorFill }} />
            <Bar dataKey="count" fill={VIZ[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </ChartCard>
  );
}

/* -------------------- Categorical bar -------------------- */
function CategoryBarChart({ id, catCols }: { id: string; catCols: string[] }) {
  const { theme } = useTheme();
  const ct = chartTheme(theme);
  const [col, setCol] = useState(catCols[0] ?? '');
  const [data, setData] = useState<BarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const load = () => {
    if (!col) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    api
      .bar(id, col)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  };
  useEffect(load, [id, col]);

  if (catCols.length === 0) {
    return (
      <ChartCard title="Top categories" icon="grid">
        <EmptyState title="No categorical columns" hint="This dataset is entirely numeric." icon="grid" />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Top categories"
      icon="grid"
      controls={
        <Select label="Column" value={col} onChange={setCol} options={catCols.map((c) => ({ value: c, label: c }))} />
      }
    >
      <ChartFrame loading={loading} error={err} onRetry={load} hasData={!!data && data.data.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid stroke={ct.grid} horizontal={false} />
            <XAxis type="number" tick={ct.axis} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" tick={ct.axis} width={110} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={ct.tooltip} cursor={{ fill: ct.cursorFill }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {(data?.data ?? []).map((_, i) => (
                <Cell key={i} fill={seriesColor(i)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </ChartCard>
  );
}

/* -------------------- Scatter -------------------- */
function ScatterPlot({ id, numericCols }: { id: string; numericCols: string[] }) {
  const { theme } = useTheme();
  const ct = chartTheme(theme);
  const [x, setX] = useState(numericCols[0] ?? '');
  const [y, setY] = useState(numericCols[1] ?? numericCols[0] ?? '');
  const [data, setData] = useState<ScatterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const load = () => {
    if (!x || !y) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    api
      .scatter(id, x, y)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  };
  useEffect(load, [id, x, y]);

  if (numericCols.length < 2) {
    return (
      <ChartCard title="Scatter" icon="spark">
        <EmptyState title="Need two numeric columns" hint="Not enough numeric columns to plot." icon="spark" />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Scatter"
      icon="spark"
      controls={
        <>
          <Select label="X axis" value={x} onChange={setX} options={numericCols.map((c) => ({ value: c, label: c }))} />
          <Select label="Y axis" value={y} onChange={setY} options={numericCols.map((c) => ({ value: c, label: c }))} />
        </>
      }
    >
      <ChartFrame loading={loading} error={err} onRetry={load} hasData={!!data && data.points.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
            <CartesianGrid stroke={ct.grid} />
            <XAxis type="number" dataKey="x" name={x} tick={ct.axis} tickLine={false} axisLine={{ stroke: ct.grid }} />
            <YAxis type="number" dataKey="y" name={y} tick={ct.axis} tickLine={false} axisLine={false} />
            <ZAxis range={[40, 40]} />
            <Tooltip contentStyle={ct.tooltip} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data?.points} fill={VIZ[0]} fillOpacity={0.65} />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFrame>
    </ChartCard>
  );
}

/* -------------------- Correlation heatmap -------------------- */
function CorrelationHeatmap({ corr }: { corr: Correlation }) {
  const { columns, matrix } = corr;
  if (columns.length < 2) {
    return (
      <ChartCard title="Correlation heatmap" icon="layers">
        <EmptyState title="Need two numeric columns" icon="layers" />
      </ChartCard>
    );
  }
  return (
    <ChartCard title="Correlation heatmap" icon="layers">
      <div className="overflow-auto">
        <table className="border-separate border-spacing-1 text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface" />
              {columns.map((c) => (
                <th key={c} className="max-w-[64px] truncate px-1 font-medium text-muted" title={c}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={columns[i]}>
                <td
                  className="sticky left-0 max-w-[90px] truncate bg-surface pr-2 text-right font-medium text-muted"
                  title={columns[i]}
                >
                  {columns[i]}
                </td>
                {row.map((v, j) => (
                  <td
                    key={j}
                    className="num h-10 w-12 rounded text-center font-semibold text-fg"
                    style={{
                      background: corrColor(v),
                      color: v !== null && Math.abs(v) > 0.6 ? '#fff' : undefined,
                    }}
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
      <div className="mt-3 flex items-center gap-4 text-[11px] text-subtle">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded" style={{ background: corrColor(-0.9) }} /> negative
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded" style={{ background: corrColor(0.9) }} /> positive
        </span>
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
        <ChartCard title="Distribution" icon="chart">
          <EmptyState title="No numeric columns" icon="chart" />
        </ChartCard>
      )}
      <CategoryBarChart id={id} catCols={catCols} />
      <ScatterPlot id={id} numericCols={numericCols} />
      <CorrelationHeatmap corr={correlation} />
    </div>
  );
}
