import { useState, useRef } from 'react';
import { Upload, FileText, Link2, AlertCircle, Download, Loader2, CheckCircle2, X } from 'lucide-react';
import { parseCSV, fetchGoogleSheetAsCSV, generateCSVTemplate } from '../../lib/importHelpers';

// ── CSV Uploader ──────────────────────────────────────────────
function CSVUploader({ importType, onParsed }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState(null);
  const [parsing, setParsing]   = useState(false);
  const [error, setError]       = useState('');
  const inputRef = useRef(null);

  const handleFile = async (f) => {
    if (!f) return;
    if (!f.name.match(/\.(csv|txt)$/i)) { setError('Hanya file CSV yang diterima.'); return; }
    setFile(f); setError(''); setParsing(true);
    try {
      const result = await parseCSV(f);
      if (!result.data?.length) throw new Error('File CSV kosong atau tidak ada baris data.');
      if (result.errors?.length) console.warn('CSV parse warnings:', result.errors);
      onParsed({ data: result.data, headers: result.headers, fileName: f.name });
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generateCSVTemplate(importType);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `template_${importType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Template download */}
      <div className="flex items-center justify-between p-3 bg-violet-50 rounded-xl border border-violet-100">
        <div className="flex items-center gap-2 text-xs text-violet-700">
          <FileText size={14} />
          <span>Download template CSV sesuai format yang dibutuhkan</span>
        </div>
        <button onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">
          <Download size={13} /> Download Template
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-150
          ${dragging ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-lavender-50'}`}
      >
        <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => handleFile(e.target.files[0])} />

        {parsing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="text-violet-500 animate-spin" />
            <p className="text-sm text-violet-600 font-medium">Memproses file CSV...</p>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 size={28} className="text-green-500" />
            <p className="text-sm font-semibold text-gray-700">{file.name}</p>
            <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB · Klik untuk ganti file</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-lavender-100 flex items-center justify-center">
              <Upload size={22} className="text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Drag & drop file CSV di sini</p>
              <p className="text-xs text-gray-400 mt-0.5">atau klik untuk pilih file · Maks. 10MB</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}

// ── Google Sheets Connector ───────────────────────────────────
function GoogleSheetsConnector({ onParsed }) {
  const [url, setUrl]           = useState('');
  const [sheetName, setSheetName] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleFetch = async () => {
    if (!url.trim()) { setError('Masukkan URL Google Sheets terlebih dahulu.'); return; }
    if (!url.includes('docs.google.com/spreadsheets')) { setError('URL tidak valid. Pastikan ini adalah link Google Sheets.'); return; }
    setError(''); setLoading(true);
    try {
      const result = await fetchGoogleSheetAsCSV(url.trim(), sheetName.trim());
      if (!result.data?.length) throw new Error('Sheet kosong atau format tidak dikenali.');
      onParsed({ data: result.data, headers: result.headers, fileName: url, sheetUrl: url, sheetName });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
        <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
          <Link2 size={13} /> Cara menggunakan Google Sheets
        </p>
        <ol className="text-xs text-blue-600 space-y-1 pl-4 list-decimal">
          <li>Buka Google Sheets kamu</li>
          <li>Klik <strong>Share</strong> → Set ke <strong>"Anyone with the link can view"</strong></li>
          <li>Copy link dan paste di bawah</li>
          <li>Pastikan baris pertama berisi nama kolom (header)</li>
        </ol>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">URL Google Sheets <span className="text-red-400">*</span></label>
        <input
          type="url" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">
          Nama Sheet (opsional)
          <span className="text-gray-400 font-normal ml-1">— kosongkan untuk tab pertama</span>
        </label>
        <input
          type="text" value={sheetName} onChange={e => setSheetName(e.target.value)}
          placeholder="cth: Account Metrics Juni"
          className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 leading-relaxed">{error}</p>
        </div>
      )}

      <button
        onClick={handleFetch} disabled={loading}
        className="w-full purple-btn py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-70"
      >
        {loading ? <><Loader2 size={15} className="animate-spin" /> Mengambil data...</> : <><Link2 size={15} /> Ambil Data dari Sheets</>}
      </button>
    </div>
  );
}

// ── StepUpload (container) ────────────────────────────────────
export default function StepUpload({ sourceType, importType, onParsed }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-800 mb-1">
        {sourceType === 'csv' ? 'Upload File CSV' : 'Hubungkan Google Sheets'}
      </h3>
      <p className="text-sm text-gray-400 mb-5">
        {sourceType === 'csv'
          ? 'Upload file CSV dengan data analytics. Pastikan baris pertama adalah header.'
          : 'Masukkan URL Google Sheets yang dapat diakses publik.'}
      </p>
      {sourceType === 'csv'
        ? <CSVUploader importType={importType} onParsed={onParsed} />
        : <GoogleSheetsConnector onParsed={onParsed} />
      }
    </div>
  );
}
