-- Nobody could create a sales call. Not by hand, not from Acuity.
--
-- sales_calls.scheduled_on became NOT NULL on 2026-09-17
-- (20260917230000, the date-only precision slice) with no default and
-- nothing to fill it. Both writers — bookSalesCall.ts in the app and the
-- Acuity webhook's own insert — state the INSTANT and never the date, so
-- every insert since has failed with
--
--   23502  null value in column "scheduled_on" violates not-null
--
-- which PostgREST returns as a 400 and the UI shows as "Server
-- communication error". Leif hit it trying to log Dax Kara's call. The
-- reason nobody hit it sooner is that cancelling, rescheduling and
-- recording a no-show are all UPDATEs; only CREATING a call was broken,
-- and no new client had booked since.
--
-- The column should never have been a payload obligation. schedule_precision
-- already says which half is authoritative:
--
--   exact      scheduled_at is the fact; the date is a projection of it
--   date_only  scheduled_on is the fact; there is no instant to project
--
-- So it is derived here, once, for every writer there will ever be —
-- rather than adding the same line to two callers and waiting for a third
-- to forget it.
--
-- The date is the DENVER calendar date, because "what day was the call"
-- is a question about Leif's day, not about UTC. All 195 existing rows
-- already agree with that reading, so nothing is reinterpreted: their
-- stored dates match the Denver projection exactly, and the UTC one too
-- (no call has ever been late enough in the evening for the two to
-- differ).

begin;

create or replace function public.derive_sales_call_scheduled_on()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- An exact call knows its instant, so the day comes from it. Written
  -- unconditionally rather than only when null: a reschedule moves the
  -- instant, and a date left behind pointing at the old day would be a
  -- quieter bug than the one this replaces.
  if new.schedule_precision = 'exact' and new.scheduled_at is not null then
    new.scheduled_on := (new.scheduled_at at time zone 'America/Denver')::date;
  end if;
  -- A date-only call has no instant to project; its scheduled_on is the
  -- fact itself and is left exactly as supplied.
  return new;
end;
$$;

comment on function public.derive_sales_call_scheduled_on() is
  'Keeps sales_calls.scheduled_on a projection of scheduled_at for exact calls, in America/Denver. A caller states when the call is; what day that lands on is not its job, and making it one broke every call-creating path for three days.';

drop trigger if exists derive_sales_call_scheduled_on_trigger on public.sales_calls;
create trigger derive_sales_call_scheduled_on_trigger
  before insert or update of scheduled_at, schedule_precision on public.sales_calls
  for each row execute function public.derive_sales_call_scheduled_on();

-- ---------------------------------------------------------------------
-- Prove a call can be created again, by the roles that create them
-- ---------------------------------------------------------------------
-- Run entirely as `authenticated` — the browser's own role, which is
-- both the point of the test and the only role here guaranteed DML on
-- these tables (the migration runner is not). The inner block is a
-- subtransaction ending in a raise, so every row it writes disappears
-- while the PL/pgSQL variables holding the verdict survive.
do $$
declare
  v_manual_on date;
  v_evening_on date;
  v_acuity_ok boolean := false;
  v_manual_err text;
  v_acuity_err text;
begin
  begin
    declare
      v_contact bigint;
      v_deal bigint;
      v_offer bigint;
      v_call bigint;
    begin
      set local role authenticated;
      select id into v_offer from offers order by id limit 1;
      insert into contacts (first_name, last_name, first_seen, last_seen)
      values ('Zz', 'Call Probe', now(), now()) returning id into v_contact;
      insert into deals (name, contact_id, offer_id, stage, stage_entered_at)
      values ('zz call probe', v_contact, v_offer, 'approved', now())
      returning id into v_deal;

      -- The app's own payload: an instant, and no date at all.
      begin
        insert into sales_calls
          (opportunity_id, contact_id, status, original_scheduled_at, scheduled_at,
           reschedule_count, source)
        values (v_deal, v_contact, 'booked',
                timestamptz '2026-08-01 12:30 America/Denver',
                timestamptz '2026-08-01 12:30 America/Denver',
                0, 'manual')
        returning id, scheduled_on into v_call, v_manual_on;
      exception when others then
        v_manual_err := format('%s: %s', sqlstate, sqlerrm);
      end;

      -- A call late enough in the evening belongs to the Denver day it
      -- was held on, not to tomorrow in UTC.
      if v_call is not null then
        update sales_calls
           set scheduled_at = timestamptz '2026-08-01 19:00 America/Denver',
               original_scheduled_at = timestamptz '2026-08-01 19:00 America/Denver'
         where id = v_call
        returning scheduled_on into v_evening_on;
      end if;

      -- And the Acuity webhook's payload, as the role it runs under.
      set local role service_role;
      begin
        insert into sales_calls
          (opportunity_id, contact_id, status, original_scheduled_at, scheduled_at,
           reschedule_count, source, acuity_appointment_id, acuity_appointment_type_id)
        values (null, v_contact, 'booked', now() + interval '3 days',
                now() + interval '3 days', 0, 'acuity', 'zz_probe_appt', '91345095');
        v_acuity_ok := true;
      exception when others then
        v_acuity_err := format('%s: %s', sqlstate, sqlerrm);
      end;
      reset role;

      raise exception 'ZZ_CALL_PROBE_ROLLBACK';
    end;
  exception when others then
    if sqlerrm <> 'ZZ_CALL_PROBE_ROLLBACK' then
      raise;
    end if;
  end;

  if v_manual_err is not null then
    raise exception 'a manual call still cannot be created — %', v_manual_err;
  end if;
  if v_manual_on is distinct from date '2026-08-01' then
    raise exception 'derived the wrong day: % (expected 2026-08-01)', v_manual_on;
  end if;
  if v_evening_on is distinct from date '2026-08-01' then
    raise exception 'an evening call was filed under the wrong day: %', v_evening_on;
  end if;
  if not v_acuity_ok then
    raise exception 'an Acuity booking still cannot be created — %',
      coalesce(v_acuity_err, 'no error reported');
  end if;
end $$;

-- Every existing row still agrees with its own instant.
do $$
declare v_n int;
begin
  select count(*) into v_n from sales_calls
   where schedule_precision = 'exact'
     and scheduled_at is not null
     and scheduled_on <> (scheduled_at at time zone 'America/Denver')::date;
  if v_n <> 0 then
    raise exception '% existing call(s) disagree with their own scheduled_at', v_n;
  end if;
end $$;

commit;
