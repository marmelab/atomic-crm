-- Counterparty tests (run with: npx supabase test db)
--
-- A counterparty combines roles; its requisites follow the pack of its own
-- country and are checked; other countries carry a VAT ID; duplicates are
-- found by requisite or VAT ID within the business only.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(16);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('cccccccc-0000-4000-8000-000000000001', 'ua@test.local', '{}', 'authenticated', 'authenticated'),
  ('cccccccc-0000-4000-8000-000000000002', 'pl@test.local', '{}', 'authenticated', 'authenticated');

select pg_temp.act_as('cccccccc-0000-4000-8000-000000000002');
select public.create_business('Warsaw Shop', 'PL');
insert into public.companies (name, country_code, requisites) values ('Polish twin', 'UA', '{"edrpou": "14360570"}');

select pg_temp.act_as('cccccccc-0000-4000-8000-000000000001');
select public.create_business('Kyiv Studio', 'UA');

insert into public.companies (name, roles) values ('Kvitka', '{client,supplier}');
select is((select roles from public.companies where name = 'Kvitka'), '{client,supplier}'::text[],
  'a counterparty is a client and a supplier at once');
select is((select kind from public.companies where name = 'Kvitka'), 'company', 'a counterparty is a company by default');
select throws_ok($$ insert into public.companies (name, roles) values ('Nobody', '{}') $$, '23514', null,
  'a counterparty has at least one role');
select throws_ok($$ insert into public.companies (name, roles) values ('Odd', '{competitor}') $$, '23514', null,
  'roles are client, supplier or partner');

insert into public.companies (name, kind, country_code, requisites)
  values ('Kvitka LLC', 'company', 'UA', '{"edrpou": " 1436-0570 ", "iban": "ua21 3223 1300 0002 6007 2335 6600 1"}');
select is((select requisites from public.companies where name = 'Kvitka LLC'),
  '{"edrpou": "14360570", "iban": "UA213223130000026007233566001"}'::jsonb,
  'Ukrainian requisites are stored normalized');
select throws_ok($$ insert into public.companies (name, country_code, requisites) values ('Bad', 'UA', '{"edrpou": "14360571"}') $$,
  '23514', null, 'a wrong EDRPOU check digit is refused');

select lives_ok($$ insert into public.companies (name, country_code, requisites, roles) values ('Polski dostawca', 'PL', '{"nip": "774-000-14-54"}', '{supplier}') $$,
  'a Ukrainian business has a Polish supplier with a NIP');
select is((select requisites ->> 'nip' from public.companies where name = 'Polski dostawca'), '7740001454',
  'the NIP of a foreign counterparty follows its own country');
select throws_ok($$ insert into public.companies (name, requisites) values ('Nowhere', '{"edrpou": "14360570"}') $$,
  '23514', null, 'requisites need the country of the counterparty');

select throws_ok($$ insert into public.companies (name, country_code, requisites) values ('Berlin', 'DE', '{"edrpou": "14360570"}') $$,
  '23514', null, 'a country without a pack has no requisite fields');
insert into public.companies (name, country_code, vat_id) values ('Berlin GmbH', 'DE', 'de 123.456-789');
select is((select vat_id from public.companies where name = 'Berlin GmbH'), 'DE123456789', 'a VAT ID is stored normalized');
select throws_ok($$ insert into public.companies (name, vat_id) values ('Bad VAT', '123') $$, '23514', null,
  'a VAT ID starts with its country prefix');

select is(
  (select array_agg(name || ':' || matched order by name) from public.company_duplicates(null, '{"edrpou": "1436 0570"}', null)),
  '{"Kvitka LLC:edrpou"}'::text[], 'a duplicate is found by tax number, in the own business only');
select is(
  (select count(*)::int from public.company_duplicates((select id from public.companies where name = 'Kvitka LLC'), '{"edrpou": "14360570"}', null)),
  0, 'a counterparty is not its own duplicate');
select is(
  (select array_agg(name) from public.company_duplicates(null, '{}', 'DE 123456789')),
  '{"Berlin GmbH"}'::text[], 'a duplicate is found by VAT ID');

select throws_ok($$ update public.businesses set requisites = '{"edrpou": "14360571"}' where id = public.current_business_id() $$,
  '23514', null, 'business requisites are still checked');

reset role;

select * from finish();
rollback;
