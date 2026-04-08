-- Update companies_summary to include construction and ingestion fields
-- Must DROP+CREATE because adding columns before aggregates changes ordinal positions
DROP VIEW IF EXISTS public.companies_summary;
CREATE VIEW public.companies_summary
WITH (security_invoker = on) AS
SELECT
    c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    c.trade_type_id,
    c.service_area,
    c.company_size,
    c.tech_maturity,
    c.metadata,
    c.external_source,
    c.external_id,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts
FROM public.companies c
    LEFT JOIN public.deals d ON c.id = d.company_id
    LEFT JOIN public.contacts co ON c.id = co.company_id
GROUP BY c.id;

-- Update contacts_summary to include ingestion fields
DROP VIEW IF EXISTS public.contacts_summary;
CREATE VIEW public.contacts_summary
WITH (security_invoker = on) AS
SELECT
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
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
    co.email_jsonb,
    co.phone_jsonb,
    co.lead_source_id,
    co.metadata,
    co.external_source,
    co.external_id,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text as email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text as phone_fts,
    c.name as company_name,
    count(distinct t.id) FILTER (WHERE t.done_date IS NULL) as nb_tasks
FROM public.contacts co
    LEFT JOIN public.tasks t ON co.id = t.contact_id
    LEFT JOIN public.companies c ON co.company_id = c.id
GROUP BY co.id, c.name;
