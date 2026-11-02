-- Persist the lead fields collected on the company form.

CREATE OR REPLACE FUNCTION "public"."save_company_with_contacts"("p_company_id" bigint, "p_company" "jsonb", "p_contacts" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
    v_company_id bigint := p_company_id;
    v_is_new boolean := p_company_id is null;
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
        insert into public.companies (
            name, sector, city, lead_date, pitch_point, sales_id,
            website, phone_number, email, whatsapp_number
        )
        values (
            trim(p_company->>'name'),
            nullif(p_company->>'sector', ''),
            nullif(p_company->>'city', ''),
            coalesce(nullif(p_company->>'lead_date', '')::date, current_date),
            nullif(p_company->>'pitch_point', ''),
            (p_company->>'sales_id')::bigint,
            nullif(trim(p_company->>'website'), ''),
            nullif(trim(p_company->>'phone_number'), ''),
            nullif(trim(p_company->>'email'), ''),
            nullif(trim(p_company->>'whatsapp_number'), '')
        )
        returning id into v_company_id;
    else
        update public.companies c set
            name = trim(p_company->>'name'),
            sector = case when p_company ? 'sector' then nullif(p_company->>'sector', '') else c.sector end,
            city = case when p_company ? 'city' then nullif(p_company->>'city', '') else c.city end,
            lead_date = case when p_company ? 'lead_date' then nullif(p_company->>'lead_date', '')::date else c.lead_date end,
            pitch_point = case when p_company ? 'pitch_point' then nullif(p_company->>'pitch_point', '') else c.pitch_point end,
            website = case when p_company ? 'website' then nullif(trim(p_company->>'website'), '') else c.website end,
            phone_number = case when p_company ? 'phone_number' then nullif(trim(p_company->>'phone_number'), '') else c.phone_number end,
            email = case when p_company ? 'email' then nullif(trim(p_company->>'email'), '') else c.email end,
            whatsapp_number = case when p_company ? 'whatsapp_number' then nullif(trim(p_company->>'whatsapp_number'), '') else c.whatsapp_number end,
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

    -- A new company with at least one contact opens one cold deal.
    -- A later edit does not open another.
    if v_is_new and coalesce(array_length(v_kept_ids, 1), 0) > 0 then
        perform public.open_cold_deal(
            v_company_id,
            v_kept_ids,
            coalesce(nullif(p_company->>'sales_id', '')::bigint, public.current_sales_id()),
            trim(p_company->>'name')
        );
    end if;

    return v_company_id;
end;
$$;
