import { CheckCircle2, XCircle, RefreshCw, Upload, ChevronRight, Sparkles } from 'lucide-react';

export default function StepResult({ result, importType, onImportAgain, onDone }) {
  if (!result) return null;

  const { success, updated, failed, errors } = result;
  const total = success + updated + failed;
  const allOk = failed === 0;

  const TYPE_LABELS = {
    account_metrics:     'Account Metrics',
    content_performance: 'Content Performance',
    competitor_metrics:  'Competitor Metrics',
  };

  return (
    <div className="text-center">
      {/* Hero icon */}
      <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg
        ${allOk ? 'bg-gradient-to-br from-violet-500 to-purple-400' : 'bg-gradient-to-br from-amber-400 to-orange-400'}`}>
        {allOk
          ? <CheckCircle2 size={28} className="text-white" />
          : <Sparkles size={28} className="text-white" />}
      </div>

      <h3 className="text-lg font-bold text-gray-800 mb-1">
        {allOk ? 'Import Berhasil!' : 'Import Selesai dengan Catatan'}
      </h3>
      <p className="text-xs text-gray-400 mb-6">
        {TYPE_LABELS[importType]} · {total} baris diproses
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
          <p className="text-2xl font-bold text-green-600">{success}</p>
          <p className="text-[11px] font-semibold text-green-500 mt-0.5">Baris Baru</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <p className="text-2xl font-bold text-blue-600">{updated}</p>
          <p className="text-[11px] font-semibold text-blue-500 mt-0.5">Diperbarui</p>
        </div>
        <div className={`p-4 rounded-2xl border ${failed > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
          <p className={`text-2xl font-bold ${failed > 0 ? 'text-red-500' : 'text-gray-400'}`}>{failed}</p>
          <p className={`text-[11px] font-semibold mt-0.5 ${failed > 0 ? 'text-red-400' : 'text-gray-400'}`}>Gagal</p>
        </div>
      </div>

      {/* Error details */}
      {errors && errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-left">
          <p className="text-xs font-bold text-red-600 flex items-center gap-1.5 mb-2">
            <XCircle size={13} /> Detail Error ({errors.length})
          </p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {errors.slice(0, 20).map((e, i) => (
              <div key={i} className="text-[11px] text-red-600 flex items-start gap-1.5">
                <ChevronRight size={11} className="flex-shrink-0 mt-0.5 text-red-400" />
                <span>
                  {e.row ? <strong>Baris {e.row}: </strong> : ''}
                  {e.message || (e.errors && e.errors.map(ee => ee.message).join('; '))}
                </span>
              </div>
            ))}
            {errors.length > 20 && (
              <p className="text-[11px] text-red-400 italic">...dan {errors.length - 20} error lainnya</p>
            )}
          </div>
        </div>
      )}

      {/* Success note */}
      {success > 0 && (
        <div className="mb-6 p-3 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-700">
          Data berhasil tersimpan dan akan muncul di dashboard dalam beberapa saat.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onImportAgain}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={15} /> Import Lagi
        </button>
        <button onClick={onDone}
          className="flex-1 purple-btn py-3 text-sm flex items-center justify-center gap-2">
          <CheckCircle2 size={15} /> Selesai
        </button>
      </div>
    </div>
  );
}
