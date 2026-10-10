alter table "public"."tasks" add column "created_at" timestamp with time zone not null default now();

-- Existing rows have no creation time to recover, so fall back to the best
-- available proxy: when the task was completed, a due date that has already
-- passed, or the contact's first_seen. `least(..., now())` keeps the result in
-- the past -- global_search sorts on this column, and a future date would put
-- every open task above every note, contact and deal. A bare `now()` would be
-- no better: it would tie every open task at the top of that same sort.
update "public"."tasks" t
set "created_at" = least(
    coalesce(
        t."done_date",
        case when t."due_date" < now() then t."due_date" end,
        c."first_seen"
    ),
    now()
)
from "public"."contacts" c
where c."id" = t."contact_id";

create extension if not exists "unaccent" with schema "extensions";

-- unaccent() is only STABLE (its dictionary could change), which generated
-- columns reject. The dictionary is fixed here, so the wrapper is immutable.
create or replace function public.search_unaccent(value text) returns text
    language sql immutable strict parallel safe
    set search_path to ''
    as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, value) $$;

-- Documents and queries are normalized the same way: unaccented, lowercased,
-- split on anything that is not a letter or a digit. So "hélène.dupont@acme.fr"
-- indexes as helene, dupont, acme, fr and any of those prefixes finds it.
create or replace function public.search_document(variadic parts text[]) returns tsvector
    language sql immutable parallel safe
    set search_path to ''
    as $$
        select to_tsvector(
            'simple'::regconfig,
            regexp_replace(public.search_unaccent(array_to_string(parts, ' ')), '[^[:alnum:]]+', ' ', 'g')
        )
    $$;

-- Every word of the query must match, each one as a prefix: "tho dup" finds
-- "Thomas Dupont". Returns null (matching nothing) for a blank query.
create or replace function public.search_query(query text) returns tsquery
    language sql immutable strict parallel safe
    set search_path to ''
    as $$
        select to_tsquery('simple'::regconfig, string_agg(word || ':*', ' & '))
        from regexp_split_to_table(lower(public.search_unaccent(query)), '[^[:alnum:]]+') as word
        where word <> ''
    $$;

create or replace function public.search_attachment_titles(attachments jsonb[]) returns text
    language sql immutable parallel safe
    set search_path to ''
    as $$ select string_agg(attachment ->> 'title', ' ') from unnest(attachments) as attachment $$;

alter table public.companies add column fts tsvector generated always as (
    public.search_document(name, sector, description, website::text, phone_number, zipcode, city, state_abbr)
) stored;

alter table public.contacts add column fts tsvector generated always as (
    public.search_document(
        first_name,
        last_name,
        title,
        background,
        jsonb_path_query_array(email_jsonb, '$[*]."email"')::text,
        jsonb_path_query_array(phone_jsonb, '$[*]."number"')::text
    )
) stored;

alter table public.deals add column fts tsvector generated always as (
    public.search_document(name, category, description)
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
-- query, which needs fine-grained lexeme statistics on the large tables.
create index contacts_first_seen_idx on public.contacts using btree (first_seen desc nulls last);
create index tasks_open_created_at_idx on public.tasks using btree (created_at desc) where done_date is null;
create index contact_notes_date_idx on public.contact_notes using btree (date desc nulls last);
create index deal_notes_date_idx on public.deal_notes using btree (date desc nulls last);

alter table public.contacts alter column fts set statistics 10000;
alter table public.tasks alter column fts set statistics 10000;
alter table public.contact_notes alter column fts set statistics 10000;
alter table public.deal_notes alter column fts set statistics 10000;

-- Each branch takes its own newest max_results matches, so the union never
-- holds more than 6 * max_results rows, and the lookups that build display
-- labels only run on those. The SQL is built per call with the tsquery inlined
-- as a literal: with a parameter the planner could not tell a rare word (use
-- the GIN index) from a common one (walk the date index).
create or replace function public.global_search(
    query text,
    resources text[] default null,
    max_results integer default 50
) returns table (
    id text,
    resource text,
    record_id bigint,
    title text,
    subtitle text,
    contact_id bigint,
    deal_id bigint,
    date timestamp with time zone
)
    language plpgsql stable security invoker
    set search_path to ''
    as $$
declare
    tsq tsquery := public.search_query(query);
    branch_templates constant jsonb := jsonb_build_object(
        'companies', $q$
            select 'company.' || c.id, 'companies', c.id, c.name, c.sector, null::bigint, null::bigint, c.created_at
            from public.companies c
            where c.fts @@ %1$L::tsquery
            order by c.created_at desc
            limit %2$s $q$,
        'contacts', $q$
            select 'contact.' || co.id, 'contacts', co.id, concat_ws(' ', co.first_name, co.last_name),
                (select cc.name from public.companies cc where cc.id = co.company_id), co.id, null::bigint, co.first_seen
            from public.contacts co
            where co.fts @@ %1$L::tsquery
            order by co.first_seen desc nulls last
            limit %2$s $q$,
        'deals', $q$
            select 'deal.' || d.id, 'deals', d.id, d.name,
                (select dc.name from public.companies dc where dc.id = d.company_id), null::bigint, d.id, d.created_at
            from public.deals d
            where d.archived_at is null and d.fts @@ %1$L::tsquery
            order by d.created_at desc
            limit %2$s $q$,
        'tasks', $q$
            select 'task.' || t.id, 'tasks', t.id, left(t.text, 200),
                (select concat_ws(' ', tc.first_name, tc.last_name) from public.contacts tc where tc.id = t.contact_id),
                t.contact_id, null::bigint, t.created_at
            from public.tasks t
            where t.done_date is null and t.fts @@ %1$L::tsquery
            order by t.created_at desc
            limit %2$s $q$,
        'contact_notes', $q$
            select 'contactNote.' || cn.id, 'contact_notes', cn.id, left(cn.text, 200),
                (select concat_ws(' ', nc.first_name, nc.last_name) from public.contacts nc where nc.id = cn.contact_id),
                cn.contact_id, null::bigint, cn.date
            from public.contact_notes cn
            where cn.fts @@ %1$L::tsquery
            order by cn.date desc nulls last
            limit %2$s $q$,
        'deal_notes', $q$
            select 'dealNote.' || dn.id, 'deal_notes', dn.id, left(dn.text, 200), nd.name, null::bigint, dn.deal_id, dn.date
            from public.deal_notes dn
                join public.deals nd on nd.id = dn.deal_id
            where nd.archived_at is null and dn.fts @@ %1$L::tsquery
            order by dn.date desc nulls last
            limit %2$s $q$
    );
    branches text[];
begin
    if tsq is null or max_results < 1 then
        return;
    end if;

    select array_agg(format('(%s)', format(template, tsq::text, max_results)))
    into branches
    from jsonb_each_text(branch_templates) as b(name, template)
    where resources is null or b.name = any(resources);

    if branches is null then
        return;
    end if;

    return query execute format(
        'select * from (%s) results order by 8 desc nulls last limit %s',
        array_to_string(branches, ' union all '),
        max_results
    );
end
$$;

revoke execute on function public.global_search(text, text[], integer) from public, anon;
grant execute on function public.global_search(text, text[], integer) to authenticated, service_role;
