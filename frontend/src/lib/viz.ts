import type { Theme } from './theme';

/** Categorical data-viz palette — stable across light/dark for series identity. */
export const VIZ = [
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#a855f7', // violet
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#eab308', // yellow
];

export const seriesColor = (i: number) => VIZ[i % VIZ.length];

/** Axis / grid / tooltip styling derived from the active theme. */
export function chartTheme(theme: Theme) {
  const dark = theme === 'dark';
  return {
    axis: { stroke: dark ? '#64748b' : '#94a3b8', fontSize: 11 },
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)',
    cursorFill: dark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
    tooltip: {
      background: dark ? 'rgba(16,20,34,0.97)' : 'rgba(255,255,255,0.98)',
      border: `1px solid ${dark ? '#273049' : '#e0e5f0'}`,
      borderRadius: 12,
      color: dark ? '#e9edf7' : '#0f172a',
      fontSize: 12,
      boxShadow: '0 12px 32px -12px rgba(0,0,0,0.4)',
    } as const,
  };
}

/**
 * Diverging color for a correlation cell:
 * rose (negative) → neutral (0) → indigo (positive).
 */
export function corrColor(v: number | null): string {
  if (v === null) return 'transparent';
  const t = Math.max(-1, Math.min(1, v));
  if (t >= 0) return `rgba(99,102,241,${0.1 + t * 0.8})`;
  return `rgba(244,63,94,${0.1 + Math.abs(t) * 0.8})`;
}
