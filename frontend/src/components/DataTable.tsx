import { useEffect, useState } from 'react';
import { api, RowsResponse } from '../lib/api';
import { ErrorBanner, Spinner } from './ui';

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
  const [err, setErr] = useState<string | null>(null);

  // debounce filter typing
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
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, page, pageSize, sortBy, sortDir, filterCol, debounced]);

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4">
        <div className="flex items-center gap-2">
          <select
            value={filterCol}
            onChange={(e) => setFilterCol(e.target.value)}
            className="rounded-lg border border-white/10 bg-ink-900/70 px-2 py-1.5 text-sm text-slate-100 focus:border-brand-400 focus:outline-none"
            aria-label="Filter column"
          >
            {columns.map((c) => (
              <option key={c} value={c} className="bg-ink-900">
                {c}
              </option>
            ))}
          </select>
          <input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Filter rows…"
            className="w-48 rounded-lg border border-white/10 bg-ink-900/70 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none"
            aria-label="Filter value"
          />
          {filterValue && (
            <button className="text-xs text-slate-400 hover:text-white" onClick={() => setFilterValue('')}>
              clear
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <span>Rows/page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-white/10 bg-ink-900/70 px-2 py-1 text-slate-100 focus:border-brand-400 focus:outline-none"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n} className="bg-ink-900">
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="relative max-h-[520px] overflow-auto">
        {err && (
          <div className="p-4">
            <ErrorBanner message={err} />
          </div>
        )}
        {!err && (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-ink-900/90 backdrop-blur">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    onClick={() => toggleSort(c)}
                    className="cursor-pointer select-none whitespace-nowrap border-b border-white/10 px-3 py-2.5 text-left font-semibold text-slate-300 hover:text-white"
                  >
                    <span className="inline-flex items-center gap-1">
                      {c}
                      {sortBy === c && <span className="text-brand-300">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row, i) => (
                <tr key={i} className="odd:bg-white/[0.02] hover:bg-brand-500/5">
                  {columns.map((c) => (
                    <td key={c} className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {row[c] === null || row[c] === undefined ? (
                        <span className="text-slate-600 italic">null</span>
                      ) : (
                        String(row[c])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-900/40">
            <Spinner label="Loading rows…" />
          </div>
        )}
        {!loading && !err && data && data.rows.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">No rows match your filter.</div>
        )}
      </div>

      {/* Pagination */}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4 text-sm text-slate-400">
          <span>
            {data.total.toLocaleString()} rows · page {data.page} of {data.total_pages}
          </span>
          <div className="flex items-center gap-2">
            <button className="btn-ghost px-3 py-1.5" disabled={page <= 1} onClick={() => setPage(1)}>
              « First
            </button>
            <button className="btn-ghost px-3 py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ‹ Prev
            </button>
            <button
              className="btn-ghost px-3 py-1.5"
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next ›
            </button>
            <button
              className="btn-ghost px-3 py-1.5"
              disabled={page >= data.total_pages}
              onClick={() => setPage(data.total_pages)}
            >
              Last »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
