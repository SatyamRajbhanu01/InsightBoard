import React, { useCallback, useRef, useState } from 'react';
import { api, DatasetMeta } from '../lib/api';
import { Spinner } from './ui';

interface Props {
  samples: DatasetMeta[];
  loadingSamples: boolean;
  onSelect: (id: string) => void;
}

const SAMPLE_ICON: Record<string, string> = {
  'sample-ecommerce': '🛒',
  'sample-iris': '🌸',
  'sample-tips': '🍽️',
};

export default function Landing({ samples, loadingSamples, onSelect }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Please choose a .csv file.');
        return;
      }
      setUploading(true);
      try {
        const meta = await api.upload(file);
        onSelect(meta.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onSelect]
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
    <div className="mx-auto max-w-5xl px-4 py-14">
      <div className="text-center">
        <span className="chip mb-4">CSV · Profiling · Charts · Correlations</span>
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Turn any CSV into an{' '}
          <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
            instant dashboard
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-400">
          Drop a spreadsheet and InsightBoard profiles every column, surfaces missing data,
          plots distributions and correlations, and lets you slice through the rows — all in your
          browser.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-10 rounded-3xl border-2 border-dashed p-10 text-center transition ${
          dragging ? 'border-brand-400 bg-brand-500/10' : 'border-white/15 bg-ink-800/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/20 text-2xl">
            📤
          </div>
          {uploading ? (
            <Spinner label="Parsing and profiling…" />
          ) : (
            <>
              <p className="text-lg font-semibold text-white">Drag &amp; drop your CSV here</p>
              <p className="text-sm text-slate-400">or</p>
              <button className="btn-primary" onClick={() => inputRef.current?.click()}>
                Browse files
              </button>
              <p className="text-xs text-slate-500">CSV only · up to 10 MB · 200k rows</p>
            </>
          )}
        </div>
        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      </div>

      {/* Sample picker */}
      <div className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Or explore a sample dataset</h2>
          <span className="text-xs text-slate-500">No upload needed — click to explore</span>
        </div>

        {loadingSamples ? (
          <div className="py-8">
            <Spinner label="Loading samples…" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {samples.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="card group flex flex-col items-start gap-2 p-5 text-left transition hover:border-brand-400/50 hover:bg-ink-700/60"
              >
                <div className="text-3xl">{SAMPLE_ICON[s.id] ?? '📊'}</div>
                <div className="font-semibold text-white group-hover:text-brand-200">{s.name}</div>
                <div className="text-sm text-slate-400">{s.description}</div>
                <div className="mt-2 flex gap-2">
                  <span className="chip">{s.rows.toLocaleString()} rows</span>
                  <span className="chip">{s.columns} cols</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
