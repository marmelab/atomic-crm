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

grant all on table public.search_index to anon;
grant all on table public.search_index to authenticated;
grant all on table public.search_index to service_role;
