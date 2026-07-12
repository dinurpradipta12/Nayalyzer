export default function ChartCard({ title, subtitle, children, action, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-card border border-purple-50 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}
