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
    count(distinct t.id) filter (where t.done_date is null) as nb_tasks
from public.contacts co
    left join public.tasks t on co.id = t.contact_id
    left join public.companies c on co.company_id = c.id
group by co.id, c.name;

create or replace view public.init_state with (security_invoker = off) as
select count(sub.id) as is_initialized
from (
    select sales.id from public.sales limit 1
) sub;

create or replace view public.search_index with (security_invoker = on) as
select
    ('company.' || c.id) as id,
    'companies' as resource,
    c.id as record_id,
    c.name as title,
    c.sector as subtitle,
    concat_ws(' ', c.name, c.description, c.website, c.city) as content,
    c.id as company_id,
    null::bigint as contact_id,
    null::bigint as deal_id,
    c.created_at as date
from public.companies c
union all
select
    ('contact.' || co.id) as id,
    'contacts' as resource,
    co.id as record_id,
    concat_ws(' ', co.first_name, co.last_name) as title,
    cc.name as subtitle,
    concat_ws(
        ' ',
        co.first_name,
        co.last_name,
        co.title,
        cc.name,
        (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text,
        (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text
    ) as content,
    co.company_id,
    co.id as contact_id,
    null::bigint as deal_id,
    co.first_seen as date
from public.contacts co
    left join public.companies cc on cc.id = co.company_id
union all
select
    ('deal.' || d.id) as id,
    'deals' as resource,
    d.id as record_id,
    d.name as title,
    dc.name as subtitle,
    concat_ws(' ', d.name, d.description, dc.name) as content,
    d.company_id,
    null::bigint as contact_id,
    d.id as deal_id,
    d.created_at as date
from public.deals d
    left join public.companies dc on dc.id = d.company_id
where d.archived_at is null
union all
select
    ('task.' || t.id) as id,
    'tasks' as resource,
    t.id as record_id,
    t.text as title,
    concat_ws(' ', tco.first_name, tco.last_name) as subtitle,
    concat_ws(' ', t.text, t.type) as content,
    tco.company_id,
    t.contact_id,
    null::bigint as deal_id,
    t.due_date as date
from public.tasks t
    left join public.contacts tco on tco.id = t.contact_id
union all
select
    ('contactNote.' || cn.id) as id,
    'contact_notes' as resource,
    cn.id as record_id,
    cn.text as title,
    concat_ws(' ', nco.first_name, nco.last_name) as subtitle,
    concat_ws(
        ' ',
        cn.text,
        (select string_agg(a ->> 'title', ' ') from unnest(cn.attachments) as a)
    ) as content,
    nco.company_id,
    cn.contact_id,
    null::bigint as deal_id,
    cn.date
from public.contact_notes cn
    left join public.contacts nco on nco.id = cn.contact_id
union all
select
    ('dealNote.' || dn.id) as id,
    'deal_notes' as resource,
    dn.id as record_id,
    dn.text as title,
    nd.name as subtitle,
    concat_ws(
        ' ',
        dn.text,
        (select string_agg(a ->> 'title', ' ') from unnest(dn.attachments) as a)
    ) as content,
    nd.company_id,
    null::bigint as contact_id,
    dn.deal_id,
    dn.date
from public.deal_notes dn
    left join public.deals nd on nd.id = dn.deal_id;
