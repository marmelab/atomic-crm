-- Function to lowercase email addresses in email_jsonb
CREATE OR REPLACE FUNCTION lowercase_email_jsonb()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email_jsonb IS NOT NULL THEN
    NEW.email_jsonb = (
      SELECT jsonb_agg(
        jsonb_set(elem, '{email}', to_jsonb(LOWER(elem->>'email')))
      )
      FROM jsonb_array_elements(NEW.email_jsonb) AS elem
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for contacts table to lowercase emails
CREATE TRIGGER lowercase_contact_emails
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_email_jsonb();

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

-- Trigger for companies table to lowercase website
CREATE TRIGGER lowercase_company_website
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_website();

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

-- Trigger for sales table to lowercase email
CREATE TRIGGER lowercase_sales_email
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_email();

-- Update existing contacts to lowercase email addresses
UPDATE contacts
SET email_jsonb = (
  SELECT jsonb_agg(
    jsonb_set(elem, '{email}', to_jsonb(LOWER(elem->>'email')))
  )
  FROM jsonb_array_elements(email_jsonb) AS elem
)
WHERE email_jsonb IS NOT NULL;

-- Update existing companies to lowercase website URLs
UPDATE companies
SET website = LOWER(website)
WHERE website IS NOT NULL;

-- Update existing sales to lowercase email addresses
UPDATE sales
SET email = LOWER(email)
WHERE email IS NOT NULL;
