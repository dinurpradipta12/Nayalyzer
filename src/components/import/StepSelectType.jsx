import { BarChart2, FileText, Users } from 'lucide-react';

const IMPORT_TYPES = [
  {
    key: 'account_metrics',
    icon: BarChart2,
    label: 'Account Metrics',
    desc: 'Followers, reach, impressions, engagement rate per platform per periode',
    color: 'from-violet-500 to-purple-400',
    bgColor: 'bg-violet-50 border-violet-200',
    activeColor: 'border-violet-500 bg-violet-50',
    fields: 'platform, username, metric_date, followers, reach, impressions, engagement_rate...',
  },
  {
    key: 'content_performance',
    icon: FileText,
    label: 'Content Performance',
    desc: 'Data performa tiap konten: views, likes, comments, shares, saves, ER per post',
    color: 'from-blue-500 to-cyan-400',
    bgColor: 'bg-blue-50 border-blue-200',
    activeColor: 'border-blue-500 bg-blue-50',
    fields: 'platform, username, title, content_type, published_at, views, likes, comments...',
  },
  {
    key: 'competitor_metrics',
    icon: Users,
    label: 'Competitor Metrics',
    desc: 'Data kompetitor: followers, frekuensi posting, rata-rata engagement',
    color: 'from-amber-500 to-orange-400',
    bgColor: 'bg-amber-50 border-amber-200',
    activeColor: 'border-amber-500 bg-amber-50',
    fields: 'platform, competitor_name, username, metric_date, followers, posting_frequency...',
  },
];

export default function StepSelectType({ value, onChange }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-800 mb-1">Pilih Tipe Import</h3>
      <p className="text-sm text-gray-400 mb-5">Pilih jenis data yang akan kamu import ke Nayalyzer.</p>

      <div className="space-y-3">
        {IMPORT_TYPES.map((t) => {
          const Icon = t.icon;
          const isActive = value === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-150
                ${isActive ? t.activeColor + ' shadow-soft' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Icon size={19} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-gray-800 text-sm">{t.label}</p>
                  {isActive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-500 text-white rounded-full">Dipilih</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-1.5">{t.desc}</p>
                <p className="text-[10px] text-gray-400 font-mono truncate">{t.fields}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
                ${isActive ? 'border-violet-500 bg-violet-500' : 'border-gray-300'}`}>
                {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { IMPORT_TYPES };
