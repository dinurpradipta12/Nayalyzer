// ============================================================
// Competitor Scoring Engine
// All scores 0–100. Higher = better for competitor.
// ============================================================

/**
 * Calculate all 6 dimension scores for a competitor.
 * @param {object} competitor – merged competitor + metrics data
 * @param {object} userAccount – user's own account metrics for comparison
 */
export function scoreCompetitor(competitor, userAccount = null) {
  const growth      = calcGrowthScore(competitor);
  const engagement  = calcEngagementScore(competitor);
  const consistency = calcConsistencyScore(competitor);
  const quality     = calcContentQualityScore(competitor);
  const virality    = calcViralityScore(competitor);
  const diff        = calcDifferentiationScore(competitor, userAccount);

  const round = n => Math.round(isNaN(n) ? 0 : n);
  const gr = round(growth), en = round(engagement), co = round(consistency),
        qu = round(quality), vi = round(virality), di = round(diff);
  const overall = Math.round(gr*0.20 + en*0.25 + co*0.15 + qu*0.20 + vi*0.15 + di*0.05);

  return { growth: gr, engagement: en, consistency: co, quality: qu, virality: vi, differentiation: di, overall };
}

// ── Growth Score (0–100) ─────────────────────────────────────
// Based on follower growth rate and absolute growth trend
function calcGrowthScore(c) {
  const rate = c.followerGrowthRate ?? c.follower_growth_rate ?? 0; // % per month
  // 0%→0, 1%→30, 3%→60, 5%→80, 10%+→100
  if (rate <= 0)   return 0;
  if (rate >= 10)  return 100;
  if (rate >= 5)   return 80 + ((rate - 5) / 5) * 20;
  if (rate >= 3)   return 60 + ((rate - 3) / 2) * 20;
  if (rate >= 1)   return 30 + ((rate - 1) / 2) * 30;
  return Math.round(rate * 30);
}

// ── Engagement Score (0–100) ──────────────────────────────────
function calcEngagementScore(c) {
  const er = c.engagementRate ?? c.average_engagement_rate ?? c.engagement_rate ?? 0;
  // Industry benchmark: <1%=poor, 1-3%=avg, 3-6%=good, 6%+=excellent
  if (er >= 10) return 100;
  if (er >= 6)  return 80 + ((er - 6) / 4) * 20;
  if (er >= 3)  return 55 + ((er - 3) / 3) * 25;
  if (er >= 1)  return 25 + ((er - 1) / 2) * 30;
  return Math.round(er * 25);
}

// ── Consistency Score (0–100) ─────────────────────────────────
// Posts per week: 0→0, 1→30, 3→60, 5→80, 7+→100
function calcConsistencyScore(c) {
  const freq = c.postingFrequencyNum ?? parseFrequency(c.postingFrequency ?? c.posting_frequency ?? 0);
  if (freq >= 7)  return 100;
  if (freq >= 5)  return 80 + ((freq - 5) / 2) * 20;
  if (freq >= 3)  return 60 + ((freq - 3) / 2) * 20;
  if (freq >= 1)  return 30 + ((freq - 1) / 2) * 30;
  return 0;
}

// ── Content Quality Score (0–100) ─────────────────────────────
// Based on avg engagement per post + content format diversity
function calcContentQualityScore(c) {
  const avgLikes    = c.avgLikes ?? c.average_likes ?? 0;
  const avgComments = c.avgComments ?? c.average_comments ?? 0;

  // Quality proxy: comment-to-like ratio indicates genuine interaction
  const commentRatio = avgLikes > 0 ? avgComments / avgLikes : 0;
  // 0→0, 0.02→40, 0.05→70, 0.1→90, 0.15+→100
  let ratioScore = 0;
  if (commentRatio >= 0.15) ratioScore = 100;
  else if (commentRatio >= 0.1)  ratioScore = 90 + ((commentRatio - 0.1) / 0.05) * 10;
  else if (commentRatio >= 0.05) ratioScore = 70 + ((commentRatio - 0.05) / 0.05) * 20;
  else if (commentRatio >= 0.02) ratioScore = 40 + ((commentRatio - 0.02) / 0.03) * 30;
  else ratioScore = Math.round(commentRatio * 2000);

  // Absolute likes score (relative benchmark)
  const likesScore = Math.min(100, Math.round((avgLikes / 5000) * 100));

  return Math.round((ratioScore * 0.6 + likesScore * 0.4));
}

// ── Virality Score (0–100) ────────────────────────────────────
// Based on shares and saves (amplification signals)
function calcViralityScore(c) {
  const avgShares = c.avgShares ?? c.average_shares ?? 0;
  const avgLikes  = c.avgLikes  || c.average_likes  || 1;
  const shareRate = avgShares / avgLikes;

  // 0→0, 0.01→20, 0.05→60, 0.1→85, 0.2+→100
  if (shareRate >= 0.2)   return 100;
  if (shareRate >= 0.1)   return 85  + ((shareRate - 0.1) / 0.1) * 15;
  if (shareRate >= 0.05)  return 60  + ((shareRate - 0.05) / 0.05) * 25;
  if (shareRate >= 0.01)  return 20  + ((shareRate - 0.01) / 0.04) * 40;
  return Math.round(shareRate * 2000);
}

// ── Differentiation Score (0–100) ─────────────────────────────
// How different is the competitor's content pillar from the user's?
// Higher = they occupy different niches (= less direct threat)
function calcDifferentiationScore(competitor, user) {
  if (!user) return 50; // unknown
  const cPillar = (competitor.topContentPillar ?? competitor.top_content_pillar ?? '').toLowerCase();
  const uPillar = (user.topContentPillar ?? '').toLowerCase();
  if (!cPillar || !uPillar) return 50;
  return cPillar === uPillar ? 20 : 75; // same niche = more threat = lower diff score
}

// ── Gap Analysis ───────────────────────────────────────────────
export function calcGapAnalysis(userAccount, competitor) {
  const gaps = [];

  // Engagement gap
  const userER  = userAccount.engagementRate  ?? 0;
  const compER  = competitor.engagementRate   ?? 0;
  const erDiff  = compER - userER;
  gaps.push({
    dimension: 'Engagement Rate',
    user:  `${userER.toFixed(1)}%`,
    comp:  `${compER.toFixed(1)}%`,
    delta: erDiff,
    status: erDiff > 0.5 ? 'behind' : erDiff < -0.5 ? 'ahead' : 'parity',
    priority: Math.abs(erDiff) > 2 ? 'high' : Math.abs(erDiff) > 1 ? 'medium' : 'low',
    action: erDiff > 0
      ? `Tingkatkan interaksi dengan CTA yang lebih spesifik dan reply komentar dalam 1 jam pertama.`
      : `Pertahankan dan fokus ke kualitas konten.`,
  });

  // Follower growth gap
  const userGR = userAccount.followerGrowthRate ?? 0;
  const compGR = competitor.followerGrowthRate  ?? 0;
  const grDiff = compGR - userGR;
  gaps.push({
    dimension: 'Pertumbuhan Follower',
    user:  `${userGR.toFixed(1)}%/bln`,
    comp:  `${compGR.toFixed(1)}%/bln`,
    delta: grDiff,
    status: grDiff > 0.5 ? 'behind' : grDiff < -0.5 ? 'ahead' : 'parity',
    priority: Math.abs(grDiff) > 2 ? 'high' : Math.abs(grDiff) > 1 ? 'medium' : 'low',
    action: grDiff > 0
      ? `Coba format konten yang sama dengan kompetitor — khususnya ${competitor.topContentType ?? 'Reels'}.`
      : `Growth kamu lebih baik. Fokus konversi follower baru ke engaged community.`,
  });

  // Posting frequency gap
  const userFreq = parseFrequency(userAccount.postingFrequency ?? 0);
  const compFreq = parseFrequency(competitor.postingFrequency  ?? 0);
  const freqDiff = compFreq - userFreq;
  gaps.push({
    dimension: 'Frekuensi Posting',
    user:  `${userFreq}x/minggu`,
    comp:  `${compFreq}x/minggu`,
    delta: freqDiff,
    status: freqDiff > 1 ? 'behind' : freqDiff < -1 ? 'ahead' : 'parity',
    priority: freqDiff > 3 ? 'high' : freqDiff > 1 ? 'medium' : 'low',
    action: freqDiff > 0
      ? `Tingkatkan ke ${Math.min(compFreq, userFreq + 2)}x/minggu secara bertahap. Batch produksi konten setiap Minggu.`
      : `Frekuensi kamu sudah lebih tinggi. Pastikan kualitas tetap konsisten.`,
  });

  // Content format gap
  const userFormat = userAccount.topContentType ?? 'Carousel';
  const compFormat = competitor.topContentType  ?? 'Reels';
  gaps.push({
    dimension: 'Format Konten Utama',
    user:  userFormat,
    comp:  compFormat,
    delta: 0,
    status: userFormat === compFormat ? 'parity' : 'opportunity',
    priority: userFormat !== compFormat ? 'medium' : 'low',
    action: userFormat !== compFormat
      ? `Kompetitor dominan di ${compFormat}. Coba eksperimen 2–3 konten ${compFormat} untuk test resonansi.`
      : `Kamu dan kompetitor sama-sama fokus di ${compFormat}. Cari diferensiasi di angle/pillar.`,
  });

  // Content pillar gap
  const userPillar = userAccount.topContentPillar ?? 'Edukasi';
  const compPillar = competitor.topContentPillar  ?? 'Hiburan';
  gaps.push({
    dimension: 'Pillar Konten Utama',
    user:  userPillar,
    comp:  compPillar,
    delta: 0,
    status: userPillar === compPillar ? 'parity' : 'opportunity',
    priority: 'low',
    action: userPillar !== compPillar
      ? `Kompetitor fokus di pillar "${compPillar}" — ini bisa jadi celah atau diferensiasi. Analisa apakah audiens kamu juga menginginkan konten tersebut.`
      : `Pillar sama. Bedakan dengan angle yang lebih spesifik dan niche.`,
  });

  return gaps;
}

// ── Helpers ───────────────────────────────────────────────────
export function parseFrequency(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function scoreLabel(score) {
  if (score >= 80) return { label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (score >= 60) return { label: 'Good',      color: 'text-blue-600',    bg: 'bg-blue-50'    };
  if (score >= 40) return { label: 'Average',   color: 'text-amber-600',   bg: 'bg-amber-50'   };
  if (score >= 20) return { label: 'Weak',      color: 'text-orange-600',  bg: 'bg-orange-50'  };
  return               { label: 'Poor',      color: 'text-red-600',     bg: 'bg-red-50'     };
}

export function gapStatusStyle(status) {
  if (status === 'ahead')       return { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Kamu Unggul' };
  if (status === 'behind')      return { color: 'text-red-600',     bg: 'bg-red-50',     label: 'Perlu Kejar' };
  if (status === 'opportunity') return { color: 'text-violet-600',  bg: 'bg-violet-50',  label: 'Peluang'     };
  return                               { color: 'text-gray-600',    bg: 'bg-gray-50',    label: 'Seimbang'    };
}
