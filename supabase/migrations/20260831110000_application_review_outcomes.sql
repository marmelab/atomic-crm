-- Native Applications slice: application review needs to record one of
-- four distinct outcomes (Approved / Needs Higher Care / Not Fit / Do Not
-- Engage), and Do Not Engage needs a durable, Contact-level future-sales
-- gate independent of any single Opportunity.
--
-- Hand-authored (no local Postgres available in the session that wrote
-- this migration to run `supabase db diff` against) — mirrors the
-- declarative schema changes in supabase/schemas/01_tables.sql /
-- 03_views.sql exactly. Verify with `npx supabase db diff --local` before
-- trusting this file blindly in an environment where that's possible.

-- 1. Contact-level Sales Eligibility gate, defaulting every existing row to
--    'normal' (no contact has been marked Do Not Engage before this).
ALTER TABLE "public"."contacts"
    ADD COLUMN "sales_eligibility" text NOT NULL DEFAULT 'normal';

ALTER TABLE "public"."contacts"
    ADD CONSTRAINT "contacts_sales_eligibility_check" CHECK (sales_eligibility IN ('normal', 'do_not_engage'));

-- 2. Application review outcomes: retire the generic 'rejected' value in
--    favor of the three specific reasons the product model requires
--    (§1: "these outcomes must be distinct"). Backfill first so the
--    stricter constraint never rejects an existing row.
UPDATE "public"."applications"
SET "status" = 'not_fit'
WHERE "status" = 'rejected';

ALTER TABLE "public"."applications"
    DROP CONSTRAINT "applications_status_check";

ALTER TABLE "public"."applications"
    ADD CONSTRAINT "applications_status_check" CHECK (status IN ('pending', 'approved', 'needs_higher_care', 'not_fit', 'do_not_engage'));

-- 3. contacts_summary needs to expose the new column (the app reads
--    Contacts through this view, not the base table).
create or replace view public.contacts_summary with (security_invoker = on) as
select
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.email_jsonb,
    co.phone_jsonb,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text as email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text as phone_fts,
    c.name as company_name,
    count(distinct t.id) filter (where t.done_date is null) as nb_tasks,
    -- Postgres's CREATE OR REPLACE VIEW forbids renaming/reordering an
    -- existing column position (only appending new trailing ones is
    -- allowed) — this new column must go last, not in its "logical" spot
    -- next to `status`, or applying this migration incrementally against
    -- the prior contacts_summary (20260309112831_fix_security_warnings.sql)
    -- fails with "cannot change name of view column ... " (found running
    -- this migration for real for the first time, Live Acuity Connection
    -- slice's migration smoke test). supabase/schemas/03_views.sql keeps
    -- the same trailing position so a fresh `db reset` matches this exactly
    -- and `db diff` stays clean.
    co.sales_eligibility
from public.contacts co
    left join public.tasks t on co.id = t.contact_id
    left join public.companies c on co.company_id = c.id
group by co.id, c.name;
