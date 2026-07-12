ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS ai_analysis text,
  ADD COLUMN IF NOT EXISTS top_content_type text;
