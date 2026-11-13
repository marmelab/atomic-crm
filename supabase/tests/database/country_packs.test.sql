-- Country pack tests (run with: npx supabase test db)
--
-- Packs are data: Ukraine and Poland exist with their currency, time zone,
-- requisite fields and tax rates. A business only stores valid requisites of
-- its country, normalized. Russia and Belarus are refused. Signed-in users read
-- the reference data but cannot change it.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(30);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.local', '{}', 'authenticated', 'authenticated');

--
-- The packs
--
select results_eq(
  $$ select code, currency, timezone, language from public.country_packs order by code $$,
  $$ values ('PL', 'PLN', 'Europe/Warsaw', 'pl'), ('UA', 'UAH', 'Europe/Kyiv', 'uk') $$,
  'Poland and Ukraine packs exist with their currency, time zone and language');
select is((select count(*)::int from public.country_packs where code in ('RU', 'BY')), 0, 'there is no pack for Russia or Belarus');
select throws_ok($$ insert into public.country_packs (code, name, language, locale, currency, timezone) values ('RU', 'Russia', 'ru', 'ru-RU', 'RUB', 'Europe/Moscow') $$, '23514', null, 'a pack for Russia cannot be added');
select throws_ok($$ insert into public.country_packs (code, name, language, locale, currency, timezone) values ('BY', 'Belarus', 'be', 'be-BY', 'BYN', 'Europe/Minsk') $$, '23514', null, 'a pack for Belarus cannot be added');

select results_eq(
  $$ select key from public.active_requisite_fields('UA') $$,
  $$ values ('edrpou'), ('ipn'), ('iban') $$,
  'Ukrainian requisites: EDRPOU, individual tax number, IBAN');
select results_eq(
  $$ select key from public.active_requisite_fields('PL') $$,
  $$ values ('nip'), ('regon'), ('iban') $$,
  'Polish requisites: NIP, REGON, IBAN');

select results_eq(
  $$ select rate from public.tax_rates where country_code = 'UA' and tax = 'vat' and valid_to is null order by rate desc $$,
  $$ values (20.000), (14.000), (7.000), (0.000) $$,
  'Ukrainian VAT rates');
select results_eq(
  $$ select rate from public.tax_rates where country_code = 'PL' and tax = 'vat' and valid_to is null order by rate desc $$,
  $$ values (23.000), (8.000), (5.000), (0.000) $$,
  'Polish VAT rates');

-- A rate change is a new row with dates, never an edit
select throws_ok(
  $$ insert into public.tax_rates (country_code, code, rate, label, valid_from) values ('PL', 'standard', 25, 'VAT 25%', '2027-01-01') $$,
  '23P01', null, 'two rates cannot overlap in time');
select lives_ok(
  $$ update public.tax_rates set valid_to = '2027-01-01' where country_code = 'PL' and code = 'standard';
     insert into public.tax_rates (country_code, code, rate, label, valid_from) values ('PL', 'standard', 25, 'VAT 25%', '2027-01-01') $$,
  'a new rate follows the old one once the old one ends');

--
-- Requisites of a business
--
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');

select lives_ok($$ select public.create_business('Kyiv Studio', 'UA') $$, 'a Ukrainian business is created');
select lives_ok(
  $$ update public.businesses set requisites = '{"edrpou": "1436 0570", "iban": "ua21 3223 1300 0002 6007 2335 6600 1"}' where id = public.current_business_id() $$,
  'valid Ukrainian requisites are saved');
select is(
  (select requisites from public.businesses where id = public.current_business_id()),
  '{"edrpou": "14360570", "iban": "UA213223130000026007233566001"}'::jsonb,
  'requisites are stored normalized');
select is(public.missing_requisites('UA', (select requisites from public.businesses where id = public.current_business_id())), '{}'::text[], 'nothing is missing');
select is(public.missing_requisites('UA', '{"iban": "UA213223130000026007233566001"}'), array['tax_id'], 'a Ukrainian business needs an EDRPOU code or an individual tax number');
select throws_ok(
  $$ update public.businesses set requisites = '{"edrpou": "14360571"}' where id = public.current_business_id() $$,
  '23514', null, 'an EDRPOU code with a wrong check digit is refused');
select throws_ok(
  $$ update public.businesses set requisites = '{"nip": "7740001454"}' where id = public.current_business_id() $$,
  '23514', null, 'a Polish field is refused for a Ukrainian business');
select throws_ok(
  $$ update public.businesses set requisites = '{"iban": "RU0204452560040702810412345678901"}' where id = public.current_business_id() $$,
  '23514', null, 'a Russian bank account is refused');
select throws_ok(
  $$ update public.businesses set requisites = '{"edrpou": 14360570}' where id = public.current_business_id() $$,
  '23514', null, 'a requisite must be text');

select lives_ok($$ select public.create_business('Warsaw Shop', 'PL') $$, 'a Polish business is created');
select is(public.missing_requisites('PL', '{}'), array['nip'], 'a Polish business needs a NIP');
select throws_ok(
  $$ update public.businesses set requisites = '{"nip": "7740001455"}' where id = public.current_business_id() $$,
  '23514', null, 'a NIP with a wrong check digit is refused');
select lives_ok(
  $$ update public.businesses set requisites = '{"nip": "774-000-14-54", "regon": "610188201", "iban": "PL61 1090 1014 0000 0712 1981 2874"}' where id = public.current_business_id() $$,
  'valid Polish requisites are saved');
select is(
  (select requisites ->> 'nip' from public.businesses where id = public.current_business_id()),
  '7740001454', 'the NIP is stored without dashes');
select throws_ok(
  $$ update public.businesses set country_code = 'UA' where id = public.current_business_id() $$,
  '23514', null, 'changing the country re-checks the requisites against the new pack');
select throws_ok(
  $$ update public.businesses set country_code = 'RU', requisites = '{}' where id = public.current_business_id() $$,
  '23514', null, 'a business cannot move to Russia');

--
-- Reference data is read-only for users
--
select is((select count(*)::int from public.tax_rates where country_code = 'UA'), 4, 'users read tax rates');
select throws_ok($$ insert into public.tax_rates (country_code, code, rate, label, valid_from) values ('UA', 'custom', 1, 'x', '2026-01-01') $$, '42501', null, 'users cannot add tax rates');
update public.tax_rates set rate = 99 where country_code = 'UA';
delete from public.requisite_fields;
reset role;
select is((select max(rate)::int from public.tax_rates where country_code = 'UA'), 20, 'users cannot change tax rates');
select is((select count(*)::int from public.requisite_fields), 6, 'users cannot delete requisite fields');

select * from finish();
rollback;
