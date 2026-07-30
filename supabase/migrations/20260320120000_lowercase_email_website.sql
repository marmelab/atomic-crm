-- Enable citext extension for case-insensitive text columns
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "extensions";

-- Drop view that depends on companies.website before altering the column type
DROP VIEW IF EXISTS public.companies_summary;

-- Change companies.website to citext for case-insensitive comparisons
ALTER TABLE companies ALTER COLUMN website TYPE extensions.citext;

-- Recreate companies_summary view
CREATE OR REPLACE VIEW public.companies_summary WITH (security_invoker = on) AS
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
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts
FROM public.companies c
    LEFT JOIN public.deals d ON c.id = d.company_id
    LEFT JOIN public.contacts co ON c.id = co.company_id
GROUP BY c.id;

-- Change sales.email to citext for case-insensitive comparisons
ALTER TABLE sales ALTER COLUMN email TYPE extensions.citext;

-- Function to lowercase email addresses in email_jsonb
CREATE OR REPLACE FUNCTION lowercase_email_jsonb()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email_jsonb IS NOT NULL THEN
    NEW.email_jsonb = COALESCE((
      SELECT jsonb_agg(
        jsonb_set(elem, '{email}', to_jsonb(LOWER(elem->>'email')))
      )
      FROM jsonb_array_elements(NEW.email_jsonb) AS elem
    ), '[]'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate triggers to ensure proper ordering
-- Lowercase trigger for email_jsonb must run before the avatar trigger

-- Drop existing triggers
DROP TRIGGER IF EXISTS contact_saved ON contacts;

-- Create lowercase trigger first (so it runs before contact_saved)
CREATE TRIGGER "10_lowercase_contact_emails"
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_email_jsonb();

-- Recreate contact_saved trigger (will run after lowercase_contact_emails)
CREATE TRIGGER "20_contact_saved"
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION handle_contact_saved();

UPDATE contacts
SET email_jsonb = COALESCE((
  SELECT jsonb_agg(
    jsonb_set(elem, '{email}', to_jsonb(LOWER(elem->>'email')))
  )
  FROM jsonb_array_elements(email_jsonb) AS elem
), '[]'::jsonb)
WHERE email_jsonb IS NOT NULL;
