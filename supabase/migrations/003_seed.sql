-- ============================================================
-- NAYALYZER — SAMPLE SEED DATA
-- Run AFTER 001_schema.sql and 002_rls.sql
-- Replace UUIDs with actual values after creating test users
-- ============================================================

-- NOTE: This seed uses placeholder UUIDs.
-- In a real setup, create users via Supabase Auth first,
-- then copy their UUIDs below.

-- ────────────────────────────────────────────────────────────
-- SAMPLE WORKSPACE (run as authenticated user via RPC)
-- ────────────────────────────────────────────────────────────
-- SELECT public.create_workspace(
--   'Naya Creative Studio',
--   'Naya Creative',
--   'Creative Agency',
--   'Asia/Jakarta'
-- );

-- ────────────────────────────────────────────────────────────
-- The rest of seed is designed to be called programmatically
-- after create_workspace() returns a workspace_id.
-- Use the seed_workspace() function below.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ig_id   uuid;
  tt_id   uuid;
  th_id   uuid;

  c1_id uuid; c2_id uuid; c3_id uuid; c4_id uuid; c5_id uuid;
  c6_id uuid; c7_id uuid; c8_id uuid; c9_id uuid; c10_id uuid;
  c11_id uuid; c12_id uuid;

  comp1_id uuid; comp2_id uuid; comp3_id uuid; comp4_id uuid;
BEGIN

  -- ── Social Accounts ──────────────────────────────────────
  INSERT INTO social_accounts (workspace_id, platform, account_name, username, followers_count, following_count, connection_status)
  VALUES (p_workspace_id, 'Instagram', 'Naya Creative Studio', '@nayacreative.id', 48700, 812, 'connected')
  RETURNING id INTO ig_id;

  INSERT INTO social_accounts (workspace_id, platform, account_name, username, followers_count, following_count, connection_status)
  VALUES (p_workspace_id, 'TikTok', 'Naya Creative Studio', '@nayacreative', 92400, 240, 'connected')
  RETURNING id INTO tt_id;

  INSERT INTO social_accounts (workspace_id, platform, account_name, username, followers_count, following_count, connection_status)
  VALUES (p_workspace_id, 'Threads', 'Naya Creative Studio', '@nayacreative.id', 12800, 430, 'connected')
  RETURNING id INTO th_id;


  -- ── Account Metrics (6 months Instagram) ─────────────────
  INSERT INTO account_metrics (workspace_id, social_account_id, metric_date, followers, follower_growth, reach, impressions, engagement_count, engagement_rate) VALUES
  (p_workspace_id, ig_id, '2026-01-31', 44200, 800, 142000, 320000, 6200, 4.1),
  (p_workspace_id, ig_id, '2026-02-28', 45100, 900, 155000, 355000, 6800, 4.3),
  (p_workspace_id, ig_id, '2026-03-31', 45800, 700, 163000, 374000, 7200, 4.5),
  (p_workspace_id, ig_id, '2026-04-30', 46600, 800, 172000, 392000, 7800, 4.6),
  (p_workspace_id, ig_id, '2026-05-31', 47460, 860, 180000, 404000, 8400, 4.7),
  (p_workspace_id, ig_id, '2026-06-30', 48700, 1240, 187400, 412300, 9840, 4.8);

  -- TikTok metrics
  INSERT INTO account_metrics (workspace_id, social_account_id, metric_date, followers, follower_growth, reach, impressions, engagement_count, engagement_rate) VALUES
  (p_workspace_id, tt_id, '2026-01-31', 71000, 4200, 380000, 920000, 18200, 5.4),
  (p_workspace_id, tt_id, '2026-02-28', 74800, 3800, 410000, 1010000, 19800, 5.6),
  (p_workspace_id, tt_id, '2026-03-31', 79200, 4400, 452000, 1120000, 22400, 5.9),
  (p_workspace_id, tt_id, '2026-04-30', 83400, 4200, 485000, 1180000, 24200, 6.0),
  (p_workspace_id, tt_id, '2026-05-31', 87600, 4200, 504000, 1240000, 26400, 6.1),
  (p_workspace_id, tt_id, '2026-06-30', 92400, 4800, 524000, 1280000, 31200, 6.2);

  -- Threads metrics
  INSERT INTO account_metrics (workspace_id, social_account_id, metric_date, followers, follower_growth, reach, impressions, engagement_count, engagement_rate) VALUES
  (p_workspace_id, th_id, '2026-01-31', 8400, 380, 32000, 64000, 1240, 6.2),
  (p_workspace_id, th_id, '2026-02-28', 9200, 800, 36000, 72000, 1480, 6.5),
  (p_workspace_id, th_id, '2026-03-31', 10100, 900, 39000, 78000, 1820, 6.8),
  (p_workspace_id, th_id, '2026-04-30', 11000, 900, 43000, 86000, 2200, 6.9),
  (p_workspace_id, th_id, '2026-05-31', 12220, 1220, 46000, 92000, 2980, 7.0),
  (p_workspace_id, th_id, '2026-06-30', 12800, 580, 48200, 96400, 3840, 7.1);


  -- ── Contents ──────────────────────────────────────────────
  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, ig_id, 'Instagram', '5 Cara Buat Caption IG yang Bikin Follow', 'Carousel', 'Edukasi', '2026-06-20 19:30:00+07')
  RETURNING id INTO c1_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, tt_id, 'TikTok', 'Hook Problem-Solution: Cara Dapat 1000 Follower Pertama', 'Short Video', 'Edukasi', '2026-06-18 20:00:00+07')
  RETURNING id INTO c2_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, th_id, 'Threads', 'Opini: Kenapa Personal Branding Lebih Penting dari Follower', 'Thread Opini', 'Opini', '2026-06-17 12:30:00+07')
  RETURNING id INTO c3_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, ig_id, 'Instagram', 'Behind-the-scenes: Proses Desain Brand Identity', 'Reels', 'Behind-the-scenes', '2026-06-15 19:00:00+07')
  RETURNING id INTO c4_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, tt_id, 'TikTok', 'Trend Audio: Tips Desain Logo 2026', 'Short Video', 'Trending', '2026-06-14 20:30:00+07')
  RETURNING id INTO c5_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, th_id, 'Threads', 'Tips 3 Tools AI yang Wajib Dipakai Designer', 'Thread Tips', 'Tips', '2026-06-12 12:00:00+07')
  RETURNING id INTO c6_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, ig_id, 'Instagram', 'Promo: Paket Desain Logo Mulai 500K', 'Photo', 'Promosi', '2026-06-10 10:00:00+07')
  RETURNING id INTO c7_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, tt_id, 'TikTok', 'Review Tool: Canva vs Adobe Illustrator', 'Long Video', 'Edukasi', '2026-06-08 19:00:00+07')
  RETURNING id INTO c8_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, ig_id, 'Instagram', 'Q&A: Cara Mulai Freelance Design', 'Carousel', 'Edukasi', '2026-06-06 20:00:00+07')
  RETURNING id INTO c9_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, th_id, 'Threads', 'Polling: Mana yang Lebih Penting — Skill atau Portofolio?', 'Poll', 'Q&A', '2026-06-04 12:00:00+07')
  RETURNING id INTO c10_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, ig_id, 'Instagram', 'Infographic: Color Theory untuk Brand', 'Photo', 'Edukasi', '2026-06-02 19:30:00+07')
  RETURNING id INTO c11_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, tt_id, 'TikTok', 'Story Time: Gagal Dapat Klien Pertama', 'Short Video', 'Behind-the-scenes', '2026-05-30 20:00:00+07')
  RETURNING id INTO c12_id;


  -- ── Content Metrics ───────────────────────────────────────
  INSERT INTO content_metrics (workspace_id, content_id, metric_date, views, reach, likes, comments, shares, saves, engagement_count, engagement_rate, performance_score, performance_status, ai_note) VALUES
  (p_workspace_id, c1_id, '2026-06-20', 22100, 18400, 1240, 88, 32, 540, 1900, 8.4, 92, 'High Performer', 'Carousel edukasi ini performanya 3.2× di atas rata-rata.'),
  (p_workspace_id, c2_id, '2026-06-18', 112000, 84200, 7800, 420, 1240, 0, 9460, 8.4, 95, 'High Performer', 'Watch rate 72% — jauh di atas average 41%.'),
  (p_workspace_id, c3_id, '2026-06-17', 9200, 6800, 320, 186, 94, 0, 600, 11.2, 88, 'High Performer', 'Reply rate 2.0% — sangat tinggi untuk Threads.'),
  (p_workspace_id, c4_id, '2026-06-15', 18800, 14200, 820, 54, 28, 180, 1082, 5.7, 72, 'Stable', 'Performa stabil. Save rate cukup baik (1.3%).'),
  (p_workspace_id, c5_id, '2026-06-14', 88000, 62000, 4200, 180, 640, 0, 5020, 5.7, 78, 'Stable', 'Memanfaatkan trending audio dengan baik.'),
  (p_workspace_id, c6_id, '2026-06-12', 5800, 4200, 188, 72, 38, 0, 298, 6.8, 68, 'Stable', 'Engagement ok tapi reach terbatas.'),
  (p_workspace_id, c7_id, '2026-06-10', 7400, 6800, 180, 12, 4, 28, 224, 2.1, 38, 'Underperform', 'Konten promosi langsung selalu underperform.'),
  (p_workspace_id, c8_id, '2026-06-08', 44000, 28400, 1800, 142, 88, 0, 2030, 4.6, 55, 'Needs Improvement', 'Completion rate hanya 28% — terlalu panjang.'),
  (p_workspace_id, c9_id, '2026-06-06', 19400, 16200, 920, 64, 22, 380, 1386, 7.2, 84, 'High Performer', 'Q&A carousel terbukti efektif. Save rate 2.4% sangat baik.'),
  (p_workspace_id, c10_id, '2026-06-04', 7200, 5400, 240, 128, 46, 0, 414, 9.4, 82, 'High Performer', 'Poll menghasilkan comment rate tertinggi bulan ini.'),
  (p_workspace_id, c11_id, '2026-06-02', 11200, 9800, 440, 28, 14, 320, 802, 5.8, 66, 'Stable', 'Save rate bagus (3.3%) tapi likes rendah.'),
  (p_workspace_id, c12_id, '2026-05-30', 98000, 74000, 6200, 380, 820, 0, 7400, 7.5, 89, 'High Performer', 'Storytelling personal sangat resonan. Watch rate 65%.');


  -- ── Competitors ───────────────────────────────────────────
  INSERT INTO competitors (workspace_id, platform, name, username, strength, weakness, opportunity)
  VALUES (p_workspace_id, 'Instagram', 'Studio Kreatif Bali', '@studiokreatifbali',
    'Visual konsisten, branding kuat', 'Engagement rendah di konten edukasi', 'Belum memanfaatkan Reels & video pendek')
  RETURNING id INTO comp1_id;

  INSERT INTO competitors (workspace_id, platform, name, username, strength, weakness, opportunity)
  VALUES (p_workspace_id, 'TikTok', 'Desain Kita ID', '@desainkitaid',
    'Konsisten upload, trending sound bagus', 'Kurang diversifikasi platform', 'Audiens siap untuk konten premium/course')
  RETURNING id INTO comp2_id;

  INSERT INTO competitors (workspace_id, platform, name, username, strength, weakness, opportunity)
  VALUES (p_workspace_id, 'Instagram', 'Brand Builder Co', '@brandbuildco',
    'Niche spesifik branding bisnis UMKM', 'Posting tidak konsisten, reach menurun', 'Belum aktif di Threads & TikTok')
  RETURNING id INTO comp3_id;

  INSERT INTO competitors (workspace_id, platform, name, username, strength, weakness, opportunity)
  VALUES (p_workspace_id, 'Threads', 'Kreasi Visual Studio', '@kreasivisual',
    'Engagement tinggi, komunitas aktif', 'Belum ada di TikTok dan Instagram', 'Threads masih early mover — positioning kuat')
  RETURNING id INTO comp4_id;

  -- Competitor Metrics
  INSERT INTO competitor_metrics (workspace_id, competitor_id, metric_date, followers, posting_frequency, average_likes, average_comments, average_engagement_rate) VALUES
  (p_workspace_id, comp1_id, '2026-06-30', 68400, 5, 1200, 48, 4.1),
  (p_workspace_id, comp2_id, '2026-06-30', 142000, 7, 4800, 180, 5.5),
  (p_workspace_id, comp3_id, '2026-06-30', 38200, 3, 820, 32, 4.8),
  (p_workspace_id, comp4_id, '2026-06-30', 8400, 14, 180, 62, 6.2);


  -- ── AI Hypotheses ─────────────────────────────────────────
  INSERT INTO ai_hypotheses (workspace_id, title, summary, platforms, data_evidence, confidence_score, suggested_experiment, expected_impact, action_plan, status) VALUES
  (
    p_workspace_id,
    'Carousel edukasi menghasilkan engagement rate 3× lebih tinggi dari konten promosi',
    'Analisis 24 konten Instagram menunjukkan carousel edukasi rata-rata 8.1% ER vs 2.3% untuk konten promo langsung.',
    ARRAY['Instagram']::platform_type[],
    '["Rata-rata ER carousel edukasi: 8.1%", "Rata-rata ER konten promosi: 2.3%", "Save rate carousel 4.2× lebih tinggi", "Top 3 konten terbaik semuanya format carousel edukasi"]'::jsonb,
    94,
    'Buat 4 konten edukasi carousel tanpa promosi selama 2 minggu, bandingkan ER dengan 4 konten promo sebelumnya.',
    'Peningkatan ER rata-rata +2.4% dan saves +180%.',
    '["Ubah rasio konten menjadi 70% edukasi, 20% inspirasi, 10% promosi", "Jadwalkan carousel edukasi setiap Selasa & Kamis", "Tambahkan CTA Save untuk nanti di setiap slide terakhir"]'::jsonb,
    'Validated'
  ),
  (
    p_workspace_id,
    'Hook problem-solution di 3 detik pertama meningkatkan watch rate TikTok secara signifikan',
    'Video TikTok dengan pembuka "Kamu [problem]..." memiliki watch rate 68% vs 41% rata-rata.',
    ARRAY['TikTok']::platform_type[],
    '["Watch rate rata-rata: 41%", "Watch rate hook problem-solution: 68%", "Completion rate hook PS: 52% vs 29% rata-rata", "4 dari 5 top performer TikTok menggunakan hook ini"]'::jsonb,
    88,
    'Buat 6 video: 3 dengan hook problem-solution, 3 dengan hook biasa. Ukur watch rate, completion rate, dan follower gained.',
    'Watch rate +27%, completion rate +23%, potensi follower gained 2× per video.',
    '["Buat bank hook problem-solution minimal 20 variasi", "Review semua video lama, re-upload dengan hook baru", "Tambahkan hook checker di workflow produksi konten"]'::jsonb,
    'Testing'
  ),
  (
    p_workspace_id,
    'Thread opini pendek 1–3 kalimat menghasilkan reply rate 4× lebih tinggi',
    'Thread dengan opini tegas dalam 1–3 kalimat mendapat lebih banyak reply dibanding thread panjang.',
    ARRAY['Threads']::platform_type[],
    '["Reply rate thread panjang >5 kalimat: 1.2%", "Reply rate thread pendek opini: 4.8%", "Thread polling memiliki comment 128 vs rata-rata 34", "Polling: Mana lebih penting? — ER 9.4%"]'::jsonb,
    82,
    'Posting 1 thread opini pendek <3 kalimat setiap Rabu dan Sabtu selama 4 minggu.',
    'Reply rate +280%, potensi profile visit naik 40%.',
    '["Buat content calendar thread opini 1 bulan ke depan", "Pilih 4 topik kontroversial tapi relevant di industri desain", "Balas setiap comment dalam 1 jam pertama"]'::jsonb,
    'New'
  ),
  (
    p_workspace_id,
    'Posting di 19.00–21.00 memberikan potensi reach 22% lebih besar',
    'Data audience activity menunjukkan peak activity di pukul 19.00–21.00 WIB. Posting di luar window ini menghasilkan reach 18–22% lebih rendah.',
    ARRAY['Instagram', 'TikTok']::platform_type[],
    '["Peak audience hour: 19.00–21.00 (88–95% index activity)", "Posting jam 12.00: reach 2 jam pertama rata-rata 4.200", "Posting jam 19.00–21.00: reach 2 jam pertama 6.400", "Algoritma memprioritaskan konten dengan early engagement tinggi"]'::jsonb,
    91,
    'Jadwalkan 8 konten secara konsisten di pukul 19.30 selama 4 minggu.',
    'Reach per post naik +22%, early engagement naik +35%.',
    '["Gunakan fitur scheduled post di Creator Studio", "Buat konten batch setiap Minggu, jadwalkan untuk Selasa-Kamis", "Pantau reach 2 jam pertama sebagai KPI utama"]'::jsonb,
    'Validated'
  );


  -- ── Initial Report ────────────────────────────────────────
  INSERT INTO reports (workspace_id, title, report_type, period_start, period_end, summary, ai_recommendations, report_data) VALUES
  (
    p_workspace_id,
    'Laporan Bulanan — Juni 2026',
    'monthly',
    '2026-06-01',
    '2026-06-30',
    'Bulan Juni 2026 menunjukkan pertumbuhan signifikan di semua platform. TikTok tetap menjadi platform dengan growth tertinggi (+5.48%), sementara Threads memiliki engagement rate terbaik (7.1%). Total followers lintas platform mencapai 153.900 dengan pertumbuhan 4.49% dari bulan sebelumnya.',
    '["Tingkatkan frekuensi carousel edukasi Instagram menjadi 3× per minggu", "Konsisten gunakan hook problem-solution di semua video TikTok", "Buat 1 thread opini per hari di Threads", "Jadwalkan semua konten di 19.00–21.00 WIB", "Pertimbangkan 1 kolaborasi konten di bulan Juli"]'::jsonb,
    '{"totalFollowers": 153900, "followerGrowth": 6620, "totalReach": 759600, "avgER": 6.03, "aiScore": 78}'::jsonb
  );

END;
$$;

-- To seed: SELECT public.seed_workspace('<your-workspace-id>');
