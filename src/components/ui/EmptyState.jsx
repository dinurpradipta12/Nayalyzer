import { SearchX } from 'lucide-react';

export default function EmptyState({ title = 'Tidak ada data', description = 'Coba ubah filter untuk melihat data lainnya.', icon: Icon = SearchX }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-lavender-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={26} className="text-violet-400" />
      </div>
      <p className="font-semibold text-gray-700 mb-1">{title}</p>
      <p className="text-sm text-gray-400 max-w-xs">{description}</p>
    </div>
  );
}
