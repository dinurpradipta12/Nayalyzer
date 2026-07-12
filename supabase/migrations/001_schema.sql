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
