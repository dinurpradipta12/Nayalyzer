import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Building2, Globe, ChevronRight } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

const industries = [
  'Creative Agency', 'E-commerce', 'Fashion & Lifestyle', 'Food & Beverage',
  'Teknologi', 'Pendidikan', 'Kesehatan & Wellness', 'Properti',
  'Keuangan', 'Entertainment', 'Lainnya',
];

export default function CreateWorkspace() {
  const { createWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', brandName: '', industry: '', timezone: 'Asia/Jakarta' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError('Nama workspace wajib diisi.'); return; }
    setError(''); setLoading(true);
    const { error: wsErr } = await createWorkspace(form);
    setLoading(false);
    if (wsErr) { setError(wsErr.message || 'Gagal membuat workspace.'); return; }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-lavender-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center">
            <Sparkles size={17} className="text-white" />
          </div>
          <span className="font-bold text-xl gradient-text">Nayalyzer</span>
        </div>

        <div className="bg-white rounded-3xl shadow-card border border-purple-50 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 size={26} className="text-violet-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Buat Workspace Pertamamu</h1>
            <p className="text-gray-400 text-sm">
              Workspace adalah ruang kerja untuk brand atau klien kamu. Kamu bisa punya beberapa workspace sekaligus.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Nama Workspace <span className="text-red-400">*</span>
              </label>
              <input type="text" value={form.name} onChange={set('name')}
                placeholder="cth: Naya Creative Studio"
                className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
              <p className="text-xs text-gray-400 mt-1">Bisa nama bisnis, brand, atau nama kamu sendiri.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nama Brand (opsional)</label>
              <input type="text" value={form.brandName} onChange={set('brandName')}
                placeholder="cth: @nayacreative"
                className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Industri</label>
              <select value={form.industry} onChange={set('industry')}
                className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-600 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all appearance-none">
                <option value="">Pilih industri...</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Globe size={12} /> Timezone
              </label>
              <select value={form.timezone} onChange={set('timezone')}
                className="w-full px-4 py-3 rounded-xl border border-purple-100 text-sm text-gray-600 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all appearance-none">
                <option value="Asia/Jakarta">WIB — Asia/Jakarta (GMT+7)</option>
                <option value="Asia/Makassar">WITA — Asia/Makassar (GMT+8)</option>
                <option value="Asia/Jayapura">WIT — Asia/Jayapura (GMT+9)</option>
                <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                <option value="UTC">UTC (GMT+0)</option>
              </select>
            </div>

            {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full purple-btn py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-70 mt-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Membuat workspace...</>
                : <><span>Buat Workspace & Lanjutkan</span><ChevronRight size={15} /></>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Kamu bisa menambah anggota tim setelah workspace dibuat.
        </p>
      </div>
    </div>
  );
}
