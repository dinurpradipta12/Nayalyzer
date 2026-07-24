ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS profile_picture_url text,
  ADD COLUMN IF NOT EXISTS biography text,
  ADD COLUMN IF NOT EXISTS website text;
