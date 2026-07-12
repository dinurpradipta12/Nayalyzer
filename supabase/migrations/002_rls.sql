-- ============================================================
-- NAYALYZER — ROW LEVEL SECURITY POLICIES
-- Run AFTER 001_schema.sql
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS (SECURITY DEFINER — bypasses RLS to avoid
-- infinite recursion when checking workspace_members)
-- ────────────────────────────────────────────────────────────

-- Check if current user is an active member of a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
  );
$$;

-- Get current user's role in a workspace (returns null if not member)
CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wm.role::text
  FROM workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.status = 'active'
  LIMIT 1;
$$;

-- Check if current user has at least a given role level
CREATE OR REPLACE FUNCTION public.has_workspace_role(p_workspace_id uuid, p_min_role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  role_order int;
  min_order  int;
BEGIN
  user_role := public.get_workspace_role(p_workspace_id);
  IF user_role IS NULL THEN RETURN false; END IF;

  role_order := CASE user_role
    WHEN 'owner'   THEN 4
    WHEN 'admin'   THEN 3
    WHEN 'analyst' THEN 2
    WHEN 'viewer'  THEN 1
    ELSE 0
  END;
  min_order := CASE p_min_role
    WHEN 'owner'   THEN 4
    WHEN 'admin'   THEN 3
    WHEN 'analyst' THEN 2
    WHEN 'viewer'  THEN 1
    ELSE 0
  END;
  RETURN role_order >= min_order;
END;
$$;

-- Check if current user is owner of a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = p_workspace_id AND w.owner_id = auth.uid()
  );
$$;


-- ────────────────────────────────────────────────────────────
-- ENABLE RLS ON ALL TABLES
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_metrics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_hypotheses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports              ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- WORKSPACES
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "workspaces_select_member"  ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_auth"    ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_owner"   ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete_owner"   ON public.workspaces;

-- Any active member can read workspace details
CREATE POLICY "workspaces_select_member" ON public.workspaces
  FOR SELECT USING (public.is_workspace_member(id) OR owner_id = auth.uid());

-- Any authenticated user can create a workspace
CREATE POLICY "workspaces_insert_auth" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- Only owner can update
CREATE POLICY "workspaces_update_owner" ON public.workspaces
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Only owner can delete
CREATE POLICY "workspaces_delete_owner" ON public.workspaces
  FOR DELETE USING (owner_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- WORKSPACE MEMBERS
-- Uses SECURITY DEFINER helpers to avoid infinite recursion
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "wm_select_member"  ON public.workspace_members;
DROP POLICY IF EXISTS "wm_insert_admin"   ON public.workspace_members;
DROP POLICY IF EXISTS "wm_update_admin"   ON public.workspace_members;
DROP POLICY IF EXISTS "wm_delete_owner"   ON public.workspace_members;

-- Active members can see the member list; pending invites can see their own row
CREATE POLICY "wm_select_member" ON public.workspace_members
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    OR user_id = auth.uid()  -- see own pending invite
  );

-- Owner or admin can invite new members
CREATE POLICY "wm_insert_admin" ON public.workspace_members
  FOR INSERT WITH CHECK (
    public.has_workspace_role(workspace_id, 'admin')
  );

-- Owner can change roles; members can accept their own invitation (set status active)
CREATE POLICY "wm_update_admin" ON public.workspace_members
  FOR UPDATE USING (
    public.has_workspace_role(workspace_id, 'owner')
    OR (user_id = auth.uid() AND status = 'pending')  -- accept invite
  );

-- Only owner can remove members
CREATE POLICY "wm_delete_owner" ON public.workspace_members
  FOR DELETE USING (public.is_workspace_owner(workspace_id) OR user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- SOCIAL ACCOUNTS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_select_member"  ON public.social_accounts;
DROP POLICY IF EXISTS "sa_insert_admin"   ON public.social_accounts;
DROP POLICY IF EXISTS "sa_update_admin"   ON public.social_accounts;
DROP POLICY IF EXISTS "sa_delete_admin"   ON public.social_accounts;

CREATE POLICY "sa_select_member" ON public.social_accounts
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "sa_insert_admin" ON public.social_accounts
  FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'admin'));

CREATE POLICY "sa_update_admin" ON public.social_accounts
  FOR UPDATE USING (public.has_workspace_role(workspace_id, 'admin'));

CREATE POLICY "sa_delete_admin" ON public.social_accounts
  FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));


-- ────────────────────────────────────────────────────────────
-- ACCOUNT METRICS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "am_select_member"  ON public.account_metrics;
DROP POLICY IF EXISTS "am_insert_analyst" ON public.account_metrics;
DROP POLICY IF EXISTS "am_update_analyst" ON public.account_metrics;
DROP POLICY IF EXISTS "am_delete_admin"   ON public.account_metrics;

CREATE POLICY "am_select_member"  ON public.account_metrics FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "am_insert_analyst" ON public.account_metrics FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "am_update_analyst" ON public.account_metrics FOR UPDATE USING (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "am_delete_admin"   ON public.account_metrics FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));


-- ────────────────────────────────────────────────────────────
-- CONTENTS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "c_select_member"  ON public.contents;
DROP POLICY IF EXISTS "c_insert_analyst" ON public.contents;
DROP POLICY IF EXISTS "c_update_analyst" ON public.contents;
DROP POLICY IF EXISTS "c_delete_admin"   ON public.contents;

CREATE POLICY "c_select_member"  ON public.contents FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "c_insert_analyst" ON public.contents FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "c_update_analyst" ON public.contents FOR UPDATE USING (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "c_delete_admin"   ON public.contents FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));


-- ────────────────────────────────────────────────────────────
-- CONTENT METRICS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cm_select_member"  ON public.content_metrics;
DROP POLICY IF EXISTS "cm_insert_analyst" ON public.content_metrics;
DROP POLICY IF EXISTS "cm_update_analyst" ON public.content_metrics;
DROP POLICY IF EXISTS "cm_delete_admin"   ON public.content_metrics;

CREATE POLICY "cm_select_member"  ON public.content_metrics FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "cm_insert_analyst" ON public.content_metrics FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "cm_update_analyst" ON public.content_metrics FOR UPDATE USING (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "cm_delete_admin"   ON public.content_metrics FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));


-- ────────────────────────────────────────────────────────────
-- COMPETITORS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "comp_select_member"  ON public.competitors;
DROP POLICY IF EXISTS "comp_insert_analyst" ON public.competitors;
DROP POLICY IF EXISTS "comp_update_analyst" ON public.competitors;
DROP POLICY IF EXISTS "comp_delete_admin"   ON public.competitors;

CREATE POLICY "comp_select_member"  ON public.competitors FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "comp_insert_analyst" ON public.competitors FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "comp_update_analyst" ON public.competitors FOR UPDATE USING (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "comp_delete_admin"   ON public.competitors FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));


-- ────────────────────────────────────────────────────────────
-- COMPETITOR METRICS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "compmet_select_member"  ON public.competitor_metrics;
DROP POLICY IF EXISTS "compmet_insert_analyst" ON public.competitor_metrics;
DROP POLICY IF EXISTS "compmet_update_analyst" ON public.competitor_metrics;
DROP POLICY IF EXISTS "compmet_delete_admin"   ON public.competitor_metrics;

CREATE POLICY "compmet_select_member"  ON public.competitor_metrics FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "compmet_insert_analyst" ON public.competitor_metrics FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "compmet_update_analyst" ON public.competitor_metrics FOR UPDATE USING (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "compmet_delete_admin"   ON public.competitor_metrics FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));


-- ────────────────────────────────────────────────────────────
-- AI HYPOTHESES
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "hyp_select_member"  ON public.ai_hypotheses;
DROP POLICY IF EXISTS "hyp_insert_analyst" ON public.ai_hypotheses;
DROP POLICY IF EXISTS "hyp_update_analyst" ON public.ai_hypotheses;
DROP POLICY IF EXISTS "hyp_delete_admin"   ON public.ai_hypotheses;

CREATE POLICY "hyp_select_member"  ON public.ai_hypotheses FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "hyp_insert_analyst" ON public.ai_hypotheses FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "hyp_update_analyst" ON public.ai_hypotheses FOR UPDATE USING (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "hyp_delete_admin"   ON public.ai_hypotheses FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));


-- ────────────────────────────────────────────────────────────
-- REPORTS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rep_select_member"  ON public.reports;
DROP POLICY IF EXISTS "rep_insert_analyst" ON public.reports;
DROP POLICY IF EXISTS "rep_update_analyst" ON public.reports;
DROP POLICY IF EXISTS "rep_delete_admin"   ON public.reports;

CREATE POLICY "rep_select_member"  ON public.reports FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "rep_insert_analyst" ON public.reports FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "rep_update_analyst" ON public.reports FOR UPDATE USING (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "rep_delete_admin"   ON public.reports FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));


-- ────────────────────────────────────────────────────────────
-- IMPORTS
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "imp_select_member"  ON public.imports;
DROP POLICY IF EXISTS "imp_insert_analyst" ON public.imports;
DROP POLICY IF EXISTS "imp_delete_admin"   ON public.imports;

CREATE POLICY "imp_select_member"  ON public.imports FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "imp_insert_analyst" ON public.imports FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "imp_delete_admin"   ON public.imports FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));


-- ────────────────────────────────────────────────────────────
-- FUNCTION: create_workspace (atomic: workspace + owner member)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_workspace(
  p_name       text,
  p_brand_name text DEFAULT NULL,
  p_industry   text DEFAULT NULL,
  p_timezone   text DEFAULT 'Asia/Jakarta'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  -- Create workspace
  INSERT INTO workspaces (owner_id, name, brand_name, industry, timezone)
  VALUES (auth.uid(), p_name, p_brand_name, p_industry, p_timezone)
  RETURNING id INTO new_workspace_id;

  -- Add owner as active member
  INSERT INTO workspace_members (workspace_id, user_id, role, status, invited_by)
  VALUES (new_workspace_id, auth.uid(), 'owner', 'active', auth.uid());

  RETURN new_workspace_id;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- FUNCTION: accept_invitation (by token)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec workspace_members;
BEGIN
  SELECT * INTO rec
  FROM workspace_members
  WHERE invite_token = p_token AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation token');
  END IF;

  UPDATE workspace_members
  SET user_id = auth.uid(),
      status  = 'active',
      invite_token = NULL,
      updated_at = now()
  WHERE id = rec.id;

  RETURN jsonb_build_object('success', true, 'workspace_id', rec.workspace_id, 'role', rec.role);
END;
$$;


-- ────────────────────────────────────────────────────────────
-- FUNCTION: get_user_workspaces
-- Returns workspaces the current user is an active member of
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_workspaces()
RETURNS TABLE (
  id          uuid,
  name        text,
  brand_name  text,
  industry    text,
  timezone    text,
  logo_url    text,
  owner_id    uuid,
  role        text,
  created_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.id, w.name, w.brand_name, w.industry, w.timezone, w.logo_url,
    w.owner_id, wm.role::text, w.created_at
  FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id
    AND wm.user_id = auth.uid()
    AND wm.status = 'active'
  ORDER BY w.created_at ASC;
$$;
