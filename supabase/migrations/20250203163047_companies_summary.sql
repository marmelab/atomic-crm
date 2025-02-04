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