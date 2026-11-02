--
-- Storage
-- This file declares storage bucket policies.
--

-- Active CRM users only; a file can only be deleted by its uploader or a manager.
create policy "Attachments 1mt4rzk_0" on storage.objects for select to authenticated using (bucket_id = 'attachments' and public.crm_role() is not null);
create policy "Attachments 1mt4rzk_1" on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and public.crm_role() is not null);
create policy "Attachments 1mt4rzk_3" on storage.objects for delete to authenticated using (bucket_id = 'attachments' and (owner_id = auth.uid()::text or public.is_manager()));
