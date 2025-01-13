alter table contacts add column phone_jsonb jsonb;

update contacts set phone_jsonb = 
    concat(
        '[',
        case when phone_1_number is not null then 
            concat(
                '{"number":"', 
                phone_1_number, 
                '","type":"',
                phone_1_type,
                '"}'
            )
        else null end,
        case when phone_2_number is not null then 
            concat(
                ',',
                '{"number":"', 
                phone_2_number, 
                '","type":"',
                phone_2_type,
                '"}'
            )
        else null end,
        ']'
    )::jsonb;

drop view contacts_summary;

alter table contacts drop column phone_1_number;
alter table contacts drop column phone_1_type;
alter table contacts drop column phone_2_number;
alter table contacts drop column phone_2_type;

create view contacts_summary
as
select 
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.email_jsonb,
    jsonb_path_query_array(co.email_jsonb, '$[*].email')::text as email_fts,
    co.phone_jsonb,
    jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text as phone_fts,
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

