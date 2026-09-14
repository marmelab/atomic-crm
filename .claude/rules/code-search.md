---
paths: []
---

# Searching code

Applies to: developer, quality-reviewer, planner, test-writer.

## The `LSP` tool is not available to a harness agent

Every harness agent is dispatched by the orchestrator, which is itself a subagent, so they
all run in the background — and a background subagent has `LSP` pruned from its tool set,
whatever its `tools:` frontmatter says. Four open runtime bugs, no fix
(anthropics/claude-code#76090, #80733, #84125, #85310). Measured over a full run: 20 agents,
0 LSP calls, 123 Bash greps.

**So do not spend a turn checking.** `ToolSearch select:LSP` costs a turn and returns
nothing. This rule used to say the opposite — that `grep` was banned and `LSP` mandatory —
and it was wrong for every agent that read it. The main thread, which is not a subagent,
does have the tool and should use it.

## Which tool for which question

| Question | Tool |
| --- | --- |
| What is in this file | `Read`, with `offset` / `limit` for a range — never `sed -n`, `cat`, `head` through Bash (`bash-guard` refuses it, and a Bash call pays a per-call toll orders of magnitude larger) |
| Which files contain this string | the `Grep` tool — never `grep -rn` through Bash |
| Which files exist under this pattern | `Glob` |
| Did I break every caller of what I changed | the typecheck, which the SubagentStop chain runs on your stop |

**The typecheck is the real blast-radius net**, and it is already paid for: it runs on every
developer stop and refuses the stop when a call site is broken. That is the compiler's own
answer, stronger than any list of references, which is why the loss of `LSP` has cost this
project no defect so far.

When a question genuinely needs the type system before the edit rather than after it — "who
calls this, and did I miss one" on a shared signature — say so in your report rather than
guessing from a text search.

## When Bash is the right tool

Pipelines, git, and text sweeps that deliberately include strings, comments and non-code:
deleting every mention of a resource (`grep -rniE "\bdeals?\b|deal_notes?"` across SQL,
fixtures and labels), database identifiers that live in SQL and string literals
(`contacts_summary`, `company_id`), and any file the `Grep` tool covers no better.
