# MVP.md — "Never lose a lead" (build first)

**Status:** PRIMARY for the MVP track. Binds once Gate MVP-A passes. Where this file and `PRD.md` differ, this file wins until the MVP exit gate; after that `TRANSITION.md` says how each difference is resolved.
**Role:** Scope, features, screens, data, slices and exit of the MVP. The full build stays in `PRD.md` / `ARCHITECTURE.md`. Every MVP shortcut and how it is paid back is in `TRANSITION.md`.

---

## 1. Goal

In about 1 week, give the Counsellor one place where every family, its stage and its next follow-up live, plus one-tap WhatsApp messages. Nothing is sent automatically yet. Collect real numbers during a 1-week pilot so the full build automates the right things first.

## 2. Her problems → MVP answer

| # | Problem | MVP answer | Solves |
|---|---|---|---|
| 1 | New enquiries lost / late reply | Quick-add + Today "New" section with minutes-waiting timer + one-tap welcome | Mostly (night enquiries wait for morning) |
| 2 | Follow-ups forgotten | `next_action_at` required on every open admission (DB check) + Today due/overdue | Fully |
| 3 | 7–10 day journey | Board shows where each family is stuck; one-tap trial reminder, after-trial and payment messages | Partly |
| 4 | Missed calls | Quick-add after a call in ~10 seconds, follow-up created | Partly |
| 5 | Fee reminders | `next_fee_due` on each student card; Today "Fees due/overdue"; one-tap reminder; "Mark fee paid" moves the date | Mostly |
| 6 | Parent updates | One-tap absence check-in and progress messages (no attendance tracking) | Weakly |
| 7 | Handover to teacher | Child, level, course, batch notes on the card; shared by hand | Partly |
| 8 | Counsellor overload | One Today list instead of scrolling chats | Mostly |
| 9 | Data trapped in WhatsApp | All families, notes and message logs in the business's CRM; CSV export | Fully |
| 10 | No numbers | "This week" strip: enquiries, first-response time, trials, enrolled, lost by reason | Partly (baseline) |

## 3. Users

Owner and Counsellor only, both full access (upstream policies). **No Teacher accounts until full-build F-101 (role RLS) passes** (ADR-A14). Sign-up is invitation-only after the first user (upstream `handle_new_user` raises "Sign up is not allowed"), so the Owner must sign up first on a fresh production project (risk R-13).

## 4. Data (MVP schema)

All new data sits on existing tables (ADR-A12). Declarative schema in `supabase/schemas/01_tables.sql` + one migration.

`deals` (= Admission; one admission = one child):

| Column | Type | Notes |
|---|---|---|
| `child_name` | text | required in quick-add |
| `child_grade` | text | e.g. `IV`, `X`, `adult` |
| `board` | text | CBSE, ICSE, ISC, IGCSE, State, Other |
| `course` | text | from a fixed list in config |
| `source` | text | whatsapp, call, website, instagram, referral, other |
| `next_action_at` | timestamptz | required when stage is open |
| `lost_reason` | text | required when stage = lost |
| `trial_at` | timestamptz | set when stage = trial_booked |
| `first_response_at` | timestamptz | set on first logged WhatsApp send (baseline M1) |
| `enrolled_at` | timestamptz | set when moved to enrolled |
| `fee_amount_paise` | bigint | enrolled only |
| `fee_period` | text | monthly or quarterly |
| `next_fee_due` | date | enrolled only |

Checks: `deals_open_needs_next_action` (stage in enquiry, trial_booked, trial_done, payment_pending ⇒ `next_action_at` not null) and `deals_lost_needs_reason`.

`contacts` (= Parent): `country` text, `timezone` text default `Asia/Kolkata`, `phone_e164` text unique (partial index), `whatsapp_opt_in` boolean default true for existing families.

Domain options (stages, task types, courses, boards, sources, lost reasons, currency INR, title) go in `src/components/atomic-crm/root/defaultConfiguration.ts`, because `demo/App.tsx` does not use `src/App.tsx` (P-11). Check in M0 how DB-stored configuration (Settings page) overrides these defaults.

## 5. Screens

1. **Today** (landing page): New (not yet contacted, timer) · Follow-ups due/overdue · Trials today/tomorrow (IST + parent local) · Payment pending · Fees due in ≤ 3 days / overdue · "This week" strip.
2. **Admissions board** (upstream Kanban, relabelled): card shows child, course, next action (red when overdue), days in stage. Moving to Lost asks for a reason; moving to an open stage without next action asks for one.
3. **Quick-add enquiry** (button on Today and board): parent name, WhatsApp number, country (guessed from number), child name, grade, board, course, source, note → parent + admission in `enquiry`, `next_action_at = now + 2 h`. Duplicate number → links the existing parent and warns.
4. **Admission detail** (upstream show page): fields above, notes timeline, WhatsApp buttons, "Mark fee paid".
5. **Parents** (upstream contacts, relabelled). **Import** (upstream importers, extended).

Companies: hidden from the menu, not deleted.

## 6. One-tap WhatsApp

1. Templates are constants in `src/components/atomic-crm/whatsapp/templates.ts` (English, plain, short). Owner asks for wording changes through a PR.
2. Keys: `welcome`, `trial_confirm`, `trial_reminder`, `after_trial`, `payment_link`, `payment_followup`, `fee_reminder`, `absence_checkin`.
3. Button opens `https://wa.me/<digits>?text=<encoded>` in a new tab (WhatsApp app or Web).
4. When the user comes back, a small dialog: "Sent?" → Yes logs a note `WhatsApp: <key>`, sets `first_response_at` if empty, and sets the next follow-up (per-template default, editable). Two taps in total.
5. `payment_link` and `fee_reminder` ask the user to paste the Razorpay link into the dialog before opening WhatsApp.

## 7. Slices (graph of loops)

```
M0 Check (no code) ─► M1 Foundation (schema + config + CI + deploy; schema FROZEN at merge)
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
        M2 Capture & discipline     M3 Today + one-tap WhatsApp      (2 cloud sessions in parallel)
                 │                         │
                 ▼                         │
        M4 Import (needs M2 phone helper)  │
                 └────────────┬────────────┘
                              ▼
                 M5 Pilot week + fixes ─► [Gate MVP exit]
```

File ownership in parallel (prevents merge conflicts): M2 owns `deals/` forms and cards, `contacts/` quick-add, `misc/phone.ts`. M3 owns new folders `today/`, `whatsapp/`, `misc/time.ts`, and the route line in `root/CRM.tsx`. Only M1 edits `types.ts`, schema files and `defaultConfiguration.ts`. A slice that needs a file it does not own stops and asks.

| Slice | Features | Day |
|---|---|---|
| M0 | M-001 | 0 (30 min) |
| M1 | M-101..M-107 | 1 |
| M2 ∥ M3 | M-201..M-205 ∥ M-301..M-306 | 2–3 |
| M4 | M-401..M-402 | 4 |
| M5 | M-501..M-503 | 5 + pilot week |

## 8. Where things are verified

| Check | Runs in |
|---|---|
| `make typecheck`, `make lint`, `make test`, `npm run test:unit:functions` | Cloud session |
| Local Supabase (`make start`), migrations via `supabase db diff`, pgTAP (`npx supabase test db`), Playwright e2e | Cloud session (Docker), then again in GitHub Actions `Check` on the PR |
| Looks right on a phone | Vercel Preview (demo mode, fake data) |
| Real data | Production after merge (`Deploy` workflow pushes migrations) |

If M0 finds Docker unusable in the cloud environment, ADR-A15 falls back to CI as the only Docker.

## 9. Exit gate (MVP)

1. All M-features pass with evidence in `progress.md`.
2. Pilot: 5 working days, every new enquiry entered, M2 (admissions without next action) = 0 at end of each day.
3. Baseline table in `progress.md` filled from the "This week" strip.
4. Counsellor and Owner say it is faster than WhatsApp alone.
5. Next build slice chosen from the pilot numbers (see `TRANSITION.md` §3).

## Provenance & audit

Sources: chat decisions 21 Nov 2026 (MVP-first, comparison table), repo checks (`handle_new_user` signup block, `block-migration-writes` scope, `demo/App.tsx`, `.github/workflows/check.yml` and `deploy.yml`).
Checked: every problem 1–10 maps to a section; every MVP feature in `features.json` (slices M0–M5) maps to §5–§7; file ownership has no overlap between M2 and M3.
