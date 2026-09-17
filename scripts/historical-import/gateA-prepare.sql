-- Gate A: read, in ONE round trip, both things the SQL generator must be
-- told about the target database:
--
--   nextIds — each table's REAL next identity value, taken from the
--     sequence itself (last_value + is_called), never max(id)+1. Identity
--     sequences are NOT transactional: a rolled-back pass still consumes
--     ids, so a stale value read before an earlier attempt produces
--     foreign keys pointing at rows that will never exist. This must be
--     re-read immediately before every generation.
--
--   state — the rows that already exist, so the writer's check-then-insert
--     guards are answered from reality. Contacts carry NO unique email
--     index, so assuming "empty" here duplicates people silently.
--
--     Cohorts belong here for the same reason. The writer resolves
--     intended_cohort_id by NAME, and cohort ids differ between the
--     disposable proof project and MAIN (January 2027 is id 1 in one and
--     id 4 in the other), so a cohort id carried in a static file is a
--     foreign key to whatever that other database happened to number it.
select jsonb_pretty(jsonb_build_object(
  'nextIds', (
    select jsonb_object_agg(t, nextid) from (
      select 'contacts' t, case when is_called then last_value + 1 else last_value end nextid from public.contacts_id_seq
      union all select 'deals', case when is_called then last_value + 1 else last_value end from public.deals_id_seq
      union all select 'applications', case when is_called then last_value + 1 else last_value end from public.applications_id_seq
      union all select 'waitlist_entries', case when is_called then last_value + 1 else last_value end from public.waitlist_entries_id_seq
      union all select 'enrollments', case when is_called then last_value + 1 else last_value end from public.enrollments_id_seq
      union all select 'deal_stage_events', case when is_called then last_value + 1 else last_value end from public.deal_stage_events_id_seq
      union all select 'enrollment_status_events', case when is_called then last_value + 1 else last_value end from public.enrollment_status_events_id_seq
      union all select 'sales_calls', case when is_called then last_value + 1 else last_value end from public.sales_calls_id_seq
      union all select 'client_sessions', case when is_called then last_value + 1 else last_value end from public.client_sessions_id_seq
      union all select 'historical_import_records', case when is_called then last_value + 1 else last_value end from public.historical_import_records_id_seq
    ) s
  ),
  'state', jsonb_build_object(
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('id',id,'first_name',first_name,'last_name',last_name,'stripe_customer_id',stripe_customer_id,'email_jsonb',email_jsonb)) from contacts),'[]'::jsonb),
    'cohorts', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'offer_id',offer_id)) from cohorts),'[]'::jsonb),
    'salesCallAcuity', coalesce((select jsonb_agg(jsonb_build_object('id',id,'a',acuity_appointment_id)) from sales_calls where acuity_appointment_id is not null),'[]'::jsonb),
    'clientSessionAcuity', coalesce((select jsonb_agg(jsonb_build_object('id',id,'a',acuity_appointment_id)) from client_sessions where acuity_appointment_id is not null),'[]'::jsonb),
    'enrollmentsByDeal', coalesce((select jsonb_agg(jsonb_build_object('id',id,'d',opportunity_id)) from enrollments),'[]'::jsonb),
    'waitlistActive', coalesce((select jsonb_agg(jsonb_build_object('id',id,'c',contact_id,'o',offer_id,'ch',coalesce(cohort_id,-1))) from waitlist_entries where status in ('waiting','invited')),'[]'::jsonb),
    'ledger', coalesce((select jsonb_agg(jsonb_build_object('t',entity_table,'k',source_key,'e',entity_id)) from historical_import_records),'[]'::jsonb)
  )
)) as prep;
