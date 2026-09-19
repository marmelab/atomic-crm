-- A Contact is a human. Everything else is a name some system calls them.
--
-- The CRM already holds several kinds of "who is this": an email address,
-- a Stripe customer id, a free-text identifiers note, and soon a Meta user
-- id and a Gmail address. Each one so far has been bolted onto the
-- contacts row itself, which means every new provider is a new column and
-- a new set of ad-hoc matching rules — and it puts the CRM one step from
-- treating a provider's handle AS the person.
--
-- It isn't. An Instagram handle can be changed this afternoon. An email
-- address can be abandoned. The human is the same human. So provider
-- identities become EVIDENCE that an external system refers to a Contact,
-- recorded once, in one shape, with the immutable id as the key and the
-- human-readable handle as mutable metadata beside it.
--
-- This migration is deterministic: the tables, the invariants, and the
-- functions. It links no real person to anything.

begin;

-- ---------------------------------------------------------------------
-- 1. Who a provider says this human is
-- ---------------------------------------------------------------------
create table if not exists public.contact_external_identities (
  id bigint generated always as identity primary key,
  contact_id bigint not null
    references public.contacts(id) on update cascade on delete cascade,

  -- Which system is speaking. Constrained so a typo cannot invent a
  -- provider; adding one is a one-line migration and a deliberate act.
  provider text not null,

  -- WHICH account of that provider observed it. An Instagram user id is
  -- scoped to the business account that saw it, so the same person
  -- messaging two different IG accounts is two scoped ids, and the same
  -- scoped id seen by two accounts is not automatically one person.
  -- NULL where the provider has no such scoping (a Stripe customer id is
  -- global to the account).
  provider_account_id text,

  -- The provider's own immutable identifier. NEVER a handle, never an
  -- email typed by a human, never anything the person can change.
  external_user_id text not null,

  -- What to show Leif, and what he might search for: "@someone",
  -- "person@example.com". Mutable by definition — a handle change updates
  -- this and nothing else.
  display_identifier text,

  -- Small, provider-specific context. Never tokens, never secrets.
  metadata jsonb not null default '{}'::jsonb,

  first_seen_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contact_external_identities_provider_check check (
    provider in ('instagram', 'gmail', 'email', 'stripe', 'acuity', 'notion')
  ),
  constraint contact_external_identities_external_user_id_check check (
    btrim(external_user_id) <> ''
  )
);

-- The invariant the whole model rests on: one provider identity names at
-- most one human. A partial pair of unique indexes rather than one, because
-- NULL provider_account_id would otherwise defeat uniqueness entirely.
create unique index if not exists contact_external_identities_scoped_key
  on public.contact_external_identities (provider, provider_account_id, external_user_id)
  where provider_account_id is not null;

create unique index if not exists contact_external_identities_global_key
  on public.contact_external_identities (provider, external_user_id)
  where provider_account_id is null;

create index if not exists contact_external_identities_contact_idx
  on public.contact_external_identities (contact_id);

-- Searching a handle has to find the person, without the handle ever
-- being the key.
create index if not exists contact_external_identities_display_idx
  on public.contact_external_identities (lower(display_identifier));

comment on table public.contact_external_identities is
  'Provider identities that refer to a Contact. The immutable provider id is the key; the handle or address is mutable display metadata. A handle change must never produce a second Contact, and a handle must never be used to merge people.';
comment on column public.contact_external_identities.external_user_id is
  'The provider''s immutable id — for Instagram, the scoped user id from Meta, never the @handle.';
comment on column public.contact_external_identities.provider_account_id is
  'Which account of that provider observed this identity, where the provider scopes ids per account (Instagram does). NULL when the id is global to the workspace.';

alter table public.contact_external_identities enable row level security;

drop policy if exists "External identities are readable" on public.contact_external_identities;
create policy "External identities are readable"
  on public.contact_external_identities for select to authenticated using (true);

grant select on public.contact_external_identities to authenticated;
revoke all on public.contact_external_identities from anon;

-- ---------------------------------------------------------------------
-- 2. One definition of a comparable email address
-- ---------------------------------------------------------------------
-- Deterministic and deliberately conservative: case and surrounding
-- whitespace only. No plus-address stripping and no dot-folding — those
-- are provider-specific conventions, and treating a+b@x.com as a@x.com
-- would silently merge two people who chose to be different.
create or replace function public.normalize_email(p_email text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select nullif(lower(btrim(p_email)), '');
$$;

-- The addresses a Contact is reachable at, as rows rather than jsonb, so
-- "who owns this address" is one query. The placeholder addresses the
-- historical import minted for emailless applicants are page ids, not
-- addresses, and are excluded.
create or replace view public.contact_email_addresses as
select c.id as contact_id,
       public.normalize_email(e->>'email') as normalized_email,
       e->>'email' as email,
       e->>'type' as email_type
  from public.contacts c,
       lateral jsonb_array_elements(coalesce(c.email_jsonb, '[]'::jsonb)) e
 where public.normalize_email(e->>'email') is not null
   and (e->>'email') not like 'le-standalone:%';

grant select on public.contact_email_addresses to authenticated;

comment on view public.contact_email_addresses is
  'One row per real email address a Contact holds, normalized for comparison. Excludes the le-standalone: placeholders, which are Notion page ids rather than addresses.';

-- ---------------------------------------------------------------------
-- 3. A Contact that has been merged away still explains itself
-- ---------------------------------------------------------------------
-- Merge does not delete. Contact deletion stays unavailable (Slice 0), and
-- deleting the losing row would take its Applications, calls and history
-- with it — the exact destruction the old merge performed. The row stays,
-- pointing at the Contact it became, so an old link or a stale bookmark
-- still resolves to a person rather than a 404.
alter table public.contacts
  add column if not exists merged_into_contact_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_merged_into_fkey') then
    alter table public.contacts
      add constraint contacts_merged_into_fkey foreign key (merged_into_contact_id)
      references public.contacts(id) on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contacts_not_merged_into_self') then
    alter table public.contacts
      add constraint contacts_not_merged_into_self check (merged_into_contact_id is distinct from id);
  end if;
end $$;

create index if not exists contacts_merged_into_idx
  on public.contacts (merged_into_contact_id) where merged_into_contact_id is not null;

comment on column public.contacts.merged_into_contact_id is
  'Set when this Contact was merged into another. The row is kept rather than deleted so its history stays readable and old links still resolve. Never a delete.';

-- ---------------------------------------------------------------------
-- 4. What happened, so the CRM can say why
-- ---------------------------------------------------------------------
create table if not exists public.contact_merges (
  id bigint generated always as identity primary key,
  source_contact_id bigint not null references public.contacts(id) on update cascade,
  destination_contact_id bigint not null references public.contacts(id) on update cascade,
  merged_at timestamptz not null default now(),
  -- Who decided. A person, or the named process that did it.
  actor text not null,
  -- Why it was safe: the deterministic evidence, in words.
  evidence text not null,
  -- What moved, per table, so the merge can be explained and audited.
  moved_counts jsonb not null default '{}'::jsonb,
  constraint contact_merges_distinct check (source_contact_id <> destination_contact_id)
);

create index if not exists contact_merges_source_idx on public.contact_merges (source_contact_id);
create index if not exists contact_merges_destination_idx on public.contact_merges (destination_contact_id);

comment on table public.contact_merges is
  'One row per Contact merge, so the CRM can answer "Contact X was merged into Contact Y on DATE, by whom, and on what evidence".';

alter table public.contact_merges enable row level security;
drop policy if exists "Contact merges are readable" on public.contact_merges;
create policy "Contact merges are readable"
  on public.contact_merges for select to authenticated using (true);
grant select on public.contact_merges to authenticated;
revoke all on public.contact_merges from anon;

-- ---------------------------------------------------------------------
-- 5. What would stop a merge being safe
-- ---------------------------------------------------------------------
-- Returned rather than decided. Two live Opportunities might be one
-- person applying twice, or might be two people who share a name — the
-- database cannot tell, and guessing is how the old merge destroyed data.
create or replace function public.contact_merge_conflicts(
  p_source bigint,
  p_destination bigint
) returns table (code text, detail text)
language plpgsql
stable
set search_path to 'public'
as $$
begin
  if p_source = p_destination then
    return query select 'same_contact'::text, 'A Contact cannot be merged into itself'::text;
    return;
  end if;
  if not exists (select 1 from contacts where id = p_source) then
    return query select 'source_missing'::text, format('Contact %s does not exist', p_source);
  end if;
  if not exists (select 1 from contacts where id = p_destination) then
    return query select 'destination_missing'::text, format('Contact %s does not exist', p_destination);
  end if;

  -- Different real addresses on each side. Legitimate for one human with
  -- two addresses; also exactly what two different humans look like.
  return query
  select 'different_emails'::text,
         format('%s address(es) on one side, %s on the other, none shared',
                (select count(*) from contact_email_addresses where contact_id = p_source),
                (select count(*) from contact_email_addresses where contact_id = p_destination))
   where exists (select 1 from contact_email_addresses where contact_id = p_source)
     and exists (select 1 from contact_email_addresses where contact_id = p_destination)
     and not exists (
       select 1 from contact_email_addresses a
        join contact_email_addresses b on b.normalized_email = a.normalized_email
       where a.contact_id = p_source and b.contact_id = p_destination);

  -- Both sides still in play. Merging identity is fine; assuming the two
  -- sales attempts are one is not, and somebody should look.
  return query
  select 'both_have_live_opportunities'::text,
         format('%s live on one side, %s on the other',
                (select count(*) from deals d where d.contact_id = p_source
                  and public.deal_is_active(d.archived_at, d.stage, d.outcome)),
                (select count(*) from deals d where d.contact_id = p_destination
                  and public.deal_is_active(d.archived_at, d.stage, d.outcome)))
   where (select count(*) from deals d where d.contact_id = p_source
           and public.deal_is_active(d.archived_at, d.stage, d.outcome)) > 0
     and (select count(*) from deals d where d.contact_id = p_destination
           and public.deal_is_active(d.archived_at, d.stage, d.outcome)) > 0;

  -- Two people cannot both be mid-programme and be one person.
  return query
  select 'both_have_active_enrollments'::text, 'Both Contacts have a non-terminal Enrollment'::text
   where exists (select 1 from enrollments e join deals d on d.id = e.opportunity_id
                  where d.contact_id = p_source and e.status not in ('completed','withdrawn','ended'))
     and exists (select 1 from enrollments e join deals d on d.id = e.opportunity_id
                  where d.contact_id = p_destination and e.status not in ('completed','withdrawn','ended'));

  -- Separate Stripe customers may be one person's two checkouts, or two
  -- people's money. Never guessed.
  return query
  select 'different_stripe_customers'::text,
         format('%s Stripe customer(s) on one side, %s on the other',
                (select count(*) from contact_stripe_customers where contact_id = p_source),
                (select count(*) from contact_stripe_customers where contact_id = p_destination))
   where (select count(*) from contact_stripe_customers where contact_id = p_source) > 0
     and (select count(*) from contact_stripe_customers where contact_id = p_destination) > 0;

  -- The same provider identity already naming the other Contact is the
  -- one case that is evidence FOR a merge; a DIFFERENT one on each side
  -- for the same provider+account is evidence against.
  return query
  select 'conflicting_provider_identity'::text,
         format('both hold a different %s identity', a.provider)
    from contact_external_identities a
    join contact_external_identities b
      on b.provider = a.provider
     and b.provider_account_id is not distinct from a.provider_account_id
     and b.external_user_id <> a.external_user_id
   where a.contact_id = p_source and b.contact_id = p_destination
   group by a.provider;

  -- Already merged away.
  return query
  select 'already_merged'::text,
         format('Contact %s was already merged into %s', p_source, c.merged_into_contact_id)
    from contacts c where c.id = p_source and c.merged_into_contact_id is not null;
end;
$$;

comment on function public.contact_merge_conflicts(bigint, bigint) is
  'Everything that makes a merge a judgement call rather than a fact. Reports; never decides. An empty result means the evidence is unambiguous.';

commit;
