alter table public.location_prices add column active boolean default true;

drop view public.location_prices_summary;

create view public.location_prices_summary
    with (security_invoker=on)
    as
select lp.id, lp.location_id, lp.commodity_id, lp.commodity_grade, lp.price_type, lp.price_value,
  lp.market_type, lp.market_price_fix, lp.validation_date, lp.sales_id,
  l.company_id, l.name as location_name, l.active as location_is_active,
  c.name as company_name,
  cm.name as commodity_name,
  cm.active as commodity_is_active,
  m.name as material_name, m.active as material_is_active,
  lp.active
from public.location_prices as lp
inner join locations as l on lp.location_id = l.id
inner join companies as c on c.id = l.company_id
inner join commodities as cm on cm.id = lp.commodity_id
inner join materials as m on m.id = cm.material_id
;