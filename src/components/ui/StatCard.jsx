import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// breakdown: [{ key, label, color, display }]
export default function StatCard({
  title, value, change, changePercent, icon: Icon,
  iconColor = 'bg-violet-100 text-violet-600',
  gradient = false, suffix = '', prefix = '', detail = '',
  breakdown = null,
}) {
  const isPositive = change > 0;
  const isNeutral = change === 0 || change === undefined;

  if (gradient) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 to-purple-400 rounded-2xl p-5 text-white shadow-purple">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-6 -translate-x-6" />
        <div className="relative z-10">
          {Icon && (
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Icon size={18} className="text-white" />
            </div>
          )}
          <p className="text-white/70 text-xs font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold tracking-tight">
            {prefix}{typeof value === 'number' ? value.toLocaleString('id-ID') : value}{suffix}
          </p>
          {(changePercent !== undefined || detail) && (
            <p className="text-white/60 text-xs mt-1">
              {detail || (changePercent !== undefined ? `${isPositive ? '+' : ''}${changePercent}% vs bulan lalu` : '')}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-card border border-purple-50 hover:shadow-soft transition-shadow">
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon size={18} />
          </div>
        )}
        {!isNeutral && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
            ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {isPositive ? '+' : ''}{changePercent !== undefined ? `${changePercent}%` : change}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 font-medium mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-800 tracking-tight">
        {prefix}{typeof value === 'number' ? value.toLocaleString('id-ID') : value}{suffix}
      </p>
      {(change !== undefined || detail) && !breakdown && (
        <p className="text-xs text-gray-400 mt-1">
          {detail || `${isPositive ? '+' : ''}${typeof change === 'number' ? change.toLocaleString('id-ID') : change} vs bulan lalu`}
        </p>
      )}
      {breakdown && (
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {breakdown.map(b => (
            <span key={b.key} className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: b.color }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: b.color }} />
              {b.label} {b.display}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
