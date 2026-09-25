set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_tag_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  update public.contacts set tags = array_remove(tags, old.id) where tags @> array[old.id];
  return old;
end;
$function$
;

CREATE TRIGGER on_tag_deleted AFTER DELETE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.handle_tag_deleted();
