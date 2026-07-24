// ============================================================
// Supabase Edge Function: platform-sync
// Unified sync engine for Instagram, Threads, TikTok
//
// POST body: { connection_id, sync_type?, workspace_id }
// sync_type: 'full' | 'incremental' | 'media' | 'insights' | 'profile'
//
// Required secrets: same as platform-oauth + OPENAI_API_KEY (optional)
// ============================================================

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY   = Deno.env.get('ENCRYPTION_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Decryption (mirrors platform-oauth) ──────────────────────
async function decrypt(stored: string): Promise<string> {
  if (!stored || stored.startsWith('plain:')) return stored?.slice(6) ?? '';
  if (!ENCRYPTION_KEY) throw new Error('No encryption key');
  const [ivHex, encHex] = stored.split(':');
  const iv  = new Uint8Array(ivHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const enc = new Uint8Array(encHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const raw = new Uint8Array(ENCRYPTION_KEY.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, enc);
  return new TextDecoder().decode(dec);
}

// ── Date normalizer ───────────────────────────────────────────
function toDate(ts: unknown): string | null {
  if (!ts) return null;
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts as string);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// ── Platform API calls ────────────────────────────────────────

// Instagram
async function igFetch(path: string, token: string) {
  const res  = await fetch(`https://graph.instagram.com/v20.0${path}${path.includes('?') ? '&' : '?'}access_token=${token}`);
  const json = await res.json();
  if (json.error) throw new Error(`Instagram API: ${json.error.message}`);
  return json;
}

async function syncInstagramProfile(token: string, connId: string, supabase: ReturnType<typeof createClient>) {
  const profile = await igFetch('/me?fields=id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website', token);
  return { provider_user_id: profile.id, username: profile.username, followers: profile.followers_count ?? 0, profile };
}

async function syncInstagramDemographics(token: string, accountId: string, supabase: ReturnType<typeof createClient>) {
  const breakdowns = ['age', 'gender', 'country', 'city'];
  const result: Record<string, unknown> = {};

  for (const breakdown of breakdowns) {
    try {
      const data = await igFetch(
        `/me/insights?metric=follower_demographics&period=lifetime&breakdown=${breakdown}&metric_type=total_value`,
        token
      );
      const item = (data.data ?? [])[0];
      const rows = item?.total_value?.breakdowns?.[0]?.results ?? [];
      const total = rows.reduce((s: number, r: { value: number }) => s + r.value, 0);

      result[breakdown] = rows.map((r: { dimension_values: string[]; value: number }) => ({
        label: r.dimension_values[0],
        value: r.value,
        pct: total > 0 ? +((r.value / total) * 100).toFixed(1) : 0,
      }));
    } catch (e) {
      console.error(`[demographics:${breakdown}]`, (e as Error).message);
    }
  }

  if (Object.keys(result).length > 0) {
    await supabase.from('social_accounts')
      .update({ demographics: result, updated_at: new Date().toISOString() })
      .eq('id', accountId);
  }
  return result;
}

async function fetchMediaInsights(mediaId: string, mediaType: string, token: string): Promise<Record<string, number>> {
  const isVideo = ['VIDEO', 'REEL'].includes(mediaType);
  const result: Record<string, number> = {};

  const parseMetrics = (data: { data?: { name: string; values?: { value: number }[]; value?: number }[] }) => {
    (data.data ?? []).forEach((m) => {
      result[m.name] = m.values?.[0]?.value ?? (m.value as number) ?? 0;
    });
  };

  if (isVideo) {
    try {
      const data = await igFetch(`/${mediaId}/insights?metric=reach,saved,views,shares,likes,comments,ig_reels_avg_watch_time`, token);
      parseMetrics(data);
    } catch (e) { console.error('[fetchMediaInsights video]', mediaId, (e as Error).message); }
  } else {
    // Fetch basic metrics first
    try {
      const data = await igFetch(`/${mediaId}/insights?metric=reach,saved,shares,likes,comments`, token);
      parseMetrics(data);
    } catch (e) { console.error('[fetchMediaInsights base]', mediaId, (e as Error).message); }
    // Then try views/impressions separately
    try {
      const data = await igFetch(`/${mediaId}/insights?metric=views`, token);
      parseMetrics(data);
    } catch (e) {
      console.warn('[fetchMediaInsights views]', mediaId, (e as Error).message);
      // Fallback to impressions
      try {
        const data2 = await igFetch(`/${mediaId}/insights?metric=impressions`, token);
        parseMetrics(data2);
      } catch (e2) { console.warn('[fetchMediaInsights impressions]', mediaId, (e2 as Error).message); }
    }
  }

  return result;
}

async function syncInstagramMedia(token: string, accountId: string, workspaceId: string, supabase: ReturnType<typeof createClient>) {
  const fields = 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count';
  const data   = await igFetch(`/me/media?fields=${fields}&limit=50`, token);
  const items  = data.data ?? [];

  let inserted = 0, updated = 0, failed = 0;
  for (const item of items) {
    try {
      const contentType = item.media_type === 'CAROUSEL_ALBUM' ? 'Carousel'
        : item.media_type === 'VIDEO' ? 'Reels'
        : item.media_type === 'IMAGE' ? 'Photo' : 'Other';

      const { data: existing } = await supabase.from('contents').select('id')
        .eq('workspace_id', workspaceId).eq('content_url', item.permalink).maybeSingle();

      const thumbnailUrl = item.thumbnail_url ?? (item.media_type !== 'VIDEO' ? item.media_url : null) ?? null;
      const contentPayload = {
        workspace_id:      workspaceId,
        social_account_id: accountId,
        platform:          'Instagram',
        content_url:       item.permalink,
        content_type:      contentType,
        caption:           item.caption ?? null,
        thumbnail_url:     thumbnailUrl,
        published_at:      item.timestamp ? new Date(item.timestamp).toISOString() : null,
        updated_at:        new Date().toISOString(),
      };

      let contentId: string;
      if (existing?.id) {
        await supabase.from('contents').update(contentPayload).eq('id', existing.id);
        contentId = existing.id;
        updated++;
      } else {
        const { data: created, error } = await supabase.from('contents').insert(contentPayload).select('id').single();
        if (error) { failed++; continue; }
        contentId = created.id;
        inserted++;
      }

      // Fetch per-media insights
      const ins = await fetchMediaInsights(item.id, item.media_type, token);

      const metricDate    = toDate(item.timestamp) ?? new Date().toISOString().split('T')[0];
      const likes         = ins.likes    ?? item.like_count      ?? 0;
      const comments      = ins.comments ?? item.comments_count  ?? 0;
      const shares        = ins.shares   ?? 0;
      const saves         = ins.saved    ?? 0;
      const reach         = ins.reach    ?? 0;
      const impressions   = ins.impressions ?? 0;
      const views         = ins.views ?? ins.impressions ?? ins.video_views ?? 0;
      const avgWatchTime  = ins.avg_time_watched ?? 0;
      const engCount      = likes + comments + shares + saves;
      // ER = engagements / reach * 100 (Instagram standard)
      const er            = reach > 0 ? +((engCount / reach) * 100).toFixed(2) : 0;
      const score         = Math.min(100, Math.round(er * 10 + Math.log1p(engCount)));
      const perfStatus    = score >= 85 ? 'high_performer' : score >= 65 ? 'stable' : score >= 45 ? 'needs_improvement' : 'underperform';

      const { error: metricsErr } = await supabase.from('content_metrics').upsert({
        workspace_id:      workspaceId,
        content_id:        contentId,
        metric_date:       metricDate,
        likes, comments, shares, saves,
        reach, impressions, views,
        avg_watch_time:    avgWatchTime,
        engagement_count:  engCount,
        engagement_rate:   er,
        performance_score: score,
        updated_at:        new Date().toISOString(),
      }, { onConflict: 'content_id,metric_date' });
      if (metricsErr) console.error('[content_metrics upsert]', JSON.stringify(metricsErr));
    } catch (e) { console.error('[media item]', (e as Error).message); failed++; }
  }
  return { inserted, updated, failed };
}

async function syncInstagramInsights(token: string, accountId: string, workspaceId: string, supabase: ReturnType<typeof createClient>) {
  // Fetch metrics in two groups to avoid one bad metric failing all
  const byDate: Record<string, Record<string, number>> = {};

  // Each metric in its own group so one failure doesn't block others
  const metricGroups = [
    ['reach'],
    ['impressions'],
    ['profile_views'],
    ['website_clicks'],
    ['follower_count'],
    ['accounts_engaged'],
    ['total_interactions'],
  ];

  for (const group of metricGroups) {
    try {
      const data = await igFetch(`/me/insights?metric=${group.join(',')}&period=day&since=${daysSince(30)}&until=${nowTs()}`, token);
      (data.data ?? []).forEach((m: Record<string,unknown>) => {
        const values = (m.values as {value:number, end_time:string}[]) ?? [];
        values.forEach(v => {
          const d = toDate(v.end_time) ?? '';
          if (!byDate[d]) byDate[d] = {};
          byDate[d][m.name as string] = v.value;
        });
      });
    } catch (e) {
      console.warn(`[insights group ${group[0]}]`, (e as Error).message);
    }
  }

  let inserted = 0;
  let lastError: string | undefined;
  const dateCount = Object.keys(byDate).length;
  console.log('[insights] byDate entries:', dateCount, 'accountId:', accountId, 'workspaceId:', workspaceId);
  for (const [date, vals] of Object.entries(byDate)) {
    if (!date) continue;
    // Only include non-null fields to avoid overwriting existing data with null
    const row: Record<string, unknown> = { workspace_id: workspaceId, social_account_id: accountId, metric_date: date };
    if (vals.reach           != null) row.reach              = vals.reach;
    if (vals.impressions     != null) row.impressions        = vals.impressions;
    if (vals.profile_views   != null) row.profile_visits     = vals.profile_views;
    if (vals.follower_count  != null) row.followers          = vals.follower_count;
    if (vals.website_clicks  != null) row.website_clicks     = vals.website_clicks;
    if (vals.total_interactions != null) row.total_interactions = vals.total_interactions;
    if (vals.accounts_engaged   != null) row.accounts_engaged   = vals.accounts_engaged;
    const { error } = await supabase.from('account_metrics').upsert(row, { onConflict: 'social_account_id,metric_date' });
    if (error) {
      lastError = error.message;
      console.warn('[account_metrics upsert]', date, error.message, error.details, error.hint);
    } else {
      inserted++;
    }
  }
  return { rows: inserted, ...(lastError ? { upsert_error: lastError } : {}) };
}

// Threads
async function syncThreadsProfile(token: string) {
  // Try with followers_count first, fall back to basic fields if not permitted
  const res = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,name,followers_count&access_token=${token}`);
  const json = await res.json();
  if (json.error || json.followers_count == null) {
    // Fallback: try threads_insights endpoint for follower count
    const res2 = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,name&access_token=${token}`);
    const profile = await res2.json();
    try {
      const insRes = await fetch(`https://graph.threads.net/v1.0/me/threads_insights?metric=followers_count&period=lifetime&access_token=${token}`);
      const insJson = await insRes.json();
      const fc = (insJson.data ?? []).find((m: {name:string}) => m.name === 'followers_count');
      if (fc?.total_value?.value) profile.followers_count = fc.total_value.value;
    } catch { /* non-fatal */ }
    return profile;
  }
  return json;
}

async function fetchThreadsPostInsights(threadId: string, token: string): Promise<Record<string, number>> {
  try {
    const res  = await fetch(`https://graph.threads.net/v1.0/${threadId}/insights?metric=likes,replies,reposts,quotes,views&access_token=${token}`);
    const json = await res.json();
    if (json.error) { console.warn('[threads insights error]', threadId, JSON.stringify(json.error)); return {}; }
    const result: Record<string, number> = {};
    (json.data ?? []).forEach((m: { name: string; values?: { value: number }[]; value?: number }) => {
      result[m.name] = m.values?.[0]?.value ?? m.value ?? 0;
    });
    console.log('[threads insights]', threadId, JSON.stringify(result));
    return result;
  } catch (e) { console.warn('[threads insights exception]', threadId, (e as Error).message); return {}; }
}

async function syncThreadsPosts(token: string, accountId: string, workspaceId: string, supabase: ReturnType<typeof createClient>) {
  const res   = await fetch(`https://graph.threads.net/v1.0/me/threads?fields=id,media_type,text,permalink,timestamp,like_count,replies_count&limit=50&access_token=${token}`);
  const data  = await res.json();
  const items = data.data ?? [];

  let inserted = 0, updated = 0, failed = 0;
  for (const item of items) {
    try {
      // Deduplicate by external_content_id (thread ID), not permalink
      const { data: existing } = await supabase.from('contents').select('id')
        .eq('workspace_id', workspaceId).eq('external_content_id', item.id).maybeSingle();

      const payload = {
        workspace_id:        workspaceId,
        social_account_id:   accountId,
        platform:            'Threads',
        external_content_id: item.id,
        content_url:         item.permalink ?? null,
        content_type:        item.media_type === 'TEXT_POST' ? 'Thread Opini' : 'Thread Tips',
        caption:             item.text ?? null,
        published_at:        item.timestamp ? new Date(item.timestamp).toISOString() : null,
        updated_at:          new Date().toISOString(),
      };

      let contentId: string;
      if (existing?.id) {
        await supabase.from('contents').update(payload).eq('id', existing.id);
        contentId = existing.id;
        updated++;
      } else {
        const { data: c, error } = await supabase.from('contents').insert(payload).select('id').single();
        if (error) { failed++; continue; }
        contentId = c.id;
        inserted++;
      }

      // Try insights endpoint first, fallback to like_count from list
      const ins = await fetchThreadsPostInsights(item.id, token);
      const likes   = ins.likes   ?? item.like_count    ?? 0;
      const replies = ins.replies ?? item.replies_count ?? 0;
      const reposts = ins.reposts ?? 0;
      const quotes  = ins.quotes  ?? 0;
      const views   = ins.views   ?? 0;
      const engCount = likes + replies + reposts + quotes;
      const er = views > 0 ? +((engCount / views) * 100).toFixed(2) : 0;

      const d = toDate(item.timestamp) ?? new Date().toISOString().split('T')[0];
      await supabase.from('content_metrics').upsert({
        workspace_id:     workspaceId,
        content_id:       contentId,
        metric_date:      d,
        likes, replies, reposts, quotes, views,
        comments:         replies,
        shares:           reposts,
        engagement_count: engCount,
        engagement_rate:  er,
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'content_id,metric_date' });
    } catch { failed++; }
  }
  return { inserted, updated, failed };
}

// TikTok
async function syncTikTokProfile(token: string) {
  const res  = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,avatar_url,follower_count,following_count,video_count', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.data?.user ?? {};
}

async function syncTikTokVideos(token: string, accountId: string, workspaceId: string, supabase: ReturnType<typeof createClient>) {
  const res  = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,share_url,create_time,like_count,comment_count,share_count,view_count,duration,play_url', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ max_count: 20 }),
  });
  const json  = await res.json();
  const items = json.data?.videos ?? [];

  let inserted = 0, updated = 0, failed = 0;
  for (const item of items) {
    try {
      const { data: existing } = await supabase.from('contents').select('id')
        .eq('workspace_id', workspaceId).eq('content_url', item.share_url ?? '').maybeSingle();

      const payload = {
        workspace_id: workspaceId, social_account_id: accountId, platform: 'TikTok',
        content_url: item.share_url ?? null, title: item.title ?? null,
        caption: item.video_description ?? null, content_type: 'Short Video',
        published_at: item.create_time ? new Date(item.create_time * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      let contentId: string;
      if (existing?.id) {
        await supabase.from('contents').update(payload).eq('id', existing.id);
        contentId = existing.id;
        updated++;
      } else {
        const { data: c, error } = await supabase.from('contents').insert(payload).select('id').single();
        if (error) { failed++; continue; }
        contentId = c.id;
        inserted++;
      }

      const d = toDate(item.create_time) ?? new Date().toISOString().split('T')[0];
      const likes = item.like_count ?? 0, comments = item.comment_count ?? 0,
            shares = item.share_count ?? 0, views = item.view_count ?? 0;
      const er = views ? +((likes + comments + shares) / views * 100).toFixed(2) : 0;
      await supabase.from('content_metrics').upsert({
        workspace_id: workspaceId, content_id: contentId, metric_date: d,
        likes, comments, shares, views,
        engagement_rate: er, engagement_count: likes + comments + shares,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'content_id,metric_date' });
    } catch { failed++; }
  }
  return { inserted, updated, failed };
}

function daysSince(n: number) { return Math.floor((Date.now() - n * 86400000) / 1000); }
function nowTs() { return Math.floor(Date.now() / 1000); }

// ── Main handler ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  try {
    const { connection_id, workspace_id, sync_type = 'full' } = await req.json() as {
      connection_id: string; workspace_id: string; sync_type?: string;
    };

    // Load connection
    const { data: conn, error: connErr } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('workspace_id', workspace_id)
      .single();
    if (connErr || !conn) return jsonR({ error: 'Connection not found' }, 404);
    if (conn.connection_status !== 'connected') return jsonR({ error: 'Connection is not active' }, 422);

    // Create sync job
    const { data: job } = await supabase.from('sync_jobs').insert({
      workspace_id, platform_connection_id: connection_id,
      platform: conn.platform, sync_type, status: 'running',
      started_at: new Date().toISOString(), triggered_by: 'manual',
    }).select().single();

    const jobId = job?.id;

    // Decrypt token
    let token: string;
    try { token = await decrypt(conn.access_token_enc); }
    catch (e) {
      await failJob(supabase, jobId, `Token decryption failed: ${(e as Error).message}`);
      return jsonR({ error: 'Token decrypt failed' }, 500);
    }

    // Ensure social_account exists
    let accountId = conn.social_account_id;
    if (!accountId) {
      const { data: sa } = await supabase.from('social_accounts')
        .select('id').eq('workspace_id', workspace_id).eq('platform', conn.platform)
        .eq('username', conn.provider_username ?? '').maybeSingle();
      accountId = sa?.id;
    }
    if (!accountId) {
      const { data: sa } = await supabase.from('social_accounts').insert({
        workspace_id, platform: conn.platform,
        username: conn.provider_username ?? 'unknown',
        account_name: conn.provider_username ?? 'Unknown',
        connection_status: 'connected',
      }).select('id').single();
      accountId = sa?.id;
    }

    // Run sync
    const summary: Record<string, unknown> = { platform: conn.platform, sync_type, errors: [] };
    let totalInserted = 0, totalUpdated = 0, totalFailed = 0;

    try {
      if (conn.platform === 'Instagram') {
        if (['full','profile'].includes(sync_type)) {
          const p = await syncInstagramProfile(token, connection_id, supabase);
          summary.profile = p.username;
          await supabase.from('social_accounts').update({
            followers_count: p.followers,
            username:        p.username ?? undefined,
            account_name:    p.profile?.name ?? p.username ?? undefined,
            updated_at:      new Date().toISOString(),
          }).eq('id', accountId);
        }
        if (['full','media'].includes(sync_type)) {
          const r = await syncInstagramMedia(token, accountId, workspace_id, supabase);
          totalInserted += r.inserted; totalUpdated += r.updated; totalFailed += r.failed;
          summary.media = r;
        }
        if (['full','insights'].includes(sync_type)) {
          const r = await syncInstagramInsights(token, accountId, workspace_id, supabase);
          if ((r as {warning?:string}).warning) (summary.errors as string[]).push((r as {warning:string}).warning);
          summary.insights = r;
        }
        if (['full','profile'].includes(sync_type)) {
          const dem = await syncInstagramDemographics(token, accountId, supabase);
          summary.demographics = { breakdowns: Object.keys(dem) };
        }
      }

      if (conn.platform === 'Threads') {
        if (['full','profile'].includes(sync_type)) {
          const p = await syncThreadsProfile(token);
          console.log('[threads profile]', JSON.stringify(p));
          summary.profile = p.username;
          if (p.error) {
            console.warn('[threads profile error]', JSON.stringify(p.error));
            (summary.errors as string[]).push(`Profile error: ${p.error.message ?? JSON.stringify(p.error)}`);
          } else {
            await supabase.from('social_accounts').update({
              username: p.username ?? undefined,
              account_name: p.name ?? p.username ?? undefined,
              followers_count: p.followers_count ?? undefined,
              updated_at: new Date().toISOString(),
            }).eq('id', accountId);
          }
          if (p.username) {
            await supabase.from('platform_connections').update({ provider_username: p.username }).eq('id', conn.id);
          }
        }
        if (['full','media'].includes(sync_type)) {
          const r = await syncThreadsPosts(token, accountId, workspace_id, supabase);
          totalInserted += r.inserted; totalUpdated += r.updated; totalFailed += r.failed;
          summary.posts = r;
        }
      }

      if (conn.platform === 'TikTok') {
        if (['full','profile'].includes(sync_type)) {
          const p = await syncTikTokProfile(token);
          summary.profile = p.display_name;
          await supabase.from('social_accounts').update({
            username: p.display_name ?? undefined,
            account_name: p.display_name ?? undefined,
            followers_count: p.follower_count ?? 0,
            updated_at: new Date().toISOString(),
          }).eq('id', accountId);
          if (p.display_name) {
            await supabase.from('platform_connections').update({ provider_username: p.display_name }).eq('id', conn.id);
          }
        }
        if (['full','media'].includes(sync_type)) {
          const r = await syncTikTokVideos(token, accountId, workspace_id, supabase);
          totalInserted += r.inserted; totalUpdated += r.updated; totalFailed += r.failed;
          summary.videos = r;
        }
      }
    } catch (e) {
      (summary.errors as string[]).push((e as Error).message);
      totalFailed++;
    }

    // Complete job
    const finalStatus = totalFailed > 0 && totalInserted + totalUpdated === 0 ? 'failed' : totalFailed > 0 ? 'partial' : 'completed';
    await supabase.from('sync_jobs').update({
      status: finalStatus, completed_at: new Date().toISOString(),
      records_inserted: totalInserted, records_updated: totalUpdated, records_failed: totalFailed,
      result_summary: summary, updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    // Update last_synced_at on connection
    await supabase.from('platform_connections').update({
      last_synced_at: new Date().toISOString(),
      next_sync_at:   new Date(Date.now() + (conn.sync_frequency_hours ?? 24) * 3600000).toISOString(),
      connection_status: 'connected',
    }).eq('id', connection_id);

    return jsonR({ success: true, job_id: jobId, status: finalStatus, summary, inserted: totalInserted, updated: totalUpdated, failed: totalFailed });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[platform-sync]', msg);
    return jsonR({ error: msg }, 500);
  }
});

async function failJob(supabase: ReturnType<typeof createClient>, jobId: string | undefined, message: string) {
  if (!jobId) return;
  await supabase.from('sync_jobs').update({
    status: 'failed', error_message: message, completed_at: new Date().toISOString(),
  }).eq('id', jobId);
}

function jsonR(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
