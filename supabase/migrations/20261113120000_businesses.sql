-- Multi-business isolation.
--
-- Every row of business data belongs to a business (business_id). A user can
-- be a member of several businesses and works in one of them at a time: the
-- "current business", stored in sales.current_business_id. Row Level Security
-- only lets a user see and change rows of their current business.
--
-- Existing data (an install upgraded from single-business Atomic CRM) is moved
-- into one business named "My business", owned by the former administrators.

--
-- Businesses and members
--

create type "public"."business_role" as enum (
    'owner',
    'manager',
    'specialist',
    'storekeeper',
    'accountant',
    'partner'
);

create table "public"."businesses" (
    "id" uuid not null default gen_random_uuid() primary key,
    "name" text not null,
    "country_code" text,
    "is_demo" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid references auth.users(id) on delete set null,
    constraint "businesses_name_length" check (length(btrim("name")) between 1 and 200),
    -- Sanctions: businesses from Russia and Belarus are not served (TZ section 2)
    constraint "businesses_country_code_format" check ("country_code" ~ '^[A-Z]{2}$' and "country_code" not in ('RU', 'BY'))
);

create table "public"."members" (
    "business_id" uuid not null references public.businesses(id) on delete cascade,
    "user_id" uuid not null references auth.users(id) on delete cascade,
    "role" public.business_role not null,
    "disabled" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    primary key ("business_id", "user_id")
);

create index "members_user_id_idx" on public.members using btree (user_id);

alter table "public"."sales"
    add column "current_business_id" uuid references public.businesses(id) on delete set null;

alter table "public"."user_invitations"
    add column "business_id" uuid references public.businesses(id) on delete cascade,
    add column "role" public.business_role;

--
-- Current business helpers
--

-- The business a user works in, and their role there. Falls back to the
-- user's oldest active membership when the stored current business is unset
-- or no longer valid (deleted business, removed or disabled membership).
CREATE OR REPLACE FUNCTION "public"."business_context_for_user"("p_user_id" uuid)
    RETURNS TABLE("business_id" uuid, "role" public.business_role)
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

CREATE OR REPLACE FUNCTION "public"."current_business_id"() RETURNS uuid
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ select business_id from public.business_context_for_user(auth.uid()) $$;

CREATE OR REPLACE FUNCTION "public"."current_business_role"() RETURNS public.business_role
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ select role from public.business_context_for_user(auth.uid()) $$;

-- Accountants have read-only access (TZ section 5.9).
CREATE OR REPLACE FUNCTION "public"."can_write_current_business"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ select coalesce(public.current_business_role() <> 'accountant', false) $$;

-- Administrator now means owner of the current business.
CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return coalesce(public.current_business_role() = 'owner', false);
end;
$$;

--
-- Move existing data into a business
--

alter table "public"."companies" add column "business_id" uuid;
alter table "public"."contacts" add column "business_id" uuid;
alter table "public"."contact_notes" add column "business_id" uuid;
alter table "public"."deals" add column "business_id" uuid;
alter table "public"."deal_notes" add column "business_id" uuid;
alter table "public"."tags" add column "business_id" uuid;
alter table "public"."tasks" add column "business_id" uuid;
alter table "public"."configuration" add column "business_id" uuid;

do $$
declare
  legacy_business_id uuid;
begin
  if exists (select 1 from public.sales)
    or exists (select 1 from public.companies)
    or exists (select 1 from public.contacts)
    or exists (select 1 from public.deals)
    or exists (select 1 from public.tags)
  then
    insert into public.businesses (name) values ('My business')
    returning id into legacy_business_id;

    insert into public.members (business_id, user_id, role, disabled)
    select legacy_business_id, user_id,
      case when administrator then 'owner'::public.business_role else 'manager'::public.business_role end,
      disabled
    from public.sales;

    update public.sales set current_business_id = legacy_business_id;
    update public.companies set business_id = legacy_business_id;
    update public.contacts set business_id = legacy_business_id;
    update public.contact_notes set business_id = legacy_business_id;
    update public.deals set business_id = legacy_business_id;
    update public.deal_notes set business_id = legacy_business_id;
    update public.tags set business_id = legacy_business_id;
    update public.tasks set business_id = legacy_business_id;
    update public.configuration set business_id = legacy_business_id;
  end if;
end $$;

-- Pending invitations of the single-business era have no business: drop them.
delete from public.user_invitations where business_id is null;

--
-- business_id: required, defaults to the current business, cascades on delete
--

alter table "public"."companies"
    alter column "business_id" set not null,
    alter column "business_id" set default public.current_business_id(),
    add constraint "companies_business_id_fkey" foreign key (business_id) references public.businesses(id) on delete cascade;
alter table "public"."contacts"
    alter column "business_id" set not null,
    alter column "business_id" set default public.current_business_id(),
    add constraint "contacts_business_id_fkey" foreign key (business_id) references public.businesses(id) on delete cascade;
alter table "public"."contact_notes"
    alter column "business_id" set not null,
    alter column "business_id" set default public.current_business_id(),
    add constraint "contact_notes_business_id_fkey" foreign key (business_id) references public.businesses(id) on delete cascade;
alter table "public"."deals"
    alter column "business_id" set not null,
    alter column "business_id" set default public.current_business_id(),
    add constraint "deals_business_id_fkey" foreign key (business_id) references public.businesses(id) on delete cascade;
alter table "public"."deal_notes"
    alter column "business_id" set not null,
    alter column "business_id" set default public.current_business_id(),
    add constraint "deal_notes_business_id_fkey" foreign key (business_id) references public.businesses(id) on delete cascade;
alter table "public"."tags"
    alter column "business_id" set not null,
    alter column "business_id" set default public.current_business_id(),
    add constraint "tags_business_id_fkey" foreign key (business_id) references public.businesses(id) on delete cascade;
alter table "public"."tasks"
    alter column "business_id" set not null,
    alter column "business_id" set default public.current_business_id(),
    add constraint "tasks_business_id_fkey" foreign key (business_id) references public.businesses(id) on delete cascade;

create index "companies_business_id_idx" on public.companies using btree (business_id);
create index "contacts_business_id_idx" on public.contacts using btree (business_id);
create index "contact_notes_business_id_idx" on public.contact_notes using btree (business_id);
create index "deals_business_id_idx" on public.deals using btree (business_id);
create index "deal_notes_business_id_idx" on public.deal_notes using btree (business_id);
create index "tags_business_id_idx" on public.tags using btree (business_id);
create index "tasks_business_id_idx" on public.tasks using btree (business_id);

-- Configuration: one row per business, keyed by the business id.
delete from public.configuration where business_id is null;
alter table "public"."configuration" drop constraint "configuration_singleton";
alter table "public"."configuration" drop constraint "configuration_pkey";
alter table "public"."configuration" drop column "id";
alter table "public"."configuration" rename column "business_id" to "id";
alter table "public"."configuration"
    alter column "id" set not null,
    alter column "id" set default public.current_business_id(),
    add constraint "configuration_pkey" primary key (id),
    add constraint "configuration_id_fkey" foreign key (id) references public.businesses(id) on delete cascade;

--
-- A row may only reference rows of its own business
--

alter table "public"."companies" add constraint "companies_id_business_id_key" unique (id, business_id);
alter table "public"."contacts" add constraint "contacts_id_business_id_key" unique (id, business_id);
alter table "public"."deals" add constraint "deals_id_business_id_key" unique (id, business_id);

alter table "public"."contacts" drop constraint "contacts_company_id_fkey";
alter table "public"."contacts"
    add constraint "contacts_company_id_fkey" foreign key (company_id, business_id) references public.companies(id, business_id) on update cascade on delete cascade;

alter table "public"."contact_notes" drop constraint "contactNotes_contact_id_fkey";
alter table "public"."contact_notes"
    add constraint "contactNotes_contact_id_fkey" foreign key (contact_id, business_id) references public.contacts(id, business_id) on update cascade on delete cascade;

alter table "public"."deals" drop constraint "deals_company_id_fkey";
alter table "public"."deals"
    add constraint "deals_company_id_fkey" foreign key (company_id, business_id) references public.companies(id, business_id) on update cascade on delete cascade;

alter table "public"."deal_notes" drop constraint "dealNotes_deal_id_fkey";
alter table "public"."deal_notes"
    add constraint "dealNotes_deal_id_fkey" foreign key (deal_id, business_id) references public.deals(id, business_id) on update cascade on delete cascade;

alter table "public"."tasks" drop constraint "tasks_contact_id_fkey";
alter table "public"."tasks"
    add constraint "tasks_contact_id_fkey" foreign key (contact_id, business_id) references public.contacts(id, business_id) on update cascade on delete cascade;

-- Array references (contacts.tags, deals.contact_ids) cannot be foreign keys.
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

create or replace trigger "05_check_same_business_references"
    before insert or update of tags, business_id on public.contacts
    for each row execute function public.check_same_business_references();

create or replace trigger "check_same_business_references"
    before insert or update of contact_ids, business_id on public.deals
    for each row execute function public.check_same_business_references();

--
-- Sales: administrator and disabled now depend on the business
--

alter table "public"."sales" drop column "administrator";
alter table "public"."sales" drop column "disabled";

-- Computed fields (PostgREST): sales.administrator and sales.disabled, as seen
-- from the current business of the requesting user.
CREATE OR REPLACE FUNCTION "public"."administrator"("sale" public.sales) RETURNS boolean
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

CREATE OR REPLACE FUNCTION "public"."disabled"("sale" public.sales) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select coalesce((
        select m.disabled from public.members m
        where m.user_id = sale.user_id
          and m.business_id = public.current_business_id()
    ), true)
$$;

-- Users visible to the requesting user: themselves and the members of their
-- current business.
CREATE OR REPLACE FUNCTION "public"."is_visible_user"("p_user_id" uuid) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select p_user_id = auth.uid() or exists (
        select 1 from public.members m
        where m.user_id = p_user_id and m.business_id = public.current_business_id()
    )
$$;

--
-- A business always keeps at least one active owner
--

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

create or replace trigger "protect_last_owner"
    before update or delete on public.members
    for each row execute function public.protect_last_owner();

--
-- Business lifecycle
--

CREATE OR REPLACE FUNCTION "public"."create_business"("p_name" text, "p_country_code" text DEFAULT NULL) RETURNS uuid
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

CREATE OR REPLACE FUNCTION "public"."switch_business"("p_business_id" uuid) RETURNS void
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

-- Deletes a business with all its data. Only an owner can do it, and must
-- type the business name to confirm.
CREATE OR REPLACE FUNCTION "public"."delete_business"("p_business_id" uuid, "p_confirm_name" text) RETURNS void
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

--
-- Sign up: anyone can create an account. Invited users join the inviting
-- business; others get a business of their own.
--

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

--
-- Row Level Security
--

alter table public.businesses enable row level security;
alter table public.members enable row level security;

drop policy "Enable read access for authenticated users" on public.companies;
drop policy "Enable insert for authenticated users only" on public.companies;
drop policy "Enable update for authenticated users only" on public.companies;
drop policy "Company Delete Policy" on public.companies;
drop policy "Enable read access for authenticated users" on public.contacts;
drop policy "Enable insert for authenticated users only" on public.contacts;
drop policy "Enable update for authenticated users only" on public.contacts;
drop policy "Contact Delete Policy" on public.contacts;
drop policy "Enable read access for authenticated users" on public.contact_notes;
drop policy "Enable insert for authenticated users only" on public.contact_notes;
drop policy "Contact Notes Update policy" on public.contact_notes;
drop policy "Contact Notes Delete Policy" on public.contact_notes;
drop policy "Enable read access for authenticated users" on public.deals;
drop policy "Enable insert for authenticated users only" on public.deals;
drop policy "Enable update for authenticated users only" on public.deals;
drop policy "Deals Delete Policy" on public.deals;
drop policy "Enable read access for authenticated users" on public.deal_notes;
drop policy "Enable insert for authenticated users only" on public.deal_notes;
drop policy "Deal Notes Update Policy" on public.deal_notes;
drop policy "Deal Notes Delete Policy" on public.deal_notes;
drop policy "Enable read access for authenticated users" on public.sales;
drop policy "Enable read access for authenticated users" on public.tags;
drop policy "Enable insert for authenticated users only" on public.tags;
drop policy "Enable update for authenticated users only" on public.tags;
drop policy "Enable delete for authenticated users only" on public.tags;
drop policy "Enable read access for authenticated users" on public.tasks;
drop policy "Enable insert for authenticated users only" on public.tasks;
drop policy "Task Update Policy" on public.tasks;
drop policy "Task Delete Policy" on public.tasks;
drop policy "Enable read for authenticated" on public.configuration;
drop policy "Enable insert for admins" on public.configuration;
drop policy "Enable update for admins" on public.configuration;

-- Business data: members of the current business read, non-accountants write.
create policy "Business read" on public.companies for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.companies for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.companies for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.companies for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.contacts for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.contacts for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.contacts for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.contacts for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.contact_notes for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.contact_notes for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.contact_notes for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.contact_notes for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.deals for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.deals for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.deals for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.deals for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.deal_notes for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.deal_notes for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.deal_notes for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.deal_notes for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.tags for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.tags for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.tags for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.tags for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.tasks for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.tasks for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.tasks for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.tasks for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

-- Configuration: members read, owners write.
create policy "Business read" on public.configuration for select to authenticated using (id = (select public.current_business_id()));
create policy "Owner insert" on public.configuration for insert to authenticated with check (id = (select public.current_business_id()) and (select public.is_admin()));
create policy "Owner update" on public.configuration for update to authenticated using (id = (select public.current_business_id()) and (select public.is_admin())) with check (id = (select public.current_business_id()));

-- Sales (user profiles): yourself and the members of your current business.
create policy "Visible users" on public.sales for select to authenticated using ((select auth.uid()) = user_id or public.is_visible_user(user_id));

-- Businesses: your own memberships; owners rename. Created and deleted through functions.
create policy "Member read" on public.businesses for select to authenticated using (
    exists (select 1 from public.members m where m.business_id = id and m.user_id = (select auth.uid()) and not m.disabled)
);
create policy "Owner update" on public.businesses for update to authenticated using (id = (select public.current_business_id()) and (select public.is_admin())) with check (id = (select public.current_business_id()));

-- Members: your own memberships and the members of your current business. Changed through functions.
create policy "Member read" on public.members for select to authenticated using (user_id = (select auth.uid()) or business_id = (select public.current_business_id()));

--
-- Grants (no default privileges: every object declares its own)
--

revoke all on function public.business_context_for_user(uuid) from public, anon, authenticated;
grant execute on function public.business_context_for_user(uuid) to service_role;

grant execute on function public.current_business_id() to authenticated, service_role;
grant execute on function public.current_business_role() to authenticated, service_role;
grant execute on function public.can_write_current_business() to authenticated, service_role;
grant execute on function public.check_same_business_references() to authenticated, service_role;
grant execute on function public.administrator(public.sales) to authenticated, service_role;
grant execute on function public.disabled(public.sales) to authenticated, service_role;
grant execute on function public.is_visible_user(uuid) to authenticated, service_role;
grant execute on function public.protect_last_owner() to authenticated, service_role;
grant execute on function public.create_business(text, text) to authenticated, service_role;
grant execute on function public.switch_business(uuid) to authenticated, service_role;
grant execute on function public.delete_business(uuid, text) to authenticated, service_role;
revoke execute on function public.current_business_id() from public, anon;
revoke execute on function public.current_business_role() from public, anon;
revoke execute on function public.can_write_current_business() from public, anon;
-- anon may evaluate the sales computed fields (always false without a
-- business): requests sent while signing in must not fail on them.
revoke execute on function public.administrator(public.sales) from public;
revoke execute on function public.disabled(public.sales) from public;
grant execute on function public.administrator(public.sales) to anon;
grant execute on function public.disabled(public.sales) to anon;
revoke execute on function public.is_visible_user(uuid) from public, anon;
revoke execute on function public.create_business(text, text) from public, anon;
revoke execute on function public.switch_business(uuid) from public, anon;
revoke execute on function public.delete_business(uuid, text) from public, anon;

grant select, update on table public.businesses to authenticated;
grant all on table public.businesses to service_role;
grant select on table public.members to authenticated;
grant all on table public.members to service_role;
