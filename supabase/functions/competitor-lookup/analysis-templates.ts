/**
 * Template analisis kompetitor — fallback saat tidak ada API key.
 * Setiap output menyisipkan angka nyata kompetitor + perbandingan vs akun user
 * sehingga tidak ada dua analisis yang identik.
 */

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
  : String(n);

const erLabel  = (er: number) => er >= 6 ? 'sangat tinggi' : er >= 3 ? 'tinggi' : er >= 1 ? 'sedang' : 'rendah';
const freqAdj  = (f: number)  => f >= 5 ? 'sangat aktif' : f >= 3 ? 'aktif' : f >= 1.5 ? 'moderat' : 'jarang';
const ctLabel  = (ct: string) =>
  ct === 'VIDEO' ? 'Reels/video' : ct === 'CAROUSEL_ALBUM' ? 'carousel' : 'foto';

// ── Strength copy-pool — picked based on dominant trait ──────────────────────

function buildStrength(
  followers: number, er: number, freq: number, ct: string,
): string {
  const ctStr = ctLabel(ct);

  if (er >= 6) {
    return `Engagement rate ${er}% yang sangat tinggi menunjukkan komunitas yang solid dan benar-benar menikmati konten mereka. Dengan ${fmt(followers)} followers, setiap postingan berhasil memantik interaksi jauh di atas rata-rata industri. Dominasi format ${ctStr} tampak efektif dalam membangun keterlibatan ini.`;
  }
  if (er >= 3) {
    return `Dengan ${fmt(followers)} followers dan ER ${er}%, akun ini memiliki basis audiens yang cukup loyal. Konsistensi posting ${freq}× per minggu menunjukkan disiplin konten yang baik, dan format ${ctStr} yang mereka andalkan terbukti relevan di niche mereka.`;
  }
  if (followers >= 100_000) {
    return `Jangkauan ${fmt(followers)} followers memberikan distribusi organik yang signifikan meski ER ${er}% berada di level sedang — wajar untuk akun berskala besar. Brand awareness dan otoritas merek di niche ini sudah terbentuk kuat.`;
  }
  if (freq >= 5) {
    return `Frekuensi posting ${freq}× per minggu adalah keunggulan distribusi yang nyata — algoritma Instagram menyukai akun yang konsisten aktif. Dengan ${fmt(followers)} followers, kehadiran konten mereka di feed audiens sangat terjaga.`;
  }
  return `Akun ini telah membangun kehadiran organik yang stabil dengan ${fmt(followers)} followers dan ritme posting ${freq}× per minggu. Format ${ctStr} yang konsisten memberi identitas visual yang mudah dikenali oleh audiens mereka.`;
}

// ── Weakness copy-pool ────────────────────────────────────────────────────────

function buildWeakness(
  followers: number, er: number, freq: number, ct: string,
): string {
  if (er < 1 && freq < 2) {
    return `ER ${er}% yang rendah dikombinasikan dengan frekuensi posting hanya ${freq}× per minggu adalah tanda stagnasi serius. Algoritma jarang merekomendasikan konten mereka, dan pertumbuhan organik kemungkinan sudah hampir stagnan.`;
  }
  if (er < 1) {
    return `Meski posting ${freq}× per minggu, ER ${er}% menunjukkan banyak konten yang tidak benar-benar resonan. Ada risiko pengikut "ghost" — mengikuti tapi tidak terlibat — yang membebani distribusi algoritma.`;
  }
  if (freq < 1.5) {
    return `Frekuensi posting ${freq}× per minggu terlalu jarang untuk mempertahankan momentum algoritma. Jeda panjang antar konten membuat pengikut mudah melupakan akun ini, bahkan dengan ER ${er}% yang dimiliki.`;
  }
  if (followers >= 500_000 && er < 2) {
    return `Pada skala ${fmt(followers)} followers, ER ${er}% menandakan sebagian besar pengikut sudah tidak aktif atau tidak relevan. Konten yang diproduksi harus sangat generalis untuk audiens besar, kehilangan kedalaman niche.`;
  }
  if (freq >= 7) {
    return `Posting ${freq}× per minggu berisiko mengorbankan kualitas demi kuantitas. Audiens bisa merasa "banjir konten" dan mulai scroll past tanpa interaksi, yang akhirnya menurunkan ER secara bertahap.`;
  }
  return `Dengan ER ${er}% dan ${fmt(followers)} followers, masih ada ruang signifikan untuk meningkatkan kualitas interaksi. Diversifikasi format konten di luar ${ctLabel(ct)} bisa membuka segmen audiens baru yang belum terjangkau.`;
}

// ── Opportunity — selalu berbasis perbandingan langsung vs akun user ──────────

function buildOpportunity(
  compFollowers: number, compER: number, compFreq: number, compCT: string,
  ourFollowers: number, ourER: number,
): string {
  const erGap      = compER - ourER;
  const followerGap = compFollowers - ourFollowers;

  if (erGap > 3) {
    return `ER kita (${ourER}%) tertinggal ${erGap.toFixed(1)} poin dari kompetitor ini. Prioritaskan perbaikan kualitas konten yang memancing interaksi: pertanyaan di caption, CTA yang jelas, dan format yang terbukti mereka gunakan (${ctLabel(compCT)}) untuk menutup gap tersebut.`;
  }
  if (erGap < -2) {
    return `Kita sudah unggul ${Math.abs(erGap).toFixed(1)} poin ER di atas kompetitor ini (${ourER}% vs ${compER}%). Manfaatkan keunggulan engagement ini dengan strategi distribusi yang lebih agresif — iklan berbayar atau kolaborasi — untuk memperlebar jarak.`;
  }
  if (compFreq < 1.5) {
    return `Kompetitor ini jarang posting (${compFreq}×/minggu), menciptakan kekosongan konten di niche yang bisa langsung kita isi. Dengan konsistensi lebih tinggi, kita bisa menjadi pilihan utama audiens yang tidak terlayani dengan baik.`;
  }
  if (followerGap > 50_000 && compER < 2) {
    return `Meski kompetitor punya ${fmt(compFollowers)} followers (${fmt(Math.abs(followerGap))} lebih banyak dari kita), ER mereka hanya ${compER}% — artinya kualitas audiens kita kemungkinan lebih baik. Fokus pada mempertahankan kualitas engagement sambil mempercepat pertumbuhan jumlah follower.`;
  }
  if (followerGap < 0) {
    return `Kita sudah melampaui jumlah followers kompetitor ini (${fmt(ourFollowers)} vs ${fmt(compFollowers)}). Fokus selanjutnya adalah memperlebar keunggulan dengan mendominasi konten niche yang belum mereka sentuh secara mendalam.`;
  }
  return `Gap ${fmt(Math.abs(followerGap))} followers antara kita dan kompetitor ini bisa diperkecil dengan strategi distribusi yang lebih terstruktur. Prioritaskan format ${ctLabel(compCT)} yang terbukti bekerja di niche ini sambil menjaga ER tetap kompetitif.`;
}

// ── Comparison summary ────────────────────────────────────────────────────────

function buildComparison(
  compName: string,
  compFollowers: number, compER: number, compFreq: number,
  ourFollowers: number, ourER: number,
): string {
  const followerWinner = compFollowers > ourFollowers ? compName : 'akun kita';
  const erWinner       = compER > ourER ? compName : 'akun kita';
  const erDiff         = Math.abs(compER - ourER).toFixed(2);
  const fDiff          = Math.abs(compFollowers - ourFollowers);

  return `${compName} memiliki ${fmt(compFollowers)} followers (${compFollowers > ourFollowers ? `${fmt(fDiff)} lebih banyak` : `${fmt(fDiff)} lebih sedikit`} dari akun kita yang ${fmt(ourFollowers)}). Di sisi engagement, ${erWinner} unggul dengan selisih ${erDiff}% ER (${compName}: ${compER}% vs kita: ${ourER}%). Frekuensi posting mereka ${compFreq}× per minggu ${compFreq > 3 ? 'menunjukkan komitmen konten yang kuat' : 'memberi kita peluang untuk hadir lebih sering di feed audiens target'}.`;
}

// ── Recommendations — based on specific data gaps ────────────────────────────

function buildRecommendations(
  compFollowers: number, compER: number, compFreq: number, compCT: string,
  ourFollowers: number, ourER: number,
): string[] {
  const recs: string[] = [];

  // ER gap
  if (compER > ourER + 1) {
    recs.push(`Pelajari pola konten ${ctLabel(compCT)} mereka yang berhasil meraih ER ${compER}% — identifikasi hook pembuka, panjang caption, dan jenis CTA yang mereka gunakan`);
  } else if (ourER > compER + 1) {
    recs.push(`Manfaatkan keunggulan ER kita (${ourER}% vs ${compER}%) dengan meningkatkan investasi iklan berbayar — audiens kita lebih engaged dan lebih efisien dimonetisasi`);
  }

  // Frequency gap
  if (compFreq > 4 && ourER >= compER) {
    recs.push(`Tingkatkan frekuensi posting mendekati ${Math.ceil(compFreq)}× per minggu untuk menyaingi volume distribusi mereka sambil mempertahankan kualitas yang sudah kita miliki`);
  } else if (compFreq < 2) {
    recs.push(`Isi kekosongan konten yang ditinggalkan kompetitor ini dengan hadir ${Math.max(5, Math.ceil(compFreq * 2))}× per minggu secara konsisten di niche yang sama`);
  }

  // Follower gap
  if (compFollowers > ourFollowers * 1.5) {
    recs.push(`Percepat pertumbuhan followers dengan strategi distribusi: kolaborasi konten, penggunaan hashtag niche yang mereka andalkan, dan Reels pendek untuk jangkauan di luar pengikut`);
  }

  // Content format
  recs.push(`Eksperimen dengan format ${ctLabel(compCT)} yang terbukti bekerja di niche ini — buat minimal 4 konten dalam format tersebut dan ukur perbedaan ER-nya`);

  // Always include engagement quality rec
  recs.push(`Pantau kolom komentar konten terpopuler mereka untuk menemukan pertanyaan dan pain point audiens yang belum dijawab — jadikan itu ide konten prioritas`);

  // Deduplicate and cap at 4
  return [...new Set(recs)].slice(0, 4);
}

// ── Public entry point ────────────────────────────────────────────────────────

export function pickTemplate(
  followersCount: number,
  engagementRate: number,
  postingFreqWeekly: number,
  topContentType: string,
  ourFollowers: number,
  ourER: number,
  compName = 'Kompetitor',
): {
  strength: string;
  weakness: string;
  opportunity: string;
  comparison_summary: string;
  recommendations: string[];
} {
  const f   = followersCount    ?? 0;
  const er  = engagementRate    ?? 0;
  const freq = postingFreqWeekly ?? 0;
  const ct  = topContentType    ?? 'IMAGE';

  return {
    strength:           buildStrength(f, er, freq, ct),
    weakness:           buildWeakness(f, er, freq, ct),
    opportunity:        buildOpportunity(f, er, freq, ct, ourFollowers, ourER),
    comparison_summary: buildComparison(compName, f, er, freq, ourFollowers, ourER),
    recommendations:    buildRecommendations(f, er, freq, ct, ourFollowers, ourER),
  };
}
