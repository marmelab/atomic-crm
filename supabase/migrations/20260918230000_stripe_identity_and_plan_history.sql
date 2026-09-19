-- One Contact may own several Stripe Customers. One Deal may be paid
-- through several Stripe subscriptions. Neither was representable.
--
-- Both gaps came from the same assumption: that a single id is the whole
-- truth. Two live cases disproved it on the same day.
--
--   Mia Cosme (legal name Maria Cosme) paid $3,700 as four $925 payments
--   made through FOUR different Stripe Customer objects. The CRM was
--   linked to one of them, so it could see $925 and no more.
--
--   Jules Litman-Cleper agreed six payments of $666. His original Stripe
--   subscription was built with only four cycles, so it ended after
--   payment four; a replacement subscription now carries the remaining
--   two. Both belong to the SAME agreement. Overwriting the first id with
--   the second would erase four collected payments' provenance; keeping
--   only the first would say his plan had ended.
--
-- So: the existing single-id columns stay as the CURRENT/PRIMARY pointer
-- (nothing reading them breaks), and these two relations hold the whole
-- history beside them.

begin;

-- ---------------------------------------------------------------------
-- Financial identity: one Contact, many verified Stripe Customers
-- ---------------------------------------------------------------------
create table if not exists public.contact_stripe_customers (
  id bigint generated always as identity primary key,
  contact_id bigint not null references public.contacts (id) on delete cascade,
  stripe_customer_id text not null,
  is_primary boolean not null default false,
  -- Why this Customer is believed to belong to this Contact. A matching
  -- email address is NOT on this list on its own: it is a discovery hint,
  -- never an authority to move money onto somebody's record.
  verified_by text not null check (
    verified_by in (
      'owner_confirmed',
      'checkout_session',
      'webhook',
      'historical_import'
    )
  ),
  note text,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A Stripe Customer belongs to exactly one person. This is what stops the
-- same money being claimed by two Contacts.
create unique index if not exists contact_stripe_customers_customer_key
  on public.contact_stripe_customers (stripe_customer_id);

create index if not exists contact_stripe_customers_contact_idx
  on public.contact_stripe_customers (contact_id);

create unique index if not exists contact_stripe_customers_one_primary
  on public.contact_stripe_customers (contact_id)
  where is_primary;

comment on table public.contact_stripe_customers is
  'Every Stripe Customer object verified as belonging to a Contact. contacts.stripe_customer_id remains the primary/current one; reconciliation reads them all.';

-- ---------------------------------------------------------------------
-- Payment-plan history: one Deal, many Stripe plan objects
-- ---------------------------------------------------------------------
create table if not exists public.deal_stripe_plan_objects (
  id bigint generated always as identity primary key,
  deal_id bigint not null references public.deals (id) on delete cascade,
  stripe_object_id text not null,
  object_type text not null check (object_type in ('subscription', 'schedule')),
  -- Stripe's own status, mirrored. A 'canceled' or 'completed' object is
  -- kept deliberately: it is where earlier payments came from.
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  -- The object currently carrying the plan forward, if any. A Deal can
  -- have none (the plan finished, or has not started) without that
  -- meaning anything about what was paid.
  is_current boolean not null default false,
  linked_at timestamptz not null default now(),
  link_source text not null check (
    link_source in ('owner_confirmed', 'checkout_session', 'webhook', 'reconciliation', 'historical_import')
  ),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists deal_stripe_plan_objects_object_key
  on public.deal_stripe_plan_objects (stripe_object_id);

create index if not exists deal_stripe_plan_objects_deal_idx
  on public.deal_stripe_plan_objects (deal_id);

comment on table public.deal_stripe_plan_objects is
  'Every Stripe subscription/schedule that has ever carried this Deal''s payment plan. A replacement subscription is added here, never substituted for its predecessor: one commercial agreement, many Stripe objects.';

-- ---------------------------------------------------------------------
-- Backfill from the single-id columns, so the relations start complete
-- ---------------------------------------------------------------------
insert into public.contact_stripe_customers
  (contact_id, stripe_customer_id, is_primary, verified_by, note)
select c.id, c.stripe_customer_id, true, 'historical_import',
       'Backfilled from contacts.stripe_customer_id.'
from public.contacts c
where c.stripe_customer_id is not null
on conflict (stripe_customer_id) do nothing;

insert into public.deal_stripe_plan_objects
  (deal_id, stripe_object_id, object_type, is_current, link_source, note)
select d.id, d.stripe_subscription_id, 'subscription', true, 'historical_import',
       'Backfilled from deals.stripe_subscription_id.'
from public.deals d
where d.stripe_subscription_id is not null
on conflict (stripe_object_id) do nothing;

insert into public.deal_stripe_plan_objects
  (deal_id, stripe_object_id, object_type, is_current, link_source, note)
select d.id, d.stripe_subscription_schedule_id, 'schedule', true, 'historical_import',
       'Backfilled from deals.stripe_subscription_schedule_id.'
from public.deals d
where d.stripe_subscription_schedule_id is not null
on conflict (stripe_object_id) do nothing;

-- The backfill is checked against its own source rather than against a
-- row count. "At least one customer exists" only held because this
-- database happened to have Stripe data; it says nothing about whether
-- the copy was COMPLETE, and it fails in a rebuilt database that has no
-- contacts yet — which would make the two relations unreconstructible.
--
-- Every single-id pointer must now have a counterpart in the relation
-- beside it. That is the property actually worth guaranteeing, it is
-- strictly stronger than the count it replaces (a half-copied backfill
-- used to pass), and it holds in an empty database for the same reason
-- it holds in a full one.
do $$
declare
  v_missing_customers int;
  v_missing_objects int;
begin
  select count(*) into v_missing_customers
    from public.contacts c
   where c.stripe_customer_id is not null
     and not exists (select 1 from public.contact_stripe_customers x
                      where x.stripe_customer_id = c.stripe_customer_id);

  select count(*) into v_missing_objects
    from (
      select d.stripe_subscription_id as object_id from public.deals d
       where d.stripe_subscription_id is not null
      union all
      select d.stripe_subscription_schedule_id from public.deals d
       where d.stripe_subscription_schedule_id is not null
    ) src
   where not exists (select 1 from public.deal_stripe_plan_objects o
                      where o.stripe_object_id = src.object_id);

  if v_missing_customers <> 0 or v_missing_objects <> 0 then
    raise exception 'backfill incomplete (% customer pointer(s), % plan pointer(s) not copied)',
      v_missing_customers, v_missing_objects;
  end if;
end $$;

commit;
