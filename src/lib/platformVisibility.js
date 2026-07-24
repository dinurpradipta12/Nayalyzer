import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, SUPABASE_ENABLED } from './supabase';

export const PLATFORM_NAMES = ['Instagram', 'TikTok', 'Threads'];
export const PLATFORM_KEYS = PLATFORM_NAMES.map(platform => platform.toLowerCase());

const STORAGE_PREFIX = 'naya_hidden_platforms_';

function storageKey(workspaceId) {
  return `${STORAGE_PREFIX}${workspaceId || 'demo'}`;
}

export function normalizeHiddenPlatforms(value) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map(platform => PLATFORM_NAMES.find(name => name.toLowerCase() === String(platform).toLowerCase()))
    .filter(Boolean);
}

export function isPlatformVisible(hiddenPlatforms, platform) {
  return !normalizeHiddenPlatforms(hiddenPlatforms).includes(platform);
}

export function usePlatformVisibility(workspaceId) {
  const [hiddenPlatforms, setHiddenPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setHiddenPlatforms([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    const cached = localStorage.getItem(storageKey(workspaceId));
    if (cached) {
      try {
        setHiddenPlatforms(normalizeHiddenPlatforms(JSON.parse(cached)));
      } catch {
        localStorage.removeItem(storageKey(workspaceId));
      }
    }

    if (!SUPABASE_ENABLED) {
      setLoading(false);
      return;
    }

    supabase
      .from('workspace_settings')
      .select('hidden_platforms')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data?.hidden_platforms) {
          const normalized = normalizeHiddenPlatforms(data.hidden_platforms);
          setHiddenPlatforms(normalized);
          localStorage.setItem(storageKey(workspaceId), JSON.stringify(normalized));
        }
      })
      .catch((error) => console.warn('load hidden platforms:', error.message))
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [workspaceId]);

  const saveHiddenPlatforms = useCallback(async (nextHidden) => {
    const normalized = normalizeHiddenPlatforms(nextHidden);
    setHiddenPlatforms(normalized);
    if (workspaceId) localStorage.setItem(storageKey(workspaceId), JSON.stringify(normalized));

    if (!SUPABASE_ENABLED || !workspaceId) return { data: normalized };

    const { data, error } = await supabase
      .from('workspace_settings')
      .upsert(
        { workspace_id: workspaceId, hidden_platforms: normalized, updated_at: new Date().toISOString() },
        { onConflict: 'workspace_id' },
      )
      .select('hidden_platforms')
      .single();

    if (error) return { error };
    return { data };
  }, [workspaceId]);

  const setPlatformHidden = useCallback((platform, hidden) => {
    const canonical = PLATFORM_NAMES.find(name => name.toLowerCase() === String(platform).toLowerCase());
    if (!canonical) return Promise.resolve({});
    const next = hidden
      ? [...new Set([...hiddenPlatforms, canonical])]
      : hiddenPlatforms.filter(item => item !== canonical);
    return saveHiddenPlatforms(next);
  }, [hiddenPlatforms, saveHiddenPlatforms]);

  const visiblePlatforms = useMemo(
    () => PLATFORM_NAMES.filter(platform => !hiddenPlatforms.includes(platform)),
    [hiddenPlatforms],
  );

  const visiblePlatformKeys = useMemo(
    () => visiblePlatforms.map(platform => platform.toLowerCase()),
    [visiblePlatforms],
  );

  return {
    hiddenPlatforms,
    visiblePlatforms,
    visiblePlatformKeys,
    loading,
    setPlatformHidden,
  };
}
