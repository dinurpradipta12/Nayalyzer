-- ============================================================
-- Hidden platform preferences
-- Lets each workspace hide unused social platforms from app views.
-- ============================================================

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS hidden_platforms text[] NOT NULL DEFAULT '{}'::text[];
