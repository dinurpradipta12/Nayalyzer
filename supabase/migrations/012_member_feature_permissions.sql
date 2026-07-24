-- ============================================================
-- Member feature permissions
-- Adds per-member feature access while owner keeps full access.
-- ============================================================

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.default_member_permissions(p_role text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN jsonb_build_object(
      'dashboard', true,
      'analytics', true,
      'content', true,
      'competitors', true,
      'competitor_intelligence', true,
      'analyser', true,
      'hypothesis', true,
      'reports', true,
      'data_sources', true,
      'team', true,
      'settings', true
    )
    WHEN 'admin' THEN jsonb_build_object(
      'dashboard', true,
      'analytics', true,
      'content', true,
      'competitors', true,
      'competitor_intelligence', true,
      'analyser', true,
      'hypothesis', true,
      'reports', true,
      'data_sources', true,
      'team', true,
      'settings', false
    )
    WHEN 'analyst' THEN jsonb_build_object(
      'dashboard', true,
      'analytics', true,
      'content', true,
      'competitors', true,
      'competitor_intelligence', true,
      'analyser', true,
      'hypothesis', true,
      'reports', true,
      'data_sources', false,
      'team', false,
      'settings', false
    )
    ELSE jsonb_build_object(
      'dashboard', true,
      'analytics', true,
      'content', true,
      'competitors', false,
      'competitor_intelligence', false,
      'analyser', false,
      'hypothesis', false,
      'reports', true,
      'data_sources', false,
      'team', false,
      'settings', false
    )
  END;
$$;

UPDATE public.workspace_members
SET permissions = public.default_member_permissions(role::text)
WHERE permissions = '{}'::jsonb OR permissions IS NULL;

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
  permissions jsonb,
  created_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.id, w.name, w.brand_name, w.industry, w.timezone, w.logo_url,
    w.owner_id,
    wm.role::text,
    COALESCE(NULLIF(wm.permissions, '{}'::jsonb), public.default_member_permissions(wm.role::text)) AS permissions,
    w.created_at
  FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id
    AND wm.user_id = auth.uid()
    AND wm.status = 'active'
  ORDER BY w.created_at ASC;
$$;
