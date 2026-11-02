-- Company lead fields: turn a company into a lead record with a collection
-- date, business email, WhatsApp number and a sales pitch.
--
-- Existing columns are reused for the other lead fields:
--   name -> Business name, website -> Website, phone_number -> Mobile,
--   sector -> Vertical, city -> Place.

alter table public.companies add column if not exists lead_date date default current_date;
alter table public.companies add column if not exists email text;
alter table public.companies add column if not exists whatsapp_number text;
alter table public.companies add column if not exists pitch_point text;

-- New columns are appended at the end so "create or replace" keeps working.
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
    count(distinct co.id) as nb_contacts,
    c.lead_date,
    c.email,
    c.whatsapp_number,
    c.pitch_point
from public.companies c
    left join public.deals d on c.id = d.company_id
    left join public.contacts co on c.id = co.company_id
group by c.id;

-- Verticals used by lead collection. Conflict-safe like the sector seed.
insert into public.company_sectors (value, label) values
    ('fmcg', 'FMCG'),
    ('apparel', 'Apparel'),
    ('toys', 'Toys')
on conflict do nothing;
