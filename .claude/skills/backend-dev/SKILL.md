---
name: backend-dev
description: Coding practices for backend development in Atomic CRM. Use when deciding whether backend logic is needed, or when creating/modifying database migrations, views, triggers, RLS policies, edge functions, or custom dataProvider methods that call Supabase APIs.
---

# Backend Development

Reference for backend conventions. There is no custom backend server all
server-side logic uses Supabase: PostgreSQL (tables, views, triggers, RLS),
Auth API, Storage, and Edge Functions. Read the relevant section before writing backend code, then check the Red Flags and Verification list.

## When to Use

- Deciding *whether* a change needs backend logic at all (default: prefer the frontend).
- Creating or modifying database views, triggers, or RLS policies.
- Writing or changing a Supabase edge function, or a custom dataProvider method that calls Supabase.

For the SQL migration mechanics themselves, see `Skill({skill: "writing-migrations"})`.
For the frontend side of a dataProvider method, see `Skill({skill: "frontend-dev"})`.

## Deciding where logic belongs

Prefer frontend-only solutions via custom dataProvider methods calling the PostgREST API.

When backend logic is needed:

- **Aggregation/read optimization**: Create a database view (`CREATE OR REPLACE VIEW` in a new migration). PostgREST exposes views like tables. When underlying table columns change, update the `contacts_summary` and `companies_summary` views too.
- **Complex mutations** (multi-table writes): Create a Supabase edge function in Deno. Stored procedures via RPC are less preferred (code lives in migrations, harder to maintain). On the frontend, expose the edge function as a custom dataProvider method (using `httpClient(`${supabaseUrl}/functions/v1/<name>`)`) and call it via react-query. (e.g. `salesCreate()` → `/functions/v1/users`, `mergeContacts()` → `/functions/v1/merge_contacts`)

## Edge function conventions

- Shared utils in `supabase/functions/_shared/` — reuse `authentication.ts`, `supabaseAdmin.ts`, `cors.ts`, `utils.ts`
- Follow the middleware chain pattern: CORS preflight → `authenticate()` → handler
- `verify_jwt = false` in config.toml, so JWT validation is manual via `authenticate()`

## Other conventions

- New tables need RLS policies and the auto-set `sales_id` trigger (see migration `20260108160722`)

## RLS enforcement pitfalls (security-critical)

- A trigger/function that **counts rows to enforce a limit** (capacity, quota, balance, subscription depletion) must be `SECURITY DEFINER` with a fixed `search_path`, or delegate to one. A `SECURITY INVOKER` count runs under the caller's RLS, sees only the rows that caller may read, under-counts, and the limit silently never fires (e.g. `session_booked_count` is DEFINER for exactly this reason).
- A `WITH CHECK` clause must constrain **every column a non-admin may set**, not just ownership. `with check (contact_id = current_user_contact())` alone lets the caller forge any other column (`status`, `type`, amounts, flags) via PostgREST — privilege escalation / payment bypass. Whitelist allowed values in the policy, a trigger, or a `CHECK` constraint; never trust a client-chosen `status`/`type`.

## Red Flags

- Reaching for an edge function or RPC where a custom dataProvider method against PostgREST would do.
- Adding a column to a table that feeds `contacts_summary`/`companies_summary` without updating the view.
- A new table without RLS policies or the `sales_id` trigger.
- A row-counting limit enforced by a `SECURITY INVOKER` function it under-counts and never fires.
- A `WITH CHECK` that constrains only ownership while leaving `status`/`type`/amounts client-settable.
- An edge function handler that runs before `authenticate()` in the middleware chain.

## Verification

- [ ] The logic genuinely needs the backend no frontend-only path was available.
- [ ] New/changed views keep `contacts_summary` and `companies_summary` in sync.
- [ ] New tables have RLS policies and the `sales_id` trigger.
- [ ] Any limit-enforcing count runs `SECURITY DEFINER` with a fixed `search_path`.
- [ ] Every column a non-admin can set is constrained by policy, trigger, or `CHECK`.
- [ ] Edge functions follow CORS → `authenticate()` → handler.
