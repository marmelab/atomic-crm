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

    -- Historical Migration slice: everything below this point is OUTBOUND
    -- HTTP enrichment — get_avatar_for_email() calls gravatar.com and then
    -- the email domain's favicon service. A bulk historical import fires
    -- one lookup per imported Contact, transmitting a hash of each real
    -- person's email address to third parties purely to decorate
    -- back-filled records (Gate A measured 271 such lookups). Migration
    -- mode skips the network enrichment ONLY: avatar is simply left null,
    -- to be filled by any later ordinary save. Every database-local
    -- contact invariant is untouched — sales_id defaulting and email
    -- lowercasing are their own separate triggers and still run. See
    -- set_historical_migration_mode()'s header for why this GUC is safe.
    if current_setting('app.migration_mode', true) = 'true' then
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

CREATE OR REPLACE FUNCTION "public"."handle_deal_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_offer offers%ROWTYPE;
  v_cohort_offer_id bigint;
  v_contact contacts%ROWTYPE;
  v_option_offer_id bigint;
  v_option_pricing_mode text;
  v_rows int;
begin
  -- Payment-authority guard (Go-Live Blocker: Won Payment Authority slice):
  -- handle_deal_won()'s own AFTER trigger unconditionally creates a real
  -- Enrollment, onboarding checklist/Tasks, and (for scholarship pricing)
  -- consumes a real scholarship slot the instant stage becomes 'won' — with
  -- no other check on how it got there. Won must only ever be reached via a
  -- successful Stripe payment (stripe_webhook/index.ts, which writes
  -- through supabaseAdmin using the service_role key — see that function's
  -- own header). auth.role() reflects the verified PostgREST JWT's `role`
  -- claim: 'service_role' for the real webhook, 'authenticated' for an
  -- ordinary CRM user, and NULL for a direct database/migration connection
  -- that never went through PostgREST at all (trusted recovery/admin
  -- context — deliberately still permitted, per that path's own need to
  -- correct data by hand). An ordinary authenticated CRM user must never be
  -- able to fabricate a successful purchase merely by editing a Deal.
  if new.stage = 'won'
     and (tg_op = 'INSERT' or old.stage is distinct from 'won')
     and auth.role() is not null
     and auth.role() <> 'service_role'
  then
    raise exception 'Deal % cannot be set to Won directly — Won is only reached via a successful Stripe payment', new.id;
  end if;

  select * into v_offer from offers where id = new.offer_id;
  if v_offer.id is null then
    raise exception 'Invalid offer_id %', new.offer_id;
  end if;

  if new.cohort_id is not null then
    select offer_id into v_cohort_offer_id from cohorts where id = new.cohort_id;
    if v_cohort_offer_id is null then
      raise exception 'Invalid cohort_id %', new.cohort_id;
    end if;
    if v_offer.type <> 'group' then
      raise exception 'cohort_id can only be set on a group offer (offer_id %)', new.offer_id;
    end if;
    if v_cohort_offer_id <> new.offer_id then
      raise exception 'cohort_id % does not belong to offer_id %', new.cohort_id, new.offer_id;
    end if;
  end if;

  -- Historical Migration slice: everything from here to the matching end if
  -- is live scholarship CONTROL — who may grant it, when, and who holds the
  -- Offer's single slot. An import states what was already true and claims
  -- no live capacity, so it is skipped wholesale under migration mode. See
  -- set_historical_migration_mode()'s own header for why this GUC check is
  -- safe, and handle_deal_won() for the identical treatment of its own
  -- side effects.
  if current_setting('app.migration_mode', true) is distinct from 'true' then
    -- Scholarship Pricing + Capacity slice: pricing_mode is frozen the
    -- instant a Deal reaches Won, exactly like every other commercial
    -- snapshot field below — never editable again afterward.
    if tg_op = 'UPDATE' and old.stage = 'won' and new.pricing_mode is distinct from old.pricing_mode then
      raise exception 'Cannot change pricing_mode on deal % once it has reached Won', new.id;
    end if;

    -- Scholarship can only ever be granted via an explicit Deal edit (Leif
    -- toggling an EXISTING Opportunity), never at creation — this also
    -- sidesteps needing new.id (not yet populated in a BEFORE INSERT
    -- trigger for a generated-identity primary key) for the slot claim below.
    if tg_op = 'INSERT' and new.pricing_mode = 'scholarship' then
      raise exception 'A new Opportunity cannot be created directly as scholarship — grant scholarship pricing via Deal edit after creation';
    end if;

    -- A scholarship Deal's held slot is scoped to its CURRENT offer_id — never
    -- silently re-scope a held reservation to a different Offer. Release the
    -- scholarship first, then move offer_id, then re-grant if still desired.
    if tg_op = 'UPDATE'
       and old.pricing_mode = 'scholarship'
       and new.offer_id is distinct from old.offer_id
    then
      raise exception 'Cannot change offer_id on deal % while it holds a scholarship reservation — release scholarship pricing first', new.id;
    end if;

    if tg_op = 'UPDATE' and new.pricing_mode is distinct from old.pricing_mode then
      if new.pricing_mode = 'scholarship' then
        if v_offer.scholarship_price is null then
          raise exception 'Offer % has no scholarship price configured', new.offer_id;
        end if;

        -- Atomic grant: claims this Offer's single scholarship_slots row for
        -- this Deal. The INSERT ... ON CONFLICT DO UPDATE ... WHERE guard is
        -- Postgres's native compare-and-swap — the row lock taken while
        -- evaluating the conflicting row serializes two concurrent grant
        -- attempts for the same Offer automatically; whichever commits first
        -- wins outright, the other's WHERE fails to match (0 rows), detected
        -- below via GET DIAGNOSTICS and turned into a clean rejection of the
        -- whole write. No app-level check-then-act gap.
        insert into scholarship_slots (offer_id, holder_deal_id, reserved_at)
        values (new.offer_id, new.id, now())
        on conflict (offer_id) do update
          set holder_deal_id = excluded.holder_deal_id,
              reserved_at = excluded.reserved_at
          where scholarship_slots.holder_deal_id is null
            and scholarship_slots.holder_enrollment_id is null;
        get diagnostics v_rows = row_count;
        if v_rows = 0 then
          raise exception 'Scholarship slot for offer % is already held', new.offer_id;
        end if;

        insert into scholarship_slot_events (offer_id, deal_id, event_type, occurred_at)
        values (new.offer_id, new.id, 'scholarship_granted', now());
      elsif old.pricing_mode = 'scholarship' then
        -- Release: only valid pre-Won (the immutability guard above already
        -- rejected this branch once Won), so this exact Deal is guaranteed to
        -- still be the slot's holder_deal_id if it ever held one.
        update scholarship_slots
          set holder_deal_id = null, reserved_at = null, updated_at = now()
          where offer_id = old.offer_id and holder_deal_id = new.id;

        insert into scholarship_slot_events (offer_id, deal_id, event_type, occurred_at)
        values (old.offer_id, new.id, 'scholarship_released', now());
      end if;
    end if;
  end if;

  -- Snapshot commercial info at save time so a later Offer/payment-option
  -- change never rewrites historical sales context on an existing
  -- Opportunity. Sources from scholarship_price instead of current_price
  -- when pricing_mode is 'scholarship' — offer_name_snapshot itself never
  -- encodes pricing mode (pricing_mode carries that identity instead).
  if tg_op = 'INSERT'
     or new.offer_id is distinct from old.offer_id
     or new.pricing_mode is distinct from old.pricing_mode
  then
    new.offer_name_snapshot := v_offer.name;
    new.offer_price_snapshot := case
      when new.pricing_mode = 'scholarship' then v_offer.scholarship_price
      else v_offer.current_price
    end;
  end if;

  if new.selected_payment_option_id is not null
     and (tg_op = 'INSERT'
          or new.selected_payment_option_id is distinct from old.selected_payment_option_id
          or new.pricing_mode is distinct from old.pricing_mode)
  then
    select offer_id, pricing_mode, total, installments, installment_amount
      into v_option_offer_id, v_option_pricing_mode,
           new.selected_payment_total, new.selected_installment_count, new.selected_installment_amount
      from offer_payment_options
      where id = new.selected_payment_option_id;

    if v_option_offer_id is null then
      raise exception 'Invalid selected_payment_option_id %', new.selected_payment_option_id;
    end if;
    -- Scholarship Pricing + Capacity slice: a payment option must always
    -- match this Deal's own offer/pricing mode — never accidentally
    -- selectable across offers or across standard/scholarship (the UI
    -- already scopes the choices it offers; this is the authoritative
    -- backstop).
    if v_option_offer_id <> new.offer_id or v_option_pricing_mode <> new.pricing_mode then
      raise exception 'Payment option % does not match deal %''s offer/pricing_mode', new.selected_payment_option_id, new.id;
    end if;
  end if;

  -- The Opportunity's name is always derived from its Contact, never
  -- user-typed (Programs + Opportunity UX slice, §1): this is what makes it
  -- structurally impossible for an Opportunity to display one person while
  -- being linked to another.
  select * into v_contact from contacts where id = new.contact_id;
  if v_contact.id is not null then
    new.name := trim(both ' ' from coalesce(v_contact.first_name, '') || ' ' || coalesce(v_contact.last_name, ''));
  end if;

  return new;
end;
$$;

-- Validates the Offer/Cohort relationship on a Waitlist Entry (Waitlists
-- slice, §3) — mirrors the same rule handle_deal_saved() enforces for
-- Opportunities: a Cohort is only ever set on a group Offer, and only to a
-- Cohort that actually belongs to it.
CREATE OR REPLACE FUNCTION "public"."handle_waitlist_entry_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_offer offers%ROWTYPE;
  v_cohort_offer_id bigint;
begin
  select * into v_offer from offers where id = new.offer_id;
  if v_offer.id is null then
    raise exception 'Invalid offer_id %', new.offer_id;
  end if;

  if new.cohort_id is not null then
    select offer_id into v_cohort_offer_id from cohorts where id = new.cohort_id;
    if v_cohort_offer_id is null then
      raise exception 'Invalid cohort_id %', new.cohort_id;
    end if;
    if v_offer.type <> 'group' then
      raise exception 'cohort_id can only be set on a group offer (offer_id %)', new.offer_id;
    end if;
    if v_cohort_offer_id <> new.offer_id then
      raise exception 'cohort_id % does not belong to offer_id %', new.cohort_id, new.offer_id;
    end if;
  end if;

  return new;
end;
$$;

-- Historical Migration slice: the one deliberately narrow entry point that
-- may enable app.migration_mode for the CURRENT transaction only (the
-- is_local=true third argument to set_config is what makes it reset
-- automatically on COMMIT or ROLLBACK — never a session-wide or database-
-- wide setting, never persists past the transaction that set it).
--
-- SECURITY DEFINER + a pinned search_path so this can't be tricked by a
-- caller-controlled search_path into resolving set_config from anywhere
-- but pg_catalog. The internal auth.role() check mirrors handle_deal_saved()'s
-- own Won-authority guard exactly: NULL (a direct database/migration
-- connection that never went through PostgREST) is the trusted admin
-- context this whole historical-import mechanism is built for; a real
-- 'authenticated' PostgREST caller is explicitly rejected even if grants
-- were ever accidentally widened later — defense in depth on top of the
-- REVOKE in 06_grants.sql, not instead of it.
--
-- This function does nothing else — it does not itself write any business
-- data. The historical importer calls this to turn migration mode on,
-- performs its own plain INSERT/UPDATE statements (still running as
-- service_role) inside the same transaction, then calls this again to turn
-- it off before COMMIT (belt-and-suspenders: COMMIT already resets it on
-- its own).
CREATE OR REPLACE FUNCTION "public"."set_historical_migration_mode"("enable" boolean) RETURNS "void"
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception 'set_historical_migration_mode() is restricted to a service_role/direct-connection context';
  end if;
  perform set_config('app.migration_mode', case when enable then 'true' else 'false' end, true);
end;
$$;

CREATE OR REPLACE FUNCTION public.handle_deal_won()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_cohort cohorts%ROWTYPE;
  v_enrollment_id bigint;
begin
  -- A historical Won Deal must never fire live onboarding: the importer
  -- inserts the truthful final-state Enrollment itself. Only
  -- set_historical_migration_mode() can set this GUC, transaction-locally.
  if current_setting('app.migration_mode', true) = 'true' then
    return new;
  end if;

  if new.stage = 'won' and (tg_op = 'INSERT' or old.stage is distinct from 'won') then
    if new.cohort_id is not null then
      select * into v_cohort from cohorts where id = new.cohort_id;
    end if;

    -- Idempotent: the unique constraint on enrollments.opportunity_id means
    -- re-saving Won never creates a duplicate. `returning ... into` only
    -- assigns on a genuine insert, so the block below stays replay-safe.
    insert into enrollments (opportunity_id, status, start_date, end_date, onboarding_tracking)
    values (
      new.id,
      'onboarding',
      v_cohort.program_start_at::date,
      v_cohort.program_end_at::date,
      -- A sale made today is tracked. legacy_untracked is only ever a
      -- statement about the past, never a default for new work.
      'tracked'
    )
    on conflict (opportunity_id) do nothing
    returning id into v_enrollment_id;

    if v_enrollment_id is not null then
      perform public.seed_enrollment_onboarding(v_enrollment_id);

      -- Scholarship slot occupancy moves from Deal to Enrollment in the
      -- same transaction, so the slot is never observably free between the
      -- two.
      if new.pricing_mode = 'scholarship' then
        update scholarship_slots
           set holder_deal_id = null, holder_enrollment_id = v_enrollment_id, updated_at = now()
         where offer_id = new.offer_id and holder_deal_id = new.id;
        if not found then
          raise exception 'Deal % reached Won as scholarship but held no scholarship slot for offer % — data inconsistency', new.id, new.offer_id;
        end if;

        insert into scholarship_slot_events (offer_id, deal_id, enrollment_id, event_type, occurred_at)
        values (new.offer_id, new.id, v_enrollment_id, 'deal_converted_to_enrollment', now());
      end if;
    end if;
  end if;
  return new;
end;
$function$
;

-- Scholarship Pricing + Capacity slice: the other half of the atomic
-- grant/convert/release lifecycle (see handle_deal_saved()/handle_deal_won()
-- for the Deal-side grant/release/convert steps) — releases the slot the
-- instant an Enrollment genuinely completes (a completed Enrollment never
-- occupies capacity, exactly like every other Enrollment-capacity
-- convention in this schema), and handles the one remaining transition:
-- a backward lifecycle correction OFF of completed (enforce_enrollment_
-- lifecycle_sequence() already allows backward corrections generally) must
-- attempt to RECLAIM the slot rather than silently leaving the Enrollment
-- "current" again with no capacity accounting. If another Deal/Enrollment
-- has since claimed that Offer's slot, the correction is rejected outright
-- (raising here aborts the whole enrollments UPDATE, same as any other
-- guard trigger in this schema) — never silently displacing another
-- holder. Only ever touches offers this Enrollment's own Deal was actually
-- granted scholarship pricing for; a standard Enrollment's lifecycle
-- changes never reach the scholarship_slots table at all.
CREATE OR REPLACE FUNCTION "public"."handle_enrollment_scholarship_slot_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_offer_id bigint;
  v_rows int;
begin
  if new.status is distinct from old.status then
    if new.status = 'completed' then
      update scholarship_slots
        set holder_enrollment_id = null, updated_at = now()
        where holder_enrollment_id = new.id;
      if found then
        select offer_id into v_offer_id from deals where id = new.opportunity_id;
        insert into scholarship_slot_events (offer_id, enrollment_id, event_type, occurred_at)
        values (v_offer_id, new.id, 'enrollment_completed_slot_released', now());
      end if;
    elsif old.status = 'completed' then
      select offer_id into v_offer_id
        from deals
        where id = new.opportunity_id and pricing_mode = 'scholarship';

      if v_offer_id is not null then
        insert into scholarship_slots (offer_id, holder_enrollment_id, reserved_at)
        values (v_offer_id, new.id, now())
        on conflict (offer_id) do update
          set holder_enrollment_id = excluded.holder_enrollment_id,
              reserved_at = excluded.reserved_at
          where scholarship_slots.holder_deal_id is null
            and scholarship_slots.holder_enrollment_id is null;
        get diagnostics v_rows = row_count;
        if v_rows = 0 then
          raise exception 'Cannot reopen enrollment %: scholarship slot for offer % is already held by another Deal/Enrollment', new.id, v_offer_id;
        end if;

        insert into scholarship_slot_events (offer_id, enrollment_id, event_type, occurred_at)
        values (v_offer_id, new.id, 'slot_reclaimed_after_backward_lifecycle_correction', now());
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Contracts + Onboarding slice: Task -> business-context integrity. A Task
-- pointing at a specific checklist item must always also point at that
-- item's own Enrollment (never onboarding_item_id set with a mismatched or
-- missing enrollment_id) — cheap to enforce here rather than trusting every
-- future insert/update call site to get both columns right by hand.
-- Client Offboarding slice: extended with the identical check for
-- offboarding_item_id — same integrity requirement, same reasoning, one
-- shared function rather than a near-duplicate second trigger function.
CREATE OR REPLACE FUNCTION "public"."set_task_enrollment_id_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_item_enrollment_id bigint;
begin
  if new.onboarding_item_id is not null then
    select enrollment_id into v_item_enrollment_id
      from enrollment_onboarding_items where id = new.onboarding_item_id;
    if v_item_enrollment_id is null then
      raise exception 'Invalid onboarding_item_id %', new.onboarding_item_id;
    end if;
    if new.enrollment_id is null then
      new.enrollment_id := v_item_enrollment_id;
    elsif new.enrollment_id <> v_item_enrollment_id then
      raise exception 'enrollment_id % does not match onboarding_item_id %''s own enrollment_id %',
        new.enrollment_id, new.onboarding_item_id, v_item_enrollment_id;
    end if;
  end if;
  if new.offboarding_item_id is not null then
    select enrollment_id into v_item_enrollment_id
      from enrollment_offboarding_items where id = new.offboarding_item_id;
    if v_item_enrollment_id is null then
      raise exception 'Invalid offboarding_item_id %', new.offboarding_item_id;
    end if;
    if new.enrollment_id is null then
      new.enrollment_id := v_item_enrollment_id;
    elsif new.enrollment_id <> v_item_enrollment_id then
      raise exception 'enrollment_id % does not match offboarding_item_id %''s own enrollment_id %',
        new.enrollment_id, new.offboarding_item_id, v_item_enrollment_id;
    end if;
  end if;
  return new;
end;
$$;

-- Contracts + Onboarding slice: the Task -> checklist-item half of the
-- two-way sync (architecture review, §8). Fires whenever a Task pointing
-- at a specific item transitions its done-ness in either direction —
-- completing (or reopening) the Task marks that ONE item done (or
-- reopens it back to pending). Deliberately does NOT run the other way
-- (a cancelled Task never completes its item, and never reverts a
-- directly-completed item to pending) — the checklist item is the
-- durable source of truth Leif approved; a Task is only ever a reminder.
-- The reverse direction (completing an item directly also completes its
-- linked Task) is application-layer (completeOnboardingItem.ts) rather
-- than a second DB trigger — checklist items only have one write surface
-- in this slice, so there's no "many entry points" risk to guard against
-- at the DB level the way Task edits (checkbox, edit sheet, mobile list)
-- already have.
CREATE OR REPLACE FUNCTION "public"."sync_onboarding_item_from_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.onboarding_item_id is null then
    return new;
  end if;

  if new.done_date is not null and old.done_date is null then
    update enrollment_onboarding_items
      set status = 'done', completed_at = coalesce(completed_at, new.done_date), updated_at = now()
      where id = new.onboarding_item_id and status <> 'done';
  elsif new.done_date is null and old.done_date is not null then
    update enrollment_onboarding_items
      set status = 'pending', completed_at = null, updated_at = now()
      where id = new.onboarding_item_id and status = 'done';
  end if;

  return new;
end;
$$;

-- Client Offboarding slice, §1: the fulfillment lifecycle is a strict
-- sequence (onboarding -> active -> offboarding -> completed) — nothing
-- may skip a stage, whether written through a guarded domain function
-- (activateEnrollment.ts/startOffboarding.ts/completeClient.ts already
-- each only accept one specific FROM status, so they can never produce a
-- skip) or directly through ClientEdit.tsx's plain status field (the
-- same "direct write path" gap enforce_enrollment_activation_requirements
-- below already closes for its own narrower transition). Rank-based
-- rather than an enumerated list of forbidden pairs, so it stays correct
-- automatically if a stage is ever inserted into the sequence. Backward
-- corrections (completed -> active, offboarding -> onboarding, etc.) are
-- deliberately NOT rejected here — same "a manual correction stays
-- ungated" precedent as the activation guard below; only a FORWARD skip
-- (new rank more than one ahead of old rank) is nonsensical.
CREATE OR REPLACE FUNCTION "public"."enforce_enrollment_lifecycle_sequence"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_old_rank int;
  v_new_rank int;
begin
  -- Terminal exits are reachable from anywhere; only the fulfillment
  -- sequence itself can be skipped.
  if new.status in ('withdrawn', 'ended') then
    return new;
  end if;

  v_old_rank := case old.status
    when 'onboarding' then 0
    when 'active' then 1
    when 'offboarding' then 2
    when 'completed' then 3
  end;
  v_new_rank := case new.status
    when 'onboarding' then 0
    when 'active' then 1
    when 'offboarding' then 2
    when 'completed' then 3
  end;
  if v_new_rank > v_old_rank + 1 then
    raise exception 'Cannot transition enrollment % directly from % to % — the fulfillment lifecycle (onboarding -> active -> offboarding -> completed) cannot skip a stage', new.id, old.status, new.status;
  end if;
  return new;
end;
$$;

-- Contracts + Onboarding slice: the DB-level half of the Onboarding ->
-- Active guard (architecture review, §6). activateEnrollment.ts is the
-- normal write path and already checks this before writing, but
-- ClientEdit.tsx's plain status field (and any direct API write) goes
-- through this same table — this closes that gap rather than trusting
-- every future write path to remember the invariant. Only guards the
-- onboarding -> active direction; a manual correction back to onboarding
-- stays ungated.
CREATE OR REPLACE FUNCTION public.enforce_enrollment_activation_requirements()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_required int;
  v_outstanding int;
begin
  if new.status is distinct from 'active' or old.status is not distinct from 'active' then
    return new;
  end if;

  -- The historical importer writes truthful final states directly and must
  -- not be forced through a live checklist it is not describing. Only
  -- set_historical_migration_mode() can set this, and only for one
  -- transaction.
  if current_setting('app.migration_mode', true) = 'true' then
    return new;
  end if;

  if new.onboarding_tracking = 'legacy_untracked' then
    return new;
  end if;

  select count(*) filter (where is_required),
         count(*) filter (where is_required and status <> 'done')
    into v_required, v_outstanding
    from enrollment_onboarding_items
   where enrollment_id = new.id;

  if v_required = 0 then
    raise exception 'Cannot activate enrollment %: it is tracked but has no required onboarding items. Either its Offer has no active onboarding templates, or seeding did not run. An empty checklist is not a finished one.', new.id
      using hint = 'Seed it with seed_enrollment_onboarding(), or record it as legacy_untracked if its onboarding genuinely happened outside the CRM.';
  end if;

  if v_outstanding > 0 then
    raise exception 'Cannot activate enrollment %: % of % required onboarding items are not done', new.id, v_outstanding, v_required;
  end if;

  return new;
end;
$function$
;

-- Client Offboarding slice: mirrors handle_deal_won()'s own checklist +
-- Task seeding exactly, but fires on the Enrollment's own active ->
-- offboarding transition rather than a Deal event (offboarding is a
-- fulfillment-lifecycle concern, never a sales-stage one — Won stays
-- terminal sales state). AFTER trigger, so it only fires once the
-- transition is genuinely committed; guarded to the exact transition
-- (old.status = 'active' and new.status = 'offboarding'), so it can never
-- re-fire for an unrelated field edit or a later manual correction, and a
-- duplicate "Start offboarding" write (already offboarding) is a safe
-- no-op the same way handle_deal_won()'s ON CONFLICT DO NOTHING is —
-- Postgres's own row-level locking during the UPDATE means a genuine
-- concurrent double-click race still only ever sees one row transition
-- through old.status = 'active' exactly once.
CREATE OR REPLACE FUNCTION "public"."handle_enrollment_offboarding_started"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_offer_id bigint;
  v_contact_id bigint;
  v_contact_name text;
  v_item record;
begin
  if new.status = 'offboarding' and old.status = 'active' then
    select d.offer_id, d.contact_id into v_offer_id, v_contact_id
      from deals d where d.id = new.opportunity_id;

    select trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
      into v_contact_name
      from contacts where id = v_contact_id;
    if v_contact_name is null or v_contact_name = '' then
      select name into v_contact_name from deals where id = new.opportunity_id;
    end if;

    -- Zero configured requirements for this Offer is a valid, explicit
    -- state (Client Offboarding slice, §5) — the loop below simply
    -- inserts nothing and no Task is created, rather than manufacturing
    -- a fake requirement.
    for v_item in
      insert into enrollment_offboarding_items
        (enrollment_id, requirement_key, label, task_text_template, is_required, sort_order)
      select new.id, t.key, t.label, t.task_text_template, t.is_required, t.sort_order
      from offboarding_requirement_templates t
      where t.offer_id = v_offer_id and t.is_active
      returning id, is_required, task_text_template
    loop
      if v_item.is_required then
        insert into tasks (contact_id, type, text, due_date, status, enrollment_id, offboarding_item_id)
        values (
          v_contact_id,
          'offboarding_item',
          replace(v_item.task_text_template, '{name}', v_contact_name),
          now() + interval '3 days',
          'pending',
          new.id,
          v_item.id
        );
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- Client Offboarding slice: the offboarding mirror of
-- sync_onboarding_item_from_task() — identical Task -> checklist-item
-- sync semantics (a cancelled Task never completes its item; the
-- checklist item stays the durable source of truth), scoped to
-- offboarding_item_id instead.
CREATE OR REPLACE FUNCTION "public"."sync_offboarding_item_from_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.offboarding_item_id is null then
    return new;
  end if;

  if new.done_date is not null and old.done_date is null then
    update enrollment_offboarding_items
      set status = 'done', completed_at = coalesce(completed_at, new.done_date), updated_at = now()
      where id = new.offboarding_item_id and status <> 'done';
  elsif new.done_date is null and old.done_date is not null then
    update enrollment_offboarding_items
      set status = 'pending', completed_at = null, updated_at = now()
      where id = new.offboarding_item_id and status = 'done';
  end if;

  return new;
end;
$$;

-- Client Offboarding slice: the DB-level half of the Offboarding ->
-- Completed guard, mirroring enforce_enrollment_activation_requirements()
-- exactly — completeClient.ts is the normal write path and already
-- checks this, but ClientEdit.tsx's plain status field (and any other
-- direct write) goes through this same table. Only guards the
-- offboarding -> completed direction; a manual correction back to
-- offboarding (or any other direction) stays ungated.
CREATE OR REPLACE FUNCTION "public"."enforce_enrollment_completion_requirements"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'completed' and old.status = 'offboarding' then
    if exists (
      select 1 from enrollment_offboarding_items
      where enrollment_id = new.id and is_required and status <> 'done'
    ) then
      raise exception 'Cannot complete enrollment %: required offboarding items incomplete', new.id;
    end if;
  end if;
  return new;
end;
$$;

-- Client Offboarding slice: the smallest append-only audit trail for
-- Enrollment lifecycle transitions — mirrors record_deal_stage_event()'s
-- own guard shape (INSERT or a genuine status change), minus the
-- BEFORE-trigger companion deal_stage_events needs for its own
-- denormalized stage_entered_at column (enrollments has no equivalent to
-- keep in sync, so `now()` directly in this one AFTER trigger is
-- sufficient — NEW.id is already populated by the time an AFTER INSERT
-- trigger fires, unlike deals' own BEFORE-trigger constraint).
CREATE OR REPLACE FUNCTION "public"."record_enrollment_status_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  -- Historical Migration slice: enrollments has no per-status timestamp
  -- column of its own to source a truthful entered_at from (unlike deals'
  -- stage_entered_at), so there is nothing safe to substitute here — the
  -- importer inserts the correct, truthful enrollment_status_events row(s)
  -- itself, directly, with the real historical date(s). See
  -- set_historical_migration_mode()'s own header.
  if current_setting('app.migration_mode', true) = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into enrollment_status_events (enrollment_id, status, entered_at)
    values (new.id, new.status, now());
  end if;
  return new;
end;
$$;

-- Acuity/Sales Call Lifecycle slice: keeps deals.sales_call_at (the
-- existing "next scheduled call" denormalized convenience field, read by
-- DealShow/DealInputs unchanged) in sync with sales_calls, the new source
-- of truth. Recomputes from scratch on every insert/update/delete rather
-- than trying to track "was this row the one currently reflected" —
-- always the scheduled_at of the Opportunity's most recent still-booked
-- call, or null if none. Mirrors providers/fakerest/dataProvider.ts's own
-- "sales_calls" resource hooks (dual-implementation convention).
CREATE OR REPLACE FUNCTION "public"."sync_deal_sales_call_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_opportunity_id bigint;
  v_latest timestamptz;
begin
  v_opportunity_id := coalesce(new.opportunity_id, old.opportunity_id);
  if v_opportunity_id is null then
    return coalesce(new, old);
  end if;

  select sc.scheduled_at into v_latest
    from sales_calls sc
   where sc.opportunity_id = v_opportunity_id
     and sc.status = 'booked'
     and sc.schedule_precision = 'exact'
   order by sc.scheduled_at desc
   limit 1;

  update deals
     set sales_call_at = v_latest
   where id = v_opportunity_id
     and sales_call_at is distinct from v_latest;

  return coalesce(new, old);
end;
$$;

-- Kanban queue-ordering slice: sets deals.stage_entered_at to "now" exactly
-- once per genuine stage change (mirrors handle_deal_won()'s own
-- tg_op/is-distinct-from guard so it is safe on both INSERT and UPDATE,
-- and never re-fires for an unrelated field edit, a note, or metadata
-- change on the same row). BEFORE trigger so the new value lands in the
-- same row write instead of a second UPDATE.
CREATE OR REPLACE FUNCTION "public"."set_deal_stage_entered_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  -- Historical Migration slice: preserve the caller-supplied historical
  -- stage_entered_at verbatim instead of overwriting it with now() — see
  -- set_historical_migration_mode()'s own header.
  if current_setting('app.migration_mode', true) = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_entered_at := now();
  end if;
  return new;
end;
$$;

-- Companion AFTER trigger: appends the permanent deal_stage_events row for
-- the same genuine stage change set_deal_stage_entered_at() just recorded.
-- Split into BEFORE/AFTER (rather than one trigger) because NEW.id is not
-- yet populated for a GENERATED BY DEFAULT AS IDENTITY primary key inside
-- a BEFORE INSERT trigger; this AFTER trigger runs once the row (and its
-- id) is committed. Guard is identical to set_deal_stage_entered_at()'s so
-- the two can never disagree about what counts as a genuine transition.
CREATE OR REPLACE FUNCTION "public"."record_deal_stage_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into deal_stage_events (opportunity_id, stage, entered_at)
    values (new.id, new.stage, new.stage_entered_at);
  end if;
  return new;
end;
$$;

-- Human-acceptance repair pass, §4/§5: a Contact cannot stay Waiting/
-- Invited for a relationship they already have an active Opportunity for
-- (mirrors src/components/atomic-crm/waitlist/waitlistSync.ts exactly —
-- keep both in sync). "Active" = not archived and no exit outcome
-- (needs_higher_care/not_fit/nurture/lost); Won counts as active here too,
-- since it is certainly not "still waiting". Compatible = same Contact +
-- Offer, and either the Waitlist Entry is cohort-specific and matches this
-- Deal's own cohort exactly, or it is offer-level (cohort_id null — "I
-- want this generally") and therefore satisfied by ANY cohort of that
-- Offer. Runs AFTER (like handle_deal_won()) so it only fires once the
-- deals row is committed.
CREATE OR REPLACE FUNCTION "public"."handle_deal_waitlist_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.archived_at is null and new.outcome is null then
    update waitlist_entries
    set status = 'converted',
        converted_at = now(),
        converted_opportunity_id = new.id
    where contact_id = new.contact_id
      and offer_id = new.offer_id
      and status in ('waiting', 'invited')
      and (cohort_id is null or cohort_id = new.cohort_id);
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  sales_count int;
begin
  select count(id) into sales_count
  from public.sales;

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
    select 1 from public.sales where user_id = auth.uid() and administrator = true
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

  -- 3. Reassign opportunities from loser to winner (single contact_id FK)
  UPDATE deals SET contact_id = winner_id WHERE contact_id = loser_id;

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

-- Application Intake Atomicity + Idempotency slice: the single
-- server-authoritative transactional operation for the public application
-- intake path (mirrors, and is called by, supabase/functions/
-- public_application/index.ts's handleSubmit — see that file's header for
-- the caller-side validation it still does BEFORE calling this: honeypot,
-- name/email/answer-length checks, and full offer/cohort existence + open-
-- window validation, none of which needs to be inside this transaction
-- since a rejection there means zero calls into this function at all).
--
-- Root-cause fix for the known intake gap: the previous implementation
-- issued Contact -> Deal -> (Waitlist sync) -> Application -> Task as
-- separate PostgREST round-trips with no shared transaction. A failure
-- between any two steps left durable partial state (e.g. a bare Contact,
-- or worse: an Application with no Review Task that NO retry could ever
-- fix, because the exact-answers-match fast path above short-circuits
-- before ever re-attempting Task creation). Wrapping the whole sequence in
-- one PL/pgSQL function call gives it Postgres's own transaction boundary
-- for free: any exception anywhere below rolls back every write this
-- function made, so the only two possible outcomes are "fully applied" or
-- "nothing happened" — never a partial result a retry can't repair.
--
-- Idempotency key: deliberately the request's own natural business key
-- (normalized email, offer_id, cohort_id) plus a value-equality check on
-- the answers themselves — not a generated/random idempotency token. A
-- token tied to one browser/session would fail to recognize a genuine
-- resubmission from a different device as the same logical application;
-- the natural key already does, and is exactly what findActiveDeal /
-- findPendingApplication / answersEqual already used before this change.
--
-- Concurrency: an advisory transaction lock keyed by the normalized email
-- serializes two near-simultaneous submissions for the same applicant
-- (there is no unique constraint on an email inside contacts.email_jsonb
-- to lean on instead — introducing one is a larger, separate schema change
-- this slice deliberately does not force). Released automatically at
-- transaction end; never held past this call.
--
-- Security: SECURITY INVOKER (not DEFINER) — this function is reachable
-- ONLY via service_role (see 06_grants.sql: EXECUTE is revoked from
-- anon/authenticated entirely, tighter than every other callable function
-- in this file, merge_contacts included). service_role already bypasses
-- RLS on its own; DEFINER semantics would only add unneeded owner-
-- privilege elevation. The public HTTP surface remains exactly
-- public_application/index.ts — this function is not a new public
-- capability, it's the existing one made atomic.
CREATE OR REPLACE FUNCTION public.submit_public_application(p_offer_id bigint, p_cohort_id bigint, p_first_name text, p_last_name text, p_email text, p_phone text, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(p_email));
  v_contact contacts%ROWTYPE;
  v_is_dne boolean;
  v_deal deals%ROWTYPE;
  v_deal_reused boolean := false;
  v_pending_app applications%ROWTYPE;
  v_answers_match boolean := false;
  v_application_id bigint;
  v_existing_application_id bigint;
  v_sales_id bigint;
  v_has_pending_task boolean;
  v_applicant_name text;
BEGIN
  IF p_offer_id IS NULL THEN
    RAISE EXCEPTION 'offer_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF coalesce(trim(p_first_name), '') = '' OR coalesce(trim(p_last_name), '') = '' THEN
    RAISE EXCEPTION 'name_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_email = '' THEN
    RAISE EXCEPTION 'email_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM offers WHERE id = p_offer_id AND is_active) THEN
    RAISE EXCEPTION 'offer_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_cohort_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM cohorts WHERE id = p_cohort_id AND offer_id = p_offer_id
  ) THEN
    RAISE EXCEPTION 'cohort_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('submit_public_application:' || v_email));

  SELECT * INTO v_contact
  FROM contacts c
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(c.email_jsonb, '[]'::jsonb)) AS e
    WHERE lower(trim(e ->> 'email')) = v_email
  )
  ORDER BY c.id ASC
  LIMIT 1;

  v_is_dne := v_contact.id IS NOT NULL AND v_contact.sales_eligibility = 'do_not_engage';

  IF v_contact.id IS NOT NULL AND NOT v_is_dne THEN
    SELECT * INTO v_deal
    FROM deals d
    WHERE d.contact_id = v_contact.id
      AND d.offer_id = p_offer_id
      AND (p_cohort_id IS NULL OR d.cohort_id = p_cohort_id)
      AND d.archived_at IS NULL
      AND d.stage <> 'won'
      AND d.outcome IS NULL
    ORDER BY d.id ASC
    LIMIT 1;
  END IF;

  IF v_deal.id IS NOT NULL THEN
    SELECT * INTO v_pending_app
    FROM applications a
    WHERE a.opportunity_id = v_deal.id
    ORDER BY a.id DESC
    LIMIT 1;
    IF v_pending_app.id IS NOT NULL AND v_pending_app.status <> 'pending' THEN
      v_pending_app := NULL;
    END IF;
  END IF;

  IF v_pending_app.id IS NOT NULL THEN
    v_answers_match := p_answers = v_pending_app.raw_answers;
  END IF;

  IF v_contact.id IS NOT NULL AND NOT v_is_dne THEN
    SELECT EXISTS (
      SELECT 1 FROM tasks
      WHERE contact_id = v_contact.id
        AND type = 'review_application'
        AND done_date IS NULL
    ) INTO v_has_pending_task;
  END IF;

  IF v_pending_app.id IS NOT NULL AND v_answers_match AND coalesce(v_has_pending_task, false) THEN
    RETURN jsonb_build_object(
      'status', 'submitted',
      'application_id', v_pending_app.id,
      'dne_auto_resolved', false
    );
  END IF;

  IF v_contact.id IS NOT NULL THEN
    UPDATE contacts SET last_seen = now() WHERE id = v_contact.id RETURNING * INTO v_contact;
  ELSE
    INSERT INTO contacts (
      first_name, last_name, email_jsonb, phone_jsonb, tags,
      has_newsletter, first_seen, last_seen, sales_eligibility
    ) VALUES (
      p_first_name, p_last_name,
      jsonb_build_array(jsonb_build_object('email', p_email, 'type', 'Other')),
      CASE WHEN coalesce(p_phone, '') <> ''
        THEN jsonb_build_array(jsonb_build_object('number', p_phone, 'type', 'Other'))
        ELSE '[]'::jsonb
      END,
      ARRAY[]::bigint[],
      false, now(), now(), 'normal'
    ) RETURNING * INTO v_contact;
  END IF;

  IF v_deal.id IS NULL THEN
    INSERT INTO deals (
      contact_id, offer_id, cohort_id, stage, outcome, owner_decision,
      amount, entry_path, description
    ) VALUES (
      v_contact.id, p_offer_id, p_cohort_id, 'application_received',
      CASE WHEN v_is_dne THEN 'lost' ELSE NULL END,
      CASE WHEN v_is_dne THEN 'do_not_engage' ELSE NULL END,
      (SELECT current_price FROM offers WHERE id = p_offer_id),
      'application_form', ''
    ) RETURNING * INTO v_deal;
  ELSE
    v_deal_reused := true;
    IF NOT v_is_dne THEN
      UPDATE waitlist_entries
      SET status = 'converted', converted_at = now(), converted_opportunity_id = v_deal.id
      WHERE contact_id = v_deal.contact_id
        AND offer_id = v_deal.offer_id
        AND status IN ('waiting', 'invited')
        AND (cohort_id IS NULL OR cohort_id = v_deal.cohort_id);
    END IF;
  END IF;

  IF v_pending_app.id IS NOT NULL THEN
    UPDATE applications
    SET raw_answers = p_answers, submitted_at = now()
    WHERE id = v_pending_app.id
    RETURNING id INTO v_application_id;
  ELSE
    SELECT a.id INTO v_existing_application_id
    FROM applications a
    WHERE a.opportunity_id = v_deal.id
    ORDER BY a.id DESC
    LIMIT 1;

    IF v_existing_application_id IS NOT NULL THEN
      v_application_id := v_existing_application_id;
    ELSE
      -- Phase 4J: offer_id/intended_cohort_id stamped directly from the
      -- already-validated parameters, never re-derived from v_deal.
      -- Phase 4J: offer_id/intended_cohort_id stamped directly from the
      -- already-validated parameters, never re-derived from v_deal.
      -- Gate A final candidate: contact_id is the Application's canonical
      -- person relationship (the Deal remains the optional Opportunity
      -- relationship), and source marks this as a live submission that
      -- legitimately represents outstanding review work.
      INSERT INTO applications (contact_id, opportunity_id, offer_id, intended_cohort_id, raw_answers, submitted_at, status, reviewed_at, source)
      VALUES (
        v_contact.id, v_deal.id, p_offer_id, p_cohort_id, p_answers, now(),
        CASE WHEN v_is_dne THEN 'do_not_engage' ELSE 'pending' END,
        CASE WHEN v_is_dne THEN now() ELSE NULL END,
        'public_form'
      ) RETURNING id INTO v_application_id;
    END IF;
  END IF;

  IF NOT v_is_dne THEN
    SELECT EXISTS (
      SELECT 1 FROM tasks
      WHERE contact_id = v_contact.id
        AND type = 'review_application'
        AND done_date IS NULL
    ) INTO v_has_pending_task;

    IF FALSE THEN  -- review Tasks are now created only on SLA breach, by reconcile_application_review_tasks()
      SELECT id INTO v_sales_id FROM sales WHERE administrator = true LIMIT 1;
      v_applicant_name := trim(both ' ' from coalesce(v_contact.first_name, '') || ' ' || coalesce(v_contact.last_name, ''));
      INSERT INTO tasks (contact_id, type, text, due_date, status, sales_id)
      VALUES (
        v_contact.id, 'review_application',
        'Review ' || v_applicant_name || '''s application',
        now(), 'pending', v_sales_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', 'submitted',
    'application_id', v_application_id,
    'dne_auto_resolved', v_is_dne
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_sales_call_cancelled(p_sales_call_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_call sales_calls%ROWTYPE;
  v_now timestamptz := now();
  v_deal_returned boolean := false;
  v_tasks_closed int := 0;
begin
  select * into v_call from sales_calls where id = p_sales_call_id for update;
  if not found then
    return jsonb_build_object('status', 'not-found');
  end if;

  -- Never overwrite a call that genuinely happened. Someone attended it;
  -- cancelling it afterwards would erase that.
  if v_call.attendance = 'attended' then
    return jsonb_build_object('status', 'already-attended');
  end if;

  -- 1. The Sales Call is the canonical record of the cancellation.
  --    original_scheduled_at is untouched — when it WAS going to happen is
  --    part of the history. attendance stays exactly as it is: null for a
  --    call that was cancelled before it was due, and a previously recorded
  --    no_show is never rewritten by a later cancellation of a DIFFERENT
  --    call (each call is its own record).
  --    status leaves 'booked', which also frees
  --    sales_calls_one_booked_per_opportunity_idx for a genuine rebooking.
  if v_call.status <> 'cancelled' then
    update sales_calls
       set status = 'cancelled',
           cancelled_at = coalesce(v_call.cancelled_at, v_now),
           updated_at = v_now
     where id = v_call.id;

    insert into sales_call_events (sales_call_id, kind, occurred_at)
    values (v_call.id, 'cancelled', v_now);
  end if;

  -- 2. A task telling Leif to deal with this specific call is no longer
  --    real work. Cancelled rather than completed — nobody did it — using
  --    the status vocabulary tasks already has. done_date is deliberately
  --    left alone: a cancelled task was never done.
  update tasks
     set status = 'cancelled', done_date = v_now
   where sales_call_id = v_call.id
     and status in ('pending', 'waiting');
  get diagnostics v_tasks_closed = row_count;

  -- 3. The Opportunity leaves Call Booked. Only from 'call_booked', and
  --    only while it is still active — a Deal that has since progressed or
  --    exited is not dragged backwards by cancelling an old call.
  --    stage_entered_at is set so record_deal_stage_event() timestamps the
  --    transition as happening now rather than reusing the old value.
  if v_call.opportunity_id is not null then
    update deals
       set stage = 'approved',
           stage_entered_at = v_now,
           updated_at = v_now
     where id = v_call.opportunity_id
       and stage = 'call_booked'
       and outcome is null
       and archived_at is null;
    v_deal_returned := found;
  end if;

  return jsonb_build_object(
    'status', case when v_call.status = 'cancelled' then 'already-cancelled' else 'cancelled' end,
    'sales_call_id', v_call.id,
    'opportunity_id', v_call.opportunity_id,
    'deal_returned_to_approved', v_deal_returned,
    'tasks_closed', v_tasks_closed,
    -- Reported so a caller can be explicit that nothing was decided about
    -- pursuing this person.
    'outcome_left_undecided', true
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_sales_call_no_show(p_sales_call_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_call sales_calls%rowtype;
  v_now timestamptz := now();
  v_already_no_show boolean;
  v_tag_id bigint;
  v_stage_returned boolean := false;
begin
  select * into v_call from sales_calls where id = p_sales_call_id for update;
  if not found then
    return jsonb_build_object('status', 'not-found');
  end if;
  if v_call.opportunity_id is null then
    return jsonb_build_object('status', 'no-opportunity');
  end if;
  if v_call.attendance = 'attended' then
    -- Never silently overwrite a recorded attended outcome.
    return jsonb_build_object('status', 'already-completed');
  end if;

  v_already_no_show := v_call.attendance is not distinct from 'no_show';

  -- 1. The Sales Call is the CANONICAL historical record of the no-show.
  --    status leaves 'booked' so the partial unique index does not block a
  --    later genuine rebooking.
  if not v_already_no_show then
    update sales_calls
       set attendance = 'no_show',
           attendance_recorded_at = v_now,
           status = 'completed',
           updated_at = v_now
     where id = v_call.id;

    insert into sales_call_events (sales_call_id, kind, occurred_at, attendance)
    values (v_call.id, 'attendance_recorded', v_now, 'no_show');
  elsif v_call.status is distinct from 'completed' then
    -- Recorded as a no-show before concluded calls had to leave 'booked'.
    -- Converge the status without inventing a second attendance timestamp
    -- or a duplicate history event.
    update sales_calls set status = 'completed', updated_at = v_now
     where id = v_call.id;
  end if;

  -- 2. The Opportunity REMAINS an active sales attempt. Only the stage
  --    moves, and only when nothing else is booked: Call Booked has to
  --    mean there is a call booked.
  update deals
     set stage = 'approved',
         stage_entered_at = v_now,
         updated_at = v_now
   where id = v_call.opportunity_id
     and stage = 'call_booked'
     and public.deal_is_active(archived_at, stage, outcome)
     and not exists (
       select 1 from sales_calls s
       where s.opportunity_id = v_call.opportunity_id
         and s.id <> v_call.id
         and s.status = 'booked'
     );
  v_stage_returned := found;

  -- 3. The Contact carries a durable, visible No-show tag — a SUMMARY for
  --    at-a-glance history, never the source of truth, attached once.
  select id into v_tag_id from tags where lower(name) = 'no-show' limit 1;
  if v_tag_id is null then
    insert into tags (name, color) values ('No-show', '#fde2e4')
    returning id into v_tag_id;
  end if;

  update contacts
     set tags = coalesce(tags, '{}'::bigint[]) || v_tag_id
   where id = v_call.contact_id
     and not (coalesce(tags, '{}'::bigint[]) @> array[v_tag_id]);

  -- 4. The call concluded, so its own task is done. No follow-up task is
  --    invented: the open question is derived, and a task duplicating it
  --    could be deleted while the question remained.
  -- Every open task about THIS call, whatever its type — including the
  -- resolve_sales_call question this no-show has just answered. Scoped by
  -- the call, never by the Contact: a returning applicant can have an
  -- open question about a different call that this one says nothing about.
  perform public.close_tasks_for_sales_call(v_call.id, v_now);

  -- Legacy rows from before tasks carried sales_call_id. Still scoped to
  -- the superseded types only, so nothing else of this Contact's is swept up.
  update tasks
     set done_date = v_now, status = 'completed'
   where contact_id = v_call.contact_id
     and sales_call_id is null
     and type in ('sales_call', 'sales_call_no_show')
     and done_date is null;

  return jsonb_build_object(
    'status', case when v_already_no_show then 'already-no-show' else 'completed' end,
    'stage_returned_to_approved', v_stage_returned
  );
end;
$function$
;

revoke all on function public.record_sales_call_no_show(bigint) from public;
grant execute on function public.record_sales_call_no_show(bigint) to authenticated;
grant execute on function public.record_sales_call_no_show(bigint) to service_role;


-- =====================================================================
-- Declarative-schema reconciliation, 2026-09-18
-- =====================================================================
-- Functions that migrations added.
--
-- Everything below was extracted from the live database with the
-- server's own catalog functions rather than written by hand, because a
-- hand-copied function body differs from pg_dump's normalised form in
-- whitespace alone and produces a permanent phantom diff.
--
-- These objects were created by migrations and exist on MAIN; they were
-- simply never mirrored here. Migrations, MAIN and this file now
-- describe the same database.

CREATE OR REPLACE FUNCTION public.acuity_type_period_no_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_conflict text;
begin
  select coalesce(m.label, m.id::text) into v_conflict
    from acuity_appointment_type_map m
   where m.acuity_appointment_type_id = new.acuity_appointment_type_id
     and m.id <> coalesce(new.id, -1)
     -- Two half-open periods [a,b) and [c,d) overlap iff a < d and c < b,
     -- with NULL upper bounds read as infinity.
     and new.valid_from < coalesce(m.valid_to, 'infinity'::date)
     and m.valid_from < coalesce(new.valid_to, 'infinity'::date)
   limit 1;

  if v_conflict is not null then
    raise exception 'acuity appointment type % already has a mapping covering that period (%)',
      new.acuity_appointment_type_id, v_conflict;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.clamp_contact_last_seen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_occurred timestamptz;
begin
  if new.last_seen is not null and new.last_seen > now() then
    -- On INSERT there is no prior row; TG_OP tells us which fallback is
    -- honest. Either way, now() is never the answer.
    v_occurred := contact_last_occurred_activity(new.id);
    if v_occurred is not null then
      new.last_seen := v_occurred;
    elsif tg_op = 'UPDATE' then
      new.last_seen := old.last_seen;
    else
      new.last_seen := null;
    end if;
  end if;

  if new.first_seen is not null and new.last_seen is not null
     and new.last_seen < new.first_seen then
    new.last_seen := new.first_seen;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.close_tasks_for_sales_call(p_sales_call_id bigint, p_completed_at timestamp with time zone)
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  with closed as (
    update tasks
       set done_date = p_completed_at, status = 'completed'
     where sales_call_id = p_sales_call_id
       and done_date is null
       and status in ('pending', 'waiting')
    returning 1
  )
  select count(*) from closed;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_sales_call_matching_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- Only the NULL -> attached transition answers the question. An
  -- already-attached call being re-saved changes nothing, and a call that
  -- is still unmatched must keep its task.
  if old.opportunity_id is not null or new.opportunity_id is null then
    return new;
  end if;

  update tasks
     set done_date = coalesce(done_date, now()),
         status    = 'completed'
   where sales_call_id = new.id
     and type = 'sales_call_needs_matching'
     and done_date is null;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.contact_first_occurred_evidence(p_contact_id bigint)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select min(at) from (
    select a.submitted_at as at from applications a where a.contact_id = p_contact_id and a.submitted_at <= now()
    union all
    select coalesce(sc.scheduled_at, (sc.scheduled_on + time '12:00') at time zone 'UTC')
      from sales_calls sc where sc.contact_id = p_contact_id
    union all
    select cs.scheduled_at from client_sessions cs where cs.contact_id = p_contact_id
    union all
    select d.created_at from deals d where d.contact_id = p_contact_id
    union all
    select w.joined_at from waitlist_entries w where w.contact_id = p_contact_id
  ) evidence;
$function$
;

CREATE OR REPLACE FUNCTION public.contact_last_occurred_activity(p_contact_id bigint)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select max(at) from (
    select a.submitted_at as at from applications a where a.contact_id = p_contact_id and a.submitted_at <= now()
    union all
    select a.reviewed_at from applications a where a.contact_id = p_contact_id and a.reviewed_at <= now()
    union all
    -- A sales call counts once its own time has passed. A date-only
    -- historical call is read at the end of its day: the earliest moment
    -- the whole day is certainly behind us, inventing no clock time.
    select coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59') at time zone 'UTC')
      from sales_calls sc
     where sc.contact_id = p_contact_id
       and coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59') at time zone 'UTC') <= now()
    union all
    select sc.cancelled_at from sales_calls sc where sc.contact_id = p_contact_id and sc.cancelled_at <= now()
    union all
    select sc.attendance_recorded_at from sales_calls sc where sc.contact_id = p_contact_id and sc.attendance_recorded_at <= now()
    union all
    select e.occurred_at from sales_call_events e join sales_calls sc on sc.id = e.sales_call_id
     where sc.contact_id = p_contact_id and e.occurred_at <= now()
    union all
    select cs.scheduled_at from client_sessions cs where cs.contact_id = p_contact_id and cs.scheduled_at <= now()
    union all
    select cs.cancelled_at from client_sessions cs where cs.contact_id = p_contact_id and cs.cancelled_at <= now()
    union all
    select cs.no_show_at from client_sessions cs where cs.contact_id = p_contact_id and cs.no_show_at <= now()
    union all
    select d.created_at from deals d where d.contact_id = p_contact_id and d.created_at <= now()
    union all
    select se.entered_at from deal_stage_events se join deals d on d.id = se.opportunity_id
     where d.contact_id = p_contact_id and se.entered_at <= now()
    union all
    select w.joined_at from waitlist_entries w where w.contact_id = p_contact_id and w.joined_at <= now()
    union all
    select n.date from contact_notes n where n.contact_id = p_contact_id and n.date <= now()
    union all
    select n.date from deal_notes n join deals d on d.id = n.deal_id
     where d.contact_id = p_contact_id and n.date <= now()
  ) occurred;
$function$
;

CREATE OR REPLACE FUNCTION public.deal_is_active(p_archived_at timestamp with time zone, p_stage text, p_outcome text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select p_archived_at is null
     and p_stage is distinct from 'won'
     and p_outcome is null;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_persisted_onboarding_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.stage = 'onboarding'
     and (tg_op = 'INSERT' or old.stage is distinct from 'onboarding') then
    raise exception
      'stage "onboarding" is legacy storage and cannot be written. A sale that succeeded is stage = won; the Onboarding column is derived from Won plus an Enrollment plus unfinished setup.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_deal_outcome_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.outcome is not null then
      insert into public.deal_outcome_events
        (opportunity_id, old_outcome, new_outcome, exit_reason, occurred_at, source)
      values (new.id, null, new.outcome, new.exit_reason, now(), 'app');
    end if;
  elsif new.outcome is distinct from old.outcome
     or (new.outcome is not null and new.exit_reason is distinct from old.exit_reason) then
    insert into public.deal_outcome_events
      (opportunity_id, old_outcome, new_outcome, exit_reason, occurred_at, source)
    values (new.id, old.outcome, new.outcome, new.exit_reason, now(), 'app');
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_sales_call_reinstated(p_sales_call_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_call sales_calls%ROWTYPE;
  v_now timestamptz := now();
  v_deal_advanced boolean := false;
begin
  select * into v_call from sales_calls where id = p_sales_call_id for update;
  if not found then
    return jsonb_build_object('status', 'not-found');
  end if;

  -- Never re-open something that actually concluded. If a human recorded
  -- attendance, that is the truth about this call and a live upstream
  -- booking cannot overwrite it.
  if v_call.attendance is not null then
    return jsonb_build_object('status', 'already-concluded');
  end if;

  -- Only a future call can be "still booked". A past cancelled call is
  -- history, and this is exactly where Aurelie must be left alone.
  if coalesce(v_call.scheduled_at, (v_call.scheduled_on + time '23:59') at time zone 'UTC') <= v_now then
    return jsonb_build_object('status', 'in-the-past');
  end if;

  if v_call.status = 'booked' then
    return jsonb_build_object('status', 'already-booked');
  end if;

  update sales_calls
     set status = 'booked',
         cancelled_at = null,
         updated_at = v_now
   where id = v_call.id;

  insert into sales_call_events (sales_call_id, kind, occurred_at, new_scheduled_at)
  values (v_call.id, 'booked', v_now, v_call.scheduled_at);

  -- The Opportunity returns to Call Booked, but only from Approved and
  -- only while still active — the exact inverse of the cancellation path,
  -- and never dragging a Deal backwards from Decision or further on.
  if v_call.opportunity_id is not null then
    update deals
       set stage = 'call_booked',
           stage_entered_at = v_now,
           updated_at = v_now
     where id = v_call.opportunity_id
       and stage = 'approved'
       and outcome is null
       and archived_at is null;
    v_deal_advanced := found;
  end if;

  return jsonb_build_object(
    'status', 'reinstated',
    'sales_call_id', v_call.id,
    'opportunity_id', v_call.opportunity_id,
    'deal_advanced_to_call_booked', v_deal_advanced
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_contact_last_activity()
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_updated bigint;
begin
  update contacts c
     set last_seen = contact_last_occurred_activity(c.id)
   where contact_last_occurred_activity(c.id) is not null
     and c.last_seen is distinct from contact_last_occurred_activity(c.id);
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_completed_future_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- now() is not immutable, so this cannot be a CHECK constraint.
  if new.status = 'completed' and new.scheduled_at > now() then
    raise exception
      'client session % is scheduled at % and cannot be completed before it happens',
      new.id, new.scheduled_at;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_completion_with_sessions_remaining()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_remaining int;
begin
  if new.status <> 'completed' then
    return new;
  end if;

  select count(*) into v_remaining
  from public.client_sessions s
  where s.enrollment_id = new.id
    and s.status <> 'cancelled'
    and s.no_show_at is null
    and s.scheduled_at > now();

  if v_remaining > 0 then
    raise exception
      'enrollment % still has % session(s) scheduled and cannot be completed',
      new.id, v_remaining;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_acuity_appointment_type(p_appointment_type_id text, p_on date)
 RETURNS TABLE(offer_id bigint, offer_name text, kind text, cohort_id bigint, label text, resolution text, valid_from date, valid_to date)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select m.offer_id, o.name, m.kind, m.cohort_id, m.label, m.resolution,
         m.valid_from, m.valid_to
    from acuity_appointment_type_map m
    left join offers o on o.id = m.offer_id
   where m.acuity_appointment_type_id = p_appointment_type_id
     and p_on >= m.valid_from
     and (m.valid_to is null or p_on < m.valid_to)
   limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.seed_enrollment_onboarding(p_enrollment_id bigint, p_due_at timestamp with time zone DEFAULT (now() + '3 days'::interval))
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_deal deals%rowtype;
  v_contact_name text;
  v_item record;
  v_seeded int := 0;
begin
  select d.* into v_deal
    from deals d
    join enrollments e on e.opportunity_id = d.id
   where e.id = p_enrollment_id;
  if not found then
    raise exception 'enrollment % does not exist', p_enrollment_id;
  end if;

  select nullif(trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
    into v_contact_name
    from contacts where id = v_deal.contact_id;
  v_contact_name := coalesce(v_contact_name, v_deal.name);

  for v_item in
    insert into enrollment_onboarding_items
      (enrollment_id, requirement_key, label, task_text_template, is_required, sort_order)
    select p_enrollment_id, t.key, t.label, t.task_text_template, t.is_required, t.sort_order
      from onboarding_requirement_templates t
     where t.offer_id = v_deal.offer_id and t.is_active
    on conflict (enrollment_id, requirement_key) do nothing
    returning id, is_required
  loop
    v_seeded := v_seeded + 1;
    -- Optional items deliberately get no Task: an auto-task for something
    -- nobody has to do is noise on Leif's dashboard.
    if v_item.is_required and not exists (
      select 1 from tasks where onboarding_item_id = v_item.id
    ) then
      insert into tasks (contact_id, type, text, due_date, status, enrollment_id, onboarding_item_id)
      select v_deal.contact_id, 'onboarding_item',
             replace(i.task_text_template, '{name}', v_contact_name),
             -- Not now(): every required item due the instant somebody
             -- pays reads as instantly overdue, which is noise rather
             -- than urgency.
             p_due_at, 'pending', p_enrollment_id, i.id
        from enrollment_onboarding_items i
       where i.id = v_item.id;
    end if;
  end loop;

  return v_seeded;
end;
$function$
;


CREATE OR REPLACE FUNCTION public.close_tasks_for_terminal_enrollment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.status not in ('completed', 'withdrawn', 'ended')
     or old.status in ('completed', 'withdrawn', 'ended') then
    return new;
  end if;

CREATE OR REPLACE FUNCTION public.close_tasks_for_terminal_opportunity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if public.deal_is_active(new.archived_at, new.stage, new.outcome)
     or (tg_op = 'UPDATE'
         and not public.deal_is_active(old.archived_at, old.stage, old.outcome)) then
    return new;
  end if;

CREATE OR REPLACE FUNCTION public.sync_task_from_onboarding_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_enrollment enrollments%rowtype;
  v_deal deals%rowtype;
  v_contact_name text;
begin
  -- Item finished: close its open Task, if it still has one.
  if new.status = 'done' then
    update tasks
       set done_date = coalesce(done_date, coalesce(new.completed_at, now())),
           status = 'completed'
     where onboarding_item_id = new.id and done_date is null;
    return new;
  end if;


CREATE OR REPLACE FUNCTION public.enforce_application_opportunity_agreement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_deal deals%rowtype;
begin
  if new.opportunity_id is null then
    return new;
  end if;

  select * into v_deal from deals where id = new.opportunity_id;
  if not found then
    raise exception 'Application % points at Opportunity %, which does not exist',
      coalesce(new.id::text, 'new'), new.opportunity_id;
  end if;

  if v_deal.contact_id is distinct from new.contact_id then
    raise exception 'Application % belongs to Contact % but Opportunity % belongs to Contact %',
      coalesce(new.id::text, 'new'), new.contact_id, v_deal.id, v_deal.contact_id;
  end if;

  if v_deal.offer_id is distinct from new.offer_id then
    raise exception 'Application % is for Offer % but Opportunity % is for Offer %; an application cannot belong to a sales attempt for a different programme',
      coalesce(new.id::text, 'new'), new.offer_id, v_deal.id, v_deal.offer_id;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.materialize_application_responses(p_snapshot_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_snapshot historical_application_source_snapshots%rowtype;
  v_written int := 0;
  v_metadata constant text[] := array[
    'Full Name', 'Your name:', 'Email', 'Status', 'Submission time',
    'Call Booked', 'Notes', 'My notes', 'Respondent'
  ];
begin
  select * into v_snapshot
    from historical_application_source_snapshots where id = p_snapshot_id;
  if not found then
    raise exception 'snapshot % does not exist', p_snapshot_id;
  end if;

  if v_snapshot.application_id is null then
    raise exception 'snapshot % is not attached to an Application; copy artifacts and evidence-only rows must never produce responses', p_snapshot_id;
  end if;
  if v_snapshot.is_copy_artifact then
    raise exception 'snapshot % is a copy artifact', p_snapshot_id;
  end if;

  insert into application_responses
    (application_id, position, question_key, question_text,
     answer_text, answered, source_snapshot_id)
  select
    v_snapshot.application_id,
    row_number() over (order by c.ordinality)::smallint,
    null,
    c.value #>> '{}',
    nullif(btrim(coalesce(v.value #>> '{}', '')), ''),
    nullif(btrim(coalesce(v.value #>> '{}', '')), '') is not null,
    v_snapshot.id
  from jsonb_array_elements(v_snapshot.raw_snapshot->'columns')
         with ordinality c(value, ordinality)
  join jsonb_array_elements(v_snapshot.raw_snapshot->'values')
         with ordinality v(value, ordinality)
    on v.ordinality = c.ordinality
  where not ((c.value #>> '{}') = any (v_metadata))
  on conflict (application_id, position) do nothing;

  get diagnostics v_written = row_count;
  return v_written;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.materialize_native_application_responses()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_version application_form_versions%rowtype;
begin
  -- Recovered history is materialised from its preserved snapshot
  -- instead, and carries no raw_answers at all.
  if new.raw_answers is null or new.raw_answers = '{}'::jsonb then
    return new;
  end if;

  select * into v_version from application_form_versions
   where offer_id = new.offer_id and is_current;
  if not found then
    -- No registered wording for this Offer. The Application still stands;
    -- it simply has no question text to store, which is honest and
    -- visible rather than a guess from a labels file.
    return new;
  end if;

  update applications
     set form_key = v_version.form_key, form_label = v_version.form_label
   where id = new.id;

  insert into application_responses
    (application_id, position, question_key, question_text, answer_text, answered)
  select new.id,
         q.position,
         q.question_key,
         q.question_text,
         nullif(btrim(coalesce(new.raw_answers ->> q.question_key, '')), ''),
         nullif(btrim(coalesce(new.raw_answers ->> q.question_key, '')), '') is not null
    from application_form_questions q
   where q.form_version_id = v_version.id
  on conflict (application_id, position) do nothing;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_application_response_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_setting('app.migration_mode', true) = 'true' then
    return coalesce(new, old);
  end if;
  raise exception 'application_responses is an immutable submission record; % is not allowed', tg_op
    using hint = 'Responses are written once by materialize_application_responses() or at submission time. Correcting one means re-materialising from its source snapshot.';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reconcile_application_review_tasks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_created int := 0;
  v_closed int;
  v_sales_id bigint;
begin
  select id into v_sales_id from sales where administrator = true limit 1;

  -- Close escalations whose Application is no longer overdue review work:
  -- reviewed, its attempt moved on, or its attempt ended.
  update tasks t
     set done_date = now(), status = 'completed'
   where t.type = 'review_application'
     and t.done_date is null
     and not exists (
       select 1 from applications_awaiting_review r
        where r.application_id = t.application_id and r.is_overdue
     );
  get diagnostics v_closed = row_count;

  -- One escalation per overdue Application that has none. The partial
  -- unique index on (application_id) where done_date is null is what makes
  -- this safe to run as often as we like.
  insert into tasks (contact_id, type, text, due_date, status,
                     application_id, opportunity_id, sales_id)
  select r.contact_id,
         'review_application',
         format('Review %s''s application',
                nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')),
         -- The day it SHOULD have been reviewed by, not the day it
         -- arrived. A due date in the past is now a true statement.
         (r.review_due_on::timestamp at time zone 'America/Denver'),
         'pending',
         r.application_id,
         r.opportunity_id,
         v_sales_id
    from applications_awaiting_review r
    join contacts c on c.id = r.contact_id
   where r.is_overdue
     and not exists (
       select 1 from tasks t
        where t.type = 'review_application'
          and t.done_date is null
          and t.application_id = r.application_id
     );
  get diagnostics v_created = row_count;

  return v_created + v_closed;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reconcile_resolve_sales_call_tasks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_closed int;
  v_created int;
  v_sales_id bigint;
begin
  -- Resolved: close whatever is still open about it.
  update tasks t
     set done_date = now(), status = 'completed'
    from sales_calls sc
   where sc.id = t.sales_call_id
     and t.type = 'resolve_sales_call'
     and t.done_date is null
     and public.sales_call_is_resolved(sc.attendance, sc.status, sc.dismissed_at);
  get diagnostics v_closed = row_count;

  -- Still an open question, and nothing currently asking it.
  select id into v_sales_id from sales where administrator = true limit 1;

  insert into tasks (contact_id, type, text, due_date, status,
                     sales_call_id, opportunity_id, sales_id)
  select sc.contact_id,
         'resolve_sales_call',
         format('%s · what happened on this call?',
                nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')),
         now(),
         'pending',
         sc.id,
         sc.opportunity_id,
         v_sales_id
    from sales_calls sc
    join contacts c on c.id = sc.contact_id
   where sc.resolution_requested_at is not null
     and not public.sales_call_is_resolved(sc.attendance, sc.status, sc.dismissed_at)
     -- A call that has not happened yet is not an open question.
     --
     -- Six calls here were established as questions once, answered, and
     -- are now booked for mid-October. Without this they would each come
     -- back asking "what happened on this call?" about something three
     -- weeks away. The question only exists once the time has passed.
     and coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59')
                    at time zone 'America/Denver') < now()
     and not exists (
       select 1 from tasks t
        where t.sales_call_id = sc.id
          and t.type = 'resolve_sales_call'
          and t.done_date is null
     );
  get diagnostics v_created = row_count;

  return v_closed + v_created;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sales_call_is_resolved(p_attendance text, p_status text, p_dismissed_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  -- Any of the three canonical answers, or an explicit dismissal.
  -- Attendance covers attended and no_show; a cancelled call has no
  -- attendance to record and needs none.
  select p_attendance is not null
      or p_dismissed_at is not null
      or p_status = 'cancelled';
$function$
;
