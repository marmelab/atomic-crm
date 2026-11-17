--
-- Storage
-- This file declares the storage bucket and its policies.
--

-- `supabase db diff` ignores the rows of storage.buckets: a change here needs
-- a hand-written migration (see 20261030140000_harden_attachments_bucket.sql).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'attachments',
    'attachments',
    true,
    52428800,
    array[
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/octet-stream'
    ]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Attachments 1mt4rzk_0" on storage.objects for select to authenticated using (bucket_id = 'attachments');
create policy "Attachments 1mt4rzk_1" on storage.objects for insert to authenticated with check (bucket_id = 'attachments');
create policy "Attachments 1mt4rzk_3" on storage.objects for delete to authenticated using (bucket_id = 'attachments');
