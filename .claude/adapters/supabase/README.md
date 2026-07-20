# Supabase deploy adapter

This adapter provides the harness's optional **deploy phase**: the deploy-time SQL
migration round (STATE PD-* in the orchestrator). It is a pluggable capability
under the optionality model:

- The phase exists **iff** `harness.config.json` has a `deploy` block whose
  `adapter` is `supabase`. Remove that block and a schema-free feature runs end
  to end with no PD state and no migration mention (the orchestrator terminates
  at promotion; `pending-deploys.mjs` short-circuits to "nothing to deploy").
- What the adapter provides is declared in `manifest.json`: the detection script,
  the generate skill, the apply script, the review mode, the write-guard hook, and
  the e2e-smoke script.

## Deploy-relevance

`config.deploy.relevantGlobs` (`supabase/**`) is the single definition of a
deploy-relevant path, shared by `pending-deploys.mjs`, the orchestrator's
SIMPLE-review gate, and the planner's schema wording. A real migration always
requires a change under these globs (that is where the declarative DDL lives, and
`supabase db diff` only fires on it), so the globs are both necessary and
sufficient to decide whether to offer the migration round.

## File locations (Phase B)

The adapter's files still live at their discoverable locations
(`.claude/skills/writing-migrations`, `.claude/scripts/*`, `.claude/hooks/block-migration-writes.mjs`)
because Claude Code discovers skills only under `.claude/skills/`. `manifest.json`
declares the boundary by pointing at them.
