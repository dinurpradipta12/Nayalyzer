-- ============================================================
-- NAYALYZER — DATABASE SCHEMA
-- Run this in Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ────────────────────────────────────────────────────────────
-- 1. PROFILES
-- Auto-created on auth.users insert via trigger
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text,
  email         text,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Trigger: auto-create profile on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ────────────────────────────────────────────────────────────
-- 2. WORKSPACES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspaces (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  brand_name    text,
  industry      text,
  description   text,
  timezone      text NOT NULL DEFAULT 'Asia/Jakarta',
  logo_url      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- 3. WORKSPACE MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'analyst', 'viewer');
CREATE TYPE member_status  AS ENUM ('active', 'pending', 'suspended');

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text,           -- for pending invitations (user not yet registered)
  role          workspace_role NOT NULL DEFAULT 'viewer',
  status        member_status  NOT NULL DEFAULT 'pending',
  invited_by    uuid REFERENCES auth.users(id),
  invite_token  text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);


-- ────────────────────────────────────────────────────────────
-- 4. SOCIAL ACCOUNTS
-- ────────────────────────────────────────────────────────────
CREATE TYPE platform_type       AS ENUM ('Instagram', 'TikTok', 'Threads', 'YouTube', 'X');
CREATE TYPE connection_status   AS ENUM ('connected', 'disconnected', 'pending', 'error');

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform              platform_type NOT NULL,
  account_name          text NOT NULL,
  username              text NOT NULL,
  profile_url           text,
  followers_count       integer DEFAULT 0,
  following_count       integer DEFAULT 0,
  account_type          text DEFAULT 'creator',   -- creator | brand | business
  connection_status     connection_status NOT NULL DEFAULT 'disconnected',
  access_token_encrypted text,                    -- store encrypted via vault in production
  refresh_token_encrypted text,
  token_expires_at      timestamptz,
  external_id           text,                     -- platform's own user ID
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- 5. ACCOUNT METRICS
-- Daily snapshots per social account
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_metrics (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  social_account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  metric_date       date NOT NULL,
  followers         integer DEFAULT 0,
  follower_growth   integer DEFAULT 0,   -- delta from previous day
  following         integer DEFAULT 0,
  reach             integer DEFAULT 0,
  impressions       integer DEFAULT 0,
  profile_visits    integer DEFAULT 0,
  website_clicks    integer DEFAULT 0,
  engagement_count  integer DEFAULT 0,
  engagement_rate   numeric(5,2) DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (social_account_id, metric_date)
);


-- ────────────────────────────────────────────────────────────
-- 6. CONTENTS
-- ────────────────────────────────────────────────────────────
CREATE TYPE content_type AS ENUM (
  'Photo', 'Carousel', 'Reels', 'Short Video', 'Long Video',
  'Story', 'Thread Opini', 'Thread Tips', 'Poll', 'Live', 'Other'
);

CREATE TABLE IF NOT EXISTS public.contents (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  social_account_id     uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  platform              platform_type NOT NULL,
  external_content_id   text,
  content_url           text,
  thumbnail_url         text,
  title                 text,
  caption               text,
  content_type          content_type,
  content_pillar        text,   -- Edukasi | Promosi | Hiburan | Inspirasi | etc.
  campaign_name         text,
  hashtags              text[],
  published_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contents_workspace ON public.contents(workspace_id);
CREATE INDEX idx_contents_platform  ON public.contents(platform);
CREATE INDEX idx_contents_published ON public.contents(published_at DESC);


-- ────────────────────────────────────────────────────────────
-- 7. CONTENT METRICS
-- ────────────────────────────────────────────────────────────
CREATE TYPE performance_status AS ENUM (
  'High Performer', 'Stable', 'Needs Improvement', 'Underperform'
);

CREATE TABLE IF NOT EXISTS public.content_metrics (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_id        uuid NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  metric_date       date NOT NULL,
  views             integer DEFAULT 0,
  reach             integer DEFAULT 0,
  impressions       integer DEFAULT 0,
  likes             integer DEFAULT 0,
  comments          integer DEFAULT 0,
  shares            integer DEFAULT 0,
  saves             integer DEFAULT 0,
  replies           integer DEFAULT 0,
  reposts           integer DEFAULT 0,
  engagement_count  integer DEFAULT 0,
  engagement_rate   numeric(5,2) DEFAULT 0,
  watch_rate        numeric(5,2) DEFAULT 0,
  completion_rate   numeric(5,2) DEFAULT 0,
  performance_score numeric(5,2) DEFAULT 0,
  performance_status performance_status,
  ai_note           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, metric_date)
);


-- ────────────────────────────────────────────────────────────
-- 8. COMPETITORS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.competitors (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform      platform_type NOT NULL,
  name          text NOT NULL,
  username      text NOT NULL,
  profile_url   text,
  industry      text,
  strength      text,
  weakness      text,
  opportunity   text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- 9. COMPETITOR METRICS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.competitor_metrics (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id              uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  competitor_id             uuid NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  metric_date               date NOT NULL,
  followers                 integer DEFAULT 0,
  follower_growth           integer DEFAULT 0,
  posting_frequency         integer DEFAULT 0,   -- posts per week
  average_likes             integer DEFAULT 0,
  average_comments          integer DEFAULT 0,
  average_shares            integer DEFAULT 0,
  average_engagement_rate   numeric(5,2) DEFAULT 0,
  top_content_type          text,
  top_content_url           text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, metric_date)
);


-- ────────────────────────────────────────────────────────────
-- 10. AI HYPOTHESES
-- ────────────────────────────────────────────────────────────
CREATE TYPE hypothesis_status AS ENUM ('New', 'Testing', 'Validated', 'Rejected');

CREATE TABLE IF NOT EXISTS public.ai_hypotheses (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  summary               text,
  platforms             platform_type[],
  data_evidence         jsonb DEFAULT '[]',
  confidence_score      numeric(5,2) DEFAULT 0,
  suggested_experiment  text,
  expected_impact       text,
  action_plan           jsonb DEFAULT '[]',
  status                hypothesis_status NOT NULL DEFAULT 'New',
  created_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- 11. REPORTS
-- ────────────────────────────────────────────────────────────
CREATE TYPE report_type AS ENUM ('monthly', 'weekly', 'custom', 'competitor', 'content');

CREATE TABLE IF NOT EXISTS public.reports (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  report_type           report_type NOT NULL DEFAULT 'monthly',
  period_start          date,
  period_end            date,
  summary               text,
  ai_recommendations    jsonb DEFAULT '[]',
  report_data           jsonb DEFAULT '{}',
  created_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- 12. IMPORTS
-- Track CSV/API import history
-- ────────────────────────────────────────────────────────────
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS public.imports (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_type     text NOT NULL,  -- 'csv' | 'api_instagram' | 'api_tiktok' etc.
  file_name       text,
  import_status   import_status NOT NULL DEFAULT 'pending',
  imported_rows   integer DEFAULT 0,
  failed_rows     integer DEFAULT 0,
  error_message   text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER (shared)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','workspaces','workspace_members','social_accounts',
    'contents','competitors','ai_hypotheses','reports','imports'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
       CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t
    );
  END LOOP;
END;
$$;
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
-- ============================================================
-- NAYALYZER — SAMPLE SEED DATA
-- Run AFTER 001_schema.sql and 002_rls.sql
-- Replace UUIDs with actual values after creating test users
-- ============================================================

-- NOTE: This seed uses placeholder UUIDs.
-- In a real setup, create users via Supabase Auth first,
-- then copy their UUIDs below.

-- ────────────────────────────────────────────────────────────
-- SAMPLE WORKSPACE (run as authenticated user via RPC)
-- ────────────────────────────────────────────────────────────
-- SELECT public.create_workspace(
--   'Naya Creative Studio',
--   'Naya Creative',
--   'Creative Agency',
--   'Asia/Jakarta'
-- );

-- ────────────────────────────────────────────────────────────
-- The rest of seed is designed to be called programmatically
-- after create_workspace() returns a workspace_id.
-- Use the seed_workspace() function below.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ig_id   uuid;
  tt_id   uuid;
  th_id   uuid;

  c1_id uuid; c2_id uuid; c3_id uuid; c4_id uuid; c5_id uuid;
  c6_id uuid; c7_id uuid; c8_id uuid; c9_id uuid; c10_id uuid;
  c11_id uuid; c12_id uuid;

  comp1_id uuid; comp2_id uuid; comp3_id uuid; comp4_id uuid;
BEGIN

  -- ── Social Accounts ──────────────────────────────────────
  INSERT INTO social_accounts (workspace_id, platform, account_name, username, followers_count, following_count, connection_status)
  VALUES (p_workspace_id, 'Instagram', 'Naya Creative Studio', '@nayacreative.id', 48700, 812, 'connected')
  RETURNING id INTO ig_id;

  INSERT INTO social_accounts (workspace_id, platform, account_name, username, followers_count, following_count, connection_status)
  VALUES (p_workspace_id, 'TikTok', 'Naya Creative Studio', '@nayacreative', 92400, 240, 'connected')
  RETURNING id INTO tt_id;

  INSERT INTO social_accounts (workspace_id, platform, account_name, username, followers_count, following_count, connection_status)
  VALUES (p_workspace_id, 'Threads', 'Naya Creative Studio', '@nayacreative.id', 12800, 430, 'connected')
  RETURNING id INTO th_id;


  -- ── Account Metrics (6 months Instagram) ─────────────────
  INSERT INTO account_metrics (workspace_id, social_account_id, metric_date, followers, follower_growth, reach, impressions, engagement_count, engagement_rate) VALUES
  (p_workspace_id, ig_id, '2026-01-31', 44200, 800, 142000, 320000, 6200, 4.1),
  (p_workspace_id, ig_id, '2026-02-28', 45100, 900, 155000, 355000, 6800, 4.3),
  (p_workspace_id, ig_id, '2026-03-31', 45800, 700, 163000, 374000, 7200, 4.5),
  (p_workspace_id, ig_id, '2026-04-30', 46600, 800, 172000, 392000, 7800, 4.6),
  (p_workspace_id, ig_id, '2026-05-31', 47460, 860, 180000, 404000, 8400, 4.7),
  (p_workspace_id, ig_id, '2026-06-30', 48700, 1240, 187400, 412300, 9840, 4.8);

  -- TikTok metrics
  INSERT INTO account_metrics (workspace_id, social_account_id, metric_date, followers, follower_growth, reach, impressions, engagement_count, engagement_rate) VALUES
  (p_workspace_id, tt_id, '2026-01-31', 71000, 4200, 380000, 920000, 18200, 5.4),
  (p_workspace_id, tt_id, '2026-02-28', 74800, 3800, 410000, 1010000, 19800, 5.6),
  (p_workspace_id, tt_id, '2026-03-31', 79200, 4400, 452000, 1120000, 22400, 5.9),
  (p_workspace_id, tt_id, '2026-04-30', 83400, 4200, 485000, 1180000, 24200, 6.0),
  (p_workspace_id, tt_id, '2026-05-31', 87600, 4200, 504000, 1240000, 26400, 6.1),
  (p_workspace_id, tt_id, '2026-06-30', 92400, 4800, 524000, 1280000, 31200, 6.2);

  -- Threads metrics
  INSERT INTO account_metrics (workspace_id, social_account_id, metric_date, followers, follower_growth, reach, impressions, engagement_count, engagement_rate) VALUES
  (p_workspace_id, th_id, '2026-01-31', 8400, 380, 32000, 64000, 1240, 6.2),
  (p_workspace_id, th_id, '2026-02-28', 9200, 800, 36000, 72000, 1480, 6.5),
  (p_workspace_id, th_id, '2026-03-31', 10100, 900, 39000, 78000, 1820, 6.8),
  (p_workspace_id, th_id, '2026-04-30', 11000, 900, 43000, 86000, 2200, 6.9),
  (p_workspace_id, th_id, '2026-05-31', 12220, 1220, 46000, 92000, 2980, 7.0),
  (p_workspace_id, th_id, '2026-06-30', 12800, 580, 48200, 96400, 3840, 7.1);


  -- ── Contents ──────────────────────────────────────────────
  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, ig_id, 'Instagram', '5 Cara Buat Caption IG yang Bikin Follow', 'Carousel', 'Edukasi', '2026-06-20 19:30:00+07')
  RETURNING id INTO c1_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, tt_id, 'TikTok', 'Hook Problem-Solution: Cara Dapat 1000 Follower Pertama', 'Short Video', 'Edukasi', '2026-06-18 20:00:00+07')
  RETURNING id INTO c2_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, th_id, 'Threads', 'Opini: Kenapa Personal Branding Lebih Penting dari Follower', 'Thread Opini', 'Opini', '2026-06-17 12:30:00+07')
  RETURNING id INTO c3_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, ig_id, 'Instagram', 'Behind-the-scenes: Proses Desain Brand Identity', 'Reels', 'Behind-the-scenes', '2026-06-15 19:00:00+07')
  RETURNING id INTO c4_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, tt_id, 'TikTok', 'Trend Audio: Tips Desain Logo 2026', 'Short Video', 'Trending', '2026-06-14 20:30:00+07')
  RETURNING id INTO c5_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, th_id, 'Threads', 'Tips 3 Tools AI yang Wajib Dipakai Designer', 'Thread Tips', 'Tips', '2026-06-12 12:00:00+07')
  RETURNING id INTO c6_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, ig_id, 'Instagram', 'Promo: Paket Desain Logo Mulai 500K', 'Photo', 'Promosi', '2026-06-10 10:00:00+07')
  RETURNING id INTO c7_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, tt_id, 'TikTok', 'Review Tool: Canva vs Adobe Illustrator', 'Long Video', 'Edukasi', '2026-06-08 19:00:00+07')
  RETURNING id INTO c8_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, ig_id, 'Instagram', 'Q&A: Cara Mulai Freelance Design', 'Carousel', 'Edukasi', '2026-06-06 20:00:00+07')
  RETURNING id INTO c9_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, th_id, 'Threads', 'Polling: Mana yang Lebih Penting — Skill atau Portofolio?', 'Poll', 'Q&A', '2026-06-04 12:00:00+07')
  RETURNING id INTO c10_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, ig_id, 'Instagram', 'Infographic: Color Theory untuk Brand', 'Photo', 'Edukasi', '2026-06-02 19:30:00+07')
  RETURNING id INTO c11_id;

  INSERT INTO contents (workspace_id, social_account_id, platform, title, content_type, content_pillar, published_at)
  VALUES (p_workspace_id, tt_id, 'TikTok', 'Story Time: Gagal Dapat Klien Pertama', 'Short Video', 'Behind-the-scenes', '2026-05-30 20:00:00+07')
  RETURNING id INTO c12_id;


  -- ── Content Metrics ───────────────────────────────────────
  INSERT INTO content_metrics (workspace_id, content_id, metric_date, views, reach, likes, comments, shares, saves, engagement_count, engagement_rate, performance_score, performance_status, ai_note) VALUES
  (p_workspace_id, c1_id, '2026-06-20', 22100, 18400, 1240, 88, 32, 540, 1900, 8.4, 92, 'High Performer', 'Carousel edukasi ini performanya 3.2× di atas rata-rata.'),
  (p_workspace_id, c2_id, '2026-06-18', 112000, 84200, 7800, 420, 1240, 0, 9460, 8.4, 95, 'High Performer', 'Watch rate 72% — jauh di atas average 41%.'),
  (p_workspace_id, c3_id, '2026-06-17', 9200, 6800, 320, 186, 94, 0, 600, 11.2, 88, 'High Performer', 'Reply rate 2.0% — sangat tinggi untuk Threads.'),
  (p_workspace_id, c4_id, '2026-06-15', 18800, 14200, 820, 54, 28, 180, 1082, 5.7, 72, 'Stable', 'Performa stabil. Save rate cukup baik (1.3%).'),
  (p_workspace_id, c5_id, '2026-06-14', 88000, 62000, 4200, 180, 640, 0, 5020, 5.7, 78, 'Stable', 'Memanfaatkan trending audio dengan baik.'),
  (p_workspace_id, c6_id, '2026-06-12', 5800, 4200, 188, 72, 38, 0, 298, 6.8, 68, 'Stable', 'Engagement ok tapi reach terbatas.'),
  (p_workspace_id, c7_id, '2026-06-10', 7400, 6800, 180, 12, 4, 28, 224, 2.1, 38, 'Underperform', 'Konten promosi langsung selalu underperform.'),
  (p_workspace_id, c8_id, '2026-06-08', 44000, 28400, 1800, 142, 88, 0, 2030, 4.6, 55, 'Needs Improvement', 'Completion rate hanya 28% — terlalu panjang.'),
  (p_workspace_id, c9_id, '2026-06-06', 19400, 16200, 920, 64, 22, 380, 1386, 7.2, 84, 'High Performer', 'Q&A carousel terbukti efektif. Save rate 2.4% sangat baik.'),
  (p_workspace_id, c10_id, '2026-06-04', 7200, 5400, 240, 128, 46, 0, 414, 9.4, 82, 'High Performer', 'Poll menghasilkan comment rate tertinggi bulan ini.'),
  (p_workspace_id, c11_id, '2026-06-02', 11200, 9800, 440, 28, 14, 320, 802, 5.8, 66, 'Stable', 'Save rate bagus (3.3%) tapi likes rendah.'),
  (p_workspace_id, c12_id, '2026-05-30', 98000, 74000, 6200, 380, 820, 0, 7400, 7.5, 89, 'High Performer', 'Storytelling personal sangat resonan. Watch rate 65%.');


  -- ── Competitors ───────────────────────────────────────────
  INSERT INTO competitors (workspace_id, platform, name, username, strength, weakness, opportunity)
  VALUES (p_workspace_id, 'Instagram', 'Studio Kreatif Bali', '@studiokreatifbali',
    'Visual konsisten, branding kuat', 'Engagement rendah di konten edukasi', 'Belum memanfaatkan Reels & video pendek')
  RETURNING id INTO comp1_id;

  INSERT INTO competitors (workspace_id, platform, name, username, strength, weakness, opportunity)
  VALUES (p_workspace_id, 'TikTok', 'Desain Kita ID', '@desainkitaid',
    'Konsisten upload, trending sound bagus', 'Kurang diversifikasi platform', 'Audiens siap untuk konten premium/course')
  RETURNING id INTO comp2_id;

  INSERT INTO competitors (workspace_id, platform, name, username, strength, weakness, opportunity)
  VALUES (p_workspace_id, 'Instagram', 'Brand Builder Co', '@brandbuildco',
    'Niche spesifik branding bisnis UMKM', 'Posting tidak konsisten, reach menurun', 'Belum aktif di Threads & TikTok')
  RETURNING id INTO comp3_id;

  INSERT INTO competitors (workspace_id, platform, name, username, strength, weakness, opportunity)
  VALUES (p_workspace_id, 'Threads', 'Kreasi Visual Studio', '@kreasivisual',
    'Engagement tinggi, komunitas aktif', 'Belum ada di TikTok dan Instagram', 'Threads masih early mover — positioning kuat')
  RETURNING id INTO comp4_id;

  -- Competitor Metrics
  INSERT INTO competitor_metrics (workspace_id, competitor_id, metric_date, followers, posting_frequency, average_likes, average_comments, average_engagement_rate) VALUES
  (p_workspace_id, comp1_id, '2026-06-30', 68400, 5, 1200, 48, 4.1),
  (p_workspace_id, comp2_id, '2026-06-30', 142000, 7, 4800, 180, 5.5),
  (p_workspace_id, comp3_id, '2026-06-30', 38200, 3, 820, 32, 4.8),
  (p_workspace_id, comp4_id, '2026-06-30', 8400, 14, 180, 62, 6.2);


  -- ── AI Hypotheses ─────────────────────────────────────────
  INSERT INTO ai_hypotheses (workspace_id, title, summary, platforms, data_evidence, confidence_score, suggested_experiment, expected_impact, action_plan, status) VALUES
  (
    p_workspace_id,
    'Carousel edukasi menghasilkan engagement rate 3× lebih tinggi dari konten promosi',
    'Analisis 24 konten Instagram menunjukkan carousel edukasi rata-rata 8.1% ER vs 2.3% untuk konten promo langsung.',
    ARRAY['Instagram']::platform_type[],
    '["Rata-rata ER carousel edukasi: 8.1%", "Rata-rata ER konten promosi: 2.3%", "Save rate carousel 4.2× lebih tinggi", "Top 3 konten terbaik semuanya format carousel edukasi"]'::jsonb,
    94,
    'Buat 4 konten edukasi carousel tanpa promosi selama 2 minggu, bandingkan ER dengan 4 konten promo sebelumnya.',
    'Peningkatan ER rata-rata +2.4% dan saves +180%.',
    '["Ubah rasio konten menjadi 70% edukasi, 20% inspirasi, 10% promosi", "Jadwalkan carousel edukasi setiap Selasa & Kamis", "Tambahkan CTA Save untuk nanti di setiap slide terakhir"]'::jsonb,
    'Validated'
  ),
  (
    p_workspace_id,
    'Hook problem-solution di 3 detik pertama meningkatkan watch rate TikTok secara signifikan',
    'Video TikTok dengan pembuka "Kamu [problem]..." memiliki watch rate 68% vs 41% rata-rata.',
    ARRAY['TikTok']::platform_type[],
    '["Watch rate rata-rata: 41%", "Watch rate hook problem-solution: 68%", "Completion rate hook PS: 52% vs 29% rata-rata", "4 dari 5 top performer TikTok menggunakan hook ini"]'::jsonb,
    88,
    'Buat 6 video: 3 dengan hook problem-solution, 3 dengan hook biasa. Ukur watch rate, completion rate, dan follower gained.',
    'Watch rate +27%, completion rate +23%, potensi follower gained 2× per video.',
    '["Buat bank hook problem-solution minimal 20 variasi", "Review semua video lama, re-upload dengan hook baru", "Tambahkan hook checker di workflow produksi konten"]'::jsonb,
    'Testing'
  ),
  (
    p_workspace_id,
    'Thread opini pendek 1–3 kalimat menghasilkan reply rate 4× lebih tinggi',
    'Thread dengan opini tegas dalam 1–3 kalimat mendapat lebih banyak reply dibanding thread panjang.',
    ARRAY['Threads']::platform_type[],
    '["Reply rate thread panjang >5 kalimat: 1.2%", "Reply rate thread pendek opini: 4.8%", "Thread polling memiliki comment 128 vs rata-rata 34", "Polling: Mana lebih penting? — ER 9.4%"]'::jsonb,
    82,
    'Posting 1 thread opini pendek <3 kalimat setiap Rabu dan Sabtu selama 4 minggu.',
    'Reply rate +280%, potensi profile visit naik 40%.',
    '["Buat content calendar thread opini 1 bulan ke depan", "Pilih 4 topik kontroversial tapi relevant di industri desain", "Balas setiap comment dalam 1 jam pertama"]'::jsonb,
    'New'
  ),
  (
    p_workspace_id,
    'Posting di 19.00–21.00 memberikan potensi reach 22% lebih besar',
    'Data audience activity menunjukkan peak activity di pukul 19.00–21.00 WIB. Posting di luar window ini menghasilkan reach 18–22% lebih rendah.',
    ARRAY['Instagram', 'TikTok']::platform_type[],
    '["Peak audience hour: 19.00–21.00 (88–95% index activity)", "Posting jam 12.00: reach 2 jam pertama rata-rata 4.200", "Posting jam 19.00–21.00: reach 2 jam pertama 6.400", "Algoritma memprioritaskan konten dengan early engagement tinggi"]'::jsonb,
    91,
    'Jadwalkan 8 konten secara konsisten di pukul 19.30 selama 4 minggu.',
    'Reach per post naik +22%, early engagement naik +35%.',
    '["Gunakan fitur scheduled post di Creator Studio", "Buat konten batch setiap Minggu, jadwalkan untuk Selasa-Kamis", "Pantau reach 2 jam pertama sebagai KPI utama"]'::jsonb,
    'Validated'
  );


  -- ── Initial Report ────────────────────────────────────────
  INSERT INTO reports (workspace_id, title, report_type, period_start, period_end, summary, ai_recommendations, report_data) VALUES
  (
    p_workspace_id,
    'Laporan Bulanan — Juni 2026',
    'monthly',
    '2026-06-01',
    '2026-06-30',
    'Bulan Juni 2026 menunjukkan pertumbuhan signifikan di semua platform. TikTok tetap menjadi platform dengan growth tertinggi (+5.48%), sementara Threads memiliki engagement rate terbaik (7.1%). Total followers lintas platform mencapai 153.900 dengan pertumbuhan 4.49% dari bulan sebelumnya.',
    '["Tingkatkan frekuensi carousel edukasi Instagram menjadi 3× per minggu", "Konsisten gunakan hook problem-solution di semua video TikTok", "Buat 1 thread opini per hari di Threads", "Jadwalkan semua konten di 19.00–21.00 WIB", "Pertimbangkan 1 kolaborasi konten di bulan Juli"]'::jsonb,
    '{"totalFollowers": 153900, "followerGrowth": 6620, "totalReach": 759600, "avgER": 6.03, "aiScore": 78}'::jsonb
  );

END;
$$;

-- To seed: SELECT public.seed_workspace('<your-workspace-id>');
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
-- ============================================================
-- 005_ai_hypothesis_update.sql
-- Extend ai_hypotheses with full scoring + analysis fields
-- ============================================================

-- Add new fields to ai_hypotheses
ALTER TABLE ai_hypotheses
  ADD COLUMN IF NOT EXISTS hypothesis_type     text DEFAULT 'content',
  ADD COLUMN IF NOT EXISTS pattern_detected    text,
  ADD COLUMN IF NOT EXISTS strategic_meaning   text,
  ADD COLUMN IF NOT EXISTS experiment_duration integer DEFAULT 14,
  ADD COLUMN IF NOT EXISTS success_metrics     jsonb  DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS predicted_impact    text,
  ADD COLUMN IF NOT EXISTS risk_level          text   DEFAULT 'Low',
  ADD COLUMN IF NOT EXISTS impact_score        numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS urgency_score       numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty_score    numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_score      numeric(7,2) GENERATED ALWAYS AS (
    impact_score + urgency_score + confidence_score - difficulty_score
  ) STORED,
  ADD COLUMN IF NOT EXISTS content_recommendations jsonb DEFAULT '[]';

-- Add check constraint for hypothesis_type
ALTER TABLE ai_hypotheses DROP CONSTRAINT IF EXISTS chk_hypothesis_type;
ALTER TABLE ai_hypotheses ADD CONSTRAINT chk_hypothesis_type
  CHECK (hypothesis_type IN ('growth','content','engagement','competitor','experiment'));

-- Add check constraint for risk_level
ALTER TABLE ai_hypotheses DROP CONSTRAINT IF EXISTS chk_risk_level;
ALTER TABLE ai_hypotheses ADD CONSTRAINT chk_risk_level
  CHECK (risk_level IN ('Low','Medium','High'));

-- Index for fast filtering by type + status + priority
CREATE INDEX IF NOT EXISTS idx_ai_hypotheses_type     ON ai_hypotheses(workspace_id, hypothesis_type);
CREATE INDEX IF NOT EXISTS idx_ai_hypotheses_priority ON ai_hypotheses(workspace_id, priority_score DESC);

-- Update RLS (existing policies cover this table already via workspace membership)
-- No new policies needed.
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
