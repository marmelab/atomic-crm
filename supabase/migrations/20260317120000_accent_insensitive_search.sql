-- Enable unaccent extension for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Helper: immutable wrapper around unaccent (required for generated columns & indexes)
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$
  SELECT public.unaccent($1);
$$;

-- ── contacts ────────────────────────────────────────────────────────────────
-- Note: company_name_search is NOT added here because company_name comes from
-- the companies join, not a direct column on contacts. It is computed in the view.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS first_name_search  text
    GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(first_name,  '')))) STORED,
  ADD COLUMN IF NOT EXISTS last_name_search   text
    GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(last_name,   '')))) STORED,
  ADD COLUMN IF NOT EXISTS title_search       text
    GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(title,       '')))) STORED,
  ADD COLUMN IF NOT EXISTS background_search  text
    GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(background,  '')))) STORED;

CREATE INDEX IF NOT EXISTS idx_contacts_first_name_search ON contacts (first_name_search);
CREATE INDEX IF NOT EXISTS idx_contacts_last_name_search  ON contacts (last_name_search);

-- ── companies ────────────────────────────────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS name_search       text
    GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(name,        '')))) STORED,
  ADD COLUMN IF NOT EXISTS city_search       text
    GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(city,        '')))) STORED,
  ADD COLUMN IF NOT EXISTS state_abbr_search text
    GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(state_abbr,  '')))) STORED;

CREATE INDEX IF NOT EXISTS idx_companies_name_search ON companies (name_search);
CREATE INDEX IF NOT EXISTS idx_companies_city_search ON companies (city_search);

-- ── deals ────────────────────────────────────────────────────────────────────
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS name_search        text
    GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(name,        '')))) STORED,
  ADD COLUMN IF NOT EXISTS category_search    text
    GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(category,    '')))) STORED,
  ADD COLUMN IF NOT EXISTS description_search text
    GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(description, '')))) STORED;

CREATE INDEX IF NOT EXISTS idx_deals_name_search ON deals (name_search);

-- ── Recreate contacts_summary to expose _search columns ──────────────────────
-- Switch to co.* to get all generated *_search columns automatically.
-- Add company_name and company_name_search from the companies join.
DROP VIEW IF EXISTS contacts_summary;
CREATE VIEW contacts_summary
  WITH (security_invoker = on)
  AS
  SELECT
    co.*,
    c.name                                                        AS company_name,
    lower(immutable_unaccent(coalesce(c.name, '')))               AS company_name_search,
    jsonb_path_query_array(co.email_jsonb, '$[*].email')::text    AS email_fts,
    jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text   AS phone_fts,
    count(DISTINCT t.id)                                          AS nb_tasks
  FROM contacts co
  LEFT JOIN tasks t    ON co.id = t.contact_id
  LEFT JOIN companies c ON co.company_id = c.id
  GROUP BY co.id, c.name;
