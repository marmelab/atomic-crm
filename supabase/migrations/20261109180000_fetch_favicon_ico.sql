-- Try https://<domain>/favicon.ico first, and only fall back to favicon.show when it is not available
CREATE OR REPLACE FUNCTION "public"."get_domain_favicon"("domain_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare domain_status int8;
declare domain_host text;
declare favicon_url text;

begin
    if exists (select from favicons_excluded_domains as fav where fav.domain = domain_name) then
        return null;
    end if;

    domain_host = (regexp_matches(domain_name, '^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)', 'i'))[1];
    if domain_host is null then
        return null;
    end if;

    -- Try the favicon.ico of the domain first
    favicon_url = concat('https://', domain_host, '/favicon.ico');
    begin
        perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '5000');
        select status from extensions.http_get(favicon_url) into domain_status;

        if domain_status = 200 then
            return favicon_url;
        end if;
    exception
        when others then
            null;
    end;

    -- Fallback to favicon.show
    return concat('https://favicon.show/', domain_host);
end;
$$;
