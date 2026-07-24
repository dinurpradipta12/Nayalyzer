// ============================================================
// Platform Integration — client-side helper
// All actual API calls go through Supabase Edge Functions.
// Frontend only initiates OAuth popup and polls for result.
// ============================================================

import { supabase, SUPABASE_ENABLED } from './supabase';

const FUNCTION_BASE = SUPABASE_ENABLED
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : null;

let activeOAuthPopup = null;

// ── OAuth popup flow ──────────────────────────────────────────
export async function initiateOAuth(platform, workspaceId) {
  if (!SUPABASE_ENABLED) {
    return { error: 'not_configured', fallback: 'manual_import' };
  }

  // Ask Edge Function for the auth URL
  const res = await fetch(
    `${FUNCTION_BASE}/platform-oauth?action=initiate&platform=${platform}&workspace_id=${workspaceId}`,
    { headers: await authHeaders() },
  );
  const data = await res.json();

  if (data.error === 'not_configured') return { error: 'not_configured', message: data.message };
  if (data.error) return { error: data.error };

  // Open popup
  return new Promise((resolve) => {
    try {
      if (activeOAuthPopup && !activeOAuthPopup.closed) activeOAuthPopup.close();
    } catch {}

    const popup = window.open(data.auth_url, `oauth_${platform}`, 'width=600,height=700,scrollbars=yes');
    if (!popup) { resolve({ error: 'Popup diblokir browser. Izinkan popup untuk halaman ini.' }); return; }
    activeOAuthPopup = popup;
    popup.focus?.();

    // Poll for popup close or URL change
    const timer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          resolve({ cancelled: true });
        } else if (popup.location.href.includes('/connected-accounts')) {
          const url = new URL(popup.location.href);
          popup.close();
          clearInterval(timer);
          const connected = url.searchParams.get('connected');
          const error     = url.searchParams.get('error');
          if (connected) resolve({ success: true, platform: connected });
          else resolve({ error: error || 'Unknown error' });
        }
      } catch { /* cross-origin frame — still loading */ }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(timer);
      try {
        if (!popup.closed) popup.close();
      } catch {}
      resolve({ error: 'timeout' });
    }, 300000);
  });
}

// ── Trigger sync ──────────────────────────────────────────────
export async function triggerSync(connectionId, workspaceId, syncType = 'full') {
  if (!SUPABASE_ENABLED) {
    // Demo: simulate
    await delay(1500);
    return { success: true, inserted: 12, updated: 3, failed: 0, status: 'completed' };
  }

  const res = await fetch(`${FUNCTION_BASE}/platform-sync`, {
    method:  'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body:    JSON.stringify({ connection_id: connectionId, workspace_id: workspaceId, sync_type: syncType }),
  });
  return res.json();
}

// ── Disconnect ────────────────────────────────────────────────
export async function disconnectPlatform(connectionId) {
  if (!SUPABASE_ENABLED) {
    await delay(600);
    return { success: true };
  }
  const res = await fetch(`${FUNCTION_BASE}/platform-oauth?action=disconnect`, {
    method:  'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body:    JSON.stringify({ connection_id: connectionId }),
  });
  return res.json();
}

// ── Refresh token ─────────────────────────────────────────────
export async function refreshToken(connectionId) {
  if (!SUPABASE_ENABLED) return { success: true };
  const res = await fetch(`${FUNCTION_BASE}/platform-oauth?action=refresh`, {
    method:  'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body:    JSON.stringify({ connection_id: connectionId }),
  });
  return res.json();
}

// ── Load connections from DB ──────────────────────────────────
export async function loadConnections(workspaceId) {
  if (!SUPABASE_ENABLED || workspaceId === 'demo-ws') return DEMO_CONNECTIONS;

  const { data, error } = await supabase
    .from('platform_connections')
    .select('*, social_accounts(username, account_name, followers_count)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) { console.error('[loadConnections]', error); return []; }
  return data ?? [];
}

// ── Load sync history ─────────────────────────────────────────
export async function loadSyncHistory(workspaceId, limit = 20) {
  if (!SUPABASE_ENABLED || workspaceId === 'demo-ws') return DEMO_SYNC_HISTORY;

  const { data } = await supabase.rpc('get_sync_history', { p_workspace_id: workspaceId, p_limit: limit });
  return data ?? [];
}

// ── Helpers ───────────────────────────────────────────────────
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }
    : { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Demo data ─────────────────────────────────────────────────
export const PLATFORM_CONFIG = {
  Instagram: {
    color:       'from-pink-500 to-orange-400',
    bg:          'bg-pink-50',
    border:      'border-pink-100',
    textColor:   'text-pink-600',
    icon:        'instagram',
    apiMode:     'oauth',
    scopesNeeded: ['instagram_business_basic','instagram_business_insights','instagram_business_content_publish'],
    limitations: [
      'Hanya akun Business/Creator yang bisa mengakses Insights API',
      'Rate limit: 200 calls/hour per token',
      'Media insights tersedia 14+ hari setelah publish',
      'Akun Personal tidak mendukung Insights API',
    ],
    setupUrl:    'https://developers.facebook.com/docs/instagram-api',
    requiresApp: 'Meta for Developers App',
  },
  TikTok: {
    color:       'from-gray-800 to-gray-600',
    bg:          'bg-gray-50',
    border:      'border-gray-200',
    textColor:   'text-gray-700',
    icon:        'tiktok',
    apiMode:     'oauth',
    scopesNeeded: ['user.info.basic','video.list'],
    limitations: [
      'Analytics API hanya untuk akun yang approved sebagai Research partner',
      'Display API hanya akses basic (no analytics)',
      'Rate limit: 100 req/day untuk Display API',
      'Video insights detail tidak tersedia via Display API — gunakan manual import',
    ],
    setupUrl:    'https://developers.tiktok.com',
    requiresApp: 'TikTok for Developers App',
  },
  Threads: {
    color:       'from-gray-900 to-gray-700',
    bg:          'bg-gray-50',
    border:      'border-gray-200',
    textColor:   'text-gray-800',
    icon:        'threads',
    apiMode:     'oauth',
    scopesNeeded: ['threads_basic','threads_manage_insights','threads_manage_replies'],
    limitations: [
      'Threads API masih dalam fase beta (per 2024)',
      'Insights granularity terbatas dibanding Instagram',
      'Perlu Meta App yang sama dengan Instagram',
      'Rate limit: 100 calls/hour per user token',
    ],
    setupUrl:    'https://developers.facebook.com/docs/threads',
    requiresApp: 'Meta for Developers App (sama dengan Instagram)',
  },
};

const DEMO_CONNECTIONS = [
  {
    id: 'demo-conn-ig',
    platform: 'Instagram',
    provider_username: '@nayacreative.id',
    connection_status: 'connected',
    connection_mode: 'oauth',
    scopes: ['instagram_business_basic','instagram_business_insights'],
    last_synced_at: new Date(Date.now() - 3600000).toISOString(),
    next_sync_at: new Date(Date.now() + 82800000).toISOString(),
    token_expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
    social_accounts: { username: '@nayacreative.id', followers_count: 48700 },
  },
  {
    id: 'demo-conn-tt',
    platform: 'TikTok',
    provider_username: '@nayacreative',
    connection_status: 'connected',
    connection_mode: 'manual',
    scopes: [],
    last_synced_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    next_sync_at: null,
    token_expires_at: null,
    social_accounts: { username: '@nayacreative', followers_count: 92400 },
  },
  {
    id: 'demo-conn-th',
    platform: 'Threads',
    provider_username: '@nayacreative.id',
    connection_status: 'disconnected',
    connection_mode: 'oauth',
    scopes: [],
    last_synced_at: null,
    next_sync_at: null,
    token_expires_at: null,
    social_accounts: null,
  },
];

const DEMO_SYNC_HISTORY = [
  { id: 'sj1', platform: 'Instagram', sync_type: 'full',        status: 'completed', started_at: new Date(Date.now()-3600000).toISOString(), completed_at: new Date(Date.now()-3550000).toISOString(), records_inserted: 8,  records_updated: 14, records_failed: 0, created_at: new Date(Date.now()-3600000).toISOString() },
  { id: 'sj2', platform: 'TikTok',    sync_type: 'media',       status: 'partial',   started_at: new Date(Date.now()-172800000).toISOString(), completed_at: new Date(Date.now()-172750000).toISOString(), records_inserted: 5, records_updated: 0, records_failed: 2, error_message: 'Analytics API not available for this account type', created_at: new Date(Date.now()-172800000).toISOString() },
  { id: 'sj3', platform: 'Instagram', sync_type: 'insights',    status: 'completed', started_at: new Date(Date.now()-259200000).toISOString(), completed_at: new Date(Date.now()-259150000).toISOString(), records_inserted: 30, records_updated: 0, records_failed: 0, created_at: new Date(Date.now()-259200000).toISOString() },
  { id: 'sj4', platform: 'Threads',   sync_type: 'full',        status: 'failed',    started_at: new Date(Date.now()-432000000).toISOString(), completed_at: new Date(Date.now()-431990000).toISOString(), records_inserted: 0, records_updated: 0, records_failed: 0, error_message: 'Connection expired — please reconnect', created_at: new Date(Date.now()-432000000).toISOString() },
];
