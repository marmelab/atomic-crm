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

CREATE OR REPLACE FUNCTION "public"."handle_contact_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$declare contact_avatar text;
declare emails_length int8;
declare item jsonb;

begin
    if new.avatar is not null then
        return new;
    end if;

    if tg_op = 'UPDATE' and new.email_jsonb is not distinct from old.email_jsonb then
        return new;
    end if;

    select coalesce(jsonb_array_length(new.email_jsonb), 0) into emails_length;

    if emails_length = 0 then
        return new;
    end if;

    for item in select jsonb_array_elements(new.email_jsonb)
    loop
        select public.get_avatar_for_email(item->>'email') into contact_avatar;
        if (contact_avatar is not null) then
            exit;
        end if;
    end loop;

    if contact_avatar is null then
        return new;
    end if;

    new.avatar = concat('{"src":"', contact_avatar, '"}');
    return new;
end;$$;
