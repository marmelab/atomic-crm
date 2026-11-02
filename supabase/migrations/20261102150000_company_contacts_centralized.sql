-- Centralized company contacts.
--
-- Contacts already belong to a company through contacts.company_id (FK +
-- index), which every CRM screen (contact list, activity log, deals, merge,
-- import) relies on. This migration extends that relationship instead of
-- adding a junction table:
--   * contacts.whatsapp_number: messaging number of the contact
--   * contacts.is_primary: the company's primary contact, at most one per company
--   * save_company_with_contacts(): saves a company and its contact list in a
--     single transaction
--   * the legacy company-level Mobile / WhatsApp / Email values are copied into
--     a primary contact. The legacy columns are kept (deprecated), never dropped.
--
-- Rollback: drop function public.save_company_with_contacts(bigint, jsonb, jsonb),
-- drop index contacts_one_primary_per_company, recreate contacts_summary without
-- the two new columns, then drop the two columns. The contacts created from
-- legacy values carry the title 'Main contact (migrated)' and can be identified
-- by it; the source values are still in companies.phone_number / email /
-- whatsapp_number.

alter table public.contacts add column if not exists whatsapp_number text;
alter table public.contacts add column if not exists is_primary boolean not null default false;

create unique index if not exists contacts_one_primary_per_company
    on public.contacts using btree (company_id)
    where is_primary;

-- New columns are appended at the end so "create or replace" keeps working.
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
    count(distinct t.id) filter (where t.done_date is null) as nb_tasks,
    co.whatsapp_number,
    co.is_primary
from public.contacts co
    left join public.tasks t on co.id = t.contact_id
    left join public.companies c on co.company_id = c.id
group by co.id, c.name;

-- Saves a company and its full contact list atomically, under the caller's RLS.
--
-- p_company_id: null to create the company, its id to update it.
-- p_company: the lead fields (name, sector, city, lead_date, pitch_point, sales_id).
-- p_contacts: the company's contacts after the save, an array of
--   { id?, first_name, last_name, title, mobile, whatsapp_number, email, is_primary }.
--   An item with an id updates that existing contact and links it to the
--   company; an item without one creates a contact. Contacts linked to the
--   company but missing from the array are unlinked, never deleted.
--   mobile / email replace the first entry of phone_jsonb / email_jsonb, so the
--   contact's other numbers and emails are kept.
-- Returns the company id.
CREATE OR REPLACE FUNCTION "public"."save_company_with_contacts"("p_company_id" bigint, "p_company" "jsonb", "p_contacts" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
    v_company_id bigint := p_company_id;
    v_contacts jsonb := coalesce(p_contacts, '[]'::jsonb);
    v_contact jsonb;
    v_contact_id bigint;
    v_kept_ids bigint[] := '{}';
    v_email text;
    v_mobile text;
begin
    if jsonb_typeof(v_contacts) <> 'array' then
        raise exception 'p_contacts must be an array' using errcode = '22023';
    end if;

    if nullif(trim(p_company->>'name'), '') is null then
        raise exception 'Company name is required' using errcode = '23502';
    end if;

    if (select count(*) from jsonb_array_elements(v_contacts) c
        where coalesce((c->>'is_primary')::boolean, false)) > 1 then
        raise exception 'A company can only have one primary contact' using errcode = '23505';
    end if;

    if (select count(c->>'id') <> count(distinct c->>'id')
        from jsonb_array_elements(v_contacts) c) then
        raise exception 'The same contact is listed twice' using errcode = '23505';
    end if;

    if v_company_id is null then
        insert into public.companies (name, sector, city, lead_date, pitch_point, sales_id)
        values (
            trim(p_company->>'name'),
            nullif(p_company->>'sector', ''),
            nullif(p_company->>'city', ''),
            coalesce(nullif(p_company->>'lead_date', '')::date, current_date),
            nullif(p_company->>'pitch_point', ''),
            (p_company->>'sales_id')::bigint
        )
        returning id into v_company_id;
    else
        update public.companies c set
            name = trim(p_company->>'name'),
            sector = case when p_company ? 'sector' then nullif(p_company->>'sector', '') else c.sector end,
            city = case when p_company ? 'city' then nullif(p_company->>'city', '') else c.city end,
            lead_date = case when p_company ? 'lead_date' then nullif(p_company->>'lead_date', '')::date else c.lead_date end,
            pitch_point = case when p_company ? 'pitch_point' then nullif(p_company->>'pitch_point', '') else c.pitch_point end,
            sales_id = case when p_company ? 'sales_id' then (p_company->>'sales_id')::bigint else c.sales_id end
        where c.id = v_company_id;

        if not found then
            raise exception 'Company % not found', v_company_id using errcode = 'P0002';
        end if;
    end if;

    -- Clear the primary flag first so moving it between contacts never trips
    -- the one-primary-per-company index.
    update public.contacts set is_primary = false
    where company_id = v_company_id and is_primary;

    for v_contact in select * from jsonb_array_elements(v_contacts)
    loop
        if nullif(trim(v_contact->>'first_name'), '') is null
            and nullif(trim(v_contact->>'last_name'), '') is null then
            raise exception 'Every contact needs a name' using errcode = '23502';
        end if;

        v_email := nullif(lower(trim(v_contact->>'email')), '');
        v_mobile := nullif(trim(v_contact->>'mobile'), '');
        v_contact_id := (v_contact->>'id')::bigint;

        if v_contact_id is null then
            insert into public.contacts (
                first_name, last_name, title, company_id, whatsapp_number, is_primary,
                email_jsonb, phone_jsonb, first_seen, last_seen, tags
            )
            values (
                nullif(trim(v_contact->>'first_name'), ''),
                nullif(trim(v_contact->>'last_name'), ''),
                nullif(trim(v_contact->>'title'), ''),
                v_company_id,
                nullif(trim(v_contact->>'whatsapp_number'), ''),
                coalesce((v_contact->>'is_primary')::boolean, false),
                case when v_email is not null
                    then jsonb_build_array(jsonb_build_object('email', v_email, 'type', 'Work')) end,
                case when v_mobile is not null
                    then jsonb_build_array(jsonb_build_object('number', v_mobile, 'type', 'Work')) end,
                now(),
                now(),
                '{}'
            )
            returning id into v_contact_id;
        else
            update public.contacts co set
                first_name = nullif(trim(v_contact->>'first_name'), ''),
                last_name = nullif(trim(v_contact->>'last_name'), ''),
                title = nullif(trim(v_contact->>'title'), ''),
                company_id = v_company_id,
                whatsapp_number = nullif(trim(v_contact->>'whatsapp_number'), ''),
                is_primary = coalesce((v_contact->>'is_primary')::boolean, false),
                email_jsonb = nullif(
                    case when v_email is null
                        then coalesce(co.email_jsonb, '[]'::jsonb) - 0
                        else jsonb_set(coalesce(co.email_jsonb, '[]'::jsonb), '{0}',
                            jsonb_build_object('email', v_email,
                                'type', coalesce(co.email_jsonb->0->>'type', 'Work')))
                    end, '[]'::jsonb),
                phone_jsonb = nullif(
                    case when v_mobile is null
                        then coalesce(co.phone_jsonb, '[]'::jsonb) - 0
                        else jsonb_set(coalesce(co.phone_jsonb, '[]'::jsonb), '{0}',
                            jsonb_build_object('number', v_mobile,
                                'type', coalesce(co.phone_jsonb->0->>'type', 'Work')))
                    end, '[]'::jsonb)
            where co.id = v_contact_id;

            if not found then
                raise exception 'Contact % not found', v_contact_id using errcode = 'P0002';
            end if;
        end if;

        v_kept_ids := v_kept_ids || v_contact_id;
    end loop;

    -- Unlink, never delete, the contacts removed from the list.
    update public.contacts set company_id = null, is_primary = false
    where company_id = v_company_id and id <> all (v_kept_ids);

    return v_company_id;
end;
$$;

revoke execute on function public.save_company_with_contacts(bigint, jsonb, jsonb) from public, anon;
grant execute on function public.save_company_with_contacts(bigint, jsonb, jsonb) to authenticated, service_role;

-- Copy the legacy company-level Mobile / WhatsApp / Email into a primary
-- contact, unless one of the company's contacts already carries that email or
-- number. The avatar lookup trigger is paused so the copy makes no network
-- call per contact; it is re-enabled in the same transaction.
alter table public.contacts disable trigger "20_contact_saved";

insert into public.contacts (
    first_name, last_name, title, company_id, sales_id, whatsapp_number, is_primary,
    email_jsonb, phone_jsonb, first_seen, last_seen, tags
)
select
    c.name,
    '',
    'Main contact (migrated)',
    c.id,
    c.sales_id,
    nullif(trim(c.whatsapp_number), ''),
    not exists (select 1 from public.contacts p where p.company_id = c.id and p.is_primary),
    case when nullif(trim(c.email), '') is not null
        then jsonb_build_array(jsonb_build_object('email', lower(trim(c.email)), 'type', 'Work')) end,
    case when nullif(trim(c.phone_number), '') is not null
        then jsonb_build_array(jsonb_build_object('number', trim(c.phone_number), 'type', 'Work')) end,
    now(),
    now(),
    '{}'
from public.companies c
where (nullif(trim(c.phone_number), '') is not null
        or nullif(trim(c.whatsapp_number), '') is not null
        or nullif(trim(c.email), '') is not null)
    and not exists (
        select 1 from public.contacts co
        where co.company_id = c.id
            and (
                (nullif(trim(c.email), '') is not null
                    and co.email_jsonb @> jsonb_build_array(jsonb_build_object('email', lower(trim(c.email)))))
                or (nullif(trim(c.phone_number), '') is not null
                    and co.phone_jsonb @> jsonb_build_array(jsonb_build_object('number', trim(c.phone_number))))
                or (nullif(trim(c.whatsapp_number), '') is not null
                    and co.whatsapp_number = trim(c.whatsapp_number))
            )
    );

alter table public.contacts enable trigger "20_contact_saved";

comment on column public.companies.phone_number is 'Deprecated: managed on the company contacts (contacts.phone_jsonb). Kept for data safety.';
comment on column public.companies.whatsapp_number is 'Deprecated: managed on the company contacts (contacts.whatsapp_number). Kept for data safety.';
comment on column public.companies.email is 'Deprecated: managed on the company contacts (contacts.email_jsonb). Kept for data safety.';

-- Verification queries (run manually after the migration):
--   -- every company with a legacy value now has a contact carrying it
--   select c.id, c.name from public.companies c
--   where (nullif(trim(c.phone_number), '') is not null
--          or nullif(trim(c.whatsapp_number), '') is not null
--          or nullif(trim(c.email), '') is not null)
--     and not exists (select 1 from public.contacts co where co.company_id = c.id);
--   -- expect 0 rows
--
--   -- no company has more than one primary contact
--   select company_id, count(*) from public.contacts
--   where is_primary group by company_id having count(*) > 1;
--   -- expect 0 rows
