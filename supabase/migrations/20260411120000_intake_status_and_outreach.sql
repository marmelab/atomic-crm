-- Agency CRM Redesign: Update intake_leads status constraint + add outreach tracking columns
-- Maps old statuses → new state machine, adds columns for 7-touch cadence tracking

-- Step 1: Remap old status values to new state machine
UPDATE public.intake_leads SET status = 'uncontacted' WHERE status = 'new';
UPDATE public.intake_leads SET status = 'engaged' WHERE status = 'contacted';
UPDATE public.intake_leads SET status = 'engaged' WHERE status = 'responded';
-- 'qualified' and 'rejected' remain unchanged

-- Step 2: Drop old CHECK constraint and add new one
ALTER TABLE public.intake_leads DROP CONSTRAINT IF EXISTS intake_leads_status_check;
ALTER TABLE public.intake_leads
  ADD CONSTRAINT intake_leads_status_check
  CHECK (status IN ('uncontacted', 'in-sequence', 'engaged', 'not-interested', 'unresponsive', 'qualified', 'rejected'));

-- Step 3: Update default value
ALTER TABLE public.intake_leads ALTER COLUMN status SET DEFAULT 'uncontacted';

-- Step 4: Add outreach tracking columns
ALTER TABLE public.intake_leads ADD COLUMN IF NOT EXISTS last_outreach_at timestamptz;
ALTER TABLE public.intake_leads ADD COLUMN IF NOT EXISTS outreach_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.intake_leads ADD COLUMN IF NOT EXISTS next_outreach_date timestamptz;
ALTER TABLE public.intake_leads ADD COLUMN IF NOT EXISTS outreach_sequence_step integer NOT NULL DEFAULT 0;
