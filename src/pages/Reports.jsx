import { useMemo, useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  FileText, FileSpreadsheet, TrendingUp, TrendingDown,
  Sparkles, Users, Eye, ChevronUp, ChevronDown,
  AlertCircle, CheckCircle, BarChart2,
} from 'lucide-react';
import { useWorkspace }   from '../context/WorkspaceContext';
import { useContents }    from '../hooks/useContents';
import { useCompetitors } from '../hooks/useCompetitors';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { withTimeout } from '../lib/async';
import { usePlatformVisibility } from '../lib/platformVisibility';

// ── helpers ────────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
  : String(Math.round(n ?? 0));

const pct = (n) => `${(n ?? 0).toFixed(2)}%`;

const PLATFORM_COLOR  = { Instagram: '#E040FB', TikTok: '#26C6DA', Threads: '#78909C' };
const PLATFORM_BG     = { Instagram: 'from-pink-500 to-fuchsia-500', TikTok: 'from-cyan-400 to-teal-500', Threads: 'from-gray-500 to-gray-700' };

const nowMonth = new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' });

function Delta({ value, suffix = '%' }) {
  if (value == null || isNaN(value)) return <span className="text-gray-400">–</span>;
  const pos = value >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {pos ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      {Math.abs(value).toFixed(2)}{suffix}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-violet-600', bg = 'bg-violet-50' }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
        {sub && <div className="mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function Reports() {
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;
  const { visiblePlatforms, visiblePlatformKeys } = usePlatformVisibility(wsId);

  const { contents, loading: contentsLoading } = useContents(wsId);
  const { competitors }                        = useCompetitors(wsId);

  const [platforms, setPlatforms]     = useState([]);
  const [followerTrend, setFollowerTrend] = useState([]);
  const [engagementTrend, setEngagementTrend] = useState([]);
  const [metricsLoading, setMetricsLoading]   = useState(true);

  useEffect(() => {
    if (!wsId || !SUPABASE_ENABLED) { setMetricsLoading(false); return; }
    (async () => {
      setMetricsLoading(true);
      try {
        // 1. Get social accounts for this workspace
        const { data: accs } = await withTimeout(supabase
          .from('social_accounts')
          .select('id, platform, username, account_name, followers_count')
          .eq('workspace_id', wsId), 6000, 'Report accounts request timeout');

        const visibleNames = visiblePlatforms.length ? visiblePlatforms : ['Instagram', 'TikTok', 'Threads'];
        const visibleKeys = visiblePlatformKeys.length ? visiblePlatformKeys : ['instagram', 'tiktok', 'threads'];
        const visibleAccs = (accs ?? []).filter(account => visibleNames.includes(account.platform));

        if (!visibleAccs?.length) {
          setPlatforms([]);
          setFollowerTrend([]);
          setEngagementTrend([]);
          setMetricsLoading(false);
          return;
        }

        // 2. Get all account_metrics by social_account_id
        const ids = visibleAccs.map(a => a.id);
        const { data: mets } = await withTimeout(supabase
          .from('account_metrics')
          .select('social_account_id, followers, engagement_rate, reach, metric_date')
          .in('social_account_id', ids)
          .order('metric_date', { ascending: false }), 7000, 'Report metrics request timeout');

        // Map latest metric per account
        const latestMap = {};
        (mets ?? []).forEach(m => {
          if (!latestMap[m.social_account_id]) latestMap[m.social_account_id] = m;
        });

        // Deduplicate by platform — merge all accounts per platform
        const byPlatform = {};
        visibleAccs.forEach(a => {
          const m = latestMap[a.id] ?? {};
          const label = a.platform ?? 'Instagram';
          const key = label.toLowerCase();
          const followers = m.followers ?? a.followers_count ?? 0;
          const username = a.account_name || a.username || '';
          if (!byPlatform[key]) {
            byPlatform[key] = { key, label, username, followers, growth: 0, er: m.engagement_rate ?? 0, reach: m.reach ?? 0 };
          } else {
            // merge: take best of each field
            if (followers > byPlatform[key].followers) {
              byPlatform[key].followers = followers;
              byPlatform[key].er = m.engagement_rate ?? byPlatform[key].er;
              byPlatform[key].reach = m.reach ?? byPlatform[key].reach;
            }
            if (!byPlatform[key].username && username) byPlatform[key].username = username;
          }
        });
        const built = Object.values(byPlatform).filter(p => p.label);

        setPlatforms(built);

        // 3. Build trend data grouped by month
        const accMap = {};
        visibleAccs.forEach(a => { accMap[a.id] = (a.platform ?? '').toLowerCase(); });
        const trendMap = {};
        (mets ?? []).forEach(m => {
          const month = new Date(m.metric_date).toLocaleString('id-ID', { month: 'short', year: '2-digit' });
          if (!trendMap[month]) trendMap[month] = { month };
          const p = accMap[m.social_account_id];
          if (p && visibleKeys.includes(p) && !trendMap[month][p]) {
            trendMap[month][p]         = m.followers ?? 0;
            trendMap[month][p + '_er'] = m.engagement_rate ?? 0;
          }
        });
        const trendArr = Object.values(trendMap).slice(-6);
        if (trendArr.length >= 2) {
          setFollowerTrend(trendArr);
          setEngagementTrend(trendArr);
        }
      } catch (e) {
        console.error('Reports metrics fetch error:', e);
      } finally {
        setMetricsLoading(false);
      }
    })();
  }, [wsId, visiblePlatforms, visiblePlatformKeys]);

  // ── Derived metrics ──────────────────────────────────────────
  // platforms is now set directly via useEffect above

  const totalFollowers = useMemo(() => platforms.reduce((s, p) => s + p.followers, 0), [platforms]);
  const totalReach     = useMemo(() => platforms.reduce((s, p) => s + p.reach, 0), [platforms]);
  const avgER          = useMemo(() => platforms.length ? platforms.reduce((s, p) => s + p.er, 0) / platforms.length : 0, [platforms]);
  const avgGrowth      = useMemo(() => platforms.length ? platforms.reduce((s, p) => s + p.growth, 0) / platforms.length : 0, [platforms]);

  const topContent = useMemo(() =>
    [...contents]
      .filter(c => (visiblePlatforms.length ? visiblePlatforms : ['Instagram', 'TikTok', 'Threads']).includes(c.platform))
      .sort((a, b) => (b.performanceScore || b.engagementRate) - (a.performanceScore || a.engagementRate))
      .slice(0, 5),
  [contents, visiblePlatforms]);

  const lowContent = useMemo(() =>
    [...contents]
      .filter(c => (visiblePlatforms.length ? visiblePlatforms : ['Instagram', 'TikTok', 'Threads']).includes(c.platform))
      .filter(c => c.status === 'Underperform' || c.status === 'Needs Improvement' || c.performanceScore < 50)
      .slice(0, 3),
  [contents, visiblePlatforms]);

  const contentByFormat = useMemo(() => {
    const map = {};
    contents
      .filter(c => (visiblePlatforms.length ? visiblePlatforms : ['Instagram', 'TikTok', 'Threads']).includes(c.platform))
      .forEach(c => { map[c.format] = (map[c.format] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [contents, visiblePlatforms]);


  // AI score: simple weighted average of platform scores
  const aiScore = useMemo(() => {
    if (!platforms.length) return 0;
    const score = platforms.reduce((s, p) => {
      const erScore  = Math.min(100, (p.er / 10) * 100);
      const grScore  = Math.min(100, (p.growth / 5) * 100);
      return s + (erScore * 0.6 + grScore * 0.4);
    }, 0) / platforms.length;
    return Math.round(score);
  }, [platforms]);

  const aiLabel = aiScore >= 80 ? 'Sangat Baik' : aiScore >= 60 ? 'Baik' : aiScore >= 40 ? 'Cukup' : 'Perlu Peningkatan';

  // ── Recommendations derived from real data ───────────────────
  const recommendations = useMemo(() => {
    const recs = [];
    const igPlatform = platforms.find(p => p.key === 'instagram');
    const ttPlatform = platforms.find(p => p.key === 'tiktok');
    const thPlatform = platforms.find(p => p.key === 'threads');

    if (igPlatform && igPlatform.er < 3)
      recs.push(`ER Instagram kamu ${igPlatform.er.toFixed(1)}% masih di bawah 3%. Coba perbanyak format Carousel dengan hook pertanyaan di slide pertama.`);
    if (ttPlatform && ttPlatform.growth > (igPlatform?.growth ?? 0))
      recs.push(`TikTok tumbuh ${ttPlatform.growth.toFixed(1)}%/bulan, lebih cepat dari Instagram. Alokasikan lebih banyak konten video pendek.`);
    if (thPlatform && thPlatform.er > avgER)
      recs.push(`Threads punya ER ${thPlatform.er.toFixed(1)}% di atas rata-rata. Pertahankan frekuensi posting thread opini dan tanya-jawab.`);
    if (topContent[0])
      recs.push(`Format "${topContent[0].format}" di ${topContent[0].platform} adalah top performer. Produksi minimal 3x lebih banyak konten serupa bulan ini.`);
    if (lowContent[0]?.aiNote)
      recs.push(lowContent[0].aiNote);
    if (competitors.length > 0) {
      const topComp = [...competitors].sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))[0];
      if (topComp?.engagementRate > avgER)
        recs.push(`Kompetitor "${topComp.name}" unggul ER ${topComp.engagementRate?.toFixed(1)}% vs rata-rata kamu ${avgER.toFixed(1)}%. Pelajari pola konten mereka.`);
    }
    if (!recs.length)
      recs.push('Hubungkan akun platform untuk mendapatkan rekomendasi AI yang lebih personal dan akurat.');
    return recs.slice(0, 5);
  }, [platforms, topContent, lowContent, competitors, avgER]);

  const handleExportCSV = () => {
    const rows = [
      ['Platform', 'Followers', 'Growth %', 'Engagement Rate', 'Reach'],
      ...platforms.map(p => [p.label, p.followers, p.growth.toFixed(2), p.er.toFixed(2), p.reach]),
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `laporan-${nowMonth.replace(' ', '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loading = metricsLoading || contentsLoading;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-800">Laporan Bulanan — {nowMonth}</h2>
          <p className="text-sm text-gray-400">Ringkasan performa semua platform yang terkoneksi</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 transition-all">
            <FileSpreadsheet size={15} className="text-green-500" /> Export CSV
          </button>
          <button onClick={() => window.print()}
            className="purple-btn flex items-center gap-2 text-sm">
            <FileText size={15} /> Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Hero summary */}
          <div className="bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-400 rounded-3xl p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
            <div className="absolute bottom-0 left-20 w-32 h-32 bg-white/10 rounded-full translate-y-12" />
            <div className="relative z-10">
              <p className="text-white/70 text-sm mb-5 font-medium uppercase tracking-wide">Ringkasan {nowMonth}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-5">
                {[
                  { label: 'Total Followers',   value: fmt(totalFollowers) },
                  { label: 'Avg. Follower Growth', value: `+${avgGrowth.toFixed(2)}%` },
                  { label: 'Total Reach',        value: fmt(totalReach) },
                  { label: 'Avg. Engagement Rate', value: `${avgER.toFixed(2)}%` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-white/60 text-xs mb-1">{label}</p>
                    <p className="text-2xl font-bold tracking-tight">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center gap-2">
                  <Sparkles size={13} className="text-yellow-300" />
                  <span className="text-sm font-semibold">AI Score: {aiScore}/100 — {aiLabel}</span>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center gap-2">
                  <Users size={13} className="text-white/80" />
                  <span className="text-sm">{platforms.length} platform terhubung</span>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center gap-2">
                  <BarChart2 size={13} className="text-white/80" />
                  <span className="text-sm">{contents.length} konten tercatat</span>
                </div>
              </div>
            </div>
          </div>

          {/* Platform cards */}
          {platforms.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {platforms.map(p => (
                <div key={p.key} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${PLATFORM_BG[p.label] ?? 'from-gray-400 to-gray-600'} flex items-center justify-center`}>
                        <span className="text-white text-xs font-bold">{p.label[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{p.label}</p>
                        {p.username && <p className="text-[10px] text-gray-400">@{p.username}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-xl p-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Followers</p>
                      <p className="text-sm font-bold text-gray-800">{fmt(p.followers)}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-2">
                      <p className="text-[10px] text-emerald-600 mb-0.5">Growth</p>
                      <p className="text-sm font-bold text-emerald-600">+{p.growth.toFixed(2)}%</p>
                    </div>
                    <div className="bg-violet-50 rounded-xl p-2">
                      <p className="text-[10px] text-violet-500 mb-0.5">Eng. Rate</p>
                      <p className="text-sm font-bold text-violet-600">{p.er.toFixed(2)}%</p>
                    </div>
                  </div>
                  {p.reach > 0 && (
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Eye size={11} /> Reach</span>
                      <span className="font-semibold text-gray-600">{fmt(p.reach)}</span>
                    </div>
                  )}
                  {/* ER progress bar */}
                  <div className="mt-3">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (p.er / 10) * 100)}%`, background: PLATFORM_COLOR[p.label] ?? '#8b5cf6' }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">ER vs target 10%</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trend charts */}
          {(followerTrend.length > 1 || engagementTrend.length > 1) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {followerTrend.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Tren Followers</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={followerTrend}>
                      <defs>
                        <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E040FB" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#E040FB" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={40} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      {platforms.map(p => (
                        <Area key={p.key} type="monotone" dataKey={p.key}
                          name={p.label} stroke={PLATFORM_COLOR[p.label]} strokeWidth={2}
                          fill={`url(#igGrad)`} dot={false} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {engagementTrend.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Tren Engagement Rate</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={engagementTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={40} />
                      <Tooltip formatter={(v) => `${(v ?? 0).toFixed(2)}%`} />
                      {platforms.map(p => (
                        <Area key={p.key} type="monotone" dataKey={`${p.key}_er`}
                          name={p.label} stroke={PLATFORM_COLOR[p.label]} strokeWidth={2}
                          fill="transparent" dot={false} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Content distribution + Top vs Low */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Format distribution bar */}
            {contentByFormat.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <BarChart2 size={14} className="text-violet-500" /> Distribusi Format
                </h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={contentByFormat.map(([f, n]) => ({ format: f, count: n }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="format" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip />
                    <Bar dataKey="count" name="Konten" radius={[0, 4, 4, 0]}>
                      {contentByFormat.map((_, i) => (
                        <Cell key={i} fill={['#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b'][i % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top content */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-500" /> Top Konten
              </h3>
              {topContent.length === 0 ? (
                <p className="text-sm text-gray-400">Belum ada data konten</p>
              ) : (
                <div className="space-y-2">
                  {topContent.map((c, i) => (
                    <div key={c.id} className="flex items-start gap-2.5 p-2.5 bg-emerald-50 rounded-xl">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-700 line-clamp-1">{c.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-medium text-gray-500">{c.platform}</span>
                          <span className="text-[10px] text-gray-400">· ER {pct(c.engagementRate)}</span>
                          {c.performanceScore > 0 && <span className="text-[10px] text-emerald-600 font-semibold">· Score {c.performanceScore}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low content */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-red-400" /> Perlu Perhatian
              </h3>
              {lowContent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <CheckCircle size={24} className="text-emerald-300 mb-2" />
                  <p className="text-sm text-gray-400">Tidak ada konten underperform</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lowContent.map((c) => (
                    <div key={c.id} className="p-2.5 bg-red-50 rounded-xl">
                      <p className="text-xs font-semibold text-gray-700 line-clamp-1">{c.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 mb-1">
                        <span className="text-[10px] font-medium text-gray-500">{c.platform}</span>
                        <span className="text-[10px] text-gray-400">· ER {pct(c.engagementRate)}</span>
                      </div>
                      {c.aiNote && <p className="text-[10px] text-red-500 leading-snug">{c.aiNote}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Competitors snapshot */}
          {competitors.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Users size={14} className="text-violet-500" /> Snapshot Kompetitor
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                      {['Kompetitor','Platform','Followers','Eng. Rate','Format'].map(h => (
                        <th key={h} className={`px-3 py-2 ${h==='Kompetitor'?'text-left':'text-right last:text-center'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {competitors.slice(0, 5).map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-700">{c.name}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{c.platform}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-700">{fmt(c.followers)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-semibold ${(c.engagementRate??0)>=3?'text-emerald-600':(c.engagementRate??0)>=1?'text-amber-600':'text-red-500'}`}>
                            {(c.engagementRate??0).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-500">{c.topContentType ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Recommendations */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-400 rounded-lg flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">Rekomendasi AI untuk Bulan Depan</h3>
              <span className="text-[10px] text-gray-400 ml-auto">Berdasarkan data real-time</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-violet-50 rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                  <p className="text-sm text-gray-600 leading-snug">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
