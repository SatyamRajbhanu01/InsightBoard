import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, DatasetMeta } from '../lib/api';
import { useToast } from '../lib/toast';
import { fmtNum } from '../lib/format';
import { EmptyState, ErrorState, Icon, Skeleton } from './ui';

const MAX_MB = 10;

const SAMPLE_ICON: Record<string, string> = {
  'sample-ecommerce': 'database',
  'sample-iris': 'compass',
  'sample-tips': 'layers',
};

const FEATURES = [
  { icon: 'grid', title: 'Column profiling', text: 'Types, missingness, uniqueness and per-column statistics at a glance.' },
  { icon: 'chart', title: 'Instant charts', text: 'Distributions, top categories and scatter plots — no config required.' },
  { icon: 'spark', title: 'Correlations', text: 'A themed diverging heatmap reveals relationships across numeric fields.' },
  { icon: 'download', title: 'Shareable reports', text: 'Export a full Markdown data report to hand off with one click.' },
];

function UploadZone({ onUploaded }: { onUploaded: (meta: DatasetMeta) => void }) {
  const toast = useToast();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('That file isn’t a .csv — please choose a comma-separated values file.');
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB.`);
        return;
      }
      if (file.size === 0) {
        setError('That file is empty.');
        return;
      }
      setUploading(true);
      try {
        const meta = await api.upload(file);
        toast.success('Dataset ready', `Profiled “${meta.name}” — ${fmtNum(meta.rows)} rows.`);
        onUploaded(meta);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        const requestId = e instanceof ApiError ? e.requestId : undefined;
        setError(msg);
        toast.error('Upload failed', msg, requestId ? `Request ID: ${requestId}` : undefined);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded, toast]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`group relative overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-10 ${
        dragging ? 'border-brand-400 bg-brand-500/10' : 'border-line bg-surface/60 hover:border-brand-400/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Upload a CSV file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl text-brand-300 transition-transform ${
            dragging ? 'scale-110 bg-brand-500/25' : 'bg-brand-500/15 group-hover:scale-105'
          }`}
        >
          <Icon name="upload" className="h-7 w-7" />
        </div>
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-400/30 border-t-brand-400" />
            <p className="text-sm font-medium text-muted">Parsing and profiling…</p>
          </div>
        ) : (
          <>
            <p className="text-lg font-semibold text-fg">Drop a CSV to build a dashboard</p>
            <p className="text-sm text-muted">or</p>
            <button className="btn-primary" onClick={() => inputRef.current?.click()}>
              <Icon name="upload" className="h-4 w-4" /> Browse files
            </button>
            <p className="text-xs text-subtle">CSV only · up to {MAX_MB} MB · 200k rows · processed in-memory</p>
          </>
        )}
      </div>
      {error && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300" role="alert">
          <Icon name="alert" className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

type SortKey = 'name' | 'rows' | 'columns';

function SamplePicker({ onSelect }: { onSelect: (id: string) => void }) {
  const [samples, setSamples] = useState<DatasetMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .listDatasets({ source: 'sample' })
      .then(setSamples)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? samples.filter(
          (s) => s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q)
        )
      : samples;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (b[sortBy] as number) - (a[sortBy] as number);
    });
  }, [samples, query, sortBy]);

  return (
    <section className="mt-14" aria-labelledby="samples-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="samples-heading" className="text-lg font-bold tracking-tight text-fg">
            Explore a sample dataset
          </h2>
          <p className="mt-0.5 text-sm text-muted">No upload needed — click any card to open its workspace.</p>
        </div>
        {!loading && !error && samples.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search samples…"
                aria-label="Search sample datasets"
                className="input w-44 pl-8"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort samples"
              className="input"
            >
              <option value="name">Name</option>
              <option value="rows">Most rows</option>
              <option value="columns">Most columns</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={load} title="Couldn’t load samples" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={query ? 'No matching samples' : 'No sample datasets'}
          hint={query ? 'Try a different search term.' : 'Upload a CSV above to get started.'}
          icon="search"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{ animationDelay: `${i * 60}ms` }}
              className="card focus-ring group flex animate-fade-in flex-col items-start gap-3 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-400/50 hover:shadow-card-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/12 text-brand-300 transition-colors group-hover:bg-brand-500/20">
                <Icon name={SAMPLE_ICON[s.id] ?? 'grid'} className="h-5 w-5" />
              </div>
              <div className="font-semibold text-fg group-hover:text-brand-300">{s.name}</div>
              <div className="line-clamp-2 text-sm text-muted">{s.description}</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="chip num">{fmtNum(s.rows)} rows</span>
                <span className="chip num">{s.columns} cols</span>
              </div>
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
                Open workspace <Icon name="arrowLeft" className="h-3.5 w-3.5 rotate-180" />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const select = useCallback(
    (id: string) => {
      navigate(`/d/${encodeURIComponent(id)}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <span className="chip mb-5 animate-fade-in">
          <Icon name="sparkles" className="h-3.5 w-3.5 text-brand-300" />
          Profiling · Charts · Correlations · Reports
        </span>
        <h1 className="animate-fade-in text-4xl font-extrabold leading-[1.1] tracking-tight text-fg sm:text-6xl">
          Turn any CSV into a<br className="hidden sm:block" /> <span className="text-gradient">live analytics workspace</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl animate-fade-in text-base text-muted sm:text-lg">
          Drop a spreadsheet and InsightBoard profiles every column, surfaces missing data, plots distributions
          and correlations, and lets you slice through the rows — all in your browser, in seconds.
        </p>
      </div>

      {/* Upload */}
      <div className="mx-auto mt-10 max-w-2xl animate-scale-in">
        <UploadZone onUploaded={(m) => select(m.id)} />
      </div>

      {/* Feature grid */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            style={{ animationDelay: `${i * 70}ms` }}
            className="card-quiet animate-fade-in p-5"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface2 text-brand-300">
              <Icon name={f.icon} className="h-5 w-5" />
            </div>
            <div className="font-semibold text-fg">{f.title}</div>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </div>
        ))}
      </div>

      {/* Samples */}
      <SamplePicker onSelect={select} />
    </div>
  );
}
