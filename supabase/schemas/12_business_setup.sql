--
-- Business setup (stage 1.4)
-- A new user creates their business in the setup wizard: name, country, kind
-- of business, requisites. Owners manage the members of their business.
-- create_business() and handle_new_user() themselves live in 02_functions.sql.
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
