-- Extend deals table with gig-specific fields
-- The deals table is used for Gigs (performance bookings)
-- company_id = the hiring entity (who pays)
-- venue_id = the performance location (where it happens)

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS venue_id          uuid REFERENCES venues(id),
  ADD COLUMN IF NOT EXISTS performance_date  date,
  ADD COLUMN IF NOT EXISTS start_time        time,
  ADD COLUMN IF NOT EXISTS end_time          time,
  ADD COLUMN IF NOT EXISTS set_count         integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fee               numeric(10,2),
  ADD COLUMN IF NOT EXISTS deposit           numeric(10,2),
  ADD COLUMN IF NOT EXISTS deposit_paid      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS travel_expenses   numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes             text,
  ADD COLUMN IF NOT EXISTS quote_sent_at     timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_sent_at   timestamptz;

-- Create index for venue lookups
CREATE INDEX IF NOT EXISTS idx_deals_venue_id ON deals(venue_id);

-- Create index for performance date queries
CREATE INDEX IF NOT EXISTS idx_deals_performance_date ON deals(performance_date);

-- Add comments
COMMENT ON COLUMN deals.venue_id IS 'Physical location where the gig takes place';
COMMENT ON COLUMN deals.company_id IS 'Hiring entity (promoter, agency, or venue business)';
COMMENT ON COLUMN deals.performance_date IS 'Date of the performance';
COMMENT ON COLUMN deals.set_count IS 'Number of sets to perform';
COMMENT ON COLUMN deals.fee IS 'Total performance fee';
COMMENT ON COLUMN deals.deposit IS 'Deposit amount';
COMMENT ON COLUMN deals.deposit_paid IS 'Whether deposit has been received';
