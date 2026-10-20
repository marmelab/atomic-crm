set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_sales_preferences(patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  updated_preferences jsonb;
begin
  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception 'patch must be a JSON object' using errcode = '22023';
  end if;

  update public.sales
  set preferences = coalesce(preferences, '{}'::jsonb) || patch
  where user_id = auth.uid()
  returning preferences into updated_preferences;

  if not found then
    raise exception 'No sales record found for the current user' using errcode = 'P0002';
  end if;

  return updated_preferences;
end;
$function$
;

revoke all on function public.update_sales_preferences(jsonb) from public;
revoke all on function public.update_sales_preferences(jsonb) from anon;
grant execute on function public.update_sales_preferences(jsonb) to authenticated;
grant execute on function public.update_sales_preferences(jsonb) to service_role;
