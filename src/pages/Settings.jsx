import { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  Database,
  Eye,
  EyeOff,
  Key,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';
import { PLATFORM_NAMES, usePlatformVisibility } from '../lib/platformVisibility';
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

function Card({ children }) {
  return (
    <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5 lg:p-6">
      {children}
    </div>
  );
}

function SecretLine({ children }) {
  return <code className="block text-[11px] text-gray-500 break-all">{children}</code>;
}

export default function Settings() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const { hiddenPlatforms, loading: platformLoading, setPlatformHidden } = usePlatformVisibility(workspaceId);

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState('');
  const [keyLoaded, setKeyLoaded] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setKeyLoaded(true);
      return;
    }

    setKeyLoaded(false);
    supabase
      .from('workspace_settings')
      .select('ai_api_key')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
      .then(({ data }) => {
        setApiKey(data?.ai_api_key || '');
        setKeyLoaded(true);
      });
  }, [workspaceId]);

  const saveApiKey = async (nextValue = apiKey) => {
    if (!workspaceId) return;

    setSavingKey(true);
    setKeyStatus('');
    const { error } = await supabase.from('workspace_settings').upsert(
      { workspace_id: workspaceId, ai_api_key: nextValue.trim(), updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id' },
    );
    setSavingKey(false);
    setKeyStatus(error ? 'error' : 'saved');
    setTimeout(() => setKeyStatus(''), 3000);
  };

  const clearApiKey = () => {
    setApiKey('');
    saveApiKey('');
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5 items-start">
        <div className="space-y-5">
          <Card>
            <SectionTitle
              icon={Building2}
              title="Workspace Info"
              desc="Informasi workspace yang sedang dipakai."
            />

            <div className="rounded-2xl border border-purple-50 bg-lavender-50 p-4">
              <p className="text-xs font-semibold uppercase text-gray-400">Workspace</p>
              <p className="mt-1 text-lg font-bold text-gray-800">
                {activeWorkspace?.name || 'Workspace belum dipilih'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Nama, member, dan akses workspace dikelola dari halaman Team Members.
              </p>
            </div>
          </Card>

          <Card>
            <SectionTitle
              icon={SettingsIcon}
              title="Platform Visibility"
              desc="Sembunyikan platform yang belum dipakai agar tidak muncul sebagai data kosong atau dummy."
            />

            <div className="space-y-3">
              {PLATFORM_NAMES.map((platform) => {
                const isHidden = hiddenPlatforms.includes(platform);

                return (
                  <div
                    key={platform}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-purple-50 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{platform}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {isHidden
                          ? 'Disembunyikan dari dashboard, account analytics, dan laporan.'
                          : 'Ditampilkan di dashboard, account analytics, dan laporan.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={platformLoading}
                      onClick={() => setPlatformHidden(platform, !isHidden)}
                      className={`flex-shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                        isHidden
                          ? 'border-gray-200 bg-gray-50 text-gray-500 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600'
                          : 'border-violet-100 bg-violet-50 text-violet-600 hover:bg-violet-100'
                      }`}
                    >
                      {isHidden ? 'Tampilkan' : 'Sembunyikan'}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle
              icon={Sparkles}
              title="AI Provider"
              desc="Hanya konfigurasi AI yang saat ini benar-benar dipakai aplikasi."
            />

            <div className="rounded-2xl border border-purple-50 bg-lavender-50 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white">
                  <Key size={15} className="text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Competitor Intelligence AI Key</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    Field ini dipakai untuk analisis AI di Competitor Intelligence. Jika kosong, sistem tetap memakai
                    template analisis bawaan.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {keyLoaded && !apiKey && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
                  <p className="text-xs text-amber-700">Belum ada API key workspace. Analisis memakai template bawaan.</p>
                </div>
              )}

              {keyLoaded && apiKey && (
                <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
                  <p className="text-xs font-medium text-green-700">API key workspace aktif.</p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                  API Key <span className="font-normal text-gray-400">(opsional)</span>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="w-full rounded-xl border border-purple-100 py-2.5 pl-4 pr-10 font-mono text-sm text-gray-700 transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => saveApiKey()}
                  disabled={savingKey || !workspaceId}
                  className="purple-btn flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-60"
                >
                  {savingKey ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Save size={13} />
                  )}
                  Simpan API Key
                </button>

                {apiKey && (
                  <button
                    type="button"
                    onClick={clearApiKey}
                    disabled={savingKey || !workspaceId}
                    className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-60"
                  >
                    Hapus key
                  </button>
                )}

                {keyStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <Check size={12} /> Tersimpan
                  </span>
                )}
                {keyStatus === 'error' && <span className="text-xs text-red-500">Gagal menyimpan. Coba lagi.</span>}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700">AI Hypothesis</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Generate hipotesa memakai Supabase server secrets, bukan field API key workspace di atas. Ini sengaja
                dipisah supaya key utama tidak terbaca dari browser.
              </p>
              <div className="mt-3 space-y-1 rounded-xl bg-white p-3">
                <SecretLine>supabase secrets set AI_API_KEY=&quot;isi_key_provider&quot;</SecretLine>
                <SecretLine>supabase secrets set AI_BASE_URL=&quot;https://provider.example/v1&quot;</SecretLine>
                <SecretLine>supabase secrets set AI_MODEL=&quot;nama_model&quot;</SecretLine>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <SectionTitle icon={Wifi} title="Connected Apps" desc="Hubungkan platform yang ingin disync otomatis." />
            <ConnectedAccounts embedded />
          </Card>

          <Card>
            <SectionTitle
              icon={Database}
              title="Data Sources"
              desc="Import CSV atau Google Sheets saat data belum bisa ditarik otomatis."
            />
            <DataSources embedded />
          </Card>
        </div>
      </div>
    </div>
  );
}
