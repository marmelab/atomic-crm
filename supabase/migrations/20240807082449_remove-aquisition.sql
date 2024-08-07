-- this will drop the `contacts_summary` view as well
ALTER TABLE  "public"."contacts"
DROP COLUMN acquisition CASCADE;

 -- We need to recreate the view with the new schema

create view "public"."contacts_summary"
as
select 
    co.*,
    c.name as company_name,
    count(distinct t.id) as nb_tasks
from
    "public"."contacts" co
left join
    "public"."tasks" t on co.id = t.contact_id
left join
    "public"."companies" c on co.company_id = c.id
group by
    co.id, c.name;
