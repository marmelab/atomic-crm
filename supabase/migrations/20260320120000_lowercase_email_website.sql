-- Enable citext extension for case-insensitive text columns
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "extensions";

-- Change companies.website to citext for case-insensitive comparisons
ALTER TABLE companies ALTER COLUMN website TYPE extensions.citext;

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
