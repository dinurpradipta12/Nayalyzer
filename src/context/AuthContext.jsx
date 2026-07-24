import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { withTimeout } from '../lib/async';

const AuthContext = createContext(null);
const AUTH_CACHE_KEY = 'naya_auth_cache';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Bootstrap session ───────────────────────────────────
  useEffect(() => {
    let mounted = true;

    if (!SUPABASE_ENABLED) {
      // Demo mode: restore from localStorage
      const stored = localStorage.getItem('naya_auth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setUser(parsed.user || { id: 'demo', email: parsed.email || 'demo@nayalyzer.id' });
          setProfile(parsed.profile || { full_name: 'Demo User', email: 'demo@nayalyzer.id' });
        } catch {
          setUser({ id: 'demo', email: 'demo@nayalyzer.id' });
        }
      }
      setLoading(false);
      return;
    }

    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.user) {
          setUser(parsed.user);
          setProfile(parsed.profile || null);
          setLoading(false);
        }
      } catch {
        localStorage.removeItem(AUTH_CACHE_KEY);
      }
    }

    withTimeout(supabase.auth.getSession(), 5000, 'Auth session timeout').then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user);
      } else {
        localStorage.removeItem(AUTH_CACHE_KEY);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    }).catch((e) => {
      console.warn('getSession:', e.message);
      if (mounted && !cached) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user);
        } else {
          localStorage.removeItem(AUTH_CACHE_KEY);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (authUser) => {
    if (!SUPABASE_ENABLED) return;
    try {
      const { data, error } = await withTimeout(supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single(), 5000, 'Profile request timeout');
      if (!error && data) {
        setProfile(data);
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ user: authUser, profile: data }));
      } else {
        // Table may not exist yet (migrations pending) — use auth metadata as fallback
        const { data: { user: fallbackUser } } = await withTimeout(supabase.auth.getUser(), 5000, 'User request timeout');
        if (fallbackUser) {
          const fallbackProfile = {
            id: fallbackUser.id,
            email: fallbackUser.email,
            full_name: fallbackUser.user_metadata?.full_name ?? fallbackUser.email?.split('@')[0] ?? 'User',
          };
          setProfile(fallbackProfile);
          localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ user: fallbackUser, profile: fallbackProfile }));
        }
      }
    } catch (e) {
      console.warn('fetchProfile:', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Auth actions ────────────────────────────────────────
  const signUp = async ({ email, password, fullName }) => {
    if (!SUPABASE_ENABLED) return demoLogin(email);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    if (error) { setError(error.message); return { error }; }
    return { data };
  };

  const signIn = async ({ email, password }) => {
    if (!SUPABASE_ENABLED) return demoLogin(email);
    setError(null);
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      10000,
      'Login timeout'
    );
    if (error) { setError(error.message); return { error }; }
    if (data?.user) {
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ user: data.user, profile: null }));
    }
    return { data };
  };

  const signOut = async () => {
    if (!SUPABASE_ENABLED) {
      localStorage.removeItem('naya_auth');
      setUser(null); setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    localStorage.removeItem(AUTH_CACHE_KEY);
    setUser(null); setProfile(null);
  };

  const updateProfile = async (updates) => {
    if (!SUPABASE_ENABLED) {
      setProfile(p => ({ ...p, ...updates }));
      return { data: updates };
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (!error) setProfile(data);
    return { data, error };
  };

  // Demo mode (no Supabase) login helper
  const demoLogin = (email) => {
    const u = { id: 'demo', email };
    const p = { full_name: email.split('@')[0], email };
    localStorage.setItem('naya_auth', JSON.stringify({ user: u, profile: p, email }));
    setUser(u);
    setProfile(p);
    return { data: { user: u } };
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading, error,
      isAuthenticated: !!user,
      supabaseEnabled: SUPABASE_ENABLED,
      signUp, signIn, signOut, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
