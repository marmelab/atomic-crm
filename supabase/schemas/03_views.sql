--
-- Views
-- This file declares all views in the public schema.
--

create or replace view public.activity_log with (security_invoker = on) as
select
    ('company.' || c.id || '.created') as id,
    'company.created' as type,
    c.created_at as date,
    c.id as company_id,
    c.sales_id,
    to_json(c.*) as company,
    null::json as contact,
    null::json as deal,
    null::json as contact_note,
    null::json as deal_note
from public.companies c
union all
select
    ('contact.' || co.id || '.created') as id,
    'contact.created' as type,
    co.first_seen as date,
    co.company_id,
    co.sales_id,
    null::json as company,
    to_json(co.*) as contact,
    null::json as deal,
    null::json as contact_note,
    null::json as deal_note
from public.contacts co
union all
select
    ('contactNote.' || cn.id || '.created') as id,
    'contactNote.created' as type,
    cn.date,
    co.company_id,
    cn.sales_id,
    null::json as company,
    null::json as contact,
    null::json as deal,
    to_json(cn.*) as contact_note,
    null::json as deal_note
from public.contact_notes cn
    left join public.contacts co on co.id = cn.contact_id
union all
select
    ('deal.' || d.id || '.created') as id,
    'deal.created' as type,
    d.created_at as date,
    d.company_id,
    d.sales_id,
    null::json as company,
    null::json as contact,
    to_json(d.*) as deal,
    null::json as contact_note,
    null::json as deal_note
from public.deals d
union all
select
    ('dealNote.' || dn.id || '.created') as id,
    'dealNote.created' as type,
    dn.date,
    d.company_id,
    dn.sales_id,
    null::json as company,
    null::json as contact,
    null::json as deal,
    null::json as contact_note,
    to_json(dn.*) as deal_note
from public.deal_notes dn
    left join public.deals d on d.id = dn.deal_id;

create or replace view public.companies_summary with (security_invoker = on) as
select
    c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts
from public.companies c
    left join public.deals d on c.id = d.company_id
    left join public.contacts co on c.id = co.company_id
group by c.id;

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
    -- Trailing position matches the migration chain exactly (Postgres's
    -- CREATE OR REPLACE VIEW forbids reordering an existing column — see
    -- 20260831110000_application_review_outcomes.sql's own comment on this
    -- same column) — kept here too so a fresh `db reset` produces the
    -- identical column order and `db diff` never sees a phantom difference.
    co.sales_eligibility,
    -- CRM-domain relationship filters (Contacts UX cleanup pass): derived
    -- from real Deal/Application/Enrollment/Waitlist rows, the same
    -- "computed column on this view" pattern nb_tasks above already
    -- established — never a new persisted concept, never mutated data.
    -- Distinct Offer ids across every one of this Contact's Opportunities,
    -- for an "Offer History" filter via the same array-containment
    -- operator (@cs) the existing `tags` filter already uses.
    coalesce(array_agg(distinct d.offer_id) filter (where d.offer_id is not null), '{}') as offer_ids,
    -- Has an Enrollment currently in progress (enrollments_status_check:
    -- 'onboarding'/'active' vs 'offboarding'/'completed').
    bool_or(e.status in ('onboarding', 'active')) as is_current_client,
    -- Has an Enrollment that has since ended — independent of
    -- is_current_client, so someone enrolled again after a past
    -- completed program still correctly shows as both.
    bool_or(e.status in ('offboarding', 'completed')) as is_past_client,
    -- Has ever submitted an Application (any review status) via any of
    -- their Opportunities.
    bool_or(app.id is not null) as has_applied,
    -- Currently on an active Waitlist entry (waiting/invited — the same
    -- ACTIVE_WAITLIST_STATUSES the rest of the app already treats as
    -- "active"; converted/removed entries don't count).
    bool_or(w.status in ('waiting', 'invited')) as is_on_waitlist,
    -- Has a non-archived Opportunity currently exited into nurture.
    bool_or(d.outcome = 'nurture' and d.archived_at is null) as has_nurture_deal
from public.contacts co
    left join public.tasks t on co.id = t.contact_id
    left join public.companies c on co.company_id = c.id
    left join public.deals d on d.contact_id = co.id
    left join public.enrollments e on e.opportunity_id = d.id
    left join public.applications app on app.opportunity_id = d.id
    left join public.waitlist_entries w on w.contact_id = co.id
group by co.id, c.name;

create or replace view public.init_state with (security_invoker = off) as
select count(sub.id) as is_initialized
from (
    select sales.id from public.sales limit 1
) sub;
