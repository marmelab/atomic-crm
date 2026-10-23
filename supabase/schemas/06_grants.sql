--
-- Grants
-- This file declares all grants and default privileges for the public schema.
--
-- anon keeps the bare minimum: only init_state, the pre-login initialization
-- probe. Everything else in public is behind RLS that requires an active sales
-- member, so an anon grant would only widen the exposed API surface.
--
-- Known residual: Supabase's own default privileges still grant anon on new
-- objects in public, so the migration creating one must revoke anon itself.
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

-- No default privileges: every new table, view, sequence or function must
-- declare its grants explicitly in the migration that creates it.
