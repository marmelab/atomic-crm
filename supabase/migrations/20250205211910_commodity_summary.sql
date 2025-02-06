create view public.commodities_summary
    with (security_invoker=on)
    as
select c.id, c.material_id, c.name, c.active, m.name as material_name, m.active as material_is_active
from public.commodities as c 
inner join public.materials as m on c.material_id = m.id;