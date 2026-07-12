import { useState, useMemo, useCallback } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Users, TrendingUp, Eye, Activity, FileText, Star, RefreshCw,
  Wifi, WifiOff, Calendar, ChevronDown, X
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import ChartCard from '../components/ui/ChartCard';
import PlatformBadge from '../components/ui/PlatformBadge';
import { followerGrowthTrend, engagementTrend, reachTrend, contentData, accountData } from '../data/mockData';
import { useSocialData } from '../hooks/useSocialData';
import { useWorkspace } from '../context/WorkspaceContext';
import { DashboardSkeleton } from '../components/ui/Skeleton';

const COLORS  = { instagram: '#E040FB', tiktok: '#26C6DA', threads: '#9E9E9E' };
const PLABELS = { instagram: 'IG', tiktok: 'TT', threads: 'TH' };
const PLATFORM_KEYS    = ['instagram', 'tiktok', 'threads'];
const PLATFORM_LABELS  = ['Semua', 'Instagram', 'TikTok', 'Threads'];

const DATE_PRESETS = [
  { key: '7d',  label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: '90d', label: '90 Hari' },
  { key: 'custom', label: 'Kustom' },
];

// ── Utils ──────────────────────────────────────────────────────
function fmtNum(n) {
  if (n == null || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function toDateStr(d) { return d.toISOString().split('T')[0]; }

function getDateBounds(preset, customStart, customEnd) {
  const today = toDateStr(new Date());
  if (preset === 'custom') return { startStr: customStart || today, endStr: customEnd || today };
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const start = new Date(Date.now() - days * 86_400_000);
  return { startStr: toDateStr(start), endStr: today };
}

function getLatestMetric(rows) {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => b.metric_date?.localeCompare(a.metric_date))[0];
}

function filterByDate(rows, startStr, endStr) {
  return (rows ?? []).filter(r => r.metric_date >= startStr && r.metric_date <= endStr);
}

// ── KPI computation ────────────────────────────────────────────
function computeKPIs(accounts, metrics, contents, platformFilter, startStr, endStr) {
  const keys = platformFilter === 'Semua' ? PLATFORM_KEYS : [platformFilter.toLowerCase()];

  const perPlatform = {};
  PLATFORM_KEYS.forEach(k => {
    const acc  = accounts[k];
    const mock = accountData[k] ?? {};
    const rows = filterByDate(metrics[k], startStr, endStr);
    const latest = getLatestMetric(rows);

    // Reach: sum account_metrics.reach over date range (same as AccountAnalytics)
    const reach = rows.reduce((s, r) => s + (r.reach ?? 0), 0)
      || (rows.length ? 0 : (mock.reach ?? 0));

    // Impressions: sum account_metrics.impressions; fallback to content_metrics.views (same as AccountAnalytics)
    const metricImp = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
    const contentViews = contents
      .filter(c => c.platform?.toLowerCase() === k)
      .reduce((s, c) => s + (c.content_metrics?.[0]?.views ?? 0), 0);
    const impressions = metricImp > 0 ? metricImp : (contentViews || (rows.length ? 0 : (mock.impressions ?? 0)));

    perPlatform[k] = {
      followers:   acc?.followers_count ?? latest?.followers ?? mock.followers ?? 0,
      reach,
      impressions,
      er:          latest?.engagement_rate ?? (rows.length ? null : (mock.engagementRate ?? null)),
    };
  });

  let totalFollowers = 0, totalReach = 0, totalImpressions = 0;
  const erValues = [];
  keys.forEach(k => {
    totalFollowers   += perPlatform[k].followers;
    totalReach       += perPlatform[k].reach;
    totalImpressions += perPlatform[k].impressions;
    if (perPlatform[k].er != null) erValues.push(perPlatform[k].er);
  });
  const avgER = erValues.length
    ? +(erValues.reduce((a, b) => a + b, 0) / erValues.length).toFixed(2)
    : 0;

  let bestPlatform = 'TikTok', bestER = 0;
  PLATFORM_KEYS.forEach(k => {
    const er = perPlatform[k].er ?? 0;
    if (er > bestER) { bestER = er; bestPlatform = k.charAt(0).toUpperCase() + k.slice(1); }
  });

  const filteredContents = platformFilter === 'Semua'
    ? contents
    : contents.filter(c => c.platform?.toLowerCase() === platformFilter.toLowerCase());

  // breakdown arrays for Semua mode
  const mkBreakdown = (field, isPercent = false) =>
    PLATFORM_KEYS.map(k => ({
      key: k,
      label: PLABELS[k],
      color: COLORS[k],
      display: isPercent
        ? `${(perPlatform[k].er ?? 0).toFixed(1)}%`
        : fmtNum(perPlatform[k][field]),
    }));

  return {
    totalFollowers, totalReach, totalImpressions, avgER,
    contentCount: filteredContents.length,
    bestPlatform,
    perPlatform,
    breakdowns: {
      followers:   mkBreakdown('followers'),
      reach:       mkBreakdown('reach'),
      impressions: mkBreakdown('impressions'),
      er:          mkBreakdown('er', true),
    },
  };
}

// ── Monthly chart data ─────────────────────────────────────────
function buildMonthlyChart(metrics, startStr, endStr) {
  const byMonth = {};
  PLATFORM_KEYS.forEach(k => {
    const rows = filterByDate(metrics[k], startStr, endStr);
    rows.forEach(r => {
      const m = r.metric_date?.slice(0, 7);
      if (!m) return;
      if (!byMonth[m]) byMonth[m] = {};
      const v = byMonth[m];
      v[k]           = Math.max(v[k] ?? 0, r.followers ?? 0);
      v[k + '_r']    = (v[k + '_r'] ?? 0) + (r.reach ?? 0);
      if (!v[k + '_ea']) v[k + '_ea'] = [];
      if (r.engagement_rate) v[k + '_ea'].push(r.engagement_rate);
    });
  });
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => {
      const row = { month: new Date(m + '-01').toLocaleString('id-ID', { month: 'short' }) };
      PLATFORM_KEYS.forEach(k => {
        row[k]            = v[k] || null;
        row[k + '_reach'] = v[k + '_r'] || null;
        const ea          = v[k + '_ea'] ?? [];
        row[k + '_er']    = ea.length
          ? +(ea.reduce((a, b) => a + b, 0) / ea.length).toFixed(2)
          : null;
      });
      return row;
    });
}

// ── Audience card ──────────────────────────────────────────────
function AudienceCard({ platformKey, account, perPlatformData, isActive, onClick }) {
  const mock = accountData[platformKey] ?? {};
  const { followers, reach, er } = perPlatformData;
  const username = account
    ? `@${account.account_name || account.username || ''}`
    : mock.username;

  return (
    <button onClick={onClick}
      className={`flex-1 min-w-0 rounded-2xl border p-3 transition-all duration-200 text-left
        ${isActive
          ? 'border-violet-400 bg-violet-50 shadow-purple'
          : 'border-purple-100 bg-white hover:border-violet-200 hover:shadow-soft'}`}>
      <div className="flex items-center justify-between mb-2">
        <PlatformBadge platform={platformKey.charAt(0).toUpperCase() + platformKey.slice(1)} size="sm" />
        {account
          ? <span className="text-[10px] text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5"><Wifi size={8} /> Live</span>
          : <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5"><WifiOff size={8} /> Demo</span>}
      </div>
      {username && <p className="text-[10px] text-gray-400 truncate mb-1">{username}</p>}
      <p className="text-xl font-bold text-gray-800 leading-none">{fmtNum(followers)}</p>
      <p className="text-[10px] text-gray-400 mb-2">followers</p>
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <div className="bg-lavender-50 rounded-lg px-1.5 py-1">
          <p className="text-gray-400">ER</p>
          <p className="font-semibold text-gray-700">{(er ?? 0).toFixed(2)}%</p>
        </div>
        <div className="bg-lavender-50 rounded-lg px-1.5 py-1">
          <p className="text-gray-400">Reach</p>
          <p className="font-semibold text-gray-700">{fmtNum(reach) || '–'}</p>
        </div>
      </div>
    </button>
  );
}

// ── Date Range Picker ──────────────────────────────────────────
function DateRangePicker({ preset, customStart, customEnd, onChange }) {
  const [open, setOpen] = useState(false);

  const { startStr, endStr } = getDateBounds(preset, customStart, customEnd);
  const displayLabel = preset === 'custom'
    ? `${customStart || '–'} → ${customEnd || '–'}`
    : DATE_PRESETS.find(p => p.key === preset)?.label;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-purple-100 hover:border-violet-300 text-sm text-gray-600 hover:text-violet-600 transition-colors shadow-sm">
        <Calendar size={14} />
        <span className="font-medium">{displayLabel}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-purple-100 rounded-2xl shadow-lg p-4 min-w-[280px]">
          <p className="text-xs font-semibold text-gray-500 mb-2">Rentang waktu</p>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {DATE_PRESETS.filter(p => p.key !== 'custom').map(p => (
              <button key={p.key}
                onClick={() => { onChange({ preset: p.key, customStart: '', customEnd: '' }); setOpen(false); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                  ${preset === p.key && preset !== 'custom'
                    ? 'bg-gradient-to-r from-violet-500 to-purple-400 text-white'
                    : 'bg-lavender-50 text-gray-600 hover:bg-lavender-100'}`}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t border-purple-50 pt-3">
            <p className="text-xs text-gray-400 mb-2">Atau pilih rentang kustom</p>
            <div className="flex items-center gap-2">
              <input type="date" value={customStart}
                onChange={e => onChange({ preset: 'custom', customStart: e.target.value, customEnd })}
                className="flex-1 text-xs border border-purple-100 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-violet-400" />
              <span className="text-gray-400 text-xs">→</span>
              <input type="date" value={customEnd}
                onChange={e => onChange({ preset: 'custom', customStart, customEnd: e.target.value })}
                className="flex-1 text-xs border border-purple-100 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-violet-400" />
            </div>
            {preset === 'custom' && customStart && customEnd && (
              <button onClick={() => setOpen(false)}
                className="mt-2 w-full py-1.5 bg-gradient-to-r from-violet-500 to-purple-400 text-white text-xs font-semibold rounded-lg">
                Terapkan
              </button>
            )}
          </div>

          <button onClick={() => setOpen(false)}
            className="absolute top-3 right-3 text-gray-300 hover:text-gray-500">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── CustomTooltip ──────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-purple-100 p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold ml-0.5">
            {typeof p.value === 'number' && p.value > 1000
              ? p.value.toLocaleString('id-ID')
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
};

// ── Dashboard ──────────────────────────────────────────────────
export default function Dashboard() {
  const [activePlatform, setActivePlatform] = useState('Semua');
  const [dateFilter, setDateFilter] = useState({ preset: '30d', customStart: '', customEnd: '' });
  const { activeWorkspace } = useWorkspace();
  const { accounts, metrics, contents, syncing, loading, reload } = useSocialData(activeWorkspace?.id);

  const hasRealData = Object.keys(accounts).length > 0;
  const { startStr, endStr } = useMemo(
    () => getDateBounds(dateFilter.preset, dateFilter.customStart, dateFilter.customEnd),
    [dateFilter]
  );

  const kpi = useMemo(
    () => computeKPIs(accounts, metrics, contents, activePlatform, startStr, endStr),
    [accounts, metrics, contents, activePlatform, startStr, endStr]
  );

  const chartKeys = activePlatform === 'Semua' ? PLATFORM_KEYS : [activePlatform.toLowerCase()];
  const realTrend = useMemo(() => buildMonthlyChart(metrics, startStr, endStr), [metrics, startStr, endStr]);

  const followerData = realTrend.length ? realTrend : followerGrowthTrend;
  const erData = realTrend.length
    ? realTrend.map(r => ({ month: r.month, instagram: r.instagram_er, tiktok: r.tiktok_er, threads: r.threads_er }))
    : engagementTrend;
  const reachData = realTrend.length
    ? realTrend.map(r => ({ month: r.month, instagram: r.instagram_reach, tiktok: r.tiktok_reach, threads: r.threads_reach }))
    : reachTrend;

  const topContent = useMemo(() => {
    const list = contents.length ? contents : contentData;
    const filtered = activePlatform === 'Semua' ? list : list.filter(c => c.platform?.toLowerCase() === activePlatform.toLowerCase());
    return (filtered.length ? filtered : list)
      .map(c => {
        const m = c.content_metrics?.[0] ?? c;
        const er    = m.engagement_rate ?? c.engagementRate ?? 0;
        const likes = m.likes ?? c.avgLikes ?? 0;
        const comments = m.comments ?? c.avgComments ?? 0;
        const score = Math.min(100, Math.round(er * 10 + Math.log1p(likes + comments)));
        return {
          id: c.id ?? Math.random(),
          title: c.caption?.slice(0, 55) ?? c.title ?? c.content_type ?? '–',
          platform: c.platform,
          engagementRate: +er.toFixed(2),
          performanceScore: score || c.performanceScore || 0,
        };
      })
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 5);
  }, [contents, activePlatform]);

  const showBreakdown = activePlatform === 'Semua';

  const handleDateChange = useCallback((val) => setDateFilter(val), []);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-5">

      {/* Top bar: platform tabs + date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Platform tabs */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {PLATFORM_LABELS.map(p => (
            <button key={p} onClick={() => setActivePlatform(p)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150
                ${activePlatform === p
                  ? 'bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-purple'
                  : 'bg-white text-gray-500 border border-purple-100 hover:border-violet-300 hover:text-violet-600'}`}>
              {p}
            </button>
          ))}
        </div>

        {/* Date range + refresh */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {syncing && (
            <span className="text-xs text-violet-500 flex items-center gap-1">
              <RefreshCw size={11} className="animate-spin" /> Sinkronisasi...
            </span>
          )}
          <button onClick={reload} className="text-xs text-gray-400 hover:text-violet-500 flex items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-lavender-50 transition-colors">
            <RefreshCw size={11} /> Refresh
          </button>
          <DateRangePicker
            preset={dateFilter.preset}
            customStart={dateFilter.customStart}
            customEnd={dateFilter.customEnd}
            onChange={handleDateChange}
          />
        </div>
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Total Followers" value={kpi.totalFollowers} icon={Users}
          iconColor="bg-violet-100 text-violet-600"
          breakdown={showBreakdown ? kpi.breakdowns.followers : null} />
        <StatCard title="Avg. Engagement Rate" value={kpi.avgER} icon={Activity}
          iconColor="bg-pink-100 text-pink-500" suffix="%"
          breakdown={showBreakdown ? kpi.breakdowns.er : null} />
        <StatCard title="Total Reach" value={kpi.totalReach} icon={Eye}
          iconColor="bg-blue-100 text-blue-500"
          breakdown={showBreakdown ? kpi.breakdowns.reach : null} />
        <StatCard title="Total Impressions" value={kpi.totalImpressions} icon={TrendingUp}
          iconColor="bg-emerald-100 text-emerald-600"
          breakdown={showBreakdown ? kpi.breakdowns.impressions : null} />
      </div>

      {/* KPI row 2 + Audience Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Konten Dipublikasi" value={kpi.contentCount || 0}
          icon={FileText} iconColor="bg-amber-100 text-amber-500" />
        <StatCard title="Platform Terbaik" value={kpi.bestPlatform}
          icon={Star} iconColor="bg-purple-100 text-purple-600" detail="Tertinggi ER & Growth" />

        <div className="col-span-2 bg-white border border-purple-100 rounded-2xl p-3 shadow-card">
          <p className="text-xs font-semibold text-gray-500 mb-2.5 px-0.5">Audience per Platform</p>
          <div className="flex gap-2">
            {PLATFORM_KEYS.map(k => (
              <AudienceCard key={k} platformKey={k}
                account={accounts[k]}
                perPlatformData={kpi.perPlatform[k]}
                isActive={activePlatform === (k.charAt(0).toUpperCase() + k.slice(1))}
                onClick={() => setActivePlatform(k.charAt(0).toUpperCase() + k.slice(1))} />
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Follower Growth Trend"
          subtitle={`Pertumbuhan follower${activePlatform !== 'Semua' ? ` · ${activePlatform}` : ''} · ${dateFilter.preset === 'custom' ? `${startStr} – ${endStr}` : DATE_PRESETS.find(p=>p.key===dateFilter.preset)?.label}`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={followerData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                {PLATFORM_KEYS.map(k => (
                  <linearGradient key={k} id={`fg-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[k]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS[k]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => fmtNum(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {chartKeys.map(k => (
                <Area key={k} type="monotone" dataKey={k}
                  name={k.charAt(0).toUpperCase() + k.slice(1)}
                  stroke={COLORS[k]} fill={`url(#fg-${k})`} strokeWidth={2} dot={false} connectNulls />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Engagement Rate Trend"
          subtitle={`ER%${activePlatform !== 'Semua' ? ` · ${activePlatform}` : ' · semua platform'}`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={erData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                {PLATFORM_KEYS.map(k => (
                  <linearGradient key={k} id={`erg-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[k]} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS[k]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {chartKeys.map(k => (
                <Area key={k} type="monotone" dataKey={k}
                  name={k.charAt(0).toUpperCase() + k.slice(1)}
                  stroke={COLORS[k]} fill={`url(#erg-${k})`} strokeWidth={2.5}
                  dot={{ r: 3, fill: COLORS[k] }} connectNulls />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="Total Reach per Bulan"
            subtitle={`Perkembangan reach${activePlatform !== 'Semua' ? ` · ${activePlatform}` : ' di semua platform'}`}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={reachData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  {PLATFORM_KEYS.map(k => (
                    <linearGradient key={k} id={`rg-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[k]} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS[k]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => fmtNum(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {chartKeys.map(k => (
                  <Area key={k} type="monotone" dataKey={k}
                    name={k.charAt(0).toUpperCase() + k.slice(1)}
                    stroke={COLORS[k]} fill={`url(#rg-${k})`} strokeWidth={2} dot={false} connectNulls />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Top 5 Konten"
          subtitle={`Performance score${activePlatform !== 'Semua' ? ` · ${activePlatform}` : ''}`}>
          <div className="space-y-2.5 mt-1">
            {topContent.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Belum ada data konten</p>
            )}
            {topContent.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                  ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-lavender-100 text-violet-500'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{c.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <PlatformBadge platform={c.platform} size="xs" />
                    <span className="text-[10px] text-gray-400">ER: {c.engagementRate}%</span>
                  </div>
                </div>
                <span className={`text-sm font-bold flex-shrink-0
                  ${c.performanceScore >= 90 ? 'text-green-600' : c.performanceScore >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {c.performanceScore}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

    </div>
  );
}
