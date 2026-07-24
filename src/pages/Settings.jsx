import { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  Database,
  Eye,
  EyeOff,
  Key,
  Star,
  Upload,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
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
  const { activeWorkspace, workspaces, switchWorkspace, updateWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const { hiddenPlatforms, loading: platformLoading, setPlatformHidden } = usePlatformVisibility(workspaceId);

  const [workspaceForm, setWorkspaceForm] = useState({
    name: '',
    brand_name: '',
    industry: '',
    timezone: 'Asia/Jakarta',
    logo_url: '',
  });
  const [defaultWorkspaceId, setDefaultWorkspaceId] = useState(() => localStorage.getItem('naya_active_workspace_id') || '');
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState('');
  const [keyLoaded, setKeyLoaded] = useState(false);

  useEffect(() => {
    setWorkspaceForm({
      name: activeWorkspace?.name || '',
      brand_name: activeWorkspace?.brand_name || '',
      industry: activeWorkspace?.industry || '',
      timezone: activeWorkspace?.timezone || 'Asia/Jakarta',
      logo_url: activeWorkspace?.logo_url || '',
    });
    if (activeWorkspace?.id) {
      setDefaultWorkspaceId(localStorage.getItem('naya_active_workspace_id') || activeWorkspace.id);
    }
  }, [activeWorkspace]);

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

  const setWorkspaceField = (field, value) => {
    setWorkspaceForm((current) => ({ ...current, [field]: value }));
  };

  const saveWorkspaceInfo = async () => {
    if (!workspaceId) return;

    const name = workspaceForm.name.trim();
    if (!name) {
      setWorkspaceStatus('name_required');
      return;
    }

    setSavingWorkspace(true);
    setWorkspaceStatus('');
    const { error } = await updateWorkspace({
      name,
      brand_name: workspaceForm.brand_name.trim() || null,
      industry: workspaceForm.industry.trim() || null,
      timezone: workspaceForm.timezone || 'Asia/Jakarta',
      logo_url: workspaceForm.logo_url || null,
      updated_at: new Date().toISOString(),
    });
    setSavingWorkspace(false);
    setWorkspaceStatus(error ? 'error' : 'saved');
    setTimeout(() => setWorkspaceStatus(''), 3000);
  };

  const uploadWorkspaceLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !workspaceId) return;

    if (!file.type.startsWith('image/')) {
      setWorkspaceStatus('invalid_logo');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setWorkspaceStatus('logo_too_large');
      return;
    }

    setUploadingLogo(true);
    setWorkspaceStatus('');

    try {
      if (SUPABASE_ENABLED) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `${workspaceId}/workspace-icon-${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from('workspace-assets')
          .upload(path, file, { contentType: file.type, upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('workspace-assets').getPublicUrl(path);
        setWorkspaceField('logo_url', data.publicUrl);
      } else {
        const reader = new FileReader();
        reader.onload = () => setWorkspaceField('logo_url', reader.result);
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.warn('workspace logo upload:', error.message);
      setWorkspaceStatus('upload_error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveDefaultWorkspace = () => {
    const selected = workspaces.find(w => w.id === defaultWorkspaceId);
    if (!selected) return;
    localStorage.setItem('naya_active_workspace_id', selected.id);
    switchWorkspace(selected);
    setWorkspaceStatus('default_saved');
    setTimeout(() => setWorkspaceStatus(''), 3000);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5 items-start">
        <div className="space-y-5">
          <Card>
            <SectionTitle
              icon={Building2}
              title="Workspace Info"
              desc="Kelola identitas workspace dan workspace utama."
            />

            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-2xl border border-purple-50 bg-lavender-50 p-4 sm:flex-row sm:items-center">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm">
                  {workspaceForm.logo_url ? (
                    <img
                      src={workspaceForm.logo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-100 to-purple-100 text-xl font-bold text-violet-600">
                      {(workspaceForm.name || activeWorkspace?.name || 'W').trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase text-gray-400">Icon Workspace</p>
                  <p className="mt-1 truncate text-base font-bold text-gray-800">
                    {workspaceForm.name || 'Workspace belum dipilih'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">PNG/JPG maksimal 2 MB.</p>
                </div>

                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white px-4 py-2 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-50">
                  {uploadingLogo ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
                  ) : (
                    <Upload size={15} />
                  )}
                  Upload
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingLogo || !workspaceId}
                    onChange={uploadWorkspaceLogo}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Nama Workspace</label>
                  <input
                    value={workspaceForm.name}
                    onChange={(event) => setWorkspaceField('name', event.target.value)}
                    className="w-full rounded-xl border border-purple-100 px-4 py-2.5 text-sm text-gray-700 transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    placeholder="Nama workspace"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Nama Brand</label>
                  <input
                    value={workspaceForm.brand_name}
                    onChange={(event) => setWorkspaceField('brand_name', event.target.value)}
                    className="w-full rounded-xl border border-purple-100 px-4 py-2.5 text-sm text-gray-700 transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    placeholder="Nama brand"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Industri</label>
                  <input
                    value={workspaceForm.industry}
                    onChange={(event) => setWorkspaceField('industry', event.target.value)}
                    className="w-full rounded-xl border border-purple-100 px-4 py-2.5 text-sm text-gray-700 transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    placeholder="Creative Agency"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Timezone</label>
                  <select
                    value={workspaceForm.timezone}
                    onChange={(event) => setWorkspaceField('timezone', event.target.value)}
                    className="w-full rounded-xl border border-purple-100 px-4 py-2.5 text-sm text-gray-700 transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="Asia/Jakarta">WIB - Asia/Jakarta</option>
                    <option value="Asia/Makassar">WITA - Asia/Makassar</option>
                    <option value="Asia/Jayapura">WIT - Asia/Jayapura</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-purple-50 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600">Workspace utama saat app dibuka</label>
                    <select
                      value={defaultWorkspaceId}
                      onChange={(event) => setDefaultWorkspaceId(event.target.value)}
                      className="w-full rounded-xl border border-purple-100 px-4 py-2.5 text-sm text-gray-700 transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    >
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={saveDefaultWorkspace}
                    disabled={!defaultWorkspaceId}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-100 disabled:opacity-60"
                  >
                    <Star size={14} />
                    Jadikan Utama
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveWorkspaceInfo}
                  disabled={savingWorkspace || !workspaceId}
                  className="purple-btn flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-60"
                >
                  {savingWorkspace ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Save size={13} />
                  )}
                  Simpan Workspace
                </button>

                {workspaceStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <Check size={12} /> Workspace tersimpan
                  </span>
                )}
                {workspaceStatus === 'default_saved' && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <Check size={12} /> Workspace utama aktif
                  </span>
                )}
                {workspaceStatus === 'name_required' && <span className="text-xs text-red-500">Nama workspace wajib diisi.</span>}
                {workspaceStatus === 'invalid_logo' && <span className="text-xs text-red-500">File harus berupa gambar.</span>}
                {workspaceStatus === 'logo_too_large' && <span className="text-xs text-red-500">Ukuran icon maksimal 2 MB.</span>}
                {workspaceStatus === 'upload_error' && <span className="text-xs text-red-500">Upload gagal. Pastikan bucket workspace-assets sudah aktif.</span>}
                {workspaceStatus === 'error' && <span className="text-xs text-red-500">Gagal menyimpan workspace. Cek akses admin utama.</span>}
              </div>
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
