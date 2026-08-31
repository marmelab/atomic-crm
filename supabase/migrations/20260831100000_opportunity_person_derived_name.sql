-- Programs + Opportunity UX slice, §1: the Opportunity's `name` is always
-- derived from its linked Contact, never user-typed. This makes it
-- structurally impossible for an Opportunity to display one person while
-- being linked to another.
CREATE OR REPLACE FUNCTION "public"."handle_deal_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_offer offers%ROWTYPE;
  v_cohort_offer_id bigint;
  v_contact contacts%ROWTYPE;
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

  -- Snapshot commercial info at save time so a later Offer/payment-option
  -- change never rewrites historical sales context on an existing Opportunity.
  if tg_op = 'INSERT' or new.offer_id is distinct from old.offer_id then
    new.offer_name_snapshot := v_offer.name;
    new.offer_price_snapshot := v_offer.current_price;
  end if;

  if new.selected_payment_option_id is not null
     and (tg_op = 'INSERT' or new.selected_payment_option_id is distinct from old.selected_payment_option_id)
  then
    select total, installments, installment_amount
      into new.selected_payment_total, new.selected_installment_count, new.selected_installment_amount
      from offer_payment_options
      where id = new.selected_payment_option_id;
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
