-- Add real data columns to competitors table
ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS profile_picture_url  text,
  ADD COLUMN IF NOT EXISTS biography            text,
  ADD COLUMN IF NOT EXISTS followers_count      integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_count          integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_rate      numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posting_freq_weekly  numeric(4,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS website              text,
  ADD COLUMN IF NOT EXISTS last_fetched_at      timestamptz;
