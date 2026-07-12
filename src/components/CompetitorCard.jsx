import { useState, useEffect } from 'react';
import { Zap, AlertCircle, Target, Trash2, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

const fmt = (n) => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n ?? 0);

async function proxyImage(imageUrl, workspaceId) {
  if (!imageUrl?.startsWith('http')) return null;
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

/* Thumbnail that proxies CDN URL on mount */
function ProxiedThumb({ url, workspaceId, permalink, likes }) {
  const [src, setSrc] = useState(url?.startsWith('data:') ? url : null);

  useEffect(() => {
    if (!url?.startsWith('http')) return;
    let cancelled = false;
    proxyImage(url, workspaceId).then(proxied => {
      if (!cancelled && proxied) setSrc(proxied);
    });
    return () => { cancelled = true; };
  }, [url, workspaceId]);

  return (
    <a href={permalink} target="_blank" rel="noopener noreferrer"
      className="aspect-square rounded-xl overflow-hidden bg-lavender-100 hover:opacity-80 transition-opacity relative group block">
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 size={13} className="text-lavender-300" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}
      {src && likes > 0 && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent px-1.5 pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-[9px] text-white font-semibold">♥ {fmt(likes)}</p>
        </div>
      )}
    </a>
  );
}

export default function CompetitorCard({ competitor, workspaceId, onDelete, onRefresh, onGenerateAI }) {
  const {
    name, username,
    profile_picture_url, biography,
    followers_count, engagement_rate, posting_freq_weekly,
    strength, weakness, opportunity,
    recent_posts, last_fetched_at,
  } = competitor;

  const [generatingAI, setGeneratingAI] = useState(false);

  const hasRealData = followers_count > 0;
  const initials = (name ?? username ?? '?').slice(0, 2).toUpperCase();
  const posts = Array.isArray(recent_posts) ? recent_posts.slice(0, 6) : [];

  const handleGenerateAI = async () => {
    if (!onGenerateAI) return;
    setGeneratingAI(true);
    try { await onGenerateAI(competitor); }
    finally { setGeneratingAI(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-purple-50 shadow-card overflow-hidden hover:shadow-soft transition-shadow flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-purple-50">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            {profile_picture_url ? (
              <img src={profile_picture_url} alt={name}
                className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border border-purple-50" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-lavender-200 to-lavender-100 flex items-center justify-center text-violet-600 font-bold text-sm flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 text-sm leading-tight truncate">{name}</p>
              <a href={`https://instagram.com/${username?.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-violet-400 hover:text-violet-600 transition-colors">{username}</a>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onRefresh && (
              <button onClick={() => onRefresh(competitor)} title="Refresh data"
                className="p-1.5 rounded-lg hover:bg-lavender-50 text-gray-300 hover:text-violet-500 transition-colors">
                <RefreshCw size={13} />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(competitor.id)} title="Hapus kompetitor"
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {biography && (
          <p className="text-[11px] text-gray-400 line-clamp-2 mb-3 leading-relaxed">{biography}</p>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-lavender-50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">Followers</p>
            <p className="font-bold text-gray-800 text-sm">{hasRealData ? fmt(followers_count) : '–'}</p>
          </div>
          <div className="bg-lavender-50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">Eng. Rate</p>
            <p className="font-bold text-violet-600 text-sm">{hasRealData ? `${engagement_rate}%` : '–'}</p>
          </div>
          <div className="bg-lavender-50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">Post/minggu</p>
            <p className="font-bold text-green-600 text-sm">{hasRealData ? `${posting_freq_weekly}×` : '–'}</p>
          </div>
        </div>
      </div>

      {/* Recent posts */}
      {posts.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">Postingan Terbaru</p>
          <div className="grid grid-cols-3 gap-1.5">
            {posts.map((p, i) => (
              <ProxiedThumb
                key={i}
                url={p.thumbnail_url}
                workspaceId={workspaceId}
                permalink={p.permalink}
                likes={p.likes}
              />
            ))}
          </div>
        </div>
      )}

      {/* Generate AI button — show when no SWOT yet */}
      {!strength && !weakness && !opportunity && onGenerateAI && (
        <div className="px-4 pb-3 pt-1">
          <button onClick={handleGenerateAI} disabled={generatingAI}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-violet-200 text-xs text-violet-500 hover:bg-lavender-50 hover:border-violet-400 transition-colors disabled:opacity-60">
            {generatingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {generatingAI ? 'Membuat analisis AI...' : 'Generate Analisis AI'}
          </button>
        </div>
      )}

      {/* Details (strength/weakness/opportunity) */}
      {(strength || weakness || opportunity) && (
        <div className="p-4 space-y-2.5 flex-1">
          {/* Regenerate button */}
          {onGenerateAI && (
            <div className="flex justify-end mb-1">
              <button onClick={handleGenerateAI} disabled={generatingAI}
                title="Generate ulang analisis AI"
                className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50">
                {generatingAI ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                {generatingAI ? 'Generating...' : 'Regenerate'}
              </button>
            </div>
          )}
          {strength && (
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-md bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap size={11} className="text-green-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Kekuatan</p>
                <p className="text-xs text-gray-600">{strength}</p>
              </div>
            </div>
          )}
          {weakness && (
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle size={11} className="text-red-400" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Kelemahan</p>
                <p className="text-xs text-gray-600">{weakness}</p>
              </div>
            </div>
          )}
          {opportunity && (
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Target size={11} className="text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Peluang</p>
                <p className="text-xs text-gray-600">{opportunity}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {last_fetched_at && (
        <div className="px-4 pb-3 mt-auto">
          <p className="text-[10px] text-gray-300">
            Update: {new Date(last_fetched_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      )}
    </div>
  );
}
