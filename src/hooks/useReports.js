import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { reportData } from '../data/mockData';
import { withTimeout } from '../lib/async';

export function useReports(workspaceId) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!workspaceId || workspaceId === 'demo-ws' || !SUPABASE_ENABLED) {
      // Wrap mock reportData in an array so the page can iterate
      setReports([{ id: 'demo-report', ...reportData }]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await withTimeout(supabase
        .from('reports')
        .select('*, profiles(full_name)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }), 7000, 'Reports request timeout');
      if (error) throw error;
      setReports(data?.length ? data : [{ id: 'demo-report', ...reportData }]);
    } catch (e) {
      setError(e.message);
      setReports([{ id: 'demo-report', ...reportData }]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createReport = async (payload) => {
    if (!SUPABASE_ENABLED) return { data: payload };
    const { data, error } = await supabase
      .from('reports')
      .insert({ workspace_id: workspaceId, ...payload })
      .select()
      .single();
    if (!error) await fetch();
    return { data, error };
  };

  return { reports, loading, error, reload: fetch, createReport };
}
