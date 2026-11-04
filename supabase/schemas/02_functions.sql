--
-- Functions
-- This file declares all PL/pgSQL functions in the public schema.
--

CREATE OR REPLACE FUNCTION "public"."cleanup_note_attachments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    DECLARE
      payload jsonb;
      request_headers jsonb;
      auth_header text;
    BEGIN
      request_headers := coalesce(
        nullif(current_setting('request.headers', true), '')::jsonb,
        '{}'::jsonb
      );
      auth_header := request_headers ->> 'authorization';

      IF auth_header IS NULL OR auth_header = '' THEN
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;

        RETURN NEW;
      END IF;

      payload := jsonb_build_object(
        'old_record', OLD,
        'record', NEW,
        'type', TG_OP
      );

      PERFORM net.http_post(
        url := public.get_note_attachments_function_url(),
        body := payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type',
          'application/json',
          'Authorization',
          auth_header
        ),
        timeout_milliseconds := 10000
      );

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."get_avatar_for_email"("email" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare email_hash text;
declare gravatar_url text;
declare gravatar_status int8;
declare email_domain text;
declare favicon_url text;
declare domain_status int8;

begin
    -- Try to fetch a gravatar image
    email_hash = encode(extensions.digest(email, 'sha256'), 'hex');
    gravatar_url = concat('https://www.gravatar.com/avatar/', email_hash, '?d=404');

    select status from extensions.http_get(gravatar_url) into gravatar_status;

    if gravatar_status = 200 then
        return gravatar_url;
    end if;

    -- Fallback to email's domain favicon if not excluded
    email_domain = split_part(email, '@', 2);
    return get_domain_favicon(email_domain);
exception
    when others then
        return 'ERROR';
end;
$$;

CREATE OR REPLACE FUNCTION "public"."get_domain_favicon"("domain_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare domain_status int8;

begin
    if exists (select from favicons_excluded_domains as fav where fav.domain = domain_name) then
        return null;
    end if;

    return concat(
        'https://favicon.show/',
        (regexp_matches(domain_name, '^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)', 'i'))[1]
    );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."get_note_attachments_function_url"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
    DECLARE
      issuer text;
      function_url text;
    BEGIN
      issuer := coalesce(
        nullif(current_setting('request.jwt.claim.iss', true), ''),
        (
          coalesce(
            nullif(current_setting('request.jwt.claims', true), ''),
            '{}'
          )::jsonb ->> 'iss'
        )
      );
      issuer := nullif(issuer, '');
      IF issuer IS NOT NULL THEN
        issuer := rtrim(issuer, '/');
        IF right(issuer, 8) = '/auth/v1' THEN
          function_url :=
            left(issuer, length(issuer) - 8) || '/functions/v1/delete_note_attachments';

          IF function_url LIKE 'http://127.0.0.1:%' THEN
            RETURN replace(
              function_url,
              'http://127.0.0.1:',
              'http://host.docker.internal:'
            );
          END IF;

          IF function_url LIKE 'http://localhost:%' THEN
            RETURN replace(
              function_url,
              'http://localhost:',
              'http://host.docker.internal:'
            );
          END IF;

          RETURN function_url;
        END IF;
      END IF;

      RETURN 'http://host.docker.internal:54321/functions/v1/delete_note_attachments';
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("email" "text") RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  RETURN QUERY SELECT au.id FROM auth.users au WHERE au.email = $1;
END;
$_$;

CREATE OR REPLACE FUNCTION "public"."handle_company_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare company_logo text;

begin
    if new.logo is not null then
        return new;
    end if;

    -- Bulk lead import sets crm.skip_enrichment so it never waits on HTTP
    if current_setting('crm.skip_enrichment', true) = 'on' then
        return new;
    end if;

    company_logo = get_domain_favicon(new.website);
    if company_logo is null then
        return new;
    end if;

    new.logo = concat('{"src":"', company_logo, '","title":"Company favicon"}');
    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_contact_note_created_or_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.contacts set last_seen = new.date where contacts.id = new.contact_id and contacts.last_seen < new.date;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_contact_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$declare contact_avatar text;
declare emails_length int8;
declare item jsonb;

begin
    if new.avatar is not null then
        return new;
    end if;

    -- Bulk lead import sets crm.skip_enrichment so it never waits on HTTP
    if current_setting('crm.skip_enrichment', true) = 'on' then
        return new;
    end if;

    if tg_op = 'UPDATE' and new.email_jsonb is not distinct from old.email_jsonb then
        return new;
    end if;

    select coalesce(jsonb_array_length(new.email_jsonb), 0) into emails_length;

    if emails_length = 0 then
        return new;
    end if;

    for item in select jsonb_array_elements(new.email_jsonb)
    loop
        select public.get_avatar_for_email(item->>'email') into contact_avatar;
        if (contact_avatar is not null) then
            exit;
        end if;
    end loop;

    if contact_avatar is null then
        return new;
    end if;

    new.avatar = concat('{"src":"', contact_avatar, '"}');
    return new;
end;$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  sales_count int;
begin
  select count(id) into sales_count
  from public.sales;

  delete from public.user_invitations where user_id = new.id;
  if sales_count > 0 and not found and not new.is_sso_user then
    raise exception 'Sign up is not allowed';
  end if;

  insert into public.sales (first_name, last_name, email, user_id, administrator)
  values (
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    new.email,
    new.id,
    case when sales_count > 0 then FALSE else TRUE end
  );
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_tag_deleted"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  update public.contacts set tags = array_remove(tags, old.id) where tags @> array[old.id];
  return old;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_update_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.sales
  set
    first_name = coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    last_name = coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    email = new.email
  where user_id = new.id;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1 from public.sales where user_id = auth.uid() and administrator = true and not disabled
  );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."merge_contacts"("loser_id" bigint, "winner_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  winner_contact contacts%ROWTYPE;
  loser_contact contacts%ROWTYPE;
  deal_record RECORD;
  merged_emails jsonb;
  merged_phones jsonb;
  merged_tags bigint[];
  winner_emails jsonb;
  loser_emails jsonb;
  winner_phones jsonb;
  loser_phones jsonb;
  email_map jsonb;
  phone_map jsonb;
BEGIN
  -- Fetch both contacts
  SELECT * INTO winner_contact FROM contacts WHERE id = winner_id;
  SELECT * INTO loser_contact FROM contacts WHERE id = loser_id;

  IF winner_contact IS NULL OR loser_contact IS NULL THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- 1. Reassign tasks from loser to winner
  UPDATE tasks SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 2. Reassign contact notes from loser to winner
  UPDATE contact_notes SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 3. Update deals - replace loser with winner in contact_ids array
  FOR deal_record IN
    SELECT id, contact_ids
    FROM deals
    WHERE contact_ids @> ARRAY[loser_id]
  LOOP
    UPDATE deals
    SET contact_ids = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(
          array_remove(deal_record.contact_ids, loser_id) || ARRAY[winner_id]
        )
      )
    )
    WHERE id = deal_record.id;
  END LOOP;

  -- 4. Merge contact data

  -- Get email arrays
  winner_emails := COALESCE(winner_contact.email_jsonb, '[]'::jsonb);
  loser_emails := COALESCE(loser_contact.email_jsonb, '[]'::jsonb);

  -- Merge emails with deduplication by email address
  -- Build a map of email -> email object, then convert back to array
  email_map := '{}'::jsonb;

  -- Add winner emails to map
  IF jsonb_array_length(winner_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_emails)-1 LOOP
      email_map := email_map || jsonb_build_object(
        winner_emails->i->>'email',
        winner_emails->i
      );
    END LOOP;
  END IF;

  -- Add loser emails to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_emails)-1 LOOP
      IF NOT email_map ? (loser_emails->i->>'email') THEN
        email_map := email_map || jsonb_build_object(
          loser_emails->i->>'email',
          loser_emails->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_emails := (SELECT jsonb_agg(value) FROM jsonb_each(email_map));
  merged_emails := COALESCE(merged_emails, '[]'::jsonb);

  -- Get phone arrays
  winner_phones := COALESCE(winner_contact.phone_jsonb, '[]'::jsonb);
  loser_phones := COALESCE(loser_contact.phone_jsonb, '[]'::jsonb);

  -- Merge phones with deduplication by number
  phone_map := '{}'::jsonb;

  -- Add winner phones to map
  IF jsonb_array_length(winner_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_phones)-1 LOOP
      phone_map := phone_map || jsonb_build_object(
        winner_phones->i->>'number',
        winner_phones->i
      );
    END LOOP;
  END IF;

  -- Add loser phones to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_phones)-1 LOOP
      IF NOT phone_map ? (loser_phones->i->>'number') THEN
        phone_map := phone_map || jsonb_build_object(
          loser_phones->i->>'number',
          loser_phones->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_phones := (SELECT jsonb_agg(value) FROM jsonb_each(phone_map));
  merged_phones := COALESCE(merged_phones, '[]'::jsonb);

  -- Merge tags (remove duplicates)
  merged_tags := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(winner_contact.tags, ARRAY[]::bigint[]) ||
      COALESCE(loser_contact.tags, ARRAY[]::bigint[])
    )
  );

  -- 5. Update winner with merged data
  UPDATE contacts SET
    avatar = COALESCE(winner_contact.avatar, loser_contact.avatar),
    gender = COALESCE(winner_contact.gender, loser_contact.gender),
    first_name = COALESCE(winner_contact.first_name, loser_contact.first_name),
    last_name = COALESCE(winner_contact.last_name, loser_contact.last_name),
    title = COALESCE(winner_contact.title, loser_contact.title),
    company_id = COALESCE(winner_contact.company_id, loser_contact.company_id),
    email_jsonb = merged_emails,
    phone_jsonb = merged_phones,
    linkedin_url = COALESCE(winner_contact.linkedin_url, loser_contact.linkedin_url),
    background = COALESCE(winner_contact.background, loser_contact.background),
    has_newsletter = COALESCE(winner_contact.has_newsletter, loser_contact.has_newsletter),
    first_seen = LEAST(COALESCE(winner_contact.first_seen, loser_contact.first_seen), COALESCE(loser_contact.first_seen, winner_contact.first_seen)),
    last_seen = GREATEST(COALESCE(winner_contact.last_seen, loser_contact.last_seen), COALESCE(loser_contact.last_seen, winner_contact.last_seen)),
    sales_id = COALESCE(winner_contact.sales_id, loser_contact.sales_id),
    tags = merged_tags
  WHERE id = winner_id;

  -- 6. Delete loser contact
  DELETE FROM contacts WHERE id = loser_id;

  RETURN winner_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."lowercase_email_jsonb"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.email_jsonb IS NOT NULL THEN
    NEW.email_jsonb = COALESCE((
      SELECT jsonb_agg(
        jsonb_set(elem, '{email}', to_jsonb(LOWER(elem->>'email')))
      )
      FROM jsonb_array_elements(NEW.email_jsonb) AS elem
    ), '[]'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

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
            website, phone_number, email, whatsapp_number, priority
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
            nullif(trim(p_company->>'whatsapp_number'), ''),
            coalesce(nullif(p_company->>'priority', ''), 'medium')
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
            priority = case when p_company ? 'priority' then coalesce(nullif(p_company->>'priority', ''), 'medium') else c.priority end,
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

CREATE OR REPLACE FUNCTION "public"."set_sales_id_default"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.sales_id IS NULL THEN
    SELECT id INTO NEW.sales_id FROM sales WHERE user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."crm_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select role from public.sales where user_id = auth.uid() and not disabled;
$$;

CREATE OR REPLACE FUNCTION "public"."current_sales_id"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select id from public.sales where user_id = auth.uid() and not disabled;
$$;

CREATE OR REPLACE FUNCTION "public"."is_manager"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(public.crm_role() in ('admin', 'manager'), false);
$$;

CREATE OR REPLACE FUNCTION "public"."can_see_company"("p_company_id" bigint) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.is_manager()
    or exists (
      select 1 from public.companies c
      where c.id = p_company_id and c.sales_id = public.current_sales_id()
    )
    or exists (
      select 1 from public.contacts co
      where co.company_id = p_company_id
        and (co.assigned_to = public.current_sales_id() or co.sales_id = public.current_sales_id())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."sync_sales_role"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
    -- The legacy administrator flag and the role always agree.
    if tg_op = 'INSERT' then
        if new.administrator then
            new.role := 'admin';
        else
            new.administrator := new.role = 'admin';
        end if;
    elsif new.administrator is distinct from old.administrator then
        new.role := case
            when new.administrator then 'admin'
            when new.role = 'admin' then 'manager'
            else new.role
        end;
    elsif new.role is distinct from old.role then
        new.administrator := new.role = 'admin';
    end if;
    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."call_engine_settings"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
      'dailyCallQuota', 25,
      'retryWindowWorkingDays', 3,
      'timezone', 'Asia/Kolkata',
      'workingDays', jsonb_build_array(1, 2, 3, 4, 5),
      'holidays', jsonb_build_array(),
      'recycleCooldownDays', 7,
      'assignmentTime', '08:30'
    ) || coalesce((select config -> 'callEngine' from public.configuration where id = 1), '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION "public"."open_cold_deal"("p_company_id" bigint, "p_contact_ids" bigint[], "p_sales_id" bigint, "p_deal_name" "text") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
    v_deal_id bigint;
    v_existing bigint[];
    v_name text;
begin
    if p_company_id is null then
        return null;
    end if;

    -- One open deal per company. A second contact is attached to it.
    select d.id, coalesce(d.contact_ids, '{}'::bigint[])
      into v_deal_id, v_existing
    from public.deals d
    where d.company_id = p_company_id
      and d.archived_at is null
    order by d.id
    limit 1;

    if v_deal_id is not null then
        update public.deals set
            contact_ids = (
                select coalesce(array_agg(distinct cid), '{}'::bigint[])
                from unnest(v_existing || coalesce(p_contact_ids, '{}'::bigint[])) as cid
                where cid is not null
            ),
            updated_at = now()
        where id = v_deal_id;
        return v_deal_id;
    end if;

    v_name := nullif(trim(p_deal_name), '');
    if v_name is null then
        select c.name into v_name from public.companies c where c.id = p_company_id;
    end if;

    insert into public.deals (
        name, company_id, contact_ids, categories, stage, amount, sales_id, index, created_at, updated_at
    )
    values (
        coalesce(v_name, 'Deal'),
        p_company_id,
        coalesce((
            select array_agg(distinct cid)
            from unnest(coalesce(p_contact_ids, '{}'::bigint[])) as cid
            where cid is not null
        ), '{}'::bigint[]),
        '{}'::text[],
        'new',
        0,
        p_sales_id,
        0,
        now(),
        now()
    )
    returning id into v_deal_id;

    return v_deal_id;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."protect_brochure_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
    -- The other app (service role) may write the brochure. A signed-in user
    -- may only change the approval status.
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
        if new.company_id is distinct from old.company_id
            or new.contact_id is distinct from old.contact_id
            or new.deal_id is distinct from old.deal_id
            or new.title is distinct from old.title
            or new.brochure_url is distinct from old.brochure_url
            or new.created_at is distinct from old.created_at
        then
            raise exception 'Only the brochure status can be changed' using errcode = '42501';
        end if;
    end if;

    new.updated_at := now();
    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."import_leads"("p_file_name" "text", "p_rows" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
declare
    v_row jsonb;
    v_batch_id bigint;
    v_results jsonb := '[]'::jsonb;
    v_phone text;
    v_email text;
    v_company_name text;
    v_domain text;
    v_sector text;
    v_company_id bigint;
    v_contact_id bigint;
    v_seen_phones text[] := '{}';
    v_seen_emails text[] := '{}';
    v_created int := 0;
    v_duplicates int := 0;
    v_invalid int := 0;
    v_reason text;
begin
    if not public.is_manager() then
        raise exception 'Only admins and managers can import leads' using errcode = '42501';
    end if;
    if jsonb_typeof(p_rows) is distinct from 'array' then
        raise exception 'p_rows must be an array' using errcode = '22023';
    end if;

    -- Never wait on favicon / gravatar HTTP calls during a bulk import.
    perform set_config('crm.skip_enrichment', 'on', true);

    insert into public.import_batches (created_by, file_name, total_rows)
    values (public.current_sales_id(), p_file_name, jsonb_array_length(p_rows))
    returning id into v_batch_id;

    for v_row in select * from jsonb_array_elements(p_rows)
    loop
        v_phone := nullif(trim(v_row->>'phone'), '');
        v_email := nullif(lower(trim(v_row->>'email')), '');
        v_company_name := nullif(trim(v_row->>'company_name'), '');
        v_domain := nullif(lower(trim(v_row->>'domain')), '');
        v_reason := null;

        if v_phone is null and v_email is null then
            v_reason := 'missing phone and email';
        elsif v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
            v_reason := 'invalid phone';
        elsif v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
            v_reason := 'invalid email';
        elsif v_company_name is null then
            v_reason := 'missing company name';
        elsif nullif(trim(coalesce(v_row->>'first_name', '') || coalesce(v_row->>'last_name', '')), '') is null then
            v_reason := 'missing contact name';
        end if;

        if v_reason is not null then
            v_invalid := v_invalid + 1;
            v_results := v_results || jsonb_build_object('row', v_row->'row', 'status', 'invalid', 'reason', v_reason);
            continue;
        end if;

        select co.id into v_contact_id
        from public.contacts co
        where (v_phone is not null and co.phone_e164 = v_phone)
           or (v_email is not null and co.email_jsonb @> jsonb_build_array(jsonb_build_object('email', v_email)))
        limit 1;

        if v_contact_id is not null
            or (v_phone is not null and v_phone = any (v_seen_phones))
            or (v_email is not null and v_email = any (v_seen_emails)) then
            v_duplicates := v_duplicates + 1;
            v_results := v_results || jsonb_build_object(
                'row', v_row->'row', 'status', 'duplicate',
                'reason', case when v_contact_id is null then 'duplicate in file' else 'matches an existing lead' end,
                'contact_id', v_contact_id);
            continue;
        end if;

        -- Industry: reuse a sector by label or value, or create it.
        v_sector := null;
        if nullif(trim(v_row->>'industry'), '') is not null then
            select s.value into v_sector from public.company_sectors s
            where lower(s.label) = lower(trim(v_row->>'industry')) or s.value = lower(trim(v_row->>'industry'))
            limit 1;
            if v_sector is null then
                v_sector := trim(both '-' from regexp_replace(lower(trim(v_row->>'industry')), '[^a-z0-9]+', '-', 'g'));
                insert into public.company_sectors (value, label)
                values (v_sector, trim(v_row->>'industry'))
                on conflict do nothing;
            end if;
        end if;

        -- Company: same domain or same name is the same company.
        select c.id into v_company_id from public.companies c
        where (v_domain is not null and lower(regexp_replace(c.website::text, '^(https?://)?(www\.)?([^/:]+).*$', '\3')) = v_domain)
           or lower(c.name) = lower(v_company_name)
        order by c.id
        limit 1;

        if v_company_id is null then
            insert into public.companies (name, sector, pitch_point, website, lead_date, created_at)
            values (
                v_company_name,
                v_sector,
                nullif(trim(v_row->>'pitch'), ''),
                case when v_domain is not null then 'https://' || v_domain end,
                current_date,
                now()
            )
            returning id into v_company_id;
        else
            update public.companies c set
                pitch_point = coalesce(c.pitch_point, nullif(trim(v_row->>'pitch'), '')),
                sector = coalesce(c.sector, v_sector)
            where c.id = v_company_id;
        end if;

        insert into public.contacts (
            first_name, last_name, title, company_id, whatsapp_number, is_primary,
            email_jsonb, phone_jsonb, phone_e164,
            lead_stage, import_batch_id, first_seen, last_seen, tags
        )
        values (
            nullif(trim(v_row->>'first_name'), ''),
            nullif(trim(v_row->>'last_name'), ''),
            nullif(trim(v_row->>'title'), ''),
            v_company_id,
            v_phone,
            not exists (
                select 1 from public.contacts existing
                where existing.company_id = v_company_id and existing.is_primary
            ),
            case when v_email is not null then jsonb_build_array(jsonb_build_object('email', v_email, 'type', 'Work')) end,
            case when v_phone is not null then jsonb_build_array(jsonb_build_object('number', v_phone, 'type', 'Work')) end,
            v_phone,
            'new',
            v_batch_id,
            now(),
            now(),
            '{}'
        )
        returning id into v_contact_id;

        perform public.open_cold_deal(
            v_company_id,
            array[v_contact_id],
            coalesce(
                (select c.sales_id from public.companies c where c.id = v_company_id),
                public.current_sales_id()
            ),
            v_company_name
        );

        if v_phone is not null then v_seen_phones := v_seen_phones || v_phone; end if;
        if v_email is not null then v_seen_emails := v_seen_emails || v_email; end if;
        v_created := v_created + 1;
        v_results := v_results || jsonb_build_object('row', v_row->'row', 'status', 'created', 'contact_id', v_contact_id);
    end loop;

    update public.import_batches set
        created_count = v_created,
        duplicate_count = v_duplicates,
        invalid_count = v_invalid
    where id = v_batch_id;

    return jsonb_build_object(
        'batch_id', v_batch_id,
        'created', v_created,
        'duplicates', v_duplicates,
        'invalid', v_invalid,
        'rows', v_results
    );
end;
$_$;
