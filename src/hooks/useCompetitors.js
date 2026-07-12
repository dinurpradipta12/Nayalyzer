import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { competitors as mockCompetitors } from '../data/mockData';

export function useCompetitors(workspaceId) {
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const fetch = useCallback(async () => {
    if (!workspaceId || workspaceId === 'demo-ws' || !SUPABASE_ENABLED) {
      setCompetitors(mockCompetitors);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('competitors')
        .select(`*, competitor_metrics(followers, average_engagement_rate, posting_frequency, top_content_type, metric_date)`)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!data?.length) {
        setCompetitors(mockCompetitors);
      } else {
        const mapped = data.map(c => {
          const latest = c.competitor_metrics?.sort((a, b) =>
            new Date(b.metric_date) - new Date(a.metric_date)
          )[0] || {};
          return {
            id: c.id,
            name: c.name,
            platform: c.platform,
            username: c.username,
            followers: latest.followers || 0,
            followerGrowth: 0,
            postingFrequency: `${latest.posting_frequency || 0}x/minggu`,
            avgEngagement: latest.average_likes || 0,
            engagementRate: latest.average_engagement_rate || 0,
            topContentType: latest.top_content_type || '-',
            strength: c.strength || '',
            weakness: c.weakness || '',
            opportunity: c.opportunity || '',
          };
        });
        setCompetitors(mapped);
      }
    } catch (e) {
      setError(e.message);
      setCompetitors(mockCompetitors);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addCompetitor = async (payload) => {
    if (!SUPABASE_ENABLED) {
      const newComp = { id: Date.now(), ...payload };
      setCompetitors(p => [...p, newComp]);
      return { data: newComp };
    }
    const { data, error } = await supabase
      .from('competitors')
      .insert({ ...payload, workspace_id: workspaceId })
      .select()
      .single();
    if (!error) await fetch();
    return { data, error };
  };

  const removeCompetitor = async (id) => {
    if (!SUPABASE_ENABLED) {
      setCompetitors(p => p.filter(c => c.id !== id));
      return {};
    }
    const { error } = await supabase.from('competitors').delete().eq('id', id);
    if (!error) await fetch();
    return { error };
  };

  return { competitors, loading, error, reload: fetch, addCompetitor, removeCompetitor };
}
