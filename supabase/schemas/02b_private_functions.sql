--
-- Private functions
-- SECURITY DEFINER helpers, kept out of the API-exposed schema so they are not
-- reachable as /rest/v1/rpc/<name> (linters 0028 / 0029).
--

create schema if not exists private;

grant usage on schema private to anon;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

CREATE OR REPLACE FUNCTION "private"."get_init_state"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return (select count(sub.id) from (select id from public.sales limit 1) sub);
end;
$$;

CREATE OR REPLACE FUNCTION "private"."is_active_sales"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1 from public.sales
    where user_id = auth.uid() and disabled = false
  );
end;
$$;

CREATE OR REPLACE FUNCTION "private"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1 from public.sales where user_id = auth.uid() and administrator = true
  );
end;
$$;

-- init_state view runs with security_invoker, so anon needs EXECUTE to read it.
grant all on function private.get_init_state() to anon;
grant all on function private.get_init_state() to authenticated;
grant all on function private.get_init_state() to service_role;

-- Evaluated inside RLS policies as the querying role.
grant all on function private.is_active_sales() to authenticated;
grant all on function private.is_active_sales() to service_role;

grant all on function private.is_admin() to authenticated;
grant all on function private.is_admin() to service_role;
