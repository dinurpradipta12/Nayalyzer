import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { generateFallbackHypotheses } from '../lib/aiHypothesisEngine';
import { withTimeout } from '../lib/async';

function mapDbRow(h) {
  return {
    id:                      h.id,
    title:                   h.title,
    hypothesis_type:         h.hypothesis_type || 'content',
    platform:                h.platforms || [],
    insight:                 h.summary,
    summary:                 h.summary,
    pattern_detected:        h.pattern_detected,
    evidence:                Array.isArray(h.data_evidence) ? h.data_evidence : [],
    data_evidence:           Array.isArray(h.data_evidence) ? h.data_evidence : [],
    confidenceScore:         h.confidence_score || 0,
    confidence_score:        h.confidence_score || 0,
    strategic_meaning:       h.strategic_meaning,
    suggestedExperiment:     h.suggested_experiment,
    suggested_experiment:    h.suggested_experiment,
    experiment_duration:     h.experiment_duration || 14,
    success_metrics:         Array.isArray(h.success_metrics) ? h.success_metrics : [],
    predicted_impact:        h.predicted_impact,
    expectedImpact:          h.expected_impact,
    expected_impact:         h.expected_impact,
    risk_level:              h.risk_level || 'Low',
    impact_score:            h.impact_score || 0,
    urgency_score:           h.urgency_score || 0,
    difficulty_score:        h.difficulty_score || 0,
    priority_score:          h.priority_score ?? (
      (h.impact_score || 0) + (h.urgency_score || 0) + (h.confidence_score || 0) - (h.difficulty_score || 0)
    ),
    actionPlan:              Array.isArray(h.action_plan) ? h.action_plan : [],
    action_plan:             Array.isArray(h.action_plan) ? h.action_plan : [],
    content_recommendations: Array.isArray(h.content_recommendations) ? h.content_recommendations : [],
    status:                  h.status,
    createdAt:               h.created_at?.split('T')[0],
    created_at:              h.created_at,
  };
}

export function useHypotheses(workspaceId) {
  const [hypotheses, setHypotheses] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const fetch = useCallback(async () => {
    if (!workspaceId || workspaceId === 'demo-ws' || !SUPABASE_ENABLED) {
      setHypotheses(generateFallbackHypotheses());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await withTimeout(supabase
        .from('ai_hypotheses')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('priority_score', { ascending: false, nullsFirst: false }), 7000, 'Hypotheses request timeout');

      if (err) throw err;
      setHypotheses(data?.length ? data.map(mapDbRow) : generateFallbackHypotheses());
    } catch (e) {
      setError(e.message);
      setHypotheses(generateFallbackHypotheses());
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateStatus = async (id, status) => {
    setHypotheses(p => p.map(h => h.id === id ? { ...h, status } : h));
    if (!SUPABASE_ENABLED || workspaceId === 'demo-ws') return {};
    const { error: err } = await supabase
      .from('ai_hypotheses')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) { await fetch(); return { error: err }; }
    return {};
  };

  const addHypotheses = async (rows) => {
    if (!SUPABASE_ENABLED || workspaceId === 'demo-ws') {
      const mapped = rows.map(h => ({ ...mapDbRow({ ...h, id: `demo-${Date.now()}-${Math.random()}` }), status: 'New' }));
      setHypotheses(p => [...mapped, ...p]);
      return { data: mapped };
    }
    const { data, error: err } = await supabase
      .from('ai_hypotheses')
      .insert(rows.map(h => ({ workspace_id: workspaceId, ...h })))
      .select();
    if (!err) await fetch();
    return { data, error: err };
  };

  const deleteHypothesis = async (id) => {
    setHypotheses(p => p.filter(h => h.id !== id));
    if (!SUPABASE_ENABLED || workspaceId === 'demo-ws') return {};
    const { error: err } = await supabase.from('ai_hypotheses').delete().eq('id', id);
    return { error: err };
  };

  return { hypotheses, loading, error, reload: fetch, updateStatus, addHypotheses, deleteHypothesis };
}
