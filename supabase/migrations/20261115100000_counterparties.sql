-- Counterparties: kind, roles, country, requisites, VAT ID and terms (stage 2.1)
drop view if exists "public"."companies_summary";

alter table "public"."companies" add column "country_code" text;

alter table "public"."companies" add column "credit_limit" bigint;

alter table "public"."companies" add column "currency" text;

alter table "public"."companies" add column "kind" text not null default 'company'::text;

alter table "public"."companies" add column "payment_terms_days" integer;

alter table "public"."companies" add column "requisites" jsonb not null default '{}'::jsonb;

alter table "public"."companies" add column "roles" text[] not null default '{client}'::text[];

alter table "public"."companies" add column "vat_checked_at" timestamp with time zone;

alter table "public"."companies" add column "vat_id" text;

alter table "public"."companies" add column "vat_status" text;

CREATE INDEX companies_roles_idx ON public.companies USING gin (roles);

alter table "public"."companies" add constraint "companies_country_code_format" CHECK ((country_code ~ '^[A-Z]{2}$'::text)) not valid;

alter table "public"."companies" validate constraint "companies_country_code_format";

alter table "public"."companies" add constraint "companies_credit_limit" CHECK ((credit_limit >= 0)) not valid;

alter table "public"."companies" validate constraint "companies_credit_limit";

alter table "public"."companies" add constraint "companies_currency_format" CHECK ((currency ~ '^[A-Z]{3}$'::text)) not valid;

alter table "public"."companies" validate constraint "companies_currency_format";

alter table "public"."companies" add constraint "companies_kind" CHECK ((kind = ANY (ARRAY['company'::text, 'sole_proprietor'::text, 'person'::text]))) not valid;

alter table "public"."companies" validate constraint "companies_kind";

alter table "public"."companies" add constraint "companies_payment_terms_days" CHECK (((payment_terms_days >= 0) AND (payment_terms_days <= 365))) not valid;

alter table "public"."companies" validate constraint "companies_payment_terms_days";

alter table "public"."companies" add constraint "companies_requisites_is_object" CHECK ((jsonb_typeof(requisites) = 'object'::text)) not valid;

alter table "public"."companies" validate constraint "companies_requisites_is_object";

alter table "public"."companies" add constraint "companies_roles" CHECK (((cardinality(roles) >= 1) AND (roles <@ ARRAY['client'::text, 'supplier'::text, 'partner'::text]))) not valid;

alter table "public"."companies" validate constraint "companies_roles";

alter table "public"."companies" add constraint "companies_vat_id_format" CHECK ((vat_id ~ '^[A-Z]{2}[0-9A-Z+*]{2,12}$'::text)) not valid;

alter table "public"."companies" validate constraint "companies_vat_id_format";

alter table "public"."companies" add constraint "companies_vat_status" CHECK ((vat_status = ANY (ARRAY['valid'::text, 'invalid'::text, 'unavailable'::text]))) not valid;

alter table "public"."companies" validate constraint "companies_vat_status";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_company_requisites()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.vat_id := nullif(upper(regexp_replace(coalesce(new.vat_id, ''), '[\s.-]', '', 'g')), '');
  if new.requisites = '{}'::jsonb then
    return new;
  end if;
  if new.country_code is null then
    raise exception 'Choose the country of the counterparty before its requisites'
      using errcode = '23514';
  end if;
  new.requisites := public.validated_requisites(new.country_code, new.requisites);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.company_duplicates(p_id bigint, p_requisites jsonb, p_vat_id text)
 RETURNS TABLE(id bigint, name text, matched text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
    select c.id, c.name, r.key
    from public.companies c
    cross join lateral jsonb_each_text(coalesce(p_requisites, '{}'::jsonb)) r
    where c.id is distinct from p_id
      and r.value <> ''
      and upper(regexp_replace(c.requisites ->> r.key, '[\s-]', '', 'g'))
          = upper(regexp_replace(r.value, '[\s-]', '', 'g'))
    union
    select c.id, c.name, 'vat_id'
    from public.companies c
    where c.id is distinct from p_id
      and coalesce(p_vat_id, '') <> ''
      and c.vat_id = upper(regexp_replace(p_vat_id, '[\s.-]', '', 'g'))
$function$
;

CREATE OR REPLACE FUNCTION public.validated_requisites(p_country_code text, p_requisites jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  item record;
  field public.requisite_fields;
  normalized jsonb := '{}'::jsonb;
  invalid text[] := '{}';
begin
  for item in select key, value from jsonb_each(p_requisites) loop
    select * into field from public.active_requisite_fields(p_country_code) f where f.key = item.key;
    if not found or jsonb_typeof(item.value) <> 'string' then
      invalid := invalid || item.key;
      continue;
    end if;
    if item.value #>> '{}' = '' then
      continue;
    end if;
    if not public.requisite_is_valid(field.validator, item.value #>> '{}') then
      invalid := invalid || item.key;
      continue;
    end if;
    normalized := normalized || jsonb_build_object(item.key, public.normalize_requisite(field.validator, item.value #>> '{}'));
  end loop;

  if array_length(invalid, 1) > 0 then
    raise exception 'Invalid requisites: %', array_to_string(invalid, ', ')
      using errcode = '23514', detail = array_to_string(invalid, ',');
  end if;

  return normalized;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_business_requisites()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.requisites = '{}'::jsonb then
    return new;
  end if;

  if new.country_code is null then
    raise exception 'Choose the country of the business before its requisites'
      using errcode = '23514';
  end if;

  -- public.validated_requisites() lives in 13_counterparties.sql
  new.requisites := public.validated_requisites(new.country_code, new.requisites);
  return new;
end;
$function$
;

create or replace view "public"."companies_summary" with (security_invoker = on) as  SELECT c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    c.kind,
    c.roles,
    c.country_code,
    c.requisites,
    c.vat_id,
    c.vat_status,
    c.vat_checked_at,
    c.currency,
    c.payment_terms_days,
    c.credit_limit,
    count(DISTINCT d.id) AS nb_deals,
    count(DISTINCT co.id) AS nb_contacts
   FROM ((public.companies c
     LEFT JOIN public.deals d ON ((c.id = d.company_id)))
     LEFT JOIN public.contacts co ON ((c.id = co.company_id)))
  GROUP BY c.id;

grant all on table public.companies_summary to anon;
grant all on table public.companies_summary to authenticated;
grant all on table public.companies_summary to service_role;


CREATE TRIGGER check_company_requisites BEFORE INSERT OR UPDATE OF requisites, country_code, vat_id ON public.companies FOR EACH ROW EXECUTE FUNCTION public.check_company_requisites();

revoke all on function public.validated_requisites(text, jsonb) from public, anon;
grant all on function public.validated_requisites(text, jsonb) to authenticated;
grant all on function public.validated_requisites(text, jsonb) to service_role;

grant all on function public.check_company_requisites() to authenticated;
grant all on function public.check_company_requisites() to service_role;

revoke all on function public.company_duplicates(bigint, jsonb, text) from public, anon;
grant all on function public.company_duplicates(bigint, jsonb, text) to authenticated;
grant all on function public.company_duplicates(bigint, jsonb, text) to service_role;
