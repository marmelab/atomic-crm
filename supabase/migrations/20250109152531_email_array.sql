alter table contacts add column email_array text[];

update contacts set email_array = array[email];

drop view contacts_summary;

alter table contacts drop column email;

alter table contacts rename column email_array to email;

create view contacts_summary
as
select 
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.email,
    co.phone_1_number,
    co.phone_1_type,
    co.phone_2_number,
    co.phone_2_type,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    c.name as company_name,
    count(distinct t.id) as nb_tasks
from
    contacts co
left join
    tasks t on co.id = t.contact_id
left join
    companies c on co.company_id = c.id
group by
    co.id, c.name;

