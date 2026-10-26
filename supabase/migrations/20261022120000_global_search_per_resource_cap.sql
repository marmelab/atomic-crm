-- Cap global_search results per resource instead of overall, so newer notes
-- that mention a name no longer crowd the matching contact out of the results.

CREATE OR REPLACE FUNCTION "public"."global_search"("query" "text", "resources" "text"[] DEFAULT NULL::"text"[], "max_results" integer DEFAULT 50) RETURNS TABLE("resource" "text", "record_id" bigint, "title" "text", "subtitle" "text", "contact_id" bigint, "deal_id" bigint, "date" timestamp with time zone, "content" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $_$
declare
    tsq tsquery := public.search_query(query);
    branch_templates constant jsonb := jsonb_build_object(
        'companies', $q$
            select 'companies', c.id, c.name, c.sector, null::bigint, null::bigint, c.created_at,
                concat_ws(' · ', c.sector, c.description, c.website::text, c.phone_number, c.zipcode, c.city, c.state_abbr)
            from public.companies c
            where c.fts @@ %1$L::tsquery
            order by c.created_at desc
            limit %2$s $q$,
        'contacts', $q$
            select 'contacts', co.id, concat_ws(' ', co.first_name, co.last_name),
                (select cc.name from public.companies cc where cc.id = co.company_id), co.id, null::bigint, co.first_seen,
                concat_ws(' · ', co.title, co.background,
                    (select string_agg(e ->> 'email', ' ') from jsonb_array_elements(co.email_jsonb) e),
                    (select string_agg(p ->> 'number', ' ') from jsonb_array_elements(co.phone_jsonb) p))
            from public.contacts co
            where co.fts @@ %1$L::tsquery
            order by co.first_seen desc nulls last
            limit %2$s $q$,
        'deals', $q$
            select 'deals', d.id, d.name,
                (select dc.name from public.companies dc where dc.id = d.company_id), null::bigint, d.id, d.created_at,
                concat_ws(' · ', d.category, d.description)
            from public.deals d
            where d.archived_at is null and d.fts @@ %1$L::tsquery
            order by d.created_at desc
            limit %2$s $q$,
        'tasks', $q$
            select 'tasks', t.id, left(t.text, 200),
                (select concat_ws(' ', tc.first_name, tc.last_name) from public.contacts tc where tc.id = t.contact_id),
                t.contact_id, null::bigint, t.created_at,
                concat_ws(' · ', t.text, t.type)
            from public.tasks t
            where t.done_date is null and t.fts @@ %1$L::tsquery
            order by t.created_at desc
            limit %2$s $q$,
        'contact_notes', $q$
            select 'contact_notes', cn.id, left(cn.text, 200),
                (select concat_ws(' ', nc.first_name, nc.last_name) from public.contacts nc where nc.id = cn.contact_id),
                cn.contact_id, null::bigint, cn.date,
                concat_ws(' · ', cn.text, public.search_attachment_titles(cn.attachments))
            from public.contact_notes cn
            where cn.fts @@ %1$L::tsquery
            order by cn.date desc nulls last
            limit %2$s $q$,
        'deal_notes', $q$
            select 'deal_notes', dn.id, left(dn.text, 200), nd.name, null::bigint, dn.deal_id, dn.date,
                concat_ws(' · ', dn.text, public.search_attachment_titles(dn.attachments))
            from public.deal_notes dn
                join public.deals nd on nd.id = dn.deal_id
            where nd.archived_at is null and dn.fts @@ %1$L::tsquery
            order by dn.date desc nulls last
            limit %2$s $q$
    );
    row_limit constant integer := least(coalesce(max_results, 50), 200);
    branches text[];
begin
    if tsq is null or row_limit < 1 then
        return;
    end if;

    select array_agg(format('(%s)', format(template, tsq::text, row_limit)))
    into branches
    from jsonb_each_text(branch_templates) as b(name, template)
    where resources is null or b.name = any(resources);

    if branches is null then
        return;
    end if;

    return query execute format(
        'select * from (%s) results order by 7 desc nulls last',
        array_to_string(branches, ' union all ')
    );
end
$_$;
