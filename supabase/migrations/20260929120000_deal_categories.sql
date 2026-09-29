alter table "public"."deals" add column "category_amounts" jsonb not null default '[]'::jsonb;

alter table "public"."deals" add constraint "deals_category_amounts_is_array" check (jsonb_typeof(category_amounts) = 'array');

alter table "public"."deals" add constraint "deals_category_amounts_numeric" check (not jsonb_path_exists(category_amounts, '$[*] ? (!exists(@.amount) || @.amount.type() != "number")'));

-- Move each deal's single category and amount into one category line
update "public"."deals"
set category_amounts = jsonb_build_array(
  jsonb_build_object(
    'category', nullif(category, ''),
    'amount', coalesce(amount, 0)
  )
)
where coalesce(category, '') <> '' or coalesce(amount, 0) <> 0;

alter table "public"."deals" drop column "category";

alter table "public"."deals" drop column "amount";

set check_function_bodies = off;

-- Computed field: the amount of a deal, the sum of its category_amounts. PostgREST
-- filters and sorts on it like a column (deals?order=amount.desc) without returning it.
CREATE OR REPLACE FUNCTION public.amount(public.deals)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(sum((line->>'amount')::numeric), 0)
  from jsonb_array_elements($1.category_amounts) as line;
$function$
;

-- Computed field: the categories of a deal, from its category_amounts. PostgREST
-- filters it like a column (deals?categories=cs.{a,b}) without returning it.
CREATE OR REPLACE FUNCTION public.categories(public.deals)
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(array_agg(distinct line->>'category'), '{}')
  from jsonb_array_elements($1.category_amounts) as line
  where coalesce(line->>'category', '') <> '';
$function$
;

grant execute on function "public"."amount"(public.deals) to "anon";

grant execute on function "public"."amount"(public.deals) to "authenticated";

grant execute on function "public"."amount"(public.deals) to "service_role";

grant execute on function "public"."categories"(public.deals) to "anon";

grant execute on function "public"."categories"(public.deals) to "authenticated";

grant execute on function "public"."categories"(public.deals) to "service_role";
