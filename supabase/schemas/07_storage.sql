--
-- Storage
-- This file declares storage bucket policies.
-- Phase 2: Hardened with auth.uid() IS NOT NULL check.
--

create policy "authenticated_select_attachments" on storage.objects for select to authenticated using (bucket_id = 'attachments' and auth.uid() is not null);
create policy "authenticated_insert_attachments" on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and auth.uid() is not null);
create policy "authenticated_delete_attachments" on storage.objects for delete to authenticated using (bucket_id = 'attachments' and owner_id = auth.uid());
