import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';

const CACHE_TTL_MS   = 6 * 60 * 60 * 1000; // 6 jam — ketika cache kadaluarsa, sync lagi
const STALE_SYNC_MS  = 60 * 60 * 1000;      // sync jika data > 1 jam dari server

function cacheKey(wsId) { return `naya_social_${wsId}`; }

function readCache(wsId) {
  try {
    const raw = localStorage.getItem(cacheKey(wsId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null; // expired
    return parsed;
  } catch { return null; }
}

function writeCache(wsId, data) {
  try {
    localStorage.setItem(cacheKey(wsId), JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {}
}

async function triggerSync(connectionId, workspaceId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ connection_id: connectionId, workspace_id: workspaceId, sync_type: 'full' }),
      }
    );
    return res.ok ? res.json() : null;
  } catch (e) {
    console.warn('sync error:', e.message);
    return null;
  }
}

async function fetchFromDB(workspaceId) {
  // Load connections
  const { data: conns } = await supabase
    .from('platform_connections')
    .select('id, platform, provider_username, connection_status, last_synced_at')
    .eq('workspace_id', workspaceId)
    .eq('connection_status', 'connected');

  // Load social_accounts
  const { data: socialAccts } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('workspace_id', workspaceId);

  const accounts = {};
  for (const a of (socialAccts || [])) {
    accounts[a.platform.toLowerCase()] = a;
  }

  // Load 90-day account_metrics
  const since = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const { data: metricRows } = await supabase
    .from('account_metrics')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('metric_date', since)
    .order('metric_date', { ascending: true });

  const metricByPlatform = {};
  for (const a of (socialAccts || [])) {
    const rows = (metricRows || []).filter(r => r.social_account_id === a.id);
    if (rows.length) metricByPlatform[a.platform.toLowerCase()] = rows;
  }

  // Load contents + latest metrics
  const { data: contentRows } = await supabase
    .from('contents')
    .select(`
      id, platform, content_type, caption, content_url, thumbnail_url, published_at,
      content_metrics (
        likes, comments, shares, views, saves, reach, impressions, avg_watch_time, engagement_rate, engagement_count, metric_date
      )
    `)
    .eq('workspace_id', workspaceId)
    .order('published_at', { ascending: false })
    .limit(100);

  return {
    connections: conns || [],
    accounts,
    metrics: metricByPlatform,
    contents: contentRows || [],
  };
}

export function useSocialData(workspaceId) {
  const [data, setData]         = useState(null);   // null = belum ada cache
  const [syncing, setSyncing]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const syncingRef              = useRef(false);

  const loadAndSync = useCallback(async (forceSync = false) => {
    if (!SUPABASE_ENABLED || !workspaceId) { setLoading(false); return; }

    // 1. Tampilkan cache dulu (kalau ada) — langsung, tanpa tunggu network
    const cached = readCache(workspaceId);
    if (cached) {
      setData(cached);
      setLoading(false);
    }

    // 2. Cek apakah perlu sync (background)
    if (syncingRef.current) return;

    // Load connections untuk cek last_synced_at
    const { data: conns } = await supabase
      .from('platform_connections')
      .select('id, platform, last_synced_at, connection_status')
      .eq('workspace_id', workspaceId)
      .eq('connection_status', 'connected');

    const staleConns = (conns || []).filter(c => {
      if (forceSync) return true;
      if (!c.last_synced_at) return true;
      return (Date.now() - new Date(c.last_synced_at).getTime()) > STALE_SYNC_MS;
    });

    if (staleConns.length > 0) {
      syncingRef.current = true;
      setSyncing(true);
      // Sync semua stale connections secara paralel (background)
      await Promise.all(staleConns.map(c => triggerSync(c.id, workspaceId)));
      syncingRef.current = false;
      setSyncing(false);
    }

    // 3. Ambil data fresh dari DB (setelah sync atau kalau cache tidak ada)
    const fresh = await fetchFromDB(workspaceId);
    setData(fresh);
    setLoading(false);
    writeCache(workspaceId, fresh); // simpan ke cache
  }, [workspaceId]);

  useEffect(() => { loadAndSync(); }, [loadAndSync]);

  const reload = useCallback(() => loadAndSync(true), [loadAndSync]);

  return {
    connections: data?.connections ?? [],
    accounts:    data?.accounts    ?? {},
    metrics:     data?.metrics     ?? {},
    contents:    data?.contents    ?? [],
    syncing,
    loading: loading && !data,   // true hanya jika belum ada cache sama sekali
    reload,
  };
}

// ── Helpers ────────────────────────────────────────────────
export function buildMonthlyTrend(metrics, platformKey) {
  const rows = metrics[platformKey] ?? [];
  if (!rows.length) return null;
  const byMonth = {};
  rows.forEach(r => {
    const month = r.metric_date?.slice(0, 7);
    if (!month) return;
    if (!byMonth[month]) byMonth[month] = { followers: 0, reach: 0, er: [] };
    if (r.followers) byMonth[month].followers = Math.max(byMonth[month].followers, r.followers);
    if (r.reach) byMonth[month].reach += r.reach;
    if (r.engagement_rate) byMonth[month].er.push(r.engagement_rate);
  });
  return Object.entries(byMonth).map(([m, v]) => ({
    month: new Date(m + '-01').toLocaleString('id-ID', { month: 'short' }),
    followers: v.followers,
    reach: v.reach,
    er: v.er.length ? +(v.er.reduce((a, b) => a + b, 0) / v.er.length).toFixed(2) : null,
  }));
}
