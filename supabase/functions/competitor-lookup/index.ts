import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { pickTemplate } from './analysis-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IG_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Get Instagram guest cookies (csrftoken + session cookies) */
async function getIgCookies(): Promise<string> {
  try {
    const res = await fetch('https://www.instagram.com/', {
      headers: { 'User-Agent': IG_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
    });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    // Also try parsing from the Set-Cookie header directly
    const cookieHeader = res.headers.get('set-cookie') ?? '';
    const allCookies   = [...setCookies, cookieHeader].join('; ');
    // Extract key cookies
    const csrf = allCookies.match(/csrftoken=([^;,\s]+)/)?.[1];
    const mid  = allCookies.match(/mid=([^;,\s]+)/)?.[1];
    const ig_did = allCookies.match(/ig_did=([^;,\s]+)/)?.[1];
    const parts = [];
    if (csrf)   parts.push(`csrftoken=${csrf}`);
    if (mid)    parts.push(`mid=${mid}`);
    if (ig_did) parts.push(`ig_did=${ig_did}`);
    console.log('[cookies]', parts.join('; ').slice(0, 80));
    return parts.join('; ');
  } catch (e: any) {
    console.log('[cookies] error:', e.message);
    return '';
  }
}

/** Fetch via Instagram's internal web API (most reliable) */
async function fetchViaWebApi(username: string): Promise<Record<string, unknown> | null> {
  try {
    const cookies = await getIgCookies();
    const csrf    = cookies.match(/csrftoken=([^;,\s]+)/)?.[1] ?? '';

    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      {
        headers: {
          'User-Agent':       IG_UA,
          'x-ig-app-id':     '936619743392459',
          'X-CSRFToken':     csrf,
          'X-Requested-With':'XMLHttpRequest',
          'Accept':           'application/json, text/plain, */*',
          'Accept-Language':  'en-US,en;q=0.9',
          'Origin':           'https://www.instagram.com',
          'Referer':          `https://www.instagram.com/${username}/`,
          'Sec-Fetch-Dest':   'empty',
          'Sec-Fetch-Mode':   'cors',
          'Sec-Fetch-Site':   'same-site',
          ...(cookies ? { 'Cookie': cookies } : {}),
        },
      }
    );
    console.log('[webapi] status:', res.status);
    if (!res.ok) return null;
    const json = await res.json();
    const u = json?.data?.user;
    if (!u) return null;
    console.log('[webapi] found user:', u.username, 'followers:', u.edge_followed_by?.count);
    return buildResult(username, u, 'webapi');
  } catch (e: any) {
    console.log('[webapi] error:', e.message);
    return null;
  }
}

/** Scrape public Instagram profile — tries multiple data extraction strategies */
/** Try ?__a=1 JSON endpoint (sometimes works without auth) */
async function fetchViaLegacyJson(username: string, cookies: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`,
      {
        headers: {
          'User-Agent':    IG_UA,
          'Accept':        'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'X-IG-App-ID':  '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer':       `https://www.instagram.com/${username}/`,
          ...(cookies ? { 'Cookie': cookies } : {}),
        },
      }
    );
    console.log('[legacyjson] status:', res.status);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) { console.log('[legacyjson] not json, ct:', ct); return null; }
    const json = await res.json();
    // Response can be { graphql: { user: {...} } } or { data: { user: {...} } }
    const u = json?.graphql?.user ?? json?.data?.user ?? json?.user;
    if (!u || !u.edge_followed_by) return null;
    console.log('[legacyjson] found user:', u.username, 'followers:', u.edge_followed_by?.count);
    return buildResult(username, u, 'legacyjson');
  } catch (e: any) {
    console.log('[legacyjson] error:', e.message);
    return null;
  }
}

async function scrapePublicProfile(username: string): Promise<Record<string, unknown> | null> {
  // Get cookies once and reuse across all strategies
  const cookies = await getIgCookies();

  // Strategy A: Instagram internal web API with cookies
  const webApiResult = await fetchViaWebApi(username);
  if (webApiResult) return webApiResult;

  // Strategy B: Legacy ?__a=1 JSON endpoint
  const legacyResult = await fetchViaLegacyJson(username, cookies);
  if (legacyResult) return legacyResult;

  // Strategy C: HTML scraping
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': IG_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
        ...(cookies ? { 'Cookie': cookies } : {}),
      },
    });

    if (!res.ok) { console.log(`[scrape] HTTP ${res.status}`); return null; }

    const html = await res.text();
    console.log('[scrape] HTML length:', html.length);

    // Detect Instagram login/redirect page — abort early
    const isLoginPage = html.includes('"loginPage"') || html.includes('"LoginForm"') ||
                        html.includes('login_page') || html.includes('"is_login_page":true');
    if (isLoginPage) { console.log('[scrape] Login page detected, aborting'); return null; }

    // Inline JSON blobs (follower counts)
    const jsonBlobs = [...html.matchAll(/"edge_followed_by"\s*:\s*\{"count"\s*:\s*(\d+)\}/g)];
    if (jsonBlobs.length > 0) {
      const followers = parseInt(jsonBlobs[0][1]);
      const picMatch   = html.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/);
      const nameMatch  = html.match(/"full_name"\s*:\s*"([^"]+)"/);
      const bioMatch   = html.match(/"biography"\s*:\s*"([^"]+)"/);
      const postsMatch = html.match(/"edge_owner_to_timeline_media"[^{]*\{"count"\s*:\s*(\d+)/);
      console.log('[scrape] Inline JSON blobs, followers:', followers);
      return {
        username,
        name:                nameMatch?.[1] ?? username,
        biography:           bioMatch?.[1]  ?? '',
        website:             '',
        profile_picture_url: picMatch?.[1]?.replace(/\\u0026/g, '&').replace(/\\//g, '/') ?? '',
        followers_count:     followers,
        media_count:         postsMatch ? parseInt(postsMatch[1]) : 0,
        engagement_rate:     0,
        posting_freq_weekly: 0,
        top_content_type:    'IMAGE',
        recent_posts:        [],
        source:              'inline',
      };
    }

    // Open Graph meta tags
    const meta = (property: string): string => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))
             ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'));
      return m?.[1]?.replace(/&#039;/g, "'").replace(/&amp;/g, '&') ?? '';
    };

    const ogTitle = meta('og:title');
    const ogDesc  = meta('og:description');
    const ogImage = meta('og:image');
    console.log('[scrape] OG title:', ogTitle, '| desc:', ogDesc?.slice(0, 80));

    // Ignore generic login-page OG tags
    if (!ogTitle || ogTitle.trim() === 'Instagram' || !ogDesc) {
      console.log('[scrape] No profile data in OG tags (login page)');
      return null;
    }

    const nameM       = ogTitle.match(/^(.+?)\s*[\(•@]/);
    const parsedName  = nameM?.[1]?.trim() ?? username;
    const followersM  = ogDesc.match(/([\d,]+(?:\.\d+)?[KMBkmb]?)\s+[Ff]ollowers?/);
    const followers   = followersM ? parseFollowers(followersM[1]) : 0;
    const postsM      = ogDesc.match(/([\d,]+(?:\.\d+)?[KMBkmb]?)\s+[Pp]osts?/);
    const mediaCount  = postsM ? parseFollowers(postsM[1]) : 0;

    // Ignore generic Instagram logo as profile picture
    const isGenericPic = !ogImage || ogImage.includes('static.cdninstagram.com/rsrc') ||
                          ogImage.includes('/static/') || ogImage.includes('44884218_345707');
    return {
      username,
      name:                parsedName,
      biography:           '',
      website:             '',
      profile_picture_url: isGenericPic ? '' : ogImage,
      followers_count:     followers,
      media_count:         mediaCount,
      engagement_rate:     0,
      posting_freq_weekly: 0,
      top_content_type:    'IMAGE',
      recent_posts:        [],
      source:              'og',
    };
  } catch (e: any) {
    console.error('[scrape] error:', e.message);
    return null;
  }
}

/** Recursively find a key in nested object */
function findDeep(obj: any, key: string, depth = 0): any {
  if (depth > 8 || !obj || typeof obj !== 'object') return null;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const found = findDeep(v, key, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Build result from Instagram user object (varies by API version) */
function buildResult(username: string, u: any, source: string) {
  const followers = u.follower_count
                 ?? u.edge_followed_by?.count
                 ?? u.followers_count
                 ?? 0;
  const mediaCount = u.media_count
                  ?? u.edge_owner_to_timeline_media?.count
                  ?? 0;

  // Profile picture — try multiple fields, decode unicode escapes
  const rawPic = u.profile_pic_url_hd
              ?? u.hd_profile_pic_url_info?.url
              ?? u.profile_pic_url
              ?? '';
  const pic = rawPic
    .replace(/\\u0026/g, '&')
    .replace(/\\u002F/g, '/')
    .replace(/\\/g, '');
  console.log('[buildResult] pic url:', pic.slice(0, 80));

  // Compute ER from recent posts (likes + comments) / followers
  const edges: any[] = u.edge_owner_to_timeline_media?.edges ?? [];
  let avgER = 0;
  if (edges.length > 0 && followers > 0) {
    const totalEngage = edges.reduce((s: number, e: any) => {
      const likes    = e.node?.edge_liked_by?.count ?? e.node?.like_count ?? 0;
      const comments = e.node?.edge_media_to_comment?.count ?? e.node?.comments_count ?? 0;
      return s + likes + comments;
    }, 0);
    avgER = +((totalEngage / edges.length / followers) * 100).toFixed(2);
  }

  // Posting frequency from timestamps
  const timestamps: number[] = edges
    .map((e: any) => e.node?.taken_at_timestamp ?? e.node?.taken_at)
    .filter(Boolean)
    .map((t: any) => typeof t === 'number' ? t * 1000 : new Date(t).getTime())
    .sort((a: number, b: number) => b - a);
  let freqWeekly = 0;
  if (timestamps.length >= 2) {
    const spanDays = (timestamps[0] - timestamps[timestamps.length - 1]) / 86400000;
    freqWeekly = spanDays > 0 ? +((timestamps.length / spanDays) * 7).toFixed(1) : 0;
  }

  // Top content type
  const typeCounts: Record<string, number> = {};
  for (const e of edges) {
    const t = e.node?.__typename ?? e.node?.media_type ?? 'IMAGE';
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'IMAGE';

  // Recent posts thumbnails
  const recentPosts = edges.slice(0, 6).map((e: any) => ({
    thumbnail_url: e.node?.thumbnail_src ?? e.node?.display_url ?? null,
    permalink:     e.node?.shortcode ? `https://www.instagram.com/p/${e.node.shortcode}/` : null,
    media_type:    e.node?.__typename ?? 'IMAGE',
    caption:       e.node?.edge_media_to_caption?.edges?.[0]?.node?.text ?? '',
    likes:         e.node?.edge_liked_by?.count ?? 0,
    comments:      e.node?.edge_media_to_comment?.count ?? 0,
  }));

  return {
    username:            u.username ?? username,
    name:                u.full_name ?? u.name ?? username,
    biography:           u.biography ?? u.bio ?? '',
    website:             u.external_url ?? u.website ?? '',
    profile_picture_url: pic,
    followers_count:     followers,
    media_count:         mediaCount,
    engagement_rate:     avgER,
    posting_freq_weekly: freqWeekly,
    top_content_type:    topType,
    recent_posts:        recentPosts,
    source,
  };
}

/** Parse "2.3M" / "68.4K" / "1,234" to integer */
function parseFollowers(s: string): number {
  if (!s) return 0;
  const clean = s.replace(/,/g, '').trim();
  const n     = parseFloat(clean);
  if (clean.toUpperCase().endsWith('B')) return Math.round(n * 1_000_000_000);
  if (clean.toUpperCase().endsWith('M')) return Math.round(n * 1_000_000);
  if (clean.toUpperCase().endsWith('K')) return Math.round(n * 1_000);
  return Math.round(n) || 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { username, workspace_id, action, manual_data } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── IMAGE PROXY ──────────────────────────────────────────
    if (action === 'proxy_image') {
      const { image_url } = body;
      if (!image_url) return new Response('Missing image_url', { status: 400, headers: corsHeaders });
      // Validate URL before fetching
      if (!image_url.startsWith('http')) {
        return new Response(JSON.stringify({ error: 'Invalid image URL' }), { status: 400, headers: corsHeaders });
      }
      const imgRes = await fetch(image_url, {
        headers: {
          'User-Agent': IG_UA,
          'Referer': 'https://www.instagram.com/',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });
      if (!imgRes.ok) {
        console.log('[proxy_image] fetch failed:', imgRes.status, image_url.slice(0, 80));
        return new Response(JSON.stringify({ error: 'Image fetch failed' }), { status: 502, headers: corsHeaders });
      }
      const ct = imgRes.headers.get('content-type') ?? '';
      if (!ct.startsWith('image/')) {
        console.log('[proxy_image] not an image, ct:', ct);
        return new Response(JSON.stringify({ error: 'Not an image' }), { status: 422, headers: corsHeaders });
      }
      const buf = await imgRes.arrayBuffer();
      if (buf.byteLength === 0) {
        return new Response(JSON.stringify({ error: 'Empty image' }), { status: 422, headers: corsHeaders });
      }
      // Chunk-safe base64 to avoid stack overflow on large images
      const bytes = new Uint8Array(buf);
      let b64 = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      b64 = btoa(b64);
      return new Response(JSON.stringify({ data_url: `data:${ct};base64,${b64}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── LOOKUP (scrape public profile) ───────────────────────
    if (action === 'lookup' || !action) {
      const profile = await scrapePublicProfile(username.replace(/^@/, ''));
      if (!profile) {
        return new Response(JSON.stringify({ error: 'Profil tidak ditemukan atau akun privat' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(profile), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── SAVE ─────────────────────────────────────────────────
    if (action === 'save') {
      const d = manual_data ?? {};
      const { data: saved, error: saveErr } = await supabase
        .from('competitors')
        .insert({
          workspace_id,
          platform:            'Instagram',
          name:                d.name || d.username,
          username:            '@' + (d.username ?? '').replace(/^@/, ''),
          profile_picture_url: d.profile_picture_url ?? null,
          biography:           d.biography ?? null,
          website:             d.website ?? null,
          followers_count:     parseInt(d.followers_count) || 0,
          media_count:         parseInt(d.media_count)     || 0,
          engagement_rate:     parseFloat(d.engagement_rate)     || 0,
          posting_freq_weekly: parseFloat(d.posting_freq_weekly) || 0,
          recent_posts:        d.recent_posts ?? [],
          last_fetched_at:     new Date().toISOString(),
        })
        .select()
        .single();

      if (saveErr) {
        console.error('[competitor-lookup] save error:', saveErr.message);
        throw saveErr;
      }
      return new Response(JSON.stringify({ saved }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ANALYZE (AI SWOT + comparison) ───────────────────────
    if (action === 'analyze') {
      const { competitor_id } = body;

      // Fetch competitor record
      const { data: comp } = await supabase
        .from('competitors').select('*').eq('id', competitor_id).single();
      if (!comp) return new Response(JSON.stringify({ error: 'Competitor not found' }), { status: 404, headers: corsHeaders });

      // Strategy 1: social_accounts table (any platform)
      const { data: allOwnAccounts } = await supabase
        .from('social_accounts')
        .select('id, followers_count, platform, account_name, username')
        .eq('workspace_id', workspace_id);


      // Pick Instagram first, fall back to first account found
      const ownAccount = allOwnAccounts?.find(a => a.platform === 'Instagram')
        ?? allOwnAccounts?.[0]
        ?? null;

      // Strategy 2: platform_connections (has follower data from sync)
      const { data: ownConn } = await supabase
        .from('platform_connections')
        .select('id, platform, provider_username, metadata')
        .eq('workspace_id', workspace_id)
        .eq('platform', 'Instagram')
        .maybeSingle();


      // Fetch recent account_metrics for ER
      const { data: ownMetrics } = ownAccount?.id ? await supabase
        .from('account_metrics')
        .select('followers, engagement_rate, metric_date')
        .eq('social_account_id', ownAccount.id)
        .order('metric_date', { ascending: false })
        .limit(30) : { data: null };


      // Fetch recent content for ER + type breakdown
      const { data: ownContents } = await supabase
        .from('contents')
        .select('content_type, content_metrics(engagement_rate)')
        .eq('workspace_id', workspace_id)
        .order('published_at', { ascending: false })
        .limit(30);

      // Resolve followers: social_accounts → account_metrics → connection metadata
      const ownFollowers: number =
        ownAccount?.followers_count
        || ownMetrics?.[0]?.followers
        || (ownConn?.metadata as any)?.followers_count
        || 0;

      // Resolve ER: account_metrics → content_metrics
      const ownAvgER: number = ownMetrics?.length
        ? Number((ownMetrics.reduce((s: number, r: any) => s + (Number(r.engagement_rate) || 0), 0) / ownMetrics.length).toFixed(2))
        : ownContents?.length
          ? Number((ownContents.reduce((s: number, r: any) => s + (Number(r.content_metrics?.[0]?.engagement_rate) || 0), 0) / ownContents.length).toFixed(2))
          : 0;

      const ownPostTypes = (ownContents ?? []).reduce((acc: Record<string,number>, r: any) => {
        const ct = r.content_type ?? 'Photo';
        acc[ct] = (acc[ct] ?? 0) + 1; return acc;
      }, {});
      const topOwnType = Object.entries(ownPostTypes).sort((a,b) => b[1]-a[1])[0]?.[0] ?? 'Foto';


      // Check for user-provided API key in workspace_settings
      const { data: wsSettings } = await supabase
        .from('workspace_settings')
        .select('ai_api_key')
        .eq('workspace_id', workspace_id)
        .maybeSingle();

      const userApiKey    = wsSettings?.ai_api_key?.trim() ?? '';
      const serverApiKey  = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
      const activeKey     = userApiKey || serverApiKey;

      let content: Record<string, unknown>;

      if (activeKey) {
        // ── Use Anthropic API ──────────────────────────────────
        const prompt = `Kamu adalah analis media sosial senior. Berikan analisis kompetitor Instagram berbahasa Indonesia yang ringkas dan actionable.

DATA KOMPETITOR:
- Nama: ${comp.name} (@${comp.username?.replace('@','')})
- Bio: ${comp.biography || '-'}
- Followers: ${comp.followers_count?.toLocaleString('id-ID')}
- Engagement Rate: ${comp.engagement_rate}%
- Post/minggu: ${comp.posting_freq_weekly}×
- Total post: ${comp.media_count ?? '-'}
- Format terpopuler: ${comp.top_content_type || 'IMAGE'}

DATA AKUN KITA:
- Followers: ${ownFollowers.toLocaleString('id-ID')}
- Avg ER: ${ownAvgER}%
- Format terpopuler: ${topOwnType}

Berikan JSON dengan format TEPAT berikut (tanpa markdown, hanya JSON murni):
{
  "strength": "2-3 kalimat singkat tentang kekuatan utama kompetitor",
  "weakness": "2-3 kalimat singkat tentang kelemahan kompetitor yang bisa dimanfaatkan",
  "opportunity": "2-3 kalimat singkat tentang peluang spesifik untuk akun kita berdasarkan gap kompetitor",
  "comparison_summary": "1 paragraf membandingkan performa kompetitor vs akun kita",
  "recommendations": ["rekomendasi 1 yang spesifik dan actionable", "rekomendasi 2", "rekomendasi 3", "rekomendasi 4"]
}`;

        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key':         activeKey,
            'anthropic-version': '2023-06-01',
            'Content-Type':      'application/json',
          },
          body: JSON.stringify({
            model:      'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages:   [{ role: 'user', content: prompt }],
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error('[analyze] Anthropic error:', errText.slice(0, 300));
          // Fall through to template on API error
          content = pickTemplate(
            comp.followers_count ?? 0,
            comp.engagement_rate ?? 0,
            comp.posting_freq_weekly ?? 0,
            comp.top_content_type ?? 'IMAGE',
            ownFollowers,
            ownAvgER,
            comp.name ?? comp.username,
          );
        } else {
          const aiJson   = await aiRes.json();
          const rawText  = aiJson.content?.[0]?.text ?? '{}';
          const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          content = JSON.parse(jsonText);
        }
      } else {
        // ── Fallback: template-based analysis ─────────────────
        console.log('[analyze] no API key — using template');
        content = pickTemplate(
          comp.followers_count ?? 0,
          comp.engagement_rate ?? 0,
          comp.posting_freq_weekly ?? 0,
          comp.top_content_type ?? 'IMAGE',
          ownFollowers,
          ownAvgER,
          comp.name ?? comp.username,
        );
      }

      // Save SWOT back to competitor
      const { error: updateErr } = await supabase
        .from('competitors')
        .update({
          strength:           content.strength,
          weakness:           content.weakness,
          opportunity:        content.opportunity,
          ai_analysis:        JSON.stringify({ comparison_summary: content.comparison_summary, recommendations: content.recommendations }),
        })
        .eq('id', competitor_id);

      if (updateErr) console.error('[analyze] update error:', updateErr.message);

      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[competitor-lookup] error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
