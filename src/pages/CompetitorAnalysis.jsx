import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Plus, X, Search, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Users, BarChart2, Calendar, Globe } from 'lucide-react';
import CompetitorCard from '../components/CompetitorCard';
import ChartCard from '../components/ui/ChartCard';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';

const LINE_COLORS = ['#187877', '#187877', '#26C6DA', '#F59E0B', '#78909C'];

const fmt = (n) => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n ?? 0);

async function callLookup(username, workspaceId, action = 'lookup', extraData = null) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/competitor-lookup`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ username: username.replace(/^@/, ''), workspace_id: workspaceId, action, manual_data: extraData }),
    }
  );
  try { return await res.json(); }
  catch { return { error: `HTTP ${res.status}` }; }
}

async function proxyImage(imageUrl, workspaceId) {
  if (!imageUrl) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/competitor-lookup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ workspace_id: workspaceId, action: 'proxy_image', image_url: imageUrl }),
      }
    );
    const data = await res.json();
    return data.data_url ?? null;
  } catch { return null; }
}

/* ── Profile Detail View ── */
function ProfileDetail({ profile: initialProfile, workspaceId, onBack, onAdded, onClose }) {
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const [profile, setProfile]   = useState(initialProfile);

  // Proxy all CDN images (profile pic + thumbnails) through edge function
  useEffect(() => {
    let cancelled = false;
    async function proxyAll() {
      const needsProxy = (u) => u && u.startsWith('http');
      const picUrl  = initialProfile.profile_picture_url;
      const thumbUrls = (initialProfile.recent_posts ?? []).map(p => p.thumbnail_url);
      const [proxiedPic, ...proxiedThumbs] = await Promise.all([
        needsProxy(picUrl) ? proxyImage(picUrl, workspaceId) : Promise.resolve(picUrl),
        ...thumbUrls.map(u => needsProxy(u) ? proxyImage(u, workspaceId) : Promise.resolve(u)),
      ]);
      const proxied = [proxiedPic, ...proxiedThumbs];
      if (cancelled) return;
      setProfile(prev => ({
        ...prev,
        profile_picture_url: proxied[0] ?? prev.profile_picture_url,
        recent_posts: (prev.recent_posts ?? []).map((p, i) => ({
          ...p,
          thumbnail_url: proxied[i + 1] ?? p.thumbnail_url,
        })),
      }));
    }
    proxyAll();
    return () => { cancelled = true; };
  }, [initialProfile, workspaceId]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const data = await callLookup(profile.username, workspaceId, 'save', profile);
      if (data.error) { setError(data.error); }
      else {
        setSaved(true);
        // Trigger AI analysis in background — don't await, just fire
        if (data.saved?.id) {
          callLookup('', workspaceId, 'analyze', null)
            .catch(() => {})
            // need to pass competitor_id directly
            .then?.(() => {});
          // Use direct fetch for analyze since callLookup signature uses username
          supabase.auth.getSession().then(({ data: { session } }) => {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/competitor-lookup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ workspace_id: workspaceId, action: 'analyze', competitor_id: data.saved.id }),
            }).catch(() => {});
          });
        }
        onAdded?.(data.saved);
      }
    } catch { setError('Gagal menyimpan. Coba lagi.'); }
    finally { setSaving(false); }
  };

  const topFormat = profile.top_content_type === 'VIDEO' ? 'Reels'
    : profile.top_content_type === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Foto';

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Back bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-purple-50 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 transition-colors">
          <ArrowLeft size={15} /> Kembali
        </button>
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
          <X size={17} className="text-gray-400" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
        {/* Profile hero */}
        <div className="flex items-start gap-4">
          {profile.profile_picture_url ? (
            <img src={profile.profile_picture_url} alt={profile.name}
              className="w-16 h-16 rounded-2xl object-cover border border-purple-100 flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-lavender-200 to-lavender-100 flex items-center justify-center text-violet-600 font-bold text-lg flex-shrink-0">
              {profile.name?.slice(0,2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-gray-800 text-base leading-tight">{profile.name}</p>
            <a href={`https://instagram.com/${profile.username}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-violet-500 hover:underline">@{profile.username}</a>
            {profile.biography && (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-3">{profile.biography}</p>
            )}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-600 mt-1">
                <Globe size={10} /> {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Users,     label: 'Followers',      value: fmt(profile.followers_count), color: 'text-violet-600' },
            { icon: BarChart2, label: 'Eng. Rate',      value: `${profile.engagement_rate}%`, color: 'text-violet-500' },
            { icon: Calendar,  label: 'Post/Minggu',    value: `${profile.posting_freq_weekly}×`, color: 'text-cyan-500' },
            { icon: Search,    label: 'Total Postingan',value: fmt(profile.media_count),      color: 'text-amber-500' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-lavender-50 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Icon size={14} className={color} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">{label}</p>
                <p className={`text-sm font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Top format badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-gray-400">Format terpopuler:</span>
          <span className="bg-violet-100 text-violet-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">{topFormat}</span>
        </div>

        {/* Recent posts grid */}
        {profile.recent_posts?.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">Postingan Terbaru</p>
            <div className="grid grid-cols-3 gap-1.5">
              {profile.recent_posts.map((p, i) => (
                <a key={i} href={p.permalink} target="_blank" rel="noopener noreferrer"
                  className="aspect-square rounded-xl overflow-hidden bg-lavender-100 hover:opacity-80 transition-opacity relative group">
                  {p.thumbnail_url?.startsWith('data:') ? (
                    <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lavender-300">
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-end p-1.5 opacity-0 group-hover:opacity-100">
                    <p className="text-[10px] text-white font-semibold">❤️ {fmt(p.likes)}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-xl p-3">
            <AlertCircle size={13} /> {error}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-5 pb-5 pt-3 border-t border-purple-50 flex-shrink-0">
        {saved ? (
          <div className="flex items-center justify-center gap-2 text-sm text-green-600 bg-green-50 rounded-xl py-3">
            <CheckCircle2 size={16} />
            <span className="font-medium">Berhasil ditambahkan ke daftar kompetitor!</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-purple-100 text-sm font-medium text-gray-500 hover:bg-gray-50">
              Tutup
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 purple-btn py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Tambahkan ke Kompetitor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const PLATFORMS = ['Instagram', 'TikTok', 'Threads'];

const PLATFORM_COLORS = {
  Instagram: 'from-violet-500 to-rose-400',
  TikTok:    'from-gray-800 to-gray-600',
  Threads:   'from-gray-600 to-gray-400',
};

const PLATFORM_URLS = {
  Instagram: 'instagram.com',
  TikTok:    'tiktok.com',
  Threads:   'threads.net',
};

/* ── Manual Entry Form ── */
function ManualForm({ initialUsername = '', initialPlatform = 'Instagram', workspaceId, onAdded, onClose, onBack }) {
  const [form, setForm] = useState({
    username: initialUsername, name: '', followers_count: '', engagement_rate: '',
    posting_freq_weekly: '', biography: '', platform: initialPlatform,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.username.trim()) { setError('Username wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const { data, error: err } = await supabase.from('competitors').insert({
        workspace_id:        workspaceId,
        platform:            form.platform,
        name:                form.name || form.username,
        username:            '@' + form.username.replace(/^@/, ''),
        biography:           form.biography || null,
        followers_count:     parseInt(form.followers_count) || 0,
        engagement_rate:     parseFloat(form.engagement_rate) || 0,
        posting_freq_weekly: parseFloat(form.posting_freq_weekly) || 0,
        last_fetched_at:     new Date().toISOString(),
      }).select().single();
      if (err) throw err;
      setSaved(true);
      onAdded?.(data);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (saved) {
    return (
      <div className="px-6 py-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 size={28} className="text-green-500" />
        </div>
        <p className="font-bold text-gray-800 mb-1">Kompetitor ditambahkan!</p>
        <p className="text-xs text-gray-400 mb-5">@{form.username} ({form.platform}) berhasil masuk ke daftar kompetitor</p>
        <button onClick={onClose} className="purple-btn px-6 py-2 text-sm">Selesai</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[85vh]">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-purple-50 flex-shrink-0">
        {onBack ? (
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600">
            <ArrowLeft size={15} /> Kembali
          </button>
        ) : <div />}
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
          <X size={17} className="text-gray-400" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
        <p className="text-xs text-gray-400">Isi data kompetitor secara manual. Kamu bisa update kapanpun.</p>

        {/* Platform selector */}
        <div>
          <label className="text-[11px] font-semibold text-gray-500 block mb-1.5">Platform *</label>
          <div className="flex gap-2">
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => set('platform', p)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all
                  ${form.platform === p
                    ? 'bg-violet-500 text-white border-violet-500 shadow-sm'
                    : 'border-purple-100 text-gray-500 hover:border-violet-300'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {[
          { label: `Username ${form.platform} *`, key: 'username', placeholder: 'contoh: nikerunning', prefix: '@' },
          { label: 'Nama Akun',                   key: 'name',     placeholder: 'Nama brand / kreator' },
          { label: 'Bio',                          key: 'biography', placeholder: 'Deskripsi singkat akun' },
        ].map(({ label, key, placeholder, prefix }) => (
          <div key={key}>
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">{label}</label>
            <div className="relative">
              {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
              <input value={form[key]} onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className={`w-full ${prefix ? 'pl-7' : 'pl-3'} pr-3 py-2.5 rounded-xl border border-purple-100 text-sm focus:outline-none focus:border-violet-400`} />
            </div>
          </div>
        ))}

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Followers',   key: 'followers_count',     placeholder: '68400', suffix: '' },
            { label: 'Eng. Rate %', key: 'engagement_rate',     placeholder: '4.1',   suffix: '%' },
            { label: 'Post/Minggu', key: 'posting_freq_weekly', placeholder: '5',     suffix: '×' },
          ].map(({ label, key, placeholder, suffix }) => (
            <div key={key}>
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">{label}</label>
              <div className="relative">
                <input type="number" value={form[key]} onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full pl-3 pr-6 py-2.5 rounded-xl border border-purple-100 text-sm focus:outline-none focus:border-violet-400" />
                {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-xs">{suffix}</span>}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl p-2.5">
            <AlertCircle size={13} /> {error}
          </div>
        )}
      </div>

      <div className="px-5 pb-5 pt-3 border-t border-purple-50 flex gap-2 flex-shrink-0">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-purple-100 text-sm text-gray-500 hover:bg-gray-50">
          Batal
        </button>
        <button onClick={save} disabled={saving}
          className="flex-1 purple-btn py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
          {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          Simpan Kompetitor
        </button>
      </div>
    </div>
  );
}

/* ── Search Modal ── */
function SearchModal({ workspaceId, onClose, onAdded }) {
  const [query, setQuery]               = useState('');
  const [searching, setSearching]       = useState(false);
  const [suggestion, setSuggestion]     = useState(null);
  const [selected, setSelected]         = useState(null);
  const [showManual, setShowManual]     = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState('Instagram');
  const [error, setError]               = useState('');
  const [retryKey, setRetryKey]         = useState(0);
  const debounceRef                     = useRef(null);
  const inputRef                        = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  // Detect platform + extract username from URL or plain input
  const parseInput = (raw) => {
    const s = raw.trim();
    if (/tiktok\.com/i.test(s)) {
      const m = s.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/);
      return { platform: 'TikTok', username: m ? m[1] : s.replace(/^@/, '') };
    }
    // threads.net AND threads.com (Meta switched domains)
    if (/threads\.(net|com)/i.test(s)) {
      const m = s.match(/threads\.(net|com)\/@?([a-zA-Z0-9_.]+)/);
      return { platform: 'Threads', username: m ? m[2] : s.replace(/^@/, '') };
    }
    const igMatch = s.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
    if (igMatch) return { platform: 'Instagram', username: igMatch[1] };
    return { platform: 'Instagram', username: s.replace(/^@/, '') };
  };

  useEffect(() => {
    setSuggestion(null); setError('');
    const { platform, username } = parseInput(query);
    setDetectedPlatform(platform);

    // Non-Instagram: never call lookup, always manual
    if (platform !== 'Instagram') return;
    if (username.length < 3) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await callLookup(username, workspaceId, 'lookup');
        if (data.error) { setError(data.error); }
        else {
          if (data.profile_picture_url) {
            const proxied = await proxyImage(data.profile_picture_url, workspaceId);
            if (proxied) data.profile_picture_url = proxied;
          }
          setSuggestion(data);
        }
      } catch { setError('Gagal terhubung ke server.'); }
      finally { setSearching(false); }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [query, workspaceId, retryKey]);

  // Manual form mode
  if (showManual || selected === 'manual') {
    const { platform, username } = parseInput(query);
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-purple-100 w-full max-w-md overflow-hidden">
          <ManualForm
            initialUsername={username}
            initialPlatform={platform}
            workspaceId={workspaceId}
            onAdded={onAdded}
            onClose={onClose}
            onBack={() => { setShowManual(false); setSelected(null); }}
          />
        </div>
      </div>
    );
  }

  if (selected && selected !== 'manual') {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-purple-100 w-full max-w-md overflow-hidden">
          <ProfileDetail
            profile={selected}
            workspaceId={workspaceId}
            onBack={() => setSelected(null)}
            onAdded={onAdded}
            onClose={onClose}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-purple-100 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h3 className="font-bold text-gray-800 text-base">Tambah Kompetitor</h3>
            <p className="text-xs text-gray-400 mt-0.5">Paste URL profil Instagram, TikTok, atau Threads</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-6 pb-2 relative">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">@</span>
            {searching ? (
              <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400"
                style={{ animation: 'spin 1s linear infinite' }} />
            ) : query.length >= 3 ? (
              <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
            ) : null}
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); setShowManual(false); }}
              placeholder="tiktok.com/@username atau instagram.com/username"
              className="w-full pl-9 pr-10 py-3 rounded-2xl border border-purple-100 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
            />
          </div>

          {/* Platform detected banner for non-Instagram */}
          {query.length >= 3 && detectedPlatform !== 'Instagram' && (
            <div className="mt-2.5 space-y-2">
              <div className="flex items-start gap-2 text-xs text-violet-700 bg-violet-50 rounded-xl px-3 py-2.5">
                <span className="font-bold flex-shrink-0">{detectedPlatform}</span>
                <span className="text-violet-500">
                  terdeteksi. API {detectedPlatform} hanya tersedia untuk akun sendiri, bukan profil kompetitor — isi data secara manual.
                </span>
              </div>
              <button onClick={() => setShowManual(true)}
                className="w-full text-xs font-semibold text-white bg-violet-500 hover:bg-violet-600 rounded-xl py-2.5 transition-colors">
                Isi Data {detectedPlatform} Manual →
              </button>
            </div>
          )}

          {/* Suggestion dropdown */}
          {suggestion && (
            <div className="absolute left-6 right-6 top-full mt-1.5 z-10">
              <div className="bg-white rounded-2xl border border-purple-100 shadow-xl overflow-hidden">
                <button onClick={() => setSelected(suggestion)}
                  className="w-full flex items-center gap-3 p-3.5 hover:bg-lavender-50 transition-colors text-left">
                  {suggestion.profile_picture_url ? (
                    <img src={suggestion.profile_picture_url} alt=""
                      className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border border-purple-50" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-lavender-200 to-lavender-100 flex items-center justify-center text-violet-600 font-bold text-sm flex-shrink-0">
                      {suggestion.name?.slice(0,2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{suggestion.name}</p>
                    <p className="text-xs text-violet-400">@{suggestion.username}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-gray-500">{fmt(suggestion.followers_count)} followers</span>
                      <span className="text-[11px] text-violet-500">{suggestion.engagement_rate}% ER</span>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs text-violet-500 font-medium bg-violet-50 px-2.5 py-1 rounded-lg">Lihat →</span>
                </button>
              </div>
            </div>
          )}

          {error && query.length >= 3 && !searching && detectedPlatform === 'Instagram' && (
            <div className="mt-2.5 space-y-2">
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="flex-shrink-0" />
                <span className="flex-1">Instagram membatasi akses otomatis. Coba lagi atau tambah manual.</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setError(''); setRetryKey(k => k + 1); }}
                  className="flex-1 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-xl py-2.5 transition-colors">
                  ↺ Coba Lagi
                </button>
                <button onClick={() => setShowManual(true)}
                  className="flex-1 text-xs font-semibold text-white bg-violet-500 hover:bg-violet-600 rounded-xl py-2.5 transition-colors">
                  Tambah Manual →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hint & manual button */}
        <div className="px-6 pb-5 pt-3">
          {query.length < 3 ? (
            <p className="text-xs text-gray-300 text-center">Ketik minimal 3 karakter untuk mencari</p>
          ) : null}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-px bg-purple-50" />
            <span className="text-[10px] text-gray-300">atau</span>
            <div className="flex-1 h-px bg-purple-50" />
          </div>
          <button onClick={() => setShowManual(true)}
            className="w-full mt-2.5 py-2.5 rounded-xl border border-dashed border-purple-200 text-xs text-violet-500 hover:bg-lavender-50 transition-colors font-medium">
            + Tambah Kompetitor Secara Manual
          </button>
        </div>
        {query.length >= 3 && !suggestion && !searching && !error && (
          <div className="px-6 pb-6 text-center text-xs text-gray-300">
            Tidak ada hasil ditemukan
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompetitorAnalysis() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const [showAddModal, setShowAddModal] = useState(false);
  const [competitors, setCompetitors]   = useState([]);
  const [loading, setLoading]           = useState(true);

  const loadCompetitors = useCallback(async () => {
    if (!SUPABASE_ENABLED || !workspaceId) { setLoading(false); return; }
    const { data } = await supabase
      .from('competitors')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    setCompetitors(data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { loadCompetitors(); }, [loadCompetitors]);

  const handleAdded = (newComp) => {
    if (newComp) setCompetitors(prev => [...prev, newComp]);
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus kompetitor ini?')) return;
    await supabase.from('competitors').delete().eq('id', id);
    setCompetitors(prev => prev.filter(c => c.id !== id));
  };

  const handleGenerateAI = async (comp) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/competitor-lookup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ workspace_id: workspaceId, action: 'analyze', competitor_id: comp.id }),
        }
      );
      const data = await res.json();
      if (data.strength || data.weakness || data.opportunity) {
        setCompetitors(prev => prev.map(c => c.id === comp.id ? {
          ...c,
          strength:    data.strength    ?? c.strength,
          weakness:    data.weakness    ?? c.weakness,
          opportunity: data.opportunity ?? c.opportunity,
          ai_analysis: JSON.stringify({ comparison_summary: data.comparison_summary, recommendations: data.recommendations }),
        } : c));
      }
    } catch {}
  };

  const [refreshError, setRefreshError] = useState('');

  const handleRefresh = async (comp) => {
    setRefreshError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/competitor-lookup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ username: comp.username.replace('@',''), workspace_id: workspaceId, action: 'save' }),
        }
      );
      if (!res.ok) {
        setRefreshError('Instagram membatasi akses saat ini. Coba beberapa menit lagi.');
        setTimeout(() => setRefreshError(''), 5000);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setRefreshError(data.error);
        setTimeout(() => setRefreshError(''), 5000);
      } else if (data.saved) {
        setCompetitors(prev => prev.map(c => c.id === data.saved.id ? { ...data.saved } : c));
      }
    } catch {
      setRefreshError('Gagal terhubung ke server.');
      setTimeout(() => setRefreshError(''), 5000);
    }
  };

  // Build follower growth comparison chart from competitor_metrics if available
  const erCompare = competitors
    .filter(c => c.engagement_rate > 0)
    .map(c => ({ name: c.name ?? c.username, er: Number(c.engagement_rate) }));

  const freqCompare = competitors
    .filter(c => c.posting_freq_weekly > 0)
    .map(c => ({ name: (c.name ?? c.username).slice(0, 15), freq: Number(c.posting_freq_weekly) }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {loading ? 'Memuat...' : `${competitors.length} kompetitor dipantau`}
        </p>
        <button onClick={() => setShowAddModal(true)} className="purple-btn flex items-center gap-2 text-sm">
          <Plus size={15} />
          Tambah Kompetitor
        </button>
      </div>

      {/* Competitor cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-purple-50 h-64 animate-pulse" />
          ))}
        </div>
      ) : competitors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-purple-50 p-12 text-center">
          <p className="text-2xl mb-2">🔍</p>
          <p className="text-sm font-semibold text-gray-600 mb-1">Belum ada kompetitor</p>
          <p className="text-xs text-gray-400 mb-4">Tambah kompetitor untuk mulai memantau performa mereka</p>
          <button onClick={() => setShowAddModal(true)} className="purple-btn text-sm px-4 py-2 flex items-center gap-2 mx-auto">
            <Plus size={14} /> Tambah Kompetitor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {competitors.map(comp => (
            <CompetitorCard
              key={comp.id}
              competitor={comp}
              workspaceId={workspaceId}
              onDelete={handleDelete}
              onRefresh={handleRefresh}
              onGenerateAI={handleGenerateAI}
            />
          ))}
        </div>
      )}

      {refreshError && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <AlertCircle size={13} className="flex-shrink-0" />
          {refreshError}
        </div>
      )}

      {/* Charts — only show when there's data */}
      {competitors.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {erCompare.length > 0 && (
            <ChartCard title="Engagement Rate Kompetitor" subtitle="Perbandingan ER dari data terbaru">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={erCompare} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAF5F4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-white rounded-xl shadow-lg border border-purple-100 p-2.5 text-xs">
                        <p className="font-semibold text-gray-700">{payload[0].payload.name}</p>
                        <p className="text-violet-600 font-bold">{payload[0].value}% ER</p>
                      </div>
                    ) : null}
                  />
                  <Bar dataKey="er" name="Eng. Rate" radius={[4,4,0,0]}>
                    {erCompare.map((_, i) => (
                      <rect key={i} fill={LINE_COLORS[i % LINE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {freqCompare.length > 0 && (
            <ChartCard title="Frekuensi Posting per Minggu" subtitle="Konsistensi posting kompetitor">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={freqCompare} layout="vertical" margin={{ top: 0, right: 5, left: 60, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip
                    content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-white rounded-xl shadow-lg border border-purple-100 p-2.5 text-xs">
                        <p className="font-semibold">{payload[0].payload.name}: {payload[0].value}× /minggu</p>
                      </div>
                    ) : null}
                  />
                  <Bar dataKey="freq" fill="#A8D5D1" radius={[0,6,6,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* AI Analysis section */}
      {competitors.some(c => c.strength || c.weakness || c.opportunity) && (
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs">✦</div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Analisis AI Kompetitor</h3>
              <p className="text-[11px] text-gray-400">Insight otomatis berdasarkan data real kompetitor</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {competitors.filter(c => c.strength || c.weakness || c.opportunity).map(c => {
              const aiData = (() => { try { return JSON.parse(c.ai_analysis ?? '{}'); } catch { return {}; } })();
              return (
                <div key={c.id} className="bg-lavender-50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    {c.profile_picture_url ? (
                      <img src={c.profile_picture_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-violet-200 flex items-center justify-center text-violet-700 font-bold text-xs flex-shrink-0">
                        {(c.name ?? c.username ?? '?').slice(0,2).toUpperCase()}
                      </div>
                    )}
                    <p className="font-semibold text-gray-800 text-xs leading-tight truncate">{c.name}</p>
                  </div>
                  {c.strength && (
                    <div className="flex gap-2">
                      <span className="text-green-500 text-base leading-tight flex-shrink-0">⚡</span>
                      <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Kekuatan</p><p className="text-[11px] text-gray-600 leading-relaxed">{c.strength}</p></div>
                    </div>
                  )}
                  {c.weakness && (
                    <div className="flex gap-2">
                      <span className="text-red-400 text-base leading-tight flex-shrink-0">⚠</span>
                      <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Kelemahan</p><p className="text-[11px] text-gray-600 leading-relaxed">{c.weakness}</p></div>
                    </div>
                  )}
                  {c.opportunity && (
                    <div className="flex gap-2">
                      <span className="text-amber-500 text-base leading-tight flex-shrink-0">🎯</span>
                      <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Peluang untuk Kita</p><p className="text-[11px] text-gray-600 leading-relaxed">{c.opportunity}</p></div>
                    </div>
                  )}
                  {aiData.comparison_summary && (
                    <div className="border-t border-purple-100 pt-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Perbandingan dengan Akun Kita</p>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{aiData.comparison_summary}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Aggregated recommendations */}
          {competitors.some(c => {
            try { return JSON.parse(c.ai_analysis ?? '{}').recommendations?.length > 0; } catch { return false; }
          }) && (
            <div className="mt-5 border-t border-purple-50 pt-4">
              <p className="text-xs font-bold text-gray-700 mb-3">💡 Rekomendasi untuk Akun Kita</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {competitors.flatMap(c => {
                  try { return JSON.parse(c.ai_analysis ?? '{}').recommendations ?? []; } catch { return []; }
                }).slice(0, 6).map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 bg-lavender-50 rounded-xl p-3">
                    <span className="text-violet-500 font-bold text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
                    <p className="text-[11px] text-gray-600 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add competitor modal */}
      {showAddModal && (
        <SearchModal
          workspaceId={workspaceId}
          onClose={() => setShowAddModal(false)}
          onAdded={(comp) => { handleAdded(comp); }}
        />
      )}
    </div>
  );
}
