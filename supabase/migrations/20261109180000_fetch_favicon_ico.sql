-- Fetch https://<domain>/favicon.ico server-side instead of going through favicon.show
CREATE OR REPLACE FUNCTION "public"."get_domain_favicon"("domain_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare domain_status int8;
declare favicon_url text;

begin
    if exists (select from favicons_excluded_domains as fav where fav.domain = domain_name) then
        return null;
    end if;

    favicon_url = concat(
        'https://',
        (regexp_matches(domain_name, '^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)', 'i'))[1],
        '/favicon.ico'
    );

    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '5000');
    select status from extensions.http_get(favicon_url) into domain_status;

    if domain_status = 200 then
        return favicon_url;
    end if;

    return null;
exception
    when others then
        return null;
end;
$$;
