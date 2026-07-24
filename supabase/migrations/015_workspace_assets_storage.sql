-- Workspace icon storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-assets',
  'workspace-assets',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "workspace_assets_public_read" ON storage.objects;
CREATE POLICY "workspace_assets_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'workspace-assets');

DROP POLICY IF EXISTS "workspace_assets_member_insert" ON storage.objects;
CREATE POLICY "workspace_assets_member_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'workspace-assets'
  AND public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "workspace_assets_member_update" ON storage.objects;
CREATE POLICY "workspace_assets_member_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'workspace-assets'
  AND public.is_workspace_member((storage.foldername(name))[1]::uuid)
)
WITH CHECK (
  bucket_id = 'workspace-assets'
  AND public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "workspace_assets_member_delete" ON storage.objects;
CREATE POLICY "workspace_assets_member_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'workspace-assets'
  AND public.is_workspace_member((storage.foldername(name))[1]::uuid)
);
