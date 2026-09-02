-- Live Acuity Connection slice: a real, second bug this session's migration
-- smoke test caught. The Waitlists slice (20260901120000_waitlist_entries.sql)
-- created "public"."waitlist_entries" with RLS policies for `authenticated`
-- but never granted table/sequence privileges to any role at all — RLS
-- policies alone are not sufficient in Postgres; a table-level GRANT is
-- required too, or every role (including service_role, which normally
-- bypasses RLS but still needs its own object grant) gets
-- "permission denied for table waitlist_entries" on every access. This
-- means the entire Waitlist feature was never actually reachable in
-- production, only in FakeRest dev/demo, since nobody had a real Postgres
-- to catch this until now. Mirrors every other table's own grant block in
-- supabase/schemas/06_grants.sql exactly (also fixed there, for parity).

grant all on table "public"."waitlist_entries" to anon;
grant all on table "public"."waitlist_entries" to authenticated;
grant all on table "public"."waitlist_entries" to service_role;

grant all on sequence "public"."waitlist_entries_id_seq" to anon;
grant all on sequence "public"."waitlist_entries_id_seq" to authenticated;
grant all on sequence "public"."waitlist_entries_id_seq" to service_role;
