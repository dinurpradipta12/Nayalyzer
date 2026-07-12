-- ============================================================
-- NAYALYZER — IMPORT & DATA SOURCES TABLES
-- Run AFTER 002_rls.sql
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- DATA SOURCES
-- Stores connected sources (Google Sheets, future API configs)
-- ────────────────────────────────────────────────────────────
CREATE TYPE source_type      AS ENUM ('csv', 'google_sheets', 'api_instagram', 'api_tiktok', 'api_threads');
CREATE TYPE source_status    AS ENUM ('active', 'paused', 'error', 'pending');
CREATE TYPE sync_frequency   AS ENUM ('manual', 'hourly', 'daily', 'weekly');
CREATE TYPE import_type_enum AS ENUM ('account_metrics', 'content_performance', 'competitor_metrics');

CREATE TABLE IF NOT EXISTS public.data_sources (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_name       text NOT NULL,
  source_type       source_type NOT NULL DEFAULT 'csv',
  import_type       import_type_enum NOT NULL,
  platform          platform_type,
  -- Google Sheets config
  sheet_url         text,
  sheet_name        text,
  sheet_gid         text,              -- tab/sheet gid from URL
  -- Mapping config: { csv_col: target_field, ... }
  mapping_config    jsonb DEFAULT '{}',
  -- Sync config
  sync_frequency    sync_frequency NOT NULL DEFAULT 'manual',
  last_synced_at    timestamptz,
  next_sync_at      timestamptz,
  status            source_status NOT NULL DEFAULT 'active',
  -- Stats
  total_synced_rows integer DEFAULT 0,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_sources_workspace ON public.data_sources(workspace_id);


-- ────────────────────────────────────────────────────────────
-- IMPORT LOGS
-- One record per import attempt
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  data_source_id  uuid REFERENCES public.data_sources(id) ON DELETE SET NULL,
  import_type     import_type_enum NOT NULL,
  source_label    text,               -- human-readable label (file name / sheet name)
  total_rows      integer DEFAULT 0,
  success_rows    integer DEFAULT 0,
  updated_rows    integer DEFAULT 0,  -- upserted existing rows
  failed_rows     integer DEFAULT 0,
  skipped_rows    integer DEFAULT 0,
  error_details   jsonb DEFAULT '[]', -- array of {row, field, message}
  duration_ms     integer,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_logs_workspace ON public.import_logs(workspace_id);
CREATE INDEX idx_import_logs_created   ON public.import_logs(created_at DESC);


-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs  ENABLE ROW LEVEL SECURITY;

-- data_sources
DROP POLICY IF EXISTS "ds_select_member"  ON public.data_sources;
DROP POLICY IF EXISTS "ds_insert_analyst" ON public.data_sources;
DROP POLICY IF EXISTS "ds_update_analyst" ON public.data_sources;
DROP POLICY IF EXISTS "ds_delete_admin"   ON public.data_sources;

CREATE POLICY "ds_select_member"  ON public.data_sources FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "ds_insert_analyst" ON public.data_sources FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "ds_update_analyst" ON public.data_sources FOR UPDATE USING (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "ds_delete_admin"   ON public.data_sources FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));

-- import_logs
DROP POLICY IF EXISTS "il_select_member"  ON public.import_logs;
DROP POLICY IF EXISTS "il_insert_analyst" ON public.import_logs;
DROP POLICY IF EXISTS "il_delete_admin"   ON public.import_logs;

CREATE POLICY "il_select_member"  ON public.import_logs FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "il_insert_analyst" ON public.import_logs FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "il_delete_admin"   ON public.import_logs FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));

-- Trigger: updated_at for data_sources
DROP TRIGGER IF EXISTS set_updated_at ON public.data_sources;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.data_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
