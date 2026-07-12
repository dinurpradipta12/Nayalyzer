-- ============================================================
-- 007_competitor_intelligence.sql
-- Extended competitor tracking: contents + insights
-- ============================================================

-- ── competitor_contents ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.competitor_contents (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  competitor_id            uuid NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  platform                 text NOT NULL,
  content_url              text,
  title                    text,
  caption                  text,
  content_type             text,
  content_pillar           text,
  hook_style               text,   -- e.g. Question | Problem-Solution | Stat | Story | Controversy
  cta_style                text,   -- e.g. Follow | Save | Comment | Link in Bio | None
  hashtags                 text[]  DEFAULT '{}',
  published_at             timestamptz,
  likes                    integer DEFAULT 0,
  comments                 integer DEFAULT 0,
  shares                   integer DEFAULT 0,
  saves                    integer DEFAULT 0,
  views                    integer DEFAULT 0,
  estimated_engagement_rate numeric(5,2) DEFAULT 0,
  is_top_performer         boolean DEFAULT false,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_workspace    ON public.competitor_contents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cc_competitor   ON public.competitor_contents(competitor_id);
CREATE INDEX IF NOT EXISTS idx_cc_platform     ON public.competitor_contents(platform);
CREATE INDEX IF NOT EXISTS idx_cc_published    ON public.competitor_contents(published_at DESC);

-- ── competitor_insights ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.competitor_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  competitor_id   uuid REFERENCES public.competitors(id) ON DELETE CASCADE,
  insight_type    text NOT NULL DEFAULT 'full',
  -- insight_type: full | gap_analysis | content_benchmark | ai_recommendation
  summary         text,
  gap_analysis    jsonb DEFAULT '{}',
  recommendation  jsonb DEFAULT '[]',
  score           jsonb DEFAULT '{}',
  -- score: { growth, engagement, consistency, content_quality, virality, differentiation }
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ci_workspace  ON public.competitor_insights(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ci_competitor ON public.competitor_insights(competitor_id);
CREATE INDEX IF NOT EXISTS idx_ci_created    ON public.competitor_insights(created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.competitor_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_insights ENABLE ROW LEVEL SECURITY;

-- competitor_contents
DROP POLICY IF EXISTS "cc_select" ON public.competitor_contents;
DROP POLICY IF EXISTS "cc_insert" ON public.competitor_contents;
DROP POLICY IF EXISTS "cc_update" ON public.competitor_contents;
DROP POLICY IF EXISTS "cc_delete" ON public.competitor_contents;
CREATE POLICY "cc_select" ON public.competitor_contents FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "cc_insert" ON public.competitor_contents FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "cc_update" ON public.competitor_contents FOR UPDATE USING (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "cc_delete" ON public.competitor_contents FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));

-- competitor_insights
DROP POLICY IF EXISTS "ci_select" ON public.competitor_insights;
DROP POLICY IF EXISTS "ci_insert" ON public.competitor_insights;
DROP POLICY IF EXISTS "ci_delete" ON public.competitor_insights;
CREATE POLICY "ci_select" ON public.competitor_insights FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "ci_insert" ON public.competitor_insights FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, 'analyst'));
CREATE POLICY "ci_delete" ON public.competitor_insights FOR DELETE USING (public.has_workspace_role(workspace_id, 'admin'));

-- ── Update seed_workspace to also add competitor_contents ─────
-- (run manually after seed_workspace if needed)
-- Competitor contents are added via the UI / CSV import.
