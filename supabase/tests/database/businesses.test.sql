-- Business isolation tests (run with: npx supabase test db)
--
-- Two owners, Alice (business A) and Bob (business B), plus Carol, an
-- accountant in business A. For every business data table, Bob must not read,
-- create, change or delete rows of business A, and rows may not reference
-- rows of another business.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(75);

-- Keep the seeded demo business out of the way: new users would adopt it.
update public.businesses set is_demo = false;

-- Act as a given user. Call it as the superuser; "reset role" goes back.
create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- Users: without an invitation they start with no business
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.local', '{"first_name":"Alice","last_name":"A"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@test.local', '{"first_name":"Bob","last_name":"B"}', 'authenticated', 'authenticated'),
  ('cccccccc-0000-4000-8000-000000000003', 'carol@test.local', '{"first_name":"Carol","last_name":"C"}', 'authenticated', 'authenticated');

select is(
  (select current_business_id from public.sales where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  null, 'a new user without an invitation has no business until the setup wizard');

-- Alice and Bob create their businesses (as the setup wizard does)
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
select public.create_business('My business', 'UA', 'services');
reset role;
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');
select public.create_business('My business', 'PL', 'retail', '{"nip": "7740001454"}');
reset role;

create temporary table ids as
select
  (select current_business_id from public.sales where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') as business_a,
  (select current_business_id from public.sales where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') as business_b;
grant select on ids to authenticated;

select isnt((select business_a from ids), (select business_b from ids), 'each owner has a business of their own');
select is(
  (select role::text from public.members where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and business_id = (select business_a from ids)),
  'owner', 'the new user owns their business');

-- Carol becomes an accountant of business A and works there
insert into public.members (business_id, user_id, role) values ((select business_a from ids), 'cccccccc-0000-4000-8000-000000000003', 'accountant');
select pg_temp.act_as('cccccccc-0000-4000-8000-000000000003');
select public.switch_business((select business_a from ids));
reset role;

-- Alice fills business A (business_id comes from the column default)
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
insert into public.tags (name, color) values ('A tag', '#ffffff');
insert into public.companies (name) values ('A company');
insert into public.contacts (first_name, last_name, company_id, tags)
  values ('A', 'Contact', (select id from public.companies where name = 'A company'), array[(select id from public.tags where name = 'A tag')]);
insert into public.contact_notes (contact_id, text) values ((select id from public.contacts where last_name = 'Contact'), 'A note');
insert into public.deals (name, stage, company_id, contact_ids)
  values ('A deal', 'opportunity', (select id from public.companies where name = 'A company'), array[(select id from public.contacts where last_name = 'Contact')]);
insert into public.deal_notes (deal_id, text) values ((select id from public.deals where name = 'A deal'), 'A deal note');
insert into public.tasks (contact_id, text) values ((select id from public.contacts where last_name = 'Contact'), 'A task');
select is((select count(*)::int from public.contacts), 1, 'Alice sees her contact');
select is((select business_id from public.contacts limit 1), (select business_a from ids), 'business_id defaults to the current business');
reset role;

create temporary table a_rows as select
  (select id from public.companies where name = 'A company') as company_id,
  (select id from public.contacts where last_name = 'Contact') as contact_id,
  (select id from public.contact_notes where text = 'A note') as contact_note_id,
  (select id from public.deals where name = 'A deal') as deal_id,
  (select id from public.deal_notes where text = 'A deal note') as deal_note_id,
  (select id from public.tags where name = 'A tag') as tag_id,
  (select id from public.tasks where text = 'A task') as task_id;
grant select on a_rows to authenticated;

--
-- Bob (business B) cannot read business A
--
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');

select is((select count(*)::int from public.companies), 0, 'Bob does not see companies of A');
select is((select count(*)::int from public.contacts), 0, 'Bob does not see contacts of A');
select is((select count(*)::int from public.contact_notes), 0, 'Bob does not see contact notes of A');
select is((select count(*)::int from public.deals), 0, 'Bob does not see deals of A');
select is((select count(*)::int from public.deal_notes), 0, 'Bob does not see deal notes of A');
select is((select count(*)::int from public.tags), 0, 'Bob does not see tags of A');
select is((select count(*)::int from public.tasks), 0, 'Bob does not see tasks of A');
select is((select count(*)::int from public.configuration where id = (select business_a from ids)), 0, 'Bob does not see the configuration of A');
select is((select count(*)::int from public.companies_summary), 0, 'Bob does not see companies_summary of A');
select is((select count(*)::int from public.contacts_summary), 0, 'Bob does not see contacts_summary of A');
select is((select count(*)::int from public.activity_log), 0, 'Bob does not see the activity of A');
select is((select count(*)::int from public.global_search('Contact')), 0, 'Bob does not find A rows in global search');
select is((select count(*)::int from public.businesses where id = (select business_a from ids)), 0, 'Bob does not see business A');
select is((select count(*)::int from public.members where business_id = (select business_a from ids)), 0, 'Bob does not see the members of A');
select is((select count(*)::int from public.sales where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 0, 'Bob does not see Alice');

--
-- Bob cannot change or delete business A rows (RLS filters them out)
--
update public.companies set name = 'hacked' where id = (select company_id from a_rows);
update public.contacts set first_name = 'hacked' where id = (select contact_id from a_rows);
update public.contact_notes set text = 'hacked' where id = (select contact_note_id from a_rows);
update public.deals set name = 'hacked' where id = (select deal_id from a_rows);
update public.deal_notes set text = 'hacked' where id = (select deal_note_id from a_rows);
update public.tags set name = 'hacked' where id = (select tag_id from a_rows);
update public.tasks set text = 'hacked' where id = (select task_id from a_rows);
update public.configuration set config = '{"title":"hacked"}' where id = (select business_a from ids);
update public.businesses set name = 'hacked' where id = (select business_a from ids);
delete from public.tasks where id = (select task_id from a_rows);
delete from public.deal_notes where id = (select deal_note_id from a_rows);
delete from public.contact_notes where id = (select contact_note_id from a_rows);
delete from public.deals where id = (select deal_id from a_rows);
delete from public.contacts where id = (select contact_id from a_rows);
delete from public.companies where id = (select company_id from a_rows);
delete from public.tags where id = (select tag_id from a_rows);

--
-- Bob cannot write into business A
--
select throws_ok(format('insert into public.companies (name, business_id) values (%L, %L)', 'x', (select business_a from ids)), '42501', null, 'Bob cannot create a company in A');
select throws_ok(format('insert into public.contacts (first_name, business_id) values (%L, %L)', 'x', (select business_a from ids)), '42501', null, 'Bob cannot create a contact in A');
select throws_ok(format('insert into public.contact_notes (contact_id, text, business_id) values (%s, %L, %L)', (select contact_id from a_rows), 'x', (select business_a from ids)), '42501', null, 'Bob cannot create a contact note in A');
select throws_ok(format('insert into public.deals (name, stage, business_id) values (%L, %L, %L)', 'x', 'opportunity', (select business_a from ids)), '42501', null, 'Bob cannot create a deal in A');
select throws_ok(format('insert into public.deal_notes (deal_id, text, business_id) values (%s, %L, %L)', (select deal_id from a_rows), 'x', (select business_a from ids)), '42501', null, 'Bob cannot create a deal note in A');
select throws_ok(format('insert into public.tags (name, color, business_id) values (%L, %L, %L)', 'x', '#000', (select business_a from ids)), '42501', null, 'Bob cannot create a tag in A');
select throws_ok(format('insert into public.tasks (contact_id, text, business_id) values (%s, %L, %L)', (select contact_id from a_rows), 'x', (select business_a from ids)), '42501', null, 'Bob cannot create a task in A');
select throws_ok(format('insert into public.configuration (id) values (%L)', (select business_a from ids)), '42501', null, 'Bob cannot create the configuration of A');

--
-- Bob cannot reference business A rows from his own business
--
insert into public.companies (name) values ('B company');
insert into public.contacts (first_name, last_name) values ('B', 'Person');
insert into public.deals (name, stage) values ('B deal', 'opportunity');
select throws_ok(format('insert into public.contacts (first_name, company_id) values (%L, %s)', 'x', (select company_id from a_rows)), '23503', null, 'a contact cannot belong to a company of another business');
select throws_ok(format('insert into public.contact_notes (contact_id, text) values (%s, %L)', (select contact_id from a_rows), 'x'), '23503', null, 'a note cannot be attached to a contact of another business');
select throws_ok(format('insert into public.deals (name, stage, company_id) values (%L, %L, %s)', 'x', 'opportunity', (select company_id from a_rows)), '23503', null, 'a deal cannot belong to a company of another business');
select throws_ok(format('insert into public.deal_notes (deal_id, text) values (%s, %L)', (select deal_id from a_rows), 'x'), '23503', null, 'a note cannot be attached to a deal of another business');
select throws_ok(format('insert into public.tasks (contact_id, text) values (%s, %L)', (select contact_id from a_rows), 'x'), '23503', null, 'a task cannot be attached to a contact of another business');
select throws_ok(format('update public.contacts set tags = array[%s::bigint] where last_name = %L', (select tag_id from a_rows), 'Person'), '23503', null, 'a contact cannot use a tag of another business');
select throws_ok(format('update public.deals set contact_ids = array[%s::bigint] where name = %L', (select contact_id from a_rows), 'B deal'), '23503', null, 'a deal cannot list a contact of another business');
select throws_ok(format('update public.contacts set business_id = %L where last_name = %L', (select business_a from ids), 'Person'), '42501', null, 'Bob cannot move his contact into business A');

--
-- Business lifecycle guards
--
select throws_ok(format('select public.switch_business(%L)', (select business_a from ids)), '42501', null, 'Bob cannot switch to a business he is not a member of');
select throws_ok(format('select public.delete_business(%L, %L)', (select business_a from ids), 'My business'), '42501', null, 'Bob cannot delete business A');
select throws_ok($$ select public.create_business('Moscow LLC', 'RU') $$, '23514', null, 'a business from Russia cannot be created');
select throws_ok($$ select public.create_business('Minsk LLC', 'BY') $$, '23514', null, 'a business from Belarus cannot be created');
select lives_ok($$ select public.create_business('Bob in Poland', 'PL') $$, 'Bob can create a second business');
select is((select name from public.businesses where id = public.current_business_id()), 'Bob in Poland', 'creating a business makes it current');
select is((select count(*)::int from public.contacts), 0, 'the new business starts empty');
select lives_ok(format('select public.switch_business(%L)', (select business_b from ids)), 'Bob switches back to business B');
select is((select count(*)::int from public.contacts), 1, 'Bob sees business B again');

reset role;

-- Business A is untouched
select is((select name from public.companies where id = (select company_id from a_rows)), 'A company', 'company of A unchanged');
select is((select first_name from public.contacts where id = (select contact_id from a_rows)), 'A', 'contact of A unchanged');
select is((select text from public.contact_notes where id = (select contact_note_id from a_rows)), 'A note', 'contact note of A unchanged');
select is((select name from public.deals where id = (select deal_id from a_rows)), 'A deal', 'deal of A unchanged');
select is((select text from public.deal_notes where id = (select deal_note_id from a_rows)), 'A deal note', 'deal note of A unchanged');
select is((select name from public.tags where id = (select tag_id from a_rows)), 'A tag', 'tag of A unchanged');
select is((select text from public.tasks where id = (select task_id from a_rows)), 'A task', 'task of A unchanged');
select is((select config from public.configuration where id = (select business_a from ids)), '{}'::jsonb, 'configuration of A unchanged');
select is((select name from public.businesses where id = (select business_a from ids)), 'My business', 'business A unchanged');

--
-- Carol (accountant of A) reads but cannot write
--
select pg_temp.act_as('cccccccc-0000-4000-8000-000000000003');
select is((select count(*)::int from public.contacts), 1, 'the accountant reads business data');
select throws_ok($$ insert into public.contacts (first_name) values ('x') $$, '42501', null, 'the accountant cannot create');
update public.contacts set first_name = 'changed by accountant';
delete from public.tasks;
reset role;
select is((select first_name from public.contacts where id = (select contact_id from a_rows)), 'A', 'the accountant cannot change');
select is((select count(*)::int from public.tasks where id = (select task_id from a_rows)), 1, 'the accountant cannot delete');

--
-- Owners
--
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
select is((select count(*)::int from public.sales), 2, 'Alice sees the members of her business (herself and Carol)');
select is((select s.administrator from public.sales s where s.user_id = 'aaaaaaaa-0000-4000-8000-000000000001'), true, 'sales.administrator: Alice owns her current business');
select is((select s.administrator from public.sales s where s.user_id = 'cccccccc-0000-4000-8000-000000000003'), false, 'sales.administrator: Carol does not');
reset role;

select throws_ok(
  format($$ update public.members set role = 'manager' where user_id = %L and business_id = %L $$, 'aaaaaaaa-0000-4000-8000-000000000001', (select business_a from ids)),
  'P0001', null, 'the last owner cannot be demoted');
select throws_ok(
  format($$ update public.members set disabled = true where user_id = %L and business_id = %L $$, 'aaaaaaaa-0000-4000-8000-000000000001', (select business_a from ids)),
  'P0001', null, 'the last owner cannot be disabled');

select pg_temp.act_as('cccccccc-0000-4000-8000-000000000003');
select throws_ok(format($$ select public.set_member(%L, 'owner') $$, 'cccccccc-0000-4000-8000-000000000003'), '42501', null, 'only an owner manages members');
reset role;
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
select lives_ok(format($$ select public.set_member(%L, 'manager') $$, 'cccccccc-0000-4000-8000-000000000003'), 'the owner changes the role of a member');
select is((select role::text from public.members where user_id = 'cccccccc-0000-4000-8000-000000000003'), 'manager', 'the role is changed');
select throws_ok(format($$ select public.set_member(%L, p_disabled => true) $$, 'aaaaaaaa-0000-4000-8000-000000000001'), 'P0001', null, 'the last owner cannot disable themselves');
select throws_ok(format($$ select public.set_member(%L, 'manager') $$, 'bbbbbbbb-0000-4000-8000-000000000002'), 'P0002', null, 'an owner cannot change people outside the business');
select throws_ok(format('select public.delete_business(%L, %L)', (select business_a from ids), 'wrong name'), '22023', null, 'deleting needs the exact business name');
select lives_ok(format('select public.delete_business(%L, %L)', (select business_a from ids), 'My business'), 'the owner deletes business A');
reset role;

select is((select count(*)::int from public.businesses where id = (select business_a from ids)), 0, 'business A is gone');
select is((select count(*)::int from public.contacts where business_id = (select business_a from ids)), 0, 'its contacts are gone');
select is((select count(*)::int from public.deals where business_id = (select business_a from ids)), 0, 'its deals are gone');
select is((select count(*)::int from public.members where business_id = (select business_a from ids)), 0, 'its memberships are gone');
select is((select count(*)::int from public.contacts where last_name = 'Person'), 1, 'business B keeps its data');

select * from finish();
rollback;
