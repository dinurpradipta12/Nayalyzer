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
  { id: 'overview',   label: 'Overview',         icon: BarChart2  },
  { id: 'comparison', label: 'Comparison',        icon: TrendingUp },
  { id: 'content',    label: 'Content Benchmark', icon: FileText   },
  { id: 'gap',        label: 'Gap Analysis',      icon: Target     },
  { id: 'ai',         label: 'AI Recommendation', icon: Sparkles   },
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
function MiniBar({ value, max = 100, color = 'bg-violet-400' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
    </div>
  );
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Judul / Caption</label>
              <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
                placeholder="5 Tips Desain Logo..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
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
  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Kompetitor', value: competitors.length, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Avg Followers', value: (competitors.reduce((s, c) => s + (c.followers ?? 0), 0) / (competitors.length || 1)).toLocaleString('id-ID', { maximumFractionDigits: 0 }), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Avg Eng. Rate', value: `${(competitors.reduce((s, c) => s + (c.engagementRate ?? 0), 0) / (competitors.length || 1)).toFixed(1)}%`, icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50' },
          { label: 'Avg Post/Minggu', value: `${(competitors.reduce((s, c) => s + parseFrequency(c.postingFrequency), 0) / (competitors.length || 1)).toFixed(1)}x`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-3`}><Icon size={16} className={color} /></div>
            <p className="text-xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Competitor cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {competitors.map(c => (
          <CompetitorCard key={c.id} competitor={c} scores={scores[c.id] ?? { overall: 0 }}
            isSelected={selected?.id === c.id} onClick={() => onSelect(c)} onRemove={onRemove} />
        ))}
      </div>

      {/* Score overview table */}
      {competitors.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">Perbandingan Kompetitor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[11px]">
                  <th className="text-left px-5 py-3">Kompetitor</th>
                  <th className="text-left px-3 py-3">Platform</th>
                  <th className="text-right px-3 py-3">Followers</th>
                  <th className="text-right px-3 py-3">Eng. Rate</th>
                  <th className="text-right px-3 py-3">Post/Minggu</th>
                  <th className="text-center px-3 py-3">Format Utama</th>
                  <th className="text-center px-3 py-3">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {competitors.map(c => {
                  const s = scores[c.id] ?? {};
                  const sl = scoreLabel(s.overall ?? 0);
                  return (
                    <tr key={c.id} onClick={() => onSelect(c)}
                      className="cursor-pointer transition-colors hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-700">{c.name}</td>
                      <td className="px-3 py-3 text-gray-500">{c.platform ?? '–'}</td>
                      <td className="px-3 py-3 text-right font-semibold text-gray-700">
                        {c.followers ? c.followers.toLocaleString('id-ID') : '–'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`font-semibold ${(c.engagementRate ?? 0) >= 3 ? 'text-emerald-600' : (c.engagementRate ?? 0) >= 1 ? 'text-amber-600' : 'text-red-500'}`}>
                          {c.engagementRate != null ? `${c.engagementRate}%` : '–'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {(c.postingFrequencyNum ?? c.postingFrequency) ? `${c.postingFrequencyNum ?? c.postingFrequency}×` : '–'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {c.topContentType
                          ? <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CONTENT_TYPE_COLORS[c.topContentType] ?? 'bg-gray-100 text-gray-600'}`}>{c.topContentType}</span>
                          : <span className="text-gray-300">–</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-6 rounded-md text-[11px] font-bold ${sl.bg} ${sl.color}`}>{s.overall ?? '–'}</span>
                      </td>
                    </tr>
                  );
                })}
                {userAccount && (
                  <tr className="bg-emerald-50/40 hover:bg-emerald-50">
                    <td className="px-5 py-3 font-medium text-gray-700 flex items-center gap-2">
                      <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded font-bold">KAMU</span>
                      {userAccount.name}
                    </td>
                    <td className="px-3 py-3 text-gray-500">{userAccount.platform ?? '–'}</td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-700">
                      {userAccount.followers ? userAccount.followers.toLocaleString('id-ID') : '–'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`font-semibold ${(userAccount.engagementRate ?? 0) >= 3 ? 'text-emerald-600' : (userAccount.engagementRate ?? 0) >= 1 ? 'text-amber-600' : 'text-red-500'}`}>
                        {userAccount.engagementRate != null ? `${userAccount.engagementRate}%` : '–'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600">
                      {userAccount.postingFrequency ? `${userAccount.postingFrequency}×` : '–'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {userAccount.topContentType
                        ? <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CONTENT_TYPE_COLORS[userAccount.topContentType] ?? 'bg-gray-100 text-gray-600'}`}>{userAccount.topContentType}</span>
                        : <span className="text-gray-300">–</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-300 text-[11px]">–</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Comparison ───────────────────────────────────────────
function TabComparison({ competitors, userAccount, scores }) {
  const DIMENSIONS = [
    { key: 'followers',       label: 'Followers',       fmt: v => v?.toLocaleString('id-ID') ?? '0', max: null },
    { key: 'engagementRate',  label: 'Engagement Rate', fmt: v => `${(v ?? 0).toFixed(1)}%`, max: 10 },
    { key: 'postingFrequencyNum', label: 'Post/Minggu', fmt: v => `${v ?? 0}x`, max: 14 },
    { key: 'avgLikes',        label: 'Avg Likes',       fmt: v => v?.toLocaleString('id-ID') ?? '0', max: null },
    { key: 'avgComments',     label: 'Avg Comments',    fmt: v => v?.toLocaleString('id-ID') ?? '0', max: null },
  ];

  const allAccounts = [{ ...userAccount, name: 'Kamu', id: 'user', isUser: true }, ...competitors];
  const maxVals = {};
  DIMENSIONS.forEach(d => {
    const rawMax = Math.max(...allAccounts.map(a => parseFloat(a[d.key] ?? 0) || 0)) || 1;
    maxVals[d.key] = d.max != null ? d.max : rawMax;
  });

  const SCORE_DIMS = ['growth','engagement','consistency','quality','virality','differentiation'];
  const SCORE_LABELS = ['Growth','Engagement','Konsistensi','Kualitas','Viralitas','Diferensiasi'];

  return (
    <div className="space-y-6">
      {/* Bar comparison */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Perbandingan Metrik Utama</h3>
        <div className="space-y-5">
          {DIMENSIONS.map(dim => (
            <div key={dim.key}>
              <p className="text-xs font-medium text-gray-500 mb-2">{dim.label}</p>
              <div className="space-y-1.5">
                {allAccounts.map((a, i) => {
                  const val = parseFloat(a[dim.key] ?? 0) || 0;
                  const pct = Math.min(100, (val / maxVals[dim.key]) * 100);
                  const colors = a.isUser
                    ? ['bg-violet-500', 'text-violet-700']
                    : ['bg-blue-400', 'text-blue-700'];
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-32 truncate">{a.name}</span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                        <div className={`h-full rounded-full ${colors[0]} flex items-center justify-end pr-2 transition-all`}
                          style={{ width: `${pct}%` }}>
                          {pct > 20 && <span className="text-[10px] text-white font-semibold">{dim.fmt(val)}</span>}
                        </div>
                        {pct <= 20 && <span className={`absolute left-[calc(${pct}%+6px)] top-1/2 -translate-y-1/2 text-[10px] font-semibold ${colors[1]}`}>{dim.fmt(val)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score comparison */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Score Comparison per Kompetitor</h3>
        <div className="space-y-4">
          {competitors.map(c => {
            const s = scores[c.id] ?? {};
            return (
              <div key={c.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${PLATFORM_COLORS[c.platform] ?? 'from-gray-400 to-gray-600'} flex items-center justify-center text-white text-xs font-bold`}>
                    {(c.name?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.username}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <ScoreRing score={s.overall ?? 0} size={40} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SCORE_DIMS.map((dim, i) => {
                    const v = s[dim] ?? 0;
                    const { color, bg } = scoreLabel(v);
                    return (
                      <div key={dim} className={`rounded-lg px-2 py-1.5 ${bg}`}>
                        <p className="text-[10px] text-gray-500">{SCORE_LABELS[i]}</p>
                        <p className={`text-sm font-bold ${color}`}>{v}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Content Benchmark ────────────────────────────────────
function TabContent({ competitors, contents, onAddContent }) {
  const [selected, setSelected] = useState(competitors[0]?.id ?? null);
  const comp = competitors.find(c => c.id === selected);
  const rows = contents[selected] ?? [];

  const formatDist = useMemo(() => {
    const dist = {};
    rows.forEach(r => { dist[r.content_type] = (dist[r.content_type] ?? 0) + 1; });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const hookDist = useMemo(() => {
    const dist = {};
    rows.forEach(r => { if (r.hook_style) dist[r.hook_style] = (dist[r.hook_style] ?? 0) + 1; });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const avgER = rows.length ? (rows.reduce((s, r) => s + (parseFloat(r.estimated_engagement_rate) || 0), 0) / rows.length).toFixed(1) : '–';
  const topPerf = rows.filter(r => r.is_top_performer);

  return (
    <div className="space-y-5">
      {/* Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {competitors.map(c => (
          <button key={c.id} onClick={() => setSelected(c.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${selected === c.id ? 'bg-violet-100 text-violet-700' : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-200'}`}>
            {c.name} <span className="text-xs opacity-60">({contents[c.id]?.length ?? 0})</span>
          </button>
        ))}
      </div>

      {comp && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Konten', value: rows.length },
              { label: 'Avg ER', value: `${avgER}%` },
              { label: 'Top Performer', value: topPerf.length },
              { label: 'Format Utama', value: formatDist[0]?.[0] ?? '–' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-lg font-bold text-gray-800">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          {/* Distribution */}
          {(() => {
            const hasHookData = hookDist.some(([h]) => h && h !== '-');
            const erBuckets = [
              { label: 'Viral (≥10%)',   color: 'bg-emerald-500', count: rows.filter(r => r.estimated_engagement_rate >= 10).length },
              { label: 'Bagus (3–10%)',  color: 'bg-blue-400',    count: rows.filter(r => r.estimated_engagement_rate >= 3 && r.estimated_engagement_rate < 10).length },
              { label: 'Sedang (1–3%)',  color: 'bg-amber-400',   count: rows.filter(r => r.estimated_engagement_rate >= 1 && r.estimated_engagement_rate < 3).length },
              { label: 'Rendah (<1%)',   color: 'bg-red-300',     count: rows.filter(r => r.estimated_engagement_rate < 1).length },
            ].filter(b => b.count > 0);
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Distribusi Format</h4>
                  {formatDist.length ? formatDist.map(([type, cnt]) => (
                    <div key={type} className="flex items-center gap-3 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-24 text-center flex-shrink-0 ${CONTENT_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-700'}`}>{type}</span>
                      <MiniBar value={cnt} max={formatDist[0]?.[1] ?? 1} color="bg-violet-400" />
                    </div>
                  )) : <p className="text-sm text-gray-400">Belum ada data konten</p>}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  {hasHookData ? (
                    <>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Hook Style</h4>
                      {hookDist.map(([hook, cnt]) => (
                        <div key={hook} className="flex items-center gap-3 mb-2">
                          <span className="text-xs text-gray-600 w-28 truncate flex-shrink-0">{hook}</span>
                          <MiniBar value={cnt} max={hookDist[0]?.[1] ?? 1} color="bg-blue-400" />
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Distribusi Engagement Rate</h4>
                      {erBuckets.length ? erBuckets.map(b => (
                        <div key={b.label} className="flex items-center gap-3 mb-2">
                          <span className="text-xs text-gray-600 w-28 flex-shrink-0">{b.label}</span>
                          <MiniBar value={b.count} max={rows.length} color={b.color} />
                        </div>
                      )) : <p className="text-sm text-gray-400">Belum ada data</p>}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Content grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Konten ({rows.length})</h4>
              <button onClick={() => onAddContent(comp)}
                className="flex items-center gap-1.5 text-xs text-violet-600 font-medium hover:text-violet-700">
                <Plus size={13} /> Tambah Konten
              </button>
            </div>
            {rows.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <FileText size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Belum ada data konten kompetitor.</p>
                <button onClick={() => onAddContent(comp)} className="mt-3 text-sm text-violet-600 font-medium hover:text-violet-700">
                  + Tambah konten pertama
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {rows.slice(0, 12).map(row => {
                  const erColor = row.estimated_engagement_rate >= 3 ? 'text-emerald-600' : row.estimated_engagement_rate >= 1 ? 'text-amber-600' : 'text-violet-600';
                  return (
                    <a key={row.id} href={row.permalink ?? '#'} target="_blank" rel="noopener noreferrer"
                      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-violet-200 transition-all group">
                      {/* Thumbnail */}
                      <div className="aspect-square bg-gray-100 relative overflow-hidden">
                        {row.thumbnail_url ? (
                          <img src={row.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText size={24} className="text-gray-300" />
                          </div>
                        )}
                        {/* Overlay badges */}
                        <div className="absolute top-2 left-2 flex gap-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm bg-white/80 ${CONTENT_TYPE_COLORS[row.content_type] ?? 'text-gray-700'}`}>
                            {row.content_type}
                          </span>
                          {row.is_top_performer && <span className="text-[10px] bg-amber-400/90 text-white px-1.5 py-0.5 rounded-md font-medium">⭐ Top</span>}
                        </div>
                        {/* ER overlay */}
                        {row.estimated_engagement_rate > 0 && (
                          <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-0.5">
                            <span className={`text-xs font-bold ${erColor}`}>{parseFloat(row.estimated_engagement_rate).toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        {row.published_at && (
                          <p className="text-[10px] text-gray-400 mb-1">{new Date(row.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        )}
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-2">
                          {row.title && !row.title.startsWith('Post ') ? row.title : <span className="text-gray-400 italic">Lihat di Instagram →</span>}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-gray-400">
                          <span className="flex items-center gap-1"><Heart size={10} />{(row.likes ?? 0).toLocaleString('id-ID')}</span>
                          <span className="flex items-center gap-1"><MessageCircle size={10} />{(row.comments ?? 0).toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: Gap Analysis ─────────────────────────────────────────
function TabGap({ competitors, insights, userAccount }) {
  const [selected, setSelected] = useState(competitors[0]?.id ?? null);
  const insight = insights[selected];
  const gaps = insight?.gap_analysis?.gaps ?? [];
  const comp = competitors.find(c => c.id === selected);

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...gaps].sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {competitors.map(c => (
          <button key={c.id} onClick={() => setSelected(c.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${selected === c.id ? 'bg-violet-100 text-violet-700' : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-200'}`}>
            vs {c.name}
          </button>
        ))}
      </div>

      {comp && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {[
              { status: 'ahead',       label: 'Kamu Unggul' },
              { status: 'behind',      label: 'Perlu Kejar' },
              { status: 'opportunity', label: 'Peluang' },
              { status: 'parity',      label: 'Seimbang' },
            ].map(({ status, label }) => {
              const { color, bg } = gapStatusStyle(status);
              return (
                <span key={status} className={`text-xs px-3 py-1 rounded-full font-medium ${bg} ${color}`}>{label}</span>
              );
            })}
          </div>

          {/* Gap cards */}
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada data untuk gap analysis.</p>
          ) : (
            <div className="space-y-3">
              {sorted.map(gap => {
                const style = gapStatusStyle(gap.status);
                const priorityBadge = gap.priority === 'high' ? 'bg-red-50 text-red-600' : gap.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-500';
                return (
                  <div key={gap.dimension} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-24 text-center py-1 rounded-lg text-xs font-semibold ${style.bg} ${style.color}`}>
                        {style.label}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-700 text-sm">{gap.dimension}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityBadge}`}>
                            {gap.priority === 'high' ? 'Prioritas Tinggi' : gap.priority === 'medium' ? 'Medium' : 'Low'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                          <span><span className="text-violet-600 font-semibold">Kamu:</span> {gap.user}</span>
                          <span><span className="text-blue-600 font-semibold">{comp.name}:</span> {gap.comp}</span>
                        </div>
                        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{gap.action}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab: AI Recommendation ────────────────────────────────────
function TabAI({ competitors, insights, loadingInsight, onRegenerate }) {
  const [selected, setSelected] = useState(competitors[0]?.id ?? null);
  const insight = insights[selected];
  const recs = insight?.recommendation ?? [];
  const comp = competitors.find(c => c.id === selected);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
        {competitors.map(c => (
          <button key={c.id} onClick={() => setSelected(c.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${selected === c.id ? 'bg-violet-100 text-violet-700' : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-200'}`}>
            {c.name}
          </button>
        ))}
      </div>

      {comp && insight && (
        <>
          {/* Summary */}
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-violet-800 mb-1">Ringkasan AI</h3>
                <p className="text-sm text-violet-700 leading-relaxed">{insight.summary}</p>
              </div>
              <button onClick={() => onRegenerate(selected)} disabled={loadingInsight}
                className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium flex-shrink-0">
                <RefreshCw size={13} className={loadingInsight ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Recommendation cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recs.map(rec => {
              const Icon = REC_ICONS[rec.icon] ?? Lightbulb;
              const borderBg = REC_COLORS[rec.type] ?? 'border-gray-200 bg-gray-50';
              const iconColor = REC_ICON_COLORS[rec.type] ?? 'text-gray-500';
              return (
                <div key={rec.type} className={`rounded-2xl border p-4 ${borderBg}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={16} className={iconColor} />
                    <h4 className="font-semibold text-gray-700 text-sm">{rec.title}</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {rec.points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!comp && (
        <div className="text-center py-12">
          <Users size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400">Pilih kompetitor untuk melihat rekomendasi AI.</p>
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
        <TabComparison competitors={competitors} userAccount={userAccount} scores={scores} />
      )}
      {tab === 'content' && (
        <TabContent competitors={competitors} contents={contents} onAddContent={setAddContentTarget} />
      )}
      {tab === 'gap' && (
        <TabGap competitors={competitors} insights={insights} userAccount={userAccount} />
      )}
      {tab === 'ai' && (
        <TabAI competitors={competitors} insights={insights}
          loadingInsight={loadingInsight} onRegenerate={regenerateInsight} />
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
