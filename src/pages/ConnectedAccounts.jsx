import { useState, useEffect, useCallback } from 'react';
import {
  Link2, RefreshCw, Unlink, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Wifi, WifiOff, Info, ExternalLink, ChevronDown, ChevronUp,
  Upload, Zap, Settings, X, ArrowRight, LogIn, LockKeyhole, Eye, EyeOff,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { SUPABASE_ENABLED } from '../lib/supabase';
import { PLATFORM_NAMES, usePlatformVisibility } from '../lib/platformVisibility';
import { clearSocialDataCache } from '../hooks/useSocialData';
import {
  loadConnections, initiateOAuth,
  triggerSync, disconnectPlatform, PLATFORM_CONFIG,
} from '../lib/platformIntegration';
import instagramIcon from '../assets/instagram.png';
import tiktokIcon from '../assets/tik-tok.png';
import threadsIcon from '../assets/threads.png';

const PLATFORM_LOGOS = { Instagram: instagramIcon, TikTok: tiktokIcon, Threads: threadsIcon };
// Aksen warna soft per platform untuk tema kartu
const PLATFORM_ACCENT = {
  Instagram: { ring: 'ring-pink-200', dot: 'bg-pink-500', soft: 'bg-pink-50', text: 'text-pink-600' },
  TikTok:    { ring: 'ring-gray-300', dot: 'bg-gray-800', soft: 'bg-gray-100', text: 'text-gray-800' },
  Threads:   { ring: 'ring-gray-300', dot: 'bg-gray-700', soft: 'bg-gray-100', text: 'text-gray-700' },
};

// ── API Guide Modal ───────────────────────────────────────────
const API_GUIDES = {
  Instagram: {
    color: 'from-pink-500 to-orange-400',
    steps: [
      {
        title: 'Buat Meta Developer Account',
        desc: 'Buka developers.facebook.com → login dengan akun Facebook → klik "Get Started".',
        url: 'https://developers.facebook.com',
        urlLabel: 'Buka Meta Developers',
      },
      {
        title: 'Buat App Baru',
        desc: 'Klik "My Apps" → "Create App" → pilih tipe "Consumer" atau "Business" → isi nama app → Create.',
      },
      {
        title: 'Tambahkan Instagram Basic Display',
        desc: 'Di dashboard app → "Add Product" → cari "Instagram Basic Display" → klik "Set Up".',
      },
      {
        title: 'Konfigurasi OAuth Redirect URI',
        desc: 'Di Instagram Basic Display → Basic Display → tambahkan Valid OAuth Redirect URIs: https://[project].supabase.co/auth/v1/callback',
      },
      {
        title: 'Salin App ID & App Secret',
        desc: 'Catat App ID dan App Secret dari halaman Instagram Basic Display → masukkan ke Settings Nayalyzer.',
      },
    ],
    note: 'Instagram API memerlukan akun Instagram yang terhubung ke Facebook Page. Pastikan akun kamu adalah Instagram Professional (Creator atau Business).',
  },
  TikTok: {
    color: 'from-gray-900 to-gray-700',
    steps: [
      {
        title: 'Buat TikTok Developer Account',
        desc: 'Buka developers.tiktok.com → login dengan akun TikTok → daftarkan sebagai developer.',
        url: 'https://developers.tiktok.com',
        urlLabel: 'Buka TikTok Developers',
      },
      {
        title: 'Buat App',
        desc: 'Klik "Manage Apps" → "Connect an app" → isi nama, kategori, dan deskripsi app.',
      },
      {
        title: 'Aktifkan Login Kit',
        desc: 'Di halaman app → "Products" → tambahkan "Login Kit" → konfigurasikan redirect URI.',
      },
      {
        title: 'Request Permission Scopes',
        desc: 'Tambahkan scopes: user.info.basic, video.list, dan data.insights (perlu approval TikTok).',
      },
      {
        title: 'Salin Client Key & Secret',
        desc: 'Catat Client Key dan Client Secret dari halaman app → masukkan ke Settings Nayalyzer.',
      },
    ],
    note: 'TikTok API memerlukan review dan approval dari TikTok untuk scope analytics. Proses review bisa memakan waktu 1–7 hari kerja.',
  },
  Threads: {
    color: 'from-gray-800 to-gray-600',
    steps: [
      {
        title: 'Buat Meta Developer Account',
        desc: 'Buka developers.facebook.com → login dengan akun Facebook → klik "Get Started".',
        url: 'https://developers.facebook.com',
        urlLabel: 'Buka Meta Developers',
      },
      {
        title: 'Buat App dengan Threads API',
        desc: 'Klik "My Apps" → "Create App" → pilih "Consumer" → setelah dibuat, cari produk "Threads API" → "Set Up".',
      },
      {
        title: 'Hubungkan Akun Instagram',
        desc: 'Threads API membutuhkan akun Instagram yang terhubung. Pastikan akun Threads kamu sudah terhubung ke Instagram.',
      },
      {
        title: 'Konfigurasi Redirect URI',
        desc: 'Tambahkan Redirect URI di pengaturan Threads API: https://[project].supabase.co/auth/v1/callback',
      },
      {
        title: 'Salin App ID & Secret',
        desc: 'Catat App ID dan App Secret → masukkan ke Settings Nayalyzer. Threads API saat ini dalam fase beta.',
      },
    ],
    note: 'Threads API masih dalam tahap pengembangan oleh Meta. Beberapa fitur analytics mungkin belum tersedia atau memerlukan approval khusus.',
  },
};

function APIGuideModal({ platform, onClose }) {
  const guide = API_GUIDES[platform];
  if (!guide) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={`bg-gradient-to-r ${guide.color} p-6 rounded-t-3xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <PlatformIcon platform={platform} size={28} />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Cara Daftar {platform} API</h2>
                <p className="text-white/70 text-xs">Panduan langkah demi langkah</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-4">
          {guide.steps.map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 text-violet-600 font-bold text-xs flex items-center justify-center mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800 mb-0.5">{step.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                {step.url && (
                  <a href={step.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-xs text-violet-600 font-semibold hover:underline">
                    <ExternalLink size={11} /> {step.urlLabel}
                  </a>
                )}
              </div>
            </div>
          ))}

          {/* Note */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
            <Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">{guide.note}</p>
          </div>

          {/* CTA */}
          <div className="pt-2 flex gap-2">
            {guide.steps[0].url && (
              <a href={guide.steps[0].url} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-400 text-white text-sm font-bold hover:opacity-90 transition-all">
                Mulai Daftar <ArrowRight size={14} />
              </a>
            )}
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Platform logo (PNG) ───────────────────────────────────────
function PlatformIcon({ platform, size = 20 }) {
  const logo = PLATFORM_LOGOS[platform];
  if (!logo) return null;
  return (
    <img src={logo} alt={platform} width={size} height={size}
      className="object-contain rounded-[5px]" style={{ width: size, height: size }} />
  );
}

// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ status, mode }) {
  const map = {
    connected:    { icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-100', label: 'Terhubung' },
    disconnected: { icon: WifiOff,      color: 'text-gray-400 bg-gray-50 border-gray-100',   label: 'Tidak Terhubung' },
    expired:      { icon: AlertTriangle,color: 'text-amber-600 bg-amber-50 border-amber-100',label: 'Token Kedaluwarsa' },
    error:        { icon: XCircle,      color: 'text-red-500 bg-red-50 border-red-100',      label: 'Error' },
    pending:      { icon: Loader2,      color: 'text-blue-500 bg-blue-50 border-blue-100',   label: 'Menghubungkan...' },
  };
  const cfg = map[status] || map.disconnected;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
      {mode && mode !== 'oauth' && (
        <span className="ml-1 opacity-70">· {mode === 'manual' ? 'Manual' : mode === 'sheets' ? 'Sheets' : 'Hybrid'}</span>
      )}
    </span>
  );
}

// ── Mode badge ────────────────────────────────────────────────
const modeBadge = {
  oauth:   'bg-green-100 text-green-700',
  manual:  'bg-blue-100 text-blue-700',
  sheets:  'bg-violet-100 text-violet-700',
  hybrid:  'bg-amber-100 text-amber-700',
};

function relTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000)    return 'baru saja';
  if (diff < 3600000)  return `${Math.round(diff/60000)} menit lalu`;
  if (diff < 86400000) return `${Math.round(diff/3600000)} jam lalu`;
  return `${Math.round(diff/86400000)} hari lalu`;
}

// ── Platform Row (list view — untuk embedded/settings) ────────
function PlatformRow({ platform, connection, onConnect, onSync, onDisconnect, canManageLogin, onHide, connecting }) {
  const cfg = PLATFORM_CONFIG[platform];
  const [syncing,    setSyncing]    = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [localConn,  setLocalConn]  = useState(connection);

  useEffect(() => {
    setLocalConn(connection);
  }, [connection]);

  const tokenDaysLeft = localConn?.token_expires_at
    ? Math.round((new Date(localConn.token_expires_at) - Date.now()) / 86400000)
    : null;
  const username = localConn?.provider_username || localConn?.social_accounts?.username || localConn?.social_accounts?.account_name;
  const followers = localConn?.social_accounts?.followers_count;
  const isConnected  = localConn?.connection_status === 'connected' && !!username;
  const displayStatus = isConnected ? localConn?.connection_status : 'disconnected';

  const handleSync = async (type = 'full') => {
    if (!localConn?.id) return;
    setSyncing(true);
    const result = await onSync(localConn.id, type);
    setSyncing(false);
    if (result?.success) setLocalConn(p => ({ ...p, last_synced_at: new Date().toISOString() }));
  };

  return (
    <div className="rounded-2xl border border-purple-100 bg-white overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {/* Logo + identitas */}
        <PlatformIcon platform={platform} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-gray-800 truncate">{platform}</p>
            <StatusBadge status={displayStatus} />
          </div>
          <p className="text-xs text-gray-400 truncate">
            {username ? `@${username}` : 'Belum terhubung'}
            {isConnected && followers > 0 && <span className="text-gray-300"> · {followers.toLocaleString('id-ID')} followers</span>}
          </p>
        </div>

        {/* Aksi */}
        {isConnected ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => handleSync('full')} disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-400 text-white text-xs font-bold hover:shadow-purple transition-all disabled:opacity-60">
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              <span className="hidden sm:inline">{syncing ? 'Syncing' : 'Sync'}</span>
            </button>
            {canManageLogin && (
              <button onClick={() => onDisconnect(localConn.id, () => setLocalConn(p => ({ ...p, connection_status: 'disconnected', access_token_enc: null })))}
                title="Disconnect"
                className="p-2 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-all">
                <Unlink size={13} />
              </button>
            )}
            <button onClick={() => setExpanded(e => !e)} title="Detail"
              className="p-2 rounded-xl text-gray-400 hover:bg-lavender-50 hover:text-violet-600 transition-all">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {canManageLogin && (
              <button onClick={() => onHide(platform)} title={`Hide ${platform}`}
                className="p-2 rounded-xl border border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all">
                <EyeOff size={13} />
              </button>
            )}
            <button onClick={() => canManageLogin && onConnect(platform, 'oauth')} disabled={!canManageLogin || connecting}
              title={canManageLogin ? `Masuk dengan ${platform}` : 'Hanya admin utama yang bisa login akun sosial'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-400 text-white text-xs font-bold hover:shadow-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {connecting ? <Loader2 size={12} className="animate-spin" /> : canManageLogin ? <LogIn size={12} /> : <LockKeyhole size={12} />}
              <span className="hidden sm:inline">{connecting ? 'Menunggu login...' : canManageLogin ? `Masuk dengan ${platform}` : 'Terkunci'}</span><span className="sm:hidden">Masuk</span>
            </button>
          </div>
        )}
      </div>

      {/* Detail expandable */}
      {isConnected && expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-purple-50 space-y-3">
          {/* Stats + mode */}
          <div className="flex items-center gap-4 flex-wrap text-xs pt-2">
            <span className="text-gray-400">Sync: <span className="text-gray-700 font-semibold">{localConn?.last_synced_at ? relTime(localConn.last_synced_at) : '–'}</span></span>
            <span className="text-gray-400">Token: <span className={`font-semibold ${tokenDaysLeft !== null && tokenDaysLeft < 7 ? 'text-red-500' : 'text-gray-700'}`}>{tokenDaysLeft !== null ? `${tokenDaysLeft}h` : '∞'}</span></span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${modeBadge[localConn.connection_mode] || modeBadge.oauth}`}>
              {localConn.connection_mode === 'oauth' ? '🔗 Official API' : localConn.connection_mode === 'sheets' ? '📊 Sheets' : localConn.connection_mode === 'hybrid' ? '⚡ Hybrid' : '📋 Manual'}
            </span>
          </div>
          {/* Quick sync */}
          <div className="flex items-center gap-1 bg-lavender-50 rounded-xl p-1">
            {['profile','media','insights'].map(t => (
              <button key={t} onClick={() => handleSync(t)} disabled={syncing}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-gray-500 hover:text-violet-600 hover:bg-white transition-all disabled:opacity-40 capitalize">
                {t}
              </button>
            ))}
          </div>
          {/* Keterbatasan */}
          <div className="space-y-1.5">
            {cfg.limitations.slice(0, 2).map((lim, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-gray-500">
                <AlertTriangle size={10} className="text-amber-400 flex-shrink-0 mt-0.5" /> {lim}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Platform Card ─────────────────────────────────────────────
function PlatformCard({ platform, connection, onConnect, onSync, onDisconnect, canManageLogin, onHide, connecting }) {
  const cfg = PLATFORM_CONFIG[platform];
  const [syncing,    setSyncing]    = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showLimits, setShowLimits] = useState(false);
  const [localConn,  setLocalConn]  = useState(connection);

  useEffect(() => {
    setLocalConn(connection);
  }, [connection]);

  const isExpired    = localConn?.connection_status === 'expired';
  const tokenDaysLeft = localConn?.token_expires_at
    ? Math.round((new Date(localConn.token_expires_at) - Date.now()) / 86400000)
    : null;
  const username = localConn?.provider_username || localConn?.social_accounts?.username || localConn?.social_accounts?.account_name;
  const isConnected  = localConn?.connection_status === 'connected' && !!username;
  const displayStatus = isConnected ? localConn?.connection_status : (isExpired ? 'expired' : 'disconnected');

  const handleSync = async (type = 'full') => {
    if (!localConn?.id) return;
    setSyncing(true);
    setSyncResult(null);
    const result = await onSync(localConn.id, type);
    setSyncing(false);
    setSyncResult(result);
    if (result.success) setLocalConn(p => ({ ...p, last_synced_at: new Date().toISOString() }));
  };

  const accent = PLATFORM_ACCENT[platform] || PLATFORM_ACCENT.Threads;
  return (
    <div className="bg-white rounded-3xl border border-purple-50 shadow-card overflow-hidden flex flex-col">
      {/* Aksen strip brand tipis di atas */}
      <div className={`h-1 bg-gradient-to-r ${cfg.color}`} />

      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <PlatformIcon platform={platform} size={40} />
            <div className="min-w-0">
              <p className="font-bold text-sm text-gray-800 leading-tight">{platform}</p>
              <p className="text-xs text-gray-400 truncate">
                {username ? `@${username}` : 'Belum terhubung'}
              </p>
            </div>
          </div>
          <StatusBadge status={displayStatus} mode={localConn?.connection_mode} />
        </div>

        {/* Stat pills — hanya saat terhubung */}
        {isConnected && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-lavender-50 px-2.5 py-2 text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Followers</p>
              <p className="font-bold text-sm text-gray-800">
                {localConn?.social_accounts?.followers_count > 0
                  ? localConn.social_accounts.followers_count.toLocaleString('id-ID')
                  : '–'}
              </p>
            </div>
            <div className="rounded-xl bg-lavender-50 px-2.5 py-2 text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Sync</p>
              <p className="font-bold text-sm text-gray-800 truncate">
                {localConn?.last_synced_at ? relTime(localConn.last_synced_at) : '–'}
              </p>
            </div>
            <div className="rounded-xl bg-lavender-50 px-2.5 py-2 text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Token</p>
              <p className={`font-bold text-sm ${tokenDaysLeft !== null && tokenDaysLeft < 7 ? 'text-red-500' : tokenDaysLeft !== null && tokenDaysLeft < 14 ? 'text-amber-500' : 'text-gray-800'}`}>
                {tokenDaysLeft !== null ? `${tokenDaysLeft}h` : '∞'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 pb-5 space-y-4 flex-1 flex flex-col">
        {/* Connection mode info */}
        {isConnected && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">Mode:</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${modeBadge[localConn.connection_mode] || modeBadge.manual}`}>
              {localConn.connection_mode === 'oauth' ? '🔗 Official API'
               : localConn.connection_mode === 'sheets' ? '📊 Google Sheets'
               : localConn.connection_mode === 'hybrid' ? '⚡ Hybrid'
               : '📋 Manual Import'}
            </span>
            {(localConn.scopes || []).length > 0 && (
              <span className="text-[10px] text-gray-400">{localConn.scopes.length} scope</span>
            )}
          </div>
        )}

        {/* Token warning */}
        {isExpired && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700">Token kedaluwarsa</p>
              <p className="text-xs text-amber-600">Reconnect untuk melanjutkan sync otomatis.</p>
            </div>
          </div>
        )}

        {/* Sync result */}
        {syncResult && (
          <div className={`flex items-start gap-2 p-3 rounded-xl text-xs border ${
            syncResult.error ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
            {syncResult.error
              ? <><XCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" /><span className="text-red-600">{syncResult.error}</span></>
              : <><CheckCircle2 size={13} className="text-green-600 flex-shrink-0 mt-0.5" /><span className="text-green-700">Sync selesai — {syncResult.inserted} baru, {syncResult.updated} update</span></>
            }
          </div>
        )}

        {/* Actions */}
        {!isConnected ? (
          <div className="space-y-2">
            <button onClick={() => canManageLogin && onConnect(platform, 'oauth')} disabled={!canManageLogin || connecting}
              title={canManageLogin ? `Masuk dengan ${platform}` : 'Hanya admin utama yang bisa login akun sosial'}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-400 text-white text-sm font-bold hover:shadow-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {connecting ? <Loader2 size={15} className="animate-spin" /> : canManageLogin ? <LogIn size={15} /> : <LockKeyhole size={15} />}
              {connecting ? 'Menunggu login...' : canManageLogin ? `Masuk dengan ${platform}` : 'Login akun sosial terkunci'}
            </button>
            <button onClick={() => onConnect(platform, 'manual')}
              className="w-full text-center text-xs text-gray-400 hover:text-violet-600 transition-colors py-1">
              atau import data manual (CSV / Sheets)
            </button>
            {canManageLogin && (
              <button onClick={() => onHide(platform)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-100 text-xs font-semibold text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all">
                <EyeOff size={13} /> Hide platform ini
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Sync Now + Disconnect sejajar */}
            <div className="flex gap-2">
              <button onClick={() => handleSync('full')} disabled={syncing}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-400 text-white text-xs font-bold hover:shadow-purple transition-all disabled:opacity-60">
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
              {canManageLogin && (
                <button onClick={() => onDisconnect(localConn.id, () => setLocalConn(p => ({ ...p, connection_status: 'disconnected', access_token_enc: null })))}
                  title="Disconnect"
                  className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-red-100 text-red-500 text-xs font-semibold hover:bg-red-50 transition-all">
                  <Unlink size={13} />
                </button>
              )}
            </div>
            {/* Quick sync tabs */}
            <div className="flex items-center gap-1 bg-lavender-50 rounded-xl p-1">
              {['profile','media','insights'].map(t => (
                <button key={t} onClick={() => handleSync(t)} disabled={syncing}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-gray-500 hover:text-violet-600 hover:bg-white transition-all disabled:opacity-40 capitalize">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* API limitations toggle */}
        <button onClick={() => setShowLimits(!showLimits)}
          className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-600 transition-colors pt-3 mt-auto border-t border-gray-100">
          <span className="flex items-center gap-1"><Info size={11} /> Keterbatasan API</span>
          {showLimits ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {showLimits && (
          <div className="space-y-2">
            {cfg.limitations.map((lim, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                <AlertTriangle size={10} className="text-amber-400 flex-shrink-0 mt-0.5" />
                {lim}
              </div>
            ))}
            <a href={cfg.setupUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline mt-1">
              <ExternalLink size={11} /> Dokumentasi {platform} API
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function ConnectedAccounts({ embedded = false }) {
  const { activeWorkspace, isPrimaryAdmin } = useWorkspace();
  const wsId = activeWorkspace?.id;
  const { hiddenPlatforms, visiblePlatforms, setPlatformHidden } = usePlatformVisibility(wsId);
  const [connections,  setConnections]  = useState([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [toast,        setToast]        = useState(null);
  const [apiGuide,     setApiGuide]     = useState(null);
  const [connectingPlatform, setConnectingPlatform] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const reload = useCallback(async () => {
    setLoadingConns(true);
    const conns = await loadConnections(wsId);
    setConnections(conns ?? []);
    setLoadingConns(false);
  }, [wsId]);

  useEffect(() => { if (wsId) reload(); }, [reload]);

  // Check for OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error     = params.get('error');
    if (connected) { showToast(`${connected} berhasil terhubung!`, 'success'); reload(); }
    if (error)     { showToast(`OAuth error: ${error}`, 'error'); }
    if (connected || error) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleConnect = async (platform, mode) => {
    if (mode === 'manual') { window.location.href = '/data-sources'; return; }
    if (mode === 'guide')  { setApiGuide(platform); return; }
    if (connectingPlatform) return;

    setConnectingPlatform(platform);
    showToast(`Membuka login ${platform}...`, 'info');
    try {
      const result = await initiateOAuth(platform, wsId);
      if (result.cancelled) return;
      if (result.error === 'not_configured') {
        showToast(`${platform} API belum dikonfigurasi.`, 'error');
      } else if (result.error === 'timeout') {
        showToast(`Login ${platform} belum selesai. Tutup popup lama lalu coba lagi.`, 'error');
      } else if (result.error) {
        showToast(`Error: ${result.error}`, 'error');
      } else if (result.success) {
        showToast(`${platform} berhasil terhubung!`, 'success');
        reload();
      }
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleSync = async (connectionId, type) => {
    const result = await triggerSync(connectionId, wsId, type);
    if (result.success) { showToast(`Sync ${type} selesai`, 'success'); reload(); }
    return result;
  };

  const handleDisconnect = async (connectionId, onDone) => {
    if (!confirm('Yakin ingin disconnect? Token akses akan dihapus.')) return;
    const result = await disconnectPlatform(connectionId);
    if (result?.error) {
      showToast(`Gagal disconnect: ${result.error}`, 'error');
      return;
    }
    clearSocialDataCache(wsId);
    onDone?.();
    showToast('Platform berhasil di-disconnect', 'success');
    reload();
  };

  const handleHidePlatform = async (platform) => {
    const result = await setPlatformHidden(platform, true);
    if (result?.error) showToast(`Gagal hide ${platform}: ${result.error.message}`, 'error');
    else showToast(`${platform} disembunyikan dari dashboard`, 'success');
  };

  const handleShowPlatform = async (platform) => {
    const result = await setPlatformHidden(platform, false);
    if (result?.error) showToast(`Gagal tampilkan ${platform}: ${result.error.message}`, 'error');
    else showToast(`${platform} ditampilkan kembali`, 'success');
  };

  const connMap = {};
  // Prefer connected status; among same status, newest wins
  connections.forEach(c => {
    const existing = connMap[c.platform];
    if (!existing) { connMap[c.platform] = c; return; }
    const existingConnected = existing.connection_status === 'connected';
    const cConnected = c.connection_status === 'connected';
    if (cConnected && !existingConnected) connMap[c.platform] = c;
  });

  const modalAndToast = (
    <>
      {apiGuide && <APIGuideModal platform={apiGuide} onClose={() => setApiGuide(null)} />}
      {toast && (
        <div className={`fixed bottom-24 lg:bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 border
          ${toast.type === 'success' ? 'bg-green-50 border-green-100 text-green-700'
            : toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-700'
            : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={13} /> : toast.type === 'error' ? <XCircle size={13} /> : <Info size={13} />}
          {toast.msg}
        </div>
      )}
    </>
  );

  const accountsGrid = loadingConns ? (
    <div className="flex justify-center py-16"><Loader2 size={28} className="text-violet-400 animate-spin" /></div>
  ) : embedded ? (
    <div className="space-y-2.5">
      {visiblePlatforms.map(p => (
        <PlatformRow key={p} platform={p} connection={connMap[p]}
          onConnect={handleConnect} onSync={handleSync} onDisconnect={handleDisconnect}
          canManageLogin={isPrimaryAdmin} onHide={handleHidePlatform}
          connecting={connectingPlatform === p} />
      ))}
      {hiddenPlatforms.length > 0 && (
        <div className="rounded-2xl border border-dashed border-purple-100 bg-lavender-50/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Platform disembunyikan</p>
          <div className="flex flex-wrap gap-2">
            {hiddenPlatforms.map(platform => (
              <button key={platform} onClick={() => handleShowPlatform(platform)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-purple-100 text-xs font-semibold text-gray-600 hover:text-violet-600 hover:border-violet-200">
                <Eye size={13} /> {platform}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
	      {PLATFORM_NAMES.map(p => (
	        <PlatformCard key={p} platform={p} connection={connMap[p]}
	          onConnect={handleConnect} onSync={handleSync} onDisconnect={handleDisconnect}
            canManageLogin={isPrimaryAdmin} onHide={handleHidePlatform}
            connecting={connectingPlatform === p} />
	      ))}
    </div>
  );

  // Embedded mode — hanya kartu akun, tanpa header/wrapper halaman
  if (embedded) {
    return (
      <>
        {modalAndToast}
        {accountsGrid}
      </>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {modalAndToast}
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center shadow-purple">
            <Wifi size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Connected Accounts</h1>
            <p className="text-xs text-gray-400">Hubungkan platform untuk sync data otomatis</p>
          </div>
        </div>
        {!SUPABASE_ENABLED && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full">
            <AlertTriangle size={11} /> Mode Demo — OAuth tidak aktif
          </div>
        )}
      </div>

      {/* Mode explanation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Link2,     color: 'text-green-600 bg-green-50', label: 'Official API',  desc: 'Data langsung dari platform' },
          { icon: Upload,    color: 'text-blue-600 bg-blue-50',   label: 'Manual Import', desc: 'Upload CSV secara berkala' },
          { icon: Settings,  color: 'text-violet-600 bg-violet-50', label: 'Google Sheets', desc: 'Sync dari spreadsheet' },
          { icon: Zap,       color: 'text-amber-600 bg-amber-50', label: 'Hybrid',        desc: 'API + manual kombinasi' },
        ].map(({ icon: Icon, color, label, desc }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-start gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={13} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">{label}</p>
              <p className="text-[10px] text-gray-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Accounts */}
      {accountsGrid}
    </div>
  );
}
