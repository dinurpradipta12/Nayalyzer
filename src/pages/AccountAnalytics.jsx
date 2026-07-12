import { useState, useMemo, useEffect, useRef } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Sparkles, Clock, Calendar, Layout, TrendingUp, RefreshCw, Users, BarChart2 } from 'lucide-react';
import ChartCard from '../components/ui/ChartCard';
import PlatformBadge from '../components/ui/PlatformBadge';
import { accountData } from '../data/mockData';
import { useSocialData } from '../hooks/useSocialData';
import { SUPABASE_ENABLED } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';
import { AnalyticsSkeleton } from '../components/ui/Skeleton';

const PLATFORM_COLORS = { Instagram: '#E040FB', TikTok: '#26C6DA', Threads: '#78909C' };

const tabs = ['Instagram', 'TikTok', 'Threads'];

const GENDER_COLORS = { F: '#EC4899', M: '#8B5CF6', U: '#9ca3af', female: '#EC4899', male: '#8B5CF6' };
const GENDER_LABELS = { F: 'Perempuan', M: 'Laki-laki', U: 'Lainnya', female: 'Perempuan', male: 'Laki-laki' };

function GenderDonut({ total, genderData }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = 110 * dpr;
    canvas.height = 110 * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = 55, cy = 55, r = 40, sw = 13;
    const TAU = Math.PI * 2;
    const start = -Math.PI / 2;
    const isDark = document.documentElement.classList.contains('dark');
    const track  = isDark ? '#2d2450' : '#EDE9FE';

    ctx.clearRect(0, 0, 110, 110);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
    ctx.strokeStyle = track; ctx.lineWidth = sw; ctx.stroke();

    if (genderData && genderData.length > 0) {
      let angle = start;
      genderData.forEach((g, i) => {
        const slice = TAU * (g.pct / 100);
        const gap = i < genderData.length - 1 ? 0.06 : 0;
        ctx.beginPath();
        ctx.arc(cx, cy, r, angle, angle + slice - gap);
        ctx.strokeStyle = GENDER_COLORS[g.label] ?? '#9ca3af';
        ctx.lineWidth = sw; ctx.lineCap = 'round'; ctx.stroke();
        angle += slice;
      });
    } else {
      ctx.beginPath(); ctx.arc(cx, cy, r, start, start + TAU * 0.45);
      ctx.strokeStyle = '#EC4899'; ctx.lineWidth = sw; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r, start + TAU * 0.45 + 0.06, start + TAU * 0.999);
      ctx.strokeStyle = '#8B5CF6'; ctx.lineWidth = sw; ctx.lineCap = 'round'; ctx.stroke();
    }
  }, [genderData]);

  return (
    <div className="relative w-[110px] h-[110px] flex-shrink-0">
      <canvas ref={canvasRef} style={{ width: 110, height: 110 }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-base font-bold text-gray-800 leading-none">{total}</span>
        <span className="text-[9px] text-gray-400 mt-0.5">followers</span>
      </div>
    </div>
  );
}

function DemographicsSection({ platform, followers, demographics }) {
  if (platform !== 'Instagram') return null;
  if (!demographics) return (
    <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5 text-center text-sm text-gray-400">
      Data demografi belum tersedia — jalankan sync untuk mengambil dari Instagram API.
    </div>
  );

  const gender    = (demographics.gender   ?? []).sort((a, b) => b.pct - a.pct);
  const age       = (demographics.age      ?? []).sort((a, b) => {
    const order = ['13-17','18-24','25-34','35-44','45-54','55-64','65+'];
    return order.indexOf(a.label) - order.indexOf(b.label);
  });
  const countries = (demographics.country  ?? []).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const cities    = (demographics.city     ?? []).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const maxAge    = Math.max(...age.map(a => a.pct), 1);
  const maxCity   = Math.max(...cities.map(c => c.pct), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-violet-500" />
        <h4 className="text-sm font-semibold text-gray-700">Demografi Audiens</h4>
        <span className="text-[10px] font-semibold bg-violet-50 text-violet-500 px-2 py-0.5 rounded-full">● Live dari Instagram API</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gender */}
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-4">Gender</p>
          <div className="flex items-center gap-5">
            <GenderDonut total={followers > 1000 ? (followers / 1000).toFixed(1) + 'K' : followers} genderData={gender} />
            <div className="flex flex-col gap-3 flex-1">
              {gender.map(g => {
                const color = GENDER_COLORS[g.label] ?? '#9ca3af';
                const label = GENDER_LABELS[g.label] ?? g.label;
                return (
                  <div key={g.label}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-[11px] text-gray-400">{label}</span>
                    </div>
                    <span className="text-xl font-bold leading-none" style={{ color }}>{g.pct}%</span>
                    <div className="h-1 bg-purple-50 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${g.pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Age */}
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-4">Rentang Usia</p>
          <div className="flex flex-col gap-2.5">
            {age.map(a => (
              <div key={a.label} className="grid items-center gap-2" style={{ gridTemplateColumns: '38px 1fr 44px' }}>
                <span className="text-[11px] text-gray-400 tabular-nums">{a.label}</span>
                <div className="h-1.5 bg-purple-50 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${(a.pct / maxAge) * 100}%`,
                    background: a.pct === maxAge ? 'linear-gradient(90deg,#8B5CF6,#c084fc)' : '#8B5CF6',
                  }} />
                </div>
                <span className={`text-[11px] tabular-nums text-right ${a.pct === maxAge ? 'font-bold text-violet-600' : 'font-medium text-gray-600'}`}>
                  {a.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Countries */}
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-4">Top Negara</p>
          <div className="flex flex-col gap-3">
            {countries.map((c, i) => (
              <div key={c.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-300 tabular-nums w-3">{i + 1}.</span>
                    <span className="text-xs font-semibold text-gray-700">{c.label}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-700 tabular-nums">{c.pct}%</span>
                </div>
                <div className="h-1 bg-purple-50 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-violet-400" style={{ width: `${c.pct}%`, opacity: 1 - i * 0.1 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cities */}
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-4">Top Kota</p>
          <div className="flex flex-col gap-3">
            {cities.map((c, i) => (
              <div key={c.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-300 tabular-nums w-3">{i + 1}.</span>
                    <span className="text-xs font-semibold text-gray-700">{c.label}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-700 tabular-nums">{c.pct}%</span>
                </div>
                <div className="h-1 bg-purple-50 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-violet-400" style={{ width: `${(c.pct / maxCity) * 100}%`, opacity: 1 - i * 0.1 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-purple-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-gray-800">{value}</span>
        {sub && <span className="text-xs text-gray-400 block">{sub}</span>}
      </div>
    </div>
  );
}

function PlatformCard({ data }) {
  const color = PLATFORM_COLORS[data.platform];
  const radarData = [
    { subject: 'Followers', A: Math.min((data.followers / 150000) * 100, 100) },
    { subject: 'Engagement', A: Math.min((data.engagementRate / 10) * 100, 100) },
    { subject: 'Reach', A: Math.min((data.reach / 600000) * 100, 100) },
    { subject: 'Konten', A: Math.min((data.contentPublished / 50) * 100, 100) },
    { subject: 'Growth', A: Math.min((data.followerGrowthPercent / 8) * 100, 100) },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <PlatformBadge platform={data.platform} size="md" />
            <p className="text-lg font-bold text-gray-800 mt-2">{data.username}</p>
            <p className="text-sm text-gray-400">{data.accountName}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-800">{data.followers.toLocaleString('id-ID')}</p>
            <p className="text-xs text-green-600 font-semibold">+{data.followerGrowthPercent}% · +{data.followerGrowth.toLocaleString('id-ID')} followers</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(data.platform === 'Instagram'
            ? [
                { label: 'Reach',           value: data.reach > 0 ? (data.reach >= 1000 ? (data.reach / 1000).toFixed(1) + 'K' : data.reach.toString()) : '–' },
                { label: 'Views',           value: data.impressions > 0 ? (data.impressions >= 1000 ? (data.impressions / 1000).toFixed(1) + 'K' : data.impressions.toString()) : '–' },
                { label: 'Engagement Rate', value: data.engagementRate + '%', highlight: true },
                { label: 'Konten Terbit',   value: data.contentPublished },
              ]
            : [
                { label: 'Views',           value: data.impressions > 0 ? (data.impressions >= 1000 ? (data.impressions / 1000).toFixed(1) + 'K' : data.impressions.toString()) : '–' },
                { label: 'Total Interaksi', value: data.totalInteractions > 0 ? (data.totalInteractions >= 1000 ? (data.totalInteractions / 1000).toFixed(1) + 'K' : data.totalInteractions.toString()) : '–' },
                { label: 'Engagement Rate', value: data.engagementRate + '%', highlight: true },
                { label: 'Konten Terbit',   value: data.contentPublished },
              ]
          ).map(({ label, value, highlight }) => (
            <div key={label} className="bg-lavender-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="font-bold text-gray-800" style={{ color: highlight ? color : undefined }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar */}
        <ChartCard title="Performa Overview" subtitle="Skor relatif per dimensi">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#EDE9FE" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Radar name={data.platform} dataKey="A" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Audience activity */}
        <ChartCard title="Aktivitas Audiens" subtitle="Jam aktif terbanyak (index)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.audienceActivity} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}:00`} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="bg-white rounded-xl shadow-lg border border-purple-100 p-3 text-xs">
                    <p className="font-semibold text-gray-700">{label}:00</p>
                    <p style={{ color }} className="font-semibold">Activity: {payload[0].value}</p>
                  </div>
                ) : null}
              />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Stats & Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Detail Metrik</h4>
          <MetricRow label="Rata-rata Likes" value={data.avgLikes.toLocaleString('id-ID')} />
          <MetricRow label="Rata-rata Comments" value={data.avgComments} />
          <MetricRow label="Rata-rata Shares" value={data.avgShares} />
          {data.avgSaves > 0 && <MetricRow label="Rata-rata Saves" value={data.avgSaves} />}
          <MetricRow label="Following" value={data.following.toLocaleString('id-ID')} />
        </div>

        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Rekomendasi Strategi</h4>
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                <Calendar size={14} style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">Hari Terbaik</p>
                <p className="text-xs text-gray-500">{data.bestPostingDay}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                <Clock size={14} style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">Jam Terbaik</p>
                <p className="text-xs text-gray-500">{data.bestPostingTime}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                <Layout size={14} style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">Format Terbaik</p>
                <p className="text-xs text-gray-500">{data.bestContentFormat}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                <TrendingUp size={14} style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">Pillar Konten</p>
                <p className="text-xs text-gray-500">{data.topContentPillars.join(' · ')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demographics */}
      <DemographicsSection platform={data.platform} followers={data.followers} demographics={data.demographics} />

      {/* AI Insight */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-400 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <p className="text-sm font-semibold text-violet-800">AI Insight untuk {data.platform}</p>
        </div>
        <p className="text-sm text-violet-700 leading-relaxed">{data.aiInsight}</p>
      </div>
    </div>
  );
}

export default function AccountAnalytics() {
  const [activeTab, setActiveTab] = useState('Instagram');
  const { activeWorkspace } = useWorkspace();
  const { accounts, contents, metrics, syncing, loading, reload } = useSocialData(activeWorkspace?.id);

  const demo = !SUPABASE_ENABLED;

  // Merge real data into mock for the active platform
  const data = useMemo(() => {
    const mock = accountData[activeTab.toLowerCase()];
    const real = accounts[activeTab.toLowerCase()];
    // User asli belum connect → null (empty state), bukan mock. Demo mode → mock.
    if (!real) return demo ? mock : null;

    const platformKey = activeTab.toLowerCase();
    const platformContents = contents.filter(c => c.platform === activeTab);
    const hasContent = platformContents.length > 0;

    // Avg content metrics
    const avgLikes = hasContent
      ? Math.round(platformContents.reduce((s, c) => s + (c.content_metrics?.[0]?.likes ?? 0), 0) / platformContents.length)
      : mock.avgLikes;
    const avgComments = hasContent
      ? Math.round(platformContents.reduce((s, c) => s + (c.content_metrics?.[0]?.comments ?? 0), 0) / platformContents.length)
      : mock.avgComments;
    const avgShares = hasContent
      ? Math.round(platformContents.reduce((s, c) => s + (c.content_metrics?.[0]?.shares ?? 0), 0) / platformContents.length)
      : mock.avgShares;

    // Account-level metrics from account_metrics table (last 30 days sum)
    const acctMetrics = metrics[platformKey] ?? [];
    const totalReach = acctMetrics.reduce((s, r) => s + (r.reach ?? 0), 0);
    const totalImpressions = acctMetrics.reduce((s, r) => s + (r.impressions ?? 0), 0);
    // Fallback: sum video views from content_metrics when account-level impressions unavailable
    const totalContentViews = platformContents.reduce((s, c) => s + (c.content_metrics?.[0]?.views ?? 0), 0);
    const hasAcctMetrics = acctMetrics.length > 0;

    // Total interactions (for Threads): from account_metrics or sum likes+comments+shares
    const acctTotalInteractions = acctMetrics.reduce((s, r) => s + (r.total_interactions ?? 0), 0);
    const contentTotalInteractions = platformContents.reduce((s, c) => {
      const m = c.content_metrics?.[0] ?? {};
      return s + (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0);
    }, 0);
    const totalInteractions = acctTotalInteractions > 0 ? acctTotalInteractions : contentTotalInteractions;

    // ER from content metrics if available
    const engagementRate = hasContent
      ? +(platformContents.reduce((s, c) => s + (c.content_metrics?.[0]?.engagement_rate ?? 0), 0) / platformContents.length).toFixed(1)
      : (hasAcctMetrics ? mock.engagementRate : 0);

    return {
      ...mock,
      username:         real.username ? `@${real.username}` : (real.account_name ? `@${real.account_name}` : mock.username),
      accountName:      real.account_name ?? mock.accountName,
      followers:        real.followers_count ?? mock.followers,
      contentPublished: platformContents.length || mock.contentPublished,
      avgLikes,
      avgComments,
      avgShares,
      reach:            hasAcctMetrics ? totalReach : 0,
      impressions:      totalImpressions > 0 ? totalImpressions : totalContentViews,
      engagementRate,
      totalInteractions,
      demographics:     real.demographics ?? null,
    };
  }, [activeTab, accounts, contents, metrics, demo]);

  if (loading) return <AnalyticsSkeleton />;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 bg-white rounded-2xl p-1 shadow-card border border-purple-50">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150
                ${activeTab === tab
                  ? 'bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-purple'
                  : 'text-gray-500 hover:text-violet-600'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        {syncing
          ? <span className="text-xs text-violet-500 flex items-center gap-1"><RefreshCw size={11} className="animate-spin" /> Sinkronisasi...</span>
          : accounts[activeTab.toLowerCase()]
            ? <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full font-medium flex items-center gap-1">● Data Live</span>
            : <button onClick={reload} className="text-xs text-gray-400 hover:text-violet-500 flex items-center gap-1"><RefreshCw size={11} /> Refresh</button>
        }
      </div>

      {data ? (
        <PlatformCard data={data} />
      ) : (
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-lavender-50 flex items-center justify-center mx-auto mb-4">
            <BarChart2 size={24} className="text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Belum ada data {activeTab}</p>
          <p className="text-xs text-gray-400 mb-4">Hubungkan akun {activeTab} kamu untuk melihat analitiknya di sini.</p>
          <a href="/settings"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-400 text-white text-xs font-bold hover:shadow-purple transition-all">
            Hubungkan Akun
          </a>
        </div>
      )}
    </div>
  );
}
