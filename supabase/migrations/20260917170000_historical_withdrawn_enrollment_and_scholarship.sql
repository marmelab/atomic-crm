-- ===========================================================================
-- Two historical facts the importer could not previously express
-- ===========================================================================
-- Both come from rulings that already existed; the gap was that the schema
-- and the live-automation guards left the importer no truthful way to write
-- them. Neither changes anything about how the live CRM behaves.

-- ---------------------------------------------------------------------------
-- 1. enrollments.status gains 'withdrawn'
-- ---------------------------------------------------------------------------
-- A person who signed up for a cohort and then left before finishing is
-- neither 'completed' (they did not complete it) nor any of the three
-- in-progress statuses (they are not current work). The vocabulary had no
-- way to say what actually happened, so the only options were to omit the
-- enrollment entirely — erasing that they ever signed up — or to record
-- 'completed', which renders in the Clients list as the literal word
-- "Completed" and would be a visible falsehood on a real person's record.
--
-- 'withdrawn' is terminal, exactly like 'completed': useClientsGrouped.ts
-- files anything that is not onboarding/active/offboarding under Past
-- Clients, and CURRENT_OPERATIONAL_ENROLLMENT_STATUSES already excludes
-- everything terminal — so a withdrawn Enrollment is never a current client
-- and never an operational Task destination, with no change to either rule.
ALTER TABLE "public"."enrollments"
  DROP CONSTRAINT IF EXISTS "enrollments_status_check";
ALTER TABLE "public"."enrollments"
  ADD CONSTRAINT "enrollments_status_check"
  CHECK (status IN ('onboarding', 'active', 'offboarding', 'completed', 'withdrawn'));

-- ---------------------------------------------------------------------------
-- 2. handle_deal_saved() respects historical migration mode
-- ---------------------------------------------------------------------------
-- Scholarship pricing is deliberately hard to reach from the live app: it
-- cannot be set at creation, cannot be changed once a Deal is Won, and
-- granting it atomically claims the Offer's single scholarship slot. Those
-- rules are right for live use and stay exactly as they are.
--
-- They also made a historical scholarship Deal impossible to import. A
-- person who was genuinely on a scholarship years ago arrives already Won,
-- so the importer hits "cannot be created directly as scholarship" on the
-- insert and "cannot change pricing_mode once Won" on any later correction.
-- The only remaining option was to record them at standard pricing, which
-- misstates what they actually paid.
--
-- Under migration mode the three prohibitions and the slot machinery are
-- skipped — the same treatment handle_deal_won() already gives its own
-- onboarding side effects, and for the same reason: a historical record is
-- a statement about the past, not a live commercial action. The slot in
-- particular is live capacity, and claiming it from an import would invent
-- an operational side effect the historical path exists to suppress.
--
-- Everything else in this function is untouched and still runs during an
-- import: the Won payment-authority guard, offer/cohort validation, the
-- commercial snapshot (which is what derives offer_price_snapshot from the
-- Offer's scholarship_price), payment-option matching, and the derived name.
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
