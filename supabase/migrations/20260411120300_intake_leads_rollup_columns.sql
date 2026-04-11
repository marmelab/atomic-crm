ALTER TABLE public.intake_leads ADD COLUMN IF NOT EXISTS current_draft_status TEXT
  DEFAULT 'none'
  CHECK (current_draft_status IN ('none', 'drafting', 'ai_reviewed', 'approved', 'sent'));

ALTER TABLE public.intake_leads ADD COLUMN IF NOT EXISTS outreach_subject TEXT;
