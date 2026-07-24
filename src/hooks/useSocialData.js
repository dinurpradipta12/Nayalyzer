import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { withTimeout } from '../lib/async';

const CACHE_TTL_MS   = 6 * 60 * 60 * 1000; // 6 jam — ketika cache kadaluarsa, sync lagi
const STALE_SYNC_MS  = 60 * 60 * 1000;      // sync jika data > 1 jam dari server
const CACHE_VERSION  = 3;

function cacheKey(wsId) { return `naya_social_${wsId}`; }

function readCache(wsId) {
  try {
    const raw = localStorage.getItem(cacheKey(wsId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CACHE_VERSION) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null; // expired
    return parsed;
  } catch { return null; }
}

function writeCache(wsId, data) {
  try {
    localStorage.setItem(cacheKey(wsId), JSON.stringify({ ...data, version: CACHE_VERSION, savedAt: Date.now() }));
  } catch {}
}

export function clearSocialDataCache(wsId) {
  try {
    if (wsId) localStorage.removeItem(cacheKey(wsId));
  } catch {}
}

async function triggerSync(connectionId, workspaceId) {
  try {
    const { data: { session } } = await withTimeout(supabase.auth.getSession(), 5000, 'Sync session timeout');
    const token = session?.access_token;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-sync`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ connection_id: connectionId, workspace_id: workspaceId, sync_type: 'full' }),
      }
    );
    window.clearTimeout(timeoutId);
    return res.ok ? res.json() : null;
  } catch (e) {
    console.warn('sync error:', e.message);
    return null;
  }
}

async function fetchFromDB(workspaceId) {
  const since = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

  const [connResult, accountResult, metricResult, contentResult] = await withTimeout(Promise.all([
    supabase
    .from('platform_connections')
    .select('id, platform, social_account_id, provider_username, connection_status, last_synced_at')
    .eq('workspace_id', workspaceId)
      .eq('connection_status', 'connected'),
    supabase
    .from('social_accounts')
    .select('*')
      .eq('workspace_id', workspaceId),
    supabase
      .from('account_metrics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('metric_date', since)
      .order('metric_date', { ascending: true }),
    supabase
      .from('contents')
      .select(`
        id, platform, content_type, caption, content_url, thumbnail_url, published_at,
        social_account_id,
        content_metrics (
          likes, comments, shares, views, saves, reach, impressions, avg_watch_time, engagement_rate, engagement_count, metric_date
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('published_at', { ascending: false })
      .limit(100),
  ]), 7000, 'Social data request timeout');

  const conns = connResult.data || [];
  const accountRows = accountResult.data || [];
  const accountById = new Map(accountRows.map(account => [account.id, account]));
  const socialAccts = conns
    .map(conn => {
      if (conn.social_account_id && accountById.has(conn.social_account_id)) {
        return accountById.get(conn.social_account_id);
      }

      const providerUsername = conn.provider_username?.replace(/^@/, '').toLowerCase();
      return accountRows.find(account => {
        const accountUsername = account.username?.replace(/^@/, '').toLowerCase();
        return account.platform === conn.platform
          && account.connection_status === 'connected'
          && providerUsername
          && accountUsername === providerUsername;
      });
    })
    .filter(Boolean);
  const connectedAccountIds = new Set(socialAccts.map(account => account.id).filter(Boolean));
  const metricRows = metricResult.data || [];
  const contentRows = (contentResult.data || []).filter(content => {
    return content.social_account_id && connectedAccountIds.has(content.social_account_id);
  });

  const accounts = {};
  for (const a of socialAccts) {
    accounts[a.platform.toLowerCase()] = a;
  }

  const metricByPlatform = {};
  for (const a of socialAccts) {
    const rows = metricRows.filter(r => r.social_account_id === a.id);
    if (rows.length) metricByPlatform[a.platform.toLowerCase()] = rows;
  }

  return {
    connections: conns,
    accounts,
    metrics: metricByPlatform,
    contents: contentRows,
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

    try {
      // 2. Ambil data fresh dulu. Sync platform tidak boleh memblokir render awal.
      const fresh = await fetchFromDB(workspaceId);
      setData(fresh);
      setLoading(false);
      writeCache(workspaceId, fresh);

      if (syncingRef.current) return;
      const staleConns = fresh.connections.filter(c => {
        if (forceSync) return true;
        if (!c.last_synced_at) return true;
        return (Date.now() - new Date(c.last_synced_at).getTime()) > STALE_SYNC_MS;
      });

      if (staleConns.length > 0) {
        syncingRef.current = true;
        setSyncing(true);
        Promise.all(staleConns.map(c => triggerSync(c.id, workspaceId)))
          .then(() => fetchFromDB(workspaceId))
          .then((synced) => {
            setData(synced);
            writeCache(workspaceId, synced);
          })
          .catch((e) => console.warn('background sync:', e.message))
          .finally(() => {
            syncingRef.current = false;
            setSyncing(false);
          });
      }
    } catch (e) {
      console.warn('load social data:', e.message);
      setLoading(false);
    }
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
