# Historical Migration — controlled importer

One-time tool for importing Leif's pre-CRM historical Notion/Acuity/Stripe
data into Atomic CRM, against the human-reviewed, frozen Phase 3
reconciliation manifest. See `MEMORY.md`'s `real-client-data-migration-status`
entry for the full narrative.

## Files

- `plan.mjs` — pure planning/dry-run logic. No I/O, no DB, no network. Takes
  the frozen staging manifest + human rulings as plain data and computes the
  exact operations deterministically.
- `plan.test.mjs` — synthetic-fixture tests (`node --test
  scripts/historical-import/plan.test.mjs`). No real client data.
- `rulings.example.json` — **synthetic shape reference only.** Copy it to
  `data/rulings.json` (gitignored) and fill in the real, human-approved
  rulings before running for real.

## Privacy — read before touching this directory

**Real client data (the staging manifest, the real rulings, any Notion/
Acuity/Stripe pull) must never be committed.** `scripts/historical-import/data/`
is gitignored (`.gitignore`) for exactly this reason — put real input files
there, never alongside the tracked `.mjs`/`.example.json` files. Verify with
`git check-ignore -v scripts/historical-import/data/<file>` before trusting
it. Never paste a real name/email/Stripe id into `plan.mjs`, a test, or a
commit message.

## Running the dry-run

```bash
node --input-type=module -e "
import { summarizePlan, diffAgainstFrozenManifest } from './scripts/historical-import/plan.mjs';
import fs from 'node:fs';
const staging = JSON.parse(fs.readFileSync('scripts/historical-import/data/staging.json', 'utf8'));
const rulings = JSON.parse(fs.readFileSync('scripts/historical-import/data/rulings.json', 'utf8'));
const summary = summarizePlan(staging.records, rulings);
console.log(JSON.stringify(summary, null, 2));
console.log('DISCREPANCIES:', JSON.stringify(diffAgainstFrozenManifest(summary.contacts, { CREATE: 208, UPDATE: 11, SKIP: 77, NEEDS_LEIF: 0 })));
"
```

Dry-run performs zero writes anywhere — it only reads the two local JSON
files above.

## The write path (not yet built beyond the proven mechanism)

The actual DB-writing half is not yet implemented as committed code. What
*is* proven (see the Phase 4 checkpoint reports) is the underlying
mechanism it will use:

- `set_historical_migration_mode(boolean)` — a `SECURITY DEFINER` function,
  `service_role`-only, that enables/disables `app.migration_mode` for the
  *current transaction only* (`set_config(..., true)` — resets on
  COMMIT/ROLLBACK automatically).
- With that mode on, `handle_deal_won()`, `set_deal_stage_entered_at()`,
  and `record_enrollment_status_event()` skip their live-only behavior
  (auto-onboarding, `now()`-stamped timestamps) so the writer can insert
  truthful historical rows directly.
- `historical_import_records` — idempotency + audit ledger. Before writing
  any entity, look up `(entity_table, source_key)`; if a row exists, compare
  its `entity_id` to the one about to be written — an exact match is a safe
  no-op (already imported), a mismatch is a genuine conflict and must be
  raised, never silently discarded via a bare `ON CONFLICT DO NOTHING`.

## Safety invariants (do not weaken these when finishing the writer)

- Never write through this path without wrapping in `set_historical_migration_mode(true)` / `... (false)` for the exact statements that need it.
- Never derive a Contact/Deal identity by fuzzy-matching at write time — identity resolution already happened in Phase 3; the writer consumes explicit frozen keys only.
- Before any UPDATE to an existing legitimate CRM record, compare the staged historical value against the current one; never silently overwrite something newer/conflicting.
- `deals.offer_id` and `client_sessions.offer_id` are `NOT NULL` — never fabricate an Offer to force a historical record into a structured shape it doesn't truthfully support (see `ccContactOnly` in `plan.mjs`).
- Historical installment counts derived from a legacy single-phase Stripe Schedule's dates/price cadence are `DERIVED HISTORICAL FACT` — never write them as if Stripe itself stated them.
