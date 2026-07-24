-- ============================================================
-- Workspace invite OTP flow
-- Supports public invite link + OTP, then password creation.
-- ============================================================

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS invite_otp text;

CREATE OR REPLACE FUNCTION public.verify_invitation_otp(p_token text, p_otp text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  SELECT
    wm.id,
    wm.workspace_id,
    wm.email,
    wm.role,
    wm.permissions,
    w.name AS workspace_name
  INTO rec
  FROM public.workspace_members wm
  JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.invite_token = p_token
    AND wm.invite_otp = p_otp
    AND wm.status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'OTP tidak cocok atau undangan sudah tidak aktif');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', rec.workspace_id,
    'workspace_name', rec.workspace_name,
    'email', rec.email,
    'role', rec.role,
    'permissions', rec.permissions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_invitation_with_otp(p_token text, p_otp text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.workspace_members;
  current_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Akun belum aktif');
  END IF;

  SELECT * INTO rec
  FROM public.workspace_members
  WHERE invite_token = p_token
    AND invite_otp = p_otp
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'OTP tidak cocok atau undangan sudah tidak aktif');
  END IF;

  current_email := auth.jwt() ->> 'email';
  IF lower(COALESCE(current_email, '')) <> lower(COALESCE(rec.email, '')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email akun tidak sama dengan email undangan');
  END IF;

  UPDATE public.workspace_members
  SET user_id = auth.uid(),
      status = 'active',
      invite_token = NULL,
      invite_otp = NULL,
      updated_at = now()
  WHERE id = rec.id;

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', rec.workspace_id,
    'role', rec.role,
    'permissions', rec.permissions
  );
END;
$$;
