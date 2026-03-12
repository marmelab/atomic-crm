alter table "public"."tasks"
add column "workflow_status" text not null default 'todo';

update "public"."tasks"
set "workflow_status" = 'done'
where "done_date" is not null;

alter table "public"."tasks"
add constraint "tasks_workflow_status_check"
check ("workflow_status" in ('todo', 'in_progress', 'done'));
