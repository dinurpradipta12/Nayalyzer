ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS recent_posts jsonb DEFAULT '[]'::jsonb;
