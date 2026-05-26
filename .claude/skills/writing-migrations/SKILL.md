---
name: writing-migrations
description: Generate Supabase SQL migrations at deploy time from the session branch diff. Used by simple-developer in the deploy-time migration round only.
---

# Writing Migrations (deploy-time round)

You are `simple-developer` in migration mode. Your worktree is
`<WORKTREE_BASE>/simple` on `<SESSION_SHORT_ID>/simple`,
forked from `session/<SESSION_SHORT_ID>` (`<WORKTREE_BASE>` =
`/tmp/<$CLAUDE_PROJECT_DIR with every "/" replaced by "_">/<SESSION_ID>`). Produce SQL migrations that make the
real Supabase schema match what this session's app expects — nothing more.

## 1. Compute the session's net change

```bash
cd <WORKTREE_PATH>
git diff session-base/<SESSION_SHORT_ID>..session/<SESSION_SHORT_ID>
```

This is the branch's full diff since creation. Do NOT use `git merge-base`
(it collapses after the first promotion). Do NOT diff against main (other
sessions pollute it).

## 2. Identify schema-relevant changes

From that diff, keep only changes that imply a database schema change:
- Entity TypeScript types (e.g. `src/**/types.ts`, resource type defs).
- Fake-data generators that add/remove fields.
- dataProvider resource registrations (new resource = new table).
Ignore CSS, component layout, copy, tests.

## 3. Compute the delta against what is already deployed

For each changed entity, compare the desired schema (from the TS types) with the
schema already in `supabase/migrations/` and `supabase/schemas/`. Emit ONLY the
incremental delta. Anything already represented in `supabase/migrations/` is
already deployed — do not re-emit it. If the net diff has no schema impact,
write **nothing** (a no-op deploy is valid) and report `NO_MIGRATION_NEEDED`.

## 4. Write idempotent SQL

Write to `supabase/migrations/<YYYYMMDDHHMMSS>_<SESSION_SHORT_ID>_migration_<slug>.sql`
(timestamp via `date -u +%Y%m%d%H%M%S`). Use `IF NOT EXISTS` / `IF EXISTS`,
correct column types matching the TS types, FKs, and RLS for new tables (RLS
enabled + policies, never `USING (true)`).

## 5. View-recreation rule (BLOCKING correctness)

When a migration adds a column on a table referenced by a view in
`supabase/schemas/03_views.sql`, recreate the view with **`CREATE OR REPLACE
VIEW`** and place the new column as the **very last item** in the SELECT
list — after every existing column AND after every existing computed `AS`
alias (e.g. `count(...) as nb_deals`).

PostgreSQL forbids any ordinal shift in an existing view's SELECT list
(error 42P16). "Between the raw columns and the computed aggregates" is
**still a shift** — the aggregate's position increases by one. There are no
exceptions. The mechanical rule is: positions 1..N of the new view must be
identical to positions 1..N of the old view; the new column is position N+1.

Why not `DROP VIEW … CASCADE; CREATE VIEW …`? It silently drops dependent
views/materialized views/rules, loses any explicit `REVOKE`s on the view
(re-granted by default privileges at the next deploy without warning), and
reads as a destructive operation in audit. Reserve it for cases `CREATE OR
REPLACE` genuinely can't handle (column **removal** or **rename**). If you
use it, enumerate dropped dependents in a SQL comment and re-create them in
the same migration.

PostgREST queries the view, not the table — a missing update makes the
column invisible to the app. The view's column order doesn't matter to API
consumers (they address by name), so "append at end" has no API cost.

Example — adding `importance` to `companies_summary` (the view ends with
`count(...) as nb_deals, count(...) as nb_contacts`):

```sql
create or replace view public.companies_summary with (security_invoker = on) as
select
    c.id, c.created_at, c.name, …, c.logo,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts,
    c.importance                              -- LAST, after every existing item
from public.companies c
    left join public.deals d on c.id = d.company_id
    left join public.contacts co on c.id = co.company_id
group by c.id;
```

Then update `supabase/schemas/03_views.sql` to the **same order** — the
declarative schema must mirror the deployed view, including the chronological
"append at end" placement of newer columns. Don't reorder the schema file to
look prettier — schema drift breaks future `supabase db diff` generations.

## 6. Commit and hand off

Commit the SQL on `<SESSION_SHORT_ID>/simple`. Stop. SubagentStop hooks
(typecheck/prettier/unit/e2e) run automatically. The orchestrator then sends you
to quality-reviewer (migration mode) and the merger.

For Postgres correctness you may load `Skill({skill: "supabase-postgres-best-practices"})`.
