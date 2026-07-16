export interface DatasetMeta {
  id: string;
  name: string;
  source: 'sample' | 'upload';
  rows: number;
  columns: number;
  description?: string;
}

export interface Overview {
  rows: number;
  columns: number;
  numeric_columns: number;
  categorical_columns: number;
  missing_cells: number;
  missing_pct: number;
  duplicate_rows: number;
  memory_bytes: number;
}

export interface NumericStats {
  mean: number | null;
  median: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  count: number;
  missing: number;
  missing_pct: number;
  unique: number;
  is_numeric: boolean;
  stats?: NumericStats;
  top_values?: { value: string; count: number }[];
}

export interface Correlation {
  columns: string[];
  matrix: (number | null)[][];
}

export interface Profile {
  overview: Overview;
  columns: ColumnProfile[];
  correlation: Correlation;
  dataset: { id: string; name: string };
}

export interface RowsResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface HistogramData {
  column: string;
  bins: { bin: string; start: number; end: number; count: number }[];
}

export interface BarData {
  column: string;
  data: { label: string; count: number }[];
}

export interface ScatterData {
  x: string;
  y: string;
  points: { x: number | null; y: number | null }[];
}

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let msg = `Request failed (${resp.status})`;
    try {
      const body = await resp.json();
      msg = body.error || body.detail || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  async health(): Promise<{ status: string }> {
    return handle(await fetch('/api/health'));
  },
  async listDatasets(): Promise<DatasetMeta[]> {
    const body = await handle<{ datasets: DatasetMeta[] }>(await fetch('/api/datasets'));
    return body.datasets;
  },
  async upload(file: File): Promise<DatasetMeta> {
    const fd = new FormData();
    fd.append('file', file);
    return handle(await fetch('/api/upload', { method: 'POST', body: fd }));
  },
  async profile(id: string): Promise<Profile> {
    return handle(await fetch(`/api/datasets/${id}/profile`));
  },
  async rows(
    id: string,
    params: {
      page: number;
      page_size: number;
      sort_by?: string;
      sort_dir?: string;
      filter_col?: string;
      filter_value?: string;
    }
  ): Promise<RowsResponse> {
    const qs = new URLSearchParams();
    qs.set('page', String(params.page));
    qs.set('page_size', String(params.page_size));
    if (params.sort_by) {
      qs.set('sort_by', params.sort_by);
      qs.set('sort_dir', params.sort_dir || 'asc');
    }
    if (params.filter_col && params.filter_value) {
      qs.set('filter_col', params.filter_col);
      qs.set('filter_value', params.filter_value);
    }
    return handle(await fetch(`/api/datasets/${id}/rows?${qs.toString()}`));
  },
  async histogram(id: string, column: string): Promise<HistogramData> {
    return handle(
      await fetch(`/api/datasets/${id}/chart?kind=histogram&column=${encodeURIComponent(column)}`)
    );
  },
  async bar(id: string, column: string): Promise<BarData> {
    return handle(
      await fetch(`/api/datasets/${id}/chart?kind=bar&column=${encodeURIComponent(column)}`)
    );
  },
  async scatter(id: string, x: string, y: string): Promise<ScatterData> {
    return handle(
      await fetch(
        `/api/datasets/${id}/chart?kind=scatter&x=${encodeURIComponent(x)}&y=${encodeURIComponent(y)}`
      )
    );
  },
  reportUrl(id: string): string {
    return `/api/datasets/${id}/report`;
  },
};
