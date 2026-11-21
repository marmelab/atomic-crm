# progress.md — session handoff log

**Status:** LAW for gate outcomes. Otherwise a log.
**Role:** What each session did, the evidence, and what comes next. A fresh session reads the latest entry first. Newest at the bottom. One entry per session, max ~15 lines; quote real command output for any feature marked as passing.

## Baseline metrics (fill in S0)

| Metric | Baseline | Source | Date |
|---|---|---|---|
| M1 time to first response | unknown | | |
| M2 leads without next action | unknown | | |
| M3 enquiry → trial in 72 h | unknown | | |
| M4 trial show rate | unknown | | |
| M5 trial → enrolled | unknown | | |
| M6 days enquiry → paid | 7–10 (founder estimate) | discovery call | 2026-11-20 |
| M7 fees paid on time | unknown | | |
| M8 monthly churn | unknown | | |

## S0 checklist (outside the repo)

- [ ] Website shows the real phone and a WhatsApp button (P-01)
- [ ] One official business WhatsApp number with labels and quick replies
- [ ] Founder answers Q1, Q6 (and Q2–Q7 when possible)
- [ ] Simple sheet counting enquiries, trials, joins and leavers for 2 weeks

## Sessions

### 2026-11-21 — P0 planning pack (chat session, no product code)
- Did: researched business and team practice; inspected the upstream repo and harness; wrote PRD, ARCHITECTURE, project_plan, features.json (all `passes: false`), decisions ADR-A01..A10 (Proposed), problems P-01..P-09, risks R-1..R-12; added Claude layer (import line, Karpathy rule, aparna-loop skill, gate-reviewer agent).
- Evidence: features.json parses; 72 features, IDs unique, all `passes: false`; slice ranges in `project_plan.md` §3 match the `slice` fields; every PRD flow F1–F9 and rule AR1–AR13 maps to at least one feature (gaps found and added: F-208 family export/delete, F-411 automation settings, F-605 Today payment section; consent capture added to F-108); root `CLAUDE.md` diff is one import line; Prettier applied with repo config.
- Not done here: Gate A cold read (needs a fresh context; first step of `KICKOFF.md` Prompt 1).
- Next: run `KICKOFF.md` Prompt 1 in Claude Code (environment check + Gate A cold read). Stop at Gate A.

### 2026-11-21 — MVP track added (chat session, no product code)
- Decided: MVP first ("never lose a lead", ~1 week), full build after a pilot (ADR-A11..A16, Proposed).
- Added: `MVP.md` (scope, data, screens, slices M0–M5, file ownership), `TRANSITION.md` (T1–T12 shortcut ledger, re-verify list, how to pick the first full-build slice), 24 M- features in `features.json`, risks R-13..R-15, problems P-10 (cloud has no Docker) and P-11 (demo entry ignores `src/App.tsx`).
- Found in repo: sign-up is invitation-only after the first user (`handle_new_user`); `block-migration-writes` only blocks harness developers; upstream `check.yml` runs e2e with Supabase and `deploy.yml` pushes migrations on main → CI is the Docker-capable verifier (ADR-A15).
- Rewrote `KICKOFF.md` for Claude Code online: setup (GitHub, Supabase, Vercel, cloud environment), session flow, COMMON + per-slice prompts.
- Next: you do KICKOFF Part A, then run M0 in a cloud session.

### 2026-11-21 — Correction: cloud sessions have Docker (P-10)
- Checked the official Claude Code cloud docs: cloud sessions include docker, dockerd and docker compose, 4 vCPUs, 16 GB RAM; Trusted network covers Docker Hub, ghcr.io and public.ecr.aws. My earlier "no Docker" finding came from the planning chat sandbox, a different machine.
- Changed: ADR-A15 (cloud runs the full local stack; CI is the second verifier; hand-written migrations only as fallback), CLAUDE-aparna.md commands + Mistakes Log, MVP.md §8, TRANSITION T11, R-15, aparna-loop START/CLOSE, M-001 and M-103 acceptance, KICKOFF Part A4 (exact environment dialog steps), Part B (mode dropdown, Auto-fix), Part E (fallback).
- Next: merge the plan PR, create the `aparna-crm` environment, run M0.

### 2026-11-21 — Field visits requested by the Owner
- Added PRD §15, ADR-A17 (Proposed), risk R-16, slice SF with F-1100..F-1105. Check-ins with consent, Owner-only access, 90-day coordinate retention, production owned by the client. Ships after role RLS (F-101); not in the MVP.
- Install on phones: already supported (web app manifest + home-screen icons in `public/`); branding of icons happens in M1.
