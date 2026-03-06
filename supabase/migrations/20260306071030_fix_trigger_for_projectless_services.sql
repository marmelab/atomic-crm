-- Fix: sync_service_km_expense trigger failed silently for services without a
-- project (flat services) because the INSERT...SELECT joined on projects and
-- returned zero rows when project_id was NULL.
--
-- Fix: use a direct INSERT with COALESCE to get client_id from either the
-- service or the project, without requiring the projects join.

CREATE OR REPLACE FUNCTION sync_service_km_expense() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_client_id uuid;
BEGIN
  -- DELETE: cascade handled by FK ON DELETE CASCADE, nothing extra needed
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE: upsert or remove the linked expense
  IF NEW.km_distance IS NOT NULL AND NEW.km_distance > 0 THEN
    -- Resolve client_id: prefer service.client_id, fall back to project.client_id
    v_client_id := NEW.client_id;
    IF v_client_id IS NULL AND NEW.project_id IS NOT NULL THEN
      SELECT client_id INTO v_client_id FROM projects WHERE id = NEW.project_id;
    END IF;

    INSERT INTO expenses (
      source_service_id, project_id, client_id, expense_date,
      expense_type, km_distance, km_rate, description
    )
    VALUES (
      NEW.id,
      NEW.project_id,
      v_client_id,
      NEW.service_date::date,
      'spostamento_km',
      NEW.km_distance,
      NEW.km_rate,
      CASE
        WHEN NEW.location IS NOT NULL AND NEW.location <> ''
          THEN 'Spostamento - ' || NEW.location
        ELSE 'Spostamento'
      END
    )
    ON CONFLICT (source_service_id) DO UPDATE SET
      project_id     = EXCLUDED.project_id,
      client_id      = EXCLUDED.client_id,
      expense_date   = EXCLUDED.expense_date,
      km_distance    = EXCLUDED.km_distance,
      km_rate        = EXCLUDED.km_rate,
      description    = EXCLUDED.description;
  ELSE
    -- km removed from service -> delete the linked expense
    DELETE FROM expenses WHERE source_service_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: create expenses for any flat services with km that were missed
INSERT INTO expenses (
  source_service_id, project_id, client_id, expense_date,
  expense_type, km_distance, km_rate, description
)
SELECT
  s.id,
  s.project_id,
  COALESCE(s.client_id, p.client_id),
  s.service_date::date,
  'spostamento_km',
  s.km_distance,
  s.km_rate,
  CASE
    WHEN s.location IS NOT NULL AND s.location <> ''
      THEN 'Spostamento - ' || s.location
    ELSE 'Spostamento'
  END
FROM services s
LEFT JOIN projects p ON p.id = s.project_id
WHERE s.km_distance IS NOT NULL
  AND s.km_distance > 0
  AND NOT EXISTS (
    SELECT 1 FROM expenses e WHERE e.source_service_id = s.id
  );
