-- Company sectors: store industries in the database instead of the browser
-- configuration store, so all authenticated users share the same industry list.
--
-- This migration is idempotent and safe to run against a database where the
-- table was already created manually (id/value/label/created_at): it only
-- creates missing pieces and never drops the table or deletes existing rows.

create table if not exists public.company_sectors (
    id uuid primary key default gen_random_uuid(),
    value text not null,
    label text not null,
    created_at timestamp with time zone not null default now()
);

-- Unique slug (stored in companies.sector).
create unique index if not exists company_sectors_value_key
    on public.company_sectors using btree (value);

-- Prevent duplicate industry names differing only in capitalization.
create unique index if not exists company_sectors_label_lower_idx
    on public.company_sectors using btree (lower(label));

alter table public.company_sectors enable row level security;

drop policy if exists "Enable read access for authenticated users" on public.company_sectors;
create policy "Enable read access for authenticated users" on public.company_sectors
    for select
    to authenticated
    using (true);

drop policy if exists "Enable insert for authenticated users only" on public.company_sectors;
create policy "Enable insert for authenticated users only" on public.company_sectors
    for insert
    to authenticated
    with check (true);

-- Seed the default industries. Conflict-safe: skips values (and
-- lower-cased labels) that already exist, without overwriting anything.
insert into public.company_sectors (value, label) values
    ('information-technology', 'Information Technology'),
    ('software-development', 'Software Development'),
    ('web-development', 'Web Development'),
    ('mobile-app-development', 'Mobile App Development'),
    ('it-services', 'IT Services'),
    ('saas', 'SaaS / Software as a Service'),
    ('cloud-computing', 'Cloud Computing'),
    ('cybersecurity', 'Cybersecurity'),
    ('artificial-intelligence', 'Artificial Intelligence'),
    ('data-analytics', 'Data Analytics'),
    ('technology-consulting', 'Technology Consulting'),
    ('software-consulting', 'Software Consulting'),
    ('devops', 'DevOps & Cloud Engineering'),
    ('digital-agency', 'Digital Agency'),
    ('digital-marketing', 'Digital Marketing'),
    ('ui-ux-design', 'UI/UX Design'),
    ('graphic-design', 'Graphic Design'),
    ('branding', 'Branding & Creative Services'),
    ('seo', 'SEO & Search Marketing'),
    ('content-creation', 'Content Creation'),
    ('advertising', 'Advertising'),
    ('web-design', 'Web Design'),
    ('e-learning', 'E-learning & EdTech'),
    ('business-consulting', 'Business Consulting'),
    ('professional-services', 'Professional Services'),
    ('staffing-recruitment', 'Staffing & Recruitment'),
    ('education', 'Education & Training'),
    ('financial-services', 'Financial Services'),
    ('legal-services', 'Legal Services'),
    ('accounting', 'Accounting & Tax Services'),
    ('e-commerce', 'E-commerce'),
    ('retail', 'Retail'),
    ('wholesale-distribution', 'Wholesale & Distribution'),
    ('manufacturing', 'Manufacturing'),
    ('consumer-goods', 'Consumer Goods'),
    ('communication-services', 'Communication Services'),
    ('consumer-discretionary', 'Consumer Discretionary'),
    ('consumer-staples', 'Consumer Staples'),
    ('energy', 'Energy'),
    ('health-care', 'Healthcare'),
    ('industrials', 'Industrials'),
    ('materials', 'Materials'),
    ('real-estate', 'Real Estate'),
    ('utilities', 'Utilities'),
    ('hospitality', 'Hospitality & Tourism'),
    ('transportation-logistics', 'Transportation & Logistics'),
    ('agriculture', 'Agriculture'),
    ('automotive', 'Automotive'),
    ('construction', 'Construction'),
    ('food-beverage', 'Food & Beverage'),
    ('media-entertainment', 'Media & Entertainment'),
    ('non-profit', 'Non-profit & NGOs'),
    ('other', 'Other')
on conflict do nothing;
