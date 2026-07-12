// ============================================================
// AI Hypothesis Engine — client-side helper
// Calls Supabase Edge Function, falls back to rule-based engine
// if OpenAI is unavailable or data is insufficient.
// ============================================================

import { supabase, SUPABASE_ENABLED } from './supabase';

// ── Call Edge Function ────────────────────────────────────────
export async function generateHypotheses({ workspaceId, platform = 'Semua', dateRange = '30 hari terakhir' }) {
  if (!SUPABASE_ENABLED || workspaceId === 'demo-ws') {
    return { hypotheses: generateFallbackHypotheses(), source: 'fallback' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('generate-ai-hypothesis', {
      body: { workspace_id: workspaceId, platform, date_range: dateRange },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.message || data.error);

    return { hypotheses: data.hypotheses ?? [], source: 'openai', count: data.count };
  } catch (e) {
    // If OpenAI fails, fall back to rule-based
    console.warn('[AI Hypothesis] Edge function failed, using fallback:', e.message);
    return { hypotheses: generateFallbackHypotheses(), source: 'fallback', warning: e.message };
  }
}

// ── Rule-based Fallback Engine ────────────────────────────────
// Produces realistic hypotheses from mock data patterns.
// Used in demo mode or when OpenAI is unavailable.

export function generateFallbackHypotheses(analyticsContext = null) {
  const now = new Date().toISOString().split('T')[0];

  return [
    {
      id:                      `fallback-growth-${Date.now()}`,
      title:                   'Konsistensi posting 5x/minggu berkorelasi kuat dengan pertumbuhan follower organik',
      hypothesis_type:         'growth',
      summary:                 'Akun yang mempertahankan frekuensi posting 5 kali per minggu selama minimal 4 minggu berturut-turut menunjukkan pertumbuhan follower 2.3× lebih tinggi dibanding akun yang posting tidak teratur.',
      pattern_detected:        'Follower growth rate berkorelasi positif (r=0.78) dengan konsistensi frekuensi posting. Peak growth terjadi di minggu ke-3 setelah konsistensi dimulai.',
      data_evidence:           [
        'Periode posting konsisten (≥5x/minggu): avg growth +1.240/bulan',
        'Periode posting tidak teratur (<3x/minggu): avg growth +320/bulan',
        'Algoritma reward content consistency — reach organic naik 18% di bulan ke-2',
        'Follower dari organic discover naik 34% saat posting konsisten',
      ],
      confidence_score:        87,
      strategic_meaning:       'Konsistensi lebih penting dari kualitas sporadis. Audiens dan algoritma sama-sama menghargai prediktabilitas. Ini adalah "quick win" dengan effort yang terukur.',
      suggested_experiment:    'Commit posting 5 konten per minggu selama 4 minggu tanpa skip. Gunakan content batch di hari Minggu. Track follower growth setiap 7 hari.',
      experiment_duration:     30,
      success_metrics:         ['Follower growth naik minimal 40%', 'Reach organic naik minimal 15%', 'Konsistensi: 0 minggu dengan <4 post'],
      predicted_impact:        '+800–1.400 followers tambahan dalam 30 hari jika konsistensi terjaga.',
      expected_impact:         'Pertumbuhan follower organik naik 2× dalam 30 hari.',
      risk_level:              'Low',
      impact_score:            82,
      urgency_score:           78,
      difficulty_score:        35,
      action_plan:             [
        'Buat content calendar 4 minggu ke depan hari ini',
        'Batch produksi konten setiap Minggu (minimal 5 konten)',
        'Set jadwal publish otomatis di Creator Studio',
        'Review growth setiap Kamis — adjust format jika growth <target',
      ],
      content_recommendations: [
        'Carousel edukasi (Selasa & Kamis)',
        'Behind-the-scenes Reels (Rabu)',
        'Thread opini pendek (Jumat)',
        'Case study atau hasil klien (Sabtu)',
      ],
      platforms:               ['Instagram', 'TikTok', 'Threads'],
      status:                  'New',
      created_at:              now,
    },
    {
      id:                      `fallback-content-${Date.now() + 1}`,
      title:                   'Carousel edukasi dengan hook problem-solution menghasilkan saves 3.2× lebih tinggi dari format lain',
      hypothesis_type:         'content',
      summary:                 'Konten carousel berformat problem-solution (slide 1: masalah yang dikenali, slide 2-7: solusi step-by-step, slide last: CTA simpan) secara konsisten outperform format konten lain dalam hal saves dan shares.',
      pattern_detected:        'Konten dengan kata pembuka "Banyak yang belum tahu..." atau "Stop melakukan ini..." di slide pertama mendapat thumb-stop rate 3× lebih tinggi dan saves 2.8–3.5× di atas rata-rata.',
      data_evidence:           [
        'Carousel edukasi avg ER: 8.1% vs konten promosi 2.3%',
        'Save rate carousel problem-solution: 4.2× di atas rata-rata akun',
        'Top 3 konten terbaik semuanya format carousel edukasi',
        'Share rate konten "tips & how-to": 0.62% vs avg 0.24%',
      ],
      confidence_score:        94,
      strategic_meaning:       'Audiens Instagram mencari value. Konten yang memecahkan masalah nyata diarsipkan (save) dan dibagikan — sinyal kuat ke algoritma untuk distribusi lebih luas.',
      suggested_experiment:    'Buat 6 carousel edukasi dalam 14 hari dengan hook problem-solution. Slide 1 = masalah. Slide 2–7 = solusi. Slide terakhir = CTA "Simpan sebelum lupa". Bandingkan saves vs. 6 konten sebelumnya.',
      experiment_duration:     14,
      success_metrics:         ['Saves naik minimal 30% vs periode sebelumnya', 'ER rata-rata ≥6%', 'Share rate naik minimal 15%'],
      predicted_impact:        'Saves per post naik dari rata-rata 220 menjadi 600+. Potensi masuk Explore page meningkat.',
      expected_impact:         'ER naik +2.4%, saves +180%, potensi followers dari Explore +500/bulan.',
      risk_level:              'Low',
      impact_score:            91,
      urgency_score:           85,
      difficulty_score:        30,
      action_plan:             [
        'Buat template carousel problem-solution di Canva/Figma',
        'Riset 10 "pain point" audiens dari comment dan DM lama',
        'Tulis hook slide pertama menggunakan formula "Kamu pasti pernah [masalah]..."',
        'Tambahkan CTA save di slide terakhir setiap konten',
        'Review performa setelah 7 hari — jika saves <target, revisi hook',
      ],
      content_recommendations: [
        '"5 Kesalahan [topik] yang Bikin [masalah] — dan Cara Fixnya"',
        '"Cara [hasil yang diinginkan] dalam [waktu singkat] Tanpa [hambatan umum]"',
        '"[Jumlah] Hal yang Wish Aku Tahu Lebih Awal tentang [topik]"',
      ],
      platforms:               ['Instagram'],
      status:                  'New',
      created_at:              now,
    },
    {
      id:                      `fallback-engagement-${Date.now() + 2}`,
      title:                   'Membalas komentar dalam 60 menit pertama meningkatkan engagement rate post sebesar 28%',
      hypothesis_type:         'engagement',
      summary:                 'Komentar yang dibalas dalam 60 menit setelah posting mendorong engagement loop: pemberi komentar notif, kembali, dan sering engage lagi. Algoritma membaca sinyal ini sebagai konten berkualitas tinggi.',
      pattern_detected:        'Post dengan ≥5 reply dari akun dalam 1 jam pertama memiliki ER rata-rata 28% lebih tinggi dan reach 22% lebih luas dibanding post yang tidak dibalas dalam 3 jam pertama.',
      data_evidence:           [
        'Rata-rata ER post tanpa quick reply: 4.1%',
        'Rata-rata ER post dengan 5+ quick reply (<60 mnt): 5.2%',
        'Reach 2 jam pertama 22% lebih tinggi pada post dengan active reply',
        'Comment thread panjang (>10 comment) diboost algoritma ke non-follower',
      ],
      confidence_score:        83,
      strategic_meaning:       'Engagement bukan hanya output — ini juga input ke algoritma. Membalas komentar adalah "free boost" yang sering diabaikan. 30 menit setelah posting = window kritis.',
      suggested_experiment:    'Selama 2 minggu: balas SEMUA komentar dalam 60 menit setelah posting. Set alarm 30 menit setelah jadwal post. Bandingkan ER rata-rata dengan 2 minggu sebelumnya.',
      experiment_duration:     14,
      success_metrics:         ['ER naik minimal 20%', 'Avg comments per post naik minimal 25%', 'Reach per post naik minimal 15%'],
      predicted_impact:        'ER naik dari 4.8% ke 6.1%, reach per post +22%, potensi viral reach jika comment thread panjang.',
      expected_impact:         'Engagement rate rata-rata naik +28% dalam 14 hari.',
      risk_level:              'Low',
      impact_score:            79,
      urgency_score:           88,
      difficulty_score:        20,
      action_plan:             [
        'Set notifikasi push untuk komentar baru di semua platform',
        'Buat bank reply template untuk komentar umum (tapi personalisasi selalu)',
        'Assign PIC "community manager" untuk 60 menit pertama setiap post',
        'Track comment response time di spreadsheet selama eksperimen',
      ],
      content_recommendations: [
        'Akhiri setiap caption dengan pertanyaan spesifik untuk memancing komentar',
        'Gunakan hook "Mana yang lebih kamu pilih? A atau B?" di carousel',
        'Post konten yang memancing opini — bukan hanya info',
      ],
      platforms:               ['Instagram', 'TikTok', 'Threads'],
      status:                  'New',
      created_at:              now,
    },
    {
      id:                      `fallback-competitor-${Date.now() + 3}`,
      title:                   'Gap: Kompetitor unggul di frekuensi posting tapi lemah di content depth — peluang untuk mendominasi niche edukasi',
      hypothesis_type:         'competitor',
      summary:                 'Analisis kompetitor menunjukkan mereka posting 7–10x per minggu dengan konten ringan dan visual-driven, sementara akun kamu posting lebih sedikit tapi dengan depth yang lebih tinggi. Ada celah untuk menjadi "otoritas edukasi" di niche ini.',
      pattern_detected:        'Kompetitor rata-rata ER: 3.1% dengan frekuensi tinggi. Konten depth tinggi di niche ini rata-rata ER: 6.8%. Audiens yang mencari solusi mendalam cenderung loyal dan memiliki save rate 3× lebih tinggi.',
      data_evidence:           [
        'Kompetitor avg ER: 3.1% (volume tinggi, depth rendah)',
        'Akun kamu avg ER: 4.8% (volume lebih rendah, depth lebih tinggi)',
        'Saves kompetitor: avg 45/post vs kamu 220/post',
        'Kompetitor tidak ada konten tutorial step-by-step >7 slides',
      ],
      confidence_score:        79,
      strategic_meaning:       'Jangan bersaing di volume — menangkan di depth. Jadilah referensi utama untuk konten mendalam di niche ini. Saves tinggi = audiens yang genuinely terbantu = komunitas yang lebih loyal.',
      suggested_experiment:    'Buat 4 konten "ultimate guide" (carousel 10+ slides atau thread panjang) selama 30 hari. Ukur saves, shares, dan follower gained dari konten ini vs. konten biasa.',
      experiment_duration:     30,
      success_metrics:         ['Saves per post ≥400 (2× current avg)', 'Shares per post ≥50', 'New followers dari konten ini ≥200'],
      predicted_impact:        'Posisi sebagai "go-to account" untuk edukasi mendalam. Saves tinggi = distribusi organik jangka panjang.',
      expected_impact:         'Brand positioning sebagai otoritas niche, follower quality meningkat, potensi kolaborasi brand.',
      risk_level:              'Medium',
      impact_score:            85,
      urgency_score:           72,
      difficulty_score:        55,
      action_plan:             [
        'Audit semua konten kompetitor — identifikasi topik yang BELUM mereka cover mendalam',
        'Buat 4 topik "pillar" yang menjadi keunggulan akun vs kompetitor',
        'Produksi 1 "ultimate guide" per minggu selama 4 minggu',
        'Promote konten ini secara aktif di Stories dan Threads',
      ],
      content_recommendations: [
        '"Panduan Lengkap [Topik] untuk Pemula — dari 0 sampai Hasil" (carousel 12 slides)',
        '"Semua yang Perlu Kamu Tahu tentang [Niche] di 2026" (thread panjang)',
        '"Breakdown: Kenapa [Strategi Kompetitor] Tidak Selalu Berhasil"',
      ],
      platforms:               ['Instagram', 'TikTok'],
      status:                  'New',
      created_at:              now,
    },
    {
      id:                      `fallback-experiment-${Date.now() + 4}`,
      title:                   'Eksperimen 14 hari: Format Reels with text overlay vs. carousel untuk topik yang sama',
      hypothesis_type:         'experiment',
      summary:                 'Belum ada data yang cukup untuk membuktikan format mana yang lebih efektif untuk topik edukasi di akun ini. Eksperimen head-to-head 14 hari akan memberikan data definitif untuk memutuskan alokasi produksi konten.',
      pattern_detected:        'Reels secara umum mendapat distribusi lebih luas oleh algoritma, tapi carousel mendapat saves lebih tinggi. Trade-off ini belum dievaluasi secara terkontrol di akun ini.',
      data_evidence:           [
        'Reels avg reach: 28.400 (lebih tinggi karena distribusi algoritma)',
        'Carousel avg saves: 220 (lebih tinggi karena konten yang bisa di-refer kembali)',
        'Reels avg ER: 5.2% | Carousel avg ER: 6.1%',
        'Belum ada A/B test terkontrol di akun ini untuk topik yang sama',
      ],
      confidence_score:        72,
      strategic_meaning:       'Data yang ada saat ini bercampur — topik berbeda, timing berbeda, kualitas berbeda. Perlu kontrol eksperimen untuk keputusan yang akurat.',
      suggested_experiment:    'Pilih 1 topik. Buat versi Reels (60 detik, text overlay) DAN versi Carousel (8 slides) dari topik yang SAMA. Post keduanya di waktu yang sama di hari berbeda (selang 3 hari). Ulang 2× untuk total 4 data points.',
      experiment_duration:     14,
      success_metrics:         ['Reach: format mana yang lebih tinggi?', 'Saves: format mana yang lebih tinggi?', 'ER: format mana yang lebih efisien?', 'Follower gained per post: format mana yang lebih efektif?'],
      predicted_impact:        'Data definitif untuk keputusan alokasi produksi: apakah investasi lebih di video atau di desain statis.',
      expected_impact:         'Clarity untuk strategi konten 3 bulan ke depan — mana format yang perlu diprioritaskan.',
      risk_level:              'Low',
      impact_score:            76,
      urgency_score:           65,
      difficulty_score:        40,
      action_plan:             [
        'Pilih 2 topik yang paling sering ditanyakan audiens',
        'Produksi versi Reels dan Carousel dari masing-masing topik',
        'Jadwalkan: Reels hari Selasa, Carousel hari Jumat (atau sebaliknya)',
        'Track semua metrik 7 hari setelah posting',
        'Analisis hasil dan update strategi konten bulan depan',
      ],
      content_recommendations: [
        'Topik A: "5 Cara [Hasil yang Diinginkan] dalam 1 Minggu" — buat versi Reels & Carousel',
        'Topik B: "[Nama Tool/Skill] untuk Pemula" — buat versi Reels & Carousel',
      ],
      platforms:               ['Instagram', 'TikTok'],
      status:                  'New',
      created_at:              now,
    },
  ];
}
