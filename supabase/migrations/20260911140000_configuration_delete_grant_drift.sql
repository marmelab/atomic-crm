-- Clean-Room Migration + Disaster-Recovery Proof: the final closure replay's
-- own full grant diff (not the anon-focused comparison the prior fix was
-- scoped to) surfaced a second, different-role instance of the same
-- undocumented-drift class: DELETE on public.configuration for authenticated
-- and service_role.
--
-- Investigated before fixing (not assumed): configuration is a structural
-- singleton (id integer primary key, `constraint configuration_singleton
-- check (id = 1)`), meant to be updated in place, never deleted/recreated.
-- Its own creating migration (20260211194545_app_configuration.sql)
-- explicitly granted only "select, insert, update" to authenticated and
-- service_role -- DELETE was never part of the original intended grant set
-- for either role. There is no DELETE RLS policy for any role, not even
-- admins (05_policies.sql only has SELECT/INSERT/UPDATE for configuration),
-- and no application/Edge Function code anywhere calls delete on this
-- resource. Verified directly against the real linked dev project: main's
-- live grants match the original migration's grant statement exactly
-- (select/insert/update only) -- main's no-DELETE posture is the correct,
-- original, intentional state. 06_grants.sql's later blanket
-- "grant all ... to authenticated/service_role" for this table is the
-- drifted side, with no matching revoke anywhere in migration history --
-- the same "declarative schema widened past the original intent, unrecorded"
-- pattern as 20260902020000 and 20260911120000, just for different roles on
-- this one table. This migration and the matching 06_grants.sql update
-- simply record the original, live, correct reality in version control; no
-- application behavior changes.

revoke delete on table "public"."configuration" from "authenticated";
revoke delete on table "public"."configuration" from "service_role";
