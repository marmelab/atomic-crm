# Task Brief: Outreach Pipeline MVP (Data + Edge Functions + Frontend)

**ID:** BRIEF-001
**Date:** 2026-04-11
**Project:** Hatch CRM
**Size:** L
**Depends on:** none

## Goal

Build the outreach pipeline data layer, three edge functions (ingest, upsert, send), and the frontend timeline/approval UI — enabling leads to enter the intake pipeline, receive AI-drafted outreach, and get sent via Postmark with human approval.

## Environment

**Branch:** `feat/outreach-pipeline-mvp` (create from `main`)
**Setup:** `cd C:/Users/natha/hatch-crm && npm install`
**Test command:** `npx tsc --noEmit` (TypeScript check) + manual verification in demo mode (`npm run dev`)
**When done:** Push to origin and open a PR against `main`

## Scope

### In Scope
- [ ] New migration: `outreach_steps` table with RLS policies
- [ ] New migration: `intake_leads` rollup columns (`current_draft_status`, `outreach_subject`)
- [ ] New TypeScript type: `OutreachStep` in `src/components/atomic-crm/types.ts`
- [ ] Updated `IntakeLead` type with new rollup fields
- [ ] FakeRest data generator for `outreach_steps` collection
- [ ] `Db` interface updated with `outreach_steps` collection
- [ ] Resource registration for `outreach_steps` in `CRM.tsx` (Desktop + Mobile)
- [ ] New edge function: `ingest-intake-lead` (API key auth)
- [ ] New edge function: `upsert-outreach-step` (API key auth, with rollup update)
- [ ] New edge function: `send-outreach` (JWT auth, Postmark integration)
- [ ] Rebuilt `IntakeExpandedRow.tsx` with outreach timeline replacing single-draft panel
- [ ] Updated `IntakeList.tsx` with `current_draft_status` filter + "ready for review" badge

### Out of Scope
- [ ] n8n workflows (WF-03, WF-04) — separate brief
- [ ] Postmark account configuration (infra task, not code)
- [ ] Sales agent template creation (AI task, not code)
- [ ] `handle-outreach-reply` edge function (Phase 9, post-MVP)
- [ ] Cadence runner WF-04 (Phase 10, post-MVP)
- [ ] Existing `postmark/index.ts` error propagation fix (Phase 11, standalone)
- [ ] Batch "Approve All Reviewed" UI (future enhancement)

## Architecture Notes

### Data Layer

**`outreach_steps` table** — Per-touch system of record. One row per lead per sequence step. Key constraint: `UNIQUE (intake_lead_id, sequence_step)` prevents duplicate touches.

**CRITICAL FK type fix:** `intake_leads.id` is `uuid` (see `supabase/migrations/20260409100000_intake_leads.sql` line 4). The `outreach_steps.intake_lead_id` column MUST be `uuid`, NOT `bigint`. The spec's SQL has this wrong.

**RLS:** Follow the pattern from `20260409100000_intake_leads.sql` lines 44-56 — `authenticated` role gets SELECT/INSERT/UPDATE/DELETE. Same 4 policies.

**Rollup columns on `intake_leads`:** Add `current_draft_status` (CHECK: `'none', 'drafting', 'ai_reviewed', 'approved', 'sent'`) and `outreach_subject` (TEXT). These are UI filtering shortcuts — the source of truth is `outreach_steps`.

### Edge Functions

All three new functions go in `supabase/functions/[name]/index.ts`.

**Pattern reference for API key auth:** `supabase/functions/ingest-lead/index.ts`
- Uses `x-api-key` header validated against `Deno.env.get("INGEST_API_KEY")`
- Has `escapeIlike`, `jsonResponse`, `logEvent` helper patterns
- Uses `supabaseAdmin` from `../_shared/supabaseAdmin.ts`
- Uses CORS from `../_shared/cors.ts`

**Pattern reference for JWT auth:** `supabase/functions/promote-intake-lead/index.ts`
- Creates a per-request Supabase client from the Authorization header
- Validates user via `authClient.auth.getUser()`
- Same `jsonResponse` and `logEvent` patterns

**`ingest-intake-lead`:**
- API key auth (same as `ingest-lead`)
- INSERT into `intake_leads` with status `uncontacted`
- Dedup on `idempotency_key`: if a row with that key exists, return 200 with existing ID (not 409)
- Validate required field: `business_name`
- Accept optional: `email, phone, website, address, city, region, trade_type, enrichment_summary, owner_name, metadata, idempotency_key`
- `trade_type` comes as a string name, not UUID — look up `trade_types.id` by name (case-insensitive ILIKE), skip if not found

**`upsert-outreach-step`:**
- API key auth (n8n calls this)
- Upsert into `outreach_steps` using `ON CONFLICT (intake_lead_id, sequence_step)` semantics
- After insert/update: update rollup fields on the parent `intake_leads` row:
  - `outreach_count` = count of steps with status `sent`
  - `outreach_sequence_step` = max `sequence_step` where status IN (`sent`, `completed`)
  - `last_outreach_at` = max `sent_at` from steps
  - `current_draft_status` = latest step's status mapped to rollup enum
  - `outreach_subject` = latest step's subject
  - `outreach_draft` = latest step's body (backward compat with existing UI)
- Validate: `intake_lead_id` must be valid UUID, `sequence_step` must be 1-7, `channel` must be email/linkedin/phone

**`send-outreach`:**
- JWT auth (Nathan must be logged in, same pattern as `promote-intake-lead`)
- Read step + lead data
- Validate: step status must be `ai_reviewed` or `approved`, channel must be `email`, lead must have an email address
- Send via Postmark Server API: `POST https://api.postmarkapp.com/email` with `X-Postmark-Server-Token` header
- Use env vars: `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_ADDRESS`, `POSTMARK_OUTREACH_STREAM`
- **Critical partial-failure order:** Store `provider_message_id` on step FIRST, THEN update status to `sent` + `sent_at`. Two separate UPDATE calls. If the second fails, the message_id is still stored for reconciliation.
- After successful send: update lead rollup fields (same logic as `upsert-outreach-step` rollup)
- If lead status is `uncontacted` → update to `in-sequence`
- On Postmark error: set step status → `failed`, do NOT advance cadence. Log the error.

### Frontend

**`IntakeExpandedRow.tsx` rebuild:**
- Replace the current 3-column grid with a 2-column layout:
  - **Column 1:** AI Enrichment Summary (keep existing)
  - **Column 2:** Outreach Timeline — vertical timeline showing all `outreach_steps` for this lead
- Timeline component: fetch steps via `useGetList('outreach_steps', { filter: { intake_lead_id: record.id }, sort: { field: 'sequence_step', order: 'ASC' } })`
- Each step renders: step number, channel icon (Mail/Linkedin/Phone), status badge, date
- Expandable step detail: subject + body (editable textarea if status is `ai_reviewed` or `drafting`)
- For `ai_reviewed` steps: "Approve & Send" button → calls `send-outreach` edge function
- For `action_needed` steps (linkedin/phone): "Mark Complete" button → calls `upsert-outreach-step` to set status `completed`
- For `replied` steps: show reply content inline
- For `sent` steps: show sent date, read-only content
- Empty state: "No outreach steps yet. Steps will appear here when the outreach generator runs."
- Confirmation dialog before "Approve & Send" (use existing shadcn AlertDialog pattern)

**`IntakeList.tsx` updates:**
- Add `current_draft_status` to the Datagrid columns (badge rendering)
- Add a count badge near the status tabs: "N ready for review" (count of leads where `current_draft_status = 'ai_reviewed'`)

**FakeRest generator:**
- New file: `src/components/atomic-crm/providers/fakerest/dataGenerator/outreachSteps.ts`
- Generate 2-4 outreach steps per intake lead that has status `in-sequence` or `engaged`
- Mix of statuses: some `sent`, some `ai_reviewed`, some `action_needed`
- Wire into `index.ts` generator and `types.ts` Db interface
- Register `outreach_steps` Resource in `CRM.tsx` (both Desktop block line ~293 and Mobile block line ~370, lookup-only — no list/edit views)

## Acceptance Criteria

- [ ] `npx tsc --noEmit` passes with 0 new errors (pre-existing react-router-dom errors in 3 files are acceptable)
- [ ] `outreach_steps` migration creates table with correct UUID FK to `intake_leads`, RLS policies, and indexes
- [ ] `intake_leads` migration adds `current_draft_status` and `outreach_subject` columns
- [ ] `OutreachStep` type exists in `types.ts` matching the DB schema
- [ ] `ingest-intake-lead` accepts POST with API key, inserts to `intake_leads`, deduplicates on `idempotency_key`
- [ ] `upsert-outreach-step` accepts POST with API key, upserts step, updates rollup fields on parent lead
- [ ] `send-outreach` accepts POST with JWT, validates step state, sends via Postmark API, stores `provider_message_id` BEFORE updating status
- [ ] FakeRest generates `outreach_steps` data — demo mode shows timeline with steps
- [ ] `IntakeExpandedRow` renders outreach timeline with step cards showing status, channel, content
- [ ] "Approve & Send" button calls `send-outreach` and updates UI on success
- [ ] "Mark Complete" button on non-email steps calls `upsert-outreach-step` to set status `completed`
- [ ] `IntakeList` shows `current_draft_status` column and "N ready for review" badge
- [ ] `outreach_steps` Resource registered in both Desktop and Mobile admin blocks

## Behavioral Contract

| Test Description | Pre-implementation (FAIL) | Post-implementation (PASS) |
|-----------------|--------------------------|---------------------------|
| `ingest-intake-lead` deduplicates on `idempotency_key` | Function does not exist | POST with same `idempotency_key` twice returns 200 both times, only 1 row in `intake_leads` |
| `upsert-outreach-step` updates rollup fields | Function does not exist | After upserting step with status `ai_reviewed`, parent lead's `current_draft_status` = `ai_reviewed` |
| `send-outreach` stores message_id before status update | Function does not exist | After Postmark returns, step has `provider_message_id` set even if subsequent status update query is interrupted |
| `send-outreach` rejects non-email channels | Function does not exist | POST with step where channel = `linkedin` returns 400 |
| `upsert-outreach-step` enforces sequence_step 1-7 | Function does not exist | POST with `sequence_step: 8` returns 400 |

## Must Not Change

- [ ] `supabase/functions/ingest-lead/index.ts` — existing lead ingestion for companies/contacts/deals. The NEW function is `ingest-intake-lead`, a separate directory.
- [ ] `supabase/functions/promote-intake-lead/index.ts` — promotion logic is complete and tested. Read it for patterns only.
- [ ] `supabase/functions/postmark/index.ts` — existing inbound email handler for promoted contacts. Untouched.
- [ ] `supabase/migrations/20260409100000_intake_leads.sql` — original table creation. New columns go in new migration files.
- [ ] `supabase/migrations/20260411120000_intake_status_and_outreach.sql` — already written, adds status remap + 4 outreach columns. Do not duplicate these columns.
- [ ] `src/components/atomic-crm/intake/IntakeStatusBadge.tsx` — already handles all status values. No changes needed.
- [ ] Response shapes of existing edge functions — other systems depend on them.

## Scope Gates

- [ ] If the Postmark API requires account-level configuration (verified sender, message stream creation) that can't be done from code, STOP and note it — that's an infra task for Nathan.
- [ ] If `intake_leads` columns from `20260411120000` migration conflict with the new rollup columns, STOP — don't try to reconcile migrations, flag it.
- [ ] If you discover the react-admin `useGetList` hook doesn't support nested resource filtering the way the timeline needs, STOP — don't invent a custom data fetching pattern.
- [ ] If `outreach_steps` needs a `sales_id` or `org_id` for multi-tenancy, STOP — that's an architectural decision not covered here.

## Deviation Rules

**Auto-fix (no checkpoint needed):**
- Broken imports or missing dependencies required by in-scope code
- Missing error handling at system boundaries (try/catch, null checks)
- Lint/format violations caught by the project's configured linter
- Missing type annotations on functions you create
- Adding CORS OPTIONS handler to new edge functions (follow `promote-intake-lead` pattern)

**Checkpoint required (stop and comment on PR):**
- Any architectural change not described in Architecture Notes
- Adding a new library or dependency not listed in the brief
- Creating a new shared utility in `_shared/` beyond using existing `supabaseAdmin.ts` and `cors.ts`
- Changing the public API signature of any existing function
- Any change to files listed in Must Not Change
- Performance concerns (e.g., N+1 queries in rollup updates)

## Anti-Patterns

- Do not modify existing edge functions — create new ones in new directories
- Do not put outreach step logic in the `tasks` table — `outreach_steps` IS the task tracker for intake leads
- Do not use `intake_leads.outreach_draft` as the source of truth — it's a backward-compat rollup field only
- Do not create a separate `outreach_templates` table — templates are n8n workflow variables for MVP
- Do not skip the partial-failure ordering on send: message_id FIRST, status update SECOND
- Do not duplicate the `escapeIlike`, `jsonResponse`, `logEvent` helpers — import patterns from existing functions or copy the implementations into each new function (Deno edge functions are independent deployments, no shared runtime beyond `_shared/`)
- Do not add `for await (const chunk of req)` patterns — use `await req.json()` for JSON bodies (Deno runtime, not Vercel)

## Manual Test Checklist

- [ ] In demo mode (`npm run dev`), expand an intake lead row — outreach timeline renders with step cards showing different statuses (sent, ai_reviewed, action_needed)
- [ ] Click "Approve & Send" on an `ai_reviewed` step — confirmation dialog appears, send triggers (will fail in demo mode since no Postmark, but the UI flow should complete with an error toast)
- [ ] Click "Mark Complete" on a linkedin/phone step — step status updates to `completed` in the UI
- [ ] `IntakeList` shows `current_draft_status` column with colored badges
- [ ] Outreach timeline shows empty state for leads with no steps

## Sub-Briefs

**Wave Plan:**

| Wave | Sub-Briefs | Why this grouping |
|------|-----------|-------------------|
| 1 | SB-1, SB-2 | Data foundation — migration + types + fakerest. Zero file overlap. |
| 2 | SB-3, SB-4 | Edge functions that depend on the migration. Separate function dirs, parallel-safe. |
| 3 | SB-5, SB-6 | Send function + frontend. SB-6 depends on fakerest data from SB-2 and types from SB-2. |

---

### SB-1: Migration — `outreach_steps` Table + `intake_leads` Rollup Columns

**Wave:** 1
**Depends on:** none
**Branch:** `feat/op-mvp-sb1-migration`
**Files:**
- `supabase/migrations/20260411120200_outreach_steps.sql` (NEW)
- `supabase/migrations/20260411120300_intake_leads_rollup_columns.sql` (NEW)

**Scope:**

Create `outreach_steps` table:
```sql
CREATE TABLE public.outreach_steps (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  intake_lead_id UUID NOT NULL REFERENCES intake_leads(id) ON DELETE CASCADE,
  sequence_step INTEGER NOT NULL CHECK (sequence_step BETWEEN 1 AND 7),
  channel TEXT NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'linkedin', 'phone')),
  subject TEXT,
  body TEXT,
  review_status TEXT DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'passed', 'failed', 'skipped')),
  review_feedback TEXT,
  status TEXT NOT NULL DEFAULT 'drafting'
    CHECK (status IN ('drafting', 'ai_reviewed', 'action_needed', 'approved', 'sent', 'completed', 'failed', 'replied')),
  provider_message_id TEXT,
  reply_body TEXT,
  reply_received_at TIMESTAMPTZ,
  run_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE (intake_lead_id, sequence_step)
);
```

Indexes:
- `idx_outreach_steps_pending` on `(intake_lead_id, sequence_step)` WHERE status IN ('ai_reviewed', 'action_needed')
- `idx_outreach_steps_message_id` on `(provider_message_id)` WHERE provider_message_id IS NOT NULL

RLS: Enable + 4 policies for `authenticated` role (SELECT/INSERT/UPDATE/DELETE) — same pattern as `intake_leads` in `20260409100000_intake_leads.sql` lines 44-56.

Add rollup columns to `intake_leads`:
```sql
ALTER TABLE public.intake_leads ADD COLUMN IF NOT EXISTS current_draft_status TEXT
  DEFAULT 'none'
  CHECK (current_draft_status IN ('none', 'drafting', 'ai_reviewed', 'approved', 'sent'));
ALTER TABLE public.intake_leads ADD COLUMN IF NOT EXISTS outreach_subject TEXT;
```

**Acceptance:**
- Both migration files parse as valid SQL
- `outreach_steps` has UUID FK to `intake_leads.id` (not BIGINT)
- UNIQUE constraint on `(intake_lead_id, sequence_step)` exists
- RLS enabled with 4 authenticated policies
- `intake_leads` has `current_draft_status` and `outreach_subject` columns

---

### SB-2: TypeScript Types + FakeRest Generator + Resource Registration

**Wave:** 1
**Depends on:** none (uses types defined in SB-1 migration but doesn't run SQL)
**Branch:** `feat/op-mvp-sb2-types-fakerest`
**Files:**
- `src/components/atomic-crm/types.ts` (EDIT — add `OutreachStep` type, add fields to `IntakeLead`)
- `src/components/atomic-crm/providers/fakerest/dataGenerator/outreachSteps.ts` (NEW)
- `src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts` (EDIT — add `outreach_steps` to `Db`)
- `src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts` (EDIT — wire generator)
- `src/components/atomic-crm/root/CRM.tsx` (EDIT — add Resource registration)

**Scope:**

Add `OutreachStep` type to `types.ts` after the `IntakeLead` type (line ~195):
```typescript
export type OutreachStep = {
  intake_lead_id: string;
  sequence_step: number;
  channel: 'email' | 'linkedin' | 'phone';
  subject: string | null;
  body: string | null;
  review_status: 'pending' | 'passed' | 'failed' | 'skipped';
  review_feedback: string | null;
  status: 'drafting' | 'ai_reviewed' | 'action_needed' | 'approved' | 'sent' | 'completed' | 'failed' | 'replied';
  provider_message_id: string | null;
  reply_body: string | null;
  reply_received_at: string | null;
  run_id: string | null;
  created_at: string;
  sent_at: string | null;
} & Pick<RaRecord, "id">;
```

Add to `IntakeLead` type (after `outreach_sequence_step` field, line ~190):
```typescript
  current_draft_status: 'none' | 'drafting' | 'ai_reviewed' | 'approved' | 'sent';
  outreach_subject: string | null;
```

Create `outreachSteps.ts` generator:
- Generate steps for intake leads with status `in-sequence` or `engaged`
- 2-4 steps per qualifying lead
- Step 1: status `sent`, channel `email`, with subject/body, sent_at in the past
- Step 2: status `sent`, channel `email`, with subject/body
- Step 3: status `ai_reviewed`, channel `email`, with draft subject/body (the "ready for review" item)
- Step 4 (if generated): status `action_needed`, channel `linkedin`
- Use realistic outreach content relevant to construction businesses
- Each step needs a unique numeric `id`

Update `Db` interface in `types.ts` — add:
```typescript
outreach_steps: OutreachStep[];
```
(Import `OutreachStep` from `../../../types`)

Update `index.ts` — add `generateOutreachSteps(db)` after `generateIntakeLeads(db)` and assign to `db.outreach_steps`.

Update `CRM.tsx` — add `<Resource name="outreach_steps" />` in both the Desktop admin block (after `intake_leads` at line ~292) and the Mobile admin block (after `intake_leads` at line ~365).

**Acceptance:**
- `npx tsc --noEmit` passes with 0 new errors
- `OutreachStep` type in `types.ts` matches DB schema field names and types
- FakeRest generates outreach steps for in-sequence/engaged leads
- `outreach_steps` Resource registered in both admin blocks
- Demo mode loads without errors

---

### SB-3: Edge Function — `ingest-intake-lead`

**Wave:** 2
**Depends on:** SB-1 (migration must exist)
**Branch:** `feat/op-mvp-sb3-ingest-intake-lead`
**Files:**
- `supabase/functions/ingest-intake-lead/index.ts` (NEW)

**Scope:**

New edge function. Follow the `ingest-lead/index.ts` pattern exactly:
- CORS OPTIONS handler (copy from `promote-intake-lead` lines 68-77)
- API key auth: validate `x-api-key` header against `Deno.env.get("INGEST_API_KEY")` — same as `ingest-lead`
- Copy `jsonResponse` and `logEvent` helpers (Deno edge functions don't share runtime — each function is independent)
- Import `supabaseAdmin` from `../_shared/supabaseAdmin.ts`

Request validation:
- `business_name` required (non-empty string)
- Optional: `email`, `phone`, `website`, `address`, `city`, `region`, `trade_type` (string name), `enrichment_summary`, `owner_name`, `metadata` (object), `idempotency_key`

Logic:
1. If `idempotency_key` provided: check if row exists → return 200 with existing `{ id }` (not error)
2. If `trade_type` string provided: look up `trade_types` by name (case-insensitive ILIKE using `escapeIlike`), use the UUID if found, NULL if not
3. INSERT into `intake_leads`: map fields, status = `uncontacted`, default source = `lead-engine`
4. Log via `logEvent`
5. Return 201 with `{ id }`

**Acceptance:**
- POST with valid API key + `business_name` returns 201 with `{ id: uuid }`
- POST with duplicate `idempotency_key` returns 200 with same `{ id }`
- POST without `x-api-key` returns 401
- POST without `business_name` returns 400
- `trade_type` string is resolved to UUID via `trade_types` table lookup

---

### SB-4: Edge Function — `upsert-outreach-step`

**Wave:** 2
**Depends on:** SB-1 (migration must exist)
**Branch:** `feat/op-mvp-sb4-upsert-outreach-step`
**Files:**
- `supabase/functions/upsert-outreach-step/index.ts` (NEW)

**Scope:**

New edge function. API key auth (same as SB-3).

Request validation:
- `intake_lead_id` required (valid UUID)
- `sequence_step` required (integer 1-7)
- `channel` optional (default `email`, must be `email`/`linkedin`/`phone`)
- Optional: `subject`, `body`, `review_status`, `review_feedback`, `status`, `run_id`

Logic:
1. Validate `intake_lead_id` exists in `intake_leads`
2. Upsert into `outreach_steps`:
   - INSERT with ON CONFLICT `(intake_lead_id, sequence_step)` DO UPDATE
   - Only update fields that are present in the payload (don't null out existing values)
3. After upsert: update rollup fields on parent `intake_leads` row:
   ```sql
   UPDATE intake_leads SET
     outreach_count = (SELECT COUNT(*) FROM outreach_steps WHERE intake_lead_id = $1 AND status = 'sent'),
     outreach_sequence_step = COALESCE((SELECT MAX(sequence_step) FROM outreach_steps WHERE intake_lead_id = $1 AND status IN ('sent', 'completed')), 0),
     last_outreach_at = (SELECT MAX(sent_at) FROM outreach_steps WHERE intake_lead_id = $1 AND status = 'sent'),
     current_draft_status = (SELECT CASE status WHEN 'ai_reviewed' THEN 'ai_reviewed' WHEN 'approved' THEN 'approved' WHEN 'sent' THEN 'sent' WHEN 'drafting' THEN 'drafting' ELSE 'none' END FROM outreach_steps WHERE intake_lead_id = $1 ORDER BY sequence_step DESC LIMIT 1),
     outreach_subject = (SELECT subject FROM outreach_steps WHERE intake_lead_id = $1 ORDER BY sequence_step DESC LIMIT 1),
     outreach_draft = (SELECT body FROM outreach_steps WHERE intake_lead_id = $1 ORDER BY sequence_step DESC LIMIT 1)
   WHERE id = $1
   ```
   (Use Supabase client, not raw SQL — the above is illustrative of the logic)
4. Return 200 with `{ id, intake_lead_id, sequence_step, status }`

**Acceptance:**
- POST with valid payload upserts step and returns 200
- Duplicate POST (same `intake_lead_id` + `sequence_step`) updates existing row
- Parent `intake_leads` rollup fields are updated after upsert
- POST with `sequence_step: 0` or `sequence_step: 8` returns 400
- POST with non-existent `intake_lead_id` returns 404

---

### SB-5: Edge Function — `send-outreach`

**Wave:** 3
**Depends on:** SB-1 (migration), SB-4 (upsert pattern reference)
**Branch:** `feat/op-mvp-sb5-send-outreach`
**Files:**
- `supabase/functions/send-outreach/index.ts` (NEW)

**Scope:**

New edge function. JWT auth (same pattern as `promote-intake-lead/index.ts`).

Request validation:
- `outreach_step_id` required (valid integer)

Logic:
1. Auth: create per-request Supabase client from Authorization header (copy from `promote-intake-lead` lines 97-124)
2. Read step from `outreach_steps` by ID
3. Read parent lead from `intake_leads` by `step.intake_lead_id`
4. Validate:
   - Step status must be `ai_reviewed` or `approved` (return 400 if not)
   - Step channel must be `email` (return 400 if not — can't "send" linkedin/phone)
   - Lead must have a non-null, non-empty email (return 400 if not)
5. Send via Postmark:
   ```
   POST https://api.postmarkapp.com/email
   Headers: { "X-Postmark-Server-Token": POSTMARK_SERVER_TOKEN, "Content-Type": "application/json" }
   Body: {
     "From": POSTMARK_FROM_ADDRESS,
     "To": lead.email,
     "Subject": step.subject,
     "HtmlBody": step.body (wrap in basic HTML if plain text),
     "TextBody": step.body (plain text version),
     "MessageStream": POSTMARK_OUTREACH_STREAM,
     "ReplyTo": POSTMARK_FROM_ADDRESS
   }
   ```
6. **CRITICAL ORDER — two separate operations:**
   - FIRST: `UPDATE outreach_steps SET provider_message_id = postmarkResponse.MessageID WHERE id = step.id`
   - SECOND: `UPDATE outreach_steps SET status = 'sent', sent_at = NOW() WHERE id = step.id`
7. Update rollup fields on parent lead (same logic as SB-4)
8. If lead status was `uncontacted`: `UPDATE intake_leads SET status = 'in-sequence' WHERE id = lead.id`
9. On Postmark API error (non-2xx): set step status → `failed`, log error, return 502

Env vars needed (Supabase secrets): `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_ADDRESS`, `POSTMARK_OUTREACH_STREAM`

**Acceptance:**
- POST with valid JWT + `outreach_step_id` pointing to `ai_reviewed` email step → sends via Postmark, stores message_id, updates status to `sent`
- POST with step in `sent` status returns 400
- POST with `linkedin` channel step returns 400
- POST with lead that has no email returns 400
- On Postmark failure: step status set to `failed`, no status advancement
- `provider_message_id` is stored before `status` is updated to `sent`

---

### SB-6: Frontend — Outreach Timeline + Approval UI

**Wave:** 3
**Depends on:** SB-2 (types + fakerest data)
**Branch:** `feat/op-mvp-sb6-frontend-timeline`
**Files:**
- `src/components/atomic-crm/intake/IntakeExpandedRow.tsx` (REWRITE)
- `src/components/atomic-crm/intake/IntakeList.tsx` (EDIT)

**Scope:**

**`IntakeExpandedRow.tsx` rewrite:**

Replace the current 3-column grid (enrichment + draft + cadence) with a 2-column layout:

Column 1 (1/3 width): AI Enrichment Summary — keep the existing card exactly as-is.

Column 2 (2/3 width): Outreach Timeline — vertical timeline of all `outreach_steps` for this lead.

Timeline implementation:
- Fetch via `useGetList('outreach_steps', { filter: { intake_lead_id: record.id }, sort: { field: 'sequence_step', order: 'ASC' } })`
- Render as a vertical list of step cards
- Each card shows:
  - Left: step number in a circle with channel icon (use text: "Email" / "LinkedIn" / "Phone")
  - Middle: subject (bold) + body preview (truncated to 2 lines) + status badge
  - Right: date (sent_at or created_at) + action button
- Status badges use existing shadcn Badge component with variants:
  - `drafting` → secondary/gray
  - `ai_reviewed` → default/blue (this is the actionable state)
  - `action_needed` → warning/amber
  - `approved` → default/blue
  - `sent` → success/green
  - `completed` → success/green
  - `failed` → destructive/red
  - `replied` → purple/custom
- Click on a step card to expand it — show full subject + body in editable textarea (only if status is `drafting` or `ai_reviewed`)
- "Approve & Send" button on `ai_reviewed` email steps — opens AlertDialog confirmation, then calls `send-outreach` edge function via `fetch` to the Supabase function URL
- "Mark Complete" button on `action_needed` steps — calls `upsert-outreach-step` to set status `completed`
- For `replied` steps: show reply body below the original content
- Empty state: show a muted message "No outreach steps yet."
- Loading state: show a simple spinner or skeleton

Use existing imports: `useGetList` from `ra-core`, `Button` from `@/components/ui/button`, `cn` from `@/lib/utils`, `Badge` from `@/components/ui/badge`

**`IntakeList.tsx` updates:**
- Add `current_draft_status` as a Datagrid column with badge rendering (map status to badge variant colors, same as timeline)
- Near the StatusTabBar, add a count badge: "N ready for review" — count leads where `current_draft_status === 'ai_reviewed'` from the existing `useGetList` data
- No new data fetching — derive from the existing intake_leads list data

**Acceptance:**
- `npx tsc --noEmit` passes with 0 new errors
- Expanding an intake lead row shows the outreach timeline with step cards
- `ai_reviewed` steps show "Approve & Send" button
- `action_needed` steps show "Mark Complete" button
- Step cards expand to show full content
- `IntakeList` shows `current_draft_status` badges
- Empty state renders for leads with no steps
- Demo mode displays timeline with generated fake data
