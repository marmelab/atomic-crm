-- A no-show stops ending the sale.
--
-- record_sales_call_no_show() set outcome = 'lost' on every no-show, which
-- means a missed meeting exited the Opportunity and nobody decided that.
-- Alva Winsa is still terminal because of it. "They did not turn up" does
-- not answer "are we done?", "will they rebook?" or "should they
-- nurture?", and answering those on Leif's behalf is inventing business
-- decisions.
--
-- What the function does now is the same thing cancellation already does:
-- record the fact, and put the stage back to one that is true. Call Booked
-- asserts there is a booked call; after a no-show there is not, unless a
-- later booking already exists.
--
-- outcome and prospect_decision are left entirely alone. Ending an attempt
-- is an explicit action with its own outcome event. The open question that
-- replaces the automatic exit — what happens next with this person — is
-- DERIVED from active + latest call cancelled/no-show + nothing booked
-- since, so it cannot be deleted, only resolved.
--
-- Historical rows are untouched: the 18 call_booked + lost Opportunities
-- created by the old rule stay exactly as they are. This changes what
-- happens next, not what happened.

begin;

create or replace function public.record_sales_call_no_show(p_sales_call_id bigint)
  returns jsonb
  language plpgsql
  set search_path to 'public'
as $$
declare
  v_call sales_calls%rowtype;
  v_now timestamptz := now();
  v_already_no_show boolean;
  v_tag_id bigint;
  v_stage_returned boolean := false;
begin
  select * into v_call from sales_calls where id = p_sales_call_id for update;
  if not found then
    return jsonb_build_object('status', 'not-found');
  end if;
  if v_call.opportunity_id is null then
    return jsonb_build_object('status', 'no-opportunity');
  end if;
  if v_call.attendance = 'attended' then
    -- Never silently overwrite a recorded attended outcome.
    return jsonb_build_object('status', 'already-completed');
  end if;

  v_already_no_show := v_call.attendance is not distinct from 'no_show';

  -- 1. The Sales Call is the CANONICAL historical record of the no-show.
  --    status leaves 'booked' so the partial unique index does not block a
  --    later genuine rebooking.
  if not v_already_no_show then
    update sales_calls
       set attendance = 'no_show',
           attendance_recorded_at = v_now,
           status = 'completed',
           updated_at = v_now
     where id = v_call.id;

    insert into sales_call_events (sales_call_id, kind, occurred_at, attendance)
    values (v_call.id, 'attendance_recorded', v_now, 'no_show');
  elsif v_call.status is distinct from 'completed' then
    -- Recorded as a no-show before concluded calls had to leave 'booked'.
    -- Converge the status without inventing a second attendance timestamp
    -- or a duplicate history event.
    update sales_calls set status = 'completed', updated_at = v_now
     where id = v_call.id;
  end if;

  -- 2. The Opportunity REMAINS an active sales attempt. Only the stage
  --    moves, and only when nothing else is booked: Call Booked has to
  --    mean there is a call booked.
  update deals
     set stage = 'approved',
         stage_entered_at = v_now,
         updated_at = v_now
   where id = v_call.opportunity_id
     and stage = 'call_booked'
     and public.deal_is_active(archived_at, stage, outcome)
     and not exists (
       select 1 from sales_calls s
       where s.opportunity_id = v_call.opportunity_id
         and s.id <> v_call.id
         and s.status = 'booked'
     );
  v_stage_returned := found;

  -- 3. The Contact carries a durable, visible No-show tag — a SUMMARY for
  --    at-a-glance history, never the source of truth, attached once.
  select id into v_tag_id from tags where lower(name) = 'no-show' limit 1;
  if v_tag_id is null then
    insert into tags (name, color) values ('No-show', '#fde2e4')
    returning id into v_tag_id;
  end if;

  update contacts
     set tags = coalesce(tags, '{}'::bigint[]) || v_tag_id
   where id = v_call.contact_id
     and not (coalesce(tags, '{}'::bigint[]) @> array[v_tag_id]);

  -- 4. The call concluded, so its own task is done. No follow-up task is
  --    invented: the open question is derived, and a task duplicating it
  --    could be deleted while the question remained.
  update tasks
     set done_date = v_now, status = 'completed'
   where contact_id = v_call.contact_id
     and type in ('sales_call', 'sales_call_no_show')
     and done_date is null;

  return jsonb_build_object(
    'status', case when v_already_no_show then 'already-no-show' else 'completed' end,
    'stage_returned_to_approved', v_stage_returned
  );
end;
$$;

commit;
