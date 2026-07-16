import { useEffect, useState } from 'react';
import { api, Profile } from '../lib/api';
import { fmtNum } from '../lib/format';
import Charts from './Charts';
import DataTable from './DataTable';
import OverviewCards from './OverviewCards';
import ProfilePanel from './ProfilePanel';
import { ErrorBanner, SectionTitle, Spinner } from './ui';

type Tab = 'overview' | 'charts' | 'data';

export default function Dashboard({ id }: { id: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const load = () => {
    setLoading(true);
    setErr(null);
    api
      .profile(id)
      .then(setProfile)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    api
      .profile(id)
      .then((p) => alive && setProfile(p))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <Spinner label="Profiling dataset…" />
      </div>
    );
  }

  if (err || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <ErrorBanner message={err ?? 'No profile available'} onRetry={load} />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'charts', label: 'Charts' },
    { key: 'data', label: 'Data table' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-slate-400">Dataset</div>
          <h1 className="text-2xl font-extrabold text-white">{profile.dataset.name}</h1>
          <div className="mt-1 text-sm text-slate-500">
            {fmtNum(profile.overview.rows)} rows × {profile.overview.columns} columns
          </div>
        </div>
        <a href={api.reportUrl(id)} className="btn-primary" download>
          ⬇ Download report
        </a>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-ink-800/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? 'bg-brand-500 text-white' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-8">
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
        <Charts id={id} columns={profile.columns} correlation={profile.correlation} />
      )}

      {tab === 'data' && (
        <div>
          <SectionTitle sub="Sort by clicking a header · filter with the toolbar">Data preview</SectionTitle>
          <DataTable id={id} columns={profile.columns.map((c) => c.name)} />
        </div>
      )}
    </div>
  );
}
