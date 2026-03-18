-- Create gig_members table for band member assignments
-- Links band members (sales) to specific gigs with roles and confirmation status

CREATE TABLE IF NOT EXISTS gig_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  sales_id    uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  role        text,         -- e.g. 'Lead Guitar', 'Vocals', 'Dep'
  confirmed   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (gig_id, sales_id)
);

-- Enable Row Level Security
ALTER TABLE gig_members ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can manage gig members
CREATE POLICY "authenticated users can manage gig_members"
  ON gig_members FOR ALL TO authenticated USING (true);

-- Create indexes
CREATE INDEX idx_gig_members_gig_id ON gig_members(gig_id);
CREATE INDEX idx_gig_members_sales_id ON gig_members(sales_id);

-- Add comments
COMMENT ON TABLE gig_members IS 'Band members assigned to specific gigs';
COMMENT ON COLUMN gig_members.role IS 'Role for this gig (e.g., Lead Guitar, Dep)';
COMMENT ON COLUMN gig_members.confirmed IS 'Whether the band member has confirmed availability';
