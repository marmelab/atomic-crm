set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_contact_saved()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$declare contact_avatar text;
declare emails_length int8;
declare item jsonb;

begin
    if new.avatar is not null then
        return new;
    end if;

    -- Look the avatar up again when the emails changed or the avatar was just removed
    if tg_op = 'UPDATE' and new.email_jsonb is not distinct from old.email_jsonb and old.avatar is null then
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
end;$function$
;
