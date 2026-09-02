-- Contacts UX cleanup pass: replaces the generic Atomic CRM filter set
-- (last_seen ranges, Cold/Warm/Hot/In Contract note temperature, generic
-- fixture tags, "Me") with filters backed by this CRM's own real domain
-- relationships. Every new column here is derived (never persisted, never
-- mutated data) from existing Deal/Application/Enrollment/Waitlist rows —
-- the exact same "computed column on contacts_summary" pattern nb_tasks
-- already established for "Has Pending Task".
--
-- Hand-authored (no local Postgres/Docker available in the session that
-- wrote this migration to run `supabase db diff` against) — mirrors the
-- declarative schema change in supabase/schemas/03_views.sql exactly.
-- Verify with `npx supabase db diff --local` before trusting this file
-- blindly in an environment where that's possible.

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
    -- Same trailing-position requirement as
    -- 20260831110000_application_review_outcomes.sql — this migration's
    -- own prior contacts_summary already has sales_eligibility as its last
    -- column (per that fix), so it must stay last here too, before these
    -- genuinely new columns.
    co.sales_eligibility,
    coalesce(array_agg(distinct d.offer_id) filter (where d.offer_id is not null), '{}') as offer_ids,
    bool_or(e.status in ('onboarding', 'active')) as is_current_client,
    bool_or(e.status in ('offboarding', 'completed')) as is_past_client,
    bool_or(app.id is not null) as has_applied,
    bool_or(w.status in ('waiting', 'invited')) as is_on_waitlist,
    bool_or(d.outcome = 'nurture' and d.archived_at is null) as has_nurture_deal
from public.contacts co
    left join public.tasks t on co.id = t.contact_id
    left join public.companies c on co.company_id = c.id
    left join public.deals d on d.contact_id = co.id
    left join public.enrollments e on e.opportunity_id = d.id
    left join public.applications app on app.opportunity_id = d.id
    left join public.waitlist_entries w on w.contact_id = co.id
group by co.id, c.name;
