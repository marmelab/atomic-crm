-- Eswatini-specific fields for Practice-CRM
-- Phase 2: Eswatini Data Model

-- ─── Companies ───────────────────────────────────────────────────────────────

alter table public.companies
    add column if not exists tin text,
    add column if not exists registration_number text,
    add column if not exists entity_type text,
    add column if not exists vat_registered boolean not null default false,
    add column if not exists vat_filing_frequency text,
    add column if not exists paye_registered boolean not null default false,
    add column if not exists sdl_registered boolean not null default false,
    add column if not exists provisional_tax_registered boolean not null default true,
    add column if not exists employees_count integer not null default 0,
    add column if not exists financial_year_end_month smallint not null default 6,
    add column if not exists trading_license_number text,
    add column if not exists trading_license_expiry date,
    add column if not exists tax_clearance_certificate_expiry date;

-- ─── Contacts ────────────────────────────────────────────────────────────────

alter table public.contacts
    add column if not exists tin text,
    add column if not exists national_id_number text,
    add column if not exists role_at_company text;

-- ─── Update companies_summary view ───────────────────────────────────────────
-- Adds the new Eswatini columns so list queries include them.

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
    c.tin,
    c.registration_number,
    c.entity_type,
    c.vat_registered,
    c.vat_filing_frequency,
    c.paye_registered,
    c.sdl_registered,
    c.provisional_tax_registered,
    c.employees_count,
    c.financial_year_end_month,
    c.trading_license_number,
    c.trading_license_expiry,
    c.tax_clearance_certificate_expiry,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts
from public.companies c
    left join public.deals d on c.id = d.company_id
    left join public.contacts co on c.id = co.company_id
group by c.id;

-- ─── Update contacts_summary view ────────────────────────────────────────────

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
    co.tin,
    co.national_id_number,
    co.role_at_company,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text as email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text as phone_fts,
    c.name as company_name,
    count(distinct t.id) filter (where t.done_date is null) as nb_tasks
from public.contacts co
    left join public.tasks t on co.id = t.contact_id
    left join public.companies c on co.company_id = c.id
group by co.id, c.name;
