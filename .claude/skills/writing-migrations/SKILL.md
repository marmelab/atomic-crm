---
name: writing-migrations
description: Generate Supabase SQL migrations at deploy time from the session branch diff. Load this when your developer dispatch asks you to generate the deploy-time migration (it points you at the shared <base>/simple worktree). This is NOT a feature ticket — the workflow below replaces the normal ticket rules: here you DO write SQL under supabase/migrations/, and you do not edit TS/TSX/CSS.
---

# Writing Migrations (deploy-time round)

## Overview

A workflow that turns a session's *code* changes into the *minimal* SQL that
makes the real Supabase schema match what the session's app now expects —
nothing more.
You (the `developer`) have been asked to generate the deploy-time migration. The
"never write migrations / no schema" rule of normal ticket work does NOT apply
here: writing SQL under `supabase/migrations/` is the whole job. Do not edit any
TS/TSX/CSS — the schema diff already comes from the session branch; you only
translate it to SQL.
Exit criterion: either a committed, idempotent migration whose delta is provably the net schema change, or an explicit `NO_MIGRATION_NEEDED` when there is no schema impact.

Your worktree is `<WORKTREE_BASE>/simple` on `<SESSION_SHORT_ID>/simple`, forked from `session/<SESSION_SHORT_ID>` (`<WORKTREE_BASE>` =
`/tmp/<$CLAUDE_PROJECT_DIR with every "/" replaced by "_">/<SESSION_ID>`). Every Bash call must `cd <WORKTREE_PATH> && …` (stateless shells).

## When to Use

- The deploy-time migration round, after a session's app changes have merged to `session/<SESSION_SHORT_ID>` and need their schema counterpart.
- Triggered only by the orchestrator dispatching a `developer` that loads this skill, never invoked ad hoc by a feature developer (per-ticket developers never write SQL).

Skip (write nothing, report `NO_MIGRATION_NEEDED`) when the net diff has no
schema impact: CSS, layout, copy, or test-only changes.

## Process

Each step ends in a checkpoint, do not advance until its evidence holds.

### 1. Compute the session's net change

```bash
cd <WORKTREE_PATH>
git diff session-base/<SESSION_SHORT_ID>..session/<SESSION_SHORT_ID>
```

This is the branch's full diff since creation. Do NOT use `git merge-base`
(it collapses after the first promotion). Do NOT diff against main (other
sessions pollute it).

**Checkpoint:** you have the full session diff, produced from the two-dot range above (not merge-base, not main).

### 2. Identify schema-relevant changes

From that diff, keep only changes that imply a database schema change:
- Entity TypeScript types (e.g. `src/**/types.ts`, resource type defs).
- Fake-data generators that add/remove fields.
- dataProvider resource registrations (new resource = new table).
Ignore CSS, component layout, copy, tests.

**Checkpoint:** you have an explicit list of schema-relevant changes (possibly
empty). If empty, jump to step 3's no-op path.

### 3. Compute the delta against what is already deployed

For each changed entity, compare the desired schema (from the TS types) with the
schema already in `supabase/migrations/` and `supabase/schemas/`. Emit ONLY the
incremental delta. Anything already represented in `supabase/migrations/` is
already deployed — do not re-emit it. If the net diff has no schema impact,
write **nothing** (a no-op deploy is valid) and report `NO_MIGRATION_NEEDED`.

**Checkpoint:** every line of SQL you are about to write corresponds to a delta
NOT already present in `supabase/migrations/`.

### 4. Write idempotent SQL

Write to `supabase/migrations/<YYYYMMDDHHMMSS>_<SESSION_SHORT_ID>_migration_<slug>.sql`
(timestamp via `date -u +%Y%m%d%H%M%S`). Use `IF NOT EXISTS` / `IF EXISTS`,
correct column types matching the TS types, FKs, and RLS for new tables (RLS
enabled + policies, never `USING (true)`).

**Checkpoint:** re-running the migration on an already-migrated database is a
no-op (every statement is guarded), and every new table has RLS enabled with at least one non-`USING (true)` policy.

### 5. View-recreation rule (BLOCKING correctness)

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

**Checkpoint:** for every table that gained a column AND feeds a view,
positions 1..N of the recreated view match the old view exactly, the new column is position N+1, and `03_views.sql` mirrors that order.

### 6. Commit and hand off

Commit the SQL on `<SESSION_SHORT_ID>/simple`:

```bash
cd <WORKTREE_PATH> && git add supabase/migrations && git commit -m "migration(<SESSION_SHORT_ID>): <slug>"
```

Then stop and emit the output contract as your very last line — one of:

- `DONE: branch=<SESSION_SHORT_ID>/simple migration=<filename> summary=<what the SQL does>`
- `NO_MIGRATION_NEEDED` — only after computing the diff (step 1) and confirming no schema impact.
- `FAILED: <one-line reason>`

SubagentStop hooks (typecheck/prettier/unit/e2e) run automatically; they should
pass since you only touched SQL. The orchestrator then sends you to
quality-reviewer (`MODE: migration-review`) and the merger.

For Postgres correctness you may load `Skill({skill: "supabase-postgres-best-practices"})`.

**Checkpoint:** the migration is committed on `<SESSION_SHORT_ID>/simple` and the SubagentStop validation chain is green.

## Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll diff against main, it's close enough." | Other sessions pollute main. Only the two-dot `session-base..session` range is the true net change. |
| "This column is probably already deployed, I'll re-emit it to be safe." | Re-emitting a deployed change is drift, not safety. Guard with `IF NOT EXISTS` and emit only the delta. |
| "The view still selects all the right columns, order doesn't matter." | Postgres rejects any ordinal shift (42P16). Order is a hard correctness constraint, not cosmetics. |
| "DROP VIEW CASCADE then CREATE is simpler." | It silently drops dependents and loses REVOKEs. Use `CREATE OR REPLACE` unless you are removing/renaming a column. |
| "No schema change, but I'll write an empty migration anyway." | A no-op deploy is valid. Write nothing and report `NO_MIGRATION_NEEDED`. |

## Red Flags

- Diff computed via `git merge-base` or against `main`.
- A migration statement without an `IF [NOT] EXISTS` guard.
- A new table with no RLS, or an RLS policy using `USING (true)`.
- A view recreated by `DROP … CASCADE` for a mere column *addition*.
- A new column inserted anywhere but the last position of an existing view.
- `03_views.sql` and the migration's view definition disagreeing on column order.
- Re-emitting SQL already present in `supabase/migrations/`.

## Verification

- [ ] Diff taken from `session-base/<SESSION_SHORT_ID>..session/<SESSION_SHORT_ID>`.
- [ ] Every emitted statement is an incremental delta not already in `supabase/migrations/`.
- [ ] All statements are idempotent (`IF [NOT] EXISTS`).
- [ ] New tables have RLS enabled with real policies (never `USING (true)`).
- [ ] Affected views recreated via `CREATE OR REPLACE`, new column last, matching `03_views.sql`.
- [ ] SQL committed on `<SESSION_SHORT_ID>/simple`; SubagentStop validation green — OR `NO_MIGRATION_NEEDED` reported with no file written.
