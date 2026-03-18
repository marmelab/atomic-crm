-- Create quote template tables for document generation
-- Supports reusable templates and generated quotes per gig

-- Quote templates (reusable HTML templates with Handlebars variables)
CREATE TABLE IF NOT EXISTS quote_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  body_html    text NOT NULL,   -- Handlebars/mustache template
  is_default   boolean DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Generated quotes for specific gigs
CREATE TABLE IF NOT EXISTS gig_quotes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id         uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  template_id    uuid REFERENCES quote_templates(id) ON DELETE SET NULL,
  rendered_html  text NOT NULL,
  sent_at        timestamptz,
  accepted_at    timestamptz,
  version        integer DEFAULT 1,
  created_at     timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_quotes ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can manage quotes
CREATE POLICY "authenticated users can manage quote_templates"
  ON quote_templates FOR ALL TO authenticated USING (true);

CREATE POLICY "authenticated users can manage gig_quotes"
  ON gig_quotes FOR ALL TO authenticated USING (true);

-- Create indexes
CREATE INDEX idx_quote_templates_is_default ON quote_templates(is_default);
CREATE INDEX idx_gig_quotes_gig_id ON gig_quotes(gig_id);
CREATE INDEX idx_gig_quotes_template_id ON gig_quotes(template_id);

-- Add comments
COMMENT ON TABLE quote_templates IS 'Reusable quote templates with Handlebars variables';
COMMENT ON TABLE gig_quotes IS 'Generated quotes for specific gigs';
COMMENT ON COLUMN quote_templates.body_html IS 'HTML template with {{variable}} placeholders';
COMMENT ON COLUMN quote_templates.is_default IS 'Whether this is the default template';
COMMENT ON COLUMN gig_quotes.version IS 'Version number for tracking quote revisions';
