update "public"."tasks"
set "workflow_status" = 'done'
where "done_date" is not null and "workflow_status" <> 'done';

update "public"."tasks"
set "done_date" = now()
where "workflow_status" = 'done' and "done_date" is null;

update "public"."tasks"
set "done_date" = null
where "workflow_status" in ('todo', 'in_progress') and "done_date" is not null;

create or replace function sync_task_workflow_state()
returns trigger as $$
begin
  if new.workflow_status is null then
    new.workflow_status := case when new.done_date is null then 'todo' else 'done' end;
  end if;

  if new.done_date is not null then
    new.workflow_status := 'done';
  elsif new.workflow_status = 'done' then
    new.done_date := now();
  else
    new.done_date := null;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists set_task_workflow_sync_trigger on "public"."tasks";

create trigger set_task_workflow_sync_trigger
before insert or update on "public"."tasks"
for each row
execute function sync_task_workflow_state();

alter table "public"."tasks"
drop constraint if exists "tasks_workflow_done_consistency_check";

alter table "public"."tasks"
add constraint "tasks_workflow_done_consistency_check"
check (
  ("workflow_status" = 'done' and "done_date" is not null)
  or ("workflow_status" in ('todo', 'in_progress') and "done_date" is null)
);
