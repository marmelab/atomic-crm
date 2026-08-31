-- Waitlists human-acceptance repair pass, §4/§5: a Contact cannot stay
-- Waiting/Invited for a relationship they already have an active
-- Opportunity for, however that Opportunity was created or advanced
-- (New Opportunity, an Application, a future integration) — not only via
-- the Waitlist's own "Convert to Opportunity" button. Mirrors
-- src/components/atomic-crm/waitlist/waitlistSync.ts exactly; see that
-- file's comment for the full rationale.
--
-- Hand-authored (no local Postgres available in the session that wrote
-- this migration to run `supabase db diff`) — mirrors the declarative
-- schema changes in 02_functions.sql / 04_triggers.sql exactly. Verify
-- with `npx supabase db diff --local` before trusting this file blindly
-- in an environment where that's possible.

CREATE OR REPLACE FUNCTION "public"."handle_deal_waitlist_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.archived_at is null and new.outcome is null then
    update waitlist_entries
    set status = 'converted',
        converted_at = now(),
        converted_opportunity_id = new.id
    where contact_id = new.contact_id
      and offer_id = new.offer_id
      and status in ('waiting', 'invited')
      and (cohort_id is null or cohort_id = new.cohort_id);
  end if;
  return new;
end;
$$;

CREATE OR REPLACE TRIGGER "on_deal_waitlist_sync"
    AFTER INSERT OR UPDATE ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.handle_deal_waitlist_sync();
