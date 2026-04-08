-- Switch the `attachments` storage bucket from public to private.
--
-- Background: the bucket has been declared `public = true` since
-- migrations/20240730075029_init_db.sql, which means every uploaded file is
-- reachable through `/storage/v1/object/public/attachments/<filename>` by
-- anyone who guesses the URL — and filenames were generated with
-- `Math.random()`, which has only ~52 bits of entropy.
--
-- After this migration:
-- * the bucket is private; reads require either an authenticated session
--   that satisfies the existing storage.objects RLS policies, or a signed
--   URL minted server-side.
-- * the frontend resolves attachments to short-lived signed URLs at read
--   time inside `dataProvider.ts` (see the `signAttachmentInPlace` helper
--   added in the same PR).
-- * historical rows whose `attachments[].path` is missing fall back to
--   extracting the path from the persisted public URL — handled in the
--   frontend, no destructive backfill needed.
--
-- The existing INSERT/SELECT/DELETE policies on `storage.objects` for the
-- `attachments` bucket already restrict to `authenticated`, so making the
-- bucket private only removes the public-URL escape hatch.

update storage.buckets
set public = false
where id = 'attachments';
