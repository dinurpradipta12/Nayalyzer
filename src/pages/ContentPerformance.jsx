import { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { FileText, TrendingUp, TrendingDown, Minus, RefreshCw, Calendar, Eye, Users, Heart, MousePointer, UserCheck, BarChart2, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import FilterBar from '../components/ui/FilterBar';
import ContentTable from '../components/ContentTable';
import ChartCard from '../components/ui/ChartCard';
import { contentData as mockContentData } from '../data/mockData';
import { useSocialData } from '../hooks/useSocialData';
import { SUPABASE_ENABLED } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';
import { ContentSkeleton } from '../components/ui/Skeleton';

const DATE_PRESETS = [
  { label: '7 hari', days: 7 },
  { label: '14 hari', days: 14 },
  { label: '28 hari', days: 28 },
];

const filters = [
  {
    key: 'platform',
    label: 'Semua Platform',
    options: [
      { value: 'Instagram', label: 'Instagram' },
      { value: 'TikTok', label: 'TikTok' },
      { value: 'Threads', label: 'Threads' },
    ],
  },
  {
    key: 'format',
    label: 'Semua Format',
    options: [
      { value: 'Carousel', label: 'Carousel' },
      { value: 'Short Video', label: 'Short Video' },
      { value: 'Reels', label: 'Reels' },
      { value: 'Thread Opini', label: 'Thread Opini' },
      { value: 'Thread Tips', label: 'Thread Tips' },
      { value: 'Photo', label: 'Photo' },
      { value: 'Long Video', label: 'Long Video' },
      { value: 'Poll', label: 'Poll' },
    ],
  },
];

const statusColor = {
  'High Performer': '#22c55e',
  'Stable': '#60a5fa',
  'Needs Improvement': '#f59e0b',
  'Underperform': '#f87171',
};

// Convert real DB content rows to the shape ContentTable expects
function safeDate(str) {
  if (!str) return '-';
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '-'; }
}

function normalizeRealContent(rows) {
  return rows.map(c => {
    // Ambil metrik terbaru (sort by metric_date desc)
    const sortedMetrics = (c.content_metrics ?? [])
      .slice()
      .sort((a, b) => (b.metric_date ?? '').localeCompare(a.metric_date ?? ''));
    const m = sortedMetrics[0] ?? {};

    const likes       = m.likes    ?? 0;
    const comments    = m.comments ?? m.replies ?? 0;
    const replies     = m.replies  ?? m.comments ?? 0;
    const shares      = m.shares   ?? m.reposts ?? 0;
    const reposts     = m.reposts  ?? m.shares ?? 0;
    const saves       = m.saves    ?? 0;
    const quotes      = m.quotes   ?? 0;
    const reach       = m.reach    ?? 0;
    const views       = m.views    ?? 0;
    const avgWatchTime = m.avg_watch_time ?? null;
    const engCount = likes + comments + shares + saves;
    // ER: use reach if available, else views, else just log-based score
    const erBase   = reach > 0 ? reach : views > 0 ? views : 0;
    const er       = m.engagement_rate && m.engagement_rate > 0
      ? +m.engagement_rate.toFixed(1)
      : (erBase > 0 ? +((engCount / erBase) * 100).toFixed(1) : 0);
    // Score: when no reach/views, base purely on engagement volume
    const score    = erBase > 0
      ? Math.min(100, Math.round(er * 10 + Math.log1p(engCount)))
      : Math.min(100, Math.round(Math.log1p(engCount) * 8));
    const status   = score >= 85 ? 'High Performer' : score >= 65 ? 'Stable' : score >= 45 ? 'Needs Improvement' : 'Underperform';

    return {
      id: c.id,
      title: c.caption ? c.caption.slice(0, 60) : (c.content_type ?? 'Konten'),
      platform: c.platform,
      format: c.content_type ?? 'Other',
      pillar: 'Edukasi',
      date: c.published_at,
      reach, views,
      likes, comments, replies, shares, saves, reposts, quotes, avgWatchTime,
      engagementRate: er,
      performanceScore: score,
      status,
      aiNote: null,
      contentUrl: c.content_url,
    };
  });
}

// ── Insight Tab ──────────────────────────────────────────────

const PLATFORM_METRICS = {
  instagram: [
    { key: 'views',              label: 'Total Views',  icon: Eye,          color: '#8B5CF6', src: 'content' },
    { key: 'reach',              label: 'Reach',        icon: TrendingUp,   color: '#6366F1', src: 'account' },
    { key: 'total_interactions', label: 'Interactions', icon: Heart,        color: '#EC4899', src: 'content' },
    { key: 'followers',          label: 'Follows',      icon: UserCheck,    color: '#10B981', src: 'account' },
    { key: 'avg_er',             label: 'Rata-rata ER', icon: BarChart2,    color: '#F59E0B', src: 'content', isAvg: true },
  ],
  threads: [
    { key: 'views',    label: 'Views',   icon: Eye,          color: '#8B5CF6', src: 'content' },
    { key: 'likes',    label: 'Likes',   icon: Heart,        color: '#EC4899', src: 'content' },
    { key: 'replies',  label: 'Replies', icon: Users,        color: '#06B6D4', src: 'content' },
    { key: 'reposts',  label: 'Reposts', icon: RefreshCw,    color: '#10B981', src: 'content' },
    { key: 'quotes',   label: 'Quotes',  icon: BarChart2,    color: '#F59E0B', src: 'content' },
  ],
  tiktok: [
    { key: 'views',    label: 'Views',    icon: Eye,          color: '#8B5CF6', src: 'content' },
    { key: 'likes',    label: 'Likes',    icon: Heart,        color: '#EC4899', src: 'content' },
    { key: 'comments', label: 'Comments', icon: Users,        color: '#06B6D4', src: 'content' },
    { key: 'shares',   label: 'Shares',   icon: MousePointer, color: '#10B981', src: 'content' },
    { key: 'saves',    label: 'Saves',    icon: BarChart2,    color: '#F59E0B', src: 'content' },
  ],
};
// fallback
const INSIGHT_METRICS = PLATFORM_METRICS.instagram;

function pct(curr, prev) {
  if (!prev || prev === 0) return null;
  return (((curr - prev) / prev) * 100).toFixed(1);
}

const PERIOD_PRESETS = [
  { label: 'Kemarin',   days: 1 },
  { label: '7 hari',    days: 7 },
  { label: '28 hari',   days: 28 },
  { label: '90 hari',   days: 90 },
  { label: 'Bulan ini', days: 0, type: 'thisMonth' },
  { label: 'Bulan lalu',days: 0, type: 'lastMonth' },
];

function toYMD(d) { return d.toISOString().split('T')[0]; }

const ALL_PLATFORMS = ['instagram', 'threads', 'tiktok'];

function InsightTab({ metrics, contents, syncing, reload }) {
  const [activePlatform, setActivePlatform] = useState('instagram');
  const [activeMetric, setActiveMetric]     = useState('reach');
  const [periodPreset, setPeriodPreset]     = useState(28);
  const [customFrom, setCustomFrom]         = useState('');
  const [customTo, setCustomTo]             = useState('');
  const [showPicker, setShowPicker]         = useState(false);
  const [pickerFrom, setPickerFrom]         = useState('');
  const [pickerTo, setPickerTo]             = useState('');

  // Active metric list for current platform
  const platformMetrics = PLATFORM_METRICS[activePlatform] ?? PLATFORM_METRICS.instagram;

  // Reset active metric when switching platform
  const handlePlatformSwitch = (p) => {
    setActivePlatform(p);
    setActiveMetric((PLATFORM_METRICS[p] ?? PLATFORM_METRICS.instagram)[0].key);
  };

  // Account-level rows (Instagram only)
  const rows = useMemo(() => {
    return (metrics[activePlatform] ?? []).slice().sort((a, b) => a.metric_date.localeCompare(b.metric_date));
  }, [metrics, activePlatform]);

  // Content-derived rows: group content_metrics by publish date for non-Instagram platforms
  const contentRows = useMemo(() => {
    const byDate = {};
    (contents ?? []).forEach(c => {
      if (c.platform?.toLowerCase() !== activePlatform) return;
      const date = c.published_at?.split('T')[0];
      if (!date) return;
      const latest = (c.content_metrics ?? []).slice().sort((a, b) => (b.metric_date ?? '').localeCompare(a.metric_date ?? ''))[0];
      if (!latest) return;
      if (!byDate[date]) byDate[date] = { metric_date: date, _er_sum: 0, _er_count: 0 };
      ['views','likes','comments','replies','reposts','quotes','shares','saves','engagement_count'].forEach(k => {
        byDate[date][k] = (byDate[date][k] ?? 0) + (latest[k] ?? 0);
      });
      byDate[date].total_interactions = byDate[date].engagement_count;
      if (latest.engagement_rate != null) {
        byDate[date]._er_sum += latest.engagement_rate;
        byDate[date]._er_count += 1;
      }
    });
    return Object.values(byDate).sort((a, b) => a.metric_date.localeCompare(b.metric_date)).map(r => {
      const avg_er = r._er_count > 0 ? +(r._er_sum / r._er_count).toFixed(2) : 0;
      const { _er_sum, _er_count, ...rest } = r;
      return { ...rest, avg_er };
    });
  }, [contents, activePlatform]);

  // For Instagram: use account rows for account-level metrics, content rows for interactions
  // For Threads/TikTok: always use contentRows
  const getRows = (metricKey) => {
    if (activePlatform === 'instagram') {
      const m = platformMetrics.find(x => x.key === metricKey);
      return m?.src === 'content' ? contentRows : rows;
    }
    return contentRows;
  };

  const platforms = ALL_PLATFORMS;

  const DAY = 86400000;

  // Compute date range from preset
  const { rangeFrom, rangeTo, prevFrom, prevTo } = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let f, t, pf, pt;
    if (periodPreset === 'custom' && customFrom && customTo) {
      f = new Date(customFrom); t = new Date(customTo); t.setHours(23,59,59,999);
      const span = t - f;
      pf = new Date(f - span); pt = new Date(f.getTime() - 1);
    } else if (periodPreset === 'thisMonth') {
      f = new Date(now.getFullYear(), now.getMonth(), 1);
      t = new Date(now);
      pf = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      pt = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (periodPreset === 'lastMonth') {
      f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      t = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      pf = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      pt = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
    } else {
      const days = typeof periodPreset === 'number' ? periodPreset : 28;
      t = new Date(now); f = new Date(now - days * DAY);
      pt = new Date(f.getTime() - 1); pf = new Date(pt.getTime() - days * DAY);
    }
    return { rangeFrom: f, rangeTo: t, prevFrom: pf, prevTo: pt };
  }, [periodPreset, customFrom, customTo]);

  const filterByRange = (arr, from, to) => arr.filter(r => { const d = new Date(r.metric_date); return d >= from && d <= to; });

  const currRows = useMemo(() => filterByRange(rows, rangeFrom, rangeTo), [rows, rangeFrom, rangeTo]);
  const prevRows = useMemo(() => filterByRange(rows, prevFrom, prevTo), [rows, prevFrom, prevTo]);
  const currContentRows = useMemo(() => filterByRange(contentRows, rangeFrom, rangeTo), [contentRows, rangeFrom, rangeTo]);
  const prevContentRows = useMemo(() => filterByRange(contentRows, prevFrom, prevTo), [contentRows, prevFrom, prevTo]);

  const sum = (arr, k) => arr.reduce((s, r) => s + (r[k] ?? 0), 0);
  const avg = (arr, k) => arr.length ? +(sum(arr, k) / arr.length).toFixed(1) : 0;

  const summary = useMemo(() => platformMetrics.map(m => {
    const srcRows = activePlatform === 'instagram' && m.src === 'account' ? currRows : currContentRows;
    const srcPrev = activePlatform === 'instagram' && m.src === 'account' ? prevRows : prevContentRows;
    const c = m.isAvg ? avg(srcRows, m.key) : sum(srcRows, m.key);
    const p = m.isAvg ? avg(srcPrev, m.key) : sum(srcPrev, m.key);
    const vals = srcRows.map(r => r[m.key] ?? 0).filter(v => v > 0);
    return { ...m, value: c, change: pct(c, p), avgDay: m.isAvg ? c : avg(srcRows, m.key), peak: vals.length ? Math.max(...vals) : 0 };
  }), [currRows, prevRows, currContentRows, prevContentRows, platformMetrics, activePlatform]);

  const chartData = useMemo(() => {
    const src = getRows(activeMetric);
    return filterByRange(src, rangeFrom, rangeTo).map(r => ({
      date: new Date(r.metric_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      fullDate: r.metric_date,
      value: r[activeMetric] ?? 0,
    }));
  }, [currRows, currContentRows, activeMetric, rangeFrom, rangeTo]);

  const activeM    = platformMetrics.find(m => m.key === activeMetric);
  const activeStat = summary.find(m => m.key === activeMetric);

  // Period label
  const fmtDate = d => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const periodLabel = `${fmtDate(rangeFrom)} – ${fmtDate(rangeTo)}`;
  const allChartRows = activePlatform === 'instagram' ? currRows : currContentRows;
  const periodStart = allChartRows.length ? fmtDate(new Date(allChartRows[0].metric_date)) : fmtDate(rangeFrom);
  const periodEnd   = allChartRows.length ? fmtDate(new Date(allChartRows[allChartRows.length - 1].metric_date)) : fmtDate(rangeTo);

  const applyCustom = () => { if (pickerFrom && pickerTo) { setCustomFrom(pickerFrom); setCustomTo(pickerTo); setPeriodPreset('custom'); setShowPicker(false); } };

  // week-over-week for active metric (last 7 vs prior 7 within current range)
  const activeRows = activePlatform === 'instagram' && (platformMetrics.find(m => m.key === activeMetric)?.src === 'account') ? currRows : currContentRows;
  const last7  = activeRows.slice(-7);
  const prior7 = activeRows.slice(-14, -7);
  const wow    = pct(sum(last7, activeMetric), sum(prior7, activeMetric));

  // Best & worst day for active metric
  const maxEntry = chartData.reduce((best, d) => d.value > (best?.value ?? -1) ? d : best, null);
  const nonZero  = chartData.filter(d => d.value > 0);
  const minEntry = nonZero.reduce((worst, d) => d.value < (worst?.value ?? Infinity) ? d : worst, null);

  return (
    <div className="space-y-5">
      {/* Header row: platform + date picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-white rounded-xl p-1 shadow-card border border-purple-50">
            {platforms.map(p => (
              <button key={p} onClick={() => handlePlatformSwitch(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  activePlatform === p ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-violet-600'}`}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {syncing
            ? <span className="text-xs text-violet-500 flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Sync...</span>
            : rows.length > 0
              ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">● Live</span>
              : <button onClick={reload} className="text-xs text-gray-400 hover:text-violet-500 flex items-center gap-1"><RefreshCw size={10} /> Refresh</button>
          }
        </div>

        {/* Date range picker */}
        <div className="relative">
          <button onClick={() => setShowPicker(v => !v)}
            className="flex items-center gap-2 bg-white border border-purple-100 rounded-xl px-3 py-2 text-xs text-gray-600 hover:border-violet-300 shadow-card transition-colors">
            <Calendar size={12} className="text-violet-400" />
            <span className="font-medium">{periodLabel}</span>
            <span className="text-gray-300">▾</span>
          </button>

          {showPicker && (
            <div className="absolute right-0 top-10 z-50 bg-white border border-purple-100 rounded-2xl shadow-xl p-0 w-80 overflow-hidden">
              <div className="flex">
                {/* Presets */}
                <div className="w-36 border-r border-purple-50 p-2 space-y-0.5">
                  {PERIOD_PRESETS.map(p => {
                    const isActive = p.type ? periodPreset === p.type : periodPreset === p.days;
                    return (
                      <button key={p.label} onClick={() => { setPeriodPreset(p.type ?? p.days); setShowPicker(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${isActive ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-lavender-50'}`}>
                        {p.label}
                      </button>
                    );
                  })}
                  <button onClick={() => setPeriodPreset('custom')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${periodPreset === 'custom' ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-lavender-50'}`}>
                    Custom
                  </button>
                </div>
                {/* Custom date inputs */}
                <div className="flex-1 p-3 flex flex-col gap-3">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Pilih rentang</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Dari</p>
                      <input type="date" value={pickerFrom} onChange={e => setPickerFrom(e.target.value)}
                        className="w-full text-xs border border-purple-100 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:border-violet-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Hingga</p>
                      <input type="date" value={pickerTo} onChange={e => setPickerTo(e.target.value)}
                        className="w-full text-xs border border-purple-100 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:border-violet-400" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => setShowPicker(false)} className="flex-1 text-xs text-gray-500 border border-purple-100 rounded-lg py-1.5 hover:bg-lavender-50">Batal</button>
                    <button onClick={applyCustom} className="flex-1 text-xs bg-violet-600 text-white rounded-lg py-1.5 hover:bg-violet-700">Terapkan</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summary.map(m => {
          const Icon = m.icon;
          const isActive = activeMetric === m.key;
          const pos = m.change !== null && parseFloat(m.change) >= 0;
          return (
            <button key={m.key} onClick={() => setActiveMetric(m.key)}
              className={`bg-white rounded-2xl border p-4 text-left transition-all ${
                isActive ? 'border-violet-300 shadow-lg ring-1 ring-violet-200' : 'border-purple-50 shadow-card hover:border-violet-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: m.color + '20' }}>
                  <Icon size={14} style={{ color: m.color }} />
                </div>
                {m.change !== null && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${pos ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                    {pos ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}{Math.abs(m.change)}%
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-gray-800 leading-none">{(() => { if (m.isAvg) return `${Number(m.value).toFixed(1)}%`; const v = Math.round(m.value); return v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toLocaleString('id-ID'); })()}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{m.label}</p>
              {!m.isAvg && <p className="text-[10px] text-gray-300 mt-0.5">~{Math.round(m.avgDay)}/hari</p>}
            </button>
          );
        })}
      </div>

      {/* Main chart — full width */}
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: (activeM?.color ?? '#8B5CF6') + '20' }}>
              {activeM && <activeM.icon size={13} style={{ color: activeM.color }} />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700">{activeM?.label}</h3>
              <p className="text-[10px] text-gray-400">{chartData.length} titik data · {periodStart} – {periodEnd}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wow !== null && (
              <div className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${parseFloat(wow) >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                {parseFloat(wow) >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {Math.abs(wow)}% vs 7 hari lalu
              </div>
            )}
            <button onClick={reload} className="text-[10px] text-violet-400 hover:text-violet-600 flex items-center gap-1 border border-purple-100 rounded-lg px-2 py-1">
              <RefreshCw size={9} /> Perbarui
            </button>
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeM?.color ?? '#8B5CF6'} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={activeM?.color ?? '#8B5CF6'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'K' : v} />
              <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                <div className="bg-white rounded-xl shadow-lg border border-purple-100 p-3 text-xs">
                  <p className="text-gray-400 mb-1">{label}</p>
                  <p className="font-bold text-base" style={{ color: activeM?.color }}>{payload[0].value.toLocaleString('id-ID')}</p>
                  <p className="text-gray-400">{activeM?.label}</p>
                </div>
              ) : null} />
              {maxEntry && <ReferenceLine x={maxEntry.date} stroke={activeM?.color} strokeDasharray="3 3" strokeOpacity={0.4} />}
              <Area type="monotone" dataKey="value" stroke={activeM?.color ?? '#8B5CF6'} strokeWidth={2} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-gray-300">
            <Activity size={32} strokeWidth={1} />
            <p className="text-sm">Belum ada data metrik akun</p>
            <button onClick={reload} className="text-xs text-violet-400 hover:text-violet-600 flex items-center gap-1"><RefreshCw size={10} /> Sync sekarang</button>
          </div>
        )}

        {/* Stats row below chart */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-purple-50">
            {[
              { label: activeM?.isAvg ? 'Rata-rata ER' : 'Total periode', value: activeM?.isAvg ? `${Number(activeStat?.value ?? 0).toFixed(1)}%` : (activeStat?.value?.toLocaleString('id-ID') ?? '–') },
              { label: activeM?.isAvg ? 'ER tertinggi' : 'Rata-rata/hari', value: activeM?.isAvg ? `${Number(activeStat?.peak ?? 0).toFixed(1)}%` : (activeStat?.avgDay?.toLocaleString('id-ID') ?? '–') },
              { label: 'Puncak tertinggi', value: `${activeStat?.peak?.toLocaleString('id-ID') ?? '–'} (${maxEntry?.date ?? '–'})` },
              { label: 'vs 28 hari lalu', value: activeStat?.change !== null ? `${parseFloat(activeStat?.change ?? '0') >= 0 ? '+' : ''}${activeStat?.change}%` : 'N/A', color: activeStat?.change !== null ? (parseFloat(activeStat?.change ?? '0') >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                <p className={`text-sm font-bold ${color ?? 'text-gray-700'}`}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content preview: top konten by active metric */}
      {contents.length > 0 && (() => {
        // These metrics are account-level only — no per-content equivalent
        const accountLevelOnly = activePlatform === 'instagram' ? ['followers'] : [];
        if (accountLevelOnly.includes(activeMetric)) return null;
        const platformContents = contents.filter(c => {
          if (c.platform?.toLowerCase() !== activePlatform) return false;
          if (!c.published_at) return true;
          const d = new Date(c.published_at);
          return d >= rangeFrom && d <= rangeTo;
        });
        // Map metric key to content_metrics field
        const metricToField = {
          reach: 'reach', total_interactions: 'engagement_count',
          views: 'views', likes: 'likes', replies: 'replies', reposts: 'reposts',
          quotes: 'quotes', comments: 'comments', shares: 'shares', saves: 'saves',
          avg_er: 'engagement_rate',
        };
        const field = metricToField[activeMetric] ?? 'views';
        const sorted = platformContents
          .map(c => {
            const m = (c.content_metrics ?? []).slice().sort((a, b) => (b.metric_date ?? '').localeCompare(a.metric_date ?? ''))[0] ?? {};
            return { ...c, _val: m[field] ?? 0, _m: m };
          })
          .filter(c => c._val > 0)
          .sort((a, b) => b._val - a._val)
          .slice(0, 5);
        if (sorted.length === 0) return null;
        const isTextPlatform = activePlatform === 'threads';
        const fmtV = v => { const n = Math.round(v); return n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString('id-ID'); };
        const rankColor = i => i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7C2F' : '#8B5CF6';
        return (
          <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: (activeM?.color ?? '#8B5CF6') + '20' }}>
                {activeM && <activeM.icon size={12} style={{ color: activeM.color }} />}
              </div>
              <h3 className="text-sm font-semibold text-gray-700">Konten Terbaik — {activeM?.label}</h3>
              <span className="text-xs text-gray-400 ml-auto">Diurutkan dari tertinggi</span>
            </div>

            {isTextPlatform ? (
              /* List view for text-based platforms (Threads) */
              <div className="divide-y divide-purple-50">
                {sorted.map((c, i) => {
                  const m = c._m;
                  const metrics = activePlatform === 'threads'
                    ? [['Views', m.views], ['Likes', m.likes], ['Replies', m.replies ?? m.comments], ['Reposts', m.reposts ?? m.shares]]
                    : [['Views', m.views], ['Likes', m.likes], ['Comments', m.comments], ['Shares', m.shares]];
                  return (
                    <a key={c.id} href={c.content_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-3 py-3 hover:bg-lavender-50 transition-colors px-1 rounded-lg group">
                      <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
                        style={{ background: rankColor(i), color: 'white' }}>{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 mb-0.5">{c.content_type} · {c.published_at ? new Date(c.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '–'}</p>
                        <p className="text-xs text-gray-700 font-medium leading-snug line-clamp-2">{c.caption ?? '–'}</p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {metrics.map(([label, val]) => (
                          <div key={label} className="text-center min-w-[40px]">
                            <p className="text-[10px] text-gray-400">{label}</p>
                            <p className="text-xs font-semibold text-gray-700">{val ? fmtV(val) : '–'}</p>
                          </div>
                        ))}
                        <div className="text-center min-w-[36px]">
                          <p className="text-[10px] text-gray-400">ER</p>
                          <p className="text-xs font-semibold text-violet-600">{m.engagement_rate?.toFixed(1) ?? 0}%</p>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              /* Card/thumbnail view for visual platforms */
              <div className="grid grid-cols-5 gap-3">
                {sorted.map((c, i) => (
                  <a key={c.id} href={c.content_url} target="_blank" rel="noopener noreferrer"
                    className="group relative rounded-xl overflow-hidden border border-purple-50 hover:border-violet-200 transition-all hover:shadow-md">
                    <div className="absolute top-2 left-2 z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: rankColor(i), color: 'white' }}>{i + 1}</div>
                    <div className="w-full aspect-square bg-lavender-50 relative overflow-hidden">
                      {c.thumbnail_url ? (
                        <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl">{c.content_type === 'Reels' ? '🎬' : c.content_type === 'Carousel' ? '🖼️' : '📷'}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-2.5">
                      <p className="text-[10px] text-gray-400 mb-1">{c.content_type} · {c.published_at ? new Date(c.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '–'}</p>
                      <p className="text-xs text-gray-700 font-medium line-clamp-2 leading-snug mb-2">{c.caption?.slice(0, 50) ?? '–'}</p>
                      <div className="flex items-center justify-between">
                        {!activeM?.isAvg && (
                          <div>
                            <p className="text-[10px] text-gray-400">{activeM?.label}</p>
                            <p className="text-sm font-bold" style={{ color: activeM?.color }}>{fmtV(c._val)}</p>
                          </div>
                        )}
                        <div className={activeM?.isAvg ? 'w-full' : 'text-right'}>
                          <p className="text-[10px] text-gray-400">ER</p>
                          <p className={`font-semibold text-violet-600 ${activeM?.isAvg ? 'text-sm' : 'text-xs'}`}>{c._m.engagement_rate?.toFixed(1) ?? 0}%</p>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function ContentPerformance() {
  const [activeTab, setActiveTab]       = useState('konten');
  const [filterValues, setFilterValues] = useState({ platform: 'Instagram' });
  const [datePreset, setDatePreset]     = useState(28);   // days; null = custom
  const [customFrom, setCustomFrom]     = useState('');
  const [customTo, setCustomTo]         = useState('');
  const [showCustom, setShowCustom]     = useState(false);

  const { activeWorkspace } = useWorkspace();
  const { contents: realContents, metrics, syncing, loading, reload } = useSocialData(activeWorkspace?.id);

  // Use real data if available. Mock hanya di demo mode (tanpa backend).
  const contentData = useMemo(() => {
    if (realContents.length > 0) return normalizeRealContent(realContents);
    return SUPABASE_ENABLED ? [] : mockContentData;
  }, [realContents]);

  const hasRealData = realContents.length > 0;

  const handleFilterChange = (key, value) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const selectPreset = (days) => {
    setDatePreset(days);
    setShowCustom(false);
    setCustomFrom('');
    setCustomTo('');
  };

  const filtered = useMemo(() => {
    const now = new Date();
    let from, to;

    if (datePreset !== null) {
      to   = new Date(now);
      from = new Date(now);
      from.setDate(from.getDate() - datePreset);
    } else if (customFrom && customTo) {
      from = new Date(customFrom);
      to   = new Date(customTo);
      to.setHours(23, 59, 59, 999);
    }

    return contentData.filter(c => {
      if (filterValues.platform && c.platform !== filterValues.platform) return false;
      if (filterValues.format  && c.format   !== filterValues.format)   return false;
      if (from && to && c.date) {
        const d = new Date(c.date);
        if (isNaN(d.getTime()) || d < from || d > to) return false;
      }
      return true;
    });
  }, [filterValues, contentData, datePreset, customFrom, customTo]);

  // Charts use filtered data so they respond to date range
  const statusSummary = useMemo(() => {
    const counts = { 'High Performer': 0, Stable: 0, 'Needs Improvement': 0, Underperform: 0 };
    filtered.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const erByFormat = useMemo(() => {
    const map = {};
    filtered.forEach(c => {
      if (!map[c.format]) map[c.format] = { total: 0, count: 0 };
      map[c.format].total += c.engagementRate;
      map[c.format].count += 1;
    });
    return Object.entries(map).map(([format, { total, count }]) => ({
      format: format.length > 12 ? format.substring(0, 12) + '…' : format,
      er: +(total / count).toFixed(1),
    })).sort((a, b) => b.er - a.er);
  }, [filtered]);

  const highCount  = filtered.filter(c => c.status === 'High Performer').length;
  const underCount = filtered.filter(c => c.status === 'Underperform').length;
  const avgER      = filtered.length
    ? (filtered.reduce((s, c) => s + c.engagementRate, 0) / filtered.length).toFixed(1)
    : '0';

  if (loading) return <ContentSkeleton />;

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-card border border-purple-50 w-fit">
        {[{ id: 'konten', label: 'Konten' }, { id: 'insight', label: 'Insight' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === t.id ? 'bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-sm' : 'text-gray-500 hover:text-violet-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'insight' && <InsightTab metrics={metrics} contents={realContents} syncing={syncing} reload={reload} />}
      {activeTab === 'konten' && <>

      {/* Date range + platform filter */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
        <Calendar size={14} className="text-gray-400" />
        <span className="text-xs text-gray-400 font-medium">Rentang:</span>
        {DATE_PRESETS.map(({ label, days }) => (
          <button
            key={days}
            onClick={() => selectPreset(days)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              datePreset === days && !showCustom
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-purple-100 text-gray-500 hover:border-violet-300 hover:text-violet-600'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => { setShowCustom(v => !v); setDatePreset(null); }}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            showCustom
              ? 'bg-violet-600 text-white'
              : 'bg-white border border-purple-100 text-gray-500 hover:border-violet-300 hover:text-violet-600'
          }`}
        >
          Custom
        </button>
        {showCustom && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="text-xs border border-purple-100 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:border-violet-400"
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="text-xs border border-purple-100 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:border-violet-400"
            />
          </div>
        )}
        </div>
        {/* Platform filter — right side */}
        <div className="flex items-center gap-2">
          {['Instagram', 'TikTok', 'Threads'].map(p => (
            <button key={p} onClick={() => handleFilterChange('platform', filterValues.platform === p ? '' : p)}
              className={`text-xs px-4 py-1.5 rounded-full font-medium transition-all border ${
                filterValues.platform === p
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                  : 'bg-white border-purple-100 text-gray-500 hover:border-violet-300 hover:text-violet-600'
              }`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Konten', value: filtered.length, icon: FileText, color: 'bg-violet-100 text-violet-600' },
          { label: 'High Performer', value: highCount, icon: TrendingUp, color: 'bg-green-100 text-green-600' },
          { label: 'Underperform', value: underCount, icon: TrendingDown, color: 'bg-red-100 text-red-500' },
          { label: 'Avg. ER', value: `${avgER}%`, icon: Minus, color: 'bg-amber-100 text-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-purple-50 shadow-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={17} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="font-bold text-gray-800 text-lg">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Distribusi Status Konten" subtitle="Jumlah konten per kategori performa">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusSummary} layout="vertical" margin={{ top: 0, right: 5, left: 60, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={100} />
              <Tooltip
                content={({ active, payload }) => active && payload?.length ? (
                  <div className="bg-white rounded-xl shadow-lg border border-purple-100 p-2.5 text-xs">
                    <p className="font-semibold text-gray-700">{payload[0].payload.name}: {payload[0].value} konten</p>
                  </div>
                ) : null}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {statusSummary.map((entry) => (
                  <Cell key={entry.name} fill={statusColor[entry.name]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg. Engagement Rate per Format" subtitle="Format mana yang paling efektif">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={erByFormat} margin={{ top: 0, right: 5, bottom: 0, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" vertical={false} />
              <XAxis dataKey="format" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                content={({ active, payload }) => active && payload?.length ? (
                  <div className="bg-white rounded-xl shadow-lg border border-purple-100 p-2.5 text-xs">
                    <p className="font-semibold text-gray-700">ER: {payload[0].value}%</p>
                  </div>
                ) : null}
              />
              <Bar dataKey="er" fill="#8B5CF6" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Filter + Table */}
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800 text-sm">Semua Konten</h3>
              {syncing
                ? <span className="text-xs text-violet-500 flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Sync...</span>
                : hasRealData
                  ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">● Live</span>
                  : <button onClick={reload} className="text-xs text-gray-400 hover:text-violet-500 flex items-center gap-1"><RefreshCw size={10} /> Refresh</button>
              }
            </div>
            <p className="text-xs text-gray-400">{filtered.length} dari {contentData.length} konten ditampilkan</p>
          </div>
          <FilterBar filters={filters} values={filterValues} onChange={handleFilterChange} />
        </div>

        <ContentTable data={filtered} platform={filterValues.platform} />

      </div>
      </>}
    </div>
  );
}
