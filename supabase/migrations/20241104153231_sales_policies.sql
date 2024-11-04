create schema if not exists "private";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  return exists (
    select 1 from public.sales
    where (select auth.uid()) = user_id and administrator = TRUE
  );
end;
$function$
;


drop policy "Enable insert for authenticated users only" on "public"."sales";

drop policy "Enable update for authenticated users only" on "public"."sales";

create policy "Enable delete for administrators only"
on "public"."sales"
as permissive
for delete
to authenticated
using (private.is_admin());


create policy "Enable insert for adminstrators only"
on "public"."sales"
as permissive
for insert
to authenticated
with check (private.is_admin());


create policy "Enable update for authenticated users only"
on "public"."sales"
as permissive
for update
to authenticated
-- Users can only update their own records, unless they are administrators
-- This is the *Can I see the current record?* check
using (((( SELECT auth.uid() AS uid) = user_id) OR private.is_admin()))
-- Users can only update their own records and only if they don't change their administrator column, unless they are administrators
-- This is the *Can I set those new values?* check
with check ((((( SELECT auth.uid() AS uid) = user_id) AND (administrator = false)) OR private.is_admin()));
