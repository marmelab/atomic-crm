-- Migrate old label-based values to slug-based values.
--
-- Previously, companySectors, dealCategories, and taskTypes were stored as
-- plain string arrays (e.g. ["Energy", "Copywriting"]) in individual records. 
-- Now they use a { value, label } format where `value` is a slug derived from
-- the label.
--
-- This migration converts record fields (companies.sector, deals.category, tasks.type,
-- contact_notes.status) from display labels to slugs.

-- Helper: replicates the toSlug() TypeScript function
CREATE OR REPLACE FUNCTION pg_temp.to_slug(label text) RETURNS text AS $$
BEGIN
  RETURN TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(label), '[^a-z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Slugify record fields
-- Only update rows where the value differs from its slug form

UPDATE companies
SET sector = pg_temp.to_slug(sector)
WHERE sector IS NOT NULL
  AND sector != pg_temp.to_slug(sector);

UPDATE deals
SET category = pg_temp.to_slug(category)
WHERE category IS NOT NULL
  AND category != pg_temp.to_slug(category);

UPDATE tasks
SET type = pg_temp.to_slug(type)
WHERE type IS NOT NULL
  AND type != pg_temp.to_slug(type);

UPDATE contact_notes
SET status = pg_temp.to_slug(status)
WHERE status IS NOT NULL
  AND status != pg_temp.to_slug(status);

