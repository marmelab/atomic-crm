-- Contracts + Onboarding slice: snapshot the action-wording template onto
-- each enrollment_onboarding_items row too (alongside label/is_required) —
-- needed so reopenOnboardingItem.ts can recreate a well-worded Task from
-- scratch (its originally-linked Task was cancelled, not merely completed)
-- without re-reading the live, possibly since-edited or deactivated
-- template row.
alter table public.enrollment_onboarding_items
    add column task_text_template text;

update public.enrollment_onboarding_items i
set task_text_template = t.task_text_template
from public.onboarding_requirement_templates t
where t.key = i.requirement_key
  and t.offer_id = (
    select d.offer_id from public.deals d
    join public.enrollments e on e.opportunity_id = d.id
    where e.id = i.enrollment_id
  );

alter table public.enrollment_onboarding_items
    alter column task_text_template set not null;

CREATE OR REPLACE FUNCTION "public"."handle_deal_won"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_cohort cohorts%ROWTYPE;
  v_enrollment_id bigint;
  v_contact_name text;
  v_item record;
begin
  if new.stage = 'won' and (tg_op = 'INSERT' or old.stage is distinct from 'won') then
    if new.cohort_id is not null then
      select * into v_cohort from cohorts where id = new.cohort_id;
    end if;

    insert into enrollments (opportunity_id, status, start_date, end_date)
    values (
      new.id,
      'onboarding',
      v_cohort.program_start_at::date,
      v_cohort.program_end_at::date
    )
    on conflict (opportunity_id) do nothing
    returning id into v_enrollment_id;

    if v_enrollment_id is not null then
      select trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
        into v_contact_name
        from contacts where id = new.contact_id;
      if v_contact_name is null or v_contact_name = '' then
        v_contact_name := new.name;
      end if;

      for v_item in
        insert into enrollment_onboarding_items
          (enrollment_id, requirement_key, label, task_text_template, is_required, sort_order)
        select v_enrollment_id, t.key, t.label, t.task_text_template, t.is_required, t.sort_order
        from onboarding_requirement_templates t
        where t.offer_id = new.offer_id and t.is_active
        returning id, is_required, task_text_template
      loop
        if v_item.is_required then
          insert into tasks (contact_id, type, text, due_date, status, enrollment_id, onboarding_item_id)
          values (
            new.contact_id,
            'onboarding_item',
            replace(v_item.task_text_template, '{name}', v_contact_name),
            now() + interval '3 days',
            'pending',
            v_enrollment_id,
            v_item.id
          );
        end if;
      end loop;
    end if;
  end if;
  return new;
end;
$$;
