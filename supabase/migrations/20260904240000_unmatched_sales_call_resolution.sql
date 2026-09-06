-- Unmatched Sales Call Resolution slice: durable dismissal state on
-- sales_calls (distinct from opportunity_id — see its own schema comment),
-- two new append-only event kinds, and a deterministic Task -> sales_call
-- link (same "Task points AT its context" pattern as enrollment_id/
-- onboarding_item_id).

alter table public.sales_calls
    add column dismissed_at timestamp with time zone,
    add column dismissal_reason text;

alter table public.sales_call_events
    add column dismissal_reason text;

alter table public.sales_call_events
    drop constraint sales_call_events_kind_check,
    add constraint sales_call_events_kind_check check (kind in ('booked', 'rescheduled', 'cancelled', 'attendance_recorded', 'opportunity_attached', 'dismissed'));

alter table public.tasks
    add column sales_call_id bigint;

alter table public.tasks
    add constraint tasks_sales_call_id_fkey foreign key (sales_call_id) references public.sales_calls(id) on update cascade on delete set null;

create index tasks_sales_call_id_idx on public.tasks using btree (sales_call_id);

-- Backfill: link each existing pending resolve_sales_call Task to its real
-- sales_calls row, wherever that's unambiguous today (Porsche Brown and
-- Sarah Henke's real, currently-unresolved bookings included) — read-only
-- from their perspective, this only completes a relationship the schema
-- didn't have a column for yet, never touches their business data. Only
-- backfills when exactly one candidate sales_call exists for that Contact
-- (true for every real row today); anything ambiguous is deliberately left
-- null rather than guessed, same as every other matching function in this
-- app — useTaskActionDestination.ts's own contact_id-based fallback still
-- resolves it correctly either way.
update public.tasks t
set sales_call_id = candidate.id
from (
  select distinct on (sc.contact_id) sc.id, sc.contact_id
  from public.sales_calls sc
  where sc.opportunity_id is null and sc.dismissed_at is null
  order by sc.contact_id, sc.id
) candidate
where t.type = 'resolve_sales_call'
  and t.done_date is null
  and t.sales_call_id is null
  and t.contact_id = candidate.contact_id
  and (
    select count(*) from public.sales_calls sc2
    where sc2.contact_id = candidate.contact_id
      and sc2.opportunity_id is null
      and sc2.dismissed_at is null
  ) = 1;
