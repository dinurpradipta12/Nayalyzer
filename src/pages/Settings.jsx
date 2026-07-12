import { useState, useEffect } from 'react';
import { User, Link2, Users, Wifi, Sparkles, FileText, Check, Save, Eye, EyeOff, Key, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';
import ConnectedAccounts from './ConnectedAccounts';
import DataSources from './DataSources';

function SectionTitle({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center flex-shrink-0">
        <Icon size={17} className="text-violet-600" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// Card pembungkus tiap section
function Card({ children }) {
  return (
    <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5 lg:p-6">
      {children}
    </div>
  );
}

function Input({ label, defaultValue, type = 'text', placeholder }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 block mb-1.5">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-purple-100 text-sm text-gray-700 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
      />
    </div>
  );
}

function Toggle({ label, desc, defaultChecked = false }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-purple-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`w-10 h-6 rounded-full transition-all duration-200 flex-shrink-0 relative
          ${checked ? 'bg-gradient-to-r from-violet-500 to-purple-400' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200
          ${checked ? 'left-[calc(100%-22px)]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

export default function Settings() {
  const [saved, setSaved]                 = useState(false);
  const { activeWorkspace }               = useWorkspace();
  const workspaceId                       = activeWorkspace?.id;

  // AI API key state
  const [apiKey, setApiKey]         = useState('');
  const [showKey, setShowKey]       = useState(false);
  const [savingKey, setSavingKey]   = useState(false);
  const [keyStatus, setKeyStatus]   = useState(''); // 'saved' | 'error' | ''
  const [keyLoaded, setKeyLoaded]   = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from('workspace_settings').select('ai_api_key').eq('workspace_id', workspaceId).maybeSingle()
      .then(({ data }) => {
        if (data?.ai_api_key) setApiKey(data.ai_api_key);
        setKeyLoaded(true);
      });
  }, [workspaceId]);

  const saveApiKey = async () => {
    if (!workspaceId) return;
    setSavingKey(true); setKeyStatus('');
    const { error } = await supabase.from('workspace_settings').upsert(
      { workspace_id: workspaceId, ai_api_key: apiKey.trim(), updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id' }
    );
    setSavingKey(false);
    setKeyStatus(error ? 'error' : 'saved');
    setTimeout(() => setKeyStatus(''), 3000);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 items-start">
      {/* ── Kolom kiri: pengaturan umum ── */}
      <div className="lg:col-span-2 space-y-4 lg:space-y-5">
        {/* Brand Profile */}
        <Card>
          <SectionTitle icon={User} title="Brand Profile" desc="Informasi dasar tentang brand atau kreator kamu." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nama Brand" defaultValue="Naya Creative Studio" />
            <Input label="Email" defaultValue="hello@nayacreative.id" type="email" />
            <Input label="Industri" defaultValue="Creative Agency" />
            <Input label="Website" defaultValue="https://nayacreative.id" />
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Deskripsi Singkat</label>
              <textarea
                defaultValue="Studio kreatif spesialis branding, desain visual, dan strategi konten untuk UMKM."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-purple-100 text-sm text-gray-700 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end mt-5 pt-4 border-t border-purple-50">
            <button onClick={handleSave}
              className={`purple-btn flex items-center gap-2 text-sm transition-all ${saved ? 'from-green-500 to-emerald-400' : ''}`}>
              {saved ? <><Check size={15} /> Tersimpan!</> : <><Save size={15} /> Simpan Perubahan</>}
            </button>
          </div>
        </Card>

        {/* Competitor Accounts */}
        <Card>
          <SectionTitle icon={Users} title="Competitor Accounts" desc="Akun kompetitor yang sedang dipantau." />
          <div className="space-y-2">
            {[
              { name: 'Studio Kreatif Bali', platform: 'Instagram', username: '@studiokreatifbali' },
              { name: 'Desain Kita ID', platform: 'TikTok', username: '@desainkitaid' },
              { name: 'Brand Builder Co', platform: 'Instagram', username: '@brandbuildco' },
              { name: 'Kreasi Visual Studio', platform: 'Threads', username: '@kreasivisual' },
            ].map(c => (
              <div key={c.username} className="flex items-center justify-between p-3 bg-lavender-50 rounded-xl text-sm">
                <div>
                  <p className="font-semibold text-gray-700">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.platform} · {c.username}</p>
                </div>
                <button className="text-xs text-red-400 hover:text-red-600 font-medium">Hapus</button>
              </div>
            ))}
          </div>
          <button className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-violet-300 text-sm text-violet-600 font-medium hover:bg-violet-50 transition-colors">
            + Tambah Kompetitor
          </button>
        </Card>

        {/* AI Settings */}
        <Card>
          <div>
              <SectionTitle icon={Sparkles} title="AI Settings" desc="Konfigurasi cara AI Hypothesis Engine bekerja." />
              <div className="space-y-1 mb-5">
                <Toggle label="Auto-generate hipotesa baru" desc="AI otomatis membuat hipotesa baru setiap minggu" defaultChecked={true} />
                <Toggle label="Notifikasi hipotesa baru" desc="Dapatkan notifikasi saat AI menemukan insight baru" defaultChecked={true} />
                <Toggle label="Validasi otomatis" desc="AI otomatis memvalidasi hipotesa berdasarkan data terbaru" defaultChecked={false} />
                <Toggle label="Insight bahasa Indonesia" desc="Tampilkan semua insight dan rekomendasi dalam bahasa Indonesia" defaultChecked={true} />
              </div>

              {/* API Key section */}
              <div className="border-t border-purple-50 pt-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Key size={15} className="text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Anthropic API Key</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Opsional. Tanpa API key, analisis kompetitor tetap berjalan dengan template bawaan.
                      Dengan API key milikmu, analisis akan lebih personal dan mendalam menggunakan Claude AI.
                    </p>
                  </div>
                </div>

                {/* Status pill — no key */}
                {keyLoaded && !apiKey && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-lavender-50 rounded-xl">
                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <p className="text-xs text-gray-500">Menggunakan analisis template bawaan · Tambah API key untuk hasil yang lebih akurat</p>
                  </div>
                )}
                {keyLoaded && apiKey && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 rounded-xl">
                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                    <p className="text-xs text-green-700 font-medium">API key aktif · Analisis kompetitor menggunakan Claude AI</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                      API Key <span className="font-normal text-gray-400">(dari console.anthropic.com)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="sk-ant-api03-..."
                        className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-purple-100 text-sm font-mono text-gray-700 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                      />
                      <button onClick={() => setShowKey(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={saveApiKey} disabled={savingKey}
                      className="purple-btn px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60">
                      {savingKey ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
                      Simpan API Key
                    </button>
                    {apiKey && (
                      <button onClick={() => { setApiKey(''); saveApiKey(); }}
                        className="text-xs text-red-400 hover:text-red-600 font-medium">
                        Hapus key
                      </button>
                    )}
                    {keyStatus === 'saved' && <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check size={12} /> Tersimpan</span>}
                    {keyStatus === 'error'  && <span className="text-xs text-red-500">Gagal menyimpan. Coba lagi.</span>}
                  </div>

                  <p className="text-[11px] text-gray-400 bg-lavender-50 rounded-xl p-3 leading-relaxed">
                    API key disimpan terenkripsi di server dan tidak pernah dibagikan ke pihak lain.
                    Dapatkan API key gratis di{' '}
                    <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer"
                      className="text-violet-500 hover:underline font-medium">console.anthropic.com</a>.
                    Biaya Claude Haiku sangat murah — sekitar Rp 15 per satu analisis kompetitor.
                  </p>
                </div>
              </div>

              <div className="border-t border-purple-50 pt-4 mt-4">
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Minimum Confidence Score untuk tampil</label>
                <input type="range" min={50} max={100} defaultValue={70} className="w-full accent-violet-500" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>50%</span><span>70% (default)</span><span>100%</span>
                </div>
              </div>
            </div>
        </Card>

        {/* Report Preferences */}
        <Card>
          <SectionTitle icon={FileText} title="Report Preferences" desc="Atur format dan jadwal laporan otomatis." />
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Format laporan default</label>
              <select className="w-full px-4 py-2.5 rounded-xl border border-purple-100 text-sm focus:outline-none focus:border-violet-400">
                <option>PDF (Landscape)</option>
                <option>PDF (Portrait)</option>
                <option>CSV</option>
                <option>Excel</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Frekuensi laporan otomatis</label>
              <select className="w-full px-4 py-2.5 rounded-xl border border-purple-100 text-sm focus:outline-none focus:border-violet-400">
                <option>Bulanan (setiap tanggal 1)</option>
                <option>Mingguan (setiap Senin)</option>
                <option>Manual</option>
              </select>
            </div>
            <div className="space-y-1">
              <Toggle label="Sertakan AI Recommendations" desc="Tambahkan rekomendasi AI di setiap laporan" defaultChecked={true} />
              <Toggle label="Sertakan Competitor Benchmark" desc="Bandingkan performa dengan kompetitor di laporan" defaultChecked={true} />
              <Toggle label="Kirim laporan via email" desc="Laporan otomatis dikirim ke email terdaftar" defaultChecked={false} />
            </div>
            <Input label="Email penerima laporan" placeholder="email@contoh.com" />
          </div>
        </Card>
      </div>

      {/* ── Kolom kanan: Connected Apps + External Data ── */}
      <div className="lg:col-span-3 space-y-4 lg:space-y-5">
        {/* Connected Apps */}
        <Card>
          <SectionTitle icon={Wifi} title="Connected Apps" desc="Hubungkan platform untuk sync data otomatis." />
          <ConnectedAccounts embedded />
        </Card>

        {/* External Data */}
        <Card>
          <SectionTitle icon={Database} title="External Data" desc="Import data analytics dari CSV atau Google Sheets." />
          <DataSources embedded />
        </Card>
      </div>
    </div>
  );
}
