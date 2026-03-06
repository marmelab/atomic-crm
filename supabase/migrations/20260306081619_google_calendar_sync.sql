-- Add google_event_id and google_event_link to services for bidirectional Calendar link
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_event_link text;

-- Index for quick lookup when Calendar sends updates
CREATE INDEX IF NOT EXISTS idx_services_google_event_id
  ON services (google_event_id)
  WHERE google_event_id IS NOT NULL;
