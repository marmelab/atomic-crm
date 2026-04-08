-- Phase 2 Wave 2.1B: Make attachments bucket private
-- Public URLs will no longer work; all access goes through signed URLs.
-- The dataProvider now uses createSignedUrl() for both upload and read.

UPDATE storage.buckets SET public = false WHERE id = 'attachments';

-- If bucket doesn't exist yet (fresh env), create it as private
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;
