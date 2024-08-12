create function public.trigger_contactNotes_created()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public."contacts"
  set 
    last_seen = NOW()
  where id = new.contact_id;

  return new;
end;
$$;

create or replace trigger trigger_contactNotes_created
  after insert or update or delete on "contactNotes"
  for each row
  execute function trigger_contactNotes_created();
