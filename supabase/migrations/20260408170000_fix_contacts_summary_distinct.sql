-- Fix: contacts_summary view tag aggregation needs DISTINCT
-- Without DISTINCT, the tasks×contact_tags cross-join duplicates tag IDs
-- when a contact has multiple tasks.

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
    COALESCE(array_agg(DISTINCT ct.tag_id) FILTER (WHERE ct.tag_id IS NOT NULL), '{}') AS tags,
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
    LEFT JOIN public.contact_tags ct ON co.id = ct.contact_id
GROUP BY co.id, c.name;
