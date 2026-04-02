# Fiscal Truth — Gestione Separata

**Date:** 2026-04-02
**Status:** Approved for planning
**Scope:** Separate current-year forfettario simulation from payment-year fiscal deadlines for Gestione Separata, align dashboard and Edge Function calculations, and stop treating device-local payment tracking as fiscal truth.

---

## Problem Statement

The annual dashboard currently mixes two different realities under the same fiscal surface:

1. **Current-year fiscal simulation** is based on cash received in the selected year and is broadly correct for regime forfettario.
2. **Fiscal deadlines** are labeled as "saldo anno precedente + acconti anno corrente" but are built from the same current-year estimate, so they are semantically wrong.
3. **Dashboard and Edge Function diverge** because the server-side calculation ignores refunds and non-taxable defaults that the client-side model already handles.
4. **"Già versato" is device-local only** (`ra-core` store) but currently affects dashboard math as if it were authoritative fiscal data.
5. **One label, multiple meanings**: "tasse" can mean estimated current-year burden, upcoming F24 obligations, or user-marked payments, depending on the card.

Result: the dashboard can show plausible-looking numbers while still misrepresenting what belongs to the current tax year versus what is payable in the current calendar year.

---

## Decision Record

- **Keep the current-year cash-basis simulation.** The selected tax year continues to be computed from payments with `status = 'ricevuto'` and `payment_date` inside that year.
- **Split simulation from payment schedule.** A tax-year estimate and a payment-year deadline schedule become separate concepts with separate formulas and labels.
- **Default deadlines to the historical method.** For payment year `Y`, deadlines are estimated from the simulated tax burden of tax year `Y - 1`, and previous-year saldo is modeled as the residual after estimated advances already attributable to tax year `Y - 1`.
- **Treat device-local paid tracking as non-authoritative.** Local "mark as paid" remains a convenience only and must not redefine fiscal truth.
- **Keep the scope to Gestione Separata only.** No artigiani/commercianti minimum contribution logic, no ordinary regime, no IVA layer.
- **Use an explicit fallback tax profile.** Payments that cannot be mapped through `project.category` must not depend on array order; fallback classification is driven by an explicit config key, not by `taxProfiles[0]`.
- **Prefer one domain contract across client and server.** If a single runtime-shared module is practical for both Vite and Deno, use it. If tooling blocks that, use identical domain fixtures and parity tests so the formulas still have one authoritative contract.

---

## Invariants

These rules are non-negotiable for this refactor:

1. **Forfettario uses cash basis only.** Fiscal revenue comes from `payments`, never from `services`.
2. **Refunds reduce fiscal revenue.** `payment_type = 'rimborso'` contributes as a negative amount.
3. **Non-taxable defaults remain excluded.** `taxabilityDefaults` must apply identically in dashboard and Edge Function calculations.
4. **Tax year and payment year are different concepts.** A current-year estimate cannot be reused as "saldo anno precedente".
5. **Deadline items must declare their competence explicitly.** A June deadline can mix previous-year saldo items and current-year acconto items, but the model must know which is which.
6. **"Paid" state is not truth unless persisted.** Device-local tracking cannot be described as definitive or used as canonical cross-surface data.
7. **The UI must say only what the data actually knows.** "Stimato" stays for recomputed deadlines and simulations; no wording that implies certified tax liability.
8. **Raw cash can be negative; fiscal outputs cannot.** Refund-heavy periods may produce negative net cash buckets, but `forfettarioIncome`, `annualInpsEstimate`, and `annualSubstituteTaxEstimate` are clamped at a minimum of zero.
9. **Rounding happens only at final public outputs.** Intermediate calculations use full precision; rounding to 2 decimals happens only when exposing final numeric results.
10. **Tax-year attribution is business-date based.** `payment_date` is interpreted through the business-date helper contract (`toBusinessISODate` semantics), never through browser-local timezone conversion.

---

## Domain Model

The fiscal layer is split into three explicit outputs.

### 1. Tax-Year Estimate

Represents the simulated fiscal burden of tax year `Y`.

```ts
type FiscalYearEstimate = {
  taxYear: number;
  taxableCashRevenue: number;
  totalCashRevenue: number;
  nonTaxableCashRevenue: number;
  unmappedCashRevenue: number;
  forfettarioIncome: number;
  annualInpsEstimate: number;
  taxableIncomeAfterInps: number;
  annualSubstituteTaxEstimate: number;
  annualTotalEstimate: number;
  monthlySetAside: number;
  substituteTaxRate: number;
};
```

### 2. Payment-Year Schedule

Represents estimated obligations payable during calendar year `Y`.

```ts
type FiscalPaymentSchedule = {
  paymentYear: number;
  basisTaxYear: number;
  supportingTaxYears: number[];
  method: "historical";
  confidence: "estimated";
  assumptions: {
    configMode: "current_config_reapplied";
    paymentTrackingMode: "local_non_authoritative";
  };
  deadlines: FiscalScheduleDeadline[];
};

type FiscalScheduleDeadline = {
  date: string;
  label: string;
  priority: "high" | "low";
  totalAmount: number;
  items: FiscalScheduleItem[];
};

type FiscalScheduleItem = {
  description: string;
  amount: number;
  competenceYear: number | null;
  component:
    | "imposta_saldo"
    | "imposta_acconto_1"
    | "imposta_acconto_2"
    | "imposta_acconto_unico"
    | "inps_saldo"
    | "inps_acconto_1"
    | "inps_acconto_2"
    | "bollo"
    | "dichiarazione";
};
```

`supportingTaxYears` must be sorted ascending and contain no duplicates.

### 3. Local Tracking State

Current local tracking is a UI aid, not part of fiscal truth:

```ts
type LocalFiscalDeadlineTracking = {
  deadlineKey: string;
  paidAmount: number;
  paidDate: string;
};
```

It can stay temporarily for interaction convenience, but it must not redefine the estimated fiscal burden.

`deadlineKey` must be stable and domain-derived, not label-derived. It should be generated from invariant schedule data such as `paymentYear + date + method + sorted(component + competenceYear)`.

---

## Canonical Formula

### Tax-Year Estimate

For tax year `Y`:

```text
taxable_cash_revenue(Y) =
  SUM(mapped taxable received payments in Y with sign logic)

non_taxable_cash_revenue(Y) =
  SUM(received payments in Y excluded by configured non-taxable clients/categories)

unmapped_cash_revenue(Y) =
  SUM(received payments in Y that remain taxable in principle
      but cannot be mapped to any ATECO profile after fallback resolution)

total_cash_revenue(Y) =
  taxable_cash_revenue(Y)
  + non_taxable_cash_revenue(Y)
  + unmapped_cash_revenue(Y)

taxable_cash_revenue_per_ateco_raw(Y) =
  signed mapped taxable cash assigned to each ATECO bucket

taxable_cash_revenue_per_ateco_basis(Y) =
  max(0, taxable_cash_revenue_per_ateco_raw(Y))

forfettario_income(Y) =
  SUM(taxable_cash_revenue_per_ateco_basis * coefficiente_redditivita / 100)

annual_inps_estimate(Y) =
  max(0, forfettario_income(Y) * aliquota_inps / 100)

annual_substitute_tax_estimate(Y) =
  MAX(0, forfettario_income(Y) - annual_inps_estimate(Y))
  * aliquota_sostitutiva(Y) / 100
```

This keeps raw cash totals explainable even when refunds exceed received amounts, while preventing negative fiscal burden outputs.

### Payment-Year Schedule

For payment year `Y` under the historical method:

```text
estimate(T) =
  tax-year simulation for competence year T

advancePlanFromEstimate(T) =
  advance-only plan generated from estimate(T)
  to be paid in calendar year (T + 1)
  for competence year (T + 1)

estimated_advances_for_tax_year(Y - 1) =
  advance items generated by advancePlanFromEstimate(Y - 2)
  whose competenceYear is (Y - 1)

June 30:
  imposta_saldo        = max(
                           0,
                           annual_substitute_tax_estimate(Y - 1)
                           - estimated substitute-tax advances for competence (Y - 1)
                         )
  inps_saldo           = max(
                           0,
                           annual_inps_estimate(Y - 1)
                           - estimated INPS advances for competence (Y - 1)
                         )
  imposta_acconto_1    = 50% of annual_substitute_tax_estimate(Y - 1), if double advance applies
  inps_acconto_1       = annual_inps_estimate(Y - 1) * 40%

November 30:
  imposta_acconto_2    = 50% of annual_substitute_tax_estimate(Y - 1), if double advance applies
  imposta_acconto_unico= 100% of annual_substitute_tax_estimate(Y - 1), if single advance applies
  inps_acconto_2       = annual_inps_estimate(Y - 1) * 40%
```

Equivalent deterministic construction:

```text
schedule(Y) =
  residual saldo for competence (Y - 1)
    computed from estimate(Y - 1)
    minus advances attributable to competence (Y - 1)
    derived from advancePlanFromEstimate(Y - 2)
  +
  new advances for competence Y
    derived from estimate(Y - 1)
```

This means the schedule for year `Y` needs estimated tax-year outputs for both `Y - 1` and `Y - 2`, but it does not require recursively building `schedule(Y - 1)`.

Advance thresholds for substitute tax remain:

- `< 51.65` → no advance
- `>= 51.65 && <= 257.52` → single November advance
- `> 257.52` → two advances, 50/50

Edge cases:

- first year of activity: no June/November deadline schedule; for this iteration, "first year of activity" is config-driven from `fiscalConfig.annoInizioAttivita`, with a defensive data-driven fallback only if config is missing or invalid
- second year of activity: saldo for tax year `Y - 1` exists, but estimated advances attributable to `Y - 1` are zero because there was no prior schedule

If the residual saldo becomes negative, the payable schedule clamps it to zero. Estimated credits are not modeled in this iteration.

---

## Source Precedence Rules

1. `payments` is the only source for fiscal cash basis.
2. `payment_date` determines tax-year attribution after normalization through the shared business-date helper contract.
3. `project.category` determines ATECO mapping when `project_id` is present.
4. If a payment has no `project_id`, or its project category does not match any configured ATECO profile, taxable revenue falls back to an explicit `fiscalConfig.defaultTaxProfileAtecoCode`.
5. If `defaultTaxProfileAtecoCode` is missing or does not match any configured profile, that payment is excluded from taxable ATECO aggregation, counted into `unmappedCashRevenue`, and a warning must be raised.
6. `taxabilityDefaults` must be applied before ATECO aggregation.
7. The payment-year schedule for `Y` reads the estimate of `Y - 1`, never the estimate of `Y`.

This makes the fallback policy explicit and stable across config reordering.

---

## Warning Policy

Unmapped or incomplete fiscal classification must not remain silent.

- `unmappedCashRevenue > 0` must raise a structured computation warning for the affected tax year.
- The dashboard warning surface must expose that warning to the user.
- The Edge Function must log the same warning context so automatic reminders are traceable during debugging and support.
- Presence of `UNMAPPED_TAX_PROFILE` does not block schedule generation; reminder generation stays enabled and the resulting schedule remains estimated-with-warning.
- Warning semantics must be parity-tested between client and server, even if the exact rendering differs by surface.

Minimum semantic contract:

```ts
type FiscalComputationWarning = {
  code: "UNMAPPED_TAX_PROFILE";
  taxYear: number;
  amount: number;
  message: string;
};
```

---

## Numeric Policy

- All intermediate calculations use full precision.
- Rounding to 2 decimals happens only on final public outputs exposed by the fiscal model and payment schedule.
- Client and server must apply the same rounding boundary to avoid parity drift.

---

## UX Contract

The dashboard must stop collapsing different concepts into a single "taxes" number.

### Current-Year Fiscal KPI Card

This area continues to answer:

- "How much tax and INPS does this year's received cash imply?"
- "How much should I set aside for the current tax year?"

This card remains simulation-only.

### Fiscal Deadlines Card

This area must answer:

- "What estimated payments fall due in this calendar year?"
- "Which parts are previous-year saldo versus current-year acconti?"

This card must no longer be generated from the current-year estimate.

### Net Availability Card

The safe-first rule for this refactor:

- subtract **current-year estimated reserve**
- do **not** treat device-local "marked as paid" as authoritative fiscal truth

Therefore, local tracking should either:

1. be displayed only inside the deadlines UI as a convenience marker, or
2. be explicitly labeled as local-only and excluded from canonical reserve math

This is intentionally conservative until a DB-backed fiscal payment ledger exists.

`Net Availability` is therefore defined as a **prudential selected-year indicator**, not as the real cross-year cash balance of the business.

---

## Dashboard Semantics After Refactor

For selected year `Y`:

- `Tasse stimate` = simulated tax-year burden for `Y`
- `Accantona al mese` = reserve suggestion for tax year `Y`
- `Scadenze fiscali stimate` = estimated payments due during calendar year `Y`, built from tax year `Y - 1`
- `Già versato` = local reminder only unless and until persisted server-side

This fixes the current semantic bug where the UI pretends to show previous-year saldo while actually reusing year `Y`.

---

## Edge Function Alignment

`fiscal_deadline_check` must use the same fiscal semantics as the dashboard:

- refunds handled as negative
- non-taxable defaults excluded
- basis tax year = `currentYear - 1`
- generated tasks based on the payment-year schedule, not on the current-year estimate

Because reminder generation is automatic, semantic drift here is high-cost: a wrong server formula creates wrong tasks and notifications, not just wrong UI text.

---

## Known Constraint: No Historical Configuration Snapshot

The current system stores fiscal configuration as current state, not as year-versioned snapshots.

Implication:

- recomputing tax year `Y - 1` uses today's fiscal configuration, not a preserved historical snapshot for that year

This means deadlines remain **estimated**, not accountant-grade truth, even after the refactor.

For this iteration, that limitation is accepted as long as the UI consistently says "stimato". Historical config versioning is a future improvement, not part of this scope.

---

## Out of Scope

- Artigiani/commercianti contribution minimums
- Ordinary tax regime
- IVA calculations
- Historical configuration snapshots by year
- Official F24 reconciliation with accountant-provided numbers
- DB-backed fiscal payment ledger

The last item is deliberately deferred to keep the first refactor focused on semantic correctness. If product wants cross-device fiscal payment truth, that becomes a separate follow-up scope with a dedicated migration.

---

## Impacted Surfaces

Primary code paths expected to change in implementation:

- `src/components/atomic-crm/dashboard/fiscalModel.ts`
- `src/components/atomic-crm/dashboard/fiscalDeadlines.ts`
- `src/components/atomic-crm/dashboard/fiscalModelTypes.ts`
- `src/components/atomic-crm/dashboard/DashboardFiscalKpis.tsx`
- `src/components/atomic-crm/dashboard/DashboardDeadlinesCard.tsx`
- `src/components/atomic-crm/dashboard/DashboardNetAvailabilityCard.tsx`
- `src/components/atomic-crm/dashboard/DashboardAnnual.tsx`
- `src/components/atomic-crm/dashboard/MobileDashboard.tsx`
- `src/components/atomic-crm/dashboard/useFiscalPaymentTracking.ts`
- `src/components/atomic-crm/types.ts`
- `src/components/atomic-crm/root/defaultConfiguration.ts`
- `src/components/atomic-crm/root/ConfigurationContext.tsx`
- `src/components/atomic-crm/settings/FiscalSettingsSection.tsx`
- `supabase/functions/_shared/fiscalDeadlineCalculation.ts`
- `supabase/functions/fiscal_deadline_check/index.ts`

Tests required:

- client-side fiscal model unit tests
- deadline schedule unit tests for year-boundary cases
- parity tests between dashboard and Edge Function formulas

---

## Validation Points

This spec needs explicit confirmation on these decisions before planning starts:

1. **Historical method only:** deadlines should default to `anno precedente -> scadenze anno corrente`, not to a previsionale mode.
2. **Safe-first net availability:** local "segnato come pagato" should stop affecting canonical tax math.
3. **Gestione Separata only:** no support for artigiani/commercianti in this refactor.
4. **Deferred fiscal payment ledger:** cross-device paid-tax truth is postponed to a follow-up, not included in the first implementation.

If these four decisions are accepted, the implementation plan can stay narrow and materially safer.
