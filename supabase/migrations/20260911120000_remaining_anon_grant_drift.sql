-- Clean-Room Migration + Disaster-Recovery Proof, Slice 2: a disposable
-- Supabase branch reconstructed purely from this migration history was
-- compared against the real linked dev project, surfacing the same drift
-- class already recorded once in 20260902020000_contacts_deals_tasks_anon_
-- grant_drift.sql -- but for seven MORE tables that fix missed.
--
-- Verified directly against the real linked dev project: SELECT/INSERT/
-- UPDATE/DELETE were already revoked from anon on all seven tables below
-- live (only REFERENCES/TRIGGER/TRUNCATE remain, the same deliberate prior
-- hardening applied outside the migration flow), while 06_grants.sql still
-- declared unconditional "grant all ... to anon" for each with no matching
-- revoke anywhere in migration history. RLS is enabled on all seven and
-- none carries an anon policy, so no anon session can read or write a
-- single row regardless of the table-level grant below it -- exactly the
-- same rationale as the precedent migration. This migration and the
-- matching 06_grants.sql update simply record the live, safer reality in
-- version control; no application behavior changes.

revoke select, insert, update, delete on table "public"."companies" from "anon";
revoke select, insert, update, delete on table "public"."configuration" from "anon";
revoke select, insert, update, delete on table "public"."contact_notes" from "anon";
revoke select, insert, update, delete on table "public"."deal_notes" from "anon";
revoke select, insert, update, delete on table "public"."favicons_excluded_domains" from "anon";
revoke select, insert, update, delete on table "public"."sales" from "anon";
revoke select, insert, update, delete on table "public"."tags" from "anon";
