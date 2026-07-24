import { useState, useMemo } from 'react';
import {
  Users, Plus, TrendingUp, BarChart2, Target, Lightbulb,
  ChevronDown, ChevronUp, X, Upload, Download, RefreshCw,
  AlertTriangle, CheckCircle, Minus, ArrowUp, ArrowDown,
  Star, Trophy, Shield, Zap, Activity, Eye, Heart, MessageCircle,
  Share2, Bookmark, Clock, Hash, Sparkles, FileText,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useCompetitorIntelligence } from '../hooks/useCompetitorIntelligence';
import { scoreCompetitor, scoreLabel, gapStatusStyle, parseFrequency } from '../lib/competitorScoring';
import { COMPETITOR_CSV_FIELDS, COMPETITOR_CSV_TEMPLATE } from '../lib/competitorInsightEngine';
import Papa from 'papaparse';

const TABS = [
  { id: 'overview',   label: 'Ringkasan',          icon: BarChart2  },
  { id: 'comparison', label: 'Benchmark',          icon: TrendingUp },
  { id: 'content',    label: 'Konten Kompetitor',  icon: FileText   },
  { id: 'gap',        label: 'Gap & Action Plan',  icon: Target     },
  { id: 'ai',         label: 'Rekomendasi AI',     icon: Sparkles   },
];

const PLATFORM_COLORS = {
  Instagram: 'from-pink-500 to-orange-400',
  TikTok:    'from-gray-800 to-gray-600',
  Threads:   'from-gray-900 to-gray-700',
};

const CONTENT_TYPE_COLORS = {
  Reels: 'bg-pink-100 text-pink-700', 'Short Video': 'bg-red-100 text-red-700',
  Carousel: 'bg-violet-100 text-violet-700', Photo: 'bg-blue-100 text-blue-700',
  'Thread Opini': 'bg-gray-100 text-gray-700', Poll: 'bg-amber-100 text-amber-700',
  'Thread Tips': 'bg-emerald-100 text-emerald-700', 'Long Video': 'bg-orange-100 text-orange-700',
};

const REC_ICONS = {
  trophy: Trophy, star: Star, lightbulb: Lightbulb,
  sparkles: Sparkles, shield: Shield, flask: Zap,
};
const REC_COLORS = {
  competitor_advantage: 'border-red-200 bg-red-50',
  user_advantage:       'border-emerald-200 bg-emerald-50',
  opportunity:          'border-violet-200 bg-violet-50',
  content_angles:       'border-blue-200 bg-blue-50',
  risk:                 'border-amber-200 bg-amber-50',
  experiments:          'border-indigo-200 bg-indigo-50',
};
const REC_ICON_COLORS = {
  competitor_advantage: 'text-red-500', user_advantage: 'text-emerald-500',
  opportunity: 'text-violet-500', content_angles: 'text-blue-500',
  risk: 'text-amber-500', experiments: 'text-indigo-500',
};

// ── ScoreRing ─────────────────────────────────────────────────
function ScoreRing({ score, size = 56 }) {
  const safeScore = (isNaN(score) || score == null) ? 0 : Math.round(score);
  score = safeScore;
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const pct  = (score / 100) * circ;
  const { color } = scoreLabel(score);
  const strokeColor = score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="4"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={strokeColor} strokeWidth="4"
        strokeDasharray={`${pct} ${circ}`} strokeLinecap="round"/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        className={`text-xs font-bold fill-current ${color}`}
        style={{ transform: `rotate(90deg) translate(0, -${size/2}px)`, transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}
      </text>
    </svg>
  );
}

// ── MiniBar ───────────────────────────────────────────────────
function MiniBar({ value, max = 100, color = 'bg-violet-400', showValue = true }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
      {showValue && <span className="text-xs text-gray-500 w-8 text-right">{value}</span>}
    </div>
  );
}

function fmtCompact(n) {
  if (n == null || Number.isNaN(Number(n))) return '–';
  const num = Number(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(num >= 10_000 ? 0 : 1)}K`;
  return num.toLocaleString('id-ID');
}

function avg(list, getter) {
  if (!list.length) return 0;
  return list.reduce((sum, item) => sum + (Number(getter(item)) || 0), 0) / list.length;
}

function metricLeader(accounts, key) {
  return accounts
    .filter(Boolean)
    .sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0))[0];
}

function inferHookStyle(row) {
  const explicit = String(row.hook_style || '').trim();
  if (explicit && explicit !== '-') return { label: explicit, inferred: false };

  const text = `${row.title || ''} ${row.caption || ''}`.toLowerCase();
  if (!text.trim() || /^post\s+\d+/i.test(String(row.title || ''))) return { label: 'Belum terbaca', inferred: true };
  if (/[?？]/.test(text) || /\b(kenapa|gimana|bagaimana|apa|siapa|kapan|pernah)\b/.test(text)) return { label: 'Question', inferred: true };
  if (/\b(tips|cara|step|langkah|tutorial|guide|panduan|checklist)\b/.test(text)) return { label: 'Tutorial / Tips', inferred: true };
  if (/\b(masalah|salah|error|gagal|bingung|susah|jangan|hindari|solusi)\b/.test(text)) return { label: 'Problem-Solution', inferred: true };
  if (/\b(\d+%|\d+x|data|riset|statistik|angka|fakta)\b/.test(text)) return { label: 'Stat/Data', inferred: true };
  if (/\b(cerita|story|pengalaman|journey|dulu|akhirnya|behind)\b/.test(text)) return { label: 'Story', inferred: true };
  if (/\b(trend|viral|rame|lagi naik|fyp|algoritma)\b/.test(text)) return { label: 'Trend', inferred: true };
  return { label: 'Statement / Insight', inferred: true };
}

function StatCard({ label, value, icon: Icon, tone = 'violet', helper }) {
  const tones = {
    violet: 'bg-violet-50 text-violet-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 mb-1">{label}</p>
          <p className="text-xl font-bold text-gray-800 leading-tight break-words">{value}</p>
          {helper && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{helper}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tones[tone] ?? tones.violet}`}>
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, desc, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div>
        <h3 className="font-bold text-gray-800">{title}</h3>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function AccountPillSelector({ competitors, selected, setSelected, prefix = '' }) {
  if (!competitors.length) return null;
  const selectedId = selected ?? competitors[0]?.id;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {competitors.map(c => (
        <button key={c.id} onClick={() => setSelected(c.id)}
          className={`px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border transition-colors ${
            selectedId === c.id
              ? 'bg-violet-500 border-violet-500 text-white shadow-sm'
              : 'bg-white border-gray-100 text-gray-500 hover:text-violet-600 hover:border-violet-200'
          }`}>
          {prefix}{c.name}
        </button>
      ))}
    </div>
  );
}

function EmptyCompetitorState({ onAdd }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      <Users size={36} className="mx-auto text-gray-200 mb-3" />
      <p className="font-semibold text-gray-700">Belum ada kompetitor</p>
      <p className="text-sm text-gray-400 mt-1 mb-4">Tambahkan akun kompetitor agar benchmark, gap, dan rekomendasi bisa dihitung.</p>
      <button onClick={onAdd}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600">
        <Plus size={15} /> Tambah Kompetitor
      </button>
    </div>
  );
}

function scoreTone(score) {
  if (score >= 80) return 'emerald';
  if (score >= 60) return 'blue';
  if (score >= 40) return 'amber';
  return 'rose';
}

// ── CompetitorCard (Overview) ─────────────────────────────────
function CompetitorCard({ competitor, scores, isSelected, onClick, onRemove }) {
  const sl = scoreLabel(scores.overall);
  return (
    <div onClick={onClick}
      className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-violet-400 bg-violet-50' : 'border-gray-100 bg-white hover:border-violet-200'}`}>
      <button onClick={e => { e.stopPropagation(); onRemove(competitor.id); }}
        className="absolute top-2 right-2 p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
        <X size={13} />
      </button>

      <div className="flex items-start gap-3 mb-3 pr-6">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${PLATFORM_COLORS[competitor.platform] ?? 'from-gray-400 to-gray-600'} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden`}>
          {competitor.profile_picture_url
            ? <img src={competitor.profile_picture_url} alt={competitor.name}
                className="w-full h-full object-cover"
                onError={e => { e.currentTarget.replaceWith(document.createTextNode((competitor.name?.[0] ?? '?').toUpperCase())); }} />
            : (competitor.name?.[0] ?? '?').toUpperCase()
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{competitor.name}</p>
          <p className="text-xs text-gray-400">{competitor.username} · {competitor.platform}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="grid grid-cols-2 gap-1.5 text-xs flex-1">
          {[
            ['Followers', competitor.followers?.toLocaleString('id-ID') ?? '–'],
            ['Eng. Rate', `${(competitor.engagementRate ?? 0).toFixed(1)}%`],
            ['Post/Minggu', `${competitor.postingFrequencyNum ?? competitor.postingFrequency ?? 0}x`],
            ['Format', competitor.topContentType ?? '–'],
          ].map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-lg px-2 py-1">
              <p className="text-gray-400 text-[10px]">{k}</p>
              <p className="font-semibold text-gray-700 text-xs truncate">{v}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center flex-shrink-0">
          <ScoreRing score={scores.overall} size={64} />
          <span className={`text-[11px] font-semibold mt-1 ${sl.color}`}>{sl.label}</span>
        </div>
      </div>
    </div>
  );
}

// ── AddCompetitorModal ────────────────────────────────────────
function AddCompetitorModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    name: '', username: '', platform: 'Instagram',
    followers: '', postingFrequency: '', avgEngagementRate: '',
    topContentType: 'Carousel', topContentPillar: 'Edukasi',
    strength: '', weakness: '', opportunity: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    if (!form.name || !form.username) return;
    setLoading(true);
    await onAdd({
      name: form.name, username: form.username, platform: form.platform,
      followers: parseInt(form.followers) || 0,
      postingFrequency: parseInt(form.postingFrequency) || 0,
      postingFrequencyNum: parseInt(form.postingFrequency) || 0,
      engagementRate: parseFloat(form.avgEngagementRate) || 0,
      topContentType: form.topContentType, topContentPillar: form.topContentPillar,
      strength: form.strength, weakness: form.weakness, opportunity: form.opportunity,
    });
    setLoading(false);
    onClose();
  };

  const F = ({ label, id, type = 'text', placeholder, ...rest }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input id={id} type={type} placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
        value={form[id] ?? ''} onChange={e => set(id, e.target.value)} {...rest} />
    </div>
  );

  const S = ({ label, id, options }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select id={id} value={form[id] ?? ''} onChange={e => set(id, e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-lg">Tambah Kompetitor</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X size={18} /></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <F label="Nama Akun *" id="name" placeholder="Studio Kreatif Bali" />
            <F label="Username *" id="username" placeholder="@studiokreatifbali" />
          </div>
          <S label="Platform" id="platform" options={['Instagram','TikTok','Threads']} />
          <div className="grid grid-cols-3 gap-3">
            <F label="Followers" id="followers" type="number" placeholder="50000" />
            <F label="Post/Minggu" id="postingFrequency" type="number" placeholder="5" />
            <F label="Eng. Rate (%)" id="avgEngagementRate" type="number" placeholder="4.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <S label="Format Utama" id="topContentType" options={['Carousel','Reels','Short Video','Photo','Long Video','Thread Opini','Thread Tips','Poll']} />
            <S label="Pillar Utama" id="topContentPillar" options={['Edukasi','Hiburan','Inspirasi','Promosi','Behind-the-scenes','Opini','Tips','Trending']} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Keunggulan</label>
            <textarea rows={2} placeholder="Apa yang mereka lakukan dengan baik?"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
              value={form.strength} onChange={e => set('strength', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kelemahan</label>
            <textarea rows={2} placeholder="Apa yang masih kurang?"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
              value={form.weakness} onChange={e => set('weakness', e.target.value)} />
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
          <button onClick={handleAdd} disabled={loading || !form.name || !form.username}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-400 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90">
            {loading ? 'Menyimpan...' : 'Tambah Kompetitor'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddContentModal ───────────────────────────────────────────
function AddContentModal({ competitor, onClose, onImport }) {
  const [tab, setTab] = useState('manual');
  const [rows, setRows] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [form, setForm] = useState({
    title: '', content_type: 'Reels', content_pillar: 'Edukasi',
    hook_style: 'Question', cta_style: 'Follow',
    content_url: '', caption: '',
    likes: '', comments: '', shares: '', saves: '', views: '',
    published_at: '', is_top_performer: false,
  });

  const handleCSV = (file) => {
    setCsvError('');
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: ({ data }) => {
        const mapped = data.map(r => ({
          title: r.title ?? r.caption ?? '',
          caption: r.caption ?? '',
          content_type: r.content_type ?? 'Other',
          content_pillar: r.content_pillar ?? '',
          hook_style: r.hook_style ?? '',
          cta_style: r.cta_style ?? '',
          hashtags: r.hashtags ? r.hashtags.split(',').map(h => h.trim()) : [],
          likes: parseInt(r.likes) || 0,
          comments: parseInt(r.comments) || 0,
          shares: parseInt(r.shares) || 0,
          saves: parseInt(r.saves) || 0,
          views: parseInt(r.views) || 0,
          published_at: r.published_at || null,
          estimated_engagement_rate: parseFloat(r.estimated_engagement_rate) || 0,
          content_url: r.content_url ?? '',
          is_top_performer: false,
        }));
        setRows(mapped);
      },
      error: e => setCsvError(e.message),
    });
  };

  const handleAddManual = async () => {
    const total = parseInt(form.likes) + parseInt(form.comments) + parseInt(form.shares) + parseInt(form.saves);
    const views = parseInt(form.views) || parseInt(form.likes) * 20 || 1;
    const er = views > 0 ? ((total / views) * 100).toFixed(1) : 0;
    await onImport([{
      ...form,
      likes: parseInt(form.likes) || 0, comments: parseInt(form.comments) || 0,
      shares: parseInt(form.shares) || 0, saves: parseInt(form.saves) || 0,
      views: parseInt(form.views) || 0,
      estimated_engagement_rate: parseFloat(er),
      hashtags: [],
    }]);
    onClose();
  };

  const downloadTemplate = () => {
    const blob = new Blob([COMPETITOR_CSV_TEMPLATE], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'competitor_content_template.csv'; a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Tambah Konten: {competitor.name}</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X size={18} /></button>
          </div>
          <div className="flex gap-2 mt-3">
            {['manual','csv'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${tab === t ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t === 'manual' ? 'Manual' : 'Upload CSV'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'manual' ? (
          <div className="p-6 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Link Konten</label>
              <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
                placeholder="https://instagram.com/p/..."
                value={form.content_url} onChange={e => setForm(p => ({ ...p, content_url: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Judul / Caption</label>
              <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
                placeholder="5 Tips Desain Logo..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Caption Lengkap</label>
              <textarea rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                placeholder="Paste caption lengkap konten di sini agar Hook / Angle bisa dianalisa otomatis."
                value={form.caption} onChange={e => setForm(p => ({ ...p, caption: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Format', 'content_type', ['Photo','Carousel','Reels','Short Video','Long Video','Thread Opini','Thread Tips','Poll','Other']],
                ['Pillar', 'content_pillar', ['Edukasi','Hiburan','Inspirasi','Promosi','Behind-the-scenes','Opini','Tips','Trending','Q&A']],
                ['Hook Style', 'hook_style', ['Question','Problem-Solution','Stat/Data','Story','Controversy','Trend','Tutorial','None']],
                ['CTA Style', 'cta_style', ['Follow','Save','Comment','Share','Link in Bio','DM','Tag Friend','None']],
              ].map(([lbl, key, opts]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{lbl}</label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                    value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['likes','comments','shares','saves','views'].map(k => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{k}</label>
                  <input type="number" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
                    value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
                <input type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.published_at} onChange={e => setForm(p => ({ ...p, published_at: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={form.is_top_performer} onChange={e => setForm(p => ({ ...p, is_top_performer: e.target.checked }))}
                className="rounded border-gray-300 text-violet-500 focus:ring-violet-300" />
              Tandai sebagai Top Performer
            </label>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Upload file CSV dengan kolom yang sesuai.</p>
              <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium">
                <Download size={13} /> Download Template
              </button>
            </div>
            <label className="block border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-violet-300 hover:bg-violet-50 transition-colors">
              <Upload size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Klik untuk upload CSV</p>
              <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleCSV(e.target.files[0])} />
            </label>
            {csvError && <p className="text-xs text-red-500">{csvError}</p>}
            {rows.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-sm text-emerald-700 font-medium">{rows.length} baris siap diimpor</p>
              </div>
            )}
          </div>
        )}

        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
          <button
            onClick={tab === 'manual' ? handleAddManual : async () => { await onImport(rows); onClose(); }}
            disabled={tab === 'csv' && rows.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-400 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90">
            {tab === 'manual' ? 'Simpan Konten' : `Import ${rows.length} Konten`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────
function TabOverview({ competitors, scores, userAccount, selected, onSelect, onRemove, onAdd }) {
  if (!competitors.length) return <EmptyCompetitorState onAdd={onAdd} />;

  const ranked = [...competitors].sort((a, b) => (scores[b.id]?.overall ?? 0) - (scores[a.id]?.overall ?? 0));
  const topThreat = ranked[0];
  const fastMover = [...competitors].sort((a, b) => (b.followerGrowthRate ?? 0) - (a.followerGrowthRate ?? 0))[0];
  const bestEngagement = [...competitors].sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))[0];
  const avgFollowers = avg(competitors, c => c.followers);
  const avgER = avg(competitors, c => c.engagementRate);
  const avgFreq = avg(competitors, c => parseFrequency(c.postingFrequencyNum ?? c.postingFrequency));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total kompetitor" value={competitors.length} icon={Users} tone="violet" helper="Akun aktif dipantau" />
        <StatCard label="Rata-rata followers" value={fmtCompact(avgFollowers)} icon={TrendingUp} tone="blue" helper="Benchmark ukuran audience" />
        <StatCard label="Rata-rata ER" value={`${avgER.toFixed(1)}%`} icon={Heart} tone="emerald" helper="Kualitas interaksi pasar" />
        <StatCard label="Rata-rata posting" value={`${avgFreq.toFixed(1)}x`} icon={Clock} tone="amber" helper="Frekuensi per minggu" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <SectionHeader
            title="Peta Kompetitor"
            desc="Klik akun untuk melihat score dan posisi relatifnya."
            action={
              <button onClick={onAdd}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500 text-white text-xs font-semibold hover:bg-violet-600">
                <Plus size={14} /> Tambah
              </button>
            }
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ranked.map(c => (
              <CompetitorCard key={c.id} competitor={c} scores={scores[c.id] ?? { overall: 0 }}
                isSelected={selected?.id === c.id} onClick={() => onSelect(c)} onRemove={onRemove} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <SectionHeader title="Prioritas Minggu Ini" desc="Fokus pada akun dan metrik paling berdampak." />
            <div className="space-y-3">
              {[
                { title: 'Ancaman utama', value: topThreat?.name, desc: `Score ${scores[topThreat?.id]?.overall ?? 0}/100`, icon: Trophy, tone: scoreTone(scores[topThreat?.id]?.overall ?? 0) },
                { title: 'Engagement tertinggi', value: bestEngagement?.name, desc: `${(bestEngagement?.engagementRate ?? 0).toFixed(1)}% ER`, icon: Activity, tone: 'emerald' },
                { title: 'Growth tercepat', value: fastMover?.name, desc: `${(fastMover?.followerGrowthRate ?? 0).toFixed(1)}%/bulan`, icon: Zap, tone: 'blue' },
              ].map(item => (
                <div key={item.title} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' : item.tone === 'blue' ? 'bg-blue-50 text-blue-600' : item.tone === 'amber' ? 'bg-amber-50 text-amber-600' : item.tone === 'rose' ? 'bg-rose-50 text-rose-600' : 'bg-violet-50 text-violet-600'}`}>
                    <item.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{item.title}</p>
                    <p className="text-sm font-bold text-gray-800 truncate">{item.value ?? '–'}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selected && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <SectionHeader title="Snapshot Terpilih" desc={selected.username} />
              <div className="flex items-center gap-4 mb-4">
                <ScoreRing score={scores[selected.id]?.overall ?? 0} size={72} />
                <div>
                  <p className="font-bold text-gray-800">{selected.name}</p>
                  <p className="text-xs text-gray-400">{selected.platform} · {selected.topContentType ?? 'Format belum diketahui'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-400">Followers</p><p className="font-bold text-gray-800">{fmtCompact(selected.followers)}</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-400">ER</p><p className="font-bold text-gray-800">{(selected.engagementRate ?? 0).toFixed(1)}%</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-400">Posting</p><p className="font-bold text-gray-800">{parseFrequency(selected.postingFrequencyNum ?? selected.postingFrequency)}x/mgg</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-400">Pillar</p><p className="font-bold text-gray-800 truncate">{selected.topContentPillar ?? '–'}</p></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Comparison ───────────────────────────────────────────
function TabComparison({ competitors, userAccount, scores, onAdd }) {
  if (!competitors.length) return <EmptyCompetitorState onAdd={onAdd} />;

  const dimensions = [
    { key: 'followers', label: 'Audience Size', fmt: fmtCompact, max: null },
    { key: 'engagementRate', label: 'Engagement Rate', fmt: v => `${(v ?? 0).toFixed(1)}%`, max: 10 },
    { key: 'postingFrequencyNum', label: 'Posting Pace', fmt: v => `${parseFrequency(v)}x/mgg`, max: 14 },
    { key: 'avgLikes', label: 'Avg Likes', fmt: fmtCompact, max: null },
    { key: 'avgComments', label: 'Avg Comments', fmt: fmtCompact, max: null },
  ];
  const allAccounts = [{ ...userAccount, name: 'Akun kamu', id: 'user', isUser: true }, ...competitors].filter(Boolean);
  const scoreDims = [
    ['growth', 'Growth'], ['engagement', 'Engagement'], ['consistency', 'Konsistensi'],
    ['quality', 'Kualitas'], ['virality', 'Viralitas'], ['differentiation', 'Diferensiasi'],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Leader followers', item: metricLeader(allAccounts, 'followers'), metric: 'followers', icon: Users },
          { label: 'Leader engagement', item: metricLeader(allAccounts, 'engagementRate'), metric: 'engagementRate', icon: Heart },
          { label: 'Leader posting', item: metricLeader(allAccounts, 'postingFrequencyNum'), metric: 'postingFrequencyNum', icon: Clock },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><card.icon size={16} /></div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400">{card.label}</p>
                <p className="font-bold text-gray-800 truncate">{card.item?.name ?? '–'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <SectionHeader title="Benchmark Metrik" desc="Bar ungu adalah akun kamu, biru adalah kompetitor." />
          <div className="space-y-5">
            {dimensions.map(dim => {
              const rawMax = Math.max(...allAccounts.map(a => Number(a[dim.key]) || 0), 1);
              const max = dim.max ?? rawMax;
              return (
                <div key={dim.key}>
                  <p className="text-xs font-bold text-gray-500 mb-2">{dim.label}</p>
                  <div className="space-y-2">
                    {allAccounts.map(account => {
                      const val = dim.key === 'postingFrequencyNum'
                        ? parseFrequency(account.postingFrequencyNum ?? account.postingFrequency)
                        : Number(account[dim.key]) || 0;
                      const pct = Math.min(100, (val / max) * 100);
                      return (
                        <div key={account.id} className="grid grid-cols-[120px_minmax(0,1fr)_70px] items-center gap-3">
                          <span className="text-xs text-gray-500 truncate">{account.name}</span>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${account.isUser ? 'bg-violet-500' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-700 text-right">{dim.fmt(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <SectionHeader title="Score Matrix" desc="Melihat kekuatan kompetitor per dimensi." />
          <div className="space-y-4">
            {competitors.map(c => (
              <div key={c.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <ScoreRing score={scores[c.id]?.overall ?? 0} size={46} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">{scoreLabel(scores[c.id]?.overall ?? 0).label}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {scoreDims.map(([key, label]) => {
                    const val = scores[c.id]?.[key] ?? 0;
                    const style = scoreLabel(val);
                    return (
                      <div key={key} className={`rounded-xl px-3 py-2 ${style.bg}`}>
                        <p className="text-[10px] text-gray-500">{label}</p>
                        <p className={`text-sm font-bold ${style.color}`}>{val}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Content Benchmark ────────────────────────────────────
function TabContent({ competitors, contents, onAddContent, onAdd }) {
  const [selected, setSelected] = useState(null);
  const selectedId = selected ?? competitors[0]?.id;
  const comp = competitors.find(c => c.id === selectedId);
  const rows = contents[selectedId] ?? [];

  const formatDist = useMemo(() => {
    const dist = {};
    rows.forEach(r => { dist[r.content_type || 'Other'] = (dist[r.content_type || 'Other'] ?? 0) + 1; });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const hookDist = useMemo(() => {
    const dist = {};
    rows.forEach(r => {
      const hook = inferHookStyle(r).label;
      if (hook && hook !== 'Belum terbaca') dist[hook] = (dist[hook] ?? 0) + 1;
    });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  if (!competitors.length) return <EmptyCompetitorState onAdd={onAdd} />;

  const avgER = rows.length ? avg(rows, r => r.estimated_engagement_rate) : 0;
  const topPerf = rows.filter(r => r.is_top_performer || Number(r.estimated_engagement_rate) >= 3);
  const topRows = [...rows].sort((a, b) => (b.estimated_engagement_rate ?? 0) - (a.estimated_engagement_rate ?? 0)).slice(0, 8);
  const erBuckets = [
    { label: 'Viral', desc: '>=10% ER', color: 'bg-emerald-500', count: rows.filter(r => r.estimated_engagement_rate >= 10).length },
    { label: 'Bagus', desc: '3-10% ER', color: 'bg-blue-400', count: rows.filter(r => r.estimated_engagement_rate >= 3 && r.estimated_engagement_rate < 10).length },
    { label: 'Sedang', desc: '1-3% ER', color: 'bg-amber-400', count: rows.filter(r => r.estimated_engagement_rate >= 1 && r.estimated_engagement_rate < 3).length },
    { label: 'Rendah', desc: '<1% ER', color: 'bg-red-300', count: rows.filter(r => r.estimated_engagement_rate < 1).length },
  ];

  return (
    <div className="space-y-5">
      <AccountPillSelector competitors={competitors} selected={selectedId} setSelected={setSelected} />

      {comp && (
        <div className="grid grid-cols-1 2xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <SectionHeader
                title={comp.name}
                desc="Benchmark konten kompetitor"
                action={
                  <button onClick={() => onAddContent(comp)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500 text-white text-xs font-semibold hover:bg-violet-600">
                    <Plus size={13} /> Konten
                  </button>
                }
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-1 gap-2">
                {[
                  { label: 'Total konten', value: rows.length, icon: FileText, tone: 'violet' },
                  { label: 'Avg ER', value: `${avgER.toFixed(1)}%`, icon: Activity, tone: 'emerald' },
                  { label: 'Top performer', value: topPerf.length, icon: Trophy, tone: 'amber' },
                  { label: 'Format utama', value: formatDist[0]?.[0] ?? '–', icon: Bookmark, tone: 'blue' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">{item.label}</p>
                      <p className="text-lg font-bold text-gray-800 leading-tight break-words">{item.value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      item.tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                      item.tone === 'amber' ? 'bg-amber-50 text-amber-600' :
                      item.tone === 'blue' ? 'bg-blue-50 text-blue-600' :
                      'bg-violet-50 text-violet-600'
                    }`}>
                      <item.icon size={17} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <SectionHeader title="Distribusi Format" desc="Apa yang paling sering mereka pakai." />
              {formatDist.length ? formatDist.map(([type, cnt]) => (
                <div key={type} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${CONTENT_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-700'}`}>{type}</span>
                    <span className="text-xs font-bold text-gray-600">{cnt}</span>
                  </div>
                  <MiniBar value={cnt} max={formatDist[0]?.[1] ?? 1} color="bg-violet-400" showValue={false} />
                </div>
              )) : <p className="text-sm text-gray-400">Belum ada data konten.</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <SectionHeader title="Hook / Angle" desc="Pola pembuka konten dari CSV atau hasil deteksi otomatis." />
                {hookDist.length ? hookDist.map(([hook, cnt]) => (
                  <div key={hook} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600 truncate">{hook}</span>
                      <span className="text-xs font-bold text-gray-600">{cnt}</span>
                    </div>
                    <MiniBar value={cnt} max={hookDist[0]?.[1] ?? 1} color="bg-blue-400" showValue={false} />
                  </div>
                )) : <p className="text-sm text-gray-400">Hook belum terbaca karena title/caption tidak cukup deskriptif.</p>}
                <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Cara kerja</p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Jika `hook_style` kosong, sistem membaca title/caption lalu mengelompokkan pola pembuka seperti pertanyaan, tips/tutorial, problem-solution, data, story, atau trend.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <SectionHeader title="Kualitas ER" desc="Distribusi performa konten." />
                {erBuckets.map(bucket => (
                  <div key={bucket.label} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600">{bucket.label} <span className="font-normal text-gray-400">({bucket.desc})</span></span>
                      <span className="text-xs font-bold text-gray-600">{bucket.count}</span>
                    </div>
                    <MiniBar value={bucket.count} max={Math.max(rows.length, 1)} color={bucket.color} showValue={false} />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <SectionHeader title="Top Konten untuk Ditiru Polanya" desc="Urut dari ER tertinggi, bukan untuk copy isi konten." />
              </div>
              {topRows.length ? (
                <div className="divide-y divide-gray-50">
                  {topRows.map(row => (
                    <a key={row.id} href={row.permalink || row.content_url || '#'} target="_blank" rel="noopener noreferrer"
                      className="grid grid-cols-[48px_minmax(0,1fr)_92px] gap-3 items-center px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                        {row.thumbnail_url ? <img src={row.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <FileText size={18} className="text-gray-300" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${CONTENT_TYPE_COLORS[row.content_type] ?? 'bg-gray-100 text-gray-600'}`}>{row.content_type ?? 'Other'}</span>
                          {(() => {
                            const hook = inferHookStyle(row);
                            return hook.label !== 'Belum terbaca'
                              ? <span className="text-[10px] text-gray-400 truncate">{hook.label}{hook.inferred ? ' (auto)' : ''}</span>
                              : null;
                          })()}
                        </div>
                        <p className="text-sm font-medium text-gray-700 truncate">{row.title && !row.title.startsWith('Post ') ? row.title : 'Konten kompetitor'}</p>
                        <p className="text-xs text-gray-400">{row.published_at ? new Date(row.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanggal belum ada'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-violet-600">{(Number(row.estimated_engagement_rate) || 0).toFixed(1)}%</p>
                        <p className="text-[10px] text-gray-400">ER</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center">
                  <FileText size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">Belum ada konten untuk dianalisa.</p>
                  <button onClick={() => onAddContent(comp)} className="mt-3 text-sm text-violet-600 font-semibold hover:text-violet-700">
                    Tambah konten pertama
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Gap Analysis ─────────────────────────────────────────
function TabGap({ competitors, insights, userAccount, onAdd }) {
  const [selected, setSelected] = useState(null);
  const selectedId = selected ?? competitors[0]?.id;
  const insight = insights[selectedId];
  const gaps = insight?.gap_analysis?.gaps ?? [];
  const comp = competitors.find(c => c.id === selectedId);

  if (!competitors.length) return <EmptyCompetitorState onAdd={onAdd} />;

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...gaps].sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));
  const counts = {
    behind: sorted.filter(g => g.status === 'behind').length,
    ahead: sorted.filter(g => g.status === 'ahead').length,
    opportunity: sorted.filter(g => g.status === 'opportunity').length,
  };

  return (
    <div className="space-y-5">
      <AccountPillSelector competitors={competitors} selected={selectedId} setSelected={setSelected} prefix="vs " />

      {comp && (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <SectionHeader title={`Kamu vs ${comp.name}`} desc="Ringkasan gap yang perlu diprioritaskan." />
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-red-50 p-3 text-center"><p className="text-xl font-bold text-red-600">{counts.behind}</p><p className="text-[10px] text-red-500">Kejar</p></div>
                <div className="rounded-xl bg-violet-50 p-3 text-center"><p className="text-xl font-bold text-violet-600">{counts.opportunity}</p><p className="text-[10px] text-violet-500">Peluang</p></div>
                <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-xl font-bold text-emerald-600">{counts.ahead}</p><p className="text-[10px] text-emerald-500">Unggul</p></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <SectionHeader title="Legenda" />
              <div className="space-y-2">
                {[
                  { status: 'behind', label: 'Perlu Kejar' },
                  { status: 'opportunity', label: 'Peluang' },
                  { status: 'ahead', label: 'Kamu Unggul' },
                  { status: 'parity', label: 'Seimbang' },
                ].map(({ status, label }) => {
                  const style = gapStatusStyle(status);
                  return <span key={status} className={`block text-xs px-3 py-2 rounded-xl font-semibold ${style.bg} ${style.color}`}>{label}</span>;
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <SectionHeader title="Action Plan Gap" desc="Urutan sudah berdasarkan prioritas tertinggi." />
            {sorted.length ? (
              <div className="space-y-3">
                {sorted.map((gap, index) => {
                  const style = gapStatusStyle(gap.status);
                  const priorityBadge = gap.priority === 'high' ? 'bg-red-50 text-red-600' : gap.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-500';
                  return (
                    <div key={gap.dimension} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center text-xs font-bold">{index + 1}</div>
                      <div className="rounded-2xl border border-gray-100 p-4">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${style.bg} ${style.color}`}>{style.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityBadge}`}>
                            {gap.priority === 'high' ? 'Prioritas Tinggi' : gap.priority === 'medium' ? 'Medium' : 'Low'}
                          </span>
                          <p className="text-sm font-bold text-gray-800">{gap.dimension}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                          <div className="rounded-xl bg-violet-50 px-3 py-2"><span className="text-violet-600 font-semibold">Kamu</span><p className="text-gray-700 mt-0.5">{gap.user}</p></div>
                          <div className="rounded-xl bg-blue-50 px-3 py-2"><span className="text-blue-600 font-semibold">{comp.name}</span><p className="text-gray-700 mt-0.5">{gap.comp}</p></div>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{gap.action}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Belum ada data untuk gap analysis.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: AI Recommendation ────────────────────────────────────
function TabAI({ competitors, insights, loadingInsight, onRegenerate, onAdd }) {
  const [selected, setSelected] = useState(null);
  const selectedId = selected ?? competitors[0]?.id;
  const insight = insights[selectedId];
  const recs = insight?.recommendation ?? [];
  const comp = competitors.find(c => c.id === selectedId);
  const nextSteps = recs.flatMap(rec => rec.points.slice(0, 1)).slice(0, 4);

  if (!competitors.length) return <EmptyCompetitorState onAdd={onAdd} />;

  return (
    <div className="space-y-5">
      <AccountPillSelector competitors={competitors} selected={selectedId} setSelected={setSelected} />

      {comp && insight ? (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-violet-100 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Ringkasan strategi</p>
                  <h3 className="font-bold text-gray-800 mb-2">{comp.name}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{insight.summary}</p>
                </div>
              </div>
              <button onClick={() => onRegenerate(selectedId)} disabled={loadingInsight}
                className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-violet-100 text-violet-600 text-sm font-semibold hover:bg-violet-50">
                <RefreshCw size={14} className={loadingInsight ? 'animate-spin' : ''} />
                Refresh rekomendasi
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <SectionHeader title="Langkah Berikutnya" desc="Ambil satu eksekusi dulu dari rekomendasi ini." />
              <div className="space-y-2">
                {nextSteps.map((step, index) => (
                  <div key={`${step}-${index}`} className="flex gap-3 rounded-xl bg-gray-50 p-3">
                    <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{index + 1}</span>
                    <p className="text-xs text-gray-600 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {recs.map(rec => {
              const Icon = REC_ICONS[rec.icon] ?? Lightbulb;
              const borderBg = REC_COLORS[rec.type] ?? 'border-gray-200 bg-gray-50';
              const iconColor = REC_ICON_COLORS[rec.type] ?? 'text-gray-500';
              return (
                <div key={rec.type} className={`rounded-2xl border p-4 ${borderBg}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={16} className={iconColor} />
                    <h4 className="font-bold text-gray-800 text-sm">{rec.title}</h4>
                  </div>
                  <ul className="space-y-2">
                    {rec.points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                        <CheckCircle size={13} className="mt-0.5 text-gray-400 flex-shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : comp ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Sparkles size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="font-semibold text-gray-700">Rekomendasi untuk {comp.name} belum tersedia</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Generate ulang insight agar action plan dan rekomendasi strateginya muncul.</p>
          <button onClick={() => onRegenerate(selectedId)} disabled={loadingInsight}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 disabled:opacity-50">
            <RefreshCw size={14} className={loadingInsight ? 'animate-spin' : ''} />
            Generate rekomendasi
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Sparkles size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400">Pilih kompetitor untuk melihat rekomendasi.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CompetitorIntelligence() {
  const { activeWorkspace } = useWorkspace();
  const {
    competitors, contents, insights, userAccount,
    loading, loadingInsight,
    addCompetitor, removeCompetitor, addContents, regenerateInsight,
    isDemo,
  } = useCompetitorIntelligence(activeWorkspace?.id);

  const [tab, setTab]                       = useState('overview');
  const [showAddComp, setShowAddComp]       = useState(false);
  const [addContentTarget, setAddContentTarget] = useState(null);
  const [selectedComp, setSelectedComp]     = useState(null);

  const scores = useMemo(() => {
    const map = {};
    competitors.forEach(c => { map[c.id] = scoreCompetitor(c, userAccount); });
    return map;
  }, [competitors, userAccount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Competitor Intelligence</h1>
          <p className="text-sm text-gray-400">Analisis kompetitor berbasis data untuk strategi yang lebih tajam.</p>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && (
            <span className="text-xs bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl font-medium border border-amber-100">Demo Mode</span>
          )}
          <button onClick={() => setShowAddComp(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-400 text-white text-sm font-semibold shadow-sm hover:opacity-90">
            <Plus size={15} /> Tambah Kompetitor
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <TabOverview competitors={competitors} scores={scores} userAccount={userAccount}
          selected={selectedComp} onSelect={setSelectedComp}
          onRemove={removeCompetitor} onAdd={() => setShowAddComp(true)} />
      )}
      {tab === 'comparison' && (
        <TabComparison competitors={competitors} userAccount={userAccount} scores={scores}
          onAdd={() => setShowAddComp(true)} />
      )}
      {tab === 'content' && (
        <TabContent competitors={competitors} contents={contents} onAddContent={setAddContentTarget}
          onAdd={() => setShowAddComp(true)} />
      )}
      {tab === 'gap' && (
        <TabGap competitors={competitors} insights={insights} userAccount={userAccount}
          onAdd={() => setShowAddComp(true)} />
      )}
      {tab === 'ai' && (
        <TabAI competitors={competitors} insights={insights}
          loadingInsight={loadingInsight} onRegenerate={regenerateInsight}
          onAdd={() => setShowAddComp(true)} />
      )}

      {/* Modals */}
      {showAddComp && (
        <AddCompetitorModal onClose={() => setShowAddComp(false)} onAdd={addCompetitor} />
      )}
      {addContentTarget && (
        <AddContentModal competitor={addContentTarget}
          onClose={() => setAddContentTarget(null)}
          onImport={rows => addContents(addContentTarget.id, rows)} />
      )}
    </div>
  );
}
