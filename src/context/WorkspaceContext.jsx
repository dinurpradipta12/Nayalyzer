import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { withTimeout } from '../lib/async';
import { normalizePermissions, hasFeaturePermission } from '../lib/permissions';

const WorkspaceContext = createContext(null);
const WORKSPACE_CACHE_VERSION = 2;

const DEMO_WORKSPACE = {
  id: 'demo-ws',
  name: 'Naya Creative Studio',
  brand_name: 'Naya Creative',
  industry: 'Creative Agency',
  timezone: 'Asia/Jakarta',
  owner_id: 'demo',
  role: 'owner',
  permissions: normalizePermissions('owner'),
};

function workspaceCacheKey(userId) {
  return `naya_workspaces_${userId}`;
}

function normalizeMemberWorkspaces(rows) {
  return (rows || [])
    .map((row) => row.workspaces ? {
      ...row.workspaces,
      role: row.role,
      permissions: normalizePermissions(row.role, row.permissions),
    } : null)
    .filter(Boolean);
}

function normalizeWorkspaceList(list) {
  return (list || []).map((workspace) => ({
    ...workspace,
    permissions: normalizePermissions(workspace.role, workspace.permissions),
  }));
}

function generateInviteOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function WorkspaceProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces]       = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [members, setMembers]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  // ── Load workspaces for current user ───────────────────
  const loadWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
      return;
    }

    if (!SUPABASE_ENABLED) {
      setWorkspaces([DEMO_WORKSPACE]);
      const saved = localStorage.getItem('naya_active_workspace');
      setActiveWorkspace(saved ? JSON.parse(saved) : DEMO_WORKSPACE);
      setLoading(false);
      return;
    }

    setLoading(true);

    const cacheKey = workspaceCacheKey(user.id);
    let hasCachedWorkspace = false;
    const applyWorkspaces = (list) => {
      setError(null);
      const normalizedList = normalizeWorkspaceList(list);
      setWorkspaces(normalizedList);
      if (normalizedList.length > 0) {
        const saved = localStorage.getItem('naya_active_workspace_id');
        const found = normalizedList.find(w => w.id === saved) || normalizedList[0];
        setActiveWorkspace(found);
        localStorage.setItem(cacheKey, JSON.stringify({
          version: WORKSPACE_CACHE_VERSION,
          workspaces: normalizedList,
          activeWorkspace: found,
        }));
      } else {
        setActiveWorkspace(null);
        localStorage.removeItem(cacheKey);
      }
    };

    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached?.version === WORKSPACE_CACHE_VERSION && cached?.workspaces?.length) {
        hasCachedWorkspace = true;
        const normalizedCached = normalizeWorkspaceList(cached.workspaces);
        setWorkspaces(normalizedCached);
        setActiveWorkspace(normalizeWorkspaceList([cached.activeWorkspace || normalizedCached[0]])[0]);
        setLoading(false);
      } else if (cached) {
        localStorage.removeItem(cacheKey);
      }
    } catch {
      localStorage.removeItem(cacheKey);
    }

    try {
      const { data, error } = await withTimeout(
        supabase.rpc('get_user_workspaces'),
        12000,
        'Workspace request timeout'
      );

      if (!error && data?.length) {
        applyWorkspaces(data);
        return;
      }

      if (error) {
        console.warn('get_user_workspaces RPC error:', error.message);
      }

      const { data: memberRows, error: memberError } = await withTimeout(
        supabase
          .from('workspace_members')
          .select(`
            role,
            permissions,
            workspaces (
              id, name, brand_name, industry, timezone, logo_url, owner_id, created_at
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active'),
        8000,
        'Workspace membership request timeout'
      );

      if (!memberError && memberRows?.length) {
        applyWorkspaces(normalizeMemberWorkspaces(memberRows));
        return;
      }

      if (memberError) {
        console.warn('workspace_members fallback error:', memberError.message);
      }

      const { data: ownedRows, error: ownedError } = await withTimeout(
        supabase
          .from('workspaces')
          .select('id, name, brand_name, industry, timezone, logo_url, owner_id, created_at')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true }),
        8000,
        'Owned workspace request timeout'
      );

      if (!ownedError && ownedRows?.length) {
        applyWorkspaces(ownedRows.map(w => ({ ...w, role: 'owner', permissions: normalizePermissions('owner') })));
        return;
      }

      if (ownedError) {
        console.warn('owned workspaces fallback error:', ownedError.message);
      }

      applyWorkspaces([]);
    } catch (e) {
      console.warn('loadWorkspaces:', e.message);
      if (!hasCachedWorkspace) setError('DB_PENDING');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

  // ── Load members for active workspace ──────────────────
  useEffect(() => {
    setMembers([]);
    if (!activeWorkspace || !SUPABASE_ENABLED) return;

    let mounted = true;
    withTimeout(supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', activeWorkspace.id), 6000, 'Members request timeout')
      .then(({ data }) => {
        if (!mounted) return;
        setMembers((data || []).map(member => ({
          ...member,
          permissions: normalizePermissions(member.role, member.permissions),
        })));
      })
      .catch((e) => console.warn('load members:', e.message));

    return () => { mounted = false; };
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
    if (data) localStorage.setItem('naya_active_workspace_id', data);
    await loadWorkspaces();
    return { data };
  };

  const switchWorkspace = (ws) => {
    setActiveWorkspace(ws);
    setMembers([]);
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

  const inviteMember = async ({ email, role, permissions }) => {
    const normalizedPermissions = normalizePermissions(role, permissions);
    const inviteOtp = generateInviteOtp();
    if (!SUPABASE_ENABLED) {
      const data = {
        id: 'demo-member-' + Date.now(),
        email,
        role,
        permissions: normalizedPermissions,
        status: 'pending',
        invite_token: crypto.randomUUID(),
        invite_otp: inviteOtp,
      };
      setMembers(p => [...p, data]);
      return { data };
    }
    const { data, error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: activeWorkspace.id,
        email,
        role,
        permissions: normalizedPermissions,
        status: 'pending',
        invite_otp: inviteOtp,
        invited_by: user.id,
      })
      .select()
      .single();
    if (!error) setMembers(p => [...p, {
      ...data,
      permissions: normalizePermissions(data.role, data.permissions),
    }]);
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
    const permissions = normalizePermissions(role);
    if (!SUPABASE_ENABLED) {
      setMembers(p => p.map(m => m.id === memberId ? { ...m, role, permissions } : m));
      return {};
    }
    const { error } = await supabase
      .from('workspace_members')
      .update({ role, permissions })
      .eq('id', memberId);
    if (!error) setMembers(p => p.map(m => m.id === memberId ? { ...m, role, permissions } : m));
    return { error };
  };

  const updateMemberPermissions = async (memberId, permissions) => {
    const current = members.find(m => m.id === memberId);
    const normalizedPermissions = normalizePermissions(current?.role, permissions);
    if (!SUPABASE_ENABLED) {
      setMembers(p => p.map(m => m.id === memberId ? { ...m, permissions: normalizedPermissions } : m));
      return {};
    }
    const { error } = await supabase
      .from('workspace_members')
      .update({ permissions: normalizedPermissions })
      .eq('id', memberId);
    if (!error) setMembers(p => p.map(m => m.id === memberId ? { ...m, permissions: normalizedPermissions } : m));
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

  const hasFeature = (featureKey) => hasFeaturePermission(activeWorkspace, featureKey);

  const isPrimaryAdmin = activeWorkspace?.role === 'owner';

	  return (
	    <WorkspaceContext.Provider value={{
	      workspaces, activeWorkspace, members, loading, error,
        hasWorkspace: workspaces.length > 0,
        userRole: activeWorkspace?.role || null,
        hasRole,
        hasFeature,
        isPrimaryAdmin,
        createWorkspace, switchWorkspace, updateWorkspace,
        inviteMember, removeMember, updateMemberRole, updateMemberPermissions, acceptInvitation,
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
