import { useState, useMemo } from 'react';
import { Upload, Link2, History, ChevronRight, ChevronLeft, Check, Database, RefreshCw,
         BarChart2, FileText, Users, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { normalizeAnalyticsData, validateImportRows, autoMapColumns } from '../lib/importHelpers';
import { useImport } from '../hooks/useImport';
import StepSelectType from '../components/import/StepSelectType';
import StepUpload     from '../components/import/StepUpload';
import StepMapper, { FIELD_DEFS } from '../components/import/StepMapper';
import StepPreview    from '../components/import/StepPreview';
import StepResult     from '../components/import/StepResult';

// ── Mock import history for demo mode ────────────────────────
const DEMO_HISTORY = [
  { id: 1, created_at: '2026-06-24T09:12:00', import_type: 'account_metrics',    source_label: 'account_juni_2026.csv', total_rows: 18, success_rows: 18, updated_rows: 3, failed_rows: 0 },
  { id: 2, created_at: '2026-06-22T14:30:00', import_type: 'content_performance', source_label: 'konten_mei_2026.csv',   total_rows: 34, success_rows: 32, updated_rows: 5, failed_rows: 2 },
  { id: 3, created_at: '2026-06-20T11:05:00', import_type: 'competitor_metrics',  source_label: 'kompetitor_q2.csv',     total_rows: 12, success_rows: 12, updated_rows: 2, failed_rows: 0 },
  { id: 4, created_at: '2026-06-15T08:45:00', import_type: 'account_metrics',    source_label: 'Google Sheets Sync',    total_rows: 90, success_rows: 88, updated_rows: 12, failed_rows: 2 },
];

const TYPE_META = {
  account_metrics:     { label: 'Account Metrics',    icon: BarChart2, color: 'text-violet-600 bg-violet-50' },
  content_performance: { label: 'Content Performance', icon: FileText,  color: 'text-blue-600 bg-blue-50'    },
  competitor_metrics:  { label: 'Competitor Metrics',  icon: Users,     color: 'text-amber-600 bg-amber-50'  },
};

const TABS = [
  { key: 'csv',     label: 'Upload CSV',     icon: Upload },
  { key: 'sheets',  label: 'Google Sheets',  icon: Link2  },
  { key: 'history', label: 'Riwayat Import', icon: History },
];

const WIZARD_STEPS = ['Tipe Data', 'Upload', 'Mapping', 'Preview', 'Selesai'];

// ── Import Wizard ─────────────────────────────────────────────
function ImportWizard({ sourceType, onDone }) {
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id || 'demo-ws';
  const { executeImport, importing } = useImport(wsId);

  const [step,           setStep]         = useState(0);
  const [importType,     setImportType]   = useState('account_metrics');
  const [parsedData,     setParsedData]   = useState(null);   // { data, headers, fileName }
  const [columnMap,      setColumnMap]    = useState({});
  const [validatedRows,  setValidatedRows] = useState([]);
  const [result,         setResult]       = useState(null);

  // Auto-map when we get parsed data
  const handleParsed = (parsed) => {
    setParsedData(parsed);
    const fieldDefs = FIELD_DEFS[importType] || [];
    const auto = autoMapColumns(parsed.headers, fieldDefs);
    setColumnMap(auto);
    setStep(2);
  };

  // When importType changes, reset everything after step 0
  const handleTypeChange = (t) => {
    setImportType(t);
    setParsedData(null);
    setColumnMap({});
    setValidatedRows([]);
  };

  // Check if required fields are mapped
  const requiredMapped = useMemo(() => {
    const fieldDefs = FIELD_DEFS[importType] || [];
    const required  = fieldDefs.filter(f => f.required).map(f => f.key);
    const mapped    = Object.values(columnMap).filter(v => v && v !== '__skip__');
    return required.every(r => mapped.includes(r));
  }, [importType, columnMap]);

  const handleValidate = () => {
    const normalized = (parsedData?.data || []).map(row =>
      normalizeAnalyticsData(row, importType, columnMap)
    ).filter(Boolean);
    const validated = validateImportRows(normalized, importType);
    setValidatedRows(validated);
    setStep(3);
  };

  const handleImport = async () => {
    const res = await executeImport({
      importType,
      validatedRows,
      sourceLabel: parsedData?.fileName || (sourceType === 'sheets' ? 'Google Sheets' : 'CSV Upload'),
    });
    setResult(res);
    setStep(4);
  };

  const handleReset = () => {
    setStep(0);
    setParsedData(null);
    setColumnMap({});
    setValidatedRows([]);
    setResult(null);
  };

  const canNext = [
    true,                    // step 0: always can proceed
    !!parsedData,            // step 1: need file parsed
    requiredMapped,          // step 2: need required cols mapped
    validatedRows.filter(r => r._valid).length > 0, // step 3: need valid rows
    false,                   // step 4: done
  ];

  const handleNext = () => {
    if (step === 1 && !parsedData) return;
    if (step === 2) { handleValidate(); return; }
    if (step === 3) { handleImport(); return; }
    setStep(s => s + 1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-6">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center gap-1.5 flex-1`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all
                ${i < step ? 'bg-violet-500 text-white' : i === step ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-300' : 'bg-gray-100 text-gray-400'}`}>
                {i < step ? <Check size={11} /> : i + 1}
              </div>
              <span className={`text-[10px] font-semibold hidden sm:block truncate
                ${i === step ? 'text-violet-700' : i < step ? 'text-violet-400' : 'text-gray-400'}`}>{s}</span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`h-px flex-shrink-0 w-4 ${i < step ? 'bg-violet-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {step === 0 && <StepSelectType value={importType} onChange={handleTypeChange} />}
        {step === 1 && <StepUpload sourceType={sourceType} importType={importType} onParsed={handleParsed} />}
        {step === 2 && parsedData && (
          <StepMapper
            importType={importType}
            csvHeaders={parsedData.headers}
            columnMap={columnMap}
            onChange={setColumnMap}
          />
        )}
        {step === 3 && <StepPreview importType={importType} validatedRows={validatedRows} />}
        {step === 4 && (
          <StepResult
            result={result}
            importType={importType}
            onImportAgain={handleReset}
            onDone={onDone}
          />
        )}
      </div>

      {/* Navigation */}
      {step < 4 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
          <button
            onClick={() => step === 0 ? onDone() : setStep(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={15} />
            {step === 0 ? 'Batal' : 'Kembali'}
          </button>

          <button
            onClick={handleNext}
            disabled={!canNext[step] || importing}
            className="flex items-center gap-1.5 px-5 py-2.5 purple-btn text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {importing && <Loader2 size={14} className="animate-spin" />}
            {step === 2 ? 'Validasi Data' : step === 3 ? 'Import Sekarang' : 'Lanjut'}
            {!importing && step < 3 && <ChevronRight size={15} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Import History Tab ────────────────────────────────────────
function ImportHistory() {
  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Riwayat Import</h3>
        <button className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="space-y-3">
        {DEMO_HISTORY.map((log) => {
          const meta  = TYPE_META[log.import_type];
          const Icon  = meta?.icon || Database;
          const allOk = log.failed_rows === 0;
          return (
            <div key={log.id} className="flex items-start gap-3 p-4 rounded-2xl border border-gray-100 hover:border-violet-100 hover:bg-lavender-50 transition-all">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta?.color || 'text-gray-600 bg-gray-50'}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-700 truncate">{log.source_label}</p>
                  {allOk
                    ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                    : <XCircle size={13} className="text-amber-500 flex-shrink-0" />}
                </div>
                <p className="text-[11px] text-gray-400">{meta?.label} · {log.total_rows} baris</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-green-600 font-medium">{log.success_rows} baru</span>
                  {log.updated_rows > 0 && <span className="text-[11px] text-blue-500 font-medium">{log.updated_rows} update</span>}
                  {log.failed_rows > 0 && <span className="text-[11px] text-red-500 font-medium">{log.failed_rows} gagal</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400 flex-shrink-0">
                <Clock size={10} />
                {formatDate(log.created_at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main DataSources Page ─────────────────────────────────────
export default function DataSources({ embedded = false }) {
  const [activeTab, setActiveTab] = useState('csv');
  const [showWizard, setShowWizard] = useState(false);

  const handleStartImport = (tab) => {
    setActiveTab(tab);
    setShowWizard(true);
  };

  return (
    <div className={embedded ? '' : 'p-6 max-w-3xl mx-auto'}>
      {/* Header — hanya di halaman penuh */}
      {!embedded && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center shadow-purple">
              <Database size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Data Sources</h1>
              <p className="text-xs text-gray-400">Import data analytics dari CSV atau Google Sheets</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-6">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key}
              onClick={() => { setActiveTab(t.key); setShowWizard(t.key !== 'history'); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all
                ${activeTab === t.key && (showWizard || t.key === 'history')
                  ? 'bg-white text-violet-700 shadow-soft'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content card */}
      <div className={embedded ? '' : 'bg-white rounded-3xl border border-purple-50 shadow-card p-6'}>
        {activeTab === 'history' ? (
          <ImportHistory />
        ) : showWizard ? (
          <ImportWizard
            sourceType={activeTab}
            onDone={() => { setShowWizard(false); setActiveTab('history'); }}
          />
        ) : (
          /* Landing — prompt to start */
          <div className="text-center py-10">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg
              ${activeTab === 'csv'
                ? 'bg-gradient-to-br from-violet-500 to-purple-400'
                : 'bg-gradient-to-br from-blue-500 to-cyan-400'}`}>
              {activeTab === 'csv' ? <Upload size={28} className="text-white" /> : <Link2 size={28} className="text-white" />}
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-2">
              {activeTab === 'csv' ? 'Import via CSV' : 'Sinkronisasi Google Sheets'}
            </h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
              {activeTab === 'csv'
                ? 'Upload file CSV dengan data Account Metrics, Content Performance, atau Competitor Metrics.'
                : 'Hubungkan Google Sheets yang sudah diset publik untuk mengambil data secara langsung.'}
            </p>
            <button onClick={() => handleStartImport(activeTab)} className="purple-btn px-8 py-3 text-sm">
              Mulai Import
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
