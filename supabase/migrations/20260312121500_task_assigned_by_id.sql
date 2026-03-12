alter table "public"."tasks"
add column "assigned_by_id" bigint;

update "public"."tasks"
set "assigned_by_id" = "sales_id"
where "assigned_by_id" is null;

alter table "public"."tasks"
add constraint "tasks_assigned_by_id_fkey"
foreign key ("assigned_by_id") references "public"."sales"("id");

create index "tasks_assigned_by_id_idx"
on "public"."tasks" using btree ("assigned_by_id");

create or replace function set_task_assigned_by_default()
returns trigger as $$
begin
  if new.assigned_by_id is null then
    select id into new.assigned_by_id from sales where user_id = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger set_task_assigned_by_id_trigger
before insert on "public"."tasks"
for each row
execute function set_task_assigned_by_default();
