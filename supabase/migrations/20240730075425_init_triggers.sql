

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

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute procedure public.handle_update_user();

create view init_state
  with (security_invoker=off)
  as
select count(id) as is_initialized
from public.sales
limit 1;


CREATE OR REPLACE FUNCTION set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tenant_id := (auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE TRIGGER set_tenant_id_before_insert_contacts
BEFORE INSERT ON contacts
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

CREATE TRIGGER set_tenant_id_before_insert_companies
BEFORE INSERT ON companies
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

CREATE TRIGGER set_tenant_id_before_insert_tags
BEFORE INSERT ON tags
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

CREATE TRIGGER set_tenant_id_before_insert_tasks
BEFORE INSERT ON tasks
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

CREATE TRIGGER set_tenant_id_before_insert_sales
BEFORE INSERT ON sales
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

CREATE TRIGGER set_tenant_id_before_insert_contactNotes
BEFORE INSERT ON "contactNotes"
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

CREATE TRIGGER set_tenant_id_before_insert_deals
BEFORE INSERT ON deals
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

CREATE TRIGGER set_tenant_id_before_insert_dealNotes
BEFORE INSERT ON "dealNotes"
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

