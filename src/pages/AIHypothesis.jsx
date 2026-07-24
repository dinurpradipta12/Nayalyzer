import { useState, useMemo } from 'react';
import {
  Sparkles, RefreshCw, Filter, TrendingUp, CheckCircle2, PlayCircle, XCircle,
  Brain, Zap, BarChart2, FlaskConical, Lightbulb, AlertCircle, ChevronDown,
  ArrowUpDown, Loader2, X,
} from 'lucide-react';
import AIHypothesisCard, { statusConfig } from '../components/AIHypothesisCard';
import { useHypotheses } from '../hooks/useHypotheses';
import { useWorkspace } from '../context/WorkspaceContext';
import { generateHypotheses } from '../lib/aiHypothesisEngine';

// ── Tab config ────────────────────────────────────────────────
const TYPE_TABS = [
  { key: 'all',        label: 'Semua',      icon: Brain        },
  { key: 'growth',     label: 'Growth',     icon: TrendingUp   },
  { key: 'content',    label: 'Content',    icon: Lightbulb    },
  { key: 'engagement', label: 'Engagement', icon: Zap          },
  { key: 'competitor', label: 'Competitor', icon: BarChart2    },
  { key: 'experiment', label: 'Experiment', icon: FlaskConical },
];

const SORT_OPTIONS = [
  { key: 'priority', label: 'Priority Score' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'impact', label: 'Impact' },
  { key: 'newest', label: 'Terbaru' },
];

const STATUS_FILTERS = ['Semua', 'New', 'Testing', 'Validated', 'Rejected'];
const PLATFORMS      = ['Semua', 'Instagram', 'TikTok', 'Threads'];

// ── Generate modal ────────────────────────────────────────────
function GenerateModal({ onClose, onGenerate, generating, genResult }) {
  const [platform,   setPlatform]   = useState('Semua');
  const [dateRange,  setDateRange]  = useState('30 hari terakhir');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-400 p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <Brain size={16} />
              </div>
              <span className="font-bold text-sm">AI Hypothesis Engine</span>
            </div>
            <button onClick={onClose} className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
              <X size={13} />
            </button>
          </div>
          <p className="text-white/80 text-xs leading-relaxed">
            AI akan menganalisis data analytics kamu dan menghasilkan hipotesa yang spesifik, terukur, dan bisa langsung diuji.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {genResult?.warning && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
	                <p className="text-xs font-semibold text-amber-700">Menggunakan mode fallback</p>
	                <p className="text-xs text-amber-600 mt-0.5">AI provider tidak tersedia. Hipotesa dibuat dari pola data lokal.</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Platform</label>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => setPlatform(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                    ${platform === p ? 'bg-violet-500 text-white border-violet-500' : 'border-gray-200 text-gray-500 hover:border-violet-300'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Rentang Waktu</label>
            <div className="relative">
              <select value={dateRange} onChange={e => setDateRange(e.target.value)}
                className="w-full appearance-none px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">
                <option>30 hari terakhir</option>
                <option>60 hari terakhir</option>
                <option>90 hari terakhir</option>
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="p-3 bg-lavender-50 border border-violet-100 rounded-xl text-xs text-violet-700 space-y-1">
            <p className="font-semibold">AI akan menganalisis:</p>
            <ul className="space-y-0.5 text-violet-600">
              {['Account & follower metrics','Content format, pillar & ER','Posting time & audience activity','Competitor gap analysis','Caption & hook patterns'].map(t => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={10} /> {t}
                </li>
              ))}
            </ul>
          </div>

          {genResult?.error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{genResult.error}</p>
            </div>
          )}

          <button onClick={() => onGenerate({ platform, dateRange })}
            disabled={generating}
            className="w-full purple-btn py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-70">
            {generating
              ? <><Loader2 size={15} className="animate-spin" /> Menganalisis data...</>
              : <><Sparkles size={15} /> Generate 5 Hipotesa Baru</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────
function DetailModal({ hypothesis: h, onClose, onStatusChange }) {
  if (!h) return null;
  const typeCfg = {
    growth: 'Growth', content: 'Content', engagement: 'Engagement',
    competitor: 'Competitor', experiment: 'Experiment',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full uppercase">
                {typeCfg[h.hypothesis_type] || 'Content'}
              </span>
              {h.risk_level && h.risk_level !== 'Low' && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full">
                  Risiko {h.risk_level}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-gray-800 leading-snug">{h.title}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Scores row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Confidence', value: h.confidence_score || h.confidenceScore || 0, color: 'text-green-600 bg-green-50' },
              { label: 'Impact',     value: h.impact_score     || 0, color: 'text-violet-600 bg-violet-50' },
              { label: 'Urgency',    value: h.urgency_score    || 0, color: 'text-blue-600 bg-blue-50' },
              { label: 'Difficulty', value: h.difficulty_score || 0, color: 'text-red-500 bg-red-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
                <p className="text-xl font-bold">{Math.round(s.value)}</p>
                <p className="text-[10px] font-semibold mt-0.5 opacity-80">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Main Insight</p>
            <p className="text-sm text-gray-700 leading-relaxed">{h.summary || h.insight}</p>
          </div>

          {/* Pattern */}
          {h.pattern_detected && (
            <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl">
              <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1.5">Pattern Detected</p>
              <p className="text-sm text-violet-800 leading-relaxed">{h.pattern_detected}</p>
            </div>
          )}

          {/* Evidence */}
          {(h.data_evidence || h.evidence || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Data Evidence</p>
              <ul className="space-y-2">
                {(h.data_evidence || h.evidence).map((ev, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 rounded-xl p-3">
                    <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                    {ev}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Strategic meaning */}
          {h.strategic_meaning && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1.5">Makna Strategis</p>
              <p className="text-sm text-blue-800 leading-relaxed">{h.strategic_meaning}</p>
            </div>
          )}

          {/* Experiment + metrics */}
          <div className="grid sm:grid-cols-2 gap-4">
            {(h.suggested_experiment || h.suggestedExperiment) && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-amber-700">Saran Eksperimen</p>
                  {h.experiment_duration && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                      {h.experiment_duration} hari
                    </span>
                  )}
                </div>
                <p className="text-sm text-amber-800 leading-relaxed">{h.suggested_experiment || h.suggestedExperiment}</p>
              </div>
            )}
            {(h.predicted_impact || h.expected_impact || h.expectedImpact) && (
              <div className="p-4 bg-green-50 border border-green-100 rounded-2xl">
                <p className="text-xs font-bold text-green-700 mb-1.5">Predicted Impact</p>
                <p className="text-sm text-green-800 leading-relaxed">{h.predicted_impact || h.expected_impact || h.expectedImpact}</p>
              </div>
            )}
          </div>

          {/* Success metrics */}
          {(h.success_metrics || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Success Metrics</p>
              <ul className="space-y-1.5">
                {h.success_metrics.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action plan */}
          {(h.action_plan || h.actionPlan || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Action Plan</p>
              <ol className="space-y-2.5">
                {(h.action_plan || h.actionPlan).map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-400 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Content recs */}
          {(h.content_recommendations || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Content Recommendations</p>
              <ul className="space-y-2">
                {h.content_recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-lavender-50 rounded-xl p-3">
                    <Sparkles size={13} className="text-violet-400 flex-shrink-0 mt-0.5" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status actions */}
          {onStatusChange && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Ubah status:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusConfig).map(([key, cfg]) => {
                  const Ic = cfg.icon;
                  return (
                    <button key={key} onClick={() => { onStatusChange(h.id, key); onClose(); }}
                      disabled={h.status === key}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
                        ${h.status === key ? `${cfg.color}` : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-violet-200 hover:text-violet-600'}`}>
                      <Ic size={11} /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function AIHypothesis() {
  const { activeWorkspace }         = useWorkspace();
  const { hypotheses, updateStatus, addHypotheses, loading } = useHypotheses(activeWorkspace?.id);

  const [activeType,   setActiveType]   = useState('all');
  const [activeStatus, setActiveStatus] = useState('Semua');
  const [sortBy,       setSortBy]       = useState('priority');
  const [showGenModal, setShowGenModal] = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [genResult,    setGenResult]    = useState(null);
  const [detailH,      setDetailH]      = useState(null);

  // Stats
  const stats = useMemo(() => ({
    total:     hypotheses.length,
    new:       hypotheses.filter(h => h.status === 'New').length,
    testing:   hypotheses.filter(h => h.status === 'Testing').length,
    validated: hypotheses.filter(h => h.status === 'Validated').length,
    rejected:  hypotheses.filter(h => h.status === 'Rejected').length,
    avgConfidence: hypotheses.length
      ? Math.round(hypotheses.reduce((s, h) => s + (h.confidence_score || h.confidenceScore || 0), 0) / hypotheses.length)
      : 0,
    avgPriority: hypotheses.length
      ? Math.round(hypotheses.reduce((s, h) => s + (h.priority_score || 0), 0) / hypotheses.length)
      : 0,
  }), [hypotheses]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = hypotheses;
    if (activeType !== 'all') list = list.filter(h => h.hypothesis_type === activeType);
    if (activeStatus !== 'Semua') list = list.filter(h => h.status === activeStatus);

    return [...list].sort((a, b) => {
      if (sortBy === 'priority')    return (b.priority_score || 0) - (a.priority_score || 0);
      if (sortBy === 'confidence')  return (b.confidence_score || b.confidenceScore || 0) - (a.confidence_score || a.confidenceScore || 0);
      if (sortBy === 'impact')      return (b.impact_score || 0) - (a.impact_score || 0);
      return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
    });
  }, [hypotheses, activeType, activeStatus, sortBy]);

  // Generate handler
  const handleGenerate = async ({ platform, dateRange }) => {
    setGenerating(true);
    setGenResult(null);
    try {
      const result = await generateHypotheses({
        workspaceId: activeWorkspace?.id,
        platform,
        dateRange,
      });
      setGenResult(result);
      if (result.hypotheses?.length) {
        const saved = await addHypotheses(result.hypotheses);
        if (saved?.error) throw new Error(saved.error.message || 'Gagal menyimpan hipotesa baru');
        setShowGenModal(false);
      }
    } catch (e) {
      setGenResult({ error: e.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* Hero */}
        <div className="bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-400 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-12 -translate-x-12" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={20} className="text-yellow-300" />
              <span className="font-bold text-sm">AI Hypothesis Engine</span>
            </div>
            <h2 className="text-xl font-bold mb-1.5 leading-tight">Hipotesa berbasis data, bukan asumsi.</h2>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              AI membaca seluruh data analytics kamu — engagement, reach, format, posting time, kompetitor — dan membuat hipotesa yang bisa langsung diuji.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => { setShowGenModal(true); setGenResult(null); }}
                className="bg-white text-violet-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-violet-50 transition-all shadow-lg">
                <Sparkles size={15} /> Generate Hipotesa Baru
              </button>
              <div className="flex items-center gap-4 text-white/80 text-xs">
                <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {stats.validated} Tervalidasi</span>
                <span className="flex items-center gap-1"><PlayCircle size={12} /> {stats.testing} Testing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total',       value: stats.total,     color: 'text-gray-800',   bg: 'bg-white',    icon: Brain       },
            { label: 'Baru',        value: stats.new,       color: 'text-blue-600',   bg: 'bg-blue-50',  icon: Sparkles    },
            { label: 'Testing',     value: stats.testing,   color: 'text-amber-600',  bg: 'bg-amber-50', icon: PlayCircle  },
            { label: 'Tervalidasi', value: stats.validated, color: 'text-green-600',  bg: 'bg-green-50', icon: CheckCircle2 },
            { label: 'Ditolak',     value: stats.rejected,  color: 'text-red-500',    bg: 'bg-red-50',   icon: XCircle     },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <button key={label}
              onClick={() => setActiveStatus(label === 'Total' ? 'Semua' : label === 'Tervalidasi' ? 'Validated' : label === 'Baru' ? 'New' : label)}
              className={`${bg} rounded-2xl border border-purple-50 shadow-card p-3.5 text-center hover:shadow-soft transition-all`}>
              <Icon size={16} className={`mx-auto mb-1 ${color}`} />
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        {/* Avg scores */}
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Rata-rata Confidence Score</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-lavender-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full"
                  style={{ width: `${stats.avgConfidence}%`, transition: 'width 0.7s' }} />
              </div>
              <span className="font-bold text-violet-700 text-sm w-8 text-right">{stats.avgConfidence}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Rata-rata Priority Score</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-lavender-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
                  style={{ width: `${Math.min(stats.avgPriority / 3, 100)}%`, transition: 'width 0.7s' }} />
              </div>
              <span className="font-bold text-amber-600 text-sm w-8 text-right">{stats.avgPriority}</span>
            </div>
          </div>
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {TYPE_TABS.map(t => {
            const Icon = t.icon;
            const count = t.key === 'all' ? hypotheses.length : hypotheses.filter(h => h.hypothesis_type === t.key).length;
            return (
              <button key={t.key} onClick={() => setActiveType(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0
                  ${activeType === t.key
                    ? 'bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-purple'
                    : 'bg-white border border-purple-100 text-gray-500 hover:border-violet-300'}`}>
                <Icon size={13} /> {t.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeType === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Filter size={12} /> Status:
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setActiveStatus(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all
                  ${activeStatus === s ? 'bg-violet-100 text-violet-700 font-bold' : 'text-gray-400 hover:text-gray-600'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ArrowUpDown size={12} className="text-gray-400" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 text-gray-600 focus:outline-none focus:border-violet-400 bg-white">
              {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="text-violet-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-14 h-14 bg-lavender-100 rounded-2xl flex items-center justify-center mx-auto">
              <Brain size={24} className="text-violet-400" />
            </div>
            <p className="text-gray-500 font-medium">Belum ada hipotesa</p>
            <p className="text-xs text-gray-400">Klik "Generate Hipotesa Baru" untuk memulai analisis AI.</p>
            <button onClick={() => setShowGenModal(true)} className="purple-btn px-6 py-2 text-sm mx-auto">
              <Sparkles size={14} className="mr-1.5 inline" /> Generate Sekarang
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(h => (
              <AIHypothesisCard
                key={h.id}
                hypothesis={h}
                onStatusChange={updateStatus}
                onOpenDetail={setDetailH}
              />
            ))}
          </div>
        )}
      </div>

      {/* Generate modal */}
      {showGenModal && (
        <GenerateModal
          onClose={() => setShowGenModal(false)}
          onGenerate={handleGenerate}
          generating={generating}
          genResult={genResult}
        />
      )}

      {/* Detail modal */}
      {detailH && (
        <DetailModal
          hypothesis={detailH}
          onClose={() => setDetailH(null)}
          onStatusChange={(id, status) => { updateStatus(id, status); setDetailH(prev => prev ? { ...prev, status } : null); }}
        />
      )}

      {/* Generating toast */}
      {generating && (
        <div className="fixed bottom-24 lg:bottom-6 right-6 bg-white rounded-2xl shadow-xl border border-purple-100 p-4 flex items-center gap-3 z-40">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl flex items-center justify-center">
            <Brain size={15} className="text-white animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-800">AI sedang menganalisis...</p>
            <p className="text-[10px] text-gray-400">Membaca data & membuat hipotesa</p>
          </div>
        </div>
      )}
    </>
  );
}
