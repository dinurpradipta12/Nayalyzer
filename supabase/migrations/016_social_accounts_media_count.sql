ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS media_count integer DEFAULT 0;
