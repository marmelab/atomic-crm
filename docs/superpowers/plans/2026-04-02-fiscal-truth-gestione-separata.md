# Fiscal Truth — Gestione Separata — Implementation Plan

> **For agentic workers:** implement in order. Do not collapse tasks. Continuity docs may be updated incrementally while working, but the final code-bearing commit must include all required continuity doc updates.

**Goal:** separate current-year forfettario simulation from payment-year fiscal deadlines for Gestione Separata, remove semantic drift between dashboard and Edge Function, and downgrade device-local paid tracking from fake truth to reminder-only state.

**Architecture:** two-lane fiscal model.

- lane 1: `FiscalYearEstimate` for selected tax year `Y`
- lane 2: `FiscalPaymentSchedule` for payment year `Y`, built from `estimate(Y - 1)` and `advancePlanFromEstimate(Y - 2)`
- local paid tracking remains UI-only and must not alter canonical reserve math

**Tech Stack:** React 19 + TypeScript + Vite, Vitest, Supabase Edge Functions (Deno), shared business-date helpers

**Spec:** `docs/superpowers/specs/2026-04-02-fiscal-truth-gestione-separata-design.md`

---

## Task 0: Freeze config contract and settings surface

**Files:**
- `src/components/atomic-crm/types.ts`
- `src/components/atomic-crm/root/defaultConfiguration.ts`
- `src/components/atomic-crm/root/ConfigurationContext.tsx`
- `src/components/atomic-crm/settings/FiscalSettingsSection.tsx`
- `src/components/atomic-crm/root/ConfigurationContext.test.ts`

- [ ] Add `defaultTaxProfileAtecoCode` to `FiscalConfig`.
- [ ] Set the default config value to the current primary ATECO code so existing installs keep the same fallback behavior after migration.
- [ ] Ensure `ConfigurationContext` merges and preserves the new field correctly when partial config is loaded from DB.
- [ ] Expose the fallback profile in Settings using the existing fiscal profile list, not a free-text input.
- [ ] If the selected fallback profile is removed or no longer exists, auto-reset to the first valid remaining profile; if no valid profile remains, keep the config invalid and surface an explicit warning.
- [ ] Treat invalid fallback config as a surfaced configuration problem:
  - Settings: explicit blocking/config warning
  - dashboard fiscal surface: operational warning if calculations are degraded
  - Edge Function: structured warning in logs, never a crash by default
- [ ] Add or update tests for default merging so missing config still yields a stable fallback profile.

Exit condition:
- config shape is explicit
- fallback ATECO no longer depends on array order
- settings UI can edit the fallback without raw JSON changes

---

## Task 1: Expand fiscal domain types and warning contract

**Files:**
- `src/components/atomic-crm/dashboard/fiscalModelTypes.ts`
- `src/components/atomic-crm/dashboard/useFiscalPaymentTracking.ts`
- `src/components/atomic-crm/dashboard/DashboardFiscalKpis.tsx`
- `src/components/atomic-crm/dashboard/DashboardDeadlinesCard.tsx`
- `src/components/atomic-crm/dashboard/buildFiscalDeadlineKey.ts`
- optional new pure helper for canonical fiscal rounding

- [ ] Add `unmappedCashRevenue` to the fiscal estimate model.
- [ ] Extend schedule metadata with `supportingTaxYears`, `confidence`, and `assumptions` if not already carried through runtime outputs.
- [ ] Create a single pure helper `buildFiscalDeadlineKey()` based on domain invariants: `paymentYear + date + method + sorted(component + competenceYear)`.
- [ ] Treat `buildFiscalDeadlineKey()` as the shared frontend fiscal helper, reused at least by `useFiscalPaymentTracking.ts`, `DashboardDeadlinesCard.tsx`, and any frontend fiscal task derivation path.
- [ ] Create a single pure helper `roundFiscalOutput()` and use it as the canonical boundary for final public outputs.
- [ ] Define the warning contract for `UNMAPPED_TAX_PROFILE` and map it to the existing dashboard warning surface.
- [ ] Keep warning semantics parity-friendly: same warning codes and same trigger conditions on client and server.

Exit condition:
- the public fiscal model can represent mapped, non-taxable, and unmapped cash without ambiguity
- warning semantics are explicit before refactoring the math

---

## Task 2: Refactor the dashboard tax-year estimate engine

**Files:**
- `src/components/atomic-crm/dashboard/fiscalModel.ts`
- `src/components/atomic-crm/dashboard/fiscalModel.test.ts`

- [ ] Split received payments into 3 buckets for tax year `Y`: mapped taxable, non-taxable, unmapped.
- [ ] Resolve ATECO mapping through `project.category`, then explicit fallback via `defaultTaxProfileAtecoCode`.
- [ ] If fallback resolution fails, keep the payment in `unmappedCashRevenue`, exclude it from taxable ATECO aggregation, and raise `UNMAPPED_TAX_PROFILE`.
- [ ] Normalize `payment_date` through the existing business-date helpers before year attribution.
- [ ] Clamp `taxableCashRevenuePerAteco` basis to zero before applying redditivita coefficients.
- [ ] Clamp `forfettarioIncome`, `annualInpsEstimate`, and `annualSubstituteTaxEstimate` to a minimum of zero while preserving raw cash totals.
- [ ] Apply rounding only through `roundFiscalOutput()` on final public outputs, not mid-formula.
- [ ] Preserve the existing cash-basis principle and non-taxable defaults behavior.

Required tests:
- [ ] mapped taxable payment
- [ ] non-taxable client/category exclusion
- [ ] unmapped fallback success
- [ ] invalid fallback config -> warning + `unmappedCashRevenue` + no crash
- [ ] unmapped fallback missing -> warning + `unmappedCashRevenue`
- [ ] refund-heavy year where raw cash goes negative but fiscal outputs do not
- [ ] UTC year-boundary timestamp normalized into the correct business year

Exit condition:
- `totalCashRevenue = taxableCashRevenue + nonTaxableCashRevenue + unmappedCashRevenue`
- dashboard estimate semantics match the approved spec

---

## Task 3: Rebuild the payment-year deadline schedule

**Files:**
- `src/components/atomic-crm/dashboard/fiscalDeadlines.ts`
- `src/components/atomic-crm/dashboard/fiscalModel.ts`
- `src/components/atomic-crm/dashboard/fiscalModel.test.ts`

- [ ] Extract pure helpers around `estimate(T)`, `advancePlanFromEstimate(T)`, and `schedule(Y)`.
- [ ] Build `schedule(Y)` from:
  - `estimate(Y - 1)` for residual saldo and new advances
  - `advancePlanFromEstimate(Y - 2)` for advances attributable to competence year `Y - 1`
- [ ] Keep June/November thresholds for substitute-tax advances exactly as in the spec.
- [ ] Define first-year deadline behavior as config-driven from `fiscalConfig.annoInizioAttivita`, with a defensive data-driven fallback only if config is missing or invalid.
- [ ] Keep low-priority items (`bollo`, `dichiarazione`) separate from high-priority fiscal items.
- [ ] Carry `supportingTaxYears` as sorted unique values.
- [ ] Ensure residual saldo clamps at zero if estimated prior advances exceed the estimated annual burden.

Required tests:
- [ ] first year -> no June/November schedule
- [ ] second year -> saldo exists, prior estimated advances are zero
- [ ] no acconto / single acconto / double acconto branches
- [ ] residual saldo zero-clamp
- [ ] `supportingTaxYears` stays sorted, unique, and coherent across first year / second year / normal year scenarios
- [ ] stable order and stable deadline key generation

Exit condition:
- the schedule no longer reuses year `Y` as fake `saldo anno precedente`

---

## Task 4: Rewire dashboard semantics and local tracking

**Files:**
- `src/components/atomic-crm/dashboard/DashboardFiscalKpis.tsx`
- `src/components/atomic-crm/dashboard/DashboardDeadlinesCard.tsx`
- `src/components/atomic-crm/dashboard/DashboardNetAvailabilityCard.tsx`
- `src/components/atomic-crm/dashboard/DashboardKpiCards.tsx`
- `src/components/atomic-crm/dashboard/DashboardAnnual.tsx`
- `src/components/atomic-crm/dashboard/MobileDashboard.tsx`
- `src/components/atomic-crm/dashboard/useFiscalPaymentTracking.ts`

- [ ] Show `UNMAPPED_TAX_PROFILE` warnings in the fiscal dashboard surface.
- [ ] Keep `unmappedCashRevenue` out of fiscal burden totals while exposing a visible warning that explains the fiscal picture is incomplete / still estimated.
- [ ] Keep deadline tracking local-only inside the deadlines UX.
- [ ] Explicitly reset incompatible legacy local tracking state for the old `date::label` key shape rather than attempting a best-effort migration.
- [ ] Stop subtracting local `taxesPaid` from the canonical “Quanto ti resta in tasca” reserve math.
- [ ] Reword any UI copy that currently implies accountant-grade truth instead of simulation / estimate.
- [ ] Ensure desktop and mobile consume the same fiscal props and warning semantics.
- [ ] Update `useFiscalPaymentTracking` to use `buildFiscalDeadlineKey()` rather than `date::label`.

Manual verification:
- [ ] current-year KPI cards still read as prudential simulation
- [ ] deadlines card clearly communicates estimated payment-year obligations
- [ ] mobile dashboard does not silently drift from desktop

Exit condition:
- net availability becomes a prudential selected-year indicator
- local “segnato come pagato” no longer contaminates canonical fiscal math

---

## Task 5: Align the Edge Function reminder engine

**Files:**
- `supabase/functions/_shared/fiscalDeadlineCalculation.ts`
- `supabase/functions/_shared/fiscalDeadlineCalculation.test.ts`
- `supabase/functions/fiscal_deadline_check/index.ts`

- [ ] Extend server-side `FiscalConfig` with `defaultTaxProfileAtecoCode` and `taxabilityDefaults`.
- [ ] Extend payment rows loaded by the function to include the fields needed for parity:
  - `payment_type`
  - `client_id`
  - `project_id`
  - `payment_date`
  - `status`
  - `amount`
- [ ] Rebuild server-side estimate math with the same 3 cash buckets: mapped taxable, non-taxable, unmapped.
- [ ] Normalize year attribution through the same business-date helper semantics.
- [ ] Rebuild the payment-year schedule from `Y - 1` and `Y - 2`, not from current-year cash.
- [ ] Log structured unmapped warnings with at least `code`, `taxYear`, `amount`, and `paymentYear` when available; keep reminder generation enabled as “estimated-with-warning”, never as a hard failure for schedule generation.
- [ ] Verify reminder and task copy still uses estimated wording where appropriate and does not overstate certainty for saldo/acconto text.
- [ ] Apply the same final-output rounding contract used on the dashboard via `roundFiscalOutput()` or an exact parity equivalent if runtime sharing is not practical.
- [ ] Keep task creation / notification windows unchanged unless the new semantics force a copy update.

Required tests:
- [ ] business-date year boundary
- [ ] fallback profile success
- [ ] fallback missing -> warning + unmapped amount
- [ ] invalid fallback config -> warning + unmapped amount + no crash
- [ ] residual saldo logic across `Y - 1` and `Y - 2`
- [ ] structured warning log includes at least `code`, `taxYear`, `amount`, and `paymentYear` when available

Exit condition:
- automatic reminder generation follows the same fiscal contract as the dashboard

---

## Task 6: Add client/server parity coverage

**Files:**
- `src/components/atomic-crm/dashboard/fiscalModel.test.ts`
- `supabase/functions/_shared/fiscalDeadlineCalculation.test.ts`
- optional new parity-focused test file if needed

- [ ] Use the same named synthetic scenarios on both sides for:
  - `mappedTaxable_basic`
  - `nonTaxable_excluded`
  - `unmapped_missingFallback`
  - `invalidFallbackConfig_unmappedWarning`
  - `refundHeavy_negativeRawCash`
  - `schedule_firstYear`
  - `schedule_secondYear_singleAdvance`
  - `schedule_doubleAdvance`
- [ ] Assert parity on final public numeric outputs after rounding.
- [ ] Assert parity on warning codes and supporting tax years.
- [ ] Assert parity on `buildFiscalDeadlineKey()` inputs and output shape.
- [ ] Assert parity on deadline ordering and item ordering where ordering affects rendering, keys, or task generation.

Rule:
- do not use shared domain fixtures from production data
- keep fixtures synthetic and inline

Exit condition:
- a future drift between dashboard and Edge Function becomes a test failure, not a production surprise

---

## Task 7: Extra integration sweep

**Files:**
- `src/components/atomic-crm/dashboard/dashboardModel.ts`
- `src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts`
- `src/components/atomic-crm/dashboard/useGenerateFiscalTasks.ts`
- `src/components/atomic-crm/dashboard/DashboardDeadlineTracker.tsx`
- `src/components/atomic-crm/dashboard/DashboardCashFlowCard.tsx`
- `src/lib/semantics/crmSemanticRegistry.ts`

- [ ] Verify `dashboardModel.ts` still injects fiscal deadlines into `cashFlowForecast` with the corrected payment-year semantics.
- [ ] Extend `dashboardAnnualModel.test.ts` to cover integrated annual model behavior after the fiscal refactor.
- [ ] Refactor `useGenerateFiscalTasks.ts` to derive fiscal task identity and type from structured deadline data (`component`, `competenceYear`, `date`) instead of parsing human-readable labels.
- [ ] Make fiscal task identity derive from `component + competenceYear + date`, not from rendered copy.
- [ ] Verify generated fiscal tasks do not duplicate existing reminders only because labels/copy changed.
- [ ] Verify `DashboardDeadlineTracker.tsx` still presents fiscal reminders coherently after task payload and copy changes.
- [ ] Run manual UX verification on `DashboardCashFlowCard.tsx` so the new fiscal outflows remain readable and semantically correct.
- [ ] Update `crmSemanticRegistry.ts` if its fiscal notes still describe the old estimate/deadline semantics.

Exit condition:
- satellite consumers and reminder UX stay aligned with the new fiscal contract, not just the core calculators

---

## Task 8: Continuity docs and rollout

**Files:**
- `docs/architecture.md`
- `docs/historical-analytics-handoff.md`
- `docs/historical-analytics-backlog.md`
- `docs/development-continuity-map.md`

- [ ] Update continuity docs in the same implementation commit as the code changes.
- [ ] Document the new fiscal split: estimate vs schedule vs local tracking.
- [ ] Record the new config field `defaultTaxProfileAtecoCode`.
- [ ] Record the warning semantics for unmapped revenue and the safe-first net availability rule.

Verification commands:
- [ ] `make test`
- [ ] targeted `vitest` on fiscal dashboard and fiscal deadline shared files
- [ ] `make typecheck`
- [ ] `make lint`

Manual verification:
- [ ] normal year with mapped taxable cash only
- [ ] second-year schedule with saldo present and prior advances still zero
- [ ] refund-heavy year with negative raw cash but zero-clamped fiscal burden
- [ ] year with `UNMAPPED_TAX_PROFILE` warning visible in dashboard and logged by reminder flow

Release steps:
- [ ] `git push` to `main` for frontend auto-deploy on Vercel
- [ ] manual deploy of the Supabase function that uses the changed shared logic, because fiscal shared logic consumed by the function has changed:
  - `npx supabase functions deploy fiscal_deadline_check`
- [ ] verify the deployed `fiscal_deadline_check` function is active and run a minimal post-deploy smoke/manual invocation if the local workflow already provides one

Exit condition:
- docs, tests, frontend deploy, and Edge Function deploy all move together

---

## Final Acceptance Checklist

- [ ] Current-year tax simulation uses only cash basis from received payments.
- [ ] Payment-year deadlines are derived from `Y - 1` and `Y - 2`, not from current-year cash.
- [ ] Local paid tracking does not change canonical reserve math.
- [ ] Unmapped taxable cash is visible, warned, and parity-tested.
- [ ] Dashboard and Edge Function agree on date normalization, rounding, warnings, and schedule math.
- [ ] Desktop and mobile show the same fiscal semantics.
