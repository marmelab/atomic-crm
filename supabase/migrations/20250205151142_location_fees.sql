alter table public.locations add column port_fee numeric(10,2);; -- $/load fee charged by the port, e.g. customs fee
alter table public.companies add column agent_fee numeric(10,2); -- $/load agent fee (can be overridden by material or commodity fees)

-- rebuild the view after agent_fee was added
drop view public.companies_summary;

create view public.companies_summary
    with (security_invoker=on)
    as
select 
    c.*,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts,
    count(distinct cl.id) as nb_locations
from 
    public.companies c
left join 
    public.deals d on c.id = d.company_id
left join 
    public.contacts co on c.id = co.company_id
left join
  public.locations as cl on c.id = cl.company_id
group by 
    c.id;