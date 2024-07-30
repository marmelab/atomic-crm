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

  insert into public.sales (first_name, last_name, user_id, administrator)
  values (
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name', 
    new.id, 
    case when sales_count > 0 then FALSE else TRUE end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


create view init_state as
select count(id) as is_initialized
from public.sales
limit 1;