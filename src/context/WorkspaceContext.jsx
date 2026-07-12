import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

const DEMO_WORKSPACE = {
  id: 'demo-ws',
  name: 'Naya Creative Studio',
  brand_name: 'Naya Creative',
  industry: 'Creative Agency',
  timezone: 'Asia/Jakarta',
  owner_id: 'demo',
  role: 'owner',
};

export function WorkspaceProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces]       = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [members, setMembers]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  // ── Load workspaces for current user ───────────────────
  const loadWorkspaces = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }

    if (!SUPABASE_ENABLED) {
      setWorkspaces([DEMO_WORKSPACE]);
      const saved = localStorage.getItem('naya_active_workspace');
      setActiveWorkspace(saved ? JSON.parse(saved) : DEMO_WORKSPACE);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_workspaces');
      if (error) {
        // RPC tidak ada (migrations belum dijalankan) — set DB_PENDING flag
        console.warn('get_user_workspaces RPC error:', error.message);
        setError('DB_PENDING');
        setWorkspaces([]);
      } else {
        setWorkspaces(data || []);
        if (data?.length > 0) {
          const saved = localStorage.getItem('naya_active_workspace_id');
          const found = data.find(w => w.id === saved) || data[0];
          setActiveWorkspace(found);
        }
      }
    } catch (e) {
      console.warn('loadWorkspaces:', e.message);
      setError('DB_PENDING');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

  // ── Load members for active workspace ──────────────────
  useEffect(() => {
    if (!activeWorkspace || !SUPABASE_ENABLED) return;
    supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .then(({ data }) => setMembers(data || []));
  }, [activeWorkspace]);

  // ── Workspace actions ───────────────────────────────────
  const createWorkspace = async ({ name, brandName, industry, timezone }) => {
    if (!SUPABASE_ENABLED) {
      const ws = { ...DEMO_WORKSPACE, id: 'demo-ws-' + Date.now(), name, brand_name: brandName, industry };
      setWorkspaces(p => [...p, ws]);
      switchWorkspace(ws);
      return { data: ws };
    }
    const { data, error } = await supabase.rpc('create_workspace', {
      p_name: name, p_brand_name: brandName, p_industry: industry, p_timezone: timezone || 'Asia/Jakarta',
    });
    if (error) return { error };
    await loadWorkspaces();
    return { data };
  };

  const switchWorkspace = (ws) => {
    setActiveWorkspace(ws);
    if (ws?.id) localStorage.setItem('naya_active_workspace_id', ws.id);
  };

  const updateWorkspace = async (updates) => {
    if (!SUPABASE_ENABLED) {
      setActiveWorkspace(w => ({ ...w, ...updates }));
      return { data: updates };
    }
    const { data, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', activeWorkspace.id)
      .select()
      .single();
    if (!error) setActiveWorkspace(data);
    return { data, error };
  };

  const inviteMember = async ({ email, role }) => {
    if (!SUPABASE_ENABLED) return { data: { email, role, status: 'pending' } };
    const { data, error } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: activeWorkspace.id, email, role, status: 'pending', invited_by: user.id })
      .select()
      .single();
    if (!error) setMembers(p => [...p, data]);
    return { data, error };
  };

  const removeMember = async (memberId) => {
    if (!SUPABASE_ENABLED) {
      setMembers(p => p.filter(m => m.id !== memberId));
      return {};
    }
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId);
    if (!error) setMembers(p => p.filter(m => m.id !== memberId));
    return { error };
  };

  const updateMemberRole = async (memberId, role) => {
    if (!SUPABASE_ENABLED) {
      setMembers(p => p.map(m => m.id === memberId ? { ...m, role } : m));
      return {};
    }
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', memberId);
    if (!error) setMembers(p => p.map(m => m.id === memberId ? { ...m, role } : m));
    return { error };
  };

  const acceptInvitation = async (token) => {
    if (!SUPABASE_ENABLED) return { data: { success: true } };
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
    if (!error) await loadWorkspaces();
    return { data, error };
  };

  const hasRole = (minRole) => {
    if (!activeWorkspace) return false;
    const order = { owner: 4, admin: 3, analyst: 2, viewer: 1 };
    return (order[activeWorkspace.role] || 0) >= (order[minRole] || 0);
  };

  return (
    <WorkspaceContext.Provider value={{
      workspaces, activeWorkspace, members, loading, error,
      hasWorkspace: workspaces.length > 0,
      userRole: activeWorkspace?.role || null,
      hasRole,
      createWorkspace, switchWorkspace, updateWorkspace,
      inviteMember, removeMember, updateMemberRole, acceptInvitation,
      reload: loadWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
};
