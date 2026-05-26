---
name: adr-writing
description: Architecture Decision Record format and rules for the developer agent. Load when the implementation introduces a structural decision worth remembering 6 months later — new pattern, new dependency, deliberate departure from convention, non-obvious schema choice. Skip for naming and file-layout micro-choices. No ADR is the default.
---

# ADR — Architecture Decision Record

Load only when you have a structural decision to record. Default behaviour for any developer is **no ADR**.

## When to write one

Yes:
- New pattern introduced into the codebase (not just used once — recurring).
- New runtime dependency (npm package, new Supabase extension, external service).
- Deliberate departure from an existing convention.
- Non-obvious schema choice (denormalisation, computed column, soft-delete strategy).

No:
- File naming, folder placement.
- A bug fix or refactor with no structural impact.
- Style decisions already captured by lint/prettier.

## File naming — namespaced by ticket

Path: `<WORKTREE_PATH>/adr/ADR-<TASK-XXX>-<slug>.md`

- `<TASK-XXX>` is the literal ticket id (e.g. `ADR-TASK-007-supabase-rls-strategy.md`). It IS the namespace — there is no separate sequence number.
- `<slug>` is kebab-case, ASCII, ≤ 40 chars.
- One ADR per ticket is the common case. If the same ticket genuinely needs two ADRs, the distinct slugs keep them apart.

**Why the ticket-id namespace**: in a COMPLEX wave, N developers run in parallel on worktrees branched from the same master. A monotonically-incremented `ADR-NNN-…` scheme makes every worker independently pick the same next number (e.g. all land on `ADR-003`); different slugs hide the collision from `git merge`, so duplicate numbers land in `/app/adr/` silently. Using `<TASK-XXX>` as the namespace makes that collision structurally impossible.

## Source-code reference

One comment at the most representative line of the change, pointing at the ADR you just wrote:

- TS/JS/CSS: `// See adr/ADR-<TASK-XXX>-<slug>.md`
- Python/SQL/shell: `# See adr/ADR-<TASK-XXX>-<slug>.md`

No need for more than one reference; reviewers follow the link.

## Commit

The ADR + its reference comment go in the same commit as the code they describe (WORKFLOW step 3). Subject:

```
docs(TASK-XXX): ADR-<TASK-XXX> <title>
```

Reviewers see the ADR alongside the implementation.

## Template (≤ 25 lines)

```markdown
# ADR-<TASK-XXX> — <decision title>

- **Date**: YYYY-MM-DD
- **Ticket**: TASK-XXX
- **Session**: <SESSION_SHORT_ID>

## Context

2–4 lines on what made this decision necessary.

## Decision

1–3 lines on what was chosen.

## Consequences

- Up to 4 bullets: what this enables, costs, locks in.

## Alternatives considered

- Up to 3, one line each, with reason for rejection. If none were captured, write `- _Not captured at decision time._` — never invent.
```

Keep it short. An ADR longer than 25 lines is a sign that the decision either belongs in code comments or is actually several decisions that should be split.
