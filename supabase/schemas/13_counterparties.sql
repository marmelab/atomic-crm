--
-- Counterparties (TZ section 5.1)
-- A company row is a counterparty: a company, a sole proprietor or a private
-- person, with one or more roles (client, supplier, partner). Its requisites
-- follow the country pack of its own country, which may differ from the
-- business country; a counterparty from a country without a pack has a VAT ID
-- (EU) and a free-text tax number (companies.tax_identifier).
--

alter table public.companies add column kind text not null default 'company';
alter table public.companies add column roles text[] not null default '{client}'::text[];
alter table public.companies add column country_code text;
alter table public.companies add column requisites jsonb not null default '{}'::jsonb;
-- EU VAT number with its country prefix (PL7740001454), checked by VIES
alter table public.companies add column vat_id text;
alter table public.companies add column vat_status text;
alter table public.companies add column vat_checked_at timestamp with time zone;
-- Terms: currency of the counterparty (the business currency when empty),
-- payment delay in days, credit limit in minor units of that currency
alter table public.companies add column currency text;
alter table public.companies add column payment_terms_days integer;
alter table public.companies add column credit_limit bigint;

alter table public.companies
    add constraint companies_kind check (kind in ('company', 'sole_proprietor', 'person'));
alter table public.companies
    add constraint companies_roles check (cardinality(roles) >= 1 and roles <@ array['client', 'supplier', 'partner']);
alter table public.companies
    add constraint companies_country_code_format check (country_code ~ '^[A-Z]{2}$');
alter table public.companies
    add constraint companies_requisites_is_object check (jsonb_typeof(requisites) = 'object');
alter table public.companies
    add constraint companies_vat_id_format check (vat_id ~ '^[A-Z]{2}[0-9A-Z+*]{2,12}$');
alter table public.companies
    add constraint companies_vat_status check (vat_status in ('valid', 'invalid', 'unavailable'));
alter table public.companies
    add constraint companies_currency_format check (currency ~ '^[A-Z]{3}$');
alter table public.companies
    add constraint companies_payment_terms_days check (payment_terms_days between 0 and 365);
alter table public.companies
    add constraint companies_credit_limit check (credit_limit >= 0);

create index companies_roles_idx on public.companies using gin (roles);

-- Normalizes requisites against the fields of a country pack; unknown fields
-- and invalid values are rejected (SQLSTATE 23514, the keys in the detail).
-- A country without a pack has no requisite fields.
CREATE OR REPLACE FUNCTION "public"."validated_requisites"("p_country_code" "text", "p_requisites" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION "public"."check_company_requisites"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
$$;

create or replace trigger check_company_requisites
    before insert or update of requisites, country_code, vat_id on public.companies
    for each row execute function public.check_company_requisites();

-- Counterparties of the current business that share a requisite value (tax
-- number, IBAN) or the VAT ID with the one being edited (p_id, null for a new
-- one). Runs with the rights of the caller: row level security applies.
CREATE OR REPLACE FUNCTION "public"."company_duplicates"("p_id" bigint, "p_requisites" "jsonb", "p_vat_id" "text") RETURNS TABLE("id" bigint, "name" "text", "matched" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
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
$$;

revoke all on function public.validated_requisites(text, jsonb) from public, anon;
grant all on function public.validated_requisites(text, jsonb) to authenticated;
grant all on function public.validated_requisites(text, jsonb) to service_role;

grant all on function public.check_company_requisites() to authenticated;
grant all on function public.check_company_requisites() to service_role;

revoke all on function public.company_duplicates(bigint, jsonb, text) from public, anon;
grant all on function public.company_duplicates(bigint, jsonb, text) to authenticated;
grant all on function public.company_duplicates(bigint, jsonb, text) to service_role;

-- Counterparties with their number of deals and contacts. Declared here, after
-- the counterparty columns it lists.
create or replace view public.companies_summary with (security_invoker = on) as
select
    c.id,
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
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts
from public.companies c
    left join public.deals d on c.id = d.company_id
    left join public.contacts co on c.id = co.company_id
group by c.id;

grant all on table public.companies_summary to anon;
grant all on table public.companies_summary to authenticated;
grant all on table public.companies_summary to service_role;
