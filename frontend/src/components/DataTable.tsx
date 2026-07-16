import { useEffect, useState } from 'react';
import { api, RowsResponse } from '../lib/api';
import { fmtNum } from '../lib/format';
import { EmptyState, ErrorState, Icon, Spinner } from './ui';

const isNumericLike = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)));

export default function DataTable({ id, columns }: { id: string; columns: string[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterCol, setFilterCol] = useState<string>(columns[0] ?? '');
  const [filterValue, setFilterValue] = useState('');
  const [debounced, setDebounced] = useState('');
  const [data, setData] = useState<RowsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(filterValue);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [filterValue]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    api
      .rows(id, {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
        filter_col: debounced ? filterCol : undefined,
        filter_value: debounced || undefined,
      })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, page, pageSize, sortBy, sortDir, filterCol, debounced, reloadKey]);

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const from = data && data.total > 0 ? (data.page - 1) * data.page_size + 1 : 0;
  const to = data ? Math.min(data.page * data.page_size, data.total) : 0;

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Filter rows…"
            className="input w-52 pl-8"
            aria-label="Filter value"
          />
          {filterValue && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg"
              onClick={() => setFilterValue('')}
              aria-label="Clear filter"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-muted">
          in
          <select
            value={filterCol}
            onChange={(e) => setFilterCol(e.target.value)}
            className="input py-1.5"
            aria-label="Filter column"
          >
            {columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2 text-xs font-medium text-muted">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="input py-1.5"
            aria-label="Rows per page"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="relative max-h-[560px] overflow-auto">
        {err ? (
          <div className="p-4">
            <ErrorState error={err} onRetry={() => setReloadKey((k) => k + 1)} />
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
              <tr>
                {columns.map((c) => {
                  const active = sortBy === c;
                  return (
                    <th
                      key={c}
                      onClick={() => toggleSort(c)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleSort(c))}
                      tabIndex={0}
                      role="columnheader"
                      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="focus-ring cursor-pointer select-none whitespace-nowrap border-b border-line px-3 py-2.5 text-left font-semibold text-muted transition-colors hover:text-fg"
                    >
                      <span className="inline-flex items-center gap-1">
                        {c}
                        <span className={`text-brand-400 transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}>
                          {sortDir === 'asc' ? '▲' : '▼'}
                        </span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row, i) => (
                <tr key={i} className="border-b border-line/60 transition-colors hover:bg-brand-500/[0.06]">
                  {columns.map((c) => {
                    const val = row[c];
                    const empty = val === null || val === undefined || val === '';
                    return (
                      <td
                        key={c}
                        className={`whitespace-nowrap px-3 py-2 ${
                          isNumericLike(val) ? 'num text-right text-fg' : 'text-muted'
                        }`}
                      >
                        {empty ? <span className="italic text-subtle">null</span> : String(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/50 backdrop-blur-[1px]">
            <Spinner label="Loading rows…" />
          </div>
        )}
        {!loading && !err && data && data.rows.length === 0 && (
          <div className="p-6">
            <EmptyState
              title="No rows match your filter"
              hint={debounced ? `Nothing in “${filterCol}” contains “${debounced}”.` : undefined}
              icon="search"
            />
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4 text-sm text-muted">
          <span>
            Showing <span className="num font-semibold text-fg">{fmtNum(from)}</span>–
            <span className="num font-semibold text-fg">{fmtNum(to)}</span> of{' '}
            <span className="num font-semibold text-fg">{fmtNum(data.total)}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button className="btn-ghost px-2.5 py-1.5" disabled={page <= 1} onClick={() => setPage(1)} aria-label="First page">
              «
            </button>
            <button className="btn-ghost px-2.5 py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ‹ Prev
            </button>
            <span className="num px-2 text-xs text-subtle">
              Page {data.page} / {data.total_pages}
            </span>
            <button
              className="btn-ghost px-2.5 py-1.5"
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next ›
            </button>
            <button
              className="btn-ghost px-2.5 py-1.5"
              disabled={page >= data.total_pages}
              onClick={() => setPage(data.total_pages)}
              aria-label="Last page"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
