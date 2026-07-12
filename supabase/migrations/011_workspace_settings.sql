CREATE TABLE IF NOT EXISTS public.workspace_settings (
  workspace_id  uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ai_api_key    text,           -- user-provided Anthropic API key (stored as-is; handle with care)
  ai_provider   text DEFAULT 'anthropic', -- 'anthropic' | 'openai'
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_settings_owner" ON public.workspace_settings
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );
