-- ===========================================================================
-- Why somebody left the pipeline, not just that they did
-- ===========================================================================
-- deals.outcome records the pipeline EFFECT — nurture, lost, not_fit,
-- needs_higher_care, workshops_only — and that is all it should record.
-- But "lost" covers a person who said the price was too high, a person
-- whose timing was wrong, a person who went silent, and a person who was
-- simply afraid, and those are four different futures. Leif needs to know
-- which when he decides whether to write to them again.
--
-- So the reason gets its own column rather than being crammed into
-- outcome. No parallel status system: outcome still decides whether the
-- Opportunity is in the active pipeline, and every value below maps onto
-- an outcome that already exists.
--
--   nurture            -> nurture            not now, still real
--   timing             -> nurture            same shape, named reason
--   declined_offer     -> lost
--   money              -> lost
--   afraid             -> lost
--   ghosted            -> lost               + durable Ghosted tag
--   not_fit            -> not_fit
--   needs_higher_care  -> needs_higher_care
--   do_not_engage      -> lost               + contact sales_eligibility
--   other              -> lost               + a required note
ALTER TABLE "public"."deals"
  ADD COLUMN IF NOT EXISTS "exit_reason" text,
  ADD COLUMN IF NOT EXISTS "exit_note" text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_exit_reason_check') THEN
    ALTER TABLE "public"."deals"
      ADD CONSTRAINT "deals_exit_reason_check"
      CHECK (exit_reason IS NULL OR exit_reason = ANY (ARRAY[
        'nurture'::text,
        'timing'::text,
        'declined_offer'::text,
        'money'::text,
        'afraid'::text,
        'ghosted'::text,
        'not_fit'::text,
        'needs_higher_care'::text,
        'do_not_engage'::text,
        'other'::text
      ]));
  END IF;

  -- A reason only means something alongside an outcome: recording why
  -- somebody left while they are still in the pipeline would be a
  -- contradiction.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_exit_reason_needs_outcome_check') THEN
    ALTER TABLE "public"."deals"
      ADD CONSTRAINT "deals_exit_reason_needs_outcome_check"
      CHECK (exit_reason IS NULL OR outcome IS NOT NULL);
  END IF;

  -- "Other" is only useful if it says what it means.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_exit_other_needs_note_check') THEN
    ALTER TABLE "public"."deals"
      ADD CONSTRAINT "deals_exit_other_needs_note_check"
      CHECK (exit_reason IS DISTINCT FROM 'other' OR coalesce(trim(exit_note), '') <> '');
  END IF;
END $$;

COMMENT ON COLUMN "public"."deals"."exit_reason" IS
  'Why this Opportunity left the active pipeline. Complements outcome, never replaces it.';

CREATE INDEX IF NOT EXISTS "deals_exit_reason_idx"
  ON "public"."deals" USING btree ("exit_reason") WHERE "exit_reason" IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE 'exit_reason available; existing exited Opportunities keep a null reason rather than a guessed one';
END $$;
