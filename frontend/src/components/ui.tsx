import React from 'react';
import { ApiError } from '../lib/api';

/* --------------------------------------------------------------------------
   Icon set (inline, currentColor)
   -------------------------------------------------------------------------- */
const PATHS: Record<string, string> = {
  upload: 'M12 15V3m0 0 4 4m-4-4L8 7M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  chart: 'M3 3v18h18M8 17V9m5 8V5m5 12v-6',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  table: 'M3 4h18v16H3zM3 10h18M9 4v16',
  sun: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36-.7-.7M6.34 6.34l-.7-.7m12.72 0-.7.7M6.34 17.66l-.7.7M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  arrowLeft: 'M19 12H5m0 0 7 7m-7-7 7-7',
  search: 'm21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  x: 'M18 6 6 18M6 6l12 12',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16m0 5v-5h5',
  sparkles: 'M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  spark: 'M13 2 3 14h7l-1 8 10-12h-7z',
  layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
  alert: 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  database: 'M12 8c4.42 0 8-1.34 8-3s-3.58-3-8-3-8 1.34-8 3 3.58 3 8 3zM4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
};

export function Icon({
  name,
  className = 'h-5 w-5',
  strokeWidth = 2,
}: {
  name: keyof typeof PATHS | string;
  className?: string;
  strokeWidth?: number;
}) {
  const d = PATHS[name] ?? '';
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/* --------------------------------------------------------------------------
   Brand mark
   -------------------------------------------------------------------------- */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow ${className}`}
      aria-hidden="true"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="12" width="3.2" height="8" rx="1.2" fill="#c7d2fe" />
        <rect x="10.4" y="7" width="3.2" height="13" rx="1.2" fill="#ffffff" />
        <rect x="16.8" y="4" width="3.2" height="16" rx="1.2" fill="#5eead4" />
      </svg>
    </span>
  );
}

/* --------------------------------------------------------------------------
   Feedback: spinner, skeleton, error, empty
   -------------------------------------------------------------------------- */
export function Spinner({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-muted ${className}`} role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400/30 border-t-brand-400" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />;
}

export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div
      role="alert"
      className="animate-fade-in rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm"
    >
      <div className="flex items-start gap-3">
        <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-rose-200">{title}</div>
          <div className="mt-1 break-words text-rose-200/80">{message}</div>
          {requestId && (
            <div className="mt-2 font-mono text-[11px] text-rose-200/60">
              Request ID: {requestId}
            </div>
          )}
          {onRetry && (
            <button className="btn-ghost mt-3" onClick={onRetry}>
              <Icon name="refresh" className="h-4 w-4" /> Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon = 'grid',
  action,
}: {
  title: string;
  hint?: string;
  icon?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface2/40 p-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface2 text-muted">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <div className="font-semibold text-fg">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-sm text-muted">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Form controls
   -------------------------------------------------------------------------- */
export function Select({
  value,
  onChange,
  options,
  label,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  id?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label && <span>{label}</span>}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input w-full appearance-none pr-8"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  );
}

/* --------------------------------------------------------------------------
   Layout helpers
   -------------------------------------------------------------------------- */
export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold tracking-tight text-fg">{children}</h2>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function ThemeToggle({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  const isDark = theme === 'dark';
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="btn-ghost h-9 w-9 rounded-xl p-0"
    >
      <Icon name={isDark ? 'moon' : 'sun'} className="h-[18px] w-[18px]" />
    </button>
  );
}
