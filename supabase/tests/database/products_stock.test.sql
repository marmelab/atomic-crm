-- Products and stock tests (run with: npx supabase test db)
--
-- Every business gets a default warehouse; stock is the sum of moves; a move
-- is never changed, only reversed; no warehouse goes below zero; average
-- cost follows the receipts; each new table is isolated per business; only
-- owners, managers and storekeepers write.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(40);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('dddddddd-0000-4000-8000-000000000001', 'owner@test.local', '{}', 'authenticated', 'authenticated'),
  ('dddddddd-0000-4000-8000-000000000002', 'other@test.local', '{}', 'authenticated', 'authenticated'),
  ('dddddddd-0000-4000-8000-000000000003', 'keeper@test.local', '{}', 'authenticated', 'authenticated'),
  ('dddddddd-0000-4000-8000-000000000004', 'books@test.local', '{}', 'authenticated', 'authenticated'),
  ('dddddddd-0000-4000-8000-000000000005', 'stylist@test.local', '{}', 'authenticated', 'authenticated');

-- Another business with its own product and stock
select pg_temp.act_as('dddddddd-0000-4000-8000-000000000002');
select public.create_business('Warsaw Shop', 'PL');
insert into public.products (name, sku, barcodes) values ('Polish soap', 'SOAP', '{5900000000001}');
insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity, unit_cost)
  select 'receipt', p.id, w.id, 7, 500 from public.products p, public.warehouses w;

select pg_temp.act_as('dddddddd-0000-4000-8000-000000000001');
select public.create_business('Kyiv Shop', 'UA');

reset role;
insert into public.members (business_id, user_id, role)
  select b.id, u.id, u.role::public.business_role
  from public.businesses b,
    (values ('dddddddd-0000-4000-8000-000000000003'::uuid, 'storekeeper'),
            ('dddddddd-0000-4000-8000-000000000004'::uuid, 'accountant'),
            ('dddddddd-0000-4000-8000-000000000005'::uuid, 'specialist')) as u(id, role)
  where b.name = 'Kyiv Shop';
select pg_temp.act_as('dddddddd-0000-4000-8000-000000000001');

-- Warehouses
select is((select count(*)::int from public.warehouses), 1, 'a new business has one warehouse');
select ok((select is_default and name is null from public.warehouses), 'it is the default warehouse, named by the interface');
insert into public.warehouses (name) values ('Shop floor');
select throws_ok($$ insert into public.warehouses (name) values (null) $$, '23514', null, 'another warehouse needs a name');
select throws_ok($$ insert into public.warehouses (is_default) values (true) $$, '23505', null, 'a business has one default warehouse');

-- Products
select is((select count(*)::int from public.units), 10, 'units of measure are reference data');
insert into public.products (name, sku, unit_code, price, vat_rate_code, barcodes)
  values ('Shampoo', 'SH-1', 'pcs', 24950, 'standard', '{ 4820000000017 ,4820000000024}');
select is((select row(currency, barcodes)::text from public.products where sku = 'SH-1'),
  '(UAH,"{4820000000017,4820000000024}")', 'a product is in the business currency, barcodes trimmed');
select throws_ok($$ insert into public.products (name, barcodes) values ('Copy', '{4820000000024}') $$, '23505', null,
  'a barcode belongs to one product of the business');
select lives_ok($$ insert into public.products (name, barcodes) values ('Same code abroad', '{5900000000001}') $$,
  'another business may use the same barcode');
select throws_ok($$ insert into public.products (name, sku) values ('Twin', 'SH-1') $$, '23505', null, 'an article number is unique');
select throws_ok($$ insert into public.products (name, unit_code) values ('Odd', 'parsec') $$, '23503', null, 'units come from the list');
insert into public.products (name, kind, unit_code) values ('Haircut', 'service', 'service');
insert into public.products (name, kind, unit_code) values ('Dye', 'material', 'ml');

insert into public.companies (name, roles) values ('Wholesaler', '{supplier}');
insert into public.supplier_skus (product_id, supplier_id, sku)
  select p.id, c.id, 'W-777' from public.products p, public.companies c where p.sku = 'SH-1' and c.name = 'Wholesaler';
select is((select sku from public.supplier_skus), 'W-777', 'a product has the article number of its supplier');

-- Moves
create temp table ids as select
  (select id from public.products where sku = 'SH-1') as shampoo,
  (select id from public.products where name = 'Haircut') as haircut,
  (select id from public.warehouses where is_default) as main,
  (select id from public.warehouses where name = 'Shop floor') as floor;
grant select on ids to authenticated;

insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity, unit_cost)
  select 'receipt', shampoo, main, 10, 10000 from ids;
insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity, unit_cost)
  select 'receipt', shampoo, main, 30, 12000 from ids;
select is((select public.stock_quantity(shampoo, main) from ids), 40.000, 'stock is the sum of receipts');
select is((select average_cost from public.products_summary where sku = 'SH-1'), 11500::bigint,
  'average cost is weighted by quantity: (10 x 100 + 30 x 120) / 40 = 115');

insert into public.stock_moves (kind, product_id, from_warehouse_id, to_warehouse_id, quantity)
  select 'transfer', shampoo, main, floor, 5 from ids;
insert into public.stock_moves (kind, product_id, from_warehouse_id, quantity)
  select 'issue', shampoo, floor, 2 from ids;
select is((select public.stock_quantity(shampoo, floor) from ids), 3.000, 'a transfer and an issue move stock');
select is((select quantity from public.products_summary where sku = 'SH-1'), 38.000, 'the total stock counts every warehouse');
select is((select count(*)::int from public.stock_levels), 2, 'stock levels list each warehouse with stock');

select throws_ok($$ insert into public.stock_moves (kind, product_id, from_warehouse_id, quantity) select 'issue', shampoo, floor, 4 from ids $$,
  '23514', null, 'stock never goes below zero');
select throws_ok($$ insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity, unit_cost) select 'receipt', haircut, main, 1, 1 from ids $$,
  '23514', null, 'a service has no stock');
select throws_ok($$ insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity) select 'receipt', shampoo, main, 1 from ids $$,
  '23514', null, 'a receipt has a purchase cost');
select throws_ok($$ insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity, unit_cost) select 'receipt', shampoo, main, 0, 1 from ids $$,
  '23514', null, 'a quantity is positive');

-- Posted moves stay
update public.stock_moves set quantity = 1;
select is((select count(*)::int from public.stock_moves where quantity = 1), 0, 'a user cannot change a posted move');
reset role;
select throws_ok($$ update public.stock_moves set quantity = 1 $$, '42501', null, 'a posted move cannot be changed, even by the database owner');
select throws_ok($$ delete from public.stock_moves $$, '42501', null, 'a posted move cannot be deleted, even by the database owner');
select pg_temp.act_as('dddddddd-0000-4000-8000-000000000001');

select lives_ok($$ select public.reverse_stock_move((select max(id) from public.stock_moves where kind = 'issue'), 'Wrong item') $$,
  'a move is cancelled by a reversal');
select is((select public.stock_quantity(shampoo, floor) from ids), 5.000, 'the reversal brings the stock back');
select throws_ok($$ select public.reverse_stock_move((select max(id) from public.stock_moves where kind = 'issue')) $$,
  '23505', null, 'a move is reversed once');
select throws_ok($$ select public.reverse_stock_move((select max(id) from public.stock_moves where kind = 'reversal')) $$,
  '23514', null, 'a reversal is not reversed');
select throws_ok($$ insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity, reverses_id) select 'reversal', shampoo, main, 99, (select min(id) from public.stock_moves) from ids $$,
  '23514', null, 'a hand-made reversal must mirror its move');

select lives_ok($$ select public.reverse_stock_move((select min(id) from public.stock_moves where kind = 'receipt')) $$,
  'a receipt is reversed');
select is((select average_cost from public.products_summary where sku = 'SH-1'), 12000::bigint,
  'a reversed receipt leaves the average cost');

-- Inventory
select is((select public.post_inventory(main, jsonb_build_array(jsonb_build_object('product_id', shampoo, 'quantity', 20)), 'Count') from ids), 1,
  'an inventory posts an adjustment where the count differs');
select is((select public.stock_quantity(shampoo, main) from ids), 20.000, 'the stock equals the count after the inventory');
select is((select public.post_inventory(main, jsonb_build_array(jsonb_build_object('product_id', shampoo, 'quantity', 20))) from ids), 0,
  'a matching count posts nothing');

-- Roles
select pg_temp.act_as('dddddddd-0000-4000-8000-000000000003');
select lives_ok($$ insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity, unit_cost) select 'receipt', shampoo, main, 1, 100 from ids $$,
  'a storekeeper posts moves');
select pg_temp.act_as('dddddddd-0000-4000-8000-000000000004');
select throws_ok($$ insert into public.products (name) values ('By the books') $$, '42501', null, 'an accountant only reads the catalog');
select pg_temp.act_as('dddddddd-0000-4000-8000-000000000005');
select throws_ok($$ insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity, unit_cost) select 'receipt', shampoo, main, 1, 100 from ids $$,
  '42501', null, 'a specialist does not post moves');
select is((select count(*)::int from public.products), 4, 'a specialist sees the catalog');

-- Isolation
select pg_temp.act_as('dddddddd-0000-4000-8000-000000000002');
select is((select array_agg(name) from public.products), '{"Polish soap"}'::text[], 'products are isolated per business');
select is((select count(*)::int from public.stock_moves) + (select count(*)::int from public.warehouses) + (select count(*)::int from public.supplier_skus),
  2, 'moves, warehouses and supplier article numbers are isolated per business');
select lives_ok($$ select public.delete_business(public.current_business_id(), 'Warsaw Shop') $$,
  'a business with stock moves can still be deleted as a whole');

reset role;

select * from finish();
rollback;
