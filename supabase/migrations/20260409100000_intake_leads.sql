-- Cold Intake System: staging table for lead engine output
-- Scraped leads land here before promotion to contacts/deals

CREATE TABLE public.intake_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  phone text,
  email extensions.citext,
  website extensions.citext,
  address text,
  city text,
  region text,
  trade_type_id uuid REFERENCES public.trade_types(id),
  enrichment_summary text,
  outreach_draft text,
  source text DEFAULT 'lead-engine',
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'responded', 'qualified', 'rejected')),
  rejection_reason text,
  promoted_contact_id bigint REFERENCES public.contacts(id),
  notes text,
  sales_id bigint REFERENCES public.sales(id),
  metadata jsonb DEFAULT '{}',
  idempotency_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_intake_leads_idempotency
  ON public.intake_leads (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_intake_leads_status
  ON public.intake_leads (status);

CREATE INDEX idx_intake_leads_trade_type
  ON public.intake_leads (trade_type_id);

CREATE INDEX idx_intake_leads_created
  ON public.intake_leads (created_at DESC);

-- RLS
ALTER TABLE public.intake_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_intake_leads"
  ON public.intake_leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_intake_leads"
  ON public.intake_leads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_intake_leads"
  ON public.intake_leads FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated_delete_intake_leads"
  ON public.intake_leads FOR DELETE TO authenticated USING (true);

-- Reuse existing updated_at trigger function
CREATE TRIGGER set_intake_leads_updated_at
  BEFORE UPDATE ON public.intake_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
