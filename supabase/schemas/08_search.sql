--
-- Global search
-- Each searchable table carries a generated tsvector column with a GIN index,
-- and global_search() queries them through RLS (security invoker), so search
-- visibility always follows the table policies.
--

create extension if not exists "unaccent" with schema "extensions";

-- unaccent() is only STABLE (its dictionary could change), which generated
-- columns reject. The dictionary is fixed here, so the wrapper is immutable.
CREATE OR REPLACE FUNCTION "public"."search_unaccent"("value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    SET "search_path" TO ''
    AS $$ select extensions.unaccent('extensions.unaccent'::regdictionary, value) $$;

-- Documents and queries are normalized the same way: unaccented, lowercased,
-- split on anything that is not a letter or a digit. So "hélène.dupont@acme.fr"
-- indexes as helene, dupont, acme, fr and any of those prefixes finds it.
CREATE OR REPLACE FUNCTION "public"."search_document"(VARIADIC "parts" "text"[]) RETURNS "tsvector"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
        select to_tsvector(
            'simple'::regconfig,
            regexp_replace(public.search_unaccent(array_to_string(parts, ' ')), '[^[:alnum:]]+', ' ', 'g')
        )
    $$;

-- Every word of the query must match, each one as a prefix: "tho dup" finds
-- "Thomas Dupont". Returns null (matching nothing) for a blank query.
CREATE OR REPLACE FUNCTION "public"."search_query"("query" "text") RETURNS "tsquery"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
        select to_tsquery('simple'::regconfig, string_agg(word || ':*', ' & '))
        from regexp_split_to_table(lower(public.search_unaccent(query)), '[^[:alnum:]]+') as word
        where word <> ''
    $$;

CREATE OR REPLACE FUNCTION "public"."search_attachment_titles"("attachments" "jsonb"[]) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$ select string_agg(attachment ->> 'title', ' ') from unnest(attachments) as attachment $$;

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

alter table public.tasks add column fts tsvector generated always as (
    public.search_document(text, type)
) stored;

alter table public.contact_notes add column fts tsvector generated always as (
    public.search_document(text, public.search_attachment_titles(attachments))
) stored;

alter table public.deal_notes add column fts tsvector generated always as (
    public.search_document(text, public.search_attachment_titles(attachments))
) stored;

-- Partial indexes mirror what global_search() returns: open tasks, live deals.
create index companies_fts_idx on public.companies using gin (fts);
create index contacts_fts_idx on public.contacts using gin (fts);
create index deals_fts_idx on public.deals using gin (fts) where archived_at is null;
create index tasks_fts_idx on public.tasks using gin (fts) where done_date is null;
create index contact_notes_fts_idx on public.contact_notes using gin (fts);
create index deal_notes_fts_idx on public.deal_notes using gin (fts);

-- A word found in most rows (a common word, a 2-letter prefix) makes the GIN
-- path fetch and sort every match. Walking a date index backwards instead stops
-- at the first max_results matches. The planner picks between the two per
-- query, which needs fine-grained lexeme statistics on the large tables. This
-- only applies to tasks and notes: global_search() ranks the other resources
-- by relevance, which needs every match.
create index contacts_first_seen_idx on public.contacts using btree (first_seen desc nulls last);
create index tasks_open_created_at_idx on public.tasks using btree (created_at desc) where done_date is null;
create index contact_notes_date_idx on public.contact_notes using btree (date desc nulls last);
create index deal_notes_date_idx on public.deal_notes using btree (date desc nulls last);

alter table public.contacts alter column fts set statistics 10000;
alter table public.tasks alter column fts set statistics 10000;
alter table public.contact_notes alter column fts set statistics 10000;
alter table public.deal_notes alter column fts set statistics 10000;

-- Companies, contacts and deals are ranked by relevance (ts_rank): their name
-- is weighted A in fts, so a contact named John Doe ranks before one whose
-- background mentions John Doe. Ties, tasks and notes go newest first.
--
-- Each branch takes its own max_results best matches (at most 200), so the
-- union never holds more than 6 * max_results rows, and the lookups that build
-- display labels only run on those. The cap is per resource, not overall: an
-- old contact must not be crowded out by newer notes that mention its name.
-- `content` carries the searched fields in their original form, so the client
-- can show and highlight where the words matched.
--
-- force_custom_plan plans each call with the actual query: with a generic plan
-- the planner could not tell a rare word (use the GIN index) from a common one
-- (walk the date index), and could not skip the resources left out.
CREATE OR REPLACE FUNCTION "public"."global_search"("query" "text", "resources" "text"[] DEFAULT NULL::"text"[], "max_results" integer DEFAULT 50) RETURNS TABLE("resource" "text", "record_id" bigint, "title" "text", "subtitle" "text", "contact_id" bigint, "deal_id" bigint, "date" timestamp with time zone, "content" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    SET "plan_cache_mode" TO 'force_custom_plan'
    AS $$
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
$$;

revoke execute on function public.global_search(text, text[], integer) from public, anon;
grant execute on function public.global_search(text, text[], integer) to authenticated, service_role;
