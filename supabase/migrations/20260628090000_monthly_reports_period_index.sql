-- Valbar rapportperiod: en kund kan ha flera rapporter med olika längd
-- (månad, kvartal, kampanjspann ...) som kan dela startmånad. Den gamla
-- unikheten (company_id, period) tillät bara en per startmånad.
--
-- Byter unik-index — endast index, ingen dataförlust. Den nya nyckeln är
-- (company_id, data_period_start, data_period_end) = en rapport per distinkt
-- period, vilket bevarar idempotensen för cron-månadsrapporten.

DROP INDEX IF EXISTS idx_monthly_reports_company_period;

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_reports_company_data_period
  ON public.monthly_reports(company_id, data_period_start, data_period_end);
