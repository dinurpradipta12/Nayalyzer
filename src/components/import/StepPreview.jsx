import { CheckCircle2, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';

const PREVIEW_COLS = {
  account_metrics:     ['platform','username','metric_date','followers','reach','engagement_rate'],
  content_performance: ['platform','username','published_at','title','content_type','views','likes','engagement_rate'],
  competitor_metrics:  ['platform','competitor_name','username','metric_date','followers','average_engagement_rate'],
};

export default function StepPreview({ importType, validatedRows }) {
  const cols   = PREVIEW_COLS[importType] || [];
  const valid  = validatedRows.filter(r => r._valid).length;
  const failed = validatedRows.filter(r => !r._valid).length;
  const total  = validatedRows.length;

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-800 mb-1">Preview & Validasi</h3>
      <p className="text-xs text-gray-400 mb-4">Periksa data sebelum diimport. Baris merah mengandung error.</p>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-600">{total}</span>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">Total Baris</p>
            <p className="text-xs font-semibold text-gray-700">Ditemukan</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100">
          <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-green-600">Siap Import</p>
            <p className="text-xs font-bold text-green-700">{valid} baris</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 p-3 rounded-xl border ${failed > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
          <XCircle size={18} className={failed > 0 ? 'text-red-400 flex-shrink-0' : 'text-gray-300 flex-shrink-0'} />
          <div>
            <p className={`text-[10px] ${failed > 0 ? 'text-red-500' : 'text-gray-400'}`}>Error</p>
            <p className={`text-xs font-bold ${failed > 0 ? 'text-red-600' : 'text-gray-500'}`}>{failed} baris</p>
          </div>
        </div>
      </div>

      {/* Error rows summary */}
      {failed > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13} /> Baris yang perlu diperbaiki:
          </p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {validatedRows.filter(r => !r._valid).slice(0, 10).map(r => (
              <div key={r._rowIndex} className="text-[11px] text-amber-700 flex items-start gap-1.5">
                <ChevronRight size={11} className="flex-shrink-0 mt-0.5" />
                <span><strong>Baris {r._rowIndex}:</strong> {r._errors.map(e => e.message).join('; ')}</span>
              </div>
            ))}
            {failed > 10 && <p className="text-[11px] text-amber-500 italic">...dan {failed - 10} baris lainnya</p>}
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto max-h-[280px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 w-10">#</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 w-8">✓</th>
                {cols.map(c => (
                  <th key={c} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {validatedRows.slice(0, 100).map((row) => (
                <tr key={row._rowIndex}
                  className={`border-b border-gray-50 transition-colors
                    ${!row._valid ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-lavender-50'}`}>
                  <td className="px-3 py-2 text-gray-400">{row._rowIndex}</td>
                  <td className="px-3 py-2">
                    {row._valid
                      ? <CheckCircle2 size={13} className="text-green-500" />
                      : <XCircle size={13} className="text-red-400" />}
                  </td>
                  {cols.map(c => (
                    <td key={c} className={`px-3 py-2 whitespace-nowrap max-w-[120px] truncate
                      ${!row._valid && row._errors?.some(e => e.field === c) ? 'text-red-600 font-semibold' : 'text-gray-700'}`}
                      title={String(row[c] ?? '')}>
                      {String(row[c] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {validatedRows.length > 100 && (
          <div className="px-4 py-2 text-center text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
            Menampilkan 100 dari {validatedRows.length} baris
          </div>
        )}
      </div>

      {valid === 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium text-center">
          Tidak ada baris valid. Periksa kembali mapping kolom dan data kamu.
        </div>
      )}
    </div>
  );
}
