### [SEVERITY: HIGH] Old deal stages are silently misclassified after the pipeline rename
**File:** src/components/atomic-crm/deals/stages.ts
**Line:** 13
**Issue:** The branch replaces the 6-stage pipeline with 5 new stage IDs, but there is no data backfill for existing deals that still store `lead`, `qualified`, `audit-scheduled`, or `proposal-sent`. This code silently pushes any unknown stage into the first configured column (`discovery`). At the same time, widgets like `DealsChart` and `PipelineSummary` only understand the new IDs, so old-stage deals will be misplaced on the board and undercounted or zero-weighted on the dashboard instead of being migrated cleanly.
**Fix:** Add a SQL/data migration that remaps legacy stage values to the new stage IDs before shipping the UI change, and remove this silent fallback once the data is migrated so unknown stages fail fast.

### [SEVERITY: HIGH] Intake state-machine changes were not applied to the real Supabase schema
**File:** supabase/migrations/20260409100000_intake_leads.sql
**Line:** 17
**Issue:** The database still defines `intake_leads.status` as `new/contacted/responded/qualified/rejected` and does not add the new outreach tracking columns introduced in `IntakeLead` (`last_outreach_at`, `outreach_count`, `next_outreach_date`, `outreach_sequence_step`). The frontend, fake-rest generator, and expanded-row UI now assume `uncontacted/in-sequence/engaged/not-interested/unresponsive/...` plus those new fields exist. On a real Supabase backend, persisting the new statuses will violate the CHECK constraint, and selecting/updating the outreach fields will fail because the columns do not exist.
**Fix:** Add a follow-up migration that alters the status constraint/default, adds the outreach columns, updates `supabase/schemas/01_tables.sql` to match, and regenerates `src/types/supabase.ts`.

### [SEVERITY: MEDIUM] Rejected intake leads can still be promoted through the edge function
**File:** supabase/functions/promote-intake-lead/index.ts
**Line:** 214
**Issue:** The backend only blocks promotion when `status === "qualified"`. With the new state machine, `rejected` is also a terminal state, but a direct API call can still promote a rejected intake lead and create a contact/deal because the guard never checks for it. The frontend disables the button, but the business rule is not enforced server-side.
**Fix:** Enforce allowed source statuses in the edge function, or at minimum reject both `qualified` and `rejected` before any side effects occur.

### [SEVERITY: MEDIUM] Outreach cadence disappears when it is the only data on the lead
**File:** src/components/atomic-crm/intake/IntakeExpandedRow.tsx
**Line:** 36
**Issue:** `hasDetails` only considers enrichment text, outreach draft, notes, and location. If a lead has valid outreach tracking data (`outreach_sequence_step`, `last_outreach_at`, `next_outreach_date`) but none of those other fields, the component returns "No additional details yet" at line 43 and never renders the cadence tracker at line 67.
**Fix:** Include the outreach tracking fields in `hasDetails`, or move the early return below the cadence section so cadence-only records still render useful state.

### [SEVERITY: MEDIUM] Action Queue does not sort by actual urgency despite claiming to
**File:** src/components/atomic-crm/dashboard/ActionQueue.tsx
**Line:** 85
**Issue:** The comment says actions are sorted "red before amber, then by detail number descending", but the comparator only sorts by color and returns `0` for everything else. In practice, items keep insertion order, so the top 8 can hide older stale deals behind newer overdue tasks or vice versa instead of showing the most urgent actions first.
**Fix:** Store a numeric age field (`daysOverdue` / `daysStale`) on each action and sort by urgency first, then by descending age.

### [SEVERITY: LOW] Intake status translations are still keyed to the old workflow
**File:** src/components/atomic-crm/providers/commons/englishCrmMessages.ts
**Line:** 391
**Issue:** The message catalog still defines `new/contacted/responded/qualified/rejected` instead of the new `uncontacted/in-sequence/engaged/not-interested/unresponsive/qualified/rejected` set. `IntakeStatusBadge` now falls back to raw IDs for the new states, so users will see labels like `in-sequence` instead of polished translated text. The French catalog has the same drift.
**Fix:** Replace the old intake status keys in both English and French message files with the new state-machine values.

### [SEVERITY: LOW] The new dashboard widgets add branch-specific typecheck failures
**File:** src/components/atomic-crm/dashboard/ActionQueue.tsx
**Line:** 21
**Issue:** `npm run typecheck` fails on this branch with new TS6133 errors from the redesigned widgets: `ActionQueue.tsx` declares `translate` but never uses it, and `StaleDeals.tsx` imports both `useTranslate` and `DecayLevel` without using them. The repo already has unrelated `react-router-dom` issues, but these new files add additional failures directly attributable to this increment.
**Fix:** Remove the unused imports/variables, or actually wire the widget titles through translation keys so the values are used.
