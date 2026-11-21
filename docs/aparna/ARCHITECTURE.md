# ARCHITECTURE.md — how the CRM is built

**Status:** PRIMARY (HOW). Binds once ratified at Gate A. Structural changes need an ADR in `decisions.md`.
**Role:** Stack, data model, security, backend jobs, integrations, frontend wiring, testing, environments. WHAT lives in `PRD.md`; ORDER lives in `project_plan.md`. Upstream conventions in `AGENTS.md` and `.claude/skills/{backend-dev,frontend-dev}` still apply and win on mechanics.

---

## 1. Shape of the system

```
 Website form ──► capture_lead (edge fn, public) ─┐
 WhatsApp (parent) ──► whatsapp_webhook (edge fn) ─┤
                                                   ▼
                    ┌──────────── Supabase Postgres (RLS) ────────────┐
 React SPA ◄──────► │ contacts · students · deals(=admissions) · trials│
 (Atomic CRM,       │ courses · batches · enrolments · invoices        │
  PostgREST via     │ attendance · progress_notes · tasks · notes      │
  ra-supabase)      │ messages (outbox + log) · rule_runs              │
                    └───────┬───────────────────────┬──────────────────┘
                 pg_cron every 1 min          pg_cron every 15 min
                            ▼                       ▼
                 dispatch_outbox (edge fn)   run_time_rules() (SQL)
                            │                 creates outbox rows + tasks
                            ▼
                 WhatsApp Cloud API ──status webhooks──► whatsapp_webhook
 Counsellor "Send payment link" ──► payment_links (edge fn) ──► Razorpay
 Razorpay ──payment_link.paid──► razorpay_webhook (edge fn) ──► handle_payment()
```

Principles:

1. **Reuse before build.** Atomic CRM already gives auth, users, contacts, Kanban, tasks, notes, attachments, CSV import, activity log, tests and an agent harness.
2. **Deterministic automations.** Rules are SQL + edge functions. No LLM decides anything at runtime in v1.
3. **One outbox.** Every automated message is a row first. A guard re-checks state at send time. Sends are idempotent.
4. **No SDKs for two HTTP calls.** WhatsApp and Razorpay are called with `fetch`.

## 2. Stack (existing + additions)

Existing (do not change without an ADR): React 19, TypeScript, Vite, React Router 7, ra-core + shadcn-admin-kit, TanStack Query, React Hook Form, Tailwind 4, Supabase (Postgres, PostgREST, Auth, Storage, Edge Functions on Deno), Vitest, Playwright.

Additions:

| Addition | Why | Where |
|---|---|---|
| `pg_cron`, `pg_net` extensions | Scheduled jobs and HTTP from Postgres | `supabase/schemas/01_tables.sql` |
| `libphonenumber-js` | E.164 normalisation for dedupe; also via `npm:` in Deno | frontend + `_shared` |
| Native `Intl.DateTimeFormat` with `timeZone` | Time-zone display. No new date library | frontend |
| pgTAP via `npx supabase test db` | RLS and rule tests at the database level | `supabase/tests/*.sql` |

## 3. Data model

Schema is declarative in `supabase/schemas/` (source of truth). Migrations are generated with `npx supabase db diff --local -f <name>`; never hand-write them (the `block-migration-writes` hook enforces this for harness agents).

### 3.1 Changes to existing tables

```sql
-- contacts = parents
alter table contacts add column country text;                 -- ISO 3166-1 alpha-2
alter table contacts add column timezone text not null default 'Asia/Kolkata'; -- IANA
alter table contacts add column phone_e164 text;              -- normalised WhatsApp number
alter table contacts add column whatsapp_opt_in boolean not null default false;
alter table contacts add column opted_out_at timestamptz;
alter table contacts add column consent_at timestamptz;       -- parental consent (DPDP)
alter table contacts add column source text;                  -- website, whatsapp, referral, instagram, other
alter table contacts add column import_id bigint;
create unique index uq_contacts_phone_e164 on contacts (phone_e164) where phone_e164 is not null;

-- deals = admissions (UI label "Admission")
alter table deals add column student_id bigint references students(id);
alter table deals add column course_id bigint references courses(id);
alter table deals add column source text;
alter table deals add column next_action_at timestamptz;
alter table deals add column lost_reason text;
alter table deals add column first_response_at timestamptz;   -- for metric M1
alter table deals add column enrolled_at timestamptz;
alter table deals add column import_id bigint;
-- check: open stages require next_action_at; lost requires lost_reason
alter table deals add constraint deals_open_needs_next_action
  check (stage in ('enrolled','lost') or next_action_at is not null);
alter table deals add constraint deals_lost_needs_reason
  check (stage <> 'lost' or lost_reason is not null);

-- sales = staff users
alter table sales add column role text not null default 'counsellor'
  check (role in ('owner','counsellor','teacher'));
```

Note: `deals.stage` values are set via the `dealStages` prop in `src/App.tsx`: `enquiry, trial_booked, trial_done, payment_pending, enrolled, lost`. The upstream once added and then dropped `deals.lost_reason` (migrations `20260924…`, `20260928…`); we re-add it for our domain on purpose (ADR-A03).

### 3.2 New tables

```sql
create table students (
  id bigint generated by default as identity primary key,
  contact_id bigint not null references contacts(id) on delete cascade,
  first_name text not null,
  last_name text,
  grade text,               -- e.g. 'IV', 'X', 'adult'
  age smallint,
  board text,               -- CBSE, ICSE, ISC, IGCSE, State, Other
  level text,               -- set after trial
  notes text,
  sales_id bigint, created_at timestamptz not null default now(), import_id bigint
);

create table courses (
  id bigint generated by default as identity primary key,
  name text not null, min_age smallint, max_age smallint,
  fee_amount_paise bigint not null, currency text not null default 'INR',
  billing_period text not null check (billing_period in ('monthly','quarterly')),
  active boolean not null default true
);

create table batches (
  id bigint generated by default as identity primary key,
  course_id bigint not null references courses(id),
  teacher_id bigint not null references sales(id),
  name text not null,
  weekdays smallint[] not null,          -- 1=Mon … 7=Sun
  start_time_ist time not null, duration_min smallint not null default 60,
  class_link text, capacity smallint not null default 10,
  active boolean not null default true
);

create table trials (
  id bigint generated by default as identity primary key,
  deal_id bigint not null references deals(id) on delete cascade,
  teacher_id bigint not null references sales(id),
  starts_at timestamptz not null, class_link text,
  status text not null default 'booked' check (status in ('booked','attended','no_show','cancelled')),
  level text, recommended_batch_id bigint references batches(id), feedback text,
  created_at timestamptz not null default now()
);

create table enrolments (
  id bigint generated by default as identity primary key,
  student_id bigint not null references students(id),
  batch_id bigint not null references batches(id),
  status text not null default 'active' check (status in ('active','paused','ended')),
  start_date date not null, end_date date, end_reason text,
  deal_id bigint references deals(id), import_id bigint,
  constraint enrolments_end_reason check (status <> 'ended' or end_reason is not null)
);

create table invoices (
  id bigint generated by default as identity primary key,
  enrolment_id bigint references enrolments(id),
  deal_id bigint references deals(id),          -- first payment before enrolment exists
  period_start date, period_end date,
  amount_paise bigint not null, currency text not null default 'INR',
  due_date date not null,
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue','void')),
  razorpay_link_id text unique, razorpay_link_url text,
  paid_at timestamptz, razorpay_payment_id text unique,
  created_at timestamptz not null default now()
);

create table attendance (
  batch_id bigint not null references batches(id),
  student_id bigint not null references students(id),
  class_date date not null,
  present boolean not null,
  marked_by bigint references sales(id), marked_at timestamptz not null default now(),
  primary key (batch_id, student_id, class_date)
);

create table progress_notes (
  id bigint generated by default as identity primary key,
  student_id bigint not null references students(id),
  teacher_id bigint not null references sales(id),
  month date not null,                            -- first day of month
  speaking smallint, writing smallint, grammar smallint,  -- 1..5
  comment text not null, sent_at timestamptz,
  unique (student_id, month)
);

create table messages (                           -- outbox + log, both directions
  id bigint generated by default as identity primary key,
  direction text not null check (direction in ('out','in')),
  template_key text,                              -- see PRD §11
  contact_id bigint references contacts(id),
  entity_type text, entity_id bigint,             -- e.g. 'trial', 42
  payload jsonb not null default '{}',
  send_at timestamptz not null default now(),
  status text not null default 'queued'
    check (status in ('queued','sending','sent','delivered','read','skipped','failed','received')),
  attempts smallint not null default 0, last_error text,
  wa_message_id text unique,
  dedupe_key text unique,                         -- e.g. 'AR3:trial:42:T-24h'
  created_at timestamptz not null default now(), sent_at timestamptz
);
create index on messages (status, send_at) where status = 'queued';

create table provider_events (                    -- webhook idempotency
  provider text not null, event_id text not null, received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

create table imports (
  id bigint generated by default as identity primary key,
  resource text not null, file_name text, row_count int, created_by bigint references sales(id),
  created_at timestamptz not null default now()
);
```

Views (for fast reads, per upstream pattern):

1. `today_items` — union of the Today sections with `kind`, `entity`, `due_at`, `parent_tz`.
2. `funnel_weekly` — counts per stage transition per week (dashboard).
3. `students_summary` — student + parent + active enrolment + attendance % + unpaid count.

Every new resource also needs a FakeRest generator in `src/components/atomic-crm/providers/fakerest/dataGenerator/` because the harness smoke test runs in demo mode (`harness.config.json` → `app.smokeCommand`).

## 4. Security (RLS)

1. Helper: `public.staff_role()` — `SECURITY DEFINER`, fixed `search_path`, returns the caller's `sales.role` (or null when disabled).
2. Owner and Counsellor: read/write all CRM tables except Settings tables (Owner only) and `invoices` delete (nobody; void instead).
3. Teacher:
   - `students`, `contacts`: select only where the student has an active enrolment in a batch where `teacher_id = me`, or a trial where `teacher_id = me`.
   - `trials`: select own; update only `status, level, recommended_batch_id, feedback` (enforced by a trigger that rejects other column changes for teachers).
   - `attendance`: insert/update only for own batches. `progress_notes`: insert/update own, not `sent_at`.
   - No access to `invoices`, `messages`, `provider_events`, `imports`, settings.
4. Upstream policies are `using (true)` for authenticated users on most tables. Replacing them is part of slice S1 and is tested per role in pgTAP (`supabase/tests/rls_*.sql`).
5. Follow the upstream RLS pitfalls list in `.claude/skills/backend-dev/SKILL.md` (DEFINER counts, `WITH CHECK` on every client-settable column).
6. Public entry points (`capture_lead`, webhooks) run with the service role inside the edge function only after validation and signature checks.

## 5. Backend jobs and edge functions

All edge functions follow the upstream chain: CORS → auth (or signature check for webhooks) → handler. Shared code in `supabase/functions/_shared/`.

| Function | Auth | Does |
|---|---|---|
| `capture_lead` | Public. Honeypot field + per-IP rate limit (10/hour) + Zod validation | Normalise phone, upsert parent by `phone_e164`, create student + admission in `enquiry`, enqueue AR1 |
| `whatsapp_webhook` | GET: verify token. POST: `X-Hub-Signature-256` HMAC with app secret | Inbound message → log, upsert lead (new number) or touch `last_seen`; "STOP" → opt-out (AR13). Status updates → `messages.status` |
| `dispatch_outbox` | Called by pg_cron with a secret header | `claim_outbox(50)` (`FOR UPDATE SKIP LOCKED`), re-check `message_guard(id)`, send template via Graph API, update status; retry ≤ 3 with backoff |
| `payment_links` | Authenticated Owner/Counsellor | Create Razorpay payment link (`reference_id` = invoice id), save link, enqueue `payment_link` message |
| `razorpay_webhook` | `X-Razorpay-Signature` HMAC with webhook secret | Idempotent on event id (`provider_events`). `payment_link.paid` → `handle_payment(invoice_id)` |

SQL functions (in `02_functions.sql`, pg_dump format):

1. `enqueue_message(template_key, contact_id, entity_type, entity_id, payload, send_at, dedupe_key)` — applies quiet hours (`next_allowed_time(send_at, contact.timezone)`), skips opted-out parents, `on conflict (dedupe_key) do nothing`.
2. `message_guard(message_id) returns boolean` — one `case` per template key, e.g. `trial_reminder` → trial still `booked` and `starts_at > now()`.
3. `run_time_rules()` — every 15 min; creates AR3/AR7/AR8/AR10/AR11 rows and teacher reminder tasks; idempotent through `dedupe_key`.
4. `handle_payment(invoice_id)` — marks paid, sets deal `enrolled`, creates enrolment, enqueues `enrol_welcome` + teacher notification. One transaction.
5. Triggers: stage change → activity entry; trial status change → enqueue AR5/AR6; progress note insert → enqueue AR12; attendance insert → check two-in-a-row → AR11.

Scheduling: `pg_cron` jobs call `dispatch_outbox` through `pg_net` every minute and `run_time_rules()` every 15 minutes. The service URL and secret live in Supabase Vault, never in SQL files.

## 6. Integrations

### WhatsApp Cloud API

1. Onboard the existing business number with **Coexistence** so the WhatsApp Business app keeps working for human chats while the API sends automated templates. Open spike S4-0: confirm whether direct Embedded Signup works for this account or a BSP is needed (`risks.md` R-7).
2. Development uses Meta's free test number first.
3. Only approved templates are sent business-initiated (PRD §11). Free-form replies only inside the 24 h window.
4. Pricing (from 1 Oct 2026): per delivered message by category and recipient country; utility templates are charged even inside the window; service replies free up to 1,000 per month per number. Expected volume ≈ 2,500 utility messages per month.

### Razorpay

1. Payment Links API (`POST /v1/payment_links`) with basic auth from the edge function.
2. Webhook events: `payment_link.paid` (primary), `payment.failed` (log only).
3. Test mode first. International cards must be enabled on the account for non-INR parents (Q5).

## 7. Frontend wiring

1. Register resources in `src/components/atomic-crm/root/CRM.tsx`: `students`, `courses`, `batches`, `trials`, `enrolments`, `invoices`, `attendance`, `progress_notes`, `messages`. Follow `frontend-dev` skill patterns (list, show, edit, create files per resource folder).
2. Configure domain in `src/App.tsx`: title, logo, `dealStages`, `dealPipelineStatuses`, `taskTypes` (call, whatsapp, trial, fee, other), currency INR.
3. Rename user-facing "Deal" → "Admission" and "Contact" → "Parent" via i18n messages, not by renaming code or tables.
4. Hide Companies from the menu (ADR-A03). Do not delete it in v1.
5. Today: custom route `/today`, default landing page for Counsellor; reads `today_items`.
6. Teacher experience: same app, role-based menu (`staff_role`), routes `/my-classes`, `/attendance/:batchId/:date`, `/trial-feedback/:id`, `/progress/:studentId`. Mobile-first layouts.
7. Times: a single helper `formatInZone(date, tz)` using `Intl.DateTimeFormat`; show "IST · parent local" side by side.
8. Custom dataProvider methods for edge functions (`sendPaymentLink`, `importDryRun`), per upstream pattern.
9. Import: extend `src/components/atomic-crm/dataImport/` with students, batches, enrolments; reuse its dry-run and progress toast.

## 8. Testing and verification

| Layer | Tool | Command | Must cover |
|---|---|---|---|
| Format, types, lint | prettier, tsc, eslint | `make lint`, `make typecheck` | Everything |
| Unit + component | Vitest (`app`) | `make test` | Helpers (phone, time zone), forms, Today sections |
| Edge functions | Vitest (`functions`) | `npm run test:unit:functions` | Signature checks, payload mapping, guard decisions |
| Database | pgTAP | `npx supabase test db` | RLS per role, check constraints, `message_guard`, `run_time_rules` idempotency, `handle_payment` |
| End to end | Playwright | per `e2e-conventions` skill | One happy path per release (R1: enquiry → trial → payment link) |

Rules:

1. A feature in `features.json` flips to `passes: true` only when its `verify` command ran green in the same session and the output is quoted in `progress.md`.
2. Webhooks are tested against recorded sample payloads in `supabase/functions/<fn>/fixtures/`.
3. External sandboxes (Meta test number, Razorpay test mode) are the ground truth for S4/S5 before production.

## 9. Environments and deploy

| Env | Database | Frontend | Integrations |
|---|---|---|---|
| Local | `make start` (local Supabase) | Vite dev server | Fixtures only |
| Staging | Supabase project (staging) | Static host preview | Meta test number, Razorpay test mode |
| Production | Supabase project (Pro plan, no auto-pause) | Static host (upstream supports GitHub Pages; Vercel Hobby is for non-commercial use) | Live number (Coexistence), Razorpay live |

Deploy: `npx supabase db push` (migrations), `npx supabase functions deploy <name>`, frontend build + `node scripts/renderRuntimeConfig.ts dist/config.js`. Secrets via `npx supabase secrets set`.

Secrets: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `OUTBOX_CRON_SECRET`.

## 10. Running cost (estimate, verify at Gate A)

1. Supabase Pro for production (about USD 25/month).
2. Static hosting: free tier (non-commercial limits apply to some hosts).
3. WhatsApp: about 2,500 utility messages/month; a few hundred to about ₹2,000/month depending on how many parents are abroad.
4. Razorpay: standard per-transaction fees (international higher).

## Provenance & audit

Sources: upstream repo (`AGENTS.md`, `supabase/schemas/*.sql`, `.claude/skills/backend-dev`, `harness.config.json`), Meta WhatsApp pricing + Coexistence docs (Nov 2026), Razorpay Payment Links docs, PRD v1.
Checked: every PRD table in §5 has a table here; every automation AR1–AR13 maps to a trigger, `run_time_rules` or an edge function; RLS rules match PRD §4 matrix; no new npm dependency besides `libphonenumber-js`; SQL here is a sketch for planning — the source of truth becomes `supabase/schemas/` once written.
