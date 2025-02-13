drop view public.location_prices_summary;

alter table public.location_prices alter column "price_value" type numeric(10,3) using "price_value"::numeric(10,3);
alter table public.location_prices alter column "market_price_fix" type numeric(10,3) using "market_price_fix"::numeric(10,3);

create view public.location_prices_summary
    with (security_invoker=on)
    as
select lp.id, lp.location_id, lp.commodity_id, lp.commodity_grade, lp.price_type, lp.price_value,
  lp.market_type, lp.market_price_fix, lp.validation_date,
  round((EXTRACT(epoch FROM CURRENT_TIMESTAMP) - EXTRACT(epoch FROM lp.validation_date)) / 3600, 1) as validation_date_age,
  lp.sales_id,
  l.company_id, l.name as location_name, l.active as location_is_active,
  c.name as company_name,
  cm.name as commodity_name,
  cm.active as commodity_is_active,
  m.name as material_name, m.active as material_is_active, cm.material_id,
  lp.active
from public.location_prices as lp
inner join locations as l on lp.location_id = l.id
inner join companies as c on c.id = l.company_id
inner join commodities as cm on cm.id = lp.commodity_id
inner join materials as m on m.id = cm.material_id
;