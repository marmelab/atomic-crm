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
-- Lowercase triggers must run before the avatar/favicon triggers

-- Drop existing triggers
DROP TRIGGER IF EXISTS contact_saved ON contacts;

-- Create lowercase trigger first (so it runs before contact_saved)
CREATE TRIGGER 10_lowercase_contact_emails
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_email_jsonb();

-- Recreate contact_saved trigger (will run after lowercase_contact_emails)
CREATE TRIGGER 20_contact_saved
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION handle_contact_saved();

-- Function to lowercase website URL
CREATE OR REPLACE FUNCTION lowercase_website()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.website IS NOT NULL THEN
    NEW.website = LOWER(NEW.website);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing triggers
DROP TRIGGER IF EXISTS company_saved ON companies;

-- Create lowercase trigger first (so it runs before company_saved)
CREATE TRIGGER 10_lowercase_company_website
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_website();

-- Recreate company_saved trigger (will run after lowercase_company_website)
CREATE TRIGGER 20_company_saved
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION handle_company_saved();

-- Function to lowercase email address
CREATE OR REPLACE FUNCTION lowercase_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email = LOWER(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing triggers
DROP TRIGGER IF EXISTS lowercase_sales_email ON sales;

-- Trigger for sales table to lowercase email
CREATE TRIGGER lowercase_sales_email
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_email();

-- Update existing contacts to lowercase email addresses
UPDATE contacts
SET email_jsonb = COALESCE((
  SELECT jsonb_agg(
    jsonb_set(elem, '{email}', to_jsonb(LOWER(elem->>'email')))
  )
  FROM jsonb_array_elements(email_jsonb) AS elem
), '[]'::jsonb)
WHERE email_jsonb IS NOT NULL;

-- Update existing companies to lowercase website URLs
UPDATE companies
SET website = LOWER(website)
WHERE website IS NOT NULL;

-- Update existing sales to lowercase email addresses
UPDATE sales
SET email = LOWER(email)
WHERE email IS NOT NULL;
