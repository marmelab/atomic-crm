# project_plan.md — order of work, gates and the build loop

**Status:** PRIMARY (ORDER). Binds once ratified at Gate A.
**Role:** Phase graph, slices, gates, and exactly how Claude Code runs each slice. WHAT = `PRD.md`. HOW = `ARCHITECTURE.md`. DONE = `features.json`.

---

## 1. Source-of-truth hierarchy

1. **LAW:** `decisions.md` (accepted ADRs) + gate outcomes recorded in `progress.md`.
2. **PRIMARY:** `PRD.md` (what), `ARCHITECTURE.md` (how), this file (order), `features.json` (done).
3. **INVARIANT:** PRD §12 privacy/security rules and ARCHITECTURE §4 RLS rules. They bind regardless of later decisions.
4. **CONVENTIONS:** upstream `AGENTS.md`, `.claude/rules/*`, `.claude/skills/*`. They win on mechanics (how to write a migration, a component, a test).
5. **REFERENCE:** chat history, research notes, upstream docs. Idea mine only; nothing there binds unless an ADR adopts it.

## 2. Phase graph (a graph of loops)

Each box is one loop (plan → test → build → verify → review → close). Arrows are dependencies. Gates are human checkpoints.

```
P0 Harness (this pack; no product code)
   │
   ▼
[Gate A] scope + ADRs ratified, open questions Q1/Q6 answered
   │
   ▼
S1 Walking skeleton ──► S2 Students·Courses·Batches·Import ──► S3 Trials + teacher feedback
   (roles, RLS, admissions,                                        │
    lead capture, Today v1,                                        ▼
    staging deploy)                                    [Gate R1] 1-week pilot, manual WhatsApp
                                                                   │
                                     ┌─────────────────────────────┤
                                     ▼                             ▼
                          S4 WhatsApp outbox (sandbox)    S5 Razorpay links + webhook (test mode)
                                     └──────────────┬──────────────┘
                                                    ▼
                                         S6 Payment → enrolment handover
                                                    │
                                                    ▼
                                [Gate B] cold read + go-live R2 (live number, live Razorpay)
                                                    │
                 ┌───────────────┬──────────────────┼──────────────────┐
                 ▼               ▼                  ▼                  ▼
            S7 Fee cycle   S8 Attendance      S9 Progress notes   S10 Owner dashboard
                 └───────────────┴──────────────────┴──────────────────┘
                                                    ▼
                                   [Gate C] one full fee cycle in the CRM (R3)
                                                    ▼
                                   P7 Routines (weekly audits, metrics snapshot)
```

Parallelism: S4 ∥ S5, and S7 ∥ S8 ∥ S9 ∥ S10, each in its own git worktree. Solo developer → at most 2 parallel worktrees (`risks.md` R-5). Parallel loops never share mutable context; their contract is the schema in `supabase/schemas/` frozen at the start of the wave.

## 3. Slices

| Slice | Delivers | Features (`features.json`) | Exit gate |
|---|---|---|---|
| S0 | Baseline numbers (outside repo), env running locally | F-000..F-002 | Gate A |
| S1 | Roles + RLS, admissions config, parent fields, lead capture (manual + form), Today v1, staging deploy | F-100..F-112 | Demo to Owner |
| S2 | Students, courses, batches, imports, family export/delete | F-200..F-208 | — |
| S3 | Trials, teacher screens, trial feedback, no-show | F-300..F-306 | Gate R1 |
| S4 | Outbox, guards, quiet hours, WhatsApp send + webhook, opt-out, automation settings | F-400..F-411 | — |
| S5 | Payment links, Razorpay webhook, idempotency | F-500..F-505 | — |
| S6 | `handle_payment`, enrolment, welcome + teacher notice, AR7/AR8 follow-ups, Today payment section | F-600..F-605 | Gate B |
| S7 | Invoices per period, fee reminders, overdue | F-700..F-704 | — |
| S8 | Attendance, absence rule | F-800..F-803 | — |
| S9 | Progress notes | F-900..F-902 | — |
| S10 | Dashboard M1–M8 | F-1000..F-1003 | Gate C |

## 4. Gates

| Gate | Inputs | Pass criteria |
|---|---|---|
| A | PRD, ARCHITECTURE, decisions, risks, features | `gate-reviewer` cold read ≥ 80 overall, no blocking findings; Owner (human) says go; Q1 and Q6 answered |
| R1 | Staging app with real imported data | Counsellor ran every new enquiry in the CRM for 5 working days; zero admissions without next action (M2 = 0) |
| B | Full R2 build on staging | Cold read ≥ 80; security review on RLS, webhooks, payments has no open finding (**safety cap: overall ≤ 60 while any security finding is open**); sandbox end-to-end run recorded |
| C | R3 build | One complete fee cycle processed; Owner confirms dashboard numbers against bank/Razorpay totals |

Gate outcomes are written to `progress.md`. Decisions made at a gate are written to `decisions.md`.

## 5. How Claude Code runs one slice (the loop)

This is the recipe for every slice. It follows the Claude Code team's published practice (explore → plan → code → verify → commit; plan mode first; a way to verify; fresh-context review; encode fixes into CLAUDE.md) and the long-running-agent pattern (feature list in JSON + progress file + git history as handoff).

1. **Start** — run `/aparna-loop` (START). It checks the working directory, reads `progress.md`, `features.json`, `git log -10`, runs the baseline checks, and names the next slice.
2. **Plan** — plan mode (Shift+Tab twice). Scope = only the slice's features. The plan lists files to touch, tests first (each test maps to a feature `acceptance` line), and the `verify` commands. Before approving, get a fresh-context review of the plan: dispatch the `gate-reviewer` agent in `plan` mode, or paste the plan into a second session.
3. **Build** — approve the plan, then set a goal with a deterministic finish line:

   ```
   /goal Every feature with "slice": "S<n>" in docs/aparna/features.json has "passes": true, and you have pasted in this conversation the green output of each feature's verify command plus `make typecheck`, `make lint`, `make test` (and `npx supabase test db` if the slice touched SQL). Or stop after 40 turns and report what is blocking.
   ```

   The evaluator only reads the transcript, so the condition demands pasted command output, never "looks done".
4. **Review** — fresh context only. Use the upstream `quality-reviewer` through the harness, or `/code-review` if installed. Slices touching auth, RLS, webhooks or payments also need a security review (`.claude/rules/security-triggers.md`).
5. **Close** — run `/aparna-loop` (CLOSE): flip `passes` only for features with evidence, append to `progress.md`, add decisions/problems/changelog entries, encode any repeated correction into `docs/aparna/CLAUDE-aparna.md` (Gotchas) or a rule/hook, then commit on the slice branch.
6. **Human** — reviews the PR and merges. Claude never pushes to `main`.

Alternative for big slices: route through the upstream agent team with `#technical-harness gate=plan` (planner → developers in worktrees → quality-reviewer → merger). Same features, same exit.

Model routing: planning and reviews on the strongest model; implementation on the default model; mechanical edits on the fast model.

## 6. Routines (after Gate C, optional)

1. Weekly `/schedule`: instruction-stack self-audit (CLAUDE.md, rules, skills, hooks, docs) by `gate-reviewer` in `audit` mode; findings go to `problems.md`.
2. Weekly `/schedule`: metrics snapshot M1–M8 into `progress.md` from the dashboard views.

## Provenance & audit

Sources: loop-engineering governance (phase graph, gates, laws), Anthropic "Effective harnesses for long-running agents" (feature list JSON, progress file), Claude Code docs on `/goal` and best practices, upstream harness (`CLAUDE.md`, `harness.config.json`).
Checked: every slice maps to features in `features.json` by `slice` field; every gate has observable pass criteria; dependency arrows match ARCHITECTURE (S6 needs S4 + S5 functions; S7 needs S5 links).
