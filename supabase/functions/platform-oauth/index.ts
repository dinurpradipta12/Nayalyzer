// ============================================================
// Supabase Edge Function: platform-oauth
// Handles OAuth initiation + callback for Instagram, Threads, TikTok
//
// Routes (via ?action= query param):
//   GET  ?action=initiate&platform=Instagram&workspace_id=xxx  → redirect URL
//   GET  ?action=callback&platform=Instagram&code=xxx&state=xxx → save token + redirect
//   POST ?action=refresh&connection_id=xxx                      → refresh token
//   POST ?action=disconnect&connection_id=xxx                   → revoke + delete
//
// Required secrets (supabase secrets set ...):
//   ENCRYPTION_KEY            — 32-byte hex key for AES-256-GCM
//   APP_URL                   — e.g. https://nayalyzer.com
//   IG_APP_ID, IG_APP_SECRET  — Meta App credentials
//   TK_CLIENT_KEY, TK_CLIENT_SECRET — TikTok App credentials
//   THREADS_APP_ID, THREADS_APP_SECRET — Threads App credentials (same Meta App usually)
// ============================================================

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Env ───────────────────────────────────────────────────────
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY    = Deno.env.get('ENCRYPTION_KEY') ?? '';      // 64-char hex = 32 bytes
const APP_URL           = Deno.env.get('APP_URL') ?? 'http://localhost:5173';

const IG_APP_ID         = Deno.env.get('IG_APP_ID') ?? '';
const IG_APP_SECRET     = Deno.env.get('IG_APP_SECRET') ?? '';
const TK_CLIENT_KEY     = Deno.env.get('TK_CLIENT_KEY') ?? '';
const TK_CLIENT_SECRET  = Deno.env.get('TK_CLIENT_SECRET') ?? '';
const THREADS_APP_ID    = Deno.env.get('THREADS_APP_ID') ?? '';
const THREADS_APP_SECRET = Deno.env.get('THREADS_APP_SECRET') ?? '';

const FUNCTION_URL    = `${SUPABASE_URL}/functions/v1/platform-oauth`;
const CALLBACK_URI    = 'https://cmgtaytmmwgdglmwdxrv.supabase.co/functions/v1/platform-oauth/callback';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── AES-256-GCM encryption ────────────────────────────────────
async function importKey(): Promise<CryptoKey> {
  const raw = new Uint8Array(ENCRYPTION_KEY.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(text: string): Promise<string> {
  if (!ENCRYPTION_KEY) return `plain:${text}`;  // dev fallback
  const key = await importKey();
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  const ivHex  = [...iv].map(b => b.toString(16).padStart(2,'0')).join('');
  const encHex = [...new Uint8Array(enc)].map(b => b.toString(16).padStart(2,'0')).join('');
  return `${ivHex}:${encHex}`;
}

async function decrypt(stored: string): Promise<string> {
  if (stored.startsWith('plain:')) return stored.slice(6);
  if (!ENCRYPTION_KEY) throw new Error('No encryption key');
  const [ivHex, encHex] = stored.split(':');
  const iv  = new Uint8Array(ivHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const enc = new Uint8Array(encHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const key = await importKey();
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, enc);
  return new TextDecoder().decode(dec);
}

// ── OAuth URL builders ────────────────────────────────────────
function buildInstagramOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     IG_APP_ID,
    redirect_uri:  CALLBACK_URI,
    scope:         'instagram_business_basic,instagram_business_content_publish',
    response_type: 'code',
    state,
    enable_fb_login: '0',
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

function oauthCompleteUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `${APP_URL}/oauth-complete?${search}`;
}

function buildThreadsOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     THREADS_APP_ID,
    redirect_uri:  CALLBACK_URI,
    scope:         'threads_basic,threads_manage_insights',
    response_type: 'code',
    state,
  });
  return `https://threads.net/oauth/authorize?${params}`;
}

function buildTikTokOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_key:    TK_CLIENT_KEY,
    redirect_uri:  CALLBACK_URI,
    scope:         'user.info.basic,video.list,video.upload',
    response_type: 'code',
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize?${params}`;
}

// ── Token exchange ────────────────────────────────────────────
interface TokenResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scopes?: string[];
}

async function exchangeInstagramCode(code: string): Promise<TokenResult> {
  const body = new URLSearchParams({
    client_id: IG_APP_ID, client_secret: IG_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: CALLBACK_URI,
    code,
  });
  console.log('[IG token exchange] redirect_uri:', CALLBACK_URI, 'client_id:', IG_APP_ID);
  const res  = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body });
  const json = await res.json();
  console.log('[IG token exchange] response:', JSON.stringify(json));
  if (json.error_type || json.error) throw new Error(json.error_message || json.error?.message || 'Instagram token exchange failed');
  if (!json.access_token) throw new Error(`No access_token in response: ${JSON.stringify(json)}`);

  // Exchange short-lived for long-lived token
  const llRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${IG_APP_SECRET}&access_token=${json.access_token}`);
  const ll    = await llRes.json();
  if (ll.error) {
    // Long-lived exchange failed — use short-lived token as fallback
    console.warn('[instagram] long-lived exchange failed:', ll.error);
    return { access_token: json.access_token, expires_in: 3600, scopes: json.permissions ?? [] };
  }
  return {
    access_token: ll.access_token ?? json.access_token,
    expires_in:   ll.expires_in ?? 5184000,
    scopes:       json.permissions ?? [],
  };
}

async function exchangeThreadsCode(code: string): Promise<TokenResult> {
  const body = new URLSearchParams({
    client_id: THREADS_APP_ID, client_secret: THREADS_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: CALLBACK_URI,
    code,
  });
  const res  = await fetch('https://graph.threads.net/oauth/access_token', { method: 'POST', body });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'Threads token exchange failed');
  return { access_token: json.access_token, expires_in: json.expires_in };
}

async function exchangeTikTokCode(code: string): Promise<TokenResult> {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: TK_CLIENT_KEY, client_secret: TK_CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: CALLBACK_URI,
      code,
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.message || 'TikTok token exchange failed');
  return {
    access_token:  json.access_token,
    refresh_token: json.refresh_token,
    expires_in:    json.expires_in,
    scopes:        json.scope?.split(',') ?? [],
  };
}

// ── Fetch platform user profile ───────────────────────────────
async function fetchInstagramProfile(token: string) {
  const res  = await fetch(`https://graph.instagram.com/v20.0/me?fields=id,username,name,biography,followers_count,media_count,profile_picture_url&access_token=${token}`);
  return res.json();
}

async function fetchThreadsProfile(token: string) {
  const res = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,name&access_token=${token}`);
  return res.json();
}

async function fetchTikTokProfile(token: string) {
  const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,avatar_url,follower_count,following_count', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.data?.user ?? json;
}

// ── Save connection to DB ─────────────────────────────────────
async function upsertConnection(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from('platform_connections')
    .upsert(payload, { onConflict: 'workspace_id,platform,provider_user_id' })
    .select()
    .single();
  if (error) throw new Error(`DB upsert failed: ${error.message}`);
  return data;
}

// ── Main handler ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url      = new URL(req.url);
  // Support both /callback path and ?action=callback query param
  const isCallbackPath = url.pathname.endsWith('/callback');
  const action   = isCallbackPath ? 'callback' : url.searchParams.get('action');
  const platform = url.searchParams.get('platform');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  try {
    // ── INITIATE ─────────────────────────────────────────────
    if (action === 'initiate') {
      const workspaceId = url.searchParams.get('workspace_id');
      if (!workspaceId || !platform) {
        return json({ error: 'workspace_id and platform required' }, 400);
      }

      // State = base64(platform:workspace_id:timestamp)
      const state = btoa(`${platform}:${workspaceId}:${Date.now()}`);

      let authUrl: string;
      if (platform === 'Instagram')   authUrl = buildInstagramOAuthUrl(state);
      else if (platform === 'Threads') authUrl = buildThreadsOAuthUrl(state);
      else if (platform === 'TikTok') authUrl = buildTikTokOAuthUrl(state);
      else return json({ error: `Unknown platform: ${platform}` }, 400);

      // Check if app credentials are configured
      const configured = platform === 'Instagram' ? !!IG_APP_ID
        : platform === 'Threads' ? !!THREADS_APP_ID
        : !!TK_CLIENT_KEY;

      if (!configured) {
        return json({
          error:    'not_configured',
          message:  `${platform} API credentials not set. Add them via supabase secrets set.`,
          fallback: 'manual_import',
        }, 422);
      }

      return json({ auth_url: authUrl, state });
    }

    // ── CALLBACK ──────────────────────────────────────────────
    if (action === 'callback') {
      const code     = url.searchParams.get('code');
      const state    = url.searchParams.get('state');
      const error    = url.searchParams.get('error');

      if (error) {
        return redirect(oauthCompleteUrl({ error }));
      }
      if (!code || !state) {
        return redirect(oauthCompleteUrl({ error: 'missing_params' }));
      }

      // Decode platform + workspaceId from state
      let workspaceId: string;
      let statePlatform: string;
      try {
        const parts = atob(state).split(':');
        statePlatform = parts[0];
        workspaceId   = parts[1];
      } catch {
        return redirect(oauthCompleteUrl({ error: 'invalid_state' }));
      }

      // Use platform from state (since redirect URI has no query param)
      const resolvedPlatform = statePlatform || platform || '';

      // Exchange code for token
      let tokenData: TokenResult;
      if (resolvedPlatform === 'Instagram')    tokenData = await exchangeInstagramCode(code);
      else if (resolvedPlatform === 'Threads') tokenData = await exchangeThreadsCode(code);
      else if (resolvedPlatform === 'TikTok')  tokenData = await exchangeTikTokCode(code);
      else return redirect(oauthCompleteUrl({ error: 'unknown_platform' }));

      // Fetch profile
      let profile: Record<string, unknown> = {};
      try {
        if (resolvedPlatform === 'Instagram')    profile = await fetchInstagramProfile(tokenData.access_token);
        else if (resolvedPlatform === 'Threads') profile = await fetchThreadsProfile(tokenData.access_token);
        else if (resolvedPlatform === 'TikTok')  profile = await fetchTikTokProfile(tokenData.access_token);
      } catch { /* profile fetch is non-fatal */ }

      // Encrypt tokens
      const accessEnc  = await encrypt(tokenData.access_token);
      const refreshEnc = tokenData.refresh_token ? await encrypt(tokenData.refresh_token) : null;

      const userId    = (profile.id || profile.open_id || '') as string;
      const username  = (profile.username || profile.display_name || '') as string;
      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

      // Upsert social_account first
      const { data: saData } = await supabase.from('social_accounts').upsert({
        workspace_id:       workspaceId,
        platform:           resolvedPlatform,
        username,
        account_name:       (profile.name || username) as string,
        followers_count:    (profile.followers_count || profile.follower_count || 0) as number,
        connection_status:  'connected',
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'workspace_id,platform,username' }).select('id').single();

      await upsertConnection(supabase, {
        workspace_id:       workspaceId,
        platform:           resolvedPlatform,
        social_account_id:  saData?.id ?? null,
        provider_user_id:   userId,
        provider_username:  username,
        access_token_enc:   accessEnc,
        refresh_token_enc:  refreshEnc,
        token_expires_at:   expiresAt,
        scopes:             tokenData.scopes ?? [],
        connection_status:  'connected',
        connection_mode:    'oauth',
        last_error:         null,
        updated_at:         new Date().toISOString(),
      });

      return redirect(oauthCompleteUrl({ connected: resolvedPlatform }));
    }

    // ── REFRESH ───────────────────────────────────────────────
    if (action === 'refresh' && req.method === 'POST') {
      const { connection_id } = await req.json() as { connection_id: string };
      const { data: conn } = await supabase.from('platform_connections').select('*').eq('id', connection_id).single();
      if (!conn) return json({ error: 'Connection not found' }, 404);

      let newToken: string | null = null;

      if (conn.platform === 'Instagram' && conn.access_token_enc) {
        const old = await decrypt(conn.access_token_enc);
        const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${old}`);
        const j   = await res.json();
        if (j.access_token) newToken = j.access_token;
      } else if (conn.platform === 'TikTok' && conn.refresh_token_enc) {
        const oldRefresh = await decrypt(conn.refresh_token_enc);
        const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_key: TK_CLIENT_KEY, client_secret: TK_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: oldRefresh }),
        });
        const j = await res.json();
        if (j.access_token) newToken = j.access_token;
      }

      if (newToken) {
        const enc = await encrypt(newToken);
        await supabase.from('platform_connections').update({
          access_token_enc:  enc,
          connection_status: 'connected',
          token_expires_at:  new Date(Date.now() + 5184000 * 1000).toISOString(),
          last_error:        null,
          updated_at:        new Date().toISOString(),
        }).eq('id', connection_id);
        return json({ success: true });
      }
      return json({ error: 'Token refresh not supported or failed for this platform' }, 422);
    }

    // ── DISCONNECT ────────────────────────────────────────────
    if (action === 'disconnect' && req.method === 'POST') {
      const { connection_id } = await req.json() as { connection_id: string };
      const { data: conn } = await supabase
        .from('platform_connections')
        .select('social_account_id')
        .eq('id', connection_id)
        .single();

      await supabase.from('platform_connections').update({
        connection_status: 'disconnected',
        access_token_enc:  null,
        refresh_token_enc: null,
        updated_at:        new Date().toISOString(),
      }).eq('id', connection_id);

      if (conn?.social_account_id) {
        await supabase.from('social_accounts').update({ connection_status: 'disconnected' }).eq('id', conn.social_account_id);
      }
      return json({ success: true });
    }

    // ── MANUAL TOKEN (for pre-generated tokens, e.g. Threads dev portal) ─
    if (action === 'manual_token' && req.method === 'POST') {
      const { platform, access_token, workspace_id: wid } = await req.json() as { platform: string; access_token: string; workspace_id: string };
      if (!platform || !access_token || !wid) return json({ error: 'platform, access_token, workspace_id required' }, 400);

      let profile: Record<string, unknown> = {};
      try {
        if (platform === 'Threads') profile = await fetchThreadsProfile(access_token);
      } catch { /* non-fatal */ }

      const accessEnc = await encrypt(access_token);
      const username  = (profile.username || '') as string;

      const { data: saData } = await supabase.from('social_accounts').upsert({
        workspace_id: wid, platform,
        username, account_name: (profile.name || username) as string,
        followers_count: (profile.followers_count || 0) as number,
        connection_status: 'connected',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,platform,username' }).select('id').single();

      await upsertConnection(supabase, {
        workspace_id: wid, platform,
        social_account_id: saData?.id ?? null,
        provider_user_id: (profile.id || '') as string,
        provider_username: username,
        access_token_enc: accessEnc,
        refresh_token_enc: null,
        scopes: ['threads_basic', 'threads_manage_insights'],
        connection_status: 'connected',
        connection_mode: 'oauth',
        last_error: null,
        updated_at: new Date().toISOString(),
      });

      return json({ success: true, username });
    }

    return json({ error: 'Unknown action' }, 400);

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[platform-oauth]', msg);
    if (action === 'callback') {
      return redirect(oauthCompleteUrl({ error: msg }));
    }
    return json({ error: msg }, 500);
  }
});

// ── Helpers ───────────────────────────────────────────────────
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
function redirect(url: string) {
  return new Response(null, { status: 302, headers: { ...cors, Location: url } });
}
