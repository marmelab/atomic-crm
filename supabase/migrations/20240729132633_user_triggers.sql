create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.sales (first_name, last_name, user_id)
  values (new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name', new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
