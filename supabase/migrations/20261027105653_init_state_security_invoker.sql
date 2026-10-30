-- Fix the Security Advisor "security_definer_view" error on public.init_state.
-- The view stays readable by anon before login, but the privileged read of
-- public.sales now lives in a SECURITY DEFINER function returning a boolean.

CREATE OR REPLACE FUNCTION public.is_initialized()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.sales);
$function$
;

grant all on function public.is_initialized() to anon;
grant all on function public.is_initialized() to authenticated;
grant all on function public.is_initialized() to service_role;

create or replace view public.init_state with (security_invoker = on) as
select public.is_initialized()::integer::bigint as is_initialized;
