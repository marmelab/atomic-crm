# Pattern Ledger

Index of captured patterns (rules, skills, hooks, agents, escalations). See
`/home/developer/.claude/local/{rules,skills,hooks,agents}/` for artifacts.

## P-001 — Feature-smoke e2e runs before the deploy-time migration exists

- **Status** : resolved (2026-07-17, TB.3 of adr/harness-action-plan.md)
- **Resolution** : `e2e-smoke.sh` now materializes the session schema before running
  the suite. When the session changed `supabase/schemas/`, it generates a THROWAWAY
  migration from the schema delta into the isolated workdir (`npx supabase db diff`)
  and applies it, so the isolated Postgres has the session's columns. The throwaway
  never leaves the workdir (no file under `supabase/migrations/`). If diff or apply
  fails, the Supabase e2e leg is SKIPPED ("schema pending migration round"), never a
  false FAIL. Detection of "deploy-relevant paths" is unified in
  `config.deploy.relevantGlobs` (TB.2).
- **Type** : escalation
- **Created** : 2026-07-17 (session 2e030b92, TASK-001)
- **Last updated** : 2026-07-17 (session 2e030b92, TASK-001)
- **Symptom** : `.claude/scripts/e2e-smoke.sh` fails specs that persist newly-added
  schema columns through the real Supabase/PostgREST API. In session 2e030b92,
  `e2e/TASK-001-company-twitter-fax-fields.spec.ts` failed 2/8 tests (new fields not
  persisting/rendering, plus a secondary Mobile Chrome nav timeout), even though the
  ticket's own scope was correct (schema files only, no SQL migration, per the harness
  rule that ticket developers never write migrations).
- **Trigger** : any COMPLEX ticket that adds/renames columns in `supabase/schemas/*.sql`
  and ships an e2e spec exercising those columns, run through STATE B's Feature-smoke
  step (before promotion, before the deploy-time migration round exists).
- **Why no additive lever** : `e2e-smoke.sh` provisions its isolated stack by copying
  `supabase/migrations/` (line 80-82) into a throwaway workdir and running
  `npx supabase start` (line 102); the Supabase CLI builds the actual Postgres schema
  from `migrations/*.sql` only, it never applies `supabase/schemas/*.sql` directly
  (`schemas/` is source-of-truth used by `supabase db diff` to GENERATE a migration,
  not something the CLI reads to build a DB). The harness deliberately defers migration
  generation to PD-MIG-DEV, after promotion, so that many parallel tickets don't produce
  conflicting migrations. Any schema-touching ticket therefore hits a real gap: its e2e
  spec exercises columns the isolated stack's Postgres does not have yet, and the
  insert/read 400s against PostgREST (unknown column) - a correct failure, not a feature
  bug. Fixing the sequencing requires either (a) teaching `e2e-smoke.sh` to run
  `supabase db diff` and apply a throwaway migration before starting the stack, or (b)
  teaching the orchestrator to skip/defer the Supabase e2e leg for schema-touching diffs
  until after PD-MIG-MERGE. Both are changes to a base harness script
  (`.claude/scripts/e2e-smoke.sh`) or an orchestrator state rule
  (`.claude/agents/orchestrator.md`), out of scope for a documentator/developer/orchestrator
  to self-apply; a maintainer must decide and implement. Will reproduce on every future
  schema-touching COMPLEX ticket until fixed, silently wasting an e2e round each time.
- **Evidence** : session 2e030b92, TASK-001 - `e2e-smoke.sh` exit=1 log shows
  `getByText('@acmecorp')` not found and a Mobile Chrome `goToCompanies` timeout;
  confirmed `supabase/migrations/` contains no file touching `twitter_handle`/
  `fax_number` while `supabase/schemas/01_tables.sql` and `03_views.sql` do.
