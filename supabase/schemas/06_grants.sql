--
-- Grants
-- This file declares all grants and default privileges for the public schema.
--
-- anon keeps the bare minimum: only init_state, the pre-login initialization
-- probe. Everything else in public is behind RLS that requires an active sales
-- member, so an anon grant would only widen the exposed API surface.
--
-- Known residual: pg_default_acl also holds a supabase_admin entry for schema
-- public that still grants anon. A postgres-owned schema file cannot alter it,
-- so objects created by supabase_admin (not by migrations) escape the defaults
-- below.
--

-- Schema usage
grant usage on schema public to postgres;
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

-- Function grants. Trigger functions are intentionally left out: a trigger
-- fires as the table owner regardless of EXECUTE, so granting one would only
-- expose a pointless /rest/v1/rpc/<name> endpoint. The three below are called
-- directly (merge_contacts over RPC) or from inside a non-definer trigger body,
-- which runs as the invoking role.
revoke all on all functions in schema public from public, anon, authenticated;
grant all on all functions in schema public to service_role;

grant all on function public.get_avatar_for_email(text) to authenticated;
grant all on function public.get_domain_favicon(text) to authenticated;
grant all on function public.merge_contacts(bigint, bigint) to authenticated;

-- Table, view and sequence grants ("all tables" covers views too).
revoke all on all tables in schema public from anon;
grant all on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

revoke all on all sequences in schema public from anon;
grant all on all sequences in schema public to authenticated;
grant all on all sequences in schema public to service_role;

-- Must stay after the blanket revoke above.
grant all on table public.init_state to anon;

-- Default privileges, so a new object is not published to the public API key by
-- accident. Revoking EXECUTE from `public` matters as much as from anon: a new
-- function is created with EXECUTE granted to PUBLIC, which anon inherits.
alter default privileges for role postgres in schema public grant all on sequences to postgres;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public grant all on sequences to authenticated;
alter default privileges for role postgres in schema public grant all on sequences to service_role;

alter default privileges for role postgres in schema public grant all on functions to postgres;
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public grant all on functions to authenticated;
alter default privileges for role postgres in schema public grant all on functions to service_role;

alter default privileges for role postgres in schema public grant all on tables to postgres;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public grant all on tables to authenticated;
alter default privileges for role postgres in schema public grant all on tables to service_role;
