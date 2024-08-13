create policy "Enable delete for authenticated users only"
on "public"."tags"
as permissive
for delete
to authenticated
using (true);


create policy "Enable update for authenticated users only"
on "public"."tags"
as permissive
for update
to authenticated
using (true);




