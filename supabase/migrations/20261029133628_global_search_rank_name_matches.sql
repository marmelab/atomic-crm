-- Weight the name A in the fts documents of companies, contacts and deals, so
-- global_search() can rank name matches first without slowing common words.
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

CREATE OR REPLACE FUNCTION public.search_name_query(query text)
 RETURNS tsquery
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
 SET search_path TO ''
AS $function$ select replace(public.search_query(query)::text, ':*', ':*A')::tsquery $function$
;

CREATE OR REPLACE FUNCTION public.global_search(query text, resources text[] DEFAULT NULL::text[], max_results integer DEFAULT 50)
 RETURNS TABLE(resource text, record_id bigint, title text, subtitle text, contact_id bigint, deal_id bigint, date timestamp with time zone, content text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
    tsq tsquery := public.search_query(query);
    branch_templates constant jsonb := jsonb_build_object(
        'companies', $q$
            select 'companies', c.id, c.name, c.sector, null::bigint, null::bigint, c.created_at,
                concat_ws(' · ', c.sector, c.description, c.website::text, c.phone_number, c.zipcode, c.city, c.state_abbr),
                %4$s
            from public.companies c
            where %3$s
            order by c.created_at desc
            limit %2$s $q$,
        'contacts', $q$
            select 'contacts', co.id, concat_ws(' ', co.first_name, co.last_name),
                (select cc.name from public.companies cc where cc.id = co.company_id), co.id, null::bigint, co.first_seen,
                concat_ws(' · ', co.title, co.background,
                    (select string_agg(e ->> 'email', ' ') from jsonb_array_elements(co.email_jsonb) e),
                    (select string_agg(p ->> 'number', ' ') from jsonb_array_elements(co.phone_jsonb) p)),
                %4$s
            from public.contacts co
            where %3$s
            order by co.first_seen desc nulls last
            limit %2$s $q$,
        'deals', $q$
            select 'deals', d.id, d.name,
                (select dc.name from public.companies dc where dc.id = d.company_id), null::bigint, d.id, d.created_at,
                concat_ws(' · ', variadic d.categories || d.description),
                %4$s
            from public.deals d
            where d.archived_at is null and %3$s
            order by d.created_at desc
            limit %2$s $q$,
        'tasks', $q$
            select 'tasks', t.id, left(t.text, 200),
                (select concat_ws(' ', tc.first_name, tc.last_name) from public.contacts tc where tc.id = t.contact_id),
                t.contact_id, null::bigint, t.created_at,
                concat_ws(' · ', t.text, t.type), false
            from public.tasks t
            where t.done_date is null and t.fts @@ %1$L::tsquery
            order by t.created_at desc
            limit %2$s $q$,
        'contact_notes', $q$
            select 'contact_notes', cn.id, left(cn.text, 200),
                (select concat_ws(' ', nc.first_name, nc.last_name) from public.contacts nc where nc.id = cn.contact_id),
                cn.contact_id, null::bigint, cn.date,
                concat_ws(' · ', cn.text, public.search_attachment_titles(cn.attachments)), false
            from public.contact_notes cn
            where cn.fts @@ %1$L::tsquery
            order by cn.date desc nulls last
            limit %2$s $q$,
        'deal_notes', $q$
            select 'deal_notes', dn.id, left(dn.text, 200), nd.name, null::bigint, dn.deal_id, dn.date,
                concat_ws(' · ', dn.text, public.search_attachment_titles(dn.attachments)), false
            from public.deal_notes dn
                join public.deals nd on nd.id = dn.deal_id
            where nd.archived_at is null and dn.fts @@ %1$L::tsquery
            order by dn.date desc nulls last
            limit %2$s $q$
    );
    name_tsq tsquery := public.search_name_query(query);
    row_limit constant integer := least(coalesce(max_results, 50), 200);
    columns constant text := 'resource, record_id, title, subtitle, contact_id, deal_id, date, content, is_title_match';
    branches text[];
begin
    if tsq is null or row_limit < 1 then
        return;
    end if;

    select array_agg(case
        -- %3$s is the search condition, %4$s whether it is a name match
        when position('%3$s' in template) > 0 then format(
            '(select * from ((%s) union all (%s)) b(%s) order by is_title_match desc, date desc nulls last limit %s)',
            format(template, tsq::text, row_limit, format('fts @@ %L::tsquery', name_tsq::text), 'true'),
            format(template, tsq::text, row_limit,
                format('fts @@ %L::tsquery and not fts @@ %L::tsquery', tsq::text, name_tsq::text), 'false'),
            columns,
            row_limit)
        else format('(%s)', format(template, tsq::text, row_limit))
    end)
    into branches
    from jsonb_each_text(branch_templates) as b(name, template)
    where resources is null or b.name = any(resources);

    if branches is null then
        return;
    end if;

    return query execute format(
        'select resource, record_id, title, subtitle, contact_id, deal_id, date, content
        from (%s) results(%s)
        order by is_title_match desc, date desc nulls last',
        array_to_string(branches, ' union all '),
        columns
    );
end
$function$
;
