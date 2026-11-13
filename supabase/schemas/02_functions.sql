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
declare domain_host text;
declare favicon_url text;

begin
    if exists (select from favicons_excluded_domains as fav where fav.domain = domain_name) then
        return null;
    end if;

    domain_host = (regexp_matches(domain_name, '^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)', 'i'))[1];
    if domain_host is null then
        return null;
    end if;

    -- Try the favicon.ico of the domain first
    favicon_url = concat('https://', domain_host, '/favicon.ico');
    begin
        perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '5000');
        select status from extensions.http_get(favicon_url) into domain_status;

        if domain_status = 200 then
            return favicon_url;
        end if;
    exception
        when others then
            null;
    end;

    -- Fallback to favicon.show
    return concat('https://favicon.show/', domain_host);
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

--
-- Businesses: current business, roles, lifecycle, sign up
-- (see migration 20261113120000_businesses.sql). Ordered so that each SQL
-- function is declared after the functions it calls.
--

CREATE OR REPLACE FUNCTION "public"."business_context_for_user"("p_user_id" "uuid") RETURNS TABLE("business_id" "uuid", "role" "public"."business_role")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select m.business_id, m.role
    from public.members m
    left join public.sales s on s.user_id = m.user_id
    where m.user_id = p_user_id and not m.disabled
    order by (m.business_id = s.current_business_id) desc nulls last, m.created_at, m.business_id
    limit 1
$$;

CREATE OR REPLACE FUNCTION "public"."current_business_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ select business_id from public.business_context_for_user(auth.uid()) $$;

CREATE OR REPLACE FUNCTION "public"."current_business_role"() RETURNS "public"."business_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ select role from public.business_context_for_user(auth.uid()) $$;

CREATE OR REPLACE FUNCTION "public"."can_write_current_business"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ select coalesce(public.current_business_role() <> 'accountant', false) $$;

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return coalesce(public.current_business_role() = 'owner', false);
end;
$$;

CREATE OR REPLACE FUNCTION "public"."is_visible_user"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select p_user_id = auth.uid() or exists (
        select 1 from public.members m
        where m.user_id = p_user_id and m.business_id = public.current_business_id()
    )
$$;

CREATE OR REPLACE FUNCTION "public"."administrator"("sale" "public"."sales") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select exists (
        select 1 from public.members m
        where m.user_id = sale.user_id
          and m.business_id = public.current_business_id()
          and m.role = 'owner'
    )
$$;

CREATE OR REPLACE FUNCTION "public"."disabled"("sale" "public"."sales") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select coalesce((
        select m.disabled from public.members m
        where m.user_id = sale.user_id
          and m.business_id = public.current_business_id()
    ), true)
$$;

CREATE OR REPLACE FUNCTION "public"."check_same_business_references"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- Nested ifs: plpgsql resolves new.<field> when the expression runs, and
  -- contacts has no contact_ids (deals no tags).
  if tg_table_name = 'contacts' then
    if new.tags is not null and exists (
      select 1 from unnest(new.tags) as tag_id
      where not exists (
        select 1 from public.tags t where t.id = tag_id and t.business_id = new.business_id
      )
    ) then
      raise exception 'Tag belongs to another business' using errcode = '23503';
    end if;
  end if;

  if tg_table_name = 'deals' then
    if new.contact_ids is not null and exists (
      select 1 from unnest(new.contact_ids) as contact_id
      where not exists (
        select 1 from public.contacts c where c.id = contact_id and c.business_id = new.business_id
      )
    ) then
      raise exception 'Contact belongs to another business' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."protect_last_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- The whole business is being deleted: nothing to protect.
  if not exists (select 1 from public.businesses b where b.id = old.business_id) then
    return coalesce(new, old);
  end if;

  if old.role = 'owner' and not old.disabled
    and (tg_op = 'DELETE' or new.role <> 'owner' or new.disabled)
    and not exists (
      select 1 from public.members m
      where m.business_id = old.business_id
        and m.user_id <> old.user_id
        and m.role = 'owner'
        and not m.disabled
    )
  then
    raise exception 'A business must keep at least one active owner' using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

CREATE OR REPLACE FUNCTION "public"."create_business"("p_name" "text", "p_country_code" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  new_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.businesses (name, country_code, created_by)
  values (btrim(p_name), p_country_code, auth.uid())
  returning id into new_business_id;

  insert into public.members (business_id, user_id, role)
  values (new_business_id, auth.uid(), 'owner');

  insert into public.configuration (id) values (new_business_id);

  update public.sales set current_business_id = new_business_id where user_id = auth.uid();

  return new_business_id;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."switch_business"("p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1 from public.members m
    where m.business_id = p_business_id and m.user_id = auth.uid() and not m.disabled
  ) then
    raise exception 'Not a member of this business' using errcode = '42501';
  end if;

  update public.sales set current_business_id = p_business_id where user_id = auth.uid();
end;
$$;

CREATE OR REPLACE FUNCTION "public"."delete_business"("p_business_id" "uuid", "p_confirm_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  business_name text;
begin
  if not exists (
    select 1 from public.members m
    where m.business_id = p_business_id and m.user_id = auth.uid()
      and m.role = 'owner' and not m.disabled
  ) then
    raise exception 'Only an owner can delete a business' using errcode = '42501';
  end if;

  select name into business_name from public.businesses where id = p_business_id;
  if p_confirm_name is distinct from business_name then
    raise exception 'The confirmation does not match the business name' using errcode = '22023';
  end if;

  delete from public.businesses where id = p_business_id;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  invited_business_id uuid;
  invited_role public.business_role;
  demo_business_id uuid;
  new_business_id uuid;
begin
  insert into public.sales (first_name, last_name, email, user_id)
  values (
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    new.email,
    new.id
  );

  delete from public.user_invitations where user_id = new.id
  returning business_id, role into invited_business_id, invited_role;

  if invited_business_id is not null then
    insert into public.members (business_id, user_id, role)
    values (invited_business_id, new.id, coalesce(invited_role, 'manager'));
    update public.sales set current_business_id = invited_business_id where user_id = new.id;
    return new;
  end if;

  -- Until the setup wizard exists, every new user gets a business of their own.
  insert into public.businesses (name, created_by) values ('My business', new.id)
  returning id into new_business_id;
  insert into public.members (business_id, user_id, role) values (new_business_id, new.id, 'owner');
  insert into public.configuration (id) values (new_business_id);

  -- Local development: the first user adopts the seeded demo business and starts there.
  select b.id into demo_business_id
  from public.businesses b
  where b.is_demo
    and not exists (select 1 from public.members m where m.business_id = b.id)
  order by b.created_at
  limit 1;

  if demo_business_id is not null then
    insert into public.members (business_id, user_id, role) values (demo_business_id, new.id, 'owner');
    -- The adopter manages the demo records, so the dashboard widgets that
    -- show "my" contacts and tasks are not empty. Companies are left out:
    -- updating them fetches favicons over the network.
    update public.contacts set sales_id = (select id from public.sales where user_id = new.id)
    where business_id = demo_business_id and sales_id is null;
    update public.contact_notes set sales_id = (select id from public.sales where user_id = new.id)
    where business_id = demo_business_id and sales_id is null;
    update public.deals set sales_id = (select id from public.sales where user_id = new.id)
    where business_id = demo_business_id and sales_id is null;
    update public.deal_notes set sales_id = (select id from public.sales where user_id = new.id)
    where business_id = demo_business_id and sales_id is null;
    update public.tasks set sales_id = (select id from public.sales where user_id = new.id)
    where business_id = demo_business_id and sales_id is null;
  end if;

  update public.sales set current_business_id = coalesce(demo_business_id, new_business_id) where user_id = new.id;

  return new;
end;
$$;
