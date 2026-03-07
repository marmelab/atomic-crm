drop view if exists contacts_summary;

create view contacts_summary
as
select 
    co.*,
    jsonb_path_query_array(co.email_jsonb, '$[*].email')::text as email_fts,
    jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text as phone_fts,
    c.name as company_name,
    count(distinct t.id) filter (where t.done_date is null) as nb_tasks
from
    contacts co
left join
    tasks t on co.id = t.contact_id
left join
    companies c on co.company_id = c.id
group by
    co.id, c.name;
