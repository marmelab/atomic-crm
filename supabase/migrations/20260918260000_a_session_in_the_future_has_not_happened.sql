-- A session that has not happened yet cannot be completed, and a client
-- with sessions still to come has not finished.
--
-- Adriano Castro vanished from Living Example → Current while still being
-- a current client with two sessions left. He is not a special case; he is
-- the visible edge of a systemic import defect.
--
-- The historical import stamped status = 'completed' on EVERY session it
-- created, including ones scheduled weeks into the future: 76 sessions
-- across 12 clients, among them Adriano's 2026-09-20 and 2026-09-27. It
-- then stamped his Enrollment 'completed' on the day the Opportunity was
-- created — his enrollment_status_events holds exactly one row,
-- 'completed', dated 2026-05-21, with no onboarding or active before it
-- and no end_date after it.
--
-- So the Clients page was right and the data was wrong. Both facts are
-- repaired here as rules, and both are then made unrepeatable:
--
--   a session in the future has not happened
--   an Enrollment with a session still to come is not completed
--
-- This is the same principle already applied to Last Activity, which was
-- taught to ignore future events rather than to rewrite their timestamps:
-- the future is not evidence.

begin;

-- ---------------------------------------------------------------------
-- 1. Sessions that have not happened yet are booked, not completed
-- ---------------------------------------------------------------------
-- Only the provably-wrong rows are touched. A past session keeps whatever
-- it says: rewriting history is not this migration's business.
update public.client_sessions
set status = 'booked'
where status = 'completed'
  and scheduled_at > now();

-- ---------------------------------------------------------------------
-- 2. An Enrollment with sessions still to come is active, not completed
-- ---------------------------------------------------------------------
-- Stated as a rule over the whole table, not as Adriano's id. Today it
-- matches him alone; it would have matched anybody else imported the same
-- way, and it will match nobody once the guards below are in place.
update public.enrollments e
set status = 'active'
where e.status = 'completed'
  and exists (
    select 1
    from public.client_sessions s
    where s.enrollment_id = e.id
      and s.status <> 'cancelled'
      and s.no_show_at is null
      and s.scheduled_at > now()
  );

insert into public.enrollment_status_events (enrollment_id, status, entered_at)
select e.id, 'active', now()
from public.enrollments e
where e.status = 'active'
  and not exists (
    select 1 from public.enrollment_status_events ev
    where ev.enrollment_id = e.id and ev.status = 'active'
  );

-- ---------------------------------------------------------------------
-- 3. Guards, so neither can be reintroduced
-- ---------------------------------------------------------------------
create or replace function public.reject_completed_future_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- now() is not immutable, so this cannot be a CHECK constraint.
  if new.status = 'completed' and new.scheduled_at > now() then
    raise exception
      'client session % is scheduled at % and cannot be completed before it happens',
      new.id, new.scheduled_at;
  end if;
  return new;
end;
$$;

drop trigger if exists reject_completed_future_session on public.client_sessions;
create trigger reject_completed_future_session
  before insert or update on public.client_sessions
  for each row execute function public.reject_completed_future_session();

create or replace function public.reject_completion_with_sessions_remaining()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
begin
  if new.status <> 'completed' then
    return new;
  end if;

  select count(*) into v_remaining
  from public.client_sessions s
  where s.enrollment_id = new.id
    and s.status <> 'cancelled'
    and s.no_show_at is null
    and s.scheduled_at > now();

  if v_remaining > 0 then
    raise exception
      'enrollment % still has % session(s) scheduled and cannot be completed',
      new.id, v_remaining;
  end if;
  return new;
end;
$$;

drop trigger if exists reject_completion_with_sessions_remaining on public.enrollments;
create trigger reject_completion_with_sessions_remaining
  before insert or update on public.enrollments
  for each row execute function public.reject_completion_with_sessions_remaining();

-- ---------------------------------------------------------------------
-- 4. Prove the repair
-- ---------------------------------------------------------------------
do $$
declare
  v_future_completed int;
  v_bad_enrollments int;
  v_adriano text;
begin
  select count(*) into v_future_completed
  from public.client_sessions where status = 'completed' and scheduled_at > now();

  select count(*) into v_bad_enrollments
  from public.enrollments e
  where e.status = 'completed'
    and exists (
      select 1 from public.client_sessions s
      where s.enrollment_id = e.id and s.status <> 'cancelled'
        and s.no_show_at is null and s.scheduled_at > now()
    );

  select e.status into v_adriano
  from public.enrollments e
  join public.deals d on d.id = e.opportunity_id
  join public.contacts c on c.id = d.contact_id
  where c.first_name = 'Adriano' and c.last_name = 'Castro';

  if v_future_completed <> 0 then
    raise exception '% sessions are still completed in the future', v_future_completed;
  end if;
  if v_bad_enrollments <> 0 then
    raise exception '% enrollments are still completed with sessions remaining', v_bad_enrollments;
  end if;
  if v_adriano is distinct from 'active' then
    raise exception 'Adriano Castro should be an active client, found %', coalesce(v_adriano, 'no enrollment');
  end if;
end $$;

commit;
