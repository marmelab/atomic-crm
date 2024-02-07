create policy "Enable read access for all users"
on "public"."sales"
as permissive
for select
to authenticated
using (true);




