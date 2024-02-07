drop policy "Enable read access for all users" on "public"."companies";

drop policy "Enable read access for all users" on "public"."contactNotes";

drop policy "Enable read access for all users" on "public"."contacts";

drop policy "Enable read access for all users" on "public"."deals";

drop policy "Enable read access for all users" on "public"."sales";

drop policy "Enable read access for all users" on "public"."tags";

create policy "Enable insert for authenticated users only"
on "public"."companies"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for authenticated users"
on "public"."companies"
as permissive
for select
to authenticated
using (true);


create policy "Enable update for authenticated users only"
on "public"."companies"
as permissive
for update
to authenticated
using (true)
with check (true);


create policy "Enable insert for authenticated users only"
on "public"."contactNotes"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for authenticated users"
on "public"."contactNotes"
as permissive
for select
to authenticated
using (true);


create policy "Enable insert for authenticated users only"
on "public"."contacts"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for authenticated users"
on "public"."contacts"
as permissive
for select
to authenticated
using (true);


create policy "Enable update for authenticated users only"
on "public"."contacts"
as permissive
for update
to authenticated
using (true)
with check (true);


create policy "Enable insert for authenticated users only"
on "public"."dealNotes"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for authenticated users"
on "public"."dealNotes"
as permissive
for select
to authenticated
using (true);


create policy "Enable insert for authenticated users only"
on "public"."deals"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for authenticated users"
on "public"."deals"
as permissive
for select
to authenticated
using (true);


create policy "Enable update for authenticated users only"
on "public"."deals"
as permissive
for update
to authenticated
using (true)
with check (true);


create policy "Enable insert for authenticated users only"
on "public"."sales"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for authenticated users"
on "public"."sales"
as permissive
for select
to authenticated
using (true);


create policy "Enable insert for authenticated users only"
on "public"."tags"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for authenticated users"
on "public"."tags"
as permissive
for select
to authenticated
using (true);


create policy "Enable insert for authenticated users only"
on "public"."tasks"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for authenticated users"
on "public"."tasks"
as permissive
for select
to authenticated
using (true);




