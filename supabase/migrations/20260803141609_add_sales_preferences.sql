alter table "public"."sales" add column if not exists "preferences" jsonb;

drop policy if exists "Enable self-update for authenticated users" on "public"."sales";

create policy "Enable self-update for authenticated users"
  on "public"."sales"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));

revoke update on table "public"."sales" from "authenticated";
grant update ("preferences") on table "public"."sales" to "authenticated";

CREATE OR REPLACE FUNCTION "public"."enforce_sales_self_update_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND to_jsonb(NEW) - 'preferences' IS DISTINCT FROM to_jsonb(OLD) - 'preferences' THEN
    RAISE EXCEPTION 'Only the preferences column may be self-updated on public.sales';
  END IF;
  RETURN NEW;
END;$$;

grant all on function public.enforce_sales_self_update_scope() to anon;
grant all on function public.enforce_sales_self_update_scope() to authenticated;
grant all on function public.enforce_sales_self_update_scope() to service_role;

create or replace trigger enforce_sales_self_update_scope_trigger
    before update on public.sales
    for each row execute function public.enforce_sales_self_update_scope();
