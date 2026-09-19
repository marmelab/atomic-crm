-- Where a commercial total came from is structure, not a repair.
--
-- 20260918280000 derived the agreed total for ten named Opportunities from
-- Stripe, and invented `selected_payment_total_source` on its way past so
-- nobody would later mistake a derived figure for one Leif stated. That
-- provenance column is part of what the finished CRM is: the app reads it,
-- the declarative schema declares it, and two later migrations depend on
-- it. The ten corrections are not — they are this database's history.
--
-- A rebuilt database skips the corrections, so it would have skipped the
-- column with them and come back subtly different from the one it
-- replaced. The column and its CHECK are created here instead, ahead of
-- every migration that touches them, and 20260918280000 keeps only the
-- named-client repair and its assertions.
--
-- Ordering is the point of the version number. This sorts immediately
-- before 20260918280000, which is the first migration to write the column
-- at all, so the structure exists before anything — deterministic or
-- MAIN-only — refers to it.
--
-- Idempotent throughout: MAIN already carries both facts, created by
-- 20260918280000 before the split. Applying this there must be a catalog
-- no-op that touches no row.

begin;

alter table public.deals
  add column if not exists selected_payment_total_source text;

-- Added only when absent. Re-adding an identical CHECK would revalidate
-- every Opportunity to reach the state it is already in.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'deals_selected_payment_total_source_check'
       and conrelid = 'public.deals'::regclass
  ) then
    alter table public.deals
      add constraint deals_selected_payment_total_source_check check (
        selected_payment_total_source is null
        or selected_payment_total_source in (
          'owner_confirmed',
          'stripe_derived',
          'offer_snapshot'
        )
      );
  end if;
end $$;

comment on column public.deals.selected_payment_total_source is
  'Where selected_payment_total came from. stripe_derived = subscription amount x scheduled months, reconciled against collected money. Never the Offer list price, which is only ever a fallback for display.';

-- ---------------------------------------------------------------------
-- Prove it landed, rather than assume it did
-- ---------------------------------------------------------------------
do $$
declare
  v_type text;
  v_nullable text;
  v_check text;
begin
  select data_type, is_nullable into v_type, v_nullable
    from information_schema.columns
   where table_schema = 'public' and table_name = 'deals'
     and column_name = 'selected_payment_total_source';

  if v_type is distinct from 'text' or v_nullable is distinct from 'YES' then
    raise exception 'deals.selected_payment_total_source is %/% , expected text/YES',
      coalesce(v_type, 'absent'), coalesce(v_nullable, '-');
  end if;

  select pg_get_constraintdef(oid) into v_check
    from pg_constraint
   where conname = 'deals_selected_payment_total_source_check'
     and conrelid = 'public.deals'::regclass;

  if v_check is null then
    raise exception 'deals_selected_payment_total_source_check is missing';
  end if;

  -- The three permitted values, whatever order the catalog prints them in.
  if v_check not like '%owner_confirmed%'
     or v_check not like '%stripe_derived%'
     or v_check not like '%offer_snapshot%' then
    raise exception 'deals_selected_payment_total_source_check does not permit the three provenances: %', v_check;
  end if;
end $$;

commit;
