-- Create consolidated activity_log view for dashboard and activity feed

set check_function_bodies = off;

drop view if exists public.activity_log;

create view public.activity_log
with (security_invoker = on)
as
select
  ('company.' || c.id || '.created')::text as id,
  'COMPANY_CREATED'::text as type,
  c.id as company_id,
  c.sales_id,
  null::bigint as contact_id,
  null::bigint as deal_id,
  to_jsonb(c) as company,
  null::jsonb as contact,
  null::jsonb as "contactNote",
  null::jsonb as deal,
  null::jsonb as "dealNote",
  c.created_at as date
from public.companies c

union all

select
  ('contact.' || ct.id || '.created')::text as id,
  'CONTACT_CREATED'::text as type,
  ct.company_id as company_id,
  ct.sales_id,
  ct.id as contact_id,
  null::bigint as deal_id,
  null::jsonb as company,
  to_jsonb(ct) as contact,
  null::jsonb as "contactNote",
  null::jsonb as deal,
  null::jsonb as "dealNote",
  ct.first_seen as date
from public.contacts ct

union all

select
  ('contactNote.' || cn.id || '.created')::text as id,
  'CONTACT_NOTE_CREATED'::text as type,
  co.company_id as company_id,
  cn.sales_id,
  cn.contact_id as contact_id,
  null::bigint as deal_id,
  null::jsonb as company,
  null::jsonb as contact,
  to_jsonb(cn) as "contactNote",
  null::jsonb as deal,
  null::jsonb as "dealNote",
  cn.date as date
from public."contactNotes" cn
join public.contacts co on co.id = cn.contact_id

union all

select
  ('deal.' || d.id || '.created')::text as id,
  'DEAL_CREATED'::text as type,
  d.company_id as company_id,
  d.sales_id,
  null::bigint as contact_id,
  d.id as deal_id,
  null::jsonb as company,
  null::jsonb as contact,
  null::jsonb as "contactNote",
  to_jsonb(d) as deal,
  null::jsonb as "dealNote",
  d.created_at as date
from public.deals d

union all

select
  ('dealNote.' || dn.id || '.created')::text as id,
  'DEAL_NOTE_CREATED'::text as type,
  de.company_id as company_id,
  dn.sales_id,
  null::bigint as contact_id,
  dn.deal_id as deal_id,
  null::jsonb as company,
  null::jsonb as contact,
  null::jsonb as "contactNote",
  null::jsonb as deal,
  to_jsonb(dn) as "dealNote",
  dn.date as date
from public."dealNotes" dn
join public.deals de on de.id = dn.deal_id;


