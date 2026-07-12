import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { generateCompetitorInsight } from '../lib/competitorInsightEngine';
import { scoreCompetitor } from '../lib/competitorScoring';

// ── Demo data ─────────────────────────────────────────────────
const DEMO_COMPETITORS = [
  {
    id: 'demo-c1', name: 'Studio Kreatif Bali', username: '@studiokreatifbali',
    platform: 'Instagram', followers: 68400, followerGrowthRate: 2.1,
    postingFrequency: 5, postingFrequencyNum: 5,
    engagementRate: 4.1, avgLikes: 1200, avgComments: 48, avgShares: 32,
    topContentType: 'Reels', topContentPillar: 'Edukasi',
    hookStyle: 'Tutorial', ctaStyle: 'Follow',
    strength: 'Visual konsisten, branding kuat',
    weakness: 'Engagement rendah di konten edukasi',
    opportunity: 'Belum memanfaatkan Reels & video pendek',
    postingTime: '19:00–21:00', hashtagCount: 8,
  },
  {
    id: 'demo-c2', name: 'Desain Kita ID', username: '@desainkitaid',
    platform: 'TikTok', followers: 142000, followerGrowthRate: 4.8,
    postingFrequency: 7, postingFrequencyNum: 7,
    engagementRate: 5.5, avgLikes: 4800, avgComments: 180, avgShares: 640,
    topContentType: 'Short Video', topContentPillar: 'Hiburan',
    hookStyle: 'Problem-Solution', ctaStyle: 'Follow',
    strength: 'Konsisten upload, trending sound bagus',
    weakness: 'Kurang diversifikasi platform',
    opportunity: 'Audiens siap untuk konten premium/course',
    postingTime: '20:00–22:00', hashtagCount: 12,
  },
  {
    id: 'demo-c3', name: 'Brand Builder Co', username: '@brandbuildco',
    platform: 'Instagram', followers: 38200, followerGrowthRate: 0.8,
    postingFrequency: 3, postingFrequencyNum: 3,
    engagementRate: 4.8, avgLikes: 820, avgComments: 32, avgShares: 18,
    topContentType: 'Carousel', topContentPillar: 'Edukasi',
    hookStyle: 'Question', ctaStyle: 'Save',
    strength: 'Niche spesifik branding bisnis UMKM',
    weakness: 'Posting tidak konsisten, reach menurun',
    opportunity: 'Belum aktif di Threads & TikTok',
    postingTime: '12:00–14:00', hashtagCount: 6,
  },
  {
    id: 'demo-c4', name: 'Kreasi Visual Studio', username: '@kreasivisual',
    platform: 'Threads', followers: 8400, followerGrowthRate: 6.2,
    postingFrequency: 14, postingFrequencyNum: 14,
    engagementRate: 6.2, avgLikes: 180, avgComments: 62, avgShares: 44,
    topContentType: 'Thread Opini', topContentPillar: 'Opini',
    hookStyle: 'Controversy', ctaStyle: 'Comment',
    strength: 'Engagement tinggi, komunitas aktif',
    weakness: 'Belum ada di TikTok dan Instagram',
    opportunity: 'Threads masih early mover — positioning kuat',
    postingTime: '12:00–13:00', hashtagCount: 0,
  },
];

const DEMO_CONTENTS = {
  'demo-c1': [
    { id: 'cc1', content_type: 'Reels', content_pillar: 'Edukasi', hook_style: 'Tutorial', cta_style: 'Follow', title: '5 Font Gratis Terbaik 2026', likes: 1840, comments: 62, shares: 48, views: 24000, estimated_engagement_rate: 8.2, is_top_performer: true, published_at: '2026-06-18' },
    { id: 'cc2', content_type: 'Carousel', content_pillar: 'Edukasi', hook_style: 'Question', cta_style: 'Save', title: 'Cara Pilih Warna Brand', likes: 1320, comments: 44, shares: 22, views: 0, estimated_engagement_rate: 6.1, is_top_performer: true, published_at: '2026-06-15' },
    { id: 'cc3', content_type: 'Photo', content_pillar: 'Promosi', hook_style: 'None', cta_style: 'DM', title: 'Paket Logo Bisnis', likes: 480, comments: 8, shares: 4, views: 0, estimated_engagement_rate: 2.1, is_top_performer: false, published_at: '2026-06-12' },
    { id: 'cc4', content_type: 'Reels', content_pillar: 'Behind-the-scenes', hook_style: 'Story', cta_style: 'Follow', title: 'Proses Buat Logo Klien', likes: 2100, comments: 84, shares: 96, views: 31000, estimated_engagement_rate: 9.4, is_top_performer: true, published_at: '2026-06-10' },
    { id: 'cc5', content_type: 'Carousel', content_pillar: 'Tips', hook_style: 'Stat/Data', cta_style: 'Save', title: 'Data: Konten Mana yang Paling Disukai?', likes: 980, comments: 38, shares: 14, views: 0, estimated_engagement_rate: 4.8, is_top_performer: false, published_at: '2026-06-08' },
  ],
  'demo-c2': [
    { id: 'cc6', content_type: 'Short Video', content_pillar: 'Hiburan', hook_style: 'Problem-Solution', cta_style: 'Follow', title: 'Canva vs Figma dalam 60 detik', likes: 6800, comments: 240, shares: 980, views: 84000, estimated_engagement_rate: 8.4, is_top_performer: true, published_at: '2026-06-20' },
    { id: 'cc7', content_type: 'Short Video', content_pillar: 'Trending', hook_style: 'Trend', cta_style: 'Follow', title: 'POV: Designer yang Diminta Revisi', likes: 12400, comments: 480, shares: 2100, views: 184000, estimated_engagement_rate: 10.2, is_top_performer: true, published_at: '2026-06-17' },
    { id: 'cc8', content_type: 'Short Video', content_pillar: 'Edukasi', hook_style: 'Tutorial', cta_style: 'Follow', title: 'Adobe Express untuk Pemula', likes: 3200, comments: 124, shares: 420, views: 48000, estimated_engagement_rate: 5.8, is_top_performer: false, published_at: '2026-06-14' },
  ],
  'demo-c3': [
    { id: 'cc9', content_type: 'Carousel', content_pillar: 'Edukasi', hook_style: 'Question', cta_style: 'Save', title: 'Kenapa Brand UMKM Sering Gagal?', likes: 1040, comments: 48, shares: 28, views: 0, estimated_engagement_rate: 7.2, is_top_performer: true, published_at: '2026-06-16' },
    { id: 'cc10', content_type: 'Photo', content_pillar: 'Inspirasi', hook_style: 'None', cta_style: 'None', title: 'Portofolio: Rebrand Kopi Lokal', likes: 820, comments: 24, shares: 12, views: 0, estimated_engagement_rate: 4.8, is_top_performer: false, published_at: '2026-06-10' },
  ],
  'demo-c4': [
    { id: 'cc11', content_type: 'Thread Opini', content_pillar: 'Opini', hook_style: 'Controversy', cta_style: 'Comment', title: 'Unpopular: Figma Overrated', likes: 240, comments: 88, shares: 56, views: 0, estimated_engagement_rate: 12.4, is_top_performer: true, published_at: '2026-06-19' },
    { id: 'cc12', content_type: 'Poll', content_pillar: 'Q&A', hook_style: 'Question', cta_style: 'Comment', title: 'Mana lebih penting: Tool atau Skill?', likes: 180, comments: 74, shares: 22, views: 0, estimated_engagement_rate: 9.8, is_top_performer: true, published_at: '2026-06-14' },
  ],
};

const DEMO_USER_ACCOUNT = {
  name: 'Naya Creative Studio', platform: 'Instagram',
  followers: 48700, followerGrowthRate: 2.6,
  postingFrequency: 4, postingFrequencyNum: 4,
  engagementRate: 4.8, avgLikes: 1100, avgComments: 52, avgShares: 28,
  topContentType: 'Carousel', topContentPillar: 'Edukasi',
};

// ── Hook ──────────────────────────────────────────────────────
export function useCompetitorIntelligence(workspaceId) {
  const [competitors, setCompetitors]     = useState([]);
  const [contents, setContents]           = useState({});   // { competitorId: [...] }
  const [insights, setInsights]           = useState({});   // { competitorId: insight }
  const [userAccount, setUserAccount]     = useState(DEMO_USER_ACCOUNT);
  const [loading, setLoading]             = useState(true);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const isDemo = !workspaceId || workspaceId === 'demo-ws' || !SUPABASE_ENABLED;

  // ── Fetch ────────────────────────────────────────────────────
  const fetch = useCallback(async () => {
    if (isDemo) {
      setCompetitors(DEMO_COMPETITORS);
      setContents(DEMO_CONTENTS);
      const ins = {};
      DEMO_COMPETITORS.forEach(c => {
        ins[c.id] = generateCompetitorInsight(c, DEMO_USER_ACCOUNT, DEMO_CONTENTS[c.id] ?? []);
      });
      setInsights(ins);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [{ data: comps }, { data: contData }, { data: ownAccounts }] = await Promise.all([
        supabase
          .from('competitors')
          .select('*, recent_posts, competitor_metrics(followers,follower_growth,average_engagement_rate,average_likes,average_comments,average_shares,posting_frequency,top_content_type,metric_date)')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true }),
        supabase
          .from('competitor_contents')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('published_at', { ascending: false }),
        supabase
          .from('account_metrics')
          .select('followers, engagement_rate, metric_date, social_accounts(platform, username, account_name, followers_count)')
          .eq('workspace_id', workspaceId)
          .order('metric_date', { ascending: false })
          .limit(10),
      ]);

      const igMetric = ownAccounts?.find(m => m.social_accounts?.platform === 'Instagram') ?? ownAccounts?.[0] ?? null;
      if (igMetric) {
        const sa = igMetric.social_accounts ?? {};
        setUserAccount({
          name: sa.account_name || sa.username || 'Akun Saya',
          platform: sa.platform ?? 'Instagram',
          followers: igMetric.followers ?? sa.followers_count ?? 0,
          engagementRate: igMetric.engagement_rate ?? 0,
          postingFrequency: DEMO_USER_ACCOUNT.postingFrequency,
          topContentType: DEMO_USER_ACCOUNT.topContentType,
          topContentPillar: DEMO_USER_ACCOUNT.topContentPillar,
        });
      }

      const mapped = (comps ?? []).map(c => {
        // Use competitor_metrics if available, otherwise fall back to direct columns
        const latest = (c.competitor_metrics ?? []).sort((a, b) =>
          new Date(b.metric_date) - new Date(a.metric_date))[0] ?? {};
        return {
          id: c.id, name: c.name, username: c.username,
          platform: c.platform, strength: c.strength, weakness: c.weakness,
          opportunity: c.opportunity, ai_analysis: c.ai_analysis,
          profile_picture_url: c.profile_picture_url,
          biography: c.biography,
          followers:          latest.followers          ?? c.followers_count         ?? 0,
          followerGrowthRate: 0,
          postingFrequency:   latest.posting_frequency  ?? c.posting_freq_weekly     ?? 0,
          postingFrequencyNum: latest.posting_frequency ?? c.posting_freq_weekly     ?? 0,
          engagementRate:     latest.average_engagement_rate ?? c.engagement_rate    ?? 0,
          avgLikes:           latest.average_likes      ?? 0,
          avgComments:        latest.average_comments   ?? 0,
          avgShares:          latest.average_shares     ?? 0,
          topContentType:     latest.top_content_type   ?? c.top_content_type        ?? '-',
          topContentPillar:   c.notes ?? '-',
        };
      });

      const contMap = {};
      (contData ?? []).forEach(row => {
        if (!contMap[row.competitor_id]) contMap[row.competitor_id] = [];
        contMap[row.competitor_id].push(row);
      });

      // Auto-generate content entries from recent_posts if no manual content exists
      (comps ?? []).forEach(c => {
        if (contMap[c.id]?.length || !Array.isArray(c.recent_posts) || !c.recent_posts.length) return;
        const followerCount = c.followers_count || 1;
        const avgLikes = c.recent_posts.reduce((s, p) => s + (p.like_count ?? p.likes ?? 0), 0) / c.recent_posts.length || 1;
        contMap[c.id] = c.recent_posts.map((p, i) => {
          const mediaType = p.media_type ?? '';
          const contentType = mediaType === 'VIDEO' ? 'Reels'
            : mediaType === 'CAROUSEL_ALBUM' ? 'Carousel'
            : 'Photo';
          const likes    = p.like_count ?? p.likes ?? 0;
          const comments = p.comments_count ?? p.comments ?? 0;
          const views    = p.view_count ?? p.views ?? 0;
          const er       = parseFloat(((likes + comments) / followerCount * 100).toFixed(2));
          return {
            id: `rp-${c.id}-${i}`,
            competitor_id: c.id,
            content_type:  contentType,
            content_pillar: '-',
            hook_style:    '-',
            cta_style:     '-',
            title:         (p.caption ?? '').slice(0, 100) || `Post ${i + 1}`,
            likes, comments,
            shares:        p.shares ?? 0,
            views,
            estimated_engagement_rate: er,
            is_top_performer: likes >= avgLikes * 1.5,
            published_at:  p.timestamp ?? p.published_at ?? null,
            permalink:     p.permalink ?? null,
            thumbnail_url: p.thumbnail_url ?? null,
          };
        });
      });

      // User asli dengan workspace kosong → tampilkan kosong, BUKAN data demo
      setCompetitors(mapped);
      setContents(contMap);

      const ins = {};
      mapped.forEach(c => {
        ins[c.id] = generateCompetitorInsight(c, userAccount, contMap[c.id] ?? []);
      });
      setInsights(ins);
    } catch {
      setCompetitors(DEMO_COMPETITORS);
      setContents(DEMO_CONTENTS);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isDemo]);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Add competitor ────────────────────────────────────────────
  const addCompetitor = async (payload) => {
    if (isDemo) {
      const newC = { id: `demo-c${Date.now()}`, ...payload, followerGrowthRate: 0, postingFrequencyNum: payload.postingFrequency ?? 0, engagementRate: payload.avgEngagementRate ?? 0, avgLikes: 0, avgComments: 0, avgShares: 0 };
      setCompetitors(p => [...p, newC]);
      setInsights(p => ({ ...p, [newC.id]: generateCompetitorInsight(newC, userAccount, []) }));
      return { data: newC };
    }
    const { data, error } = await supabase
      .from('competitors')
      .insert({ workspace_id: workspaceId, ...payload })
      .select().single();
    if (!error) await fetch();
    return { data, error };
  };

  // ── Add competitor contents (CSV import) ──────────────────────
  const addContents = async (competitorId, rows) => {
    if (isDemo) {
      setContents(p => ({ ...p, [competitorId]: [...(p[competitorId] ?? []), ...rows] }));
      const c = competitors.find(x => x.id === competitorId);
      if (c) setInsights(p => ({ ...p, [competitorId]: generateCompetitorInsight(c, userAccount, [...(contents[competitorId] ?? []), ...rows]) }));
      return { count: rows.length };
    }
    const inserts = rows.map(r => ({ ...r, workspace_id: workspaceId, competitor_id: competitorId }));
    const { error } = await supabase.from('competitor_contents').insert(inserts);
    if (!error) await fetch();
    return { error };
  };

  // ── Remove competitor ─────────────────────────────────────────
  const removeCompetitor = async (id) => {
    if (isDemo) {
      setCompetitors(p => p.filter(c => c.id !== id));
      return {};
    }
    const { error } = await supabase.from('competitors').delete().eq('id', id);
    if (!error) await fetch();
    return { error };
  };

  // ── Regenerate insight manually ───────────────────────────────
  const regenerateInsight = async (competitorId) => {
    setLoadingInsight(true);
    const c = competitors.find(x => x.id === competitorId);
    if (c) {
      const ins = generateCompetitorInsight(c, userAccount, contents[competitorId] ?? []);
      setInsights(p => ({ ...p, [competitorId]: ins }));
      if (!isDemo) {
        await supabase.from('competitor_insights').insert({
          workspace_id: workspaceId, competitor_id: competitorId, ...ins,
        });
      }
    }
    setLoadingInsight(false);
  };

  return {
    competitors, contents, insights, userAccount,
    loading, loadingInsight,
    reload: fetch,
    addCompetitor, removeCompetitor,
    addContents, regenerateInsight,
    isDemo,
  };
}
