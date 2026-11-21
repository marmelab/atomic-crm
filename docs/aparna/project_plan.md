# project_plan.md — order of work, gates and the build loop

**Status:** PRIMARY (ORDER). Binds once ratified at Gate MVP-A.
**Role:** Phase graph (MVP track, then full build), slices, gates, and exactly how Claude Code runs each slice in the cloud. WHAT = `MVP.md` (now) and `PRD.md` (later). HOW = `ARCHITECTURE.md`. DONE = `features.json`. MVP → full = `TRANSITION.md`.

---

## 1. Source-of-truth hierarchy

1. **LAW:** `decisions.md` (accepted ADRs) + gate outcomes recorded in `progress.md`.
2. **PRIMARY:** `MVP.md` (during the MVP track), `PRD.md`, `ARCHITECTURE.md`, `TRANSITION.md`, this file, `features.json`.
3. **INVARIANT:** PRD §12 privacy/security rules, ARCHITECTURE §4 RLS rules, ADR-A14 (no Teacher accounts before F-101).
4. **CONVENTIONS:** upstream `AGENTS.md`, `.claude/rules/*`, `.claude/skills/*` — they win on mechanics.
5. **REFERENCE:** chat history, research notes, upstream docs — idea mine only.

## 2. Phase graph (a graph of loops)

Each box is one loop = one cloud session = one branch = one PR. Arrows are dependencies (the source must be merged into `main`). Gates are human checkpoints.

```
MVP TRACK (~1 week + pilot week)

M0 Check ─► [Gate MVP-A] ─► M1 Foundation (schema frozen at merge)
                                   │
                      ┌────────────┴────────────┐
                      ▼                         ▼
              M2 Capture & discipline    M3 Today + one-tap WhatsApp     ← 2 sessions in parallel
                      │                         │
                      ▼                         │
              M4 Import                         │
                      └────────────┬────────────┘
                                   ▼
                      M5 Pilot week + fixes ─► [Gate MVP exit] ─► TRANSITION.md §3 picks the order

FULL BUILD (order chosen by pilot numbers; default shown)

T5+T1 Roles/RLS + students (S1, S2) ─► S3 Trials + teacher screens ─► [Gate R1]
        ─► S4 WhatsApp outbox ∥ S5 Razorpay ─► S6 Handover ─► [Gate B]
        ─► S7 Fees ∥ S8 Attendance ∥ S9 Progress ∥ S10 Dashboard (max 2 at a time) ─► [Gate C] ─► P7 Routines
```

Parallelism rules (ADR-A16): only after the slice that freezes the schema is merged; each parallel slice owns a file list; max 2 at a time (R-5); parallel loops never share mutable context.

## 3. Slices

| Slice | Delivers | Features | Gate after |
|---|---|---|---|
| M0 | Cloud environment works; assumptions checked; MVP pack cold-read | M-001 | Gate MVP-A |
| M1 | Config, labels, MVP schema + constraints, pgTAP in CI, demo data, deploy | M-101..M-107 | — |
| M2 | Phone helper, quick-add, next-action and lost-reason discipline, board card | M-201..M-205 | — |
| M3 | Today, time helper, WhatsApp templates, one-tap send + log, mark fee paid, this-week strip | M-301..M-306 | — |
| M4 | Import current students and open enquiries | M-401..M-402 | — |
| M5 | Counsellor guide, pilot week, fixes | M-501..M-503 | Gate MVP exit |
| S0 | (Full build) baseline + Gate A | F-000..F-002 | Gate A |
| S1 | Roles + RLS, admissions config, lead capture, Today v1, staging | F-100..F-112 | — |
| S2 | Students, courses, batches, imports, family export/delete | F-200..F-208 | — |
| S3 | Trials, teacher screens, feedback, no-show | F-300..F-306 | Gate R1 |
| S4 | Outbox, guards, quiet hours, WhatsApp API, opt-out, automation settings | F-400..F-411 | — |
| S5 | Payment links, Razorpay webhook | F-500..F-505 | — |
| S6 | `handle_payment`, enrolment, follow-ups, Today payment section | F-600..F-605 | Gate B |
| S7–S10 | Fees, attendance, progress notes, dashboard | F-700..F-1003 | Gate C |

## 4. Gates

| Gate | Pass criteria |
|---|---|
| MVP-A | M0 checks green; `gate-reviewer` (MODE gate) on `MVP.md`, `TRANSITION.md`, ADR-A11..A16 and the M-features ≥ 80 with no blocking finding; Owner says "Gate MVP-A: go" |
| MVP exit | `MVP.md` §9 |
| A (full) | `gate-reviewer` cold read of the full pack ≥ 80; `TRANSITION.md` §2 features re-verified; Owner go |
| R1 | Counsellor + teachers use S1–S3 for 5 working days; M2 = 0 daily |
| B | Cold read ≥ 80; security review on RLS, webhooks, payments with no open finding (**safety cap: overall ≤ 60 while any security finding is open**); sandbox end-to-end run recorded |
| C | One full fee cycle processed; Owner reconciles dashboard with Razorpay totals |

## 5. How Claude Code runs one slice in the cloud (the loop)

Follows the Claude Code team's practice (explore → plan → code → verify → commit; plan first; a way to verify; fresh-context review; encode fixes into CLAUDE.md) and the long-running-agent pattern (JSON feature list + progress file + git history as handoff).

1. **Start** — new cloud session on `main`. Prompt from `KICKOFF.md`. Claude runs `/aparna-loop` START.
2. **Plan** — plan only, no edits: files (owned list only), tests first (each maps to an `acceptance` line), verify per feature, risks. For M1, S1, S4, S5, S6 the plan is cold-read by the `gate-reviewer` subagent (MODE plan) before it is shown. Human replies "go".
3. **Build** — stop condition handed off. If `/goal` is available:

   ```
   /goal Every feature of slice <id> in docs/aparna/features.json has its cmd: verify green with output pasted here, the PR is open, and the GitHub Actions Check run on it is green (pasted). Or stop after 40 turns and report the blocker.
   ```

   If `/goal` is not available, the same sentence is the explicit stop condition in the prompt.

4. **Review** — fresh context only: `gate-reviewer` or upstream `quality-reviewer` subagent on the diff, or `@claude review` on the PR if the Claude GitHub app is installed (`.github/workflows/claude.yml`). Slices touching auth, RLS, payments or webhooks also get a security review (`.claude/rules/security-triggers.md`).
5. **Close** — `/aparna-loop` CLOSE: CI green, `passes` flipped with evidence, `progress.md`, ADRs, problems with "encoded as", changelog, PR updated.
6. **Human** — opens the Vercel Preview on the phone, checks the one thing named in the PR, merges.

Big full-build slices may instead run the upstream agent team inside one session: `#technical-harness GATE: plan` (planner → developers in worktrees → quality-reviewer → merger). Same features, same exit.

Model routing: planning, gate and security reviews on the strongest model; implementation on the default model; mechanical edits on the fast model.

## 6. Routines (after Gate C, optional)

1. Weekly scheduled task: `gate-reviewer` MODE audit of the instruction stack; findings → `problems.md`.
2. Weekly scheduled task: metrics snapshot into `progress.md`.

## Provenance & audit

Sources: loop-engineering governance (phase graph, gates, laws), Anthropic "Effective harnesses for long-running agents", Claude Code docs (`/goal`, best practices), upstream harness and workflows (`check.yml`, `deploy.yml`, `claude.yml`), ADR-A11..A16.
Checked: every slice maps to features by `slice` field; MVP dependency arrows match `MVP.md` §7 file ownership (M4 needs M2's phone helper); full-build order matches `TRANSITION.md` §3 default.
