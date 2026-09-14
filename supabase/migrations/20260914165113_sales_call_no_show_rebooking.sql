-- Go-Live Blocker: Sales-Call No-Show/Rebooking. A concluded Sales Call
-- (attendance recorded, attended or no_show) never left status='booked' --
-- sales_calls_one_booked_per_opportunity_idx is a PARTIAL unique index on
-- (opportunity_id) WHERE status = 'booked', so a genuine rebooking after a
-- no-show either silently reused/corrupted the concluded row (retargeting
-- it, leaving attendance stuck at 'no_show') or, if a fresh row were
-- inserted instead, would hit a unique-violation against the still-'booked'
-- old row. Adding 'completed' lets completeSalesCallOutcome.ts correctly
-- retire a concluded call the moment its outcome is recorded, freeing the
-- unique-index slot for a genuinely fresh booking while the old row remains
-- untouched, permanent history.

alter table "public"."sales_calls" drop constraint "sales_calls_status_check";
alter table "public"."sales_calls" add constraint "sales_calls_status_check" check ((status = any (array['booked'::text, 'completed'::text, 'cancelled'::text]))) not valid;
alter table "public"."sales_calls" validate constraint "sales_calls_status_check";
