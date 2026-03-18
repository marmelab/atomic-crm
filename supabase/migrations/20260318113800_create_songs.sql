-- Create songs table for the songbook
-- Stores the band's repertoire with musical details

CREATE TABLE IF NOT EXISTS songs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  artist      text,
  key         text,          -- musical key, e.g. 'G', 'Am'
  tempo       integer,       -- BPM
  duration    integer,       -- seconds
  genre       text,
  notes       text,
  lyrics_url  text,
  chart_url   text,
  tags        text[],
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can manage songs
CREATE POLICY "authenticated users can manage songs"
  ON songs FOR ALL TO authenticated USING (true);

-- Create indexes for searching and filtering
CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_artist ON songs(artist);
CREATE INDEX idx_songs_genre ON songs(genre);
CREATE INDEX idx_songs_key ON songs(key);
CREATE INDEX idx_songs_active ON songs(active);
CREATE INDEX idx_songs_tags ON songs USING gin(tags);

-- Add comments
COMMENT ON TABLE songs IS 'Band songbook/repertoire';
COMMENT ON COLUMN songs.key IS 'Musical key (e.g., C, Am, F#)';
COMMENT ON COLUMN songs.tempo IS 'Tempo in beats per minute (BPM)';
COMMENT ON COLUMN songs.duration IS 'Song duration in seconds';
COMMENT ON COLUMN songs.active IS 'Whether song is currently in rotation';
