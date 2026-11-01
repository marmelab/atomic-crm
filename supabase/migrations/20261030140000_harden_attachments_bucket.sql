-- The attachments bucket is public, so the storage serves every file with the
-- content type it was uploaded with. Restrict it to types a browser cannot run
-- (no SVG, HTML, XML or JavaScript): the app uploads any other file as
-- application/octet-stream. Keep this list in sync with ALLOWED_MIME_TYPES in
-- src/components/atomic-crm/providers/commons/attachments.ts.
update storage.buckets
set
    allowed_mime_types = array[
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/octet-stream'
    ],
    file_size_limit = 52428800
where id = 'attachments';
