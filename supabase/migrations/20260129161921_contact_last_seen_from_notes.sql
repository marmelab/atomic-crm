set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_contact_note_created_or_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.contacts set last_seen = new.date where contacts.id = new.contact_id and contacts.last_seen < new.date;
  return new;
end;
$function$
;

CREATE TRIGGER on_public_contact_notes_created_or_updated AFTER INSERT ON public.contact_notes FOR EACH ROW EXECUTE FUNCTION public.handle_contact_note_created_or_updated();

CREATE OR REPLACE FUNCTION get_user_id_by_email(email TEXT)
RETURNS TABLE (id uuid)
SECURITY definer
AS $$
BEGIN
  RETURN QUERY SELECT au.id FROM auth.users au WHERE au.email = $1;
END;
$$ LANGUAGE plpgsql;

revoke execute on function public.get_user_id_by_email from anon, authenticated, public;
