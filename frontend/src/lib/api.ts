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

export interface Readiness {
  status: 'ready' | 'degraded';
  service: string;
  datasets: number;
}

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Rich error type that understands the backend's RFC-7807 Problem Details
 * bodies while remaining backward compatible with the old `{error}` shape.
 */
export class ApiError extends Error {
  status: number;
  title?: string;
  detail?: string;
  requestId?: string;
  fieldErrors: FieldError[];
  notFound: boolean;

  constructor(init: {
    message: string;
    status: number;
    title?: string;
    detail?: string;
    requestId?: string;
    fieldErrors?: FieldError[];
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.title = init.title;
    this.detail = init.detail;
    this.requestId = init.requestId;
    this.fieldErrors = init.fieldErrors ?? [];
    this.notFound = init.status === 404;
  }
}

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    const requestId = resp.headers.get('X-Request-ID') ?? undefined;
    let message = `Request failed (${resp.status})`;
    let title: string | undefined;
    let detail: string | undefined;
    let fieldErrors: FieldError[] = [];
    try {
      const body = await resp.json();
      // Problem Details (application/problem+json) OR legacy flat {error}.
      detail = body.detail || body.error || undefined;
      title = body.title || undefined;
      message = detail || title || message;
      if (Array.isArray(body.errors)) {
        fieldErrors = body.errors
          .filter((e: unknown): e is FieldError => !!e && typeof e === 'object')
          .map((e: { field?: string; message?: string }) => ({
            field: String(e.field ?? ''),
            message: String(e.message ?? ''),
          }));
      }
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new ApiError({ message, status: resp.status, title, detail, requestId, fieldErrors });
  }
  return resp.json() as Promise<T>;
}

export interface ListDatasetsParams {
  source?: 'sample' | 'upload';
  sort_by?: 'name' | 'rows' | 'columns' | 'source' | 'id';
  sort_dir?: 'asc' | 'desc';
}

export const api = {
  async health(): Promise<{ status: string; service?: string }> {
    return handle(await fetch('/api/health'));
  },
  async ready(): Promise<Readiness> {
    return handle(await fetch('/api/ready'));
  },
  async listDatasets(params: ListDatasetsParams = {}): Promise<DatasetMeta[]> {
    const qs = new URLSearchParams();
    if (params.source) qs.set('source', params.source);
    if (params.sort_by) {
      qs.set('sort_by', params.sort_by);
      qs.set('sort_dir', params.sort_dir ?? 'asc');
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const body = await handle<{ datasets: DatasetMeta[] }>(await fetch(`/api/datasets${suffix}`));
    return body.datasets;
  },
  async upload(file: File): Promise<DatasetMeta> {
    const fd = new FormData();
    fd.append('file', file);
    return handle(await fetch('/api/upload', { method: 'POST', body: fd }));
  },
  async profile(id: string): Promise<Profile> {
    return handle(await fetch(`/api/datasets/${encodeURIComponent(id)}/profile`));
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
    return handle(await fetch(`/api/datasets/${encodeURIComponent(id)}/rows?${qs.toString()}`));
  },
  async histogram(id: string, column: string): Promise<HistogramData> {
    return handle(
      await fetch(`/api/datasets/${encodeURIComponent(id)}/chart?kind=histogram&column=${encodeURIComponent(column)}`)
    );
  },
  async bar(id: string, column: string): Promise<BarData> {
    return handle(
      await fetch(`/api/datasets/${encodeURIComponent(id)}/chart?kind=bar&column=${encodeURIComponent(column)}`)
    );
  },
  async scatter(id: string, x: string, y: string): Promise<ScatterData> {
    return handle(
      await fetch(
        `/api/datasets/${encodeURIComponent(id)}/chart?kind=scatter&x=${encodeURIComponent(x)}&y=${encodeURIComponent(y)}`
      )
    );
  },
  reportUrl(id: string): string {
    return `/api/datasets/${encodeURIComponent(id)}/report`;
  },
};
