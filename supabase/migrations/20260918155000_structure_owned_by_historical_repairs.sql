-- Structure that historical repairs happened to be carrying.
--
-- Seven migrations classified main_only_historical_data_repair also
-- created durable structure: columns, a unique index, two CHECKs, four
-- functions, two triggers and the reconcile-stripe schedule. That made
-- them unskippable — a database rebuilt from this repository without them
-- would be quietly missing a column and two guard triggers, and nothing
-- would say so until something failed much later.
--
-- The structure moves here so it reconstructs on its own. The repairs keep
-- their production-specific assertions and stay MAIN-only.
--
-- Placed at 20260918155000, immediately before the earliest repair that
-- owned any of it (20260918160000), because deals.payment_review_reason is
-- needed by 20260918290000 — a deterministic migration that must run in a
-- rebuilt database. Everything else here has no deterministic consumer at
-- all, so this one position serves them all.
--
-- One object is deliberately NOT here: record_deal_outcome_event(). The
-- deterministic 20260918370000 creates it and the repair 20260918390000
-- replaces it, so installing the final body at this point would simply be
-- overwritten. It lands after 370000 instead, in the companion migration.
--
-- Every statement is idempotent and changes no business data. On MAIN all
-- of it already exists, so this applies as a structural no-op; the
-- function bodies below are MAIN's own, read out with pg_get_functiondef
-- rather than retyped, so replacing them cannot regress a later repair.

begin;

-- ---------------------------------------------------------------------
-- Columns (from 20260918200000, 20260918210000, 20260918320000)
-- ---------------------------------------------------------------------
alter table public.deals
  add column if not exists payment_review_reason text,
  add column if not exists stripe_linked_at timestamptz,
  add column if not exists stripe_link_source text;

alter table public.enrollment_onboarding_items
  add column if not exists completion_source text;

-- ---------------------------------------------------------------------
-- CHECK constraints — added only when absent, so MAIN is never asked to
-- revalidate a constraint it already satisfies.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deals_stripe_link_source_check') then
    alter table public.deals
      add constraint deals_stripe_link_source_check
      check ((stripe_link_source is null)
             or (stripe_link_source = any (array['crm_checkout'::text, 'reconciliation_customer_id'::text])));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'enrollment_onboarding_items_completion_source_check') then
    alter table public.enrollment_onboarding_items
      add constraint enrollment_onboarding_items_completion_source_check
      check ((completion_source is null)
             or (completion_source = any (array['app'::text, 'owner_confirmed'::text, 'historical_confirmed'::text])));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- One PaymentIntent, one payment row (from 20260918210000)
-- ---------------------------------------------------------------------
create unique index if not exists deal_payment_schedule_items_stripe_pi_key
  on public.deal_payment_schedule_items (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- ---------------------------------------------------------------------
-- Functions (from 20260918160000 and 20260918260000), verbatim from MAIN
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_tasks_for_sales_call(p_sales_call_id bigint, p_completed_at timestamp with time zone)
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  with closed as (
    update tasks
       set done_date = p_completed_at, status = 'completed'
     where sales_call_id = p_sales_call_id
       and done_date is null
       and status in ('pending', 'waiting')
    returning 1
  )
  select count(*) from closed;
$function$
;

CREATE OR REPLACE FUNCTION public.record_sales_call_reinstated(p_sales_call_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_call sales_calls%ROWTYPE;
  v_now timestamptz := now();
  v_deal_advanced boolean := false;
begin
  select * into v_call from sales_calls where id = p_sales_call_id for update;
  if not found then
    return jsonb_build_object('status', 'not-found');
  end if;

  -- Never re-open something that actually concluded. If a human recorded
  -- attendance, that is the truth about this call and a live upstream
  -- booking cannot overwrite it.
  if v_call.attendance is not null then
    return jsonb_build_object('status', 'already-concluded');
  end if;

  -- Only a future call can be "still booked". A past cancelled call is
  -- history, and this is exactly where Aurelie must be left alone.
  if coalesce(v_call.scheduled_at, (v_call.scheduled_on + time '23:59') at time zone 'UTC') <= v_now then
    return jsonb_build_object('status', 'in-the-past');
  end if;

  if v_call.status = 'booked' then
    return jsonb_build_object('status', 'already-booked');
  end if;

  update sales_calls
     set status = 'booked',
         cancelled_at = null,
         updated_at = v_now
   where id = v_call.id;

  insert into sales_call_events (sales_call_id, kind, occurred_at, new_scheduled_at)
  values (v_call.id, 'booked', v_now, v_call.scheduled_at);

  -- The Opportunity returns to Call Booked, but only from Approved and
  -- only while still active — the exact inverse of the cancellation path,
  -- and never dragging a Deal backwards from Decision or further on.
  if v_call.opportunity_id is not null then
    update deals
       set stage = 'call_booked',
           stage_entered_at = v_now,
           updated_at = v_now
     where id = v_call.opportunity_id
       and stage = 'approved'
       and outcome is null
       and archived_at is null;
    v_deal_advanced := found;
  end if;

  return jsonb_build_object(
    'status', 'reinstated',
    'sales_call_id', v_call.id,
    'opportunity_id', v_call.opportunity_id,
    'deal_advanced_to_call_booked', v_deal_advanced
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_completed_future_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- now() is not immutable, so this cannot be a CHECK constraint.
  if new.status = 'completed' and new.scheduled_at > now() then
    raise exception
      'client session % is scheduled at % and cannot be completed before it happens',
      new.id, new.scheduled_at;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_completion_with_sessions_remaining()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

grant execute on function public.record_sales_call_reinstated(bigint)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Guard triggers (from 20260918260000)
-- ---------------------------------------------------------------------
drop trigger if exists reject_completed_future_session on public.client_sessions;
create trigger reject_completed_future_session
  before insert or update on public.client_sessions
  for each row execute function public.reject_completed_future_session();

drop trigger if exists reject_completion_with_sessions_remaining on public.enrollments;
create trigger reject_completion_with_sessions_remaining
  before insert or update on public.enrollments
  for each row execute function public.reject_completion_with_sessions_remaining();

-- ---------------------------------------------------------------------
-- The Stripe reconciliation schedule (from 20260918190000)
-- ---------------------------------------------------------------------
-- Scheduled only when absent. Re-scheduling an existing job would change
-- its id and its next run for no reason, which is exactly what "do not
-- unexpectedly reschedule it" rules out. The secret is read from Vault by
-- name at execution time and never appears here.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'reconcile-stripe') then
    perform cron.schedule(
      'reconcile-stripe',
      '47 * * * *',
      $job$
  select net.http_post(
    url := 'https://xlyywsguftyvomeretju.supabase.co/functions/v1/stripe_webhook?action=reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_invoke_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );
  $job$
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Prove it, rather than assume the structure landed
-- ---------------------------------------------------------------------
do $$
declare
  v_missing text := '';
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='deals'
                   and column_name='payment_review_reason') then
    v_missing := v_missing || 'deals.payment_review_reason '; end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='enrollment_onboarding_items'
                   and column_name='completion_source') then
    v_missing := v_missing || 'enrollment_onboarding_items.completion_source '; end if;
  if not exists (select 1 from pg_constraint where conname='deals_stripe_link_source_check') then
    v_missing := v_missing || 'deals_stripe_link_source_check '; end if;
  if not exists (select 1 from pg_indexes where indexname='deal_payment_schedule_items_stripe_pi_key') then
    v_missing := v_missing || 'deal_payment_schedule_items_stripe_pi_key '; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='record_sales_call_reinstated') then
    v_missing := v_missing || 'record_sales_call_reinstated '; end if;
  if (select count(*) from pg_trigger
      where tgname in ('reject_completed_future_session','reject_completion_with_sessions_remaining')
        and not tgisinternal) <> 2 then
    v_missing := v_missing || 'guard triggers '; end if;
  if (select count(*) from cron.job where jobname='reconcile-stripe') <> 1 then
    v_missing := v_missing || 'exactly one reconcile-stripe job '; end if;

  if v_missing <> '' then
    raise exception 'structural extraction incomplete: %', v_missing;
  end if;
end $$;

commit;
