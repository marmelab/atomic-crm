-- Add company_type directly on deals so a deal's view can be set independently of its company
ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_type text;

-- Backfill from linked company's type
UPDATE deals d
SET company_type = c.type
FROM companies c
WHERE d.company_id = c.id
  AND d.company_type IS NULL;
