import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, Profile } from '../lib/api';
import { fmtNum } from '../lib/format';
import { useToast } from '../lib/toast';
import Charts from './Charts';
import DataTable from './DataTable';
import OverviewCards from './OverviewCards';
import ProfilePanel from './ProfilePanel';
import { DashboardSkeleton } from './Skeletons';
import { ErrorState, Icon, SectionTitle } from './ui';

type Tab = 'overview' | 'charts' | 'data';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'charts', label: 'Charts', icon: 'chart' },
  { key: 'data', label: 'Data table', icon: 'table' },
];

export default function Dashboard() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    api
      .profile(id)
      .then((p) => alive && setProfile(p))
      .catch((e) => alive && setErr(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    setTab('overview');
    return load();
  }, [load]);

  if (loading) return <DashboardSkeleton />;

  if (err instanceof ApiError && err.notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
          <Icon name="database" className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-fg">Dataset not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">
          The dataset <span className="font-mono text-fg">{id}</span> doesn’t exist. Uploaded datasets are kept in
          memory and clear when the server restarts.
        </p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          <Icon name="arrowLeft" className="h-4 w-4" /> Choose another dataset
        </Link>
      </div>
    );
  }

  if (err || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <ErrorState error={err ?? 'No profile available'} onRetry={load} title="Couldn’t profile dataset" />
      </div>
    );
  }

  const onDownload = () => {
    toast.info('Preparing report', 'Your Markdown report download is starting…');
  };

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-8">
      {/* Breadcrumb + title */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-subtle" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-fg">
          Workspace
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-muted">{profile.dataset.name}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{profile.dataset.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="chip num">{fmtNum(profile.overview.rows)} rows</span>
            <span className="chip num">{profile.overview.columns} columns</span>
            <span className="chip">{profile.overview.numeric_columns} numeric</span>
            <span className="chip">{profile.overview.categorical_columns} categorical</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost sm:hidden" onClick={() => navigate('/')}>
            <Icon name="arrowLeft" className="h-4 w-4" /> New
          </button>
          <a href={api.reportUrl(id)} className="btn-primary" download onClick={onDownload}>
            <Icon name="download" className="h-4 w-4" /> Download report
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Dashboard sections"
        className="mb-6 inline-flex w-full gap-1 rounded-xl border border-line bg-surface2/60 p-1 sm:w-auto"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`focus-ring flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all sm:flex-none ${
                active ? 'bg-brand-600 text-white shadow-sm' : 'text-muted hover:bg-surface hover:text-fg'
              }`}
            >
              <Icon name={t.icon} className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="animate-fade-in space-y-8">
          <OverviewCards ov={profile.overview} />
          <div>
            <SectionTitle sub="Type, missing data, uniqueness and per-column statistics">
              Column profiles
            </SectionTitle>
            <ProfilePanel columns={profile.columns} />
          </div>
        </div>
      )}

      {tab === 'charts' && (
        <div className="animate-fade-in">
          <Charts id={id} columns={profile.columns} correlation={profile.correlation} />
        </div>
      )}

      {tab === 'data' && (
        <div className="animate-fade-in">
          <SectionTitle sub="Search and filter · click a header to sort · paginate below">Data preview</SectionTitle>
          <DataTable id={id} columns={profile.columns.map((c) => c.name)} />
        </div>
      )}
    </div>
  );
}
