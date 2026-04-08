-- Wave 1.2A: Construction fields, lookup tables, dedup indexes
-- Adds trade_types, lead_sources, company/contact/deal extensions

-- Lookup tables
CREATE TABLE public.trade_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Seed data
INSERT INTO public.trade_types (name, display_order) VALUES
  ('Roofing', 1), ('HVAC', 2), ('Plumbing', 3), ('Electrical', 4),
  ('General Contractor', 5), ('Landscaping', 6), ('Painting', 7),
  ('Flooring', 8), ('Windows & Doors', 9), ('Other', 99);

INSERT INTO public.lead_sources (name) VALUES
  ('Manual'), ('Apify Scrapper'), ('Referral'), ('Website'),
  ('Google Maps'), ('Cold Outreach'), ('Inbound');

-- Company extensions (additive — existing columns untouched)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS trade_type_id uuid REFERENCES public.trade_types(id),
  ADD COLUMN IF NOT EXISTS service_area text,
  ADD COLUMN IF NOT EXISTS company_size text
    CHECK (company_size IN ('1-5', '6-20', '21-50', '50+')),
  ADD COLUMN IF NOT EXISTS tech_maturity text
    CHECK (tech_maturity IN ('Paper', 'Basic Digital', 'Automated')),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text;

-- Dedup index for automated ingestion
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_external_dedup
  ON public.companies (external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

-- Contact extensions
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lead_source_id uuid REFERENCES public.lead_sources(id),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text;

-- Dedup index for automated ingestion
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_external_dedup
  ON public.contacts (external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

-- Deal extensions
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lost_reason text;

-- RLS for new tables
ALTER TABLE public.trade_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_trade_types"
  ON public.trade_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_lead_sources"
  ON public.lead_sources FOR SELECT TO authenticated USING (true);

-- Admin-only writes for lookup tables
CREATE POLICY "admin_write_trade_types"
  ON public.trade_types FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_write_lead_sources"
  ON public.lead_sources FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- updated_at trigger for modified tables
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
