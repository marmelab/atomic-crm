set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_company_saved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$declare company_logo text;

begin
    if new.logo is not null then
        return new;
    end if;

    company_logo = get_domain_favicon(new.website);
    if company_logo is null then
        return new;
    end if;

    new.logo = concat('{"src":"', company_logo, '","title":"Company favicon"}');
    return new;
end;$function$
;

CREATE TRIGGER company_saved BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.handle_company_saved();


