--
-- Extensions
-- pg_graphql reflects every table the caller can SELECT into a GraphQL schema,
-- a second API surface this app never queries (it uses PostgREST only). It is
-- what makes linters 0026 / 0027 fire on every table and view; those lints gate
-- solely on the extension being installed. Reinstall with
-- `create extension pg_graphql` to bring GraphQL back.
--
-- `supabase db diff` does not diff extensions, so this file documents the
-- intent but does not enforce it; the drop lives in a hand-written migration.
--

drop extension if exists pg_graphql cascade;
