-- Add referred_by_id column to contacts table
ALTER TABLE "public"."contacts" 
ADD COLUMN "referred_by_id" bigint;

-- Add foreign key constraint with ON DELETE SET NULL
ALTER TABLE "public"."contacts" 
ADD CONSTRAINT "contacts_referred_by_id_fkey" 
FOREIGN KEY (referred_by_id) 
REFERENCES contacts(id) 
ON UPDATE CASCADE 
ON DELETE SET NULL;

DROP VIEW contacts_summary;

CREATE VIEW contacts_summary
AS
SELECT 
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.email_jsonb,
    jsonb_path_query_array(co.email_jsonb, '$[*].email')::text AS email_fts,
    co.phone_jsonb,
    jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text AS phone_fts,
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
    co.referred_by_id,
    c.name as company_name,
    COUNT(DISTINCT t.id) AS nb_tasks
FROM
    contacts co
LEFT JOIN
    tasks t ON co.id = t.contact_id
LEFT JOIN
    companies c ON co.company_id = c.id
GROUP BY
    co.id, c.name;
