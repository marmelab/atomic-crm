-- ===========================================================================
-- "Ghosted" is a decision the prospect made
-- ===========================================================================
-- Leif needs to record three answers when somebody at Decision resolves:
-- they committed, they declined the offer, or they went silent. The first
-- two already have a home in prospect_decision ('yes' / 'no'). The third
-- did not, and the nearest existing value was 'no' — which asserts the
-- person said no. They did not say anything. That is the whole difference,
-- and it is the difference that decides whether Leif ever writes to them
-- again.
--
-- So 'ghosted' joins the same field rather than living only as a tag. The
-- durable Contact tag still gets applied (behavioural shorthand that
-- survives across Opportunities), but the Opportunity's own record of what
-- happened belongs on the Opportunity.
--
-- Both 'no' and 'ghosted' exit the pipeline the same way, via outcome
-- 'lost'; no new outcome value is invented, because the commercial result
-- really is the same.
ALTER TABLE "public"."deals"
  DROP CONSTRAINT IF EXISTS "deals_prospect_decision_check";

ALTER TABLE "public"."deals"
  ADD CONSTRAINT "deals_prospect_decision_check"
  CHECK (prospect_decision = ANY (ARRAY['yes'::text, 'thinking'::text, 'no'::text, 'ghosted'::text]));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_prospect_decision_check'
  ) THEN
    RAISE EXCEPTION 'prospect_decision constraint was dropped and not restored';
  END IF;
  RAISE NOTICE 'prospect_decision now accepts ghosted';
END $$;
