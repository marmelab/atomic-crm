-- One canonical path for "a provider observed this person".
--
-- Last Activity is derived by contact_last_occurred_activity(), and First
-- Seen by contact_first_occurred_evidence(). Between them they read
-- fifteen sources, and not one of them is a communication: today the CRM
-- learns about a person only through an Application, a call, a session, an
-- Opportunity, a waitlist entry or a note.
--
-- Gmail and Instagram are not built here and are not referenced here. What
-- is built here is the doorway they will arrive through. Without it, the
-- first integration that wanted a DM or an email to count as activity
-- would have to add its own branch — and the second would add another,
-- and Last Activity would quietly become provider-specific.
--
-- contact_external_identities already records, provider-neutrally, when a
-- provider first and last observed an account belonging to a person. That
-- is occurred evidence about the human, so both derivations read it, with
-- the same never-in-the-future guard every other source carries. No
-- provider is named in either function, and neither invents a time: an
-- identity with no observation timestamp contributes nothing.
--
-- This changes no row today. There are no external identities yet.

begin;

create or replace function public.contact_last_occurred_activity(p_contact_id bigint)
returns timestamptz
language sql
stable
set search_path to 'public'
as $$
  select max(at) from (
    select a.submitted_at as at from applications a where a.contact_id = p_contact_id and a.submitted_at <= now()
    union all
    select a.reviewed_at from applications a where a.contact_id = p_contact_id and a.reviewed_at <= now()
    union all
    -- A sales call counts once its own time has passed. A date-only
    -- historical call is read at the end of its day: the earliest moment
    -- the whole day is certainly behind us, inventing no clock time.
    select coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59') at time zone 'UTC')
      from sales_calls sc
     where sc.contact_id = p_contact_id
       and coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59') at time zone 'UTC') <= now()
    union all
    select sc.cancelled_at from sales_calls sc where sc.contact_id = p_contact_id and sc.cancelled_at <= now()
    union all
    select sc.attendance_recorded_at from sales_calls sc where sc.contact_id = p_contact_id and sc.attendance_recorded_at <= now()
    union all
    select e.occurred_at from sales_call_events e join sales_calls sc on sc.id = e.sales_call_id
     where sc.contact_id = p_contact_id and e.occurred_at <= now()
    union all
    select cs.scheduled_at from client_sessions cs where cs.contact_id = p_contact_id and cs.scheduled_at <= now()
    union all
    select cs.cancelled_at from client_sessions cs where cs.contact_id = p_contact_id and cs.cancelled_at <= now()
    union all
    select cs.no_show_at from client_sessions cs where cs.contact_id = p_contact_id and cs.no_show_at <= now()
    union all
    select d.created_at from deals d where d.contact_id = p_contact_id and d.created_at <= now()
    union all
    select se.entered_at from deal_stage_events se join deals d on d.id = se.opportunity_id
     where d.contact_id = p_contact_id and se.entered_at <= now()
    union all
    select w.joined_at from waitlist_entries w where w.contact_id = p_contact_id and w.joined_at <= now()
    union all
    select n.date from contact_notes n where n.contact_id = p_contact_id and n.date <= now()
    union all
    select n.date from deal_notes n join deals d on d.id = n.deal_id
     where d.contact_id = p_contact_id and n.date <= now()
    union all
    -- The doorway. Any provider that records an observation through
    -- record_external_identity() contributes here, and nowhere else.
    select i.last_seen_at from contact_external_identities i
     where i.contact_id = p_contact_id and i.last_seen_at <= now()
  ) occurred;
$$;

comment on function public.contact_last_occurred_activity(bigint) is
  'The single derivation of when something last actually happened with a person. Every source is guarded to the past, so a future booking is never activity. Provider observations arrive through contact_external_identities, so no integration needs a branch of its own.';

create or replace function public.contact_first_occurred_evidence(p_contact_id bigint)
returns timestamptz
language sql
stable
set search_path to 'public'
as $$
  select min(at) from (
    select a.submitted_at as at from applications a where a.contact_id = p_contact_id and a.submitted_at <= now()
    union all
    select coalesce(sc.scheduled_at, (sc.scheduled_on + time '12:00') at time zone 'UTC')
      from sales_calls sc where sc.contact_id = p_contact_id
    union all
    select cs.scheduled_at from client_sessions cs where cs.contact_id = p_contact_id
    union all
    select d.created_at from deals d where d.contact_id = p_contact_id
    union all
    select w.joined_at from waitlist_entries w where w.contact_id = p_contact_id
    union all
    -- The same doorway, read from the other end.
    select i.first_seen_at from contact_external_identities i
     where i.contact_id = p_contact_id and i.first_seen_at <= now()
  ) evidence;
$$;

comment on function public.contact_first_occurred_evidence(bigint) is
  'The earliest moment the CRM has evidence this person existed. Returns null rather than guessing: a Contact known only through an import run has no truthful first evidence, and null is the honest answer.';

-- ---------------------------------------------------------------------
-- Prove the doorway exists and that opening it changed nothing today
-- ---------------------------------------------------------------------
do $$
declare
  v_last text := pg_get_functiondef('public.contact_last_occurred_activity(bigint)'::regprocedure);
  v_first text := pg_get_functiondef('public.contact_first_occurred_evidence(bigint)'::regprocedure);
  v_named text := '';
begin
  if position('contact_external_identities' in v_last) = 0
     or position('contact_external_identities' in v_first) = 0 then
    raise exception 'the provider-neutral activity source did not land';
  end if;

  -- No provider may be named in either derivation. Naming one here is
  -- exactly the one-off this migration exists to prevent.
  if v_last ~* '\m(instagram|gmail|meta|acuity|notion)\M'
     or v_first ~* '\m(instagram|gmail|meta|acuity|notion)\M' then
    raise exception 'a provider is hard-wired into an activity derivation';
  end if;

  -- Every source stays in the past.
  if exists (select 1 from contacts c where public.contact_last_occurred_activity(c.id) > now())
  then raise exception 'last activity derived a future time'; end if;

  select string_agg(c.id::text, ',') into v_named
    from contacts c
   where c.last_seen is distinct from public.contact_last_occurred_activity(c.id)
     and public.contact_last_occurred_activity(c.id) is not null;
  if v_named is not null then
    raise exception 'last activity changed for Contact(s) %, but no observation exists to change it', v_named;
  end if;
end $$;

commit;
