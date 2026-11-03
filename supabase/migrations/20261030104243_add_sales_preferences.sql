alter table "public"."sales" add column if not exists "preferences" jsonb;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_sales_preferences(patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  updated_preferences jsonb;
begin
  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception 'patch must be a JSON object' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_object_keys(patch) as key
    where key not in ('theme', 'locale')
  ) then
    raise exception 'patch only accepts the theme and locale keys' using errcode = '22023';
  end if;

  if patch ? 'theme' and coalesce(patch ->> 'theme', '') not in ('light', 'dark', 'system') then
    raise exception 'theme must be light, dark or system' using errcode = '22023';
  end if;

  if patch ? 'locale' and (
    jsonb_typeof(patch -> 'locale') <> 'string'
    or length(patch ->> 'locale') > 35
    or patch ->> 'locale' !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
  ) then
    raise exception 'locale must be a BCP 47 language tag' using errcode = '22023';
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
