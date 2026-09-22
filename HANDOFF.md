# HANDOFF — where Atomic CRM is right now

**Current state, not history.** [MEMORY.md](MEMORY.md) is the durable knowledge
ledger — why each sealed slice decided what it decided. This file is the other
half: what is true today, where the rules live in code, and what is waiting.

Written 2026-09-20 at `451f0af0`, updated 2026-09-21 at `7bb47194`. **The repository, the database and production
are the authority. Where this prose disagrees with them, they win — say so
rather than quietly picking one.**

---

## 1. Principles

**RIGOR #1.** Prove it, or say you have not.

**ATOMIC HANDLES CERTAINTY. LEIF HANDLES AMBIGUITY.**

- Deterministic automation may act on its own. Exact provider identity, exact
  normalized email, arithmetic on stored facts — these are certainties, and the
  CRM is allowed to write them.
- Genuine ambiguity escalates. Two defensible readings of the same evidence is
  Leif's decision, not a default. Daniel Alexander's $500 was either a deposit
  or a separate payment, and the CRM refused both readings until he said.
- **Never fabricate business truth to clean up the UI.** A warning that is
  materially true stays visible. "Mark reviewed" may not silence a missing fact.
  An absent value is recorded as absent — four Contacts hold `first_seen = NULL`
  because nothing truthful is known, and that is the correct state.
- **Tasks are projections, not truth.** A Task points at a business fact and
  says what needs doing. Deleting one must never delete the condition; the
  condition recreates it while it still holds. And the converse, learned the
  hard way: **a fact is not a Task.** A Task means Leif has something to do, so
  an appointment that merely exists is not one — see §4's accepted task
  semantics.

---

## 2. Engineering framework

Rigor first, without perfection paralysis.

### The acceptance loop — the governing rule

**A feature is not complete until Leif has actually used it.** Every meaningful
feature runs this loop, in order:

1. **Build.**
2. **Automated proof** — unit, integration, contract.
3. **Deploy to a usable environment.**
4. **LEIF HUMAN TRY-RUN, while the feature is still OPEN.**
5. **Repair** anything confusing, incorrect or operationally incoherent.
6. **Repeat the try-run** as needed.
7. **Only then ACCEPT / SEAL.**
8. **Post-deploy smoke verifies deployment identity and critical invariants.**
   It is *not* the first time product behavior is discovered.

> **No large batch of hidden work between human acceptance points.**

A feature is **not** complete merely because unit and integration tests pass,
migrations replay, or Claude reports internal consistency. Those establish that
the code does what it was written to do. They cannot establish that what it was
written to do is what Leif needs — and for important workflows, that gap is
where the real defects live.

This rule was written after the Acuity booking regression (§5), where every
test was green, every migration replayed, the reports were internally
consistent, and four real bookings still reached the Dashboard asking what had
happened on calls five weeks away. **One session of ordinary human use found
three distinct defects** — the false attendance question, the matching Task
that would not close, and the appointment Tasks cluttering Later — **and no
automated check in the repository was positioned to see any of them.**

The corollary: keep the batch between acceptance points small. A workflow Leif
has not exercised is not evidence of anything, however much of it there is.

### Supporting rules

- A substantial feature closes by proving a real operational workflow end to
  end, not by counting unit tests.
- **Every critical schema migration must identify and exercise ALL supported
  production write paths touching the changed schema.** This rule exists
  because of §5's `scheduled_on` regression.
- **A rule hand-mirrored into a second runtime will drift, and nothing will
  tell you.** The Acuity Edge Function runs on Deno and cannot import from
  `src/`, so its copy of a task type silently outlived the migration that split
  it. Where a rule must exist twice, the database holds the authority and
  reconciles both directions on a schedule — see §4's Tasks section.
- Critical workflows get contract / end-to-end coverage.
- Production errors should surface on their own rather than waiting for Leif to
  trip over them.
- High-risk operations get a small post-deploy canary or smoke.
- Truth-breaking and workflow defects are fixed immediately. Cosmetic UX is
  bundled into small cleanup passes.
- After Gmail and Instagram, run a dedicated maturity/stabilization sprint
  before any larger feature.

**Intended sequence:** (1) finish current small workflow UX loose ends →
(2) ~~tight reliability layer~~ **SEALED 2026-09-21, see §8** →
(3) **Capacity + Waitlist** → (4) Gmail → (5) Gmail production acceptance →
(6) Instagram/Meta → (7) Instagram production acceptance → (8) accumulated UX +
maturity sprint → (9) Openings Planner.

Capacity + Waitlist moved ahead of Gmail deliberately: Gmail will want to say
something true about openings, and neither the Living Example capacity maths
nor the waitlist is operational yet. Build the truth before the thing that
announces it.

---

## 3. Production state

| | |
|---|---|
| repo | `git@github.com:leifariel/leif-crm-atomic.git`, branch `main` |
| HEAD | `7bb47194` (== `origin/main`) |
| frontend | Vercel project `leif-ariel/leif-crm` → **crm.leifariel.com** |
| database | Supabase `xlyywsguftyvomeretju` ("leif-crm", us-west-2) |
| migrations | **132** local files (3 pending on MAIN) |
| boundary | **108 deterministic + 24 MAIN-only** (`node scripts/historical-import/replayBoundary.mjs` exits 0) |
| CI | `✅ Check` **green** on the real runner at `7bb47194` — Build, Typecheck, lint, unit (1932 tests / 239 files across every Vitest project) and `e2e-test` all pass |

**Two independent deploy paths, and confusing them costs a slice.** Vercel
builds the frontend on push to `main`. **Supabase Edge Functions deploy from
the GitHub Actions `deploy-supabase` job** (`npx supabase functions deploy`) —
*not* from Vercel.

**Prove a deploy by comparison, not by inference.** Both halves can be shown
exactly, and grepping for a hopeful string is the weaker version of each:

- *Frontend.* Fetch `/sw.js` from the live host — its precache manifest lists
  every asset — then fetch those chunks and diff them against a local
  `npm run build` of the deployed commit. They are byte-identical **except**
  the `BUILD_ID` timestamp `vite.config.ts` stamps in, and the content hashes
  that one timestamp cascades into. Normalise those two values and the
  comparison is exact. (Kanban/Decision/Ghosted code lives in a lazily-loaded
  `DealList-*.js` chunk, so absence from the entry bundle is code-splitting,
  not a failed deploy.)
- *Edge Functions.* `npx supabase functions list --project-ref <ref>` gives the
  live version and `updated_at`; an `entrypoint_path` under
  `/home/runner/work/...` proves it came from a GitHub Actions runner rather
  than someone's laptop. Then `npx supabase functions download <slug>
  --project-ref <ref>` retrieves the **deployed source**, which you diff
  against the repo. Only the modules a function imports are bundled, so
  unrelated `_shared/` files missing from the download are not drift.

### Integrity baseline (read-only, 2026-09-20 at `451f0af0`)

These must all be **0**. They are the invariants; the counts below them drift
as Leif works.

`broken_contact_fks` · `app_opportunity_mismatches` ·
`duplicate_structured_identities` · `duplicate_paid_intents` ·
`duplicate_plan_objects` · `task_completion_disagreements` ·
`enrollments_missing_onboarding` · `active_stage_contradictions` ·
`scheduled_on_disagreements` · `tasks_with_iso_dates` ·
`backfill_prompt_eligible` · `stranded_unmatched_calls`

Three joined them with the Acuity seal, and they are the ones that would have
caught that regression:

`wrong_question_tasks` — no open sales-call Task asks a question its own
booking does not pose · `open_appointment_tasks` — no Task exists merely
because an appointment does · `future_attendance_tasks` — nothing asks what
happened on a call that has not happened.

At time of writing: 310 Contacts · 161 Applications / 832 responses ·
**157 Opportunities** (44 active: 34 call_booked, 9 decision, 1
application_received) · 32 Won · 33 Enrollments (25 active) · **200 Sales
Calls** · **5 open Tasks** (1 follow-up, 4 onboarding) · 127 Stripe relations
(plan objects + customers) · 0 external identities · **$71,648.00** collected ·
4 open payment reviews · **28 unmatched Acuity calls, all historical, none in
the future, none awaiting triage**.

The Opportunity count rose by three and open Tasks fell from twelve during
Leif's try-run of the matching workflow — that is the workflow working, not
drift.

---

## 4. Domain invariants, and where they live

### Contact / identity
A Contact is a **person**, separate from Opportunity, Application, Enrollment
and Task. External identities are provider-neutral:
`contact_external_identities` with an **immutable `external_user_id`** (NOT
NULL) as identity, a **mutable `display_identifier`** (nullable) as search
metadata only, and provider-account scoping via two partial unique indexes.
**A handle is never identity** — a rename keeps one person; the same handle on
two provider accounts stays two people.

Matching is deterministic only: exact provider identity, or an exact normalized
email naming exactly **one** Contact. `record_external_identity()` answers
known / linked_by_email / ambiguous / unresolved, and never merges, never
matches on a name or handle, never creates an Opportunity.

`merge_contacts_safely()` repoints ten child tables explicitly and **never
deletes** — the source keeps its row plus `merged_into_contact_id`. It refuses
while `contact_merge_conflicts()` reports anything unacknowledged, and combines
no Opportunity, Enrollment or payment.

**Contact deletion and merge remain disabled in the app** —
[contactSafety.ts](src/components/atomic-crm/contacts/contactSafety.ts),
`CONTACT_DELETE_ENABLED` / `CONTACT_MERGE_ENABLED` both `false`.

Display name: [contactDisplayName.ts](src/components/atomic-crm/contacts/contactDisplayName.ts)
— returns `null` rather than inventing a name (33 people have only one name).

### Applications
One Application links to an Opportunity **only when deterministic**. Exact
question wording and exact answer are preserved per response
(`application_responses`, 832 rows, immutable). Review queue is
`applications_awaiting_review`; the SLA is **3 calendar days in America/Denver**
— [applicationReviewSla.ts](src/components/atomic-crm/applications/applicationReviewSla.ts).
**99 historical pending Applications are not a review backlog** — only
genuinely actionable ones surface.

### Opportunities / sales
**One Opportunity per sales attempt.** Active means `archived_at IS NULL AND
stage <> 'won' AND outcome IS NULL` — [dealActivity.ts](src/components/atomic-crm/deals/dealActivity.ts).
Stage order: interested → application_received → approved → call_booked →
decision → won. **Later authoritative human truth supersedes earlier process
facts**, never the reverse.

### Sales calls
- **A legitimate linked Sales Call proves the Opportunity reached
  `call_booked`** — booked, completed, attended, missed or cancelled all
  require that somebody booked it first. A missing stage-event row is not
  evidence the stage never happened.
  [callProvesCallBooked.ts](src/components/atomic-crm/deals/callProvesCallBooked.ts)
  states this and refuses to drag a Decision/Won/terminal Opportunity backwards.
- **Cancellation and no-show never demote to `approved`.** They are factual
  call states. The open question ("what next?") is *derived* —
  [needsNextSalesStep.ts](src/components/atomic-crm/deals/needsNextSalesStep.ts)
  — from active + latest call cancelled/no-show + nothing booked since, so it
  cannot be deleted, only resolved.
- **Exiting an Opportunity is always an explicit human action.**
- **Historical backfill:** a past-dated call is created with
  `resolution_requested_at` set, which produces the single "what happened on
  this call?" question rather than inventing attendance. A future-dated call
  keeps ordinary booked semantics.
  [bookSalesCall.ts](src/components/atomic-crm/sales-calls/bookSalesCall.ts).
- **`scheduled_on` is derived centrally**, in America/Denver, by trigger
  `derive_sales_call_scheduled_on` (migration `20260920020000`). Callers state
  the instant; the calendar day is not their job.
- **All call-creation write paths must be exercised after any schema change** —
  the app (`bookSalesCall.ts`) and the Acuity webhook
  (`supabase/functions/acuity_webhook/acuitySalesCallHandlers.ts`).
- **A booking creates no Task for itself**, and an unattributable one asks
  *whose it is*, never *what happened*. See the Tasks section below — that
  distinction is the accepted semantics, not an implementation detail.

### Decision column
Ordering, one canonical comparator —
[pipelineOrdering.ts](src/components/atomic-crm/deals/pipelineOrdering.ts):

1. **overdue** follow-up — oldest due first
2. **due today**
3. **no follow-up scheduled** — longest in Decision first
4. **upcoming** follow-up — soonest first

Band 3 above band 4 is deliberate: a future follow-up means the attempt already
has a next action; none means nobody has chosen one. Subtitle reads **"Needs
action first"**. Only `deals.follow_up_date` is read — the follow-up Task
projects it, so no Task can influence order. Days compare in America/Denver.

**Ghosted is explicit and distinct from No.** Its own button, its own dialog,
never inferred from elapsed time or a missed call. Stores
`outcome='lost'` + `exit_reason='ghosted'` + `prospect_decision='ghosted'` plus
a Contact tag — [pipelineExit.ts](src/components/atomic-crm/deals/pipelineExit.ts),
[removeFromPipeline.ts](src/components/atomic-crm/deals/removeFromPipeline.ts).
No's reason list is narrowed to what a prospect can actually say.

### Tasks — ACCEPTED SEMANTICS (sealed 2026-09-20, human try-run passed)

**A Task means Leif has something to do.** That sentence settles every question
this section used to get wrong.

| concept | what it is |
|---|---|
| **Sales Call** | A **factual appointment** — scheduled or occurred. **Never itself a Task.** |
| **Matching Task** (`sales_call_needs_matching`) | *Which Opportunity owns this booking?* |
| **Attendance-resolution Task** (`resolve_sales_call`) | *What happened on this **past** call?* |
| **Follow-up Task** (`follow_up`) | An actual future action Leif promised. |

The rules, all now enforced rather than remembered:

- **A future appointment alone never appears in Tasks.** A booked call is
  carried by the Call Booked stage, `deals.sales_call_at`, the Opportunity's own
  Sales Call section and the calendar. The `sales_call` type is **retired** —
  nothing creates one, and the reconciler closes any that appear.
- **Deterministic Acuity ownership auto-links.** Exact normalized email for the
  Contact, the effective-dated appointment-type map for the Offer/Cohort, and
  exactly **one** compatible active Opportunity → attach, advance Approved →
  Call Booked, ask nothing.
- **Zero or multiple compatible Opportunities require explicit human matching.**
  Both are escalations; neither is guessed. Creating a new sales attempt from a
  booking is a human action on `/sales-calls/:id/resolve` — **Acuity never
  creates an Opportunity and never reopens a terminal one.**
- **Completing a match closes the matching Task**, by whatever route the
  Opportunity got attached — the resolution page, a backfill, a hand-written
  UPDATE. A database trigger and the reconciler both enforce it.
- **No open Task may route to a state that says it is already resolved.** That
  is an invariant violation, not a cosmetic one.
- Attendance is **never** derived from `attendance IS NULL`. It is asked only
  when somebody deliberately set `sales_calls.resolution_requested_at` **and**
  the scheduled time has passed. 109 imported calls have no attendance because
  their result was recorded as pipeline stage; they are not open questions.

**Where the rule lives.** `public.sales_call_open_question()` returns
`matching` / `attendance` / `none` and is the authority.
`public.reconcile_sales_call_tasks()` enforces it **in both directions** —
refile a Task filed under the wrong question, close one whose question has been
answered, create one whose question is open — hourly via cron
`reconcile-sales-call-tasks`, for every writer including ones that never run
app code. [salesCallTaskTypes.ts](src/components/atomic-crm/sales-calls/salesCallTaskTypes.ts)
mirrors it app-side, the way `isActiveDeal` mirrors `deal_is_active`.
Migration `20260920100000`.

It deliberately **creates no matching Task wholesale**: 28 calls have no
Opportunity, nearly all pre-CRM history, and manufacturing 28 alerts would
invent a backlog — the same trap `20260919050000` avoided with Applications.
A matching Task is created by the flow that notices the ambiguity: a live
booking arriving unattributable.

Other live types: `review_application`, `onboarding_item`, `offboarding_item`,
`resolve_client_session_cadence`, `other`. Retired and readable but never
created: `sales_call`, `nurture_follow_up`, `sales_call_cancelled`,
`sales_call_no_show`, `check_payment`. The complete inventory — what each row
asks, what closes it, where it routes, what verb it offers — is
[needsAttentionInventory.ts](src/components/atomic-crm/tasks/needsAttentionInventory.ts),
and the Dashboard's words come from it, so a row and its destination cannot
disagree.

### Enrollment
`onboarding_tracking` is **`tracked`** or **`legacy_untracked`** — an empty
checklist used to mean three different things and no longer does. Lifecycle:
onboarding → active → offboarding → completed. **Won is a sales fact and is
never gated on payment.**

### Payment / Stripe
Payment is a separate dimension from sales truth.
[paymentTruth.ts](src/components/atomic-crm/deals/paymentTruth.ts) is the single
assessment; both the Opportunity panel and the Client page render the same
`PaymentPanel`, so they cannot disagree.

- `collected` = money actually received. `remaining` = agreed − collected.
- An agreed total is written only when **provable**: `owner_confirmed` (Leif
  said it) or `stripe_derived` (a finite schedule proves it).
  [stripeAgreedTerms.ts](supabase/functions/stripe_webhook/stripeAgreedTerms.ts)
  derives from finite phases and **refuses** an open-ended plan, a phase with no
  end, a multiplied interval, an unreadable price, multiple line items, or **any
  money collected outside the plan**.
- **`owner_confirmed` is never overwritten by derivation** — it only ever fills
  a gap.
- Payment review: [paymentReview.ts](src/components/atomic-crm/deals/paymentReview.ts)
  decides whether a review can be *acknowledged* (a human raised it and terms
  are known) or *needs the missing fact* (then the panel asks for the agreed
  total instead of offering a button that cannot work).
- Sync Stripe is idempotent and reports each dimension separately — plan
  linked / agreed total from Stripe / payments recorded / plan details updated
  / already up to date.

### Migrations
Deterministic by default; a migration that repairs named production records is
listed in [replay-manifest.json](supabase/migrations/replay-manifest.json).
A migration that does both must be split. Every migration asserts its own
preconditions and refuses a row that has drifted.
**MAIN-only historical repairs must never quietly become deterministic seed
data.** The clean room replays the deterministic chain from empty and must
match MAIN's structure exactly (last proof: 2457 structural facts each side,
0 drift).

A migration's verification block runs as the **migration role**, which has no
DML on business tables — run probes under `set local role authenticated` inside
a subtransaction that raises to roll back. PL/pgSQL variables survive the
rollback; rows do not.

---

## 5. Recently closed defects — the invariant, not the story

| defect | what prevents recurrence |
|---|---|
| Cancel/no-show demoted `call_booked` → `approved` | Both DB functions and both app mirrors leave the stage alone; migration `20260919160000` asserts **no function** may combine `set stage = 'approved'` with a no-show/cancellation. `callBookedIsNotUndone.test.ts`. |
| Remove-from-pipeline returned 403 and **logged Leif out** | `record_deal_outcome_event()` is SECURITY DEFINER (`20260919180000`); `deal_outcome_events` still grants no client INSERT. [isSessionFailure.ts](src/components/atomic-crm/providers/supabase/isSessionFailure.ts) stops treating a 403 carrying a **5-char SQLSTATE** as a dead session. `pipelineExitRoutes.test.ts` covers all ten exit reasons. |
| Decision ordering looked arbitrary | One banded comparator + `pipelineOrdering.test.ts`. The real cause was that 8 of 9 rows had no follow-up date — a data shape, not a comparator bug. |
| Ghosted conflated with No | Separate button, separate dialog, distinct stored values. `GhostedDecision.test.tsx`. |
| Stripe plan linked but agreed total never derived; "Mark reviewed" looped forever | Derivation in the reconciler + `reviewResolution()`: a review about a **missing fact** is never acknowledgeable. `stripeAgreedTerms.test.ts`, `paymentReview.test.ts`, `stripeLaterSubscription.test.ts`. |
| Dax's historical call — "Server communication error" | See next row; plus past-dated calls now set `resolution_requested_at`. `logHistoricalSalesCall.test.ts`. |
| Aurelie: `approved` while holding a `cancelled` call | `callProvesCallBooked.ts` + an assertion in `20260920030000` that **no active Opportunity** contradicts its own call. |
| **`scheduled_on` NOT NULL broke every Sales Call INSERT for three days** | Column is now **derived** by trigger, not a payload obligation. FakeRest does not enforce NOT NULL, so the entire app suite passed while production rejected every insert — this is the origin of §2's write-path rule. |
| **Four future bookings asked "What happened on this call?", and matching them left the Task open forever** | The Acuity webhook kept the `resolve_sales_call` literal from *before* `20260918030000` split the type in two, so an unattributable booking became an attendance question about a call weeks away — and both closers key on the matching type, so the Task survived being answered and its own destination then said "This call is already resolved." Fixed at the source *and* made unrepeatable: `sales_call_open_question()` + a two-directional `reconcile_sales_call_tasks()` (`20260920100000`). Three new invariants in §3 would each have caught it. `aBookingIsNotAQuestion.test.ts` (21), plus ingestion-contract tests for the deterministic, ambiguous, terminal-prior and future-call shapes. **This is the defect that produced §2's acceptance loop.** |
| **A rebuilt database was more permissive than MAIN** | MAIN's privilege posture had been applied by hand and never written down: 23 table over-grants across 12 relations, 23 sequences, 5 privileged functions. Now transcribed into the deterministic chain (`20260919175000`, `20260920120000`) and asserted from the outside by [securityPosture.spec.ts](e2e/securityPosture.spec.ts), which asks what a signed-in client and `anon` can actually do by **trying it**. |
| **Writing a Contact required the right to read identity rows** | `clamp_contact_last_seen()` read `contact_external_identities` as the caller while repairing a future `last_seen`, and `service_role` cannot — so an Edge Function creating a first-time caller's Contact could fail with 42501, intermittently. The trigger is SECURITY DEFINER with a pinned `search_path` (`20260920130000`); nothing else was elevated. |
| **Deleting a round erased its waiting list** | `waitlist_entries.cohort_id` was `ON DELETE CASCADE`, so a round whose only link was its waiting list deleted cleanly and took every membership with it — fifty-one for January 2027 — with one application code path the only thing in the way. The audit that followed found five more of the same class on the Programme itself, all reachable only when no Opportunity exists (an Opportunity already refused through `deals.offer_id`): `waitlist_entries.offer_id`, `cohorts.offer_id`, `client_sessions.offer_id` (`enrollment_id` is nullable, so a session booked by somebody who never enrolled has nothing else holding it up), and the two scholarship tables. All six are `NO ACTION` as of `20260921180000`, which keeps `ON UPDATE CASCADE` — only the destruction was wrong — and ends by asserting the **exact** remaining set, so a new table hung off `offers` or `cohorts` fails the chain rather than being found by somebody losing rows. Four cascades are allowed and named: the price list, two configuration templates, and the Google Calendar mirror. Defence in depth is deliberate: the database refuses whoever is asking, the app says what is linked and offers Archive. `programDeleteSafety.ts` therefore has to ask about everything the database refuses — a shorter list means a confirmation dialog followed by a raw 23503. |
| **The dashboard read "[object Object] openings"** | Openings became a ledger *answer* — `{status:"known"…}` or `{status:"unknown", reason:"calendar_too_short"}` — and both program cards went on interpolating the object into `%{count} openings`. One [OpeningsLine](src/components/atomic-crm/capacity/OpeningsLine.tsx) now renders the answer for the dashboard card and the hub card alike, and its typed prop makes a raw number unpassable. The `unknown` case is the reason the shape changed and must never read as zero: a practice whose Year Tracking calendar cannot seat a new client's twelve weeks has no openings *count*. Asserted on both surfaces, including "not `[object Object]`". |
| **A new group round showed a duration unit it was not using** | `SelectInput defaultValue="weeks"` filled the dropdown without filling the form, so a round typed as "8" derived no end date and would have been refused on save by `cohorts_duration_is_complete_check` — naming a field Leif could see was already set. [CohortScheduleInputs](src/components/atomic-crm/cohorts/CohortScheduleInputs.tsx) now owns the number/unit pair itself, including the detail that a cleared `NumberInput` reports **0**, not empty (`?? 0`), which `cohorts_duration_value_check` also refuses. |
| **"Edit program" on a 1:1 card landed on Not Found** | The mobile shell registered no `offers` resource at all, so the new card menu routed to a dead path — the desktop shell had one and hid it. `<Resource name="offers" show edit />` now mirrors the `cohorts` precedent (reached from a hub card, never a nav item or a list route). `ProgramForms.test.tsx` opens the 1:1 edit form and reads its values. |
| **The Add Task dialog called people by their job title** | `useGetRecordRepresentation("contacts")` fell through ra-core's chain (`name → title → label → reference → #id`) before the resource registry filled in, said *"Create task for CTO"*, and never corrected itself because the representation is captured in a `useCallback`. [AddTask](src/components/atomic-crm/tasks/AddTask.tsx) now names the Contact it already holds via `contactDisplayName`, and says plain "Create task" rather than inventing one. [AddTaskTitleName.test.tsx](src/components/atomic-crm/tasks/AddTaskTitleName.test.tsx) mounts it with **no resource definitions registered at all** — the state the old code could not survive, and the state the ordinary `<CRM>` harness could never reproduce. |

---

### Sealed by human try-run

**Acuity booking / matching workflow — ACCEPTED / SEALED 2026-09-20** at
`451f0af0`. Leif exercised the real production path after deploy:

- **Celia → Opportunity 267**, **Samantha Herold → 268**, **Anna Howard → 269**
  — three unattributable bookings matched through
  `/sales-calls/:id/resolve` in under fifteen seconds, each creating the
  Opportunity the appointment type authoritatively determines, each landing at
  Call Booked with `sales_call_at` set, **each closing its own matching Task**.
- **Dax Kara's attendance question resolved** — call 327 `completed` /
  `attended`, Task 207 closed. The other half of the pair, exercised too.
- Mihaela Petrova's 266/331 from the repair itself.

Afterwards: 0 wrong-question Tasks, 0 appointment Tasks, 0 future attendance
Tasks, 200 Sales Calls unchanged. **The loop that could not close now closes,
proven by use rather than by assertion.**

**Reliability Pass 1 — ACCEPTED / SEALED 2026-09-21** at `7bb47194`. Not a
try-run: this pass built no product surface for Leif to exercise, so acceptance
rested on the evidence instead — the real GitHub runner green on the pushed
commit, zero privilege divergences between MAIN and a database rebuilt from
empty, and RED/GREEN proofs against real Postgres for both historical failure
classes. **Full record, and the tooling debt carried forward, in §8.**

---

## 6. Waiting on Leif — do not guess these

**Historical payment totals** (each has collected money and no agreed figure;
the panel offers "Record agreed terms"):
Kerri Fukui (opp 147) · Samantha Putkunz (166) · Sarah McNurlin (181) ·
Nicole Fielding (183).

**Possible duplicate Contact pairs**, classified
`possible_duplicate_owner_review` and deliberately untouched — recorded in
[contactSafety.ts](src/components/atomic-crm/contacts/contactSafety.ts):
**106/344 · 133/364 · 142/341 · 161/349**. Each is one side with a real email
and full history against one side with a single Application and no email at
all; no shared email, no shared Stripe customer, and no address anywhere in the
orphan's answers. Nothing deterministic can settle them.

**Living Example Start Weeks — settled 2026-09-21.** A Start Week is Leif’s
decision. An Acuity booking is a usage fact that follows from it and never
establishes or moves it: someone may commit and then deliberately wait weeks
before booking, especially when Leif is booked ahead.

The CRM had this backwards. Migration `20260918180000` set
`enrollments.start_date` to each client’s earliest booked session, and 19 of
22 Living Example Enrollments carried exactly that date. Leif has now stated
all eighteen live Start Weeks (`20260921140000`), and
`enrollments.start_date_source` records the provenance of every one — a
constraint makes a start date without a source impossible.

**Four of the inferred dates were wrong**, which is the whole argument
against inferring them: Jules Litman-Cleper 24 Jun → **20 May**, Gigi George
19 Jul → 20 Jul, Mackenzie Stabler 29 Jul → **3 Aug**, Denise Cormier 30 Sep
→ **5 Oct**. Shipped on the imported values, the openings board would have
promised two December openings that do not exist.

**Still open, and it is the live question:**

- **A projected end must never retire a client.** Jules started 20 May;
  four months ran out on 20 September and Leif still considers him current.
  He keeps his slot until a real end date or a terminal status is recorded,
  and the Upcoming Openings section names him. **He is the single reason
  December shows no opening** — record his end and December becomes one.
- **The operational end-date rule is not defined yet.** `Start Week + 4
  months` is a projection, labelled “expected” and reported by month. Nothing
  in the repository may close a container on arithmetic alone.
- **No Living Example Enrollment has ever carried a real end date.**

**Two waitlist Contacts named "Terra Israd"** (Contacts 212 and 213), both
waiting on the January 2027 GYU cohort. Distinct Contact records, so the
duplicate-membership guard cannot see them as the same person. Same class as
the pairs above: merging them is a Leif decision, and merge never deletes.
All are non-blocking.

---

## 7. Deferred UX

- **Remove from pipeline should offer explicit `Cancelled` and `No-show` exit
  reasons**, near the bottom of the reason list where appropriate. Semantic
  constraint that must survive the change: **a Cancelled or No-show Sales Call
  does NOT automatically exit the Opportunity.** These would be convenient
  explicit reasons Leif may choose *afterward*, never an automatic consequence.
- Small visual polish previously deferred on purpose (Pete/Jules cadence Task
  presentation is **closed and deployed** — do not re-list it).
- The local test runner's browser mode is unstable on long serial runs; stop
  stale Vite dev servers before a full suite or Chromium gets starved and dies
  mid-run. Even with a clean machine a full app run (~1320 tests, ~12 minutes)
  will occasionally drop **one** timing-sensitive submit/save test.
  **Re-run the file in isolation before believing it** — and if it passes
  there, say so with the evidence rather than either ignoring it or calling it
  a regression.
- Six agent-harness worktree hook tests under `.claude/hooks/test/` fail on
  this machine and **pass on CI's Linux runner** (`cleanup-worktree` ×4,
  `setup-worktree` ×1, `cleanup-session` ×1). Byte-identical to `origin/main`
  and unrelated to application code, so this is local noise in a full-suite
  run, not a red CI. `cleanup-worktree.mjs` removes a fresh commit-less
  worktree the test says must be preserved, and the rest of that stateful
  file falls over behind it; suspect the git version's `worktree list
  --porcelain` output or macOS's `/var` → `/private/var` symlink. Out of
  scope until somebody chooses to look at the harness itself.

**Deferred out of the Capacity + Waitlist slice, deliberately** — the maths
and the waitlist had to become trustworthy before anything acted on them:

- Mass-select + email waitlist people; automated waitlist email sequences;
  a "spot opened" automatic send. The bulk-invite UI already exists behind
  `waitlistInviteFeature.ts` and stays hidden until Gmail delivery is real —
  a prepared batch must never be presented as though people were invited.
- Automated prioritisation of which waitlisted person gets an opening.
  **Opening availability is a fact; inviting someone is Leif's decision**, and
  nothing in this slice narrows that.
- The full Openings Planner. This slice built the arithmetic it will read.
- Gmail and Instagram integration.
- Broader application-page cleanup; the Application Received pipeline
  lightbox.
- Reliability Pass 2.

---

## 8. Reliability Pass 1 — ACCEPTED / SEALED 2026-09-21

Sealed at `7bb47194` on Leif's acceptance, after the real GitHub runner went
green. **Do not redo this work.**

**Why it existed.** Two failures of the same family reached production with a
fully green suite behind them. The 2026-09-17 `scheduled_on` migration broke
*every* Sales Call INSERT for three days, app and Acuity webhook alike, and
nothing saw it because FakeRest enforces no database constraint. Then a rule
that lived in two runtimes drifted — the Acuity handler kept a task-type
literal a migration had split — and four real bookings asked what had happened
on calls weeks away. Everything green, production wrong, both times.

### The accepted guarantees

1. **Rebuild safety.** The repository rebuilds a database from empty using
   legitimate environment prerequisites and the deterministic chain only, with
   **no hidden manual security configuration**. Proven by comparison against
   MAIN: zero privilege divergences across table grants, function EXECUTE,
   effective sequence privileges and default ACLs.
2. **Write-path safety.** A `scheduled_on`-class schema break is caught by
   real-Postgres writer contracts — every supported Sales Call writer replayed
   with its real payload under its real role — locally **and in CI**.
3. **Cross-runtime safety.** Drift between the app, the database and the
   Acuity Edge Function is caught by one checked-in set of vectors driven
   through all three arms, locally **and in CI**.
4. **Healthy code produces a green Check workflow.** That property is the
   point: a permanently red pipeline is not a reliability signal.
5. **The clean-room / e2e CI path works on the real runner.** It had been dead
   since 2026-09-06 and nobody knew.
6. **MAIN is aligned with the repository**, and production is healthy.

### Where it lives

| | |
|---|---|
| `contracts/sales-calls/writers.json` | every supported Sales Call **creation** path, machine-checked: each writer is executed and the payload it really sends is compared against what it claims |
| `contracts/sales-calls/openQuestionVectors.json` | the canonical cross-runtime vectors — one set of cases, three runtimes, one fixed instant |
| `contracts/sales-calls/creationSchemaContract.json` | the pinned creation contract, with **what fills each NOT NULL column**: writer / identity / default / trigger |
| `e2e/salesCallWriteContracts.spec.ts` | the writers replayed against real Postgres |
| `e2e/securityPosture.spec.ts` | what a signed-in client and `anon` can actually do, asked by trying it |
| `scripts/cleanRoomBootstrap.mjs` | `make start-supabase-e2e` — prerequisites, deterministic-only replay, throwaway secrets |
| `20260919175000`, `20260920120000` | MAIN's privilege posture, transcribed into the chain |
| `20260920130000` | the Contact-write fix (below) |

### What it found on the way

Reliability work is supposed to find things, and it did:

- **MAIN carried security configuration the repository did not.** An
  `ALTER DEFAULT PRIVILEGES` applied by hand, never written down. A rebuilt
  database was more permissive than production in 23 table grants across 12
  relations, 23 sequences and 5 functions — a client could have forged outcome
  history, rewritten immutable Application answers and called
  `merge_contacts_safely()` directly. MAIN was never exposed; the *rebuild*
  was, and AGENTS.md promises the rebuild.
- **Writing a Contact required the right to read identity rows.**
  `clamp_contact_last_seen()` repaired a future `last_seen` by reading
  `contact_external_identities` as the caller, and `service_role` cannot. Any
  Edge Function creating a first-time caller's Contact could fail with 42501,
  intermittently. Fixed by elevating the trigger and nothing else.
- **The Add Task dialog called people by their job title.** Before the resource
  registry filled in, ra-core's fallback chain reached `record.title` — so the
  dialog said *"Create task for CTO"*, or *"Create task for #1"*. It never
  corrected itself.
- **The e2e substrate had been unrunnable since 2026-09-06** — missing
  environment prerequisites, MAIN-only repairs replayed into an empty database,
  and Postgres pinned to 15 while MAIN runs 17.
- **A guard demanded a flag that does not exist**, making every Playwright
  command unwritable, which is part of why nobody noticed the suite was dead.
- **`commands.setTimezone` never changed the timezone** — the CDP session was
  detached immediately, reverting the override. Every test that "forced" a zone
  ran in whatever zone the machine had, so results depended on the hour.

### Carried forward as non-blocking tooling debt

- Occasional local **browser-process death** on repeated long serial runs
  (`[birpc] rpc is closed`, zero test failures) — a machine-resource artifact;
  stop the disposable stack before a full suite.
- The dedicated **Functions step is redundant** — `Unit Tests on App` already
  runs every project. `if: always()` would make it independently observable.
- **Supabase CLI is pinned nowhere**; `npx supabase` resolves whatever is
  newest. A dependency-management decision, not a blocker.
- **GitHub Pages deploy fails** in the demo/supabase jobs, and has on every run
  since well before this pass. Unrelated to CRM production.
- **If `ClientShow.tasks` times out in CI again, treat it as fresh evidence.**
  The readiness fix was reasoned from the runner's own failure output, not from
  a local reproduction — this machine runs the same 1932 tests in 125s where
  the runner takes 272s. Do not assume the current fix covers every timing
  case; go and look.

### The next slice is Capacity + Waitlist

Not started, and deliberately not designed here — Leif has not scoped it yet.
What is settled is only the ordering: it comes **before** Gmail (§2), because
Gmail will want to say something true about openings and nothing currently
computes them.

---

## 9. Gmail (after Capacity + Waitlist)

**Must be communication-provider-neutral so Instagram reuses it.** Model a
communication fact with: provider · direction · **immutable external message
id** · Contact · related Opportunity when known · `occurred_at` ·
delivery/send state · idempotency key.

Workflow that must be provable end to end:

> Application approved → **exactly one** approval email → the correct
> Offer-specific sales-call link → send result logged → **retries do not
> duplicate**.

Also: sales-call reminders, post-call follow-ups.

Constraints: communication facts are **not Tasks**. Failures must be visible.
**Gmail-specific state must not become the universal communication model.**

---

## 10. Instagram / Meta (after Gmail acceptance)

- **Immutable Meta external user id is identity.** Username/handle is mutable
  display metadata only.
- Provider-account scoping. **Tokens and secrets never stored on a Contact** —
  they belong in secure integration secret storage.
- Webhook inbox with idempotency; **Meta retries never duplicate a message or
  an action**.
- DMs are communication facts, not Tasks. **A DM alone does not create an
  Opportunity.**
- `application_link_sent` is a meaningful CRM event.
- A later Application reconciles to an existing IG identity **only when
  deterministic**; ambiguity escalates to Leif.
- No duplicate Opportunities through DM → Application → call.
- DM activity reaches Last Activity through the provider-neutral communications
  path — `contact_last_occurred_activity()` already reads
  `contact_external_identities`, so no provider-specific branch is needed.

Phase 1 scope and the researched Meta platform facts are in
[MEMORY.md](MEMORY.md) under "Instagram Intake — Approved Architecture".

---

## 11. Working protocol

**Sound.** Active work makes no sound. Stopping needs exactly one:

```bash
afplay /System/Library/Sounds/Ping.aiff    # STOPPED + NEED LEIF
afplay /System/Library/Sounds/Glass.aiff   # STOPPED + NEED NOTHING
```

Human verification always requires **Ping**. The sound plays *before* the final
report.

**Do not make Leif do technical work Claude can safely do.**

**Git: agents never push.** Leif owns `git push`. Agents commit locally and
hand over the exact command.

---

## FRESH SESSION STARTUP

The next Claude session should, in order:

1. **Read this handoff**, then [MEMORY.md](MEMORY.md) for any slice it touches.
2. `git status` and `git log --oneline -10`.
3. `node scripts/historical-import/replayBoundary.mjs` — confirm the migration
   boundary and that local file count matches the remote version count.
4. Check the deployed state: `npx vercel ls`, and prove both halves by the
   comparison method in §3 — not by grepping for a hopeful string.
5. Read the canonical files named in §4 for whatever the next task touches —
   not the whole tree.
6. Run a small **read-only** integrity baseline and compare against §3's
   zeros.
7. **Treat the repository, the database and production as stronger evidence
   than this prose.**
8. **Surface disagreements rather than silently resolving them.**
9. **STOP before implementation and report readiness.**

And before calling anything finished, re-read §2's acceptance loop. **Leif's
try-run is a step in the work, not a formality after it** — schedule it while
the feature is still open to change, and keep the batch before it small.

Useful facts for step 6: `npx supabase db query --linked` runs SQL against
production and only returns the **last statement's** result; feed it SQL on
**stdin** (`< file.sql`), because `--file` hangs. `python3` is OOM-killed on
this machine — use `node`. Run the app suite serially
(`--maxWorkers=1 --fileParallelism=false`).

The reliability tooling from §8 is part of the baseline now:
`make start-supabase-e2e` builds a clean room from empty and
`make test-e2e-ci` runs the real-Postgres contracts against it. Stop that
stack (`make stop-e2e`) before running the
full browser suite — ten containers and a serial browser run compete for the
same machine.
