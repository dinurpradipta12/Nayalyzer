import { useState } from 'react';
import {
  ChevronDown, ChevronUp, Lightbulb, Target, FlaskConical, TrendingUp,
  CheckCircle2, XCircle, PlayCircle, Sparkles, AlertTriangle, BarChart2,
  Zap, Shield, Brain, ExternalLink,
} from 'lucide-react';
import PlatformBadge from './ui/PlatformBadge';

// ── Config ────────────────────────────────────────────────────
export const statusConfig = {
  New:       { label: 'Baru',          color: 'bg-blue-50 text-blue-600 border-blue-100',  icon: Sparkles    },
  Testing:   { label: 'Sedang Diuji',  color: 'bg-amber-50 text-amber-600 border-amber-100', icon: PlayCircle },
  Validated: { label: 'Tervalidasi',   color: 'bg-green-50 text-green-600 border-green-100', icon: CheckCircle2 },
  Rejected:  { label: 'Ditolak',       color: 'bg-red-50 text-red-500 border-red-100',      icon: XCircle    },
};

const typeConfig = {
  growth:      { label: 'Growth',      color: 'text-emerald-600 bg-emerald-50', icon: TrendingUp  },
  content:     { label: 'Content',     color: 'text-violet-600 bg-violet-50',   icon: Lightbulb   },
  engagement:  { label: 'Engagement',  color: 'text-blue-600 bg-blue-50',       icon: Zap         },
  competitor:  { label: 'Competitor',  color: 'text-amber-600 bg-amber-50',     icon: BarChart2   },
  experiment:  { label: 'Experiment',  color: 'text-rose-600 bg-rose-50',       icon: FlaskConical },
};

const riskColor = { Low: 'text-green-600 bg-green-50', Medium: 'text-amber-600 bg-amber-50', High: 'text-red-600 bg-red-50' };

// ── Score bar ─────────────────────────────────────────────────
function ScoreBar({ label, value, color = 'violet' }) {
  const colors = {
    violet: 'from-violet-400 to-purple-500',
    green:  'from-green-400 to-emerald-500',
    amber:  'from-amber-400 to-yellow-500',
    red:    'from-red-400 to-rose-500',
    blue:   'from-blue-400 to-cyan-500',
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] font-bold text-gray-700">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${colors[color]} rounded-full transition-all duration-700`}
          style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ── Priority badge ────────────────────────────────────────────
function PriorityBadge({ score }) {
  if (score >= 220) return <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">🔥 TOP PRIORITY</span>;
  if (score >= 180) return <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full">⚡ HIGH</span>;
  if (score >= 130) return <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">· MEDIUM</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">· LOW</span>;
}

// ── Main Card ─────────────────────────────────────────────────
export default function AIHypothesisCard({ hypothesis: h, onStatusChange, onOpenDetail }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = statusConfig[h.status] || statusConfig.New;
  const typeCfg   = typeConfig[h.hypothesis_type] || typeConfig.content;
  const StatusIcon = statusCfg.icon;
  const TypeIcon   = typeCfg.icon;

  const priorityScore = h.priority_score ?? (
    (h.impact_score || 0) + (h.urgency_score || 0) + (h.confidence_score || 0) - (h.difficulty_score || 0)
  );
  const confidence = h.confidenceScore || h.confidence_score || 0;

  return (
    <div className="bg-white rounded-2xl border border-purple-50 shadow-card overflow-hidden hover:shadow-soft transition-all duration-200 flex flex-col">
      {/* Top color stripe by type */}
      <div className={`h-1 w-full ${
        h.hypothesis_type === 'growth'     ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
        h.hypothesis_type === 'engagement' ? 'bg-gradient-to-r from-blue-400 to-cyan-500'    :
        h.hypothesis_type === 'competitor' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
        h.hypothesis_type === 'experiment' ? 'bg-gradient-to-r from-rose-400 to-pink-500'    :
        'bg-gradient-to-r from-violet-500 to-purple-400'
      }`} />

      {/* Header */}
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${typeCfg.color}`}>
              <TypeIcon size={10} /> {typeCfg.label}
            </span>
            <PriorityBadge score={priorityScore} />
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusCfg.color}`}>
            <StatusIcon size={10} /> {statusCfg.label}
          </span>
        </div>

        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-100 to-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <Brain size={16} className="text-violet-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 leading-snug">{h.title}</h3>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {(h.platform || []).map(p => <PlatformBadge key={p} platform={p} />)}
          {h.experiment_duration && (
            <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
              {h.experiment_duration} hari
            </span>
          )}
          {h.risk_level && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${riskColor[h.risk_level] || riskColor.Low}`}>
              Risiko {h.risk_level}
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-3">
          {h.summary || h.insight}
        </p>

        {/* Scores */}
        <div className="space-y-2">
          <ScoreBar label="Confidence" value={confidence} color={confidence >= 85 ? 'green' : confidence >= 70 ? 'amber' : 'red'} />
          {h.impact_score > 0 && <ScoreBar label="Impact" value={h.impact_score} color="violet" />}
          {h.urgency_score > 0 && <ScoreBar label="Urgency" value={h.urgency_score} color="blue" />}
          {h.difficulty_score > 0 && <ScoreBar label="Difficulty" value={h.difficulty_score} color="red" />}
        </div>
      </div>

      {/* Expand toggle + quick actions */}
      <div className="border-t border-purple-50">
        <div className="flex">
          <button onClick={() => setExpanded(!expanded)}
            className="flex-1 px-4 py-2.5 bg-lavender-50 flex items-center justify-center gap-1.5 text-xs font-medium text-violet-600 hover:bg-lavender-100 transition-colors">
            {expanded ? <><ChevronUp size={13} /> Sembunyikan</> : <><ChevronDown size={13} /> Detail & Action Plan</>}
          </button>
          {onOpenDetail && (
            <button onClick={() => onOpenDetail(h)}
              className="px-4 py-2.5 bg-lavender-50 border-l border-purple-50 flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-violet-600 hover:bg-lavender-100 transition-colors">
              <ExternalLink size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-purple-50 p-5 space-y-4 bg-white">

          {/* Pattern detected */}
          {h.pattern_detected && (
            <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl">
              <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Target size={10} /> Pattern Detected
              </p>
              <p className="text-xs text-violet-700 leading-relaxed">{h.pattern_detected}</p>
            </div>
          )}

          {/* Evidence */}
          {(h.data_evidence || h.evidence || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <BarChart2 size={13} className="text-violet-500" /> Bukti Data
              </p>
              <ul className="space-y-1.5">
                {(h.data_evidence || h.evidence).map((ev, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                    {ev}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Strategic meaning */}
          {h.strategic_meaning && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Lightbulb size={10} /> Makna Strategis
              </p>
              <p className="text-xs text-blue-700 leading-relaxed">{h.strategic_meaning}</p>
            </div>
          )}

          {/* Experiment */}
          {(h.suggested_experiment || h.suggestedExperiment) && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                  <FlaskConical size={10} /> Saran Eksperimen
                </p>
                {h.experiment_duration && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                    {h.experiment_duration} hari
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">{h.suggested_experiment || h.suggestedExperiment}</p>
            </div>
          )}

          {/* Success metrics */}
          {(h.success_metrics || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-green-500" /> Success Metrics
              </p>
              <ul className="space-y-1">
                {h.success_metrics.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle2 size={11} className="text-green-400 flex-shrink-0 mt-0.5" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Predicted impact */}
          {(h.predicted_impact || h.expectedImpact || h.expected_impact) && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                <TrendingUp size={10} /> Predicted Impact
              </p>
              <p className="text-xs text-green-700 leading-relaxed">
                {h.predicted_impact || h.expectedImpact || h.expected_impact}
              </p>
            </div>
          )}

          {/* Action plan */}
          {(h.action_plan || h.actionPlan || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Action Plan</p>
              <ol className="space-y-2">
                {(h.action_plan || h.actionPlan).map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-400 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Content recommendations */}
          {(h.content_recommendations || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-violet-400" /> Content Recommendations
              </p>
              <ul className="space-y-1.5">
                {h.content_recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-lavender-50 rounded-lg p-2">
                    <Sparkles size={11} className="text-violet-400 flex-shrink-0 mt-0.5" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk */}
          {h.risk_level && h.risk_level !== 'Low' && (
            <div className={`p-3 rounded-xl border flex items-start gap-2 ${riskColor[h.risk_level]}`}>
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5">Risiko: {h.risk_level}</p>
                <p className="text-xs">Pantau metrik setiap 3 hari selama eksperimen berlangsung.</p>
              </div>
            </div>
          )}

          {/* Status actions */}
          {onStatusChange && (
            <div className="pt-2 border-t border-purple-50">
              <p className="text-[10px] text-gray-400 mb-2">Ubah status hipotesa:</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(statusConfig).map(([key, cfg]) => {
                  const Ic = cfg.icon;
                  return (
                    <button key={key} onClick={() => onStatusChange(h.id, key)}
                      disabled={h.status === key}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all
                        ${h.status === key ? `${cfg.color}` : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-violet-200 hover:text-violet-600'}`}>
                      <Ic size={10} /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
