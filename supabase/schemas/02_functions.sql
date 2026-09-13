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

CREATE OR REPLACE FUNCTION "public"."handle_deal_won"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_cohort cohorts%ROWTYPE;
  v_enrollment_id bigint;
  v_contact_name text;
  v_item record;
begin
  if new.stage = 'won' and (tg_op = 'INSERT' or old.stage is distinct from 'won') then
    if new.cohort_id is not null then
      select * into v_cohort from cohorts where id = new.cohort_id;
    end if;

    -- Idempotent: the unique constraint on enrollments.opportunity_id means
    -- re-saving Won (or this trigger re-firing) never creates a duplicate.
    -- `returning ... into` only actually assigns on the genuine-insert
    -- path — the on-conflict no-op leaves v_enrollment_id null, which is
    -- exactly the signal the Contracts + Onboarding block below needs to
    -- stay just as replay-safe as the Enrollment creation it's gated on.
    insert into enrollments (opportunity_id, status, start_date, end_date)
    values (
      new.id,
      'onboarding',
      v_cohort.program_start_at::date,
      v_cohort.program_end_at::date
    )
    on conflict (opportunity_id) do nothing
    returning id into v_enrollment_id;

    if v_enrollment_id is not null then
      select trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
        into v_contact_name
        from contacts where id = new.contact_id;
      if v_contact_name is null or v_contact_name = '' then
        v_contact_name := new.name;
      end if;

      -- Seed this Enrollment's checklist from whichever requirement
      -- templates are currently active for this Deal's Offer (snapshotted,
      -- not a live reference — see onboarding_requirement_templates' own
      -- comment), one Task per REQUIRED item only (optional items get no
      -- auto-task — Contracts + Onboarding slice, §8/§11 of the
      -- architecture review).
      for v_item in
        insert into enrollment_onboarding_items
          (enrollment_id, requirement_key, label, task_text_template, is_required, sort_order)
        select v_enrollment_id, t.key, t.label, t.task_text_template, t.is_required, t.sort_order
        from onboarding_requirement_templates t
        where t.offer_id = new.offer_id and t.is_active
        returning id, is_required, task_text_template
      loop
        if v_item.is_required then
          insert into tasks (contact_id, type, text, due_date, status, enrollment_id, onboarding_item_id)
          values (
            new.contact_id,
            'onboarding_item',
            replace(v_item.task_text_template, '{name}', v_contact_name),
            -- Deliberately NOT now() — every required item due immediately
            -- at Enrollment creation would produce artificial overdue
            -- noise (someone paying late in the day reads as instantly
            -- behind). The Dashboard's Needs Onboarding section (driven
            -- directly off Enrollment state, not Tasks) is the primary
            -- "this person cannot disappear" signal; these Tasks' Overdue
            -- bucket is a secondary nudge, so a few real days of slack is
            -- correct, not a compromise.
            now() + interval '3 days',
            'pending',
            v_enrollment_id,
            v_item.id
          );
        end if;
      end loop;

      -- Scholarship Pricing + Capacity slice: atomically transition the
      -- slot this Deal holds (grant time) into Enrollment-held occupancy —
      -- a single UPDATE flipping both holder columns together, inside the
      -- same transaction as the enrollments INSERT above, so no other
      -- session can ever observe this Offer's slot as free between "Deal
      -- loses it" and "Enrollment gains it".
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
$$;

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
CREATE OR REPLACE FUNCTION "public"."enforce_enrollment_activation_requirements"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'active' and old.status = 'onboarding' then
    if exists (
      select 1 from enrollment_onboarding_items
      where enrollment_id = new.id and is_required and status <> 'done'
    ) then
      raise exception 'Cannot activate enrollment %: required onboarding items incomplete', new.id;
    end if;
  end if;
  return new;
end;
$$;

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
  v_latest timestamp with time zone;
begin
  v_opportunity_id := coalesce(new.opportunity_id, old.opportunity_id);
  if v_opportunity_id is null then
    return coalesce(new, old);
  end if;

  select scheduled_at into v_latest
    from sales_calls
    where opportunity_id = v_opportunity_id and status = 'booked'
    order by scheduled_at desc
    limit 1;

  update deals set sales_call_at = v_latest where id = v_opportunity_id;

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
CREATE OR REPLACE FUNCTION "public"."submit_public_application"(
    "p_offer_id" bigint,
    "p_cohort_id" bigint,
    "p_first_name" text,
    "p_last_name" text,
    "p_email" text,
    "p_phone" text,
    "p_answers" jsonb
) RETURNS jsonb
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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

  -- Defense-in-depth structural re-check — the Edge Function already
  -- validated offer/cohort (including the Denver-timezone open-window
  -- logic this function deliberately does not duplicate) before ever
  -- calling here; this is the same minimal FK-existence backstop
  -- handle_deal_saved() already applies to any deals insert regardless.
  IF NOT EXISTS (SELECT 1 FROM offers WHERE id = p_offer_id AND is_active) THEN
    RAISE EXCEPTION 'offer_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_cohort_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM cohorts WHERE id = p_cohort_id AND offer_id = p_offer_id
  ) THEN
    RAISE EXCEPTION 'cohort_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Serialize concurrent submissions for the same applicant identity for
  -- the rest of this transaction (released automatically at commit/
  -- rollback) — see header comment.
  PERFORM pg_advisory_xact_lock(hashtext('submit_public_application:' || v_email));

  -- Read current state ONCE, before any write (mirrors submitApplication.ts
  -- / the pre-atomicity Edge Function exactly) so a true no-op retry can be
  -- recognized with ZERO writes.
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
    -- jsonb equality is key-order-independent (both sides are stored in
    -- Postgres's own canonical jsonb form) — mirrors answersEqual()
    -- exactly without needing a manual key-by-key comparison.
    v_answers_match := p_answers = v_pending_app.raw_answers;
  END IF;

  -- Adversarial-review correction: an earlier draft of this function
  -- trusted "Application matches" alone, reasoning that atomicity makes
  -- "Application exists but Task doesn't" unreachable. That's only true
  -- for rows THIS function itself created — it is NOT true for a row the
  -- OLD, pre-atomicity code path already left behind before this function
  -- was ever deployed (exactly the legacy-partial-state case this whole
  -- migration exists to repair). Without this check, such a legacy row
  -- would hit this fast path on its very next matching resubmission and
  -- return early WITHOUT ever creating the missing Task — silently
  -- perpetuating the original bug for any row that predates this
  -- deployment. Checking Task existence here too (mirrors
  -- submitApplication.ts's own identical check) costs nothing once this
  -- function has been the only writer for a while (the Task will simply
  -- already exist), and is exactly what repairs a legacy row instead of
  -- rubber-stamping it.
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

  -- Resolve or create the Contact.
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

  -- Resolve or create the Deal (never reused for a DNE contact — a fresh
  -- Deal already in the exited state, exactly like both prior
  -- implementations).
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
    -- name/snapshot fields are computed by the existing BEFORE trigger
    -- handle_deal_saved(); the existing AFTER trigger on_deal_waitlist_sync
    -- fires automatically for this fresh INSERT.
  ELSE
    v_deal_reused := true;
    IF NOT v_is_dne THEN
      -- Reusing writes nothing to `deals`, so on_deal_waitlist_sync never
      -- fires for this path — mirror it explicitly (same rule, same WHERE
      -- clause, as handle_deal_waitlist_sync() itself).
      UPDATE waitlist_entries
      SET status = 'converted', converted_at = now(), converted_opportunity_id = v_deal.id
      WHERE contact_id = v_deal.contact_id
        AND offer_id = v_deal.offer_id
        AND status IN ('waiting', 'invited')
        AND (cohort_id IS NULL OR cohort_id = v_deal.cohort_id);
    END IF;
  END IF;

  -- Resolve, update-in-place, or create the Application.
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
      INSERT INTO applications (opportunity_id, raw_answers, submitted_at, status, reviewed_at)
      VALUES (
        v_deal.id, p_answers, now(),
        CASE WHEN v_is_dne THEN 'do_not_engage' ELSE 'pending' END,
        CASE WHEN v_is_dne THEN now() ELSE NULL END
      ) RETURNING id INTO v_application_id;
    END IF;
  END IF;

  -- Review Application Task: idempotent (skips if a pending one already
  -- exists), never created for the DNE auto-resolve path.
  IF NOT v_is_dne THEN
    SELECT EXISTS (
      SELECT 1 FROM tasks
      WHERE contact_id = v_contact.id
        AND type = 'review_application'
        AND done_date IS NULL
    ) INTO v_has_pending_task;

    IF NOT v_has_pending_task THEN
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
$$;
