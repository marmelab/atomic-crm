-- This migration allows to resolve several security warnings raised by the Supabase Advisor:
-- * Security Definer View
-- * Function Search Path Mutable
-- * Extension in Public

-- Recreate the contacts_summary view with security_invoker enabled
drop view contacts_summary;

create view contacts_summary
with (security_invoker=on)
as
select 
    co.*,
    jsonb_path_query_array(co.email_jsonb, '$[*].email')::text as email_fts,
    jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text as phone_fts,
    c.name as company_name,
    count(distinct t.id) as nb_tasks
from
    contacts co
left join
    tasks t on co.id = t.contact_id
left join
    companies c on co.company_id = c.id
group by
    co.id, c.name;

-- Ensure all functions have search_path set to prevent search path injection attacks

-- Functions that already use qualified names can be simply altered to use public search_path

ALTER FUNCTION public.get_note_attachments_function_url()
SET search_path TO 'public';

ALTER FUNCTION public.get_user_id_by_email(text)
SET search_path TO 'public';

ALTER FUNCTION public.handle_contact_saved()
SET search_path TO 'public';

-- get_avatar_for_email: set search_path='public' and qualify extension calls
-- (http_get -> extensions.http_get, digest -> extensions.digest)
DROP FUNCTION IF EXISTS public.get_avatar_for_email(text);

CREATE FUNCTION public.get_avatar_for_email(email text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
$function$;

-- get_domain_favicon: set search_path='public' (no changes to table references needed)
DROP FUNCTION IF EXISTS public.get_domain_favicon(text);

CREATE FUNCTION public.get_domain_favicon(domain_name text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
$function$;

-- handle_company_saved: set search_path='public' (no changes to function calls needed)
-- Drop the trigger first, then the function
DROP TRIGGER IF EXISTS company_saved ON public.companies;
DROP FUNCTION IF EXISTS public.handle_company_saved();

CREATE FUNCTION public.handle_company_saved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
$function$;

-- Recreate the trigger
CREATE TRIGGER company_saved BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.handle_company_saved();

-- set_sales_id_default: set search_path='public' (no changes to table references needed)
-- Drop all triggers that depend on this function first
DROP TRIGGER IF EXISTS set_task_sales_id_trigger ON public.tasks;
DROP TRIGGER IF EXISTS set_contact_sales_id_trigger ON public.contacts;
DROP TRIGGER IF EXISTS set_contact_notes_sales_id_trigger ON public.contact_notes;
DROP TRIGGER IF EXISTS set_company_sales_id_trigger ON public.companies;
DROP TRIGGER IF EXISTS set_deal_sales_id_trigger ON public.deals;
DROP TRIGGER IF EXISTS set_deal_notes_sales_id_trigger ON public.deal_notes;

DROP FUNCTION IF EXISTS public.set_sales_id_default();

CREATE FUNCTION public.set_sales_id_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sales_id IS NULL THEN
    SELECT id INTO NEW.sales_id FROM sales WHERE user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate all triggers
CREATE TRIGGER set_task_sales_id_trigger
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_sales_id_default();

CREATE TRIGGER set_contact_sales_id_trigger
BEFORE INSERT ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_sales_id_default();

CREATE TRIGGER set_contact_notes_sales_id_trigger
BEFORE INSERT ON public.contact_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_sales_id_default();

CREATE TRIGGER set_company_sales_id_trigger
BEFORE INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.set_sales_id_default();

CREATE TRIGGER set_deal_sales_id_trigger
BEFORE INSERT ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.set_sales_id_default();

CREATE TRIGGER set_deal_notes_sales_id_trigger
BEFORE INSERT ON public.deal_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_sales_id_default();

-- merge_contacts: set search_path='public' (no changes to table references needed)
DROP FUNCTION IF EXISTS public.merge_contacts(bigint, bigint);

CREATE FUNCTION public.merge_contacts(loser_id bigint, winner_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
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

-- Move pg_net extension to extensions schema (security requirement)
-- pg_net doesn't support ALTER EXTENSION SET SCHEMA, so drop and recreate
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

