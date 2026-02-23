---
name: backend-dev
description: Coding practices for backend development in Atomic CRM. Use when deciding whether backend logic is needed, or when creating/modifying database migrations, views, triggers, RLS policies, edge functions, or custom dataProvider methods that call Supabase APIs.
---

There is no custom backend server. All server-side logic uses Supabase: PostgreSQL (tables, views, triggers, RLS), Auth API, Storage, and Edge Functions.

Prefer frontend-only solutions via custom dataProvider methods calling the PostgREST API.

When backend logic is needed:

- **Aggregation/read optimization**: Create a database view (`CREATE OR REPLACE VIEW` in a new migration). PostgREST exposes views like tables. When underlying table columns change, update the `contacts_summary` and `companies_summary` views too.
- **Complex mutations** (multi-table writes): Create a Supabase edge function in Deno. Stored procedures via RPC are less preferred (code lives in migrations, harder to maintain). On the frontend, expose the edge function as a custom dataProvider method (using `httpClient(`${supabaseUrl}/functions/v1/<name>`)`) and call it via react-query. (e.g. `salesCreate()` → `/functions/v1/users`, `mergeContacts()` → `/functions/v1/merge_contacts`)

Edge function conventions:
- Shared utils in `supabase/functions/_shared/` — reuse `authentication.ts`, `supabaseAdmin.ts`, `cors.ts`, `utils.ts`
- Follow the middleware chain pattern: CORS preflight → `authenticate()` → handler
- `verify_jwt = false` in config.toml, so JWT validation is manual via `authenticate()`

Other conventions:
- New tables need RLS policies and the auto-set `sales_id` trigger (see migration `20260108160722`)
