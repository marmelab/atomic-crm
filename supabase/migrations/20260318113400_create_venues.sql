-- Create venues table for physical performance locations
-- Venues are separate from companies (hiring entities)

CREATE TABLE IF NOT EXISTS venues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  address         text,
  city            text,
  postcode        text,
  country         text DEFAULT 'UK',
  capacity        integer,
  stage_size      text,           -- e.g. '20ft x 15ft'
  parking_info    text,
  load_in_notes   text,           -- loading bay access, stairs, etc.
  contact_name    text,           -- venue contact (not in contacts table)
  contact_phone   text,
  contact_email   text,
  website         text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can manage venues
CREATE POLICY "authenticated users can manage venues"
  ON venues FOR ALL TO authenticated USING (true);

-- Create indexes for searching
CREATE INDEX idx_venues_name ON venues(name);
CREATE INDEX idx_venues_city ON venues(city);

-- Add comment
COMMENT ON TABLE venues IS 'Physical performance locations where gigs take place';
