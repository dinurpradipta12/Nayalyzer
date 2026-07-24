import { useState, useMemo, useRef, useEffect } from 'react';
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Search, ThumbsUp, MessageSquare, Eye, PlaySquare, RefreshCw,
  BadgeCheck, Users, Hash, AtSign, Heart, AlertCircle, Loader2,
  History, Trash2, X, GitCompareArrows, Calculator, Target, DollarSign,
  TrendingUp, ShieldCheck, PackageCheck, Store, Megaphone, Lightbulb,
  Trophy, ClipboardCheck,
} from 'lucide-react';
import ChartCard from '../components/ui/ChartCard';
import PlatformBadge from '../components/ui/PlatformBadge';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';
import { usePlatformVisibility } from '../lib/platformVisibility';

// Palet ungu/lavender khas Nayalyzer
const AUTH_COLORS  = { real: '#187877', mass: '#0B2A50', influencer: '#A8D5D1', suspicious: '#7DBDB9' };
const ANALYSER_PLATFORM_KEYS = ['instagram', 'tiktok', 'threads'];
const PLATFORM_LABELS = { instagram: 'Instagram', tiktok: 'TikTok', threads: 'Threads' };

function platformLabel(platform) {
  return PLATFORM_LABELS[platform] || platform;
}

// Proxy gambar CDN (Instagram/TikTok/Threads memblokir hotlink langsung)
function proxyImg(src) {
  if (!src) return null;
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profile-analyzer?img=${encodeURIComponent(src)}`;
}
// ── Deterministic pseudo-random dari username ─────────────────
function seededRand(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return () => {
    h = Math.imul(48271, h) | 0 % 2147483647;
    return ((h & 0x7fffffff) % 1000) / 1000;
  };
}

const INTEREST_TAXONOMY = [
  ['Business & Careers', ['bisnis', 'business', 'karir', 'career', 'kerja', 'agency', 'agency', 'strategist', 'strategy', 'marketing', 'growth', 'sales', 'income', 'uang', 'juta', 'brand', 'branding', 'umkm', 'startup']],
  ['Education & Learning', ['belajar', 'edukasi', 'education', 'tips', 'tutorial', 'kelas', 'course', 'materi', 'ilmu', 'workshop', 'mentor', 'mentoring', 'training', 'coach', 'insight']],
  ['Social Media & Content', ['sosmed', 'socmed', 'social media', 'content', 'konten', 'creator', 'kreator', 'instagram', 'tiktok', 'threads', 'reels', 'caption', 'hook', 'viral']],
  ['Friends, Family & Relationships', ['keluarga', 'family', 'teman', 'friend', 'relationship', 'love', 'pasangan', 'anak']],
  ['Clothes, Shoes & Accessories', ['fashion', 'outfit', 'style', 'ootd', 'clothes', 'shoes', 'sepatu', 'aksesoris', 'accessories']],
  ['Travel, Tourism & Aviation', ['travel', 'trip', 'bali', 'jalan', 'liburan', 'wisata', 'tourism', 'hotel', 'flight', 'aviation']],
  ['Restaurants, Food & Grocery', ['food', 'makan', 'kuliner', 'cafe', 'kafe', 'resto', 'kopi', 'coffee', 'latte', 'espresso', 'minuman', 'grocery']],
  ['Beauty & Cosmetics', ['beauty', 'skincare', 'makeup', 'cosmetic', 'kosmetik', 'serum', 'skin']],
  ['Finance & Investment', ['finance', 'finansial', 'investasi', 'saham', 'crypto', 'budget', 'saving', 'tabungan']],
  ['Health & Wellness', ['health', 'sehat', 'fitness', 'gym', 'wellness', 'diet', 'workout', 'mental health']],
];

function countKeywordHits(text, keyword) {
  if (!text || !keyword) return 0;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = keyword.includes(' ')
    ? new RegExp(escaped, 'gi')
    : new RegExp(`(^|[^\\p{L}\\d_])${escaped}([^\\p{L}\\d_]|$)`, 'giu');
  return text.match(pattern)?.length ?? 0;
}

function buildInterestSignals(profile, posts) {
  const platform = String(profile.platform || '').toLowerCase();
  const captions = posts.map(p => [p.title, p.caption, p.text, p.description].filter(Boolean).join(' ')).join(' ');
  const hashtags = posts
    .flatMap(p => [
      ...(p.caption?.match(/#[\p{L}\d_]+/gu) ?? []),
      ...(Array.isArray(p.hashtags) ? p.hashtags : []),
    ])
    .join(' ')
    .replace(/#/g, ' ');

  const publicProfileText = [
    profile.username,
    profile.full_name,
    profile.biography,
    profile.category_name,
    profile.external_url,
  ].filter(Boolean).join(' ');

  const sources = platform === 'threads'
    ? [
        { text: captions, weight: 4 },
        { text: hashtags, weight: 3 },
        { text: publicProfileText, weight: 1.5 },
      ]
    : platform === 'instagram'
      ? [
          { text: captions, weight: 3 },
          { text: hashtags, weight: 4 },
          { text: profile.biography || '', weight: 2 },
          { text: `${profile.username || ''} ${profile.full_name || ''}`, weight: 1 },
        ]
      : [
          { text: captions, weight: 3 },
          { text: publicProfileText, weight: 1.5 },
        ];

  const interests = INTEREST_TAXONOMY
    .map(([label, keywords]) => {
      const rawHits = sources.reduce((sum, source) => {
        const text = String(source.text || '').toLowerCase();
        const hits = keywords.reduce((count, keyword) => count + countKeywordHits(text, keyword), 0);
        return sum + hits * source.weight;
      }, 0);
      return { label, score: Math.round(rawHits) };
    })
    .filter(it => it.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const total = interests.reduce((sum, it) => sum + it.score, 0);
  return interests.map(it => ({
    ...it,
    pct: total > 0 ? +((it.score / total) * 100).toFixed(1) : 0,
  }));
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
    { name: 'Female', value: femalePct,                    color: '#187877' },
    { name: 'Male',   value: +(100 - femalePct).toFixed(1), color: '#0B2A50' },
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
    return { city, pct, color: ['#187877', '#126B73', '#0B2A50', '#A8D5D1', '#D3EAE8'][i] };
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

  const scoredInterests = buildInterestSignals(profile, posts);

  const totalEngagement = posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);

  return {
    avgLikes, avgComments, avgViews, vtr, er, tier, avgEngagements,
    authenticity, growth,
    gender, age, locations,
    topHashtags, topMentions, interests: scoredInterests,
    totalEngagement, totalLikes, totalViews,
  };
}

function fmtCurrency(n) {
  if (n == null || Number.isNaN(n)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));
}

function fmtNum(n) {
  if (n == null) return '–';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('id-ID');
}

function defaultCommercialInputs(profile, analytics) {
  const followerMultiplier =
    analytics.tier === 'Mega' ? 1.7 :
    analytics.tier === 'Macro' ? 1.45 :
    analytics.tier === 'Mid-Tier' ? 1.25 :
    analytics.tier === 'Micro' ? 1.05 : 0.9;
  const platformMultiplier = profile.platform === 'tiktok' ? 0.92 : 1;
  const cpm = Math.round(45000 * followerMultiplier * platformMultiplier / 5000) * 5000;
  const cpv = Math.round(150 * followerMultiplier * platformMultiplier / 25) * 25;
  return { cpm, cpv };
}

function getKOLVerdict(score) {
  if (score >= 85) return { label: 'Sangat Baik', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
  if (score >= 70) return { label: 'Baik', color: 'text-green-700 bg-green-50 border-green-100' };
  if (score >= 55) return { label: 'Rata-rata', color: 'text-amber-700 bg-amber-50 border-amber-100' };
  if (score >= 40) return { label: 'Dibawah Rata-rata', color: 'text-orange-700 bg-orange-50 border-orange-100' };
  return { label: 'Buruk', color: 'text-red-700 bg-red-50 border-red-100' };
}

function deriveInfluencerRatecard(profile, analytics, cpmInput, cpvInput) {
  const posts = profile.recent_posts ?? [];
  const videoPosts = posts
    .filter(post => post.is_video || post.views > 0)
    .filter(post => (post.views ?? 0) > 0)
    .slice(0, 7);
  const fallbackViews = analytics.avgViews || Math.round((profile.followers || 0) * 0.12);
  const viewSeries = videoPosts.length
    ? videoPosts.map(post => post.views ?? 0)
    : Array.from({ length: 7 }, (_, i) => Math.max(0, Math.round(fallbackViews * (0.78 + i * 0.06))));

  const totalViews7 = viewSeries.reduce((sum, value) => sum + value, 0);
  const avgViews7 = Math.round(totalViews7 / Math.max(1, viewSeries.length));
  const lowerReachEst = Math.round(avgViews7 * 0.65);
  const upperReachEst = Math.round(avgViews7 * 1.15);
  const cpm = Number(cpmInput) || 0;
  const cpv = Number(cpvInput) || 0;
  const cpmEstimate = lowerReachEst / 1000 * cpm;
  const cpvEstimate = avgViews7 * cpv;
  const rateLow = Math.round(Math.min(cpmEstimate, cpvEstimate) * 0.85);
  const rateHigh = Math.round(Math.max(cpmEstimate, cpvEstimate) * 1.2);
  const estCpv = rateHigh > 0 && avgViews7 > 0 ? +(rateHigh / avgViews7).toFixed(0) : 0;

  const viewRateScore = Math.min(100, (analytics.vtr / 18) * 100);
  const erScore = Math.min(100, (analytics.er / 8) * 100);
  const authenticityScore = analytics.authenticity?.[0]?.value ?? 55;
  const consistency = viewSeries.length > 1
    ? Math.max(0, 100 - ((Math.max(...viewSeries) - Math.min(...viewSeries)) / Math.max(1, avgViews7)) * 28)
    : 60;
  const score = Math.round(erScore * 0.3 + viewRateScore * 0.28 + authenticityScore * 0.24 + consistency * 0.18);
  const verdict = getKOLVerdict(score);

  const bioText = `${profile.biography || ''} ${posts.map(post => post.caption || '').join(' ')}`.toLowerCase();
  const fitRules = [
    { label: 'Edukasi, kelas online, mentoring, SaaS', keys: ['belajar', 'edukasi', 'kelas', 'mentor', 'tips', 'social media', 'socmed', 'strategi'] },
    { label: 'Beauty, skincare, personal care', keys: ['beauty', 'skincare', 'makeup', 'glow', 'salon'] },
    { label: 'Fashion, lifestyle, aksesori', keys: ['fashion', 'outfit', 'ootd', 'style', 'lifestyle'] },
    { label: 'Kuliner, cafe, FMCG', keys: ['food', 'makan', 'kuliner', 'cafe', 'resto', 'coffee'] },
    { label: 'Travel, hotel, tourism', keys: ['travel', 'trip', 'hotel', 'liburan', 'wisata', 'bali'] },
    { label: 'Bisnis, finance, produktivitas', keys: ['bisnis', 'business', 'karir', 'produktif', 'finance', 'uang'] },
  ];
  const productFits = fitRules
    .map(rule => ({ ...rule, hits: rule.keys.reduce((sum, key) => sum + (bioText.split(key).length - 1), 0) }))
    .filter(rule => rule.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map(rule => rule.label);
  if (productFits.length === 0) productFits.push('Brand awareness umum', 'Produk lifestyle mass market', 'Campaign edukatif soft selling');

  const considerations = [
    analytics.er >= 4 ? 'ER kuat untuk ukuran audiensnya.' : 'ER perlu dicek lagi terhadap format konten campaign.',
    analytics.vtr >= 8 ? 'View rate cukup sehat untuk estimasi reach.' : 'View rate relatif rendah, gunakan deliverables bertahap.',
    authenticityScore >= 55 ? 'Komposisi audience terlihat cukup wajar.' : 'Ada risiko kualitas audience, cek komentar dan saves manual.',
    viewSeries.length >= 7 ? 'Data views memakai 7 video terakhir.' : 'Data video publik terbatas, estimasi memakai fallback.',
  ];

  return {
    viewSeries,
    totalViews7,
    avgViews7,
    lowerReachEst,
    upperReachEst,
    cpmEstimate,
    cpvEstimate,
    rateLow,
    rateHigh,
    estCpv,
    score,
    verdict,
    productFits,
    considerations,
  };
}

function getBrandVerdict(score) {
  if (score >= 85) return { label: 'Brand sangat kuat', summary: 'Fondasi brand, engagement, dan sinyal konten sudah sangat baik.', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
  if (score >= 70) return { label: 'Brand sudah bagus', summary: 'Brand sudah layak di-scale dengan campaign dan kolaborasi yang lebih rapi.', color: 'text-green-700 bg-green-50 border-green-100' };
  if (score >= 55) return { label: 'Brand cukup baik', summary: 'Ada fondasi, tapi positioning dan konsistensi konten masih perlu diperkuat.', color: 'text-amber-700 bg-amber-50 border-amber-100' };
  if (score >= 40) return { label: 'Brand belum stabil', summary: 'Perlu perbaikan konten, pesan utama, dan bukti sosial sebelum scale campaign.', color: 'text-orange-700 bg-orange-50 border-orange-100' };
  return { label: 'Brand buruk', summary: 'Brand belum siap untuk campaign besar. Rapikan positioning dan kualitas konten dulu.', color: 'text-red-700 bg-red-50 border-red-100' };
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(safeNumber(value))));
}

function countKeywordListHits(text, keys) {
  return keys.reduce((sum, key) => sum + (text.split(key).length - 1), 0);
}

function deriveBrandAnalysis(profile, analytics) {
  const posts = profile.recent_posts ?? [];
  const captions = posts.map(post => post.caption || '').join(' ');
  const username = (profile.username || '').toLowerCase();
  const text = `${username} ${profile.full_name || ''} ${profile.biography || ''} ${captions}`.toLowerCase();
  const followers = safeNumber(profile.followers);
  const following = safeNumber(profile.following);
  const er = safeNumber(analytics.er);
  const vtr = safeNumber(analytics.vtr);
  const avgEngagements = safeNumber(analytics.avgEngagements);
  const topHashtags = analytics.topHashtags || [];
  const topMentions = analytics.topMentions || [];
  const interests = analytics.interests || [];

  const nicheRules = [
    {
      niche: 'Coffee / Cafe / F&B Brand',
      keys: ['kopi', 'coffee', 'cafe', 'kafe', 'latte', 'espresso', 'americano', 'barista', 'minuman', 'fnb', 'f&b', 'grabfood', 'gofood', 'kenangan'],
      competitors: ['@fore.coffee', '@tomoro.coffee', '@janjiw', '@pointcoffeeid', '@starbucksindonesia'],
      partnerTypes: ['Food reviewer lokal', 'Lifestyle micro creator', 'Creator kantor/kampus', 'Community partner event offline'],
    },
    {
      niche: 'Education / Knowledge Brand',
      keys: ['belajar', 'edukasi', 'kelas', 'mentor', 'tips', 'training', 'course', 'ilmu', 'strategi', 'socmed', 'bootcamp'],
      competitors: ['@revou_id', '@myskill.id', '@dibimbing.id', '@skillacademy'],
      partnerTypes: ['Expert creator', 'Career mentor', 'Education micro KOL', 'Community learning partner'],
    },
    {
      niche: 'Beauty / Personal Care',
      keys: ['beauty', 'skincare', 'makeup', 'glow', 'serum', 'salon', 'skin', 'kosmetik'],
      competitors: ['@somethincofficial', '@avoskinbeauty', '@wardahbeauty', '@scarlett_whitening'],
      partnerTypes: ['Beauty reviewer', 'Dermatology educator', 'Lifestyle creator', 'UGC creator'],
    },
    {
      niche: 'Fashion / Lifestyle',
      keys: ['fashion', 'outfit', 'ootd', 'style', 'wear', 'lifestyle', 'clothes', 'shoes'],
      competitors: ['@erigostore', '@thenblank', '@buttonscarves', '@wearingklamby'],
      partnerTypes: ['Fashion stylist', 'Lifestyle creator', 'Campus creator', 'UGC lookbook creator'],
    },
    {
      niche: 'Travel / Hospitality',
      keys: ['travel', 'trip', 'hotel', 'liburan', 'wisata', 'bali', 'staycation', 'tour'],
      competitors: ['@traveloka', '@tiketcom', '@boboboxadventure', '@indtravel'],
      partnerTypes: ['Travel creator', 'Local guide', 'Family travel creator', 'Experience reviewer'],
    },
    {
      niche: 'Business / Productivity',
      keys: ['bisnis', 'business', 'karir', 'produktif', 'finance', 'uang', 'growth', 'agency', 'startup'],
      competitors: ['@dailysocial.id', '@techinasia_id', '@glintsid', '@greatmind.id'],
      partnerTypes: ['Founder creator', 'Career creator', 'Productivity educator', 'B2B community partner'],
    },
  ];

  const nicheScores = nicheRules
    .map(rule => ({
      ...rule,
      hits: countKeywordListHits(text, rule.keys),
    }))
    .sort((a, b) => b.hits - a.hits);
  const primaryNiche = nicheScores[0]?.hits > 0
    ? nicheScores[0]
    : {
        niche: 'General Brand',
        hits: 0,
        competitors: ['@benchmark.kategori', '@brand.serupa', '@market.leader'],
        partnerTypes: ['Micro KOL niche', 'UGC creator', 'Community partner'],
      };

  const hashtagCount = topHashtags.length;
  const mentionCount = topMentions.length;
  const avgCaptionLength = posts.length
    ? Math.round(posts.reduce((sum, post) => sum + (post.caption?.length ?? 0), 0) / posts.length)
    : 0;
  const postsScore = Math.min(32, posts.length * 4);
  const captionScore = avgCaptionLength >= 120 ? 24 : avgCaptionLength >= 70 ? 18 : avgCaptionLength >= 35 ? 10 : 4;
  const topicScore = Math.min(24, hashtagCount * 4 + Math.min(8, primaryNiche.hits * 2));
  const ctaScore = /order|beli|klik|link|daftar|komen|comment|dm|coba|visit|download|subscribe/.test(text) ? 12 : 4;
  const contentScore = clampScore(postsScore + captionScore + topicScore + ctaScore);

  const erBenchmark =
    followers >= 1_000_000 ? 1.2 :
    followers >= 100_000 ? 1.8 :
    followers >= 10_000 ? 2.8 :
    4;
  const erScore = erBenchmark > 0 ? Math.min(62, (er / erBenchmark) * 45) : 0;
  const viewScore = Math.min(25, (vtr / 12) * 25);
  const interactionScore = followers > 0 ? Math.min(13, (avgEngagements / Math.max(1, followers * 0.01)) * 6) : 0;
  const engagementScore = clampScore(erScore + viewScore + interactionScore);

  const followerScore =
    followers >= 1_000_000 ? 38 :
    followers >= 100_000 ? 32 :
    followers >= 10_000 ? 24 :
    followers >= 1_000 ? 15 :
    followers > 0 ? 8 : 0;
  const ratioScore = following > 0 ? Math.min(16, (followers / following) / 20) : followers > 0 ? 10 : 0;
  const verificationScore = profile.is_verified ? 16 : 0;
  const socialProofScore = Math.min(20, mentionCount * 4 + Math.min(8, primaryNiche.hits * 2));
  const authorityScore = clampScore(followerScore + ratioScore + verificationScore + socialProofScore);

  const bio = profile.biography || '';
  const hasValueProp = /untuk|bantu|solusi|specialist|official|produk|layanan|brand|agency|studio|cafe|kopi|coffee/.test(text);
  const clarityScore = clampScore(
    (bio.length >= 80 ? 32 : bio.length >= 45 ? 24 : bio.length >= 18 ? 14 : 4)
    + (primaryNiche.hits > 0 ? 24 : 8)
    + (hasValueProp ? 22 : 6)
    + Math.min(22, hashtagCount * 3)
  );
  const brandScore = clampScore(contentScore * 0.25 + engagementScore * 0.3 + authorityScore * 0.2 + clarityScore * 0.25);
  const verdict = getBrandVerdict(brandScore);

  const campaignRules = [
    { type: 'Campaign edukasi / kelas', keys: ['kelas', 'webinar', 'workshop', 'training', 'mentor', 'belajar'] },
    { type: 'Campaign promo / conversion', keys: ['promo', 'diskon', 'voucher', 'sale', 'daftar', 'order', 'link bio'] },
    { type: 'Campaign awareness / storytelling', keys: ['cerita', 'behind', 'story', 'journey', 'kenapa', 'mindset'] },
    { type: 'Campaign komunitas / engagement', keys: ['challenge', 'giveaway', 'comment', 'tag', 'share', 'komunitas'] },
    { type: 'Campaign launch / product update', keys: ['launch', 'rilis', 'baru', 'new', 'update', 'coming soon'] },
  ];
  const campaigns = campaignRules
    .map(rule => {
      const matched = posts.filter(post => rule.keys.some(key => (post.caption || '').toLowerCase().includes(key)));
      return {
        type: rule.type,
        count: matched.length,
        evidence: matched[0]?.caption?.slice(0, 110) || '',
      };
    })
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);
  if (campaigns.length === 0) {
    campaigns.push({
      type: posts.length > 0 ? 'Always-on organic content' : 'Belum ada campaign terdeteksi',
      count: posts.length,
      evidence: posts.length > 0
        ? 'Ada konten organik, tapi belum ada sinyal campaign eksplisit dari caption terbaru.'
        : 'Data konten belum tersedia, jadi campaign perlu dicek manual dari link/post terbaru.',
    });
  }

  const influencerPartners = topMentions.slice(0, 6).map((mention, index) => ({
    handle: mention,
    role: index < 2 ? 'Prioritas audit kolaborasi' : 'Potensi partner / komunitas',
  }));
  if (influencerPartners.length === 0) {
    const suggestedTypes = brandScore >= 70
      ? ['Mid-tier KOL untuk awareness', 'Creator whitelisting / affiliate', ...(primaryNiche.partnerTypes || []).slice(0, 1)]
      : ['Micro KOL niche untuk validasi angle', ...(primaryNiche.partnerTypes || []).slice(0, 2)];
    suggestedTypes.forEach(type => influencerPartners.push({ handle: type, role: 'Tipe partner rekomendasi' }));
  }

  const decisions = [
    {
      label: brandScore >= 70 ? 'Scale campaign' : 'Rapikan positioning dulu',
      desc: brandScore >= 70
        ? 'Brand sudah cukup siap untuk campaign berbayar dan kolaborasi KOL.'
        : 'Perjelas pesan utama, bio, proof, dan format konten sebelum budget besar.',
    },
    {
      label: er >= erBenchmark ? 'Pertahankan format yang memicu interaksi' : 'Naikkan interaksi',
      desc: er >= erBenchmark
        ? 'ER cukup sehat. Gunakan CTA komentar, polling, dan serial konten.'
        : 'Perlu hook lebih kuat dan CTA yang spesifik di 3 detik pertama/caption awal.',
    },
    {
      label: mentionCount > 0 ? 'Audit partnership berjalan' : 'Mulai partnership kecil',
      desc: mentionCount > 0
        ? 'Ada mention yang bisa dicek sebagai kolaborasi, komunitas, atau partner campaign.'
        : 'Mulai dari KOL niche kecil untuk validasi angle sebelum scale.',
    },
  ];

  const normalizedUsername = username.replace(/[^a-z0-9]/g, '');
  const recommendedCompetitors = primaryNiche.competitors
    .filter(handle => handle.replace('@', '').replace(/[^a-z0-9]/g, '') !== normalizedUsername)
    .slice(0, 4)
    .map((handle, index) => ({
      handle,
      reason: index === 0
        ? `Benchmark utama untuk vertical ${primaryNiche.niche}.`
        : 'Pembanding konten, campaign, promo, dan positioning kategori serupa.',
    }));

  const contentPillars = [
    primaryNiche.niche,
    ...interests.filter(item => item.score > 0).slice(0, 3).map(item => item.label),
  ].filter(Boolean);

  return {
    brandScore,
    verdict,
    primaryNiche: primaryNiche.niche,
    scores: [
      { label: 'Content System', value: Math.round(contentScore) },
      { label: 'Engagement Health', value: Math.round(engagementScore) },
      { label: 'Brand Authority', value: Math.round(authorityScore) },
      { label: 'Positioning Clarity', value: Math.round(clarityScore) },
    ],
    decisions,
    recommendedCompetitors,
    campaigns: campaigns.slice(0, 5),
    influencerPartners,
    contentPillars: [...new Set(contentPillars)].slice(0, 5),
    auditNotes: [
      avgCaptionLength > 80 ? 'Caption cukup informatif untuk menjelaskan value brand.' : 'Caption masih pendek, tambah konteks dan CTA.',
      hashtagCount >= 3 ? 'Hashtag/topik sudah memberi sinyal niche.' : 'Topik konten belum cukup konsisten dari hashtag.',
      profile.biography?.length > 45 ? 'Bio sudah membantu menjelaskan positioning.' : 'Bio perlu dibuat lebih jelas: siapa, bantu apa, dan CTA.',
      posts.length >= 8 ? 'Data konten terbaru cukup untuk audit awal.' : 'Data konten terbatas, perlu validasi manual tambahan.',
    ],
  };
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

async function fetchAnalyserProfile(platform, username) {
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
  return json;
}

function CompareButton({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      title="Komparasi profile"
      className={`p-2.5 rounded-xl border transition-colors shadow-sm ${
        active
          ? 'bg-violet-500 border-violet-500 text-white'
          : 'bg-white border-purple-100 text-gray-500 hover:text-violet-600 hover:border-violet-300'
      }`}
    >
      <GitCompareArrows size={16} />
    </button>
  );
}

function InfluencerModeButton({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      title="Influencer Mode"
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors shadow-sm ${
        active
          ? 'bg-violet-500 border-violet-500 text-white'
          : 'bg-white border-purple-100 text-gray-500 hover:text-violet-600 hover:border-violet-300'
      }`}
    >
      <Calculator size={14} />
      <span className="hidden sm:inline">Influencer Mode</span>
    </button>
  );
}

function BrandModeButton({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      title="Brand Mode"
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors shadow-sm ${
        active
          ? 'bg-violet-500 border-violet-500 text-white'
          : 'bg-white border-purple-100 text-gray-500 hover:text-violet-600 hover:border-violet-300'
      }`}
    >
      <Store size={14} />
      <span className="hidden sm:inline">Brand Mode</span>
    </button>
  );
}

function AuthenticityChart({ data, height = 190, outerRadius = 72 }) {
  return (
    <div className="grid items-center gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
      <div className="min-w-0">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={outerRadius} startAngle={90} endAngle={-270}>
              {data.map((s, i) => <Cell key={i} fill={s.color} />)}
            </Pie>
            <Tooltip formatter={v => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 min-w-0">
        {data.map(s => (
          <div key={s.name} className="flex items-center gap-2 text-xs min-w-0">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-gray-600 break-words">{s.name} - {s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareSearchBox({
  platform,
  setPlatform,
  platformOptions,
  username,
  setUsername,
  loading,
  error,
  history,
  onAnalyze,
  onPickHistory,
  onClosePanel,
}) {
  return (
    <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <GitCompareArrows size={16} className="text-violet-500" />
          Komparasi Profile
        </h3>
        <button onClick={onClosePanel} title="Tutup komparasi"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50">
          <X size={14} />
        </button>
      </div>

      <div className="flex gap-2 bg-lavender-50 rounded-xl p-1 mb-3">
        {platformOptions.map(p => (
          <button key={p} onClick={() => setPlatform(p)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all
              ${platform === p ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-violet-600'}`}>
            {platformLabel(p)}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAnalyze()}
            placeholder="username pembanding..."
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-purple-100 bg-white text-sm text-gray-700 focus:outline-none focus:border-violet-400"
          />
        </div>
        <button onClick={onAnalyze} disabled={loading || !username.trim()}
          className="px-3 py-2.5 rounded-xl bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Pilih dari history</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {history.slice(0, 8).map((h) => (
              <button key={`${h.platform}-${h.username}`} onClick={() => onPickHistory(h)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-purple-50 bg-white hover:bg-lavender-50 flex-shrink-0">
                <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center">
                  {h.username?.[0]?.toUpperCase()}
                </span>
                <span className="text-xs text-gray-600 max-w-[120px] truncate">@{h.username}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileAnalysisColumn({ profile, platform, sourceLabel, onClose }) {
  const a = useMemo(() => profile ? deriveAnalytics(profile) : null, [profile]);
  if (!profile || !a) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-purple-100 p-8 text-center min-h-[260px] flex flex-col items-center justify-center">
        <Search size={24} className="text-violet-300 mb-3" />
        <p className="text-sm font-semibold text-gray-700">Belum ada profile</p>
        <p className="text-xs text-gray-400 mt-1">Cari username untuk mengisi kolom ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 truncate">{sourceLabel}</p>
        {onClose && (
          <button onClick={onClose} title="Tutup profile"
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {profile.profile_pic
              ? <img src={proxyImg(profile.profile_pic)} alt={profile.username} referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border-2 border-purple-100 flex-shrink-0"
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
              : <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-400 to-purple-300 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
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
                <PlatformBadge platform={platformLabel(platform)} size="xs" />
              </div>
              <p className="text-sm text-gray-400 truncate">@{profile.username}</p>
              {profile.biography && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{profile.biography}</p>}
            </div>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            {[
              ['ER', `${a.er}%`, true],
              ['Followers', fmtNum(profile.followers), false],
              ['Following', fmtNum(profile.following), false],
            ].map(([label, value, highlight]) => (
              <div key={label} className="rounded-xl bg-lavender-50 p-3 min-w-0">
                <p className={`text-xl font-bold truncate ${highlight ? 'text-violet-600' : 'text-gray-800'}`}>{value}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-gradient-to-b from-violet-500 to-purple-400 rounded-full" />
          Creator Performance
        </h4>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          {[
            { icon: Heart,         label: 'Engagement Rate', value: `${a.er}%` },
            { icon: Users,         label: 'Avg. Engagements', value: fmtNum(a.avgEngagements) },
            { icon: ThumbsUp,      label: 'Avg. Likes',    value: fmtNum(a.avgLikes) },
            { icon: MessageSquare, label: 'Avg. Comments', value: fmtNum(a.avgComments) },
            { icon: Eye,           label: platform === 'instagram' ? 'Avg. Reels Views' : 'Avg. Video Views', value: fmtNum(a.avgViews) },
            { icon: PlaySquare,    label: 'View Rate',     value: `${a.vtr}%` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-purple-50 shadow-card p-4 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center mb-2.5">
                <Icon size={15} className="text-violet-500" />
              </div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5 leading-tight">{label}</p>
              <p className="text-lg font-bold text-gray-800 truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-gradient-to-b from-violet-500 to-purple-400 rounded-full" />
          Audience Demography
        </h4>
        <p className="text-[11px] text-gray-400 mb-4">Estimasi — API publik tidak menyediakan demografi audiens akun lain</p>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="border border-purple-50 rounded-2xl p-4 min-w-0">
            <p className="text-xs font-semibold text-gray-600 mb-2">Gender</p>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={a.gender} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} startAngle={90} endAngle={-270}>
                  {a.gender.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={v => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-1 flex-wrap">
              {a.gender.map(g => (
                <span key={g.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                  {g.name} ({g.value}%)
                </span>
              ))}
            </div>
          </div>

          <div className="border border-purple-50 rounded-2xl p-4 min-w-0">
            <p className="text-xs font-semibold text-gray-600 mb-2">Age</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={a.age} margin={{ top: 18, right: 5, bottom: 0, left: -20 }}>
                <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="pct" name="Persentase" fill="#187877" radius={[4, 4, 0, 0]}
                  label={{ position: 'top', fontSize: 9, fill: '#6b7280', formatter: v => `${v}%` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-purple-50 rounded-2xl p-4 min-w-0">
            <p className="text-xs font-semibold text-gray-600 mb-3">Top Locations</p>
            <div className="flex h-4 rounded-full overflow-hidden mb-4">
              {a.locations.map(l => (
                <div key={l.city} style={{ width: `${l.pct * 2}%`, background: l.color }} title={`${l.city} (${l.pct}%)`} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {a.locations.map(l => (
                <span key={l.city} className="flex items-center gap-1.5 text-[11px] text-gray-600 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                  <span className="truncate">{l.city} ({l.pct}%)</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <ChartCard title="User Authenticity" subtitle="Estimasi komposisi followers">
          <AuthenticityChart data={a.authenticity} />
        </ChartCard>

        <ChartCard title="Profile Growth" subtitle="Last 6 months">
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={a.growth} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} domain={['dataMin', 'dataMax']} />
              <Tooltip formatter={v => v.toLocaleString('id-ID')} />
              <Line type="monotone" dataKey="followers" name="Followers" stroke="#187877" strokeWidth={2} dot={{ r: 3, fill: '#187877' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function InfluencerModePanel({ profile, platform, analytics }) {
  const defaults = useMemo(() => defaultCommercialInputs(profile, analytics), [profile, analytics]);
  const [cpm, setCpm] = useState(defaults.cpm);
  const [cpv, setCpv] = useState(defaults.cpv);

  useEffect(() => {
    setCpm(defaults.cpm);
    setCpv(defaults.cpv);
  }, [defaults.cpm, defaults.cpv]);

  const rate = useMemo(
    () => deriveInfluencerRatecard(profile, analytics, cpm, cpv),
    [profile, analytics, cpm, cpv],
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
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
                <span className="text-[10px] font-semibold bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">{analytics.tier}</span>
                <PlatformBadge platform={platformLabel(platform)} size="xs" />
              </div>
              <p className="text-sm text-gray-400 truncate">@{profile.username}</p>
              {profile.biography && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{profile.biography}</p>}
            </div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${rate.verdict.color}`}>
            <p className="text-[10px] uppercase tracking-wide font-semibold opacity-80">Pertimbangan KOL</p>
            <p className="text-xl font-bold">{rate.verdict.label}</p>
            <p className="text-xs opacity-80">Score {rate.score}/100</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Calculator size={17} className="text-violet-500" /> Ratecard Estimator
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Estimasi berbasis 7 views video terakhir, CPM, dan CPV.</p>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
              Estimasi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <label className="rounded-2xl border border-purple-50 bg-lavender-50 p-3">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">CPM target</span>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={cpm}
                  onChange={event => setCpm(event.target.value)}
                  className="w-full bg-white rounded-xl border border-purple-100 px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:border-violet-400"
                />
              </div>
            </label>
            <label className="rounded-2xl border border-purple-50 bg-lavender-50 p-3">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">CPV target</span>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="25"
                  value={cpv}
                  onChange={event => setCpv(event.target.value)}
                  className="w-full bg-white rounded-xl border border-purple-100 px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:border-violet-400"
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Eye, label: 'Total 7 Views', value: fmtNum(rate.totalViews7) },
              { icon: PlaySquare, label: 'Avg Views', value: fmtNum(rate.avgViews7) },
              { icon: Target, label: 'Lower Reach Est.', value: fmtNum(rate.lowerReachEst) },
              { icon: DollarSign, label: 'Est. CPV', value: `Rp ${fmtNum(rate.estCpv)}` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2xl border border-purple-50 bg-white p-4">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center mb-2">
                  <Icon size={15} className="text-violet-500" />
                </div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-400 p-5 text-white">
            <p className="text-xs text-white/70 uppercase tracking-wide font-semibold mb-1">Estimasi ratecard rekomendasi</p>
            <p className="text-2xl font-bold">{fmtCurrency(rate.rateLow)} - {fmtCurrency(rate.rateHigh)}</p>
            <p className="text-xs text-white/75 mt-2">
              CPM model: {fmtCurrency(rate.cpmEstimate)} · CPV model: {fmtCurrency(rate.cpvEstimate)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
            <PackageCheck size={17} className="text-violet-500" /> Cocok untuk produk
          </h3>
          <div className="space-y-2">
            {rate.productFits.map(item => (
              <div key={item} className="rounded-xl bg-lavender-50 border border-purple-50 px-3 py-2 text-sm font-semibold text-gray-700">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-purple-50">
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-violet-500" /> Catatan pertimbangan
            </p>
            <div className="space-y-2">
              {rate.considerations.map(item => (
                <p key={item} className="text-xs text-gray-500 leading-relaxed flex gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="7 Video Views terakhir" subtitle="Basis estimasi total views dan avg views">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rate.viewSeries.map((views, index) => ({ label: `V${index + 1}`, views }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
              <Tooltip formatter={value => value.toLocaleString('id-ID')} />
              <Bar dataKey="views" name="Views" fill="#187877" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Commercial Fit" subtitle="Indikator awal sebelum negosiasi">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Engagement Rate', value: `${analytics.er}%`, hint: analytics.er >= 4 ? 'Sehat' : 'Perlu review' },
              { label: 'View Rate', value: `${analytics.vtr}%`, hint: analytics.vtr >= 8 ? 'Baik' : 'Rendah' },
              { label: 'Followers', value: fmtNum(profile.followers), hint: analytics.tier },
              { label: 'Reach Range', value: `${fmtNum(rate.lowerReachEst)} - ${fmtNum(rate.upperReachEst)}`, hint: 'Estimasi' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-purple-50 bg-white p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
                <p className="text-xl font-bold text-gray-800 mt-1">{item.value}</p>
                <p className="text-xs text-violet-500 font-semibold mt-1">{item.hint}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function BrandModePanel({ profile, platform, analytics }) {
  const brand = useMemo(() => deriveBrandAnalysis(profile, analytics), [profile, analytics]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
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
                <span className="text-[10px] font-semibold bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">{brand.primaryNiche}</span>
                <PlatformBadge platform={platformLabel(platform)} size="xs" />
              </div>
              <p className="text-sm text-gray-400 truncate">@{profile.username}</p>
              {profile.biography && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{profile.biography}</p>}
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4 leading-relaxed">{brand.verdict.summary}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {brand.scores.map(item => (
          <div key={item.label} className="bg-white rounded-2xl border border-purple-50 shadow-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-tight">{item.label}</p>
              <span className="text-xs font-bold text-violet-600">{item.value}/100</span>
            </div>
            <div className="h-2 rounded-full bg-lavender-50 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400" style={{ width: `${item.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <ClipboardCheck size={17} className="text-violet-500" /> Keputusan untuk Brand
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {brand.decisions.map(item => (
              <div key={item.label} className="rounded-2xl bg-lavender-50 border border-purple-50 p-4">
                <p className="text-sm font-bold text-gray-800 mb-1">{item.label}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-purple-50">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
              <Lightbulb size={15} className="text-violet-500" /> Audit notes
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {brand.auditNotes.map(note => (
                <p key={note} className="text-xs text-gray-500 leading-relaxed flex gap-2 rounded-xl bg-white border border-purple-50 px-3 py-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  {note}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
            <Target size={17} className="text-violet-500" /> Content Pillars
          </h3>
          <div className="space-y-2">
            {brand.contentPillars.map(item => (
              <div key={item} className="rounded-xl bg-lavender-50 border border-purple-50 px-3 py-2 text-sm font-semibold text-gray-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
            <Trophy size={17} className="text-violet-500" /> Kompetitor Rekomendasi
          </h3>
          <div className="space-y-2.5">
            {brand.recommendedCompetitors.map(item => (
              <div key={item.handle} className="rounded-2xl border border-purple-50 bg-white p-3">
                <p className="text-sm font-bold text-violet-600">{item.handle}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
            <Megaphone size={17} className="text-violet-500" /> Campaign Berjalan
          </h3>
          <div className="space-y-2.5">
            {brand.campaigns.map(item => (
              <div key={item.type} className="rounded-2xl border border-purple-50 bg-lavender-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-800">{item.type}</p>
                  <span className="text-[10px] font-bold text-violet-600 bg-white px-2 py-0.5 rounded-full">{item.count} konten</span>
                </div>
                {item.evidence && <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{item.evidence}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
            <Users size={17} className="text-violet-500" /> Influencer / Partner
          </h3>
          <div className="space-y-2.5">
            {brand.influencerPartners.map(item => (
              <div key={item.handle} className="rounded-2xl border border-purple-50 bg-white p-3">
                <p className="text-sm font-bold text-gray-800">{item.handle}</p>
                <p className="text-xs text-gray-500 mt-1">{item.role}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
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
  const { activeWorkspace } = useWorkspace();
  const { visiblePlatformKeys } = usePlatformVisibility(activeWorkspace?.id);
  const platformOptions = useMemo(() => {
    const visible = visiblePlatformKeys.filter(key => ANALYSER_PLATFORM_KEYS.includes(key));
    return visible.length ? visible : ['instagram'];
  }, [visiblePlatformKeys]);
  const [platform, setPlatform] = useState(saved?.platform ?? 'instagram');
  const [username, setUsername] = useState(saved?.username ?? '');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [profile, setProfile]   = useState(saved?.profile ?? null);
  const [history, setHistory]   = useState(readHistory);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePlatform, setComparePlatform] = useState('instagram');
  const [compareUsername, setCompareUsername] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);
  const [compareProfile, setCompareProfile] = useState(null);
  const [splitPct, setSplitPct] = useState(50);
  const [influencerMode, setInfluencerMode] = useState(false);
  const [brandMode, setBrandMode] = useState(false);
  const resizingRef = useRef(false);

  useEffect(() => {
    if (!platformOptions.includes(platform)) {
      setPlatform(platformOptions[0]);
      setProfile(null);
      setUsername('');
      localStorage.removeItem(STORAGE_KEY);
    }
    if (!platformOptions.includes(comparePlatform)) {
      setComparePlatform(platformOptions[0]);
      setCompareProfile(null);
      setCompareUsername('');
    }
  }, [platformOptions, platform, comparePlatform]);

  const toggleInfluencerMode = () => {
    setInfluencerMode(value => {
      const next = !value;
      if (next) setBrandMode(false);
      return next;
    });
  };

  const toggleBrandMode = () => {
    setBrandMode(value => {
      const next = !value;
      if (next) setInfluencerMode(false);
      return next;
    });
  };

  useEffect(() => {
    if (!compareMode) return undefined;

    const stopResize = () => {
      resizingRef.current = false;
    };

    const resize = (event) => {
      if (!resizingRef.current) return;
      const container = document.getElementById('analyser-compare-grid');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const pct = ((event.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(68, Math.max(32, pct)));
    };

    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResize);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [compareMode]);

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
      const json = await fetchAnalyserProfile(platform, username);
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

  const handleCompareAnalyze = async () => {
    if (!compareUsername.trim()) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const json = await fetchAnalyserProfile(comparePlatform, compareUsername);
      setCompareProfile(json);
      const entry = { platform: comparePlatform, username: compareUsername.trim(), profile: json, savedAt: Date.now() };
      setHistory(pushHistory(entry));
    } catch (e) {
      setCompareError(e.message);
    } finally {
      setCompareLoading(false);
    }
  };

  const selectCompareHistory = (h) => {
    setComparePlatform(h.platform);
    setCompareUsername(h.username);
    setCompareProfile(h.profile);
    setCompareError(null);
  };

  const closePrimaryProfile = () => {
    setProfile(null);
    setUsername('');
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
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
          {platformOptions.map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all capitalize
                ${platform === p
                  ? 'bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-purple'
                  : 'text-gray-500 hover:text-violet-600'}`}>
              {platformLabel(p)}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="w-full max-w-xl flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <AtSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                placeholder={`username ${platformLabel(platform)}...`}
                className="w-full pl-9 pr-4 py-3 rounded-2xl border border-purple-100 bg-white text-sm text-gray-700 focus:outline-none focus:border-violet-400 shadow-sm"
              />
            </div>
            <button onClick={handleAnalyze} disabled={!username.trim()}
              className="purple-btn text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap">
              <Search size={15} /> Kumpulkan Data
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <HistoryDropdown history={history} onSelect={selectHistory}
              onDelete={deleteHistory} onClear={clearHistory} />
            <InfluencerModeButton active={influencerMode} onClick={toggleInfluencerMode} />
            <BrandModeButton active={brandMode} onClick={toggleBrandMode} />
            <CompareButton active={compareMode} onClick={() => setCompareMode(true)} />
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        {platformOptions.includes('threads') && (
          <p className="text-[11px] text-gray-300 mt-6">Threads memakai scraping profil publik best-effort.</p>
        )}
        {compareMode && (
          <div className="w-full max-w-2xl mt-5 space-y-4">
            {!compareProfile && (
              <CompareSearchBox
                platform={comparePlatform}
                setPlatform={setComparePlatform}
                platformOptions={platformOptions}
                username={compareUsername}
                setUsername={setCompareUsername}
                loading={compareLoading}
                error={compareError}
                history={history}
                onAnalyze={handleCompareAnalyze}
                onPickHistory={selectCompareHistory}
                onClosePanel={() => setCompareMode(false)}
              />
            )}
            <ProfileAnalysisColumn
              profile={compareProfile}
              platform={comparePlatform}
              sourceLabel="Profile pembanding"
              onClose={compareProfile ? () => setCompareProfile(null) : undefined}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="text-violet-500 animate-spin mb-4" />
        <p className="text-sm text-gray-500">Mengumpulkan data @{username}...</p>
        <p className="text-xs text-gray-300 mt-1">Scraping profil {platformLabel(platform)}</p>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────
  const a = analytics;
  if (compareMode) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <div className="flex items-center gap-2">
            <HistoryDropdown history={history} onSelect={selectHistory}
              onDelete={deleteHistory} onClear={clearHistory} />
            <InfluencerModeButton active={influencerMode} onClick={toggleInfluencerMode} />
            <BrandModeButton active={brandMode} onClick={toggleBrandMode} />
            <CompareButton active={compareMode} onClick={() => setCompareMode(false)} />
            <button onClick={closePrimaryProfile}
              className="text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 font-medium transition-colors">
              Reset
            </button>
          </div>
        </div>

        <div
          id="analyser-compare-grid"
          className="grid grid-cols-1 xl:grid-cols-[minmax(0,var(--left-col))_8px_minmax(0,1fr)] gap-4 items-start"
          style={{ '--left-col': `${splitPct}%` }}
        >
          <div className="min-w-0">
          <ProfileAnalysisColumn
            profile={profile}
            platform={platform}
            sourceLabel={`Hasil analisa · ${profile.source === 'live' ? 'Data live scraping' : 'Data estimasi'}`}
            onClose={closePrimaryProfile}
          />
        </div>

        <button
          type="button"
          aria-label="Ubah ukuran kolom komparasi"
          title="Geser untuk ubah ukuran kolom"
          onMouseDown={() => { resizingRef.current = true; }}
          className="hidden xl:flex h-[calc(100vh-150px)] min-h-80 sticky top-4 cursor-col-resize items-center justify-center rounded-full bg-purple-100 hover:bg-violet-200 transition-colors"
        >
          <span className="h-12 w-1 rounded-full bg-violet-400" />
        </button>

        <div className="space-y-4 min-w-0">
          {!compareProfile && (
            <CompareSearchBox
              platform={comparePlatform}
              setPlatform={setComparePlatform}
              platformOptions={platformOptions}
              username={compareUsername}
              setUsername={setCompareUsername}
              loading={compareLoading}
              error={compareError}
              history={history}
              onAnalyze={handleCompareAnalyze}
              onPickHistory={selectCompareHistory}
              onClosePanel={() => setCompareMode(false)}
            />
          )}
          <ProfileAnalysisColumn
            profile={compareProfile}
            platform={comparePlatform}
            sourceLabel={compareProfile ? 'Profile pembanding' : 'Kolom pembanding'}
            onClose={compareProfile ? () => setCompareProfile(null) : undefined}
          />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reset bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Hasil analisa · {profile.source === 'live' ? 'Data live scraping' : 'Data estimasi'}</p>
        <div className="flex items-center gap-2">
          <HistoryDropdown history={history} onSelect={selectHistory}
            onDelete={deleteHistory} onClear={clearHistory} />
          <InfluencerModeButton active={influencerMode} onClick={toggleInfluencerMode} />
          <BrandModeButton active={brandMode} onClick={toggleBrandMode} />
          <CompareButton active={compareMode} onClick={() => setCompareMode(true)} />
          <button onClick={closePrimaryProfile}
            className="text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 font-medium transition-colors">
            Reset
          </button>
        </div>
      </div>

      {brandMode ? (
        <BrandModePanel profile={profile} platform={platform} analytics={a} />
      ) : influencerMode ? (
        <InfluencerModePanel profile={profile} platform={platform} analytics={a} />
      ) : (
      <>
      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5 relative">
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
                <PlatformBadge platform={platformLabel(platform)} size="xs" />
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
                <Bar dataKey="pct" name="Persentase" fill="#187877" radius={[4, 4, 0, 0]}
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
          <AuthenticityChart data={a.authenticity} height={200} outerRadius={78} />
        </ChartCard>

        <ChartCard title="Profile Growth - Last 6 Months" subtitle="Estimasi pertumbuhan followers">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={a.growth} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} domain={['dataMin', 'dataMax']} />
              <Tooltip formatter={v => v.toLocaleString('id-ID')} />
              <Line type="monotone" dataKey="followers" name="Followers" stroke="#187877" strokeWidth={2} dot={{ r: 3, fill: '#187877' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Interests */}
      <div className="grid grid-cols-1 gap-4">
        <ChartCard
          title="Top Interests"
          subtitle={profile.platform === 'threads'
            ? 'Dari postingan Threads dan sinyal profil publik'
            : 'Dari bio, caption, hashtag, dan postingan'}
        >
          <div className="space-y-3 mt-2">
            {a.interests.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">
                Belum ada topik dominan yang terbaca dari data publik profil ini.
              </p>
            )}
            {a.interests.map(it => (
              <div key={it.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{it.label}</span>
                  <span className="text-gray-500 font-semibold">{it.score} sinyal</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full" style={{ width: `${it.pct}%` }} />
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
      </>
      )}
    </div>
  );
}
