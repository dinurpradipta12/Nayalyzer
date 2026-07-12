import { Filter, ChevronDown } from 'lucide-react';

export default function FilterBar({ filters, values, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
        <Filter size={13} />
        Filter:
      </div>
      {filters.map((filter) => (
        <div key={filter.key} className="relative">
          <select
            value={values[filter.key] || ''}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="appearance-none bg-white border border-purple-100 rounded-xl px-3 py-1.5 text-xs font-medium text-gray-600 pr-7 cursor-pointer hover:border-violet-300 focus:outline-none focus:border-violet-400 transition-colors shadow-sm"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      ))}
    </div>
  );
}
