create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  sales_count int;
begin
  select count(id) into sales_count
  from public.sales;

  insert into public.sales (first_name, last_name, email, user_id, administrator)
  values (
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name', 
    new.email, 
    new.id, 
    case when sales_count > 0 then FALSE else TRUE end
  );
  return new;
end;
$$;

create function public.handle_update_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.sales
  set 
    first_name = new.raw_user_meta_data ->> 'first_name', 
    last_name = new.raw_user_meta_data ->> 'last_name', 
    email = new.email
  where user_id = new.id;

  return new;
end;
$$;


create unique index "uq__sales__user_id" on public.sales (user_id);

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute procedure public.handle_update_user();

create view init_state
  with (security_invoker=off)
  as
select count(id) as is_initialized
from public.sales
limit 1;
