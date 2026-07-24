// profile-analyzer — scrape public profile data for Instagram / TikTok / Threads
// POST { platform: 'instagram' | 'tiktok' | 'threads', username: string }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function scrapeInstagram(username: string) {
  const res = await fetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    {
      headers: {
        'User-Agent': UA,
        'x-ig-app-id': '936619743392459',
        Accept: 'application/json',
      },
    },
  );
  if (!res.ok) throw new Error(`IG responded ${res.status}`);
  const json = await res.json();
  const u = json?.data?.user;
  if (!u) throw new Error('profile not found');

  const media = (u.edge_owner_to_timeline_media?.edges ?? []).map((e: { node: Record<string, unknown> }) => e.node);
  const posts = media.map((n: Record<string, unknown>) => ({
    id: n.id,
    caption: ((n.edge_media_to_caption as Record<string, unknown>)?.edges as Array<{node:{text:string}}>)?.[0]?.node?.text ?? '',
    thumbnail: n.display_url ?? n.thumbnail_src,
    likes: (n.edge_liked_by as { count?: number })?.count ?? (n.edge_media_preview_like as { count?: number })?.count ?? 0,
    comments: (n.edge_media_to_comment as { count?: number })?.count ?? 0,
    views: (n.video_view_count as number) ?? null,
    is_video: n.is_video ?? false,
    taken_at: n.taken_at_timestamp,
    url: `https://www.instagram.com/p/${n.shortcode}/`,
  }));

  return {
    source: 'live',
    platform: 'instagram',
    username: u.username,
    full_name: u.full_name,
    biography: u.biography,
    profile_pic: u.profile_pic_url_hd ?? u.profile_pic_url,
    followers: u.edge_followed_by?.count ?? 0,
    following: u.edge_follow?.count ?? 0,
    posts_count: u.edge_owner_to_timeline_media?.count ?? 0,
    is_verified: u.is_verified,
    is_private: u.is_private,
    external_url: u.external_url,
    recent_posts: posts,
  };
}

async function scrapeTikTok(username: string) {
  const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`TikTok responded ${res.status}`);
  const html = await res.text();

  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s);
  if (!m) throw new Error('TikTok data blob not found');
  const data = JSON.parse(m[1]);
  const userInfo = data?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
  const u = userInfo?.user;
  const stats = userInfo?.stats;
  if (!u) throw new Error('profile not found');

  return {
    source: 'live',
    platform: 'tiktok',
    username: u.uniqueId,
    full_name: u.nickname,
    biography: u.signature,
    profile_pic: u.avatarLarger ?? u.avatarMedium,
    followers: stats?.followerCount ?? 0,
    following: stats?.followingCount ?? 0,
    posts_count: stats?.videoCount ?? 0,
    likes_total: stats?.heartCount ?? 0,
    is_verified: u.verified,
    is_private: u.privateAccount,
    recent_posts: [],
  };
}

function parseJsonString(value = '') {
  const decoded = value
    .replace(/&amp;/g, '&')
    .replace(/&#064;/g, '@')
    .replace(/&#x2022;/g, '•')
    .replace(/&quot;/g, '"');
  try {
    return JSON.parse(`"${decoded.replace(/"/g, '\\"')}"`);
  } catch {
    return decoded.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
  }
}

function pickFirstMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return parseJsonString(match[1]);
  }
  return '';
}

function parseCompactCount(raw = '') {
  const clean = raw.replace(/,/g, '').trim().toLowerCase();
  const match = clean.match(/([\d.]+)\s*([km])?/);
  if (!match) return 0;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return 0;
  if (match[2] === 'm') return Math.round(num * 1_000_000);
  if (match[2] === 'k') return Math.round(num * 1_000);
  return Math.round(num);
}

async function scrapeThreads(username: string) {
  const res = await fetch(`https://www.threads.com/@${encodeURIComponent(username)}`, {
    headers: {
      'User-Agent': MOBILE_UA,
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`Threads responded ${res.status}`);
  const html = await res.text();

  const ogTitle = pickFirstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
  ]);
  const ogDescription = pickFirstMatch(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
  ]);
  const profilePic = pickFirstMatch(html, [
    /"profile_pic_url"\s*:\s*"([^"]+)"/,
    /"profile_pic_url_hd"\s*:\s*"([^"]+)"/,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const fullName = pickFirstMatch(html, [
    /"full_name"\s*:\s*"([^"]+)"/,
    /"name"\s*:\s*"([^"]+)"/,
  ]) || ogTitle.replace(/\s*\(@[^)]+\).*$/i, '').replace(/\s*on Threads.*$/i, '').trim();
  const bio = pickFirstMatch(html, [
    /"biography"\s*:\s*"([^"]*)"/,
    /"bio"\s*:\s*"([^"]*)"/,
  ]) || ogDescription.replace(/\s*\d[\d,.]*\s*[kKmM]?\s+followers?.*$/i, '').trim();
  const followers = parseCompactCount(
    pickFirstMatch(html, [
      /"follower_count"\s*:\s*(\d+)/,
      /"followers_count"\s*:\s*(\d+)/,
      /([\d,.]+\s*[kKmM]?)\s+followers/i,
    ]),
  );
  const postsCount = parseCompactCount(
    pickFirstMatch(html, [
      /"threads_count"\s*:\s*(\d+)/,
      /"media_count"\s*:\s*(\d+)/,
    ]),
  );

  return {
    source: 'live',
    platform: 'threads',
    username,
    full_name: fullName || username,
    biography: bio,
    profile_pic: profilePic,
    followers,
    following: 0,
    posts_count: postsCount,
    is_verified: /"is_verified"\s*:\s*true/.test(html),
    is_private: /"is_private"\s*:\s*true/.test(html),
    external_url: '',
    recent_posts: [],
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Image proxy: GET ?img=<encoded url> — bypass CDN hotlink protection
  const url = new URL(req.url);
  const imgUrl = url.searchParams.get('img');
  if (req.method === 'GET' && imgUrl) {
    try {
      const allowed = /^https:\/\/[^/]*(cdninstagram\.com|fbcdn\.net|tiktokcdn[^/]*\.com)\//.test(imgUrl);
      if (!allowed) return new Response('forbidden', { status: 403, headers: corsHeaders });
      const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': UA } });
      if (!imgRes.ok) return new Response('upstream error', { status: 502, headers: corsHeaders });
      return new Response(imgRes.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': imgRes.headers.get('Content-Type') ?? 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch {
      return new Response('proxy error', { status: 502, headers: corsHeaders });
    }
  }

  try {
    const { platform, username } = await req.json();
    if (!platform || !username) {
      return new Response(JSON.stringify({ error: 'platform dan username wajib diisi' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clean = String(username).replace(/^@/, '').trim();
    let result;
    if (platform === 'instagram') result = await scrapeInstagram(clean);
    else if (platform === 'tiktok') result = await scrapeTikTok(clean);
    else if (platform === 'threads') result = await scrapeThreads(clean);
    else {
      return new Response(JSON.stringify({ error: 'platform harus instagram, tiktok, atau threads' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[profile-analyzer]', e.message);
    return new Response(JSON.stringify({ error: e.message, source: 'error' }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
