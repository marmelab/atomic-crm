# decisions.md — decision register (ADRs)

**Status:** LAW once an entry is `Accepted`. `Proposed` entries bind nothing until Gate A (or a later gate) accepts them.
**Role:** Every consequential choice: context, options, decision, consequences, and the observable trigger that would reopen it. Nothing locks silently.

Format: newest at the bottom. Short form of the loop-engineering ADR template. Upstream harness ADRs written by agents during tickets live in `adr/` — link them here when they change something in this register.

---

### ADR-A01 — Build on the Atomic CRM fork (Vite SPA), not a Next.js rewrite
Status: Proposed · Date: 2026-11-21
- Context: The founder needs a CRM fast. Our usual stack is Next.js, but this fork already ships auth, users, contacts, Kanban, tasks, notes, CSV import, tests and an agent harness on React + Vite + Supabase.
- Options: A) extend the fork — most features exist, one new dependency. B) new Next.js app — familiar stack, rebuild ~15k LOC. C) SaaS CRM (telecrm, LeadSquared) — fastest, weak fit for batches, attendance and teacher screens, monthly per-user cost.
- Decision: A.
- Consequences: we follow upstream conventions (declarative schema, ra-core resources, FakeRest emulation). Public pages stay outside the SPA (website form posts to an edge function).
- Reversal condition: we need server-rendered parent-facing pages (SEO or self-booking) that cannot be a small separate site, or upstream conventions cost more than 30% of a slice's time two slices in a row.

### ADR-A02 — Adopt the upstream agent harness as-is; add only a thin domain layer
Status: Proposed · Date: 2026-11-21
- Context: The repo ships a mature harness (orchestrator, planner, developer, quality-reviewer, merger, documentator, validation hooks, ponytail YAGNI skills, ADR skill). Writing our own would duplicate it.
- Options: A) adopt, opt-in with `#harness` / `#technical-harness`. B) strip it and use plain Claude Code. C) replace with a custom harness.
- Decision: A. Our layer = `docs/aparna/*`, one import line in `CLAUDE.md`, `.claude/rules/karpathy.md`, `.claude/skills/aparna-loop`, `.claude/agents/gate-reviewer.md`.
- Consequences: upstream rules (git policy, worktree scope, validation-commands) apply to harness agents. Main-thread work uses the loop in `project_plan.md` §5.
- Reversal condition: harness hooks block our slice work twice for reasons unrelated to quality, or upstream changes break our layer on merge.

### ADR-A03 — Domain mapping onto upstream tables
Status: Proposed · Date: 2026-11-21
- Context: Upstream models B2B sales (companies, contacts, deals). We model families, students and admissions.
- Options: A) reuse `contacts` as parents and `deals` as admissions, rename only in the UI (i18n), add `students`; hide companies. B) rename tables. C) new tables, leave upstream unused.
- Decision: A. `deals.lost_reason` is re-added on purpose (upstream dropped it). Companies are hidden from the menu, not deleted, in v1.
- Consequences: code and DB say `deals`/`contacts`; the UI says Admission/Parent. This is a known gotcha (recorded in `CLAUDE-aparna.md`).
- Reversal condition: the naming mismatch causes a production bug, or hidden companies code blocks a slice — then delete companies with the upstream `delete-initial-resource` skill.

### ADR-A04 — Deterministic automations through an outbox with send-time guards
Status: Proposed · Date: 2026-11-21
- Context: Reminders must never go out after the state changed (e.g. fee reminder after payment). Runtime LLM decisions are not needed.
- Options: A) `messages` outbox + `message_guard()` re-check + pg_cron dispatcher. B) send directly from triggers. C) external workflow tool (n8n, Zapier).
- Decision: A.
- Consequences: one place to see every message and its status; idempotency through `dedupe_key`; slightly more SQL.
- Reversal condition: dispatcher latency over 2 minutes at p95, or volume over 50,000 messages per month.

### ADR-A05 — WhatsApp Cloud API with Coexistence, called with fetch
Status: Proposed · Date: 2026-11-21
- Context: Parents are global and live on WhatsApp. Human chats must continue in the WhatsApp Business app.
- Options: A) Cloud API + Coexistence on the existing number. B) BSP platform (AiSensy, Interakt, WATI) with its own inbox and fees. C) New dedicated API-only number.
- Decision: A, pending spike F-400 on the onboarding path.
- Consequences: companion devices may be unlinked on connect (R-8); templates need Meta approval; per-message pricing.
- Reversal condition: F-400 shows direct onboarding is not possible for this account → choose B for onboarding only, still sending through our outbox if the BSP exposes an API.

### ADR-A06 — Razorpay Payment Links + webhook
Status: Proposed · Date: 2026-11-21
- Context: Razorpay is already set up. We need a link per invoice and automatic status.
- Options: A) Payment Links + `payment_link.paid` webhook. B) Subscriptions API. C) Manual reconciliation.
- Decision: A. Subscriptions later only if most families pay the same amount on a fixed cycle.
- Consequences: one link per invoice; idempotent webhook; international cards must be enabled for parents abroad.
- Reversal condition: more than 70% of active students on the same recurring plan for 3 months.

### ADR-A07 — Roles on `sales.role` and RLS per role
Status: Proposed · Date: 2026-11-21
- Context: Teachers need logins but must not see fees or other teachers' students. Upstream RLS is open to all authenticated users.
- Options: A) `role` column + `staff_role()` DEFINER helper + per-role policies. B) separate teacher app/schema. C) frontend-only hiding.
- Decision: A. C is rejected (not security).
- Consequences: upstream `using (true)` policies are replaced; every policy gets a pgTAP test per role.
- Reversal condition: a policy bug found in production — then add a hook that blocks merging any schema change without a matching `supabase/tests/rls_*.sql` change.

### ADR-A08 — Time handling and quiet hours
Status: Proposed · Date: 2026-11-21
- Decision: store UTC; parent has an IANA time zone; batches defined in IST; display both; no business-initiated sends 20:00–09:00 parent local; replies within 24 h exempt; native `Intl` only.
- Reversal condition: parents complain about message timing, or a time-zone bug reaches production.

### ADR-A09 — Verification stack and the "passes" rule
Status: Proposed · Date: 2026-11-21
- Decision: Vitest (app, functions), pgTAP via `npx supabase test db`, Playwright for one happy path per release. A feature's `passes` flips only with pasted green output of its `verify` command (`features.json` rules).
- Reversal condition: pgTAP setup costs more than half a day in S1 → fall back to Vitest integration tests against local Supabase with per-role JWTs.

### ADR-A10 — Where our project memory lives
Status: Proposed · Date: 2026-11-21
- Context: Root `CLAUDE.md` and `AGENTS.md` are upstream-owned; root `CHANGELOG.md` is regenerated by `npm run update-changelog`.
- Decision: our editable memory is `docs/aparna/CLAUDE-aparna.md`, imported by one line in root `CLAUDE.md`. Our changelog is `docs/aparna/CHANGELOG.md`.
- Reversal condition: the import line is lost in an upstream merge twice → move the import into `.claude/CLAUDE.md`.

## Provenance & audit
Sources: chat analysis 20–21 Nov 2026, upstream repo inspection, Meta and Razorpay docs.
Checked: each ADR has options, decision, consequences and an observable reversal condition; ADR IDs referenced in PRD/ARCHITECTURE exist here (A03, A07); none marked Accepted before Gate A.
