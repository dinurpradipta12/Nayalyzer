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
