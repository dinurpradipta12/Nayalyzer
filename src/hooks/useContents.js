import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { contentData } from '../data/mockData';
import { withTimeout } from '../lib/async';

export function useContents(workspaceId) {
  const [contents, setContents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const fetch = useCallback(async () => {
    if (!workspaceId || workspaceId === 'demo-ws' || !SUPABASE_ENABLED) {
      setContents(contentData);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await withTimeout(supabase
        .from('contents')
        .select(`
          *,
          content_metrics (
            views, reach, likes, comments, shares, saves, engagement_rate,
            performance_score, performance_status, ai_note, metric_date
          )
        `)
        .eq('workspace_id', workspaceId)
        .order('published_at', { ascending: false }), 7000, 'Contents request timeout');

      if (error) throw error;

      if (!data?.length) {
        setContents(contentData);
      } else {
        // Flatten: take most recent metric per content
        const flat = data.map(c => {
          const latestMetric = c.content_metrics?.sort((a, b) =>
            new Date(b.metric_date) - new Date(a.metric_date)
          )[0] || {};
          return {
            id: c.id,
            date: c.published_at?.split('T')[0] || c.created_at?.split('T')[0],
            platform: c.platform,
            title: c.title || c.caption?.substring(0, 60) || 'Untitled',
            format: c.content_type,
            pillar: c.content_pillar,
            reach: latestMetric.reach || 0,
            views: latestMetric.views || 0,
            likes: latestMetric.likes || 0,
            comments: latestMetric.comments || 0,
            shares: latestMetric.shares || 0,
            saves: latestMetric.saves || 0,
            engagementRate: latestMetric.engagement_rate || 0,
            performanceScore: latestMetric.performance_score || 0,
            status: latestMetric.performance_status || 'Stable',
            aiNote: latestMetric.ai_note || '',
          };
        });
        setContents(flat);
      }
    } catch (e) {
      setError(e.message);
      setContents(contentData);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addContent = async (payload) => {
    if (!SUPABASE_ENABLED) return { data: payload };
    const { data, error } = await supabase.from('contents').insert(payload).select().single();
    if (!error) await fetch();
    return { data, error };
  };

  const deleteContent = async (id) => {
    if (!SUPABASE_ENABLED) {
      setContents(p => p.filter(c => c.id !== id));
      return {};
    }
    const { error } = await supabase.from('contents').delete().eq('id', id);
    if (!error) await fetch();
    return { error };
  };

  return { contents, loading, error, reload: fetch, addContent, deleteContent };
}
