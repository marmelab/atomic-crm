# TRANSITION.md — every MVP shortcut and how the full build pays it back

**Status:** PRIMARY for moving from the MVP to the full build. Each row is a decision taken for speed, with the trigger, the full-build target, and the exact steps.
**Role:** Read this before starting any full-build slice. Full-build features that the MVP already satisfies are re-verified, not rebuilt.

---

## 1. Ledger (point by point)

| # | Area | MVP decision | Full build | Switch when | Steps | Closes with |
|---|---|---|---|---|---|---|
| T1 | Students | Child fields live on the admission (`deals.child_*`); one admission = one child (ADR-A12) | `students` table linked to parent; admissions reference `student_id` (ADR-A03) | Start of full build (before teachers or siblings) | 1) create `students`; 2) `insert into students … select … from deals`; 3) set `deals.student_id`; 4) UI reads students; 5) drop `deals.child_*` one release later | F-200, F-203 |
| T2 | Fees | `fee_amount_paise`, `fee_period`, `next_fee_due` on the enrolled admission; "Mark fee paid" moves the date | `enrolments` + `invoices` with Razorpay links (ADR-A06) | With S5/S7 | 1) create `courses`, `batches`, `enrolments`, `invoices`; 2) one enrolment + one open invoice per enrolled admission; 3) Today reads invoices; 4) drop fee columns from `deals` later | F-700..F-704 |
| T3 | WhatsApp | One-tap `wa.me` links; a human presses send; logged as a note (ADR-A13) | Cloud API outbox with guards, quiet hours, opt-out (ADR-A04, A05) | After pilot shows message volume; Meta verification started on MVP day 1 | 1) submit MVP template texts to Meta as utility templates; 2) build outbox (S4); 3) switch rules on one by one; 4) keep `wa.me` button as manual fallback | F-400..F-411 |
| T4 | Payments | Counsellor pastes a Razorpay link; marks paid by hand | Payment Links API + verified webhook + `handle_payment` | With S5/S6 | 1) create links from the CRM; 2) webhook marks paid; 3) manual "mark paid" becomes Owner-only | F-500..F-605 |
| T5 | Users and access | Owner + Counsellor; upstream open policies; no Teacher accounts (ADR-A14) | `sales.role` + per-role RLS + pgTAP per role (ADR-A07) | **Before the first Teacher account — hard rule** | 1) add `role`; 2) replace `using (true)` policies; 3) pgTAP per role in CI; 4) then invite teachers | F-100, F-101, F-503 |
| T6 | Trials | `trial_at` on the admission; outcome as a note | `trials` table with teacher, status, feedback | With S3 | 1) create `trials`; 2) one trial per admission with `trial_at`; 3) teacher feedback screen | F-300..F-305 |
| T7 | Today | Built from admission fields, client-side | `today_items` view across tables | With S1/S3 | Replace queries section by section; keep the same UI | F-109, F-305, F-605 |
| T8 | Numbers | "This week" strip, client-side counts | Dashboard M1–M8 from views | S10 | Use pilot numbers as baselines in `progress.md` | F-1000..F-1003 |
| T9 | Lead capture | Manual quick-add | Website form edge function + WhatsApp inbound creates leads | S1 (form), S4 (inbound) | Reuse the phone helper and duplicate logic from M2 | F-108, F-405 |
| T10 | Config | Domain options in `defaultConfiguration.ts` | Same, plus Owner settings for automations | S4 | Add settings only for rules that exist | F-411 |
| T11 | Dev workflow | Cloud sessions write code; CI runs migrations, pgTAP, e2e; hand-written small migrations (ADR-A15) | Same; drift check `supabase db diff` on WSL before each gate | Always | Run drift check at Gate MVP exit and every full-build gate | — |
| T12 | Hosting | Supabase project + Vercel (Preview = demo mode, Production = real) | Same; Supabase Pro before real data grows; staging project when automations start | Before go-live of real data / before S4 | Upgrade plan; add a staging project and point Preview to it | F-112 |

## 2. Full-build features the MVP already covers (re-verify, do not rebuild)

F-102 (relabelled board; stages differ only by name), F-103, F-104 (constraints), F-105 (parent fields, partial), F-106 (phone helper), F-107 (quick-add), F-109 (Today v1, partial), F-110 (time helper), F-111 (branding), F-112 (deploy). At the start of the full build, run each one's `verify`; flip `passes` only on green evidence.

## 3. Choosing the first full-build slice after the pilot

Read the pilot numbers in `progress.md`, then:

1. Most time lost on **sending messages** (Counsellor says so, or more than 40 one-tap sends per day) → T3 first (S4 WhatsApp outbox).
2. **Fees** late or chased by hand for more than 20% of students → T2 + T4 first (S5, S7).
3. **Teachers** need to log in (attendance, feedback) → T5 first (roles + RLS), then T1, T6.
4. Otherwise → T5, T1 (foundation for everything else), then T3.

T5 always comes before any Teacher account, whichever order is chosen.

## Provenance & audit
Sources: MVP decisions (21 Nov 2026), `PRD.md`, `ARCHITECTURE.md`, ADR-A03..A15.
Checked: every MVP shortcut in `MVP.md` §3, §4, §6, §8 has a row here; every row names its closing features in `features.json`.
