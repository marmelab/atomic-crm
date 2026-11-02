-- The WhatsApp text is handled outside the CRM. Brochures keep the file,
-- the links, and the approval status only.

alter table public.brochures drop column if exists message;

CREATE OR REPLACE FUNCTION "public"."protect_brochure_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
    -- The other app (service role) may write the brochure. A signed-in user
    -- may only change the approval status.
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
        if new.company_id is distinct from old.company_id
            or new.contact_id is distinct from old.contact_id
            or new.deal_id is distinct from old.deal_id
            or new.title is distinct from old.title
            or new.brochure_url is distinct from old.brochure_url
            or new.created_at is distinct from old.created_at
        then
            raise exception 'Only the brochure status can be changed' using errcode = '42501';
        end if;
    end if;

    new.updated_at := now();
    return new;
end;
$$;
