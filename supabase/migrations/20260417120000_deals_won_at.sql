-- Track the date a deal transitioned to closed-won (decoupled from updated_at).
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS won_at date;

CREATE OR REPLACE FUNCTION public.set_deal_won_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.stage = 'closed-won' AND (OLD.stage IS DISTINCT FROM 'closed-won') THEN
    NEW.won_at := NOW();
  ELSIF NEW.stage != 'closed-won' AND OLD.stage = 'closed-won' THEN
    NEW.won_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deal_stage_won_at ON public.deals;
CREATE TRIGGER deal_stage_won_at
    BEFORE UPDATE ON public.deals
    FOR EACH ROW
    WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
    EXECUTE FUNCTION public.set_deal_won_at();

-- Backfill: set won_at for existing closed-won deals without a date
UPDATE public.deals
SET won_at = updated_at::date
WHERE stage = 'closed-won' AND won_at IS NULL;
