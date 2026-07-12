import { ChevronDown, Info, Wand2 } from 'lucide-react';
import { autoMapColumns } from '../../lib/importHelpers';

// ── Field definitions per import type ────────────────────────
const FIELD_DEFS = {
  account_metrics: [
    { key: 'platform',         label: 'Platform',         required: true,  aliases: ['sosmed','social'] },
    { key: 'username',         label: 'Username',         required: true,  aliases: ['account','akun','handle'] },
    { key: 'metric_date',      label: 'Tanggal Metrik',   required: true,  aliases: ['date','tanggal','periode'] },
    { key: 'followers',        label: 'Followers',        required: false, aliases: ['follower','pengikut'] },
    { key: 'follower_growth',  label: 'Pertumbuhan Follower', required: false, aliases: ['growth','tambah_follower'] },
    { key: 'reach',            label: 'Reach',            required: false, aliases: ['jangkauan'] },
    { key: 'impressions',      label: 'Impressions',      required: false, aliases: ['impresi','tayangan'] },
    { key: 'profile_visits',   label: 'Profile Visits',   required: false, aliases: ['kunjungan_profil'] },
    { key: 'website_clicks',   label: 'Website Clicks',   required: false, aliases: ['klik_website'] },
    { key: 'engagement_count', label: 'Total Engagement', required: false, aliases: ['total_interaksi'] },
    { key: 'engagement_rate',  label: 'Engagement Rate (%)', required: false, aliases: ['er','er_persen','tingkat_keterlibatan'] },
  ],
  content_performance: [
    { key: 'platform',       label: 'Platform',       required: true },
    { key: 'username',       label: 'Username',       required: true,  aliases: ['account','akun'] },
    { key: 'content_url',    label: 'URL Konten',     required: false, aliases: ['url','link'] },
    { key: 'title',          label: 'Judul Konten',   required: false, aliases: ['judul','name','nama'] },
    { key: 'caption',        label: 'Caption',        required: false, aliases: ['keterangan','deskripsi'] },
    { key: 'content_type',   label: 'Format/Tipe',    required: false, aliases: ['format','type','tipe'] },
    { key: 'content_pillar', label: 'Content Pillar', required: false, aliases: ['pillar','kategori','category'] },
    { key: 'campaign_name',  label: 'Campaign',       required: false, aliases: ['kampanye'] },
    { key: 'published_at',   label: 'Tanggal Posting', required: true, aliases: ['date','tanggal','publish_date','posting_date'] },
    { key: 'views',          label: 'Views',          required: false, aliases: ['tampilan'] },
    { key: 'reach',          label: 'Reach',          required: false },
    { key: 'impressions',    label: 'Impressions',    required: false },
    { key: 'likes',          label: 'Likes',          required: false, aliases: ['suka'] },
    { key: 'comments',       label: 'Comments',       required: false, aliases: ['komentar'] },
    { key: 'shares',         label: 'Shares',         required: false, aliases: ['bagikan'] },
    { key: 'saves',          label: 'Saves',          required: false, aliases: ['simpan'] },
    { key: 'replies',        label: 'Replies',        required: false, aliases: ['balasan'] },
    { key: 'reposts',        label: 'Reposts',        required: false },
    { key: 'engagement_rate',  label: 'Engagement Rate (%)', required: false, aliases: ['er'] },
    { key: 'watch_rate',       label: 'Watch Rate (%)',      required: false },
    { key: 'completion_rate',  label: 'Completion Rate (%)', required: false },
  ],
  competitor_metrics: [
    { key: 'platform',               label: 'Platform',         required: true },
    { key: 'competitor_name',        label: 'Nama Kompetitor',  required: true, aliases: ['name','nama','brand'] },
    { key: 'username',               label: 'Username',         required: true, aliases: ['account','handle'] },
    { key: 'metric_date',            label: 'Tanggal Metrik',   required: true, aliases: ['date','tanggal'] },
    { key: 'followers',              label: 'Followers',        required: false },
    { key: 'follower_growth',        label: 'Pertumbuhan',      required: false, aliases: ['growth'] },
    { key: 'posting_frequency',      label: 'Frekuensi Posting/Minggu', required: false, aliases: ['frequency','frekuensi'] },
    { key: 'average_likes',          label: 'Rata-rata Likes',  required: false, aliases: ['avg_likes'] },
    { key: 'average_comments',       label: 'Rata-rata Comments', required: false, aliases: ['avg_comments'] },
    { key: 'average_shares',         label: 'Rata-rata Shares', required: false, aliases: ['avg_shares'] },
    { key: 'average_engagement_rate', label: 'Avg. ER (%)',     required: false, aliases: ['avg_er','avg_engagement_rate'] },
    { key: 'top_content_url',        label: 'URL Top Konten',   required: false, aliases: ['top_url'] },
  ],
};

export { FIELD_DEFS };

export default function StepMapper({ importType, csvHeaders, columnMap, onChange }) {
  const fieldDefs = FIELD_DEFS[importType] || [];
  const requiredFields = fieldDefs.filter(f => f.required);
  const mappedRequired = requiredFields.filter(f => Object.values(columnMap).includes(f.key));
  const allRequiredMapped = mappedRequired.length === requiredFields.length;

  const handleAutoMap = () => {
    const auto = autoMapColumns(csvHeaders, fieldDefs);
    onChange(auto);
  };

  const handleChange = (csvCol, targetField) => {
    onChange(prev => ({ ...prev, [csvCol]: targetField }));
  };

  const getConflict = (csvCol, selectedField) => {
    if (!selectedField || selectedField === '__skip__') return false;
    return Object.entries(columnMap).some(([col, field]) => col !== csvCol && field === selectedField);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Mapping Kolom</h3>
          <p className="text-xs text-gray-400 mt-0.5">Cocokkan kolom CSV dengan field yang dibutuhkan.</p>
        </div>
        <button onClick={handleAutoMap}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 text-violet-600 text-xs font-semibold hover:bg-violet-100 transition-colors border border-violet-200">
          <Wand2 size={13} /> Auto-detect
        </button>
      </div>

      {/* Required fields status */}
      <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-xs font-medium
        ${allRequiredMapped ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-amber-50 border border-amber-100 text-amber-700'}`}>
        <Info size={13} />
        {allRequiredMapped
          ? `Semua ${requiredFields.length} kolom wajib sudah terpetakan ✓`
          : `${requiredFields.length - mappedRequired.length} kolom wajib belum dipetakan: ${requiredFields.filter(f => !Object.values(columnMap).includes(f.key)).map(f => f.label).join(', ')}`
        }
      </div>

      {/* Mapping table */}
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {csvHeaders.map((csvCol) => {
          const selected = columnMap[csvCol] || '__skip__';
          const conflict = getConflict(csvCol, selected);
          return (
            <div key={csvCol} className={`flex items-center gap-3 p-3 rounded-xl border transition-all
              ${conflict ? 'border-red-200 bg-red-50' : selected !== '__skip__' ? 'border-violet-100 bg-lavender-50' : 'border-gray-100 bg-white'}`}>
              {/* CSV column */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold text-gray-700 truncate">{csvCol}</p>
                <p className="text-[10px] text-gray-400">Kolom CSV</p>
              </div>

              <span className="text-gray-300 text-xs">→</span>

              {/* Target field select */}
              <div className="relative flex-1 min-w-0">
                <select
                  value={selected}
                  onChange={e => handleChange(csvCol, e.target.value)}
                  className={`w-full appearance-none px-3 py-2 pr-7 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-100 transition-all
                    ${conflict ? 'border-red-300 text-red-600' : selected !== '__skip__' ? 'border-violet-300 text-violet-700 bg-white' : 'border-gray-200 text-gray-400 bg-white'}`}
                >
                  <option value="__skip__">— Abaikan kolom ini —</option>
                  <optgroup label="Field Tersedia">
                    {fieldDefs.map(f => (
                      <option key={f.key} value={f.key}>
                        {f.required ? '* ' : ''}{f.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Required badge */}
              {selected !== '__skip__' && fieldDefs.find(f => f.key === selected)?.required && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex-shrink-0">WAJIB</span>
              )}
              {conflict && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-500 text-white rounded flex-shrink-0">DUPLIKAT</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
        <Info size={11} />
        Field bertanda <strong>*</strong> wajib dipetakan. Kolom yang diabaikan tidak akan diimport.
      </p>
    </div>
  );
}
