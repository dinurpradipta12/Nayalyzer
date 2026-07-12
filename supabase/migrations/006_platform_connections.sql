-- ============================================================
-- 006_platform_connections.sql
-- OAuth connection store + sync job tracking
-- ============================================================

-- ── ENUM types ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE connection_status_enum AS ENUM ('connected','disconnected','expired','error','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_type_enum AS ENUM ('full','incremental','media','insights','profile');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_status_enum AS ENUM ('queued','running','completed','failed','partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── platform_connections ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_connections (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  social_account_id      uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform               text NOT NULL CHECK (platform IN ('Instagram','TikTok','Threads')),

  -- OAuth identity
  provider_user_id       text,               -- platform's own user ID
  provider_username      text,               -- @handle at time of connect

  -- Encrypted tokens (stored as iv:ciphertext in hex, encrypted by Edge Function)
  access_token_enc       text,
  refresh_token_enc      text,
  token_expires_at       timestamptz,

  -- Granted permission scopes
  scopes                 text[]  DEFAULT '{}',

  -- Connection health
  connection_status      connection_status_enum NOT NULL DEFAULT 'pending',
  connection_mode        text NOT NULL DEFAULT 'oauth'
                           CHECK (connection_mode IN ('oauth','manual','sheets','hybrid')),
  api_limitations        jsonb DEFAULT '{}',    -- known limits for this account type
  last_error             text,

  -- Sync state
  last_synced_at         timestamptz,
  next_sync_at           timestamptz,
  sync_frequency_hours   integer DEFAULT 24,

  -- Meta
  created_by             uuid REFERENCES auth.users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_connection
  ON platform_connections(workspace_id, platform, provider_user_id)
  WHERE provider_user_id IS NOT NULL;

-- ── sync_jobs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_jobs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform_connection_id   uuid REFERENCES platform_connections(id) ON DELETE CASCADE,
  platform                 text,
  sync_type                sync_type_enum NOT NULL DEFAULT 'full',
  status                   sync_status_enum NOT NULL DEFAULT 'queued',

  -- Timeline
  started_at               timestamptz,
  completed_at             timestamptz,

  -- Result
  result_summary           jsonb DEFAULT '{}',
    -- { accounts_synced, media_synced, metrics_synced, errors:[], warnings:[] }
  error_message            text,
  records_inserted         integer DEFAULT 0,
  records_updated          integer DEFAULT 0,
  records_failed           integer DEFAULT 0,

  -- Trigger info
  triggered_by             text DEFAULT 'manual',   -- manual | scheduled | webhook
  created_by               uuid REFERENCES auth.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_ws   ON sync_jobs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_conn ON sync_jobs(platform_connection_id, created_at DESC);

-- ── Triggers ──────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER set_platform_connections_updated_at
  BEFORE UPDATE ON platform_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER set_sync_jobs_updated_at
  BEFORE UPDATE ON sync_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs             ENABLE ROW LEVEL SECURITY;

-- platform_connections: workspace members can read; admins/owners can write
CREATE POLICY "pc_select" ON platform_connections
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "pc_insert" ON platform_connections
  FOR INSERT WITH CHECK (has_workspace_role(workspace_id, 'admin'));

CREATE POLICY "pc_update" ON platform_connections
  FOR UPDATE USING (has_workspace_role(workspace_id, 'admin'));

CREATE POLICY "pc_delete" ON platform_connections
  FOR DELETE USING (is_workspace_owner(workspace_id));

-- sync_jobs: workspace members can read; system (service role) can write
CREATE POLICY "sj_select" ON sync_jobs
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "sj_insert" ON sync_jobs
  FOR INSERT WITH CHECK (has_workspace_role(workspace_id, 'analyst'));

-- ── Helper RPC: get recent sync jobs per connection ───────────
CREATE OR REPLACE FUNCTION get_sync_history(p_workspace_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid, platform text, sync_type sync_type_enum, status sync_status_enum,
  started_at timestamptz, completed_at timestamptz,
  records_inserted int, records_updated int, records_failed int,
  error_message text, result_summary jsonb, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT j.id, j.platform, j.sync_type, j.status,
         j.started_at, j.completed_at,
         j.records_inserted, j.records_updated, j.records_failed,
         j.error_message, j.result_summary, j.created_at
  FROM sync_jobs j
  WHERE j.workspace_id = p_workspace_id
  ORDER BY j.created_at DESC
  LIMIT p_limit;
$$;
