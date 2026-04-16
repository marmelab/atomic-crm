-- Strip spaces from all _search generated columns so that
-- "SoClinic" matches "So Clinic" and "JeanPierre" matches "Jean Pierre".
--
-- Formula: replace(lower(immutable_unaccent(coalesce(col, ''))), ' ', '')

-- ── Drop views first (they depend on _search columns via table.*) ──────────
DROP VIEW IF EXISTS contacts_summary;
DROP VIEW IF EXISTS companies_summary;
DROP VIEW IF EXISTS deals_summary;

-- ── contacts ────────────────────────────────────────────────────────────────
ALTER TABLE contacts
  DROP COLUMN IF EXISTS first_name_search,
  DROP COLUMN IF EXISTS last_name_search,
  DROP COLUMN IF EXISTS title_search,
  DROP COLUMN IF EXISTS background_search;

ALTER TABLE contacts
  ADD COLUMN first_name_search  text GENERATED ALWAYS AS (replace(lower(immutable_unaccent(coalesce(first_name,  ''))), ' ', '')) STORED,
  ADD COLUMN last_name_search   text GENERATED ALWAYS AS (replace(lower(immutable_unaccent(coalesce(last_name,   ''))), ' ', '')) STORED,
  ADD COLUMN title_search       text GENERATED ALWAYS AS (replace(lower(immutable_unaccent(coalesce(title,       ''))), ' ', '')) STORED,
  ADD COLUMN background_search  text GENERATED ALWAYS AS (replace(lower(immutable_unaccent(coalesce(background,  ''))), ' ', '')) STORED;

-- ── companies ───────────────────────────────────────────────────────────────
ALTER TABLE companies
  DROP COLUMN IF EXISTS name_search,
  DROP COLUMN IF EXISTS city_search,
  DROP COLUMN IF EXISTS state_abbr_search;

ALTER TABLE companies
  ADD COLUMN name_search       text GENERATED ALWAYS AS (replace(lower(immutable_unaccent(coalesce(name,        ''))), ' ', '')) STORED,
  ADD COLUMN city_search       text GENERATED ALWAYS AS (replace(lower(immutable_unaccent(coalesce(city,        ''))), ' ', '')) STORED,
  ADD COLUMN state_abbr_search text GENERATED ALWAYS AS (replace(lower(immutable_unaccent(coalesce(state_abbr,  ''))), ' ', '')) STORED;

-- ── deals ───────────────────────────────────────────────────────────────────
ALTER TABLE deals
  DROP COLUMN IF EXISTS name_search,
  DROP COLUMN IF EXISTS category_search,
  DROP COLUMN IF EXISTS description_search;

ALTER TABLE deals
  ADD COLUMN name_search        text GENERATED ALWAYS AS (replace(lower(immutable_unaccent(coalesce(name,        ''))), ' ', '')) STORED,
  ADD COLUMN category_search    text GENERATED ALWAYS AS (replace(lower(immutable_unaccent(coalesce(category,    ''))), ' ', '')) STORED,
  ADD COLUMN description_search text GENERATED ALWAYS AS (replace(lower(immutable_unaccent(coalesce(description, ''))), ' ', '')) STORED;

-- ── Recreate views ──────────────────────────────────────────────────────────

CREATE VIEW companies_summary WITH (security_invoker = on) AS
SELECT
  c.*,
  count(DISTINCT d.id)  AS nb_deals,
  count(DISTINCT co.id) AS nb_contacts
FROM companies c
  LEFT JOIN deals    d  ON c.id = d.company_id
  LEFT JOIN contacts co ON c.id = co.company_id
GROUP BY c.id;

CREATE VIEW contacts_summary WITH (security_invoker = on) AS
SELECT
  co.*,
  c.name                                                                    AS company_name,
  replace(lower(immutable_unaccent(coalesce(c.name, ''))), ' ', '')         AS company_name_search,
  jsonb_path_query_array(co.email_jsonb, '$[*].email')::text                AS email_fts,
  jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text               AS phone_fts,
  count(DISTINCT t.id) FILTER (WHERE t.done_date IS NULL)                   AS nb_tasks
FROM contacts co
  LEFT JOIN tasks t     ON co.id = t.contact_id
  LEFT JOIN companies c ON co.company_id = c.id
GROUP BY co.id, c.name;

CREATE VIEW deals_summary WITH (security_invoker = on) AS
SELECT
  d.*,
  comp.name                                                                                                    AS company_name,
  replace(lower(immutable_unaccent(coalesce(comp.name, ''))), ' ', '')                                         AS company_name_search,
  coalesce(string_agg((c.first_name || ' ' || c.last_name), ' '), '')                                         AS contact_names,
  replace(lower(immutable_unaccent(coalesce(string_agg((c.first_name || ' ' || c.last_name), ' '), ''))), ' ', '') AS contact_names_search
FROM deals d
  LEFT JOIN contacts  c    ON c.id = ANY(d.contact_ids)
  LEFT JOIN companies comp ON comp.id = d.company_id
GROUP BY d.id, comp.name;

-- Re-apply grants lost when views were dropped and recreated
GRANT SELECT ON companies_summary TO authenticated, anon;
GRANT SELECT ON contacts_summary  TO authenticated, anon;
GRANT SELECT ON deals_summary     TO authenticated, anon;
