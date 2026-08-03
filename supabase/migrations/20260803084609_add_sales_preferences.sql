alter table "public"."sales" add column "preferences" jsonb;

create policy "Enable self-update for authenticated users"
  on "public"."sales"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));

revoke update on table "public"."sales" from "authenticated";
grant update ("preferences") on table "public"."sales" to "authenticated";
