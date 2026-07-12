// ============================================================
// NAYALYZER — IMPORT HELPERS
// Utilities untuk normalisasi, validasi, dan kalkulasi data import
// ============================================================

import Papa from 'papaparse';

// ─── Constants ───────────────────────────────────────────────
export const PLATFORMS = ['Instagram', 'TikTok', 'Threads'];

export const CONTENT_TYPES = [
  'Photo', 'Carousel', 'Reels', 'Short Video', 'Long Video',
  'Story', 'Thread Opini', 'Thread Tips', 'Poll', 'Live', 'Other',
];

// ─── detectPlatform ──────────────────────────────────────────
/**
 * Normalize platform name from various input formats.
 * Returns canonical platform name or null.
 */
export function detectPlatform(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  if (s.includes('instagram') || s === 'ig') return 'Instagram';
  if (s.includes('tiktok') || s === 'tt')    return 'TikTok';
  if (s.includes('thread'))                   return 'Threads';
  return null;
}

// ─── normalizeDate ───────────────────────────────────────────
/**
 * Normalize date string to YYYY-MM-DD.
 * Accepts: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, ISO string, timestamps.
 */
export function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) ;
  // Try native Date
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

// ─── normalizeNumber ─────────────────────────────────────────
export function normalizeNumber(raw, fallback = 0) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const n = Number(String(raw).replace(/[,\s]/g, ''));
  return isNaN(n) ? fallback : n;
}

// ─── calculateEngagementRate ─────────────────────────────────
/**
 * Calculate engagement rate from raw metrics.
 * ER = (likes + comments + shares + saves) / reach * 100
 */
export function calculateEngagementRate({ likes = 0, comments = 0, shares = 0, saves = 0, reach = 0, followers = 0 }) {
  const engagement = likes + comments + shares + saves;
  const base = reach || followers || 1;
  return Math.min(+(engagement / base * 100).toFixed(2), 100);
}

// ─── normalizeAnalyticsData ──────────────────────────────────
/**
 * Given raw CSV row + importType + columnMap,
 * returns a normalized object ready for Supabase insert.
 * Returns null if a required field is missing.
 */
export function normalizeAnalyticsData(rawRow, importType, columnMap) {
  // Build mapped row: { targetField: rawValue }
  const mapped = {};
  Object.entries(columnMap).forEach(([csvCol, targetField]) => {
    if (targetField && targetField !== '__skip__') {
      mapped[targetField] = rawRow[csvCol];
    }
  });

  if (importType === 'account_metrics') {
    const platform = detectPlatform(mapped.platform);
    const date     = normalizeDate(mapped.metric_date);
    return {
      platform,
      username:          String(mapped.username || '').trim().replace(/^@/, ''),
      metric_date:       date,
      followers:         normalizeNumber(mapped.followers),
      follower_growth:   normalizeNumber(mapped.follower_growth),
      reach:             normalizeNumber(mapped.reach),
      impressions:       normalizeNumber(mapped.impressions),
      profile_visits:    normalizeNumber(mapped.profile_visits),
      website_clicks:    normalizeNumber(mapped.website_clicks),
      engagement_count:  normalizeNumber(mapped.engagement_count),
      engagement_rate:   normalizeNumber(mapped.engagement_rate),
      _raw: mapped,
    };
  }

  if (importType === 'content_performance') {
    const platform    = detectPlatform(mapped.platform);
    const publishedAt = normalizeDate(mapped.published_at);
    const likes       = normalizeNumber(mapped.likes);
    const comments    = normalizeNumber(mapped.comments);
    const shares      = normalizeNumber(mapped.shares);
    const saves       = normalizeNumber(mapped.saves);
    const reach       = normalizeNumber(mapped.reach);
    let er            = normalizeNumber(mapped.engagement_rate, null);
    if (er === null || er === 0) {
      er = calculateEngagementRate({ likes, comments, shares, saves, reach });
    }
    return {
      platform,
      username:         String(mapped.username || '').trim().replace(/^@/, ''),
      content_url:      mapped.content_url || null,
      title:            mapped.title || null,
      caption:          mapped.caption || null,
      content_type:     mapped.content_type || null,
      content_pillar:   mapped.content_pillar || null,
      campaign_name:    mapped.campaign_name || null,
      published_at:     publishedAt,
      views:            normalizeNumber(mapped.views),
      reach,
      impressions:      normalizeNumber(mapped.impressions),
      likes,
      comments,
      shares,
      saves,
      replies:          normalizeNumber(mapped.replies),
      reposts:          normalizeNumber(mapped.reposts),
      engagement_rate:  er,
      watch_rate:       normalizeNumber(mapped.watch_rate),
      completion_rate:  normalizeNumber(mapped.completion_rate),
      _raw: mapped,
    };
  }

  if (importType === 'competitor_metrics') {
    const platform = detectPlatform(mapped.platform);
    const date     = normalizeDate(mapped.metric_date);
    return {
      platform,
      competitor_name:          String(mapped.competitor_name || '').trim(),
      username:                 String(mapped.username || '').trim().replace(/^@/, ''),
      metric_date:              date,
      followers:                normalizeNumber(mapped.followers),
      follower_growth:          normalizeNumber(mapped.follower_growth),
      posting_frequency:        normalizeNumber(mapped.posting_frequency),
      average_likes:            normalizeNumber(mapped.average_likes),
      average_comments:         normalizeNumber(mapped.average_comments),
      average_shares:           normalizeNumber(mapped.average_shares),
      average_engagement_rate:  normalizeNumber(mapped.average_engagement_rate),
      top_content_url:          mapped.top_content_url || null,
      _raw: mapped,
    };
  }

  return null;
}

// ─── validateImportRows ──────────────────────────────────────
const REQUIRED_FIELDS = {
  account_metrics:      ['platform', 'username', 'metric_date'],
  content_performance:  ['platform', 'username', 'published_at'],
  competitor_metrics:   ['platform', 'competitor_name', 'username', 'metric_date'],
};

export function validateImportRows(rows, importType) {
  const required = REQUIRED_FIELDS[importType] || [];
  return rows.map((row, idx) => {
    const errors = [];

    // Required fields
    required.forEach(f => {
      const v = row[f];
      if (!v || v === null || v === '') {
        errors.push({ field: f, message: `"${f}" wajib diisi` });
      }
    });

    // Platform valid
    if (row.platform && !PLATFORMS.includes(row.platform)) {
      errors.push({ field: 'platform', message: `Platform "${row.platform}" tidak dikenal. Gunakan: Instagram, TikTok, atau Threads` });
    }

    // Date valid
    const dateField = importType === 'content_performance' ? 'published_at' : 'metric_date';
    if (row[dateField] && !/^\d{4}-\d{2}-\d{2}$/.test(row[dateField])) {
      errors.push({ field: dateField, message: `Format tanggal tidak valid: "${row[dateField]}"` });
    }

    // Numeric range checks
    if (row.engagement_rate !== undefined && row.engagement_rate > 100) {
      errors.push({ field: 'engagement_rate', message: `Engagement rate ${row.engagement_rate}% terlalu tinggi (>100%)` });
    }
    if (row.followers !== undefined && row.followers < 0) {
      errors.push({ field: 'followers', message: 'Followers tidak boleh negatif' });
    }

    return { ...row, _rowIndex: idx + 2, _valid: errors.length === 0, _errors: errors };
  });
}

// ─── parseCSV ────────────────────────────────────────────────
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => resolve({ data: results.data, headers: results.meta.fields || [], errors: results.errors }),
      error: (err) => reject(err),
    });
  });
}

// ─── parseCSVText ─────────────────────────────────────────────
export function parseCSVText(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });
  return { data: result.data, headers: result.meta.fields || [], errors: result.errors };
}

// ─── autoMapColumns ──────────────────────────────────────────
/**
 * Auto-map CSV headers to target fields based on name similarity.
 * Returns { csvHeader: targetField } for matched pairs.
 */
export function autoMapColumns(csvHeaders, targetFields) {
  const map = {};
  csvHeaders.forEach(h => {
    const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    // Exact match first
    if (targetFields.find(f => f.key === h)) {
      map[h] = h;
      return;
    }
    // Fuzzy match
    const match = targetFields.find(f => {
      const fk = f.key.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return fk === normalized || fk === h || f.aliases?.includes(normalized);
    });
    map[h] = match?.key || '__skip__';
  });
  return map;
}

// ─── googleSheetsToCsvUrl ────────────────────────────────────
/**
 * Convert a Google Sheets share URL to a direct CSV export URL.
 * Works for publicly shared spreadsheets (Anyone with link can view).
 */
export function googleSheetsToCsvUrl(shareUrl, sheetName = '') {
  // Extract spreadsheet ID from various URL formats
  const match = shareUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;
  const id = match[1];

  // Extract gid if present
  const gidMatch = shareUrl.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  if (sheetName) {
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  }
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

// ─── fetchGoogleSheetAsCSV ───────────────────────────────────
export async function fetchGoogleSheetAsCSV(shareUrl, sheetName = '') {
  const csvUrl = googleSheetsToCsvUrl(shareUrl, sheetName);
  if (!csvUrl) throw new Error('URL Google Sheets tidak valid. Pastikan format URL benar.');

  const res = await fetch(csvUrl, { mode: 'cors' });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Spreadsheet tidak bisa diakses. Pastikan sharing diset ke "Anyone with the link can view".');
    }
    throw new Error(`Gagal mengambil data dari Google Sheets (status ${res.status})`);
  }
  const text = await res.text();
  if (!text.trim()) throw new Error('Sheet kosong atau tidak ditemukan.');
  return parseCSVText(text);
}

// ─── generateCSVTemplate ─────────────────────────────────────
export function generateCSVTemplate(importType) {
  const templates = {
    account_metrics: {
      headers: ['platform','username','metric_date','followers','follower_growth','reach','impressions','profile_visits','website_clicks','engagement_count','engagement_rate'],
      example:  ['Instagram','@nayacreative.id','2026-06-30','48700','1240','187400','412300','8200','320','9840','4.8'],
    },
    content_performance: {
      headers: ['platform','username','content_url','title','caption','content_type','content_pillar','campaign_name','published_at','views','reach','impressions','likes','comments','shares','saves','replies','reposts','engagement_rate','watch_rate','completion_rate'],
      example:  ['Instagram','@nayacreative.id','https://instagram.com/p/xxx','5 Cara Buat Caption','Caption disini...','Carousel','Edukasi','Juni Campaign','2026-06-20','22100','18400','24000','1240','88','32','540','0','0','8.4','',''],
    },
    competitor_metrics: {
      headers: ['platform','competitor_name','username','metric_date','followers','follower_growth','posting_frequency','average_likes','average_comments','average_shares','average_engagement_rate','top_content_url'],
      example:  ['Instagram','Studio Kreatif Bali','@studiokreatifbali','2026-06-30','68400','800','5','1200','48','24','4.1',''],
    },
  };
  const t = templates[importType];
  if (!t) return '';
  const rows = [t.headers, t.example];
  return Papa.unparse(rows, { header: false });
}
