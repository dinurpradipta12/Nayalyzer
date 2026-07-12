import PlatformBadge from './ui/PlatformBadge';

const statusConfig = {
  'High Performer': 'bg-green-50 text-green-700 border-green-100',
  'Stable': 'bg-blue-50 text-blue-600 border-blue-100',
  'Needs Improvement': 'bg-amber-50 text-amber-600 border-amber-100',
  'Underperform': 'bg-red-50 text-red-500 border-red-100',
};

const scoreColor = (score) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
};

const fmt = (v) => (v != null && v !== 0 && v !== '-') ? Number(v).toLocaleString('id-ID') : '-';
const fmtPct = (v) => (v != null && v !== 0) ? `${v}%` : '-';
const fmtTime = (v) => v ? `${Number(v).toFixed(1)}s` : '-';

const COLUMNS = {
  instagram: [
    { key: 'views',           label: 'Views',    render: r => fmt(r.views) },
    { key: 'reach',           label: 'Reach',    render: r => fmt(r.reach) },
    { key: 'likes',           label: 'Likes',    render: r => fmt(r.likes) },
    { key: 'comments',        label: 'Comments', render: r => fmt(r.comments) },
    { key: 'shares',          label: 'Shares',   render: r => fmt(r.shares) },
    { key: 'saves',           label: 'Saves',    render: r => fmt(r.saves) },
    { key: 'avgWatchTime',    label: 'Avg Watch', render: r => fmtTime(r.avgWatchTime) },
  ],
  threads: [
    { key: 'views',    label: 'Views',   render: r => fmt(r.views) },
    { key: 'likes',    label: 'Likes',   render: r => fmt(r.likes) },
    { key: 'replies',  label: 'Replies', render: r => fmt(r.replies) },
    { key: 'reposts',  label: 'Reposts', render: r => fmt(r.reposts) },
    { key: 'quotes',   label: 'Quotes',  render: r => fmt(r.quotes) },
  ],
  tiktok: [
    { key: 'views',    label: 'Views',    render: r => fmt(r.views) },
    { key: 'likes',    label: 'Likes',    render: r => fmt(r.likes) },
    { key: 'comments', label: 'Comments', render: r => fmt(r.comments) },
    { key: 'shares',   label: 'Shares',   render: r => fmt(r.shares) },
    { key: 'saves',    label: 'Saves',    render: r => fmt(r.saves) },
    { key: 'avgWatchTime', label: 'Avg Watch', render: r => fmtTime(r.avgWatchTime) },
  ],
};

export default function ContentTable({ data, platform }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Tidak ada konten yang sesuai dengan filter.
      </div>
    );
  }

  const key = (platform ?? '').toLowerCase();
  const metricCols = COLUMNS[key] ?? COLUMNS.instagram;

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs min-w-[800px]">
        <thead>
          <tr className="border-b border-purple-50">
            {['Tanggal', 'Platform', 'Judul Konten', 'Format', 'Pillar',
              ...metricCols.map(c => c.label),
              'ER%', 'Score', 'Status'].map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-gray-400 font-semibold whitespace-nowrap first:pl-1">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-purple-50">
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-lavender-50 transition-colors group">
              <td className="px-3 py-3 text-gray-400 whitespace-nowrap pl-1">
                {new Date(row.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </td>
              <td className="px-3 py-3"><PlatformBadge platform={row.platform} /></td>
              <td className="px-3 py-3 max-w-[180px]">
                <p className="font-medium text-gray-700 leading-snug line-clamp-2">{row.title}</p>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-gray-500">{row.format}</td>
              <td className="px-3 py-3">
                <span className="bg-lavender-100 text-violet-600 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap">{row.pillar}</span>
              </td>
              {metricCols.map(col => (
                <td key={col.key} className="px-3 py-3 text-gray-600 whitespace-nowrap">{col.render(row)}</td>
              ))}
              <td className="px-3 py-3 font-semibold text-violet-600 whitespace-nowrap">{fmtPct(row.engagementRate)}</td>
              <td className="px-3 py-3 whitespace-nowrap">
                <span className={`font-bold text-sm ${scoreColor(row.performanceScore)}`}>{row.performanceScore}</span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                <span className={`border px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConfig[row.status]}`}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
