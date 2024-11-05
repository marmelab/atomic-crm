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
