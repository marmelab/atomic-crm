-- Money tests (run with: npx supabase test db)
--
-- A business gets the currency and time zone of its country pack; a deal is
-- in the business currency unless said otherwise; amounts are integers in
-- minor units; exchange rates are read-only reference data.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(14);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.local', '{}', 'authenticated', 'authenticated');

select is(public.currency_minor_digits('UAH'), 2, 'hryvnia has 2 minor digits (kopecks)');
select is(public.currency_minor_digits('PLN'), 2, 'zloty has 2 minor digits (grosze)');
select is(public.currency_minor_digits('JPY'), 0, 'yen has no minor unit');

select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
select public.create_business('No country yet');

select is(
  (select row(currency, timezone)::text from public.businesses where id = public.current_business_id()),
  '(UAH,Europe/Kyiv)', 'a business without a country defaults to the Ukrainian currency and time zone');

select lives_ok($$ select public.create_business('Kyiv Studio', 'UA') $$, 'a Ukrainian business is created');
select is(
  (select row(currency, timezone)::text from public.businesses where id = public.current_business_id()),
  '(UAH,Europe/Kyiv)', 'a Ukrainian business works in hryvnias, Kyiv time');
insert into public.deals (name, stage, amount) values ('Website', 'opportunity', 1240000);
select is((select currency from public.deals where name = 'Website'), 'UAH', 'a deal is in the business currency by default');

select lives_ok($$ select public.create_business('Warsaw Shop', 'PL') $$, 'a Polish business is created');
select is(
  (select row(currency, timezone)::text from public.businesses where id = public.current_business_id()),
  '(PLN,Europe/Warsaw)', 'a Polish business works in zlotys, Warsaw time');
insert into public.deals (name, stage, amount) values ('Shop', 'opportunity', 1999);
select is((select currency from public.deals where name = 'Shop'), 'PLN', 'a Polish deal is in zlotys');
insert into public.deals (name, stage, amount, currency) values ('Export', 'opportunity', 50000, 'EUR');
select is((select currency from public.deals where name = 'Export'), 'EUR', 'a deal can be in another currency');

-- The API sends JSON values as text: a fraction is refused, never rounded
select throws_ok($$ insert into public.deals (name, stage, amount) values ('Float', 'opportunity', '12.5') $$, '22P02', null, 'amounts are integers (minor units), not fractions');
select throws_ok($$ insert into public.deals (name, stage, amount, currency) values ('Bad', 'opportunity', 1, 'hrn') $$, '23514', null, 'a currency is an ISO 4217 code');

select throws_ok($$ insert into public.fx_rates (base_currency, quote_currency, rate, rate_date, source) values ('EUR', 'UAH', 45, '2026-11-13', 'me') $$, '42501', null, 'users cannot write exchange rates');

reset role;

select * from finish();
rollback;
