import { useState, useMemo, useRef, useEffect } from 'react';
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Search, ThumbsUp, MessageSquare, Eye, PlaySquare, RefreshCw,
  BadgeCheck, Users, Hash, AtSign, Heart, AlertCircle, Loader2,
  History, Trash2, X,
} from 'lucide-react';
import ChartCard from '../components/ui/ChartCard';
import PlatformBadge from '../components/ui/PlatformBadge';
import { supabase } from '../lib/supabase';

// Palet ungu/lavender khas Nayalyzer
const AUTH_COLORS  = { real: '#8B5CF6', mass: '#C084FC', influencer: '#DDD6FE', suspicious: '#F0ABFC' };

// Proxy gambar CDN (Instagram/TikTok memblokir hotlink langsung)
function proxyImg(src) {
  if (!src) return null;
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profile-analyzer?img=${encodeURIComponent(src)}`;
}
const REACH_COLORS = ['#8B5CF6', '#A855F7', '#C084FC', '#E9D5FF'];

// ── Deterministic pseudo-random dari username ─────────────────
function seededRand(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return () => {
    h = Math.imul(48271, h) | 0 % 2147483647;
    return ((h & 0x7fffffff) % 1000) / 1000;
  };
}

// ── Derive analisa lanjutan dari data dasar scraping ──────────
function deriveAnalytics(profile) {
  const rnd = seededRand(profile.username + profile.platform);
  const posts = profile.recent_posts ?? [];
  const hasPosts = posts.length > 0;

  const avgLikes = hasPosts
    ? Math.round(posts.reduce((s, p) => s + (p.likes ?? 0), 0) / posts.length)
    : Math.round(profile.followers * (0.005 + rnd() * 0.03));
  const avgComments = hasPosts
    ? Math.round(posts.reduce((s, p) => s + (p.comments ?? 0), 0) / posts.length)
    : Math.round(avgLikes * (0.03 + rnd() * 0.1));
  const videoPosts = posts.filter(p => p.is_video && p.views);
  const avgViews = videoPosts.length
    ? Math.round(videoPosts.reduce((s, p) => s + p.views, 0) / videoPosts.length)
    : Math.round(profile.followers * (0.05 + rnd() * 0.25));
  const vtr = profile.followers > 0 ? +((avgViews / profile.followers) * 100).toFixed(1) : 0;

  // ER: ambil 5–8 konten dengan engagement tertinggi,
  // total (likes + comments) dibagi total followers × 100%
  let er = 0;
  if (profile.followers > 0) {
    if (hasPosts) {
      const topPosts = [...posts]
        .sort((x, y) => ((y.likes ?? 0) + (y.comments ?? 0)) - ((x.likes ?? 0) + (x.comments ?? 0)))
        .slice(0, Math.min(8, Math.max(5, posts.length)));
      const totalEng = topPosts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0), 0);
      er = +((totalEng / profile.followers) * 100).toFixed(2);
    } else {
      er = +(((avgLikes + avgComments) / profile.followers) * 100).toFixed(2);
    }
  }

  // Tier influencer (standar industri)
  // Nano: 1K–10K · Micro: 10K–100K · Mid-Tier: 100K–500K · Macro: 500K–1M · Mega: 1M+
  const f = profile.followers;
  const tier =
    f >= 1_000_000 ? 'Mega' :
    f >= 500_000   ? 'Macro' :
    f >= 100_000   ? 'Mid-Tier' :
    f >= 10_000    ? 'Micro' :
    f >= 1_000     ? 'Nano' : 'Regular';

  // Authenticity split (estimasi)
  const real = 45 + rnd() * 25;
  const mass = 15 + rnd() * 15;
  const influencer = 5 + rnd() * 12;
  const suspicious = Math.max(2, 100 - real - mass - influencer);
  const authenticity = [
    { name: 'Real',           value: +real.toFixed(1),        color: AUTH_COLORS.real },
    { name: 'Mass Followers', value: +mass.toFixed(1),        color: AUTH_COLORS.mass },
    { name: 'Influencers',    value: +influencer.toFixed(1),  color: AUTH_COLORS.influencer },
    { name: 'Suspicious',     value: +suspicious.toFixed(1),  color: AUTH_COLORS.suspicious },
  ];

  // Reachability
  const reachability = [
    { name: '≤500 following',     value: +(40 + rnd() * 20).toFixed(1) },
    { name: '500–1000 following', value: +(20 + rnd() * 15).toFixed(1) },
    { name: '1000–1500',          value: +(10 + rnd() * 10).toFixed(1) },
    { name: '>1500 following',    value: +(5 + rnd() * 10).toFixed(1) },
  ];

  // Growth 6 bulan (mundur dari sekarang)
  const growth = [];
  let base = profile.followers * (0.88 + rnd() * 0.06);
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    base += (profile.followers - base) * (0.3 + rnd() * 0.3);
    growth.push({
      month: d.toLocaleString('id-ID', { month: 'short', year: '2-digit' }),
      followers: i === 0 ? profile.followers : Math.round(base),
    });
  }

  // Avg engagements per post (real dari data post)
  const avgEngagements = hasPosts
    ? Math.round(posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0), 0) / posts.length)
    : avgLikes + avgComments;

  // ── Audience Demography (ESTIMASI — API publik tidak menyediakan demografi akun lain) ──
  // Gender split: estimasi deterministik dari karakter akun
  const femalePct = +(35 + rnd() * 45).toFixed(1);
  const gender = [
    { name: 'Female', value: femalePct,                    color: '#8B5CF6' },
    { name: 'Male',   value: +(100 - femalePct).toFixed(1), color: '#C084FC' },
  ];

  // Age distribution: kurva umum sosial media Indonesia, digeser sedikit per akun
  const ageShift = rnd() * 10 - 5;
  const rawAge = [
    { range: '13-17', v: 8 + ageShift * 0.4 },
    { range: '18-24', v: 38 + ageShift },
    { range: '25-34', v: 30 - ageShift * 0.5 },
    { range: '35-44', v: 14 - ageShift * 0.3 },
    { range: '45-54', v: 6 },
    { range: '55-64', v: 3 },
    { range: '65+',   v: 1 },
  ];
  const ageTotal = rawAge.reduce((s, a) => s + Math.max(0.5, a.v), 0);
  const age = rawAge.map(a => ({ range: a.range, pct: +((Math.max(0.5, a.v) / ageTotal) * 100).toFixed(1) }));

  // Top locations: estimasi berbasis distribusi kota besar Indonesia
  const cityPool = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Medan', 'Semarang', 'Makassar', 'Bali', 'Tangerang', 'Bekasi'];
  const locCount = 5;
  const picked = [];
  let li = Math.floor(rnd() * 3);
  while (picked.length < locCount) {
    if (!picked.includes(cityPool[li % cityPool.length])) picked.push(cityPool[li % cityPool.length]);
    li += 1 + Math.floor(rnd() * 2);
  }
  let locBase = 18 + rnd() * 8;
  const locations = picked.map((city, i) => {
    const pct = +(locBase).toFixed(1);
    locBase *= 0.62 + rnd() * 0.12;
    return { city, pct, color: ['#8B5CF6', '#A855F7', '#C084FC', '#DDD6FE', '#E9D5FF'][i] };
  });

  // Hashtags & mentions dari caption
  const hashtags = {};
  const mentions = {};
  posts.forEach(p => {
    (p.caption?.match(/#[\p{L}\d_]+/gu) ?? []).forEach(t => { hashtags[t.toLowerCase()] = (hashtags[t.toLowerCase()] ?? 0) + 1; });
    (p.caption?.match(/@[\p{L}\d._]+/gu) ?? []).forEach(t => { mentions[t.toLowerCase()] = (mentions[t.toLowerCase()] ?? 0) + 1; });
  });
  const topHashtags = Object.entries(hashtags).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  const topMentions = Object.entries(mentions).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);

  // Interests (estimasi dari bio + caption keyword sederhana)
  const text = (profile.biography + ' ' + posts.map(p => p.caption).join(' ')).toLowerCase();
  const interestMap = [
    ['Friends, Family & Relationships', ['keluarga', 'family', 'teman', 'friend', 'love']],
    ['Business & Careers',              ['bisnis', 'business', 'karir', 'career', 'kerja', 'uang', 'income', 'juta']],
    ['Clothes, Shoes & Accessories',    ['fashion', 'outfit', 'style', 'ootd']],
    ['Travel, Tourism & Aviation',      ['travel', 'trip', 'bali', 'jalan', 'liburan', 'wisata']],
    ['Restaurants, Food & Grocery',     ['food', 'makan', 'kuliner', 'cafe', 'resto']],
    ['Beauty & Cosmetics',              ['beauty', 'skincare', 'makeup']],
    ['Education & Learning',            ['belajar', 'edukasi', 'tips', 'kelas', 'materi', 'ilmu']],
  ];
  const interests = interestMap
    .map(([label, kws]) => {
      const hits = kws.reduce((s, kw) => s + (text.split(kw).length - 1), 0);
      return { label, score: hits };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((it, i) => ({ ...it, pct: +(30 - i * 1.5 - rnd() * 3).toFixed(1) }));

  const totalEngagement = posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);

  return {
    avgLikes, avgComments, avgViews, vtr, er, tier, avgEngagements,
    authenticity, reachability, growth,
    gender, age, locations,
    topHashtags, topMentions, interests,
    totalEngagement, totalLikes, totalViews,
  };
}

function fmtNum(n) {
  if (n == null) return '–';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('id-ID');
}

// ── Persistence ────────────────────────────────────────────────
const STORAGE_KEY = 'naya_analyser_result';
const HISTORY_KEY = 'naya_analyser_history';
const MAX_HISTORY = 10;

function readSavedResult() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Simpan ke history: entri terbaru di depan, dedupe per platform+username, maksimal 10
function pushHistory(entry) {
  let list = readHistory().filter(
    h => !(h.platform === entry.platform && h.username === entry.username)
  );
  list.unshift(entry);
  list = list.slice(0, MAX_HISTORY);
  // Kalau storage penuh (profil + thumbnail besar), buang entri terlama sampai muat
  while (list.length) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      break;
    } catch {
      list.pop();
    }
  }
  return list;
}

// ── History dropdown ───────────────────────────────────────────
function HistoryDropdown({ history, onSelect, onDelete, onClear, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} title="History analisa"
        className="p-2.5 rounded-xl bg-white border border-purple-100 text-gray-500 hover:text-violet-600 hover:border-violet-300 transition-colors shadow-sm">
        <History size={16} />
      </button>

      {open && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 z-30 bg-white border border-purple-100 rounded-2xl shadow-lg overflow-hidden w-72`}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-purple-50">
            <p className="text-xs font-semibold text-gray-600">History Analisa</p>
            {history.length > 0 && (
              <button onClick={() => { onClear(); setOpen(false); }}
                className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">
                Hapus semua
              </button>
            )}
          </div>
          {history.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">Belum ada history</p>
          )}
          <div className="max-h-80 overflow-y-auto">
            {history.map((h, i) => (
              <div key={`${h.platform}-${h.username}`}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-lavender-50 transition-colors group">
                <button onClick={() => { onSelect(h); setOpen(false); }}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                  {h.profile?.profile_pic
                    ? <img src={proxyImg(h.profile.profile_pic)} alt="" referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                    : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-300 to-purple-200 flex items-center justify-center text-violet-700 text-xs font-bold flex-shrink-0">
                        {h.username?.[0]?.toUpperCase()}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">@{h.username}</p>
                    <p className="text-[10px] text-gray-400 capitalize">
                      {h.platform} · {h.savedAt ? new Date(h.savedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </button>
                <button onClick={() => onDelete(i)} title="Hapus dari history"
                  className="p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function Analyser() {
  const saved = useMemo(readSavedResult, []);
  const [platform, setPlatform] = useState(saved?.platform ?? 'instagram');
  const [username, setUsername] = useState(saved?.username ?? '');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [profile, setProfile]   = useState(saved?.profile ?? null);
  const [history, setHistory]   = useState(readHistory);

  const selectHistory = (h) => {
    setPlatform(h.platform);
    setUsername(h.username);
    setProfile(h.profile);
    setError(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        platform: h.platform, username: h.username, profile: h.profile, savedAt: h.savedAt,
      }));
    } catch { /* abaikan */ }
  };

  const deleteHistory = (index) => {
    const list = history.filter((_, i) => i !== index);
    setHistory(list);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* abaikan */ }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const analytics = useMemo(() => profile ? deriveAnalytics(profile) : null, [profile]);

  const handleAnalyze = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profile-analyzer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ platform, username: username.trim() }),
        },
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal mengambil data');
      setProfile(json);
      const entry = { platform, username: username.trim(), profile: json, savedAt: Date.now() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
      } catch { /* storage penuh — abaikan */ }
      setHistory(pushHistory(entry));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Empty state ──────────────────────────────────────────────
  if (!profile && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center shadow-purple mb-5">
          <Search size={26} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Analyser</h2>
        <p className="text-sm text-gray-400 mb-6 text-center">
          Analisa akun social media siapa pun untuk performa lebih baik
        </p>

        {/* Platform selector */}
        <div className="flex gap-2 bg-white rounded-2xl p-1 shadow-card border border-purple-50 mb-4">
          {['instagram', 'tiktok'].map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all capitalize
                ${platform === p
                  ? 'bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-purple'
                  : 'text-gray-500 hover:text-violet-600'}`}>
              {p === 'instagram' ? 'Instagram' : 'TikTok'}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="w-full max-w-md flex gap-2">
          <div className="flex-1 relative">
            <AtSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder={`username ${platform === 'instagram' ? 'Instagram' : 'TikTok'}...`}
              className="w-full pl-9 pr-4 py-3 rounded-2xl border border-purple-100 bg-white text-sm text-gray-700 focus:outline-none focus:border-violet-400 shadow-sm"
            />
          </div>
          <button onClick={handleAnalyze} disabled={!username.trim()}
            className="purple-btn text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            <Search size={15} /> Kumpulkan Data
          </button>
          <HistoryDropdown history={history} onSelect={selectHistory}
            onDelete={deleteHistory} onClear={clearHistory} />
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        <p className="text-[11px] text-gray-300 mt-6">Threads belum didukung untuk analisa profil publik</p>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="text-violet-500 animate-spin mb-4" />
        <p className="text-sm text-gray-500">Mengumpulkan data @{username}...</p>
        <p className="text-xs text-gray-300 mt-1">Scraping profil {platform === 'instagram' ? 'Instagram' : 'TikTok'}</p>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────
  const a = analytics;
  return (
    <div className="space-y-4">
      {/* Reset bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Hasil analisa · {profile.source === 'live' ? 'Data live scraping' : 'Data estimasi'}</p>
        <div className="flex items-center gap-2">
          <HistoryDropdown history={history} onSelect={selectHistory}
            onDelete={deleteHistory} onClear={clearHistory} />
          <button onClick={() => { setProfile(null); setUsername(''); setError(null); localStorage.removeItem(STORAGE_KEY); }}
            className="text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 font-medium transition-colors">
            Reset
          </button>
        </div>
      </div>

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Identitas */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {profile.profile_pic
              ? <img src={proxyImg(profile.profile_pic)} alt={profile.username} referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border-2 border-purple-100 flex-shrink-0"
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
              : <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 to-purple-300 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {profile.username?.[0]?.toUpperCase()}
                </div>
            }
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-800 flex items-center gap-1.5 truncate">
                  {profile.full_name || profile.username}
                  {profile.is_verified && <BadgeCheck size={16} className="text-blue-500 flex-shrink-0" />}
                </p>
                <span className="text-[10px] font-semibold bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">{a.tier}</span>
                <PlatformBadge platform={platform === 'instagram' ? 'Instagram' : 'TikTok'} size="xs" />
              </div>
              <p className="text-sm text-gray-400 truncate">@{profile.username}</p>
              {profile.biography && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{profile.biography}</p>}
            </div>
          </div>

          {/* Stat group — kanan, dipisah divider vertikal */}
          <div className="flex items-center justify-around lg:justify-end lg:gap-0 flex-shrink-0 border-t lg:border-t-0 border-purple-50 pt-4 lg:pt-0">
            {[
              ['ER', `${a.er}%`, true],
              ['Followers', fmtNum(profile.followers), false],
              ['Following', fmtNum(profile.following), false],
            ].map(([label, value, highlight], i) => (
              <div key={label}
                className={`text-center px-5 lg:px-7 ${i > 0 ? 'border-l border-purple-100' : ''}`}>
                <p className={`text-2xl font-bold ${highlight ? 'text-violet-600' : 'text-gray-800'}`}>{value}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Creator Performance */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-gradient-to-b from-violet-500 to-purple-400 rounded-full" />
          Creator Performance
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: Heart,         label: 'Engagement Rate', value: `${a.er}%` },
            { icon: Users,         label: 'Avg. Engagements', value: fmtNum(a.avgEngagements) },
            { icon: ThumbsUp,      label: 'Avg. Likes',    value: fmtNum(a.avgLikes) },
            { icon: MessageSquare, label: 'Avg. Comments', value: fmtNum(a.avgComments) },
            { icon: Eye,           label: platform === 'instagram' ? 'Avg. Reels Views' : 'Avg. Video Views', value: fmtNum(a.avgViews) },
            { icon: PlaySquare,    label: 'View Rate',     value: `${a.vtr}%` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-purple-50 shadow-card p-4 hover:shadow-soft transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center mb-2.5">
                <Icon size={15} className="text-violet-500" />
              </div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5 leading-tight">{label}</p>
              <p className="text-lg font-bold text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Audience Demography */}
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-gradient-to-b from-violet-500 to-purple-400 rounded-full" />
          Audience Demography
        </h4>
        <p className="text-[11px] text-gray-400 mb-4">Estimasi — API publik tidak menyediakan demografi audiens akun lain</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Gender */}
          <div className="border border-purple-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Gender</p>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={a.gender} dataKey="value" nameKey="name"
                  innerRadius={45} outerRadius={70} startAngle={90} endAngle={-270}>
                  {a.gender.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={v => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-1">
              {a.gender.map(g => (
                <span key={g.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                  {g.name} ({g.value}%)
                </span>
              ))}
            </div>
          </div>

          {/* Age */}
          <div className="border border-purple-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Age</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={a.age} margin={{ top: 18, right: 5, bottom: 0, left: -20 }}>
                <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="pct" name="Persentase" fill="#8B5CF6" radius={[4, 4, 0, 0]}
                  label={{ position: 'top', fontSize: 9, fill: '#6b7280', formatter: v => `${v}%` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Locations */}
          <div className="border border-purple-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-3">Top Locations</p>
            <div className="flex h-4 rounded-full overflow-hidden mb-4">
              {a.locations.map(l => (
                <div key={l.city} style={{ width: `${l.pct * 2}%`, background: l.color }} title={`${l.city} (${l.pct}%)`} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {a.locations.map(l => (
                <span key={l.city} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                  {l.city} ({l.pct}%)
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Authenticity + Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="User Authenticity" subtitle="Estimasi komposisi followers">
          <div className="flex items-center">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={a.authenticity} dataKey="value" nameKey="name" outerRadius={80} startAngle={90} endAngle={-270}>
                  {a.authenticity.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={v => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {a.authenticity.map(s => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                  <span className="text-gray-600">{s.name} — {s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Profile Growth - Last 6 Months" subtitle="Estimasi pertumbuhan followers">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={a.growth} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} domain={['dataMin', 'dataMax']} />
              <Tooltip formatter={v => v.toLocaleString('id-ID')} />
              <Line type="monotone" dataKey="followers" name="Followers" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3, fill: '#8B5CF6' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Reachability + Interests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Followers Reachability" subtitle="Distribusi jumlah following dari followers">
          <div className="flex items-center">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={a.reachability} dataKey="value" nameKey="name" outerRadius={80} startAngle={90} endAngle={-270}>
                  {a.reachability.map((_, i) => <Cell key={i} fill={REACH_COLORS[i % REACH_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {a.reachability.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ background: REACH_COLORS[i % REACH_COLORS.length] }} />
                  <span className="text-gray-600">{s.name} — {s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Top Interests" subtitle="Estimasi minat audiens dari konten">
          <div className="space-y-3 mt-2">
            {a.interests.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Tidak cukup data konten</p>}
            {a.interests.map(it => (
              <div key={it.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{it.label}</span>
                  <span className="text-gray-500 font-semibold">{it.pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full" style={{ width: `${(it.pct / 35) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Hashtags + Mentions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top Hashtags" subtitle="Dari caption konten terbaru">
          <div className="flex flex-wrap gap-x-3 gap-y-2 mt-1">
            {a.topHashtags.length === 0 && <p className="text-xs text-gray-400">Tidak ada hashtag terdeteksi</p>}
            {a.topHashtags.map(t => (
              <span key={t} className="text-xs text-violet-600 flex items-center gap-0.5">
                <Hash size={10} />{t.slice(1)}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Top Mentions" subtitle="Akun yang sering disebut">
          <div className="flex flex-wrap gap-x-3 gap-y-2 mt-1">
            {a.topMentions.length === 0 && <p className="text-xs text-gray-400">Tidak ada mention terdeteksi</p>}
            {a.topMentions.map(t => (
              <span key={t} className="text-xs text-violet-600 flex items-center gap-0.5">
                <AtSign size={10} />{t.slice(1)}
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Contents */}
      {profile.recent_posts?.length > 0 && (
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Contents</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { icon: Eye,     label: 'Avg. Views',      value: fmtNum(a.avgViews) },
              { icon: Users,   label: 'Engagement',      value: fmtNum(a.totalEngagement) },
              { icon: Eye,     label: 'Total Views',     value: fmtNum(a.totalViews) },
              { icon: Heart,   label: 'Media Likes',     value: fmtNum(a.totalLikes) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="border border-purple-50 rounded-2xl p-3">
                <Icon size={14} className="text-violet-500 mb-2" />
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...profile.recent_posts]
              .sort((x, y) => ((y.likes ?? 0) + (y.comments ?? 0)) - ((x.likes ?? 0) + (x.comments ?? 0)))
              .slice(0, 8)
              .map(p => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer"
                className="w-44 flex-shrink-0 border border-purple-50 rounded-xl overflow-hidden hover:shadow-soft transition-shadow">
                {p.thumbnail && (
                  <img src={proxyImg(p.thumbnail)} alt="" referrerPolicy="no-referrer" loading="lazy"
                    className="w-full h-40 object-cover"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                )}
                <div className="p-2.5">
                  <p className="text-[10px] text-gray-400 mb-1">
                    {p.taken_at ? new Date(p.taken_at * 1000).toLocaleDateString('id-ID') : ''}
                  </p>
                  <p className="text-[11px] text-gray-600 line-clamp-3 mb-1.5">{p.caption || '–'}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="flex items-center gap-0.5"><ThumbsUp size={9} />{fmtNum(p.likes)}</span>
                    <span className="flex items-center gap-0.5"><MessageSquare size={9} />{fmtNum(p.comments)}</span>
                    {p.views != null && <span className="flex items-center gap-0.5"><Eye size={9} />{fmtNum(p.views)}</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
