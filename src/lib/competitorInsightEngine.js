// ============================================================
// Competitor AI Insight Engine
// Rule-based fallback (no OpenAI dependency required)
// ============================================================

import { scoreCompetitor, calcGapAnalysis, parseFrequency } from './competitorScoring';

/**
 * Generate full competitor insight for one competitor vs user account.
 * Returns structured insight matching competitor_insights table shape.
 */
export function generateCompetitorInsight(competitor, userAccount, contents = []) {
  const scores    = scoreCompetitor(competitor, userAccount);
  const gaps      = calcGapAnalysis(userAccount, competitor);
  const rec       = buildRecommendations(competitor, userAccount, gaps, scores, contents);

  return {
    insight_type:  'full',
    summary:       buildSummary(competitor, userAccount, scores),
    gap_analysis:  { gaps, generated_at: new Date().toISOString() },
    recommendation: rec,
    score:         scores,
  };
}

// ── Summary paragraph ─────────────────────────────────────────
function buildSummary(competitor, user, scores) {
  const compName = competitor.name ?? competitor.username ?? 'Kompetitor';
  const platform = competitor.platform ?? 'Instagram';
  const threat   = scores.overall >= 70 ? 'ancaman serius' : scores.overall >= 50 ? 'kompetitor aktif' : 'kompetitor dengan potensi terbatas';

  const strengths = [];
  if (scores.engagement   >= 70) strengths.push('engagement rate tinggi');
  if (scores.growth       >= 70) strengths.push('pertumbuhan follower cepat');
  if (scores.consistency  >= 70) strengths.push('konsistensi posting');
  if (scores.virality     >= 70) strengths.push('konten viral');

  const strengthStr = strengths.length
    ? ` Keunggulan utama mereka: ${strengths.join(', ')}.`
    : '';

  return `${compName} adalah ${threat} di ${platform} dengan overall score ${scores.overall}/100.${strengthStr} Analisis ini mencakup gap engagement, frekuensi konten, format, dan pillar konten untuk membantu kamu mengambil peluang yang belum dioptimalkan.`;
}

// ── Recommendations ───────────────────────────────────────────
function buildRecommendations(competitor, user, gaps, scores, contents) {
  const recs = [];
  const compName = competitor.name ?? 'kompetitor';

  // 1. What competitor does better
  const compAdvantages = [];
  if (scores.engagement  >= 70) compAdvantages.push(`engagement rate lebih tinggi (${(competitor.engagementRate ?? 0).toFixed(1)}%)`);
  if (scores.growth      >= 70) compAdvantages.push(`growth lebih agresif (+${(competitor.followerGrowthRate ?? 0).toFixed(1)}%/bln)`);
  if (scores.consistency >= 70) compAdvantages.push(`posting lebih konsisten (${parseFrequency(competitor.postingFrequency)}x/minggu)`);
  if (scores.virality    >= 70) compAdvantages.push('konten lebih sering di-share');

  recs.push({
    type:    'competitor_advantage',
    title:   `Apa yang ${compName} lakukan lebih baik`,
    points:  compAdvantages.length
      ? compAdvantages
      : ['Data belum cukup untuk menentukan keunggulan spesifik. Tambahkan lebih banyak data konten kompetitor.'],
    icon: 'trophy',
  });

  // 2. What user does better
  const userScore = scoreCompetitor(user, competitor);
  const userAdvantages = [];
  if (userScore.engagement  > scores.engagement)  userAdvantages.push('engagement rate lebih tinggi');
  if (userScore.growth      > scores.growth)      userAdvantages.push('growth follower lebih cepat');
  if (userScore.consistency > scores.consistency) userAdvantages.push('frekuensi posting lebih konsisten');

  recs.push({
    type:   'user_advantage',
    title:  'Apa yang akun kamu lakukan lebih baik',
    points: userAdvantages.length
      ? userAdvantages
      : ['Fokus tingkatkan satu dimensi dulu — engagement rate adalah yang paling impactful.'],
    icon: 'star',
  });

  // 3. Untapped opportunities
  const opportunities = [];
  const formatGap = gaps.find(g => g.dimension === 'Format Konten Utama');
  const pillarGap = gaps.find(g => g.dimension === 'Pillar Konten Utama');

  if (formatGap?.status === 'opportunity') {
    opportunities.push(`Format ${competitor.topContentType ?? 'Reels'} belum dimaksimalkan — kompetitor sudah dominan di sana tapi audiens kamu mungkin juga menginginkannya.`);
  }
  if (pillarGap?.status === 'opportunity') {
    opportunities.push(`Pillar "${competitor.topContentPillar ?? 'Hiburan'}" belum kamu sentuh — ini bisa jadi differensiasi atau ekspansi.`);
  }
  if ((competitor.engagementRate ?? 0) > 6) {
    opportunities.push('Konten interaktif (poll, Q&A, question box) bisa mendorong engagement rate seperti kompetitor.');
  }
  opportunities.push('Analisis caption panjang vs pendek untuk lihat mana yang lebih resonan di audiens yang sama.');

  recs.push({
    type:   'opportunity',
    title:  'Peluang yang belum diambil',
    points: opportunities,
    icon:   'lightbulb',
  });

  // 4. Content angles to try
  const topContent = contents
    .filter(c => c.is_top_performer)
    .slice(0, 3);

  const angles = [];
  if (topContent.length) {
    topContent.forEach(c => {
      angles.push(`"${c.title ?? c.hook_style ?? c.content_type}" — ${c.estimated_engagement_rate?.toFixed(1) ?? '?'}% ER`);
    });
  } else {
    angles.push(`${competitor.topContentType ?? 'Reels'} dengan hook style pertanyaan + problem-solution`);
    angles.push('Thread opini pendek yang mengundang debat / diskusi');
    angles.push('Behind-the-scenes proses kerja — konten relatable selalu performanya baik');
  }

  recs.push({
    type:   'content_angles',
    title:  'Content angle yang bisa dicoba',
    points: angles,
    icon:   'sparkles',
  });

  // 5. Risk of copying
  recs.push({
    type:   'risk',
    title:  `Risiko jika meniru ${compName}`,
    points: [
      'Audiens yang overlap bisa membandingkan langsung — pastikan ada diferensiasi angle atau value unik.',
      'Terlalu mirip bisa membuat akun kamu terlihat sebagai "follower" bukan leader di niche.',
      'Jika kompetitor sudah established, kamu perlu 2–3x effort untuk bersaing di konten yang sama.',
      'Fokus pada kelebihan kamu sendiri, adaptasi format — bukan copy paste konten.',
    ],
    icon: 'shield',
  });

  // 6. Experiment recommendations
  const highGaps = gaps.filter(g => g.priority === 'high');
  const experiments = highGaps.map(g => `Eksperimen ${g.dimension}: ${g.action}`);
  if (!experiments.length) {
    experiments.push('A/B test hook style: pertanyaan vs statement kuat di 3 detik pertama');
    experiments.push('Test posting frequency: tambah 1 konten/minggu selama 3 minggu, ukur reach per post');
  }
  experiments.push('Repurpose 3 konten top performer ke format yang digunakan kompetitor');

  recs.push({
    type:   'experiments',
    title:  'Rekomendasi eksperimen',
    points: experiments,
    icon:   'flask',
  });

  return recs;
}

// ── CSV Import Template ───────────────────────────────────────
export const COMPETITOR_CSV_TEMPLATE = [
  'content_url,title,caption,content_type,content_pillar,hook_style,cta_style,hashtags,published_at,likes,comments,shares,saves,views',
  'https://instagram.com/p/xxx,"5 Tips Desain","Buat desain yang...",Carousel,Edukasi,Question,Save,"desain,tips,kreasi",2026-06-01,1200,48,32,240,8400',
  'https://tiktok.com/@x/video/1,"Hook Problem","Pernah ngerasa...",Short Video,Edukasi,Problem-Solution,Follow,"tiktok,desain",2026-06-03,4800,180,640,0,42000',
].join('\n');

export const COMPETITOR_CSV_FIELDS = [
  { key: 'content_url',              label: 'URL Konten',        required: false },
  { key: 'title',                    label: 'Judul / Caption Singkat', required: false },
  { key: 'caption',                  label: 'Caption Lengkap',   required: false },
  { key: 'content_type',             label: 'Format',            required: true,
    options: ['Photo','Carousel','Reels','Short Video','Long Video','Story','Thread Opini','Thread Tips','Poll','Live','Other'] },
  { key: 'content_pillar',           label: 'Pillar Konten',     required: false },
  { key: 'hook_style',               label: 'Hook Style',        required: false,
    options: ['Question','Problem-Solution','Stat/Data','Story','Controversy','Trend','Tutorial','None'] },
  { key: 'cta_style',                label: 'CTA Style',         required: false,
    options: ['Follow','Save','Comment','Share','Link in Bio','DM','Tag Friend','None'] },
  { key: 'hashtags',                 label: 'Hashtag (koma)',    required: false },
  { key: 'published_at',             label: 'Tanggal Publish',   required: false },
  { key: 'likes',                    label: 'Likes',             required: false },
  { key: 'comments',                 label: 'Comments',          required: false },
  { key: 'shares',                   label: 'Shares',            required: false },
  { key: 'saves',                    label: 'Saves',             required: false },
  { key: 'views',                    label: 'Views',             required: false },
];
