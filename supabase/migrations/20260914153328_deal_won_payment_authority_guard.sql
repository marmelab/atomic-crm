-- Go-Live Blocker: Won Payment Authority — a real, confirmed defect found
-- during final whole-system go-live acceptance. handle_deal_won()'s own
-- AFTER trigger unconditionally creates a real Enrollment, onboarding
-- checklist/Tasks, and (for scholarship pricing) consumes a real
-- scholarship slot the instant a Deal's stage becomes 'won' — with
-- nothing checking HOW it got there. The generic, authenticated Deal edit
-- form exposes "Won" as an ordinary selectable stage value (same as any
-- other), so any authenticated CRM user could fabricate the equivalent of
-- a successful purchase with zero payment. Won must only ever be reached
-- via a successful Stripe payment (stripe_webhook/index.ts, which writes
-- through supabaseAdmin using the service_role key).
--
-- This adds the durable, server-side half of the fix directly inside the
-- existing handle_deal_saved() BEFORE trigger (already the established
-- "validate business invariants before save" function for deals — see its
-- own header/other guards) rather than introducing a new trigger, so the
-- guard runs early enough that an unauthorized transition never reaches
-- handle_deal_won()'s AFTER-trigger effects. auth.role() reflects the
-- verified PostgREST JWT's `role` claim: 'service_role' for the real
-- webhook, 'authenticated' for an ordinary CRM user, and NULL for a direct
-- database/migration connection that never went through PostgREST at all
-- (trusted recovery/admin context, deliberately still permitted).
--
-- The UI half (removing "won" from the ordinary editable stage dropdown)
-- lives in src/components/atomic-crm/deals/DealInputs.tsx — this
-- migration is the durable backstop that holds even if that UI change is
-- ever bypassed, reverted, or circumvented via a direct API call.

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
