import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Bootstrap session ───────────────────────────────────
  useEffect(() => {
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    if (!SUPABASE_ENABLED) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data);
      } else {
        // Table may not exist yet (migrations pending) — use auth metadata as fallback
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setProfile({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
          });
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); return { error }; }
    return { data };
  };

  const signOut = async () => {
    if (!SUPABASE_ENABLED) {
      localStorage.removeItem('naya_auth');
      setUser(null); setProfile(null);
      return;
    }
    await supabase.auth.signOut();
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
