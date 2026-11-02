-- Weight the name A in the fts documents of companies, contacts and deals, so
-- global_search() can rank them by relevance and list name matches first.
-- db diff turns a generated column change into an invalid "set default": the
-- fts columns are dropped and rebuilt instead, with their indexes and
-- statistics target.
alter table "public"."companies" drop column "fts";

alter table "public"."contacts" drop column "fts";

alter table "public"."deals" drop column "fts";

alter table public.companies add column fts tsvector generated always as (
    setweight(public.search_document(name), 'A')
    || public.search_document(sector, description, website::text, phone_number, zipcode, city, state_abbr)
) stored;

alter table public.contacts add column fts tsvector generated always as (
    setweight(public.search_document(first_name, last_name), 'A')
    || public.search_document(
        title,
        background,
        jsonb_path_query_array(email_jsonb, '$[*]."email"')::text,
        jsonb_path_query_array(phone_jsonb, '$[*]."number"')::text
    )
) stored;

alter table public.deals add column fts tsvector generated always as (
    setweight(public.search_document(name), 'A')
    || public.search_document(variadic array[description] || categories)
) stored;

create index companies_fts_idx on public.companies using gin (fts);

create index contacts_fts_idx on public.contacts using gin (fts);

create index deals_fts_idx on public.deals using gin (fts) where archived_at is null;

alter table public.contacts alter column fts set statistics 10000;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.global_search(query text, resources text[] DEFAULT NULL::text[], max_results integer DEFAULT 50)
 RETURNS TABLE(resource text, record_id bigint, title text, subtitle text, contact_id bigint, deal_id bigint, date timestamp with time zone, content text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
 SET plan_cache_mode TO 'force_custom_plan'
AS $function$
#variable_conflict use_column
declare
    tsq tsquery := public.search_query(query);
    row_limit constant integer := least(coalesce(max_results, 50), 200);
begin
    if tsq is null or row_limit < 1 then
        return;
    end if;

    return query
    select resource, record_id, title, subtitle, contact_id, deal_id, date, content
    from (
        (select 'companies' as resource, c.id as record_id, c.name as title, c.sector as subtitle,
            null::bigint as contact_id, null::bigint as deal_id, c.created_at as date,
            concat_ws(' · ', c.sector, c.description, c.website::text, c.phone_number, c.zipcode, c.city, c.state_abbr) as content,
            ts_rank(c.fts, tsq) as rank
        from public.companies c
        where (resources is null or 'companies' = any(resources)) and c.fts @@ tsq
        order by rank desc, c.created_at desc
        limit row_limit)
        union all
        (select 'contacts', co.id, concat_ws(' ', co.first_name, co.last_name),
            (select cc.name from public.companies cc where cc.id = co.company_id), co.id, null::bigint, co.first_seen,
            concat_ws(' · ', co.title, co.background,
                (select string_agg(e ->> 'email', ' ') from jsonb_array_elements(co.email_jsonb) e),
                (select string_agg(p ->> 'number', ' ') from jsonb_array_elements(co.phone_jsonb) p)),
            ts_rank(co.fts, tsq) as rank
        from public.contacts co
        where (resources is null or 'contacts' = any(resources)) and co.fts @@ tsq
        order by rank desc, co.first_seen desc nulls last
        limit row_limit)
        union all
        (select 'deals', d.id, d.name,
            (select dc.name from public.companies dc where dc.id = d.company_id), null::bigint, d.id, d.created_at,
            concat_ws(' · ', variadic d.categories || d.description),
            ts_rank(d.fts, tsq) as rank
        from public.deals d
        where (resources is null or 'deals' = any(resources)) and d.archived_at is null and d.fts @@ tsq
        order by rank desc, d.created_at desc
        limit row_limit)
        union all
        (select 'tasks', t.id, left(t.text, 200),
            (select concat_ws(' ', tc.first_name, tc.last_name) from public.contacts tc where tc.id = t.contact_id),
            t.contact_id, null::bigint, t.created_at,
            concat_ws(' · ', t.text, t.type),
            0
        from public.tasks t
        where (resources is null or 'tasks' = any(resources)) and t.done_date is null and t.fts @@ tsq
        order by t.created_at desc
        limit row_limit)
        union all
        (select 'contact_notes', cn.id, left(cn.text, 200),
            (select concat_ws(' ', nc.first_name, nc.last_name) from public.contacts nc where nc.id = cn.contact_id),
            cn.contact_id, null::bigint, cn.date,
            concat_ws(' · ', cn.text, public.search_attachment_titles(cn.attachments)),
            0
        from public.contact_notes cn
        where (resources is null or 'contact_notes' = any(resources)) and cn.fts @@ tsq
        order by cn.date desc nulls last
        limit row_limit)
        union all
        (select 'deal_notes', dn.id, left(dn.text, 200), nd.name, null::bigint, dn.deal_id, dn.date,
            concat_ws(' · ', dn.text, public.search_attachment_titles(dn.attachments)),
            0
        from public.deal_notes dn
            join public.deals nd on nd.id = dn.deal_id
        where (resources is null or 'deal_notes' = any(resources)) and nd.archived_at is null and dn.fts @@ tsq
        order by dn.date desc nulls last
        limit row_limit)
    ) results
    order by rank desc, date desc nulls last;
end
$function$
;
