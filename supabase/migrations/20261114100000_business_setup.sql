-- Business setup (stage 1.4): structure as in supabase/schemas/12_business_setup.sql,
-- plus the new create_business() and handle_new_user() (02_functions.sql).
--

-- Business templates of the TZ (section 1): services, retail, small production
-- and wholesale, B2B services
alter table public.businesses add column business_type text;
alter table public.businesses
    add constraint businesses_business_type check (business_type in ('services', 'retail', 'production', 'b2b'));

-- Changes the role of a member of the current business, or disables them
-- there. Only an owner can, and a business always keeps an active owner
-- (protect_last_owner).
CREATE OR REPLACE FUNCTION "public"."set_member"("p_user_id" "uuid", "p_role" "public"."business_role" DEFAULT NULL, "p_disabled" boolean DEFAULT NULL) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_business_id uuid := public.current_business_id();
begin
  if not coalesce(public.current_business_role() = 'owner', false) then
    raise exception 'Only an owner can change the members of a business' using errcode = '42501';
  end if;

  update public.members m
  set role = coalesce(p_role, m.role),
      disabled = coalesce(p_disabled, m.disabled)
  where m.business_id = v_business_id and m.user_id = p_user_id;

  if not found then
    raise exception 'Not a member of this business' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_member(uuid, public.business_role, boolean) from public, anon;
grant all on function public.set_member(uuid, public.business_role, boolean) to authenticated;
grant all on function public.set_member(uuid, public.business_role, boolean) to service_role;

-- create_business() now takes the kind of business and the requisites, so the
-- setup wizard creates a complete business in one call.
drop function if exists public.create_business(text, text);

CREATE OR REPLACE FUNCTION "public"."create_business"("p_name" "text", "p_country_code" "text" DEFAULT NULL::"text", "p_business_type" "text" DEFAULT NULL::"text", "p_requisites" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  new_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.businesses (name, country_code, business_type, requisites, created_by)
  values (btrim(p_name), p_country_code, p_business_type, coalesce(p_requisites, '{}'::jsonb), auth.uid())
  returning id into new_business_id;

  insert into public.members (business_id, user_id, role)
  values (new_business_id, auth.uid(), 'owner');

  insert into public.configuration (id) values (new_business_id);

  update public.sales set current_business_id = new_business_id where user_id = auth.uid();

  return new_business_id;
end;
$$;

revoke all on function public.create_business(text, text, text, jsonb) from public, anon;
grant all on function public.create_business(text, text, text, jsonb) to authenticated;
grant all on function public.create_business(text, text, text, jsonb) to service_role;

-- Sign up: invited users join the inviting business. Everyone else starts with
-- no business and creates one in the setup wizard.
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  invited_business_id uuid;
  invited_role public.business_role;
  demo_business_id uuid;
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
    update public.sales set current_business_id = demo_business_id where user_id = new.id;
  end if;

  return new;
end;
$$;
