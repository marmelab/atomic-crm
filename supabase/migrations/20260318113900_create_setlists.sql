-- Create set list tables for managing gig set lists
-- Supports multiple sets per gig with ordered songs

-- Set list templates (reusable, not linked to specific gigs)
CREATE TABLE IF NOT EXISTS set_list_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Set lists for specific gigs
CREATE TABLE IF NOT EXISTS set_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      uuid REFERENCES deals(id) ON DELETE CASCADE,
  template_id uuid REFERENCES set_list_templates(id) ON DELETE SET NULL,
  name        text NOT NULL DEFAULT 'Set 1',  -- 'Set 1', 'Set 2', etc.
  position    integer NOT NULL DEFAULT 1,
  created_at  timestamptz DEFAULT now(),
  -- Either gig_id or template_id must be set (but not both for templates)
  CHECK (
    (gig_id IS NOT NULL AND template_id IS NULL) OR
    (gig_id IS NULL AND template_id IS NOT NULL)
  )
);

-- Songs in set lists (works for both gig set lists and templates)
CREATE TABLE IF NOT EXISTS set_list_songs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_list_id  uuid NOT NULL REFERENCES set_lists(id) ON DELETE CASCADE,
  song_id      uuid NOT NULL REFERENCES songs(id) ON DELETE RESTRICT,
  position     integer NOT NULL,
  notes        text,         -- per-gig notes for this song
  created_at   timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE set_list_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_list_songs ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can manage all set list data
CREATE POLICY "authenticated users can manage set_list_templates"
  ON set_list_templates FOR ALL TO authenticated USING (true);

CREATE POLICY "authenticated users can manage set_lists"
  ON set_lists FOR ALL TO authenticated USING (true);

CREATE POLICY "authenticated users can manage set_list_songs"
  ON set_list_songs FOR ALL TO authenticated USING (true);

-- Create indexes
CREATE INDEX idx_set_lists_gig_id ON set_lists(gig_id);
CREATE INDEX idx_set_lists_template_id ON set_lists(template_id);
CREATE INDEX idx_set_list_songs_set_list_id ON set_list_songs(set_list_id);
CREATE INDEX idx_set_list_songs_song_id ON set_list_songs(song_id);
CREATE INDEX idx_set_list_songs_position ON set_list_songs(set_list_id, position);

-- Add comments
COMMENT ON TABLE set_list_templates IS 'Reusable set list templates';
COMMENT ON TABLE set_lists IS 'Set lists for specific gigs or templates';
COMMENT ON TABLE set_list_songs IS 'Songs within a set list with ordering';
COMMENT ON COLUMN set_lists.position IS 'Order of sets within a gig (Set 1, Set 2, etc.)';
COMMENT ON COLUMN set_list_songs.position IS 'Order of songs within the set';
