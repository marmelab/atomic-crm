# Historical Analytics Handoff

**Stato del documento:** `working`
**Scopo:** handoff operativo e memoria di implementazione per riprendere il
lavoro senza riaprire decisioni gia prese.
**Quando NON usarlo da solo:** per dedurre architettura canonica o stato
prodotto senza incrociarlo con `docs/README.md` e i documenti `canonical`.

Last updated: 2026-04-02 (fiscal reality layer Phase 1 complete)

## Phase 1 known inconsistency — IMPORTANT

**Dashboard** uses real obligations from `fiscal_obligations` (when available),
falling back to estimates. **Automated reminders** (`fiscal_deadline_check` Edge
Function) still read estimates only. This means the user may see different amounts
on the dashboard vs in automated reminder tasks until Phase 2 ships.

**Phase 2 follow-up (immediately after Phase 1 ships):**

- `fiscal_deadline_check` must read from `fiscal_obligations` when available
- Priority: first task after Phase 1 is verified in production
- UI note visible in DashboardDeadlinesCard footer: "I promemoria automatici
  usano ancora le stime, non le obbligazioni reali." — remove when Phase 2 ships.

## Update 2026-04-02 — Fiscal reality layer: mobile parity (step 9)

All 3 fiscal entry dialogs (`DichiarazioneEntryDialog`, `F24RegistrationDialog`,
`ObligationEntryDialog`) are now responsive: Sheet on mobile, Dialog on desktop.
`MobileAnnualDashboard` holds fiscal dialog states and renders all 3 dialogs,
with action buttons visible when `isCurrentYear && data.fiscal`.

## Update 2026-04-02 — Fiscal reality layer: useFiscalReality hook

- `useFiscalReality` hook added in `dashboard/` — single fetch+merge entrypoint
  for all fiscal reality consumers.
- Fetches `getFiscalObligations(paymentYear)` and
  `getEnrichedPaymentLinesForYear(paymentYear)` via `useQuery` with year-scoped
  query keys (`["fiscal-obligations", year]`, `["fiscal-enriched-payment-lines", year]`).
- Calls `buildFiscalRealityAwareSchedule` via `useMemo`; returns `null` while
  either query is pending so consumers can gate on `deadlineViews !== null`.
- Derives `totalOpenObligations` as sum of `remainingAmount` across all items in
  all deadline views (total fiscal reserve needed).
- `hasRealFiscalData` = `obligations.length > 0`.
- No DB write, no UI wiring, no Edge Function change in this step.

## Update 2026-04-02 — Fiscal reality layer: reality-aware schedule read model

- `buildFiscalRealityAwareSchedule` added in `dashboard/` — the single semantic
  merge point between estimated deadlines and real obligations.
- Algorithm: UNION of estimated items + real obligations, merged by canonical key
  `component::competenceYear::dueDate`. Phase A processes estimated deadlines
  (replacing matched items with real data); Phase B adds unconsumed real-only
  obligations as new deadline entries.
- Status derivation: `estimated` → `due` → `partial` → `paid` → `overpaid`
  based on obligation existence and payment coverage.
- `estimateComparison` = aggregate original estimated amount when real data
  exists for a deadline, null otherwise.
- Real-only deadlines get `priority: "low"` if all bollo, `"high"` otherwise.
- Deterministic sort: items by canonical component order, deadlines by
  priority (high first) then date.
- 11 unit tests cover all status paths, real-only deadlines, mixed sources,
  overpayment, paidDate from submission_date, and totalRemaining.
- No DB write, no UI wiring, no Edge Function change in this step.

## Update 2026-04-02 — Fiscal reality layer: canonical obligation merge key

- `buildFiscalObligationMergeKey` added to `buildFiscalDeadlineKey.ts`.
- Key format: `component::competenceYear::dueDate` — Phase 1 matching, no
  installment number in the key.
- Existing `buildFiscalDeadlineKey` kept for backward compatibility until
  `useFiscalPaymentTracking` is fully deprecated.
- 2 unit tests verify key construction and uniqueness by component.
- No DB write, no UI wiring, no Edge Function change in this step.

## Update 2026-04-02 — Fiscal reality layer: obligation auto-generation

- `buildObligationsFromDeclaration` added in `dashboard/` — pure function,
  takes `FiscalDeclaration`, returns `ObligationDraft[]`.
- Logic: saldo = `total - prior_advances`, clamped ≥0; imposta acconti follow
  thresholds (> €257.52 → double 50%, €51.65–€257.52 → single 100%, below →
  none); INPS acconti = 40% ×2 when `total_inps > 0`; zero-amount entries
  skipped; `source = 'auto_generated'`, `declaration_id` always set; Phase 1
  = non-rateized only (installment fields are null).
- 25 unit tests cover all branches and boundary conditions.
- No DB write, no UI wiring, no Edge Function change in this step.
- Next step: provider save + UI form.

## Update 2026-04-02 — Fiscal truth / Gestione Separata parity

- Fiscal dashboard and `fiscal_deadline_check` now share the same two-lane
  fiscal contract:
  - `FiscalYearEstimate` for selected tax year `Y`
  - `FiscalPaymentSchedule` for payment year `Y`, built from estimate `Y-1`
    and advance plan `Y-2`
- `fiscalConfig` gained an explicit fallback field:
  `defaultTaxProfileAtecoCode`.
  Current default/fallback is `731102` (`73.11.02` - conduzione di campagne di
  marketing e altri servizi pubblicitari).
- Taxable cash that cannot be mapped to a valid ATECO profile no longer falls
  through array order. It is isolated in `unmappedCashRevenue`, excluded from
  taxable ATECO aggregation, and raises `UNMAPPED_TAX_PROFILE`.
- `DashboardNetAvailabilityCard` is now safe-first:
  local "segnato come pagato" no longer subtracts taxes from canonical reserve
  math. That local state remains only inside `DashboardDeadlinesCard`.
- `useFiscalPaymentTracking` migrated from legacy `date::label` persistence to
  stable invariant keys via `buildFiscalDeadlineKey()` and explicitly wipes the
  incompatible legacy key shape instead of trying to migrate it.
- `useGenerateFiscalTasks` now derives task type and identity from structured
  fiscal data (`component + competenceYear + date`), not from rendered copy.
- Desktop and mobile fiscal surfaces now share warning semantics through
  `DashboardFiscalWarnings`; mobile no longer relies on the removed
  `taxesPaid` prop path.
- Shared/server parity coverage added:
  - `src/components/atomic-crm/dashboard/fiscalParity.test.ts`
  - `supabase/functions/_shared/fiscalDeadlineCalculation.test.ts`
- Deploy required after merge/push: remote Edge Function
  `fiscal_deadline_check`.

## Update 2026-04-01 — Plain-language financial flags in unified_crm_answer

- The `unified_crm_answer` system prompt now explicitly forbids exposing raw
  snapshot field names or internal booleans in the markdown response.
- The guardrail is intentionally narrow: it changes wording only, not the
  overall answer shape or verbosity budget.
- Practical rule enforced in the prompt:
  - never echo keys like `hasUninvoicedServices`, `balanceDue`,
    `clientFinancials`, `activeProjects`
  - always translate technical flags into natural Italian copy
- Concrete example:
  - forbidden: `hasUninvoicedServices = si`
  - required: `ci sono ancora servizi non fatturati`
- No snapshot schema change: the read context still exposes the same fields;
  only the user-facing wording contract changed.

Deploy richiesti: Edge Function remota `unified_crm_answer`.

## Update 2026-04-01 — AI snapshot expense detail fix

- `unifiedCrmReadContext.ts` now exposes project expense rows directly under
  `snapshot.activeProjects[].expenses`, mirroring the existing project
  `services` detail already used by `unified_crm_answer`.
- `snapshot.recentExpenses[].amount` and `snapshot.totals.expensesAmount` no
  longer use the raw `expenses.amount` column. They now use the operational
  amount helper:
  - km expenses -> `km_distance * km_rate`
  - markup expenses -> `amount * (1 + markup_percent/100)`
  - `credito_ricevuto` -> negative amount
- Practical effect: the AI can now explain project/client balances without
  showing fake `0,00 €` rows for `spostamento_km` and without losing project
  expense detail outside the global recent-expenses list.
- Regression coverage added in `unifiedCrmReadContext.test.ts` for:
  - project expense serialization
  - operational amount on km expenses

Deploy richiesti: Edge Function remota `unified_crm_answer` when this follow-up ships.

## Update 2026-04-01 — M1: parseAiVisualBlocks consumed in 6 AI Edge Functions

All 6 AI Edge Functions now use `parseAiVisualBlocks` from `_shared/parseAiVisualBlocks.ts`
instead of raw `JSON.parse` for the visual-mode blocks output:

- `annual_operations_summary`, `annual_operations_answer`
- `historical_analytics_summary`, `historical_analytics_answer`
- `historical_cash_inflow_summary`, `historical_cash_inflow_answer`

The helper validates the JSON, strips markdown fences if present, and throws
`InvalidAiOutputError` for malformed output. The catch blocks in each function
now return 502 for `InvalidAiOutputError` and 500 for any other error.

No behavioral change when the AI output is valid JSON. The improvement is
structured error propagation when the AI returns non-JSON content.

## Update 2026-03-31 — Timezone bonifica phase 4 (annual wrappers + fiscal deadline parity)

- `DashboardAnnual.tsx`, `MobileDashboard.tsx` e
  `DashboardAnnualAiSummaryCard.tsx` non usano piu' il current year del browser:
  l'anno "corrente" e' derivato dal business-date `Europe/Rome`.
- I chip AI della card annuale scelgono quindi correttamente il set
  `current year` anche sul boundary `31 dicembre UTC / 1 gennaio Roma`, e il
  risultato mostrato e' etichettato con l'anno richiesto (`Riassunto {year}`),
  non con `generatedAt`.
- `DashboardDeadlinesCard.tsx`, `useGenerateFiscalTasks.ts` e la shared Edge
  Function `fiscalDeadlineCalculation.ts` trattano `FiscalDeadline.date` come
  vera business-date:
  - rendering tramite `formatBusinessDate`
  - task payload con `startOfBusinessDayISOString`
  - classificazione anno pagamenti via `getBusinessYear`
  - `fiscal_deadline_check/index.ts` legge `currentYear` da `todayISODate()`
- Verifica chiusa:
  - unit mirati verdi anche con `TZ=America/New_York`
  - `dashboard-annual.smoke.spec.ts` verde (`7/7`)

Deploy richiesti: Edge Function remota `fiscal_deadline_check`.

## Update 2026-03-31 — Timezone bonifica phase 2 (tasks + unifiedCrmReadContext)

- `unifiedCrmReadContext.ts` non usa piu' `toStartOfDay(new Date(...))` e
  `diffDays(...)` locali per `pending/overdue payments` e `upcoming/overdue tasks`.
  Ora legge tutto via `todayISODate`, `toBusinessISODate` e
  `diffBusinessDays` dal layer `dateTimezone`.
- Effetto pratico: il launcher AI e le superfici read-only non anticipano o
  ritardano le scadenze quando il browser/Node gira fuori da `Europe/Rome`.
- Il modulo `tasks` e' stato allineato allo stesso contratto:
  create/edit/postpone/filtering dei task all-day passano da helper business-date,
  e `formatDateRange`/`formatDateLong` non slittano piu' di giorno sugli all-day
  ISO timestamps.
- Verifica chiusa:
  - unit: `dateTimezone`, `taskDueDate`, `taskFilters`, `formatDateRange`,
    `unifiedCrmReadContext`
  - browser: `tasks.complete.spec.ts` verde
  - smoke cross-timezone dashboard: verde su `Europe/Rome` e `America/New_York`

Deploy richiesti: nessuno. Nessuna Edge Function remota toccata in questa fase.

## Update 2026-03-08 (p) — unified_crm_answer robustness + suggestion scoping

- `unified_crm_answer/index.ts`: removed `reasoning: { effort: "medium" }` parameter
  (caused empty AI outputs), compacted JSON context payload, bumped
  `max_output_tokens` 1500→2000, improved error logging with response body.
- `unifiedCrmAnswerSuggestions.ts`: expanded `focusPayments` keyword patterns
  with payment-related terms ("deve", "soldi", "chi mi deve", "quanto mi deve",
  "debit", "credit"). In `genericSummary` path, quote-related suggested actions
  now gated behind `focusQuotes` flag (previously always shown).

## Update 2026-03-08 (o) — Historical dashboard "Approccio Bambino" redesign

Complete visual overhaul of the historical dashboard to match the annual dashboard
level. Applied the same "Approccio Bambino" design (readable in 2 seconds, semantic
colors, big numbers, no verbose subtitles).

### Changes

- **Unified AI card**: `DashboardHistoricalAiCard` replaces the two old separate
  cards (`DashboardHistoricalAiSummaryCard` + `DashboardHistoricalCashInflowAiCard`).
  Single card with scope selector (storico/incassi), Vista smart toggle, color-coded
  suggested questions (14 questions with priority 1/2, scoped by storico/incassi),
  free text input, PDF export via afterprint pattern. Compact mode for mobile with
  collapsible suggestions.
- **KPI cards Bambino**: 4-card grid with colored icon badges (sky=Lavoro totale,
  emerald=Anno migliore, amber=Ultimo anno, dynamic=Crescita YoY). Big numbers,
  short labels, inline comparison footer.
- **Cash Inflow Card Bambino**: 2-column summary (Totale storico | Ultimo anno) with
  Separator vertical, yearly progress bars with abbreviated labels.
- **Layout**: inline subtitle in DashboardHistorical, AI card at top, simplified grid.
- **Provider**: all 4 historical methods accept `{ visualMode?: boolean }`.
- **Edge Functions**: all 4 historical EFs (summary, answer, cash_inflow_summary,
  cash_inflow_answer) updated with visualMode support using shared
  `visualModePrompt.ts`.
- **Types**: `HistoricalVisualSummary`, `HistoricalVisualAnswer`,
  `HistoricalSuggestedQuestion` with color/priority/scope.
- **Deleted**: `DashboardHistoricalAiSummaryCard.tsx` + test,
  `DashboardHistoricalCashInflowAiCard.tsx` + test (replaced by unified card).
- **Mobile**: `DashboardHistorical compact` prop passed from MobileDashboard.

### Deploy required

Edge Functions: `historical_analytics_summary`, `historical_analytics_answer`,
`historical_cash_inflow_summary`, `historical_cash_inflow_answer`.

## Update 2026-03-08 (n) — Fix PDF export for mobile (afterprint)

`window.print()` is async on iOS Safari — the old code removed the print portal
immediately after calling it, before the print renderer captured the content.
Fixed by deferring cleanup to the `afterprint` event listener.

## Update 2026-03-08 (m) — Mobile AI card: top position + collapsible suggestions

Moved `DashboardAnnualAiSummaryCard` above KPI cards in `MobileDashboard`
(matching desktop order). Added `compact` prop: when set, suggested questions
are collapsed by default behind a "Suggerimenti" toggle. Mobile shows only
"Spiegami l'anno" button + free question input by default.

## Update 2026-03-08 (l) — Fix fiscal data missing on mobile dashboard

**Bug:** MobileDashboard passed `DashboardKpiCards` without `fiscalKpis` and
`taxesPaid` props → `DashboardNetAvailabilityCard` always showed "—" for TASSE
on mobile, even when fiscal is fully configured in the DB.

**Root cause:** `MobileDashboard.tsx` line 132-137 called `<DashboardKpiCards>`
with only `kpis`, `meta`, `year`, `compact` — missing `fiscalKpis` and
`taxesPaid`. The desktop `DashboardAnnual.tsx` correctly passed both.

**Fix:** Added `useFiscalPaymentTracking(selectedYear)` hook call and passed
`fiscalKpis={data.fiscal?.fiscalKpis ?? null}` + `taxesPaid={totalTaxesPaid}`
to `DashboardKpiCards` in `MobileAnnualDashboard`.

## Update 2026-03-08 (k) — Mobile responsive dashboard pass

Comprehensive mobile pass on all dashboard cards: responsive text sizes
(text-lg/sm:text-xl), reduced padding on narrow screens, min-w-0 + truncate
to prevent overflow, smaller icons on mobile. Fixed KPI grid from xl:grid-cols-4
to xl:grid-cols-5 (matching NetAvailability col-span-5). Made "Configura Fiscale"
a clickable link to Settings. AiBlockRenderer blocks (metrics, bar-chart,
comparison, breakdown, trend) all use responsive sizing.

## Update 2026-03-08 (j) — PDF export for AI results

Added zero-dependency PDF export to the AI result area. A "PDF" button clones
the result DOM into a temporary portal (`[data-print-portal]`), triggers
`window.print()`, and removes the portal. Global `@media print` rules in
`index.css` hide everything except the portal and force print colors. The
pattern is reusable on any future AI surface.

## Update 2026-03-08 (i) — AI visual mode ("Vista smart")

Added opt-in "Vista smart" toggle to the annual AI card. When active, the AI
responds with structured JSON blocks (text, metrics, bar-chart, trend, progress,
comparison, breakdown, callout, action) instead of markdown. Prompt iteratively
refined with external review: explicit JSON schema per block type, anti-extra-field
and anti-empty-array rules, self-correction instruction, block count guidance
(2-6), short labels (1-4 words), trailing comma validation, two concrete JSON
examples (with/without charts), mental delimiter pattern, text block length cap
(1-3 sentences), short trend unit symbols, numeric field reinforcement. The
frontend renders
each block with dedicated React components using the design system colors.

Visual mode is now the default for new users (localStorage fallback changed from
false to true). The AI card has been promoted to the top of the annual dashboard,
above KPI cards, as the primary entry point.

### Implementation

- **Types**: `AiBlock` union type + `AnnualOperationsVisualSummary` /
  `AnnualOperationsVisualAnswer` in `annualAnalysis.ts`
- **Renderer**: `AiBlockRenderer.tsx` — maps 10 block types to React components
  (CSS bars, Recharts LineChart for trend, proportional breakdown with >5 fallback)
- **Edge Functions**: both `annual_operations_summary` and `annual_operations_answer`
  accept `visualMode: boolean`; when true, append visual block instructions to the
  AI prompt and return `{ blocks: AiBlock[] }` instead of `{ summaryMarkdown }` /
  `{ answerMarkdown }`
- **Shared prompt**: `_shared/visualModePrompt.ts` — 10 block types, 8 colors,
  composition rules
- **Provider**: `generateAnnualOperationsAnalyticsSummary(year, { visualMode })`,
  `askAnnualOperationsQuestion(year, question, { visualMode })`
- **Toggle**: pill button with Lightbulb icon in card header, persisted in
  localStorage

**Edge Functions touched**: `annual_operations_summary`, `annual_operations_answer`
→ deploy required.

## Update 2026-03-08 (h) — Full dashboard "Approccio Bambino" redesign

Complete visual overhaul of the annual dashboard. Design principle: every card
must be understandable in 2 seconds without reading badges, tooltips, or
collapsible sections. Semantic colors: emerald=money you have, red=money going
out, amber=money waiting/attention, sky=informational.

Design rules codified in `AGENTS.md` section "Dashboard & KPI Card Design —
Approccio Bambino" (8 principles).

### Cards redesigned

1. **DashboardCashFlowCard**: two-column layout (Entrano | Escono) with
   FlowList + result bar ("Restano X" / "Mancano X")
2. **DashboardNetAvailabilityCard**: three-column layout (Incassato | Spese |
   Tasse) with result bar, full grid width
3. **DashboardKpiCards**: 4-col grid, four cards (PendingPayments,
   MonthlyRevenue, AnnualRevenue, OpenQuotes) with inline DeltaArrow, progress
   bars, two-column separators
4. **DashboardDeadlineTracker**: unified "Cosa devi fare" merging old
   AlertsCard + DeadlineTracker — three counters (Scaduti | Prossimi 7g | Da
   fare) + flat action list with colored dots
5. **DashboardDeadlinesCard**: summary bar "N scadenze · €X" at top
6. **DashboardFiscalKpis**: four cards (Netto | Tasse | Accantona | Tetto)
   with semantic colors + inline progress bars
7. **DashboardBusinessHealthCard**: always-visible 4-column layout + margin
   per category (removed collapsible)
8. **DashboardPipelineCard**: two-column summary counters at top
9. **DashboardTopClientsCard**: simplified title
10. **DashboardRevenueTrendChart**: title "Andamento del lavoro"
11. **DashboardCategoryChart**: title "Categorie"
12. **DashboardAnnualAiSummaryCard**: prominent "Spiegami l'anno" button
    (sky, full-width, lg) + color-coded suggested question chips with priority
    hierarchy (priority 1 = big grid, priority 2 = small flex-wrap)

### AI suggested questions

Replaced generic questions with actionable ones. 10 questions per year variant
(current vs past), each with semantic color and visual priority. Questions
include YoY comparison, net income, client cultivation, margin analysis,
pipeline, seasonality, receivables, concentration risk.

Also removed the "Come leggere Annuale" reading guide card (`AnnualReadingGuide`
+ `useStore` dismiss state) — replaced by a single inline subtitle under the
year selector ("Lavoro svolto al DD/MM/YYYY" or "Riepilogo YYYY"). AI card
tests updated to match new UI (prominent button + color-coded chips).

**File toccati**: 14 dashboard files + `annualAnalysis.ts` + `AGENTS.md` +
test file.

## Update 2026-03-08 (g) — Dashboard visual redesign + card standardization

(Superseded by update (h) above — kept for historical reference.)

Redesigned KPI cards with color-coded accent system and standardized structure.

**File toccati**: `DashboardNetAvailabilityCard.tsx`, `DashboardKpiCards.tsx`,
`DashboardAnnual.tsx`.

## Update 2026-03-08 (f) — Expense own/client split in dashboard + form UX

Split `annualExpensesTotal` into `ownExpenses` (no project, no service, no
client) and `clientExpenses` (linked to project, service, or client). The
discriminant is `project_id || source_service_id || client_id`: if any exists,
the expense is client-reimbursable; otherwise it's a true own cost.

Surfaces touched:

1. `dashboardModelTypes.ts`: added `ownExpenses`, `clientExpenses` to `DashboardKpis`
2. `dashboardModel.ts`: aggregation loop splits by `project_id || source_service_id || client_id`
3. `DashboardNetAvailabilityCard.tsx`: shows "Spese proprie" and "Spese su lavori
   (rimborsate dal cliente)" as two separate lines
4. `ExpenseInputs.tsx`: "Spesa a mio carico" Switch toggle — when on, hides
   Progetto/Cliente/Fornitore fields and clears their values; orange warning
   still shown when toggle is off but no links are set
5. `buildAnnualOperationsContext.ts`: AI context includes `ownExpenses`,
   `clientExpenses` with formatted values; caveat updated
6. Test: unit test covers own/client split including `source_service_id` and
   `client_id` cases

No DB migration needed — uses existing `project_id`, `source_service_id` and
`client_id` fields.

## Update 2026-03-08 (f) — CashFlowCard visual redesign

Redesigned `DashboardCashFlowCard` for better visual hierarchy:
- Accent-colored left border (emerald/red) based on positive/negative net flow
- Flow details now collapsible via `<details>` element (was always-expanded)
- Each flow item shows date via `formatShortDate`
- Summary badge always visible (was only on negative flow)
- Removed internal `FlowSection` component — inlined into collapsible markup
- Card moved before alerts/deadlines in `DashboardAnnual.tsx` layout

No logic or data changes — visual/UX only.

## Update 2026-03-08 (e) — Dashboard card reorder for consequential flow

Reordered `DashboardAnnual.tsx` layout. Alerts, deadline tracker, and cash flow
card moved from below trend charts to immediately after KPI cards. Follows
"urgencies first, analysis second" pattern (benchmarked against HoneyBook and
FreshBooks). No logic or data changes — layout only.

New order: net availability → KPIs → alerts/deadlines/cash flow →
trend/categories → pipeline/clients → fiscal simulation → AI summary.

## Update 2026-03-08 (d) — Dashboard Pareto features (net availability, tax tracking, cash flow, YoY)

Four high-impact features added to the annual dashboard following Pareto analysis:

1. **Net Availability KPI** (`DashboardNetAvailabilityCard`): shows
   `cash_received_net − expenses − estimated_taxes_remaining` with full
   breakdown. Uses `fiscalKpis.stimaInpsAnnuale + stimaImpostaAnnuale` for tax
   estimate and subtracts user-tracked payments via `useFiscalPaymentTracking`.

2. **Fiscal payment tracking** (`useFiscalPaymentTracking`): localStorage-based
   persistence via `useStore` (ra-core). Tracks paid amount and date per
   deadline key (`YYYY-MM-DD::label`). `DashboardDeadlinesCard` now shows
   "Segna come pagato" / "Pagato ✓" with green visual feedback.
   `FiscalDeadline` type extended with `paidAmount` / `paidDate` nullable fields.

3. **30-day cash flow forecast** (`DashboardCashFlowCard`): combines pending
   payment inflows (from dashboard alerts) with fiscal deadline outflows.
   Post-processed after fiscal model build to inject deadline amounts.
   `CashFlowForecast` type with `inflows`, `outflows`, `netFlow`.

4. **Year-over-year comparison** (`DashboardYoyBadge`): same-period comparison
   on revenue, cash received, expenses. `buildYearOverYear` computes previous
   year values up to same month; deltas filled in post-processing. Badge shows
   on "Valore del lavoro dell'anno" KPI card.

AI context updated: `cash_received_net` metric and `yearOverYear` section in
`buildAnnualOperationsContext`. Edge Functions updated with AI instructions.

New files:
- `DashboardNetAvailabilityCard.tsx`
- `DashboardCashFlowCard.tsx`
- `DashboardYoyBadge.tsx`
- `useFiscalPaymentTracking.ts`

Tests: 5 new unit tests + 3 new E2E smoke tests.

## Update 2026-03-08 (c) — Expense data in AI annual context

- `DashboardModel` now aggregates expenses by type for the selected year:
  excludes `credito_ricevuto`, computes km reimbursement from DB-saved
  `km_rate`, exposes `annualExpensesTotal`, `annualExpensesCount`,
  `expensesByType` KPIs.
- `buildAnnualOperationsContext` serializes an `expenses` section (total,
  formattedTotal, count, byType) and adds `annual_expenses_total` metric
  with `basis: "cost"`.
- Edge Functions (`annual_operations_summary`, `annual_operations_answer`)
  updated with expense/margin definitions and provisional-year guidance.
  `max_output_tokens` bumped 900→1500.
- `annualOperationsAiGuidance` adds dynamic guardrails: zero-expenses not
  automatic problem, current-year provisional caveat, expense/margin question
  detection (stem matching for spese/speso/spesa + costi/costo/margine),
  and `reframeAnnualOperationsQuestion` for expense questions with time
  qualifier.
- `DashboardAlertsCard`: discrete action links (ExternalLink icon) on each
  alert row navigate to service/quote detail page.
- 15 new unit tests across 4 test files.

## Update 2026-03-08 (b) — Fix: suppliers destructuring in snapshot builder

- `buildUnifiedCrmReadContext` was missing `suppliers` in the destructured
  params — caused ReferenceError at runtime. Added default `suppliers = []`.
- Capability registry test assertion updated to match current description text.

## Update 2026-03-08 (AI layer fully aligned with suppliers)

- AI snapshot now includes `recentSuppliers` (name, VAT, fiscal code, email,
  phone, default expense type, logo), `supplierFinancials` (totalExpenses,
  expenseCount per supplier).
- `recentExpenses` now expose `supplierId` and `supplierName` for the linked
  supplier.
- `upcomingTasks` and `overdueTasks` now expose `supplierId` and
  `supplierName` for supplier-linked reminders.
- `recentContacts` now expose `supplierId` and `supplierName` for contacts
  linked to suppliers.
- Semantic registry: added field descriptions for `suppliers.name`,
  `suppliers.vat_number`, `suppliers.default_expense_type`,
  `expenses.supplier_id`.
- Capability registry: `read_unified_crm_context` and
  `ask_unified_crm_question` now list `suppliers` in `actsOn`.
- Edge Function `unified_crm_answer` instructions updated to describe supplier
  data in the snapshot and guide AI on supplier-related questions.
- `client_notes.supplier_id` FK + SupplierNotesSection in SupplierShow.
- `financial_documents.supplier_id` FK + SupplierFinancialDocsCard +
  SupplierFinancialSummary in SupplierShow.
- `financial_documents_summary` view updated with `supplier_id`,
  `supplier_name`, LEFT JOIN on clients.

## Update 2026-03-07 (suppliers module + import supplier resolution)

- New `suppliers` table with full billing profile, CRUD module, and FK on
  `expenses.supplier_id` (nullable).
- `invoice_import_confirm` now resolves or creates a supplier when importing
  supplier invoices: matches by VAT number, then by name, then creates.
  `supplier_id` is saved on the expense within the same Kysely transaction.
- Semantic registry updated: `supplierAnagraficaResource: "suppliers"`, AI
  scope includes suppliers.

## Update 2026-03-06 (prettier formatting sweep)

- Ran `prettier --write` on 38 files across `src/` and `supabase/functions/`
  to fix CI formatting warnings. No logic or behavior changes — whitespace
  and trailing-comma normalization only.

## Update 2026-03-06 (expanded expense types)

- Added 3 new expense types: `pedaggio_autostradale`, `vitto_alloggio`,
  `abbonamento_software` — supports importing tolls, meals, software
  subscriptions via AI document import.
- Test `UnifiedAiLauncher.test.tsx` updated to use regex matcher for the
  confirmation text which now includes record count suffix.
- Updated across full stack: `types.ts` union, `expenseTypes.ts` choices/labels,
  `expenseLinking.ts` Set, `QuickEpisodeForm.tsx` select + persistence switch,
  `invoiceImportExtract.ts` (Set + JSON schema + AI prompt), `invoiceImportConfirm.ts`
  (Set + type union + normalization cast).
- NOT made configurable from Settings (user decision: too complex).
- Business logic in `ExpenseListContent`, `ExpenseShow`, `fiscalModel`,
  `ClientFinancialSummary` uses `spostamento_km` / `credito_ricevuto` checks
  only — new types fall through to standard amount computation correctly.

## Update 2026-03-06 (travel origin prop fix)

- `TravelRouteCalculatorDialog` in invoice import draft and quick episode form
  now receives `defaultTravelOrigin` from `operationalConfig`, matching the
  existing behavior in `ServiceInputs` and `ExpenseInputs`.
- Pure prop-threading fix, no backend or schema change.

## Update 2026-03-06 (duplicate skip on import confirm)

- `invoice_import_confirm` now **skips duplicates** instead of failing the
  entire batch with 409. Duplicate records are returned in `skipped[]` and
  the remaining records are imported normally.
- Frontend shows separate summaries: green for created, amber for skipped.
- `InvoiceImportConfirmation` type extended with optional `skipped` array.
- Edge Functions `travel_route_estimate` and `travel_location_suggest`
  deployed to remote after Google Maps migration (were still running old
  OpenRouteService code remotely).

## Update 2026-03-06 (invoice import: per-row service dates + description emphasis)

- AI extraction prompt now **explicitly enforces** using the actual service date
  from each table row, not the document emission/header date
- Draft editor label changes dynamically: "Data servizio" for service records,
  "Data documento" for payments/expenses
- Service description field is visually emphasized (`font-semibold text-base`)
  to help identify individual services in the draft

## Update 2026-03-06 (Google Maps migration + invoice import fixes)

- **Google Maps migration**: replaced OpenRouteService with Google Maps APIs
  (Geocoding, Routes v2, Places Autocomplete) for all geocoding/routing.
  New shared module: `supabase/functions/_shared/googleMapsService.ts`.
  Env var: `GOOGLE_MAPS_API_KEY` (replaces `OPENROUTESERVICE_API_KEY` and
  `OPENROUTESERVICE_BASE_URL`). Fixes POI routing failures (e.g. Centro
  Sicilia Misterbianco) and global mis-geocoding.
- Draft editor section headers now use colored dots AND colored text labels
  for clear visual navigation (slate, indigo, blue, emerald, amber, violet)
- `invoice_import_confirm` dedup now includes `description` in the service
  uniqueness check (fixes false duplicate rejection for same-date same-fee
  services with different descriptions)
- `services.km_distance` migrated from `integer` to `numeric(10,2)` to
  support decimal distances from the travel route calculator
- Numeric input fields in draft editor use `value ?? ""` (not `?? 0`) to
  allow manual editing
- Travel route calculator dialog km rate input fixed with same pattern

## Update 2026-03-05 (Invoice import draft editor sectioned layout)

- UI bozza import documenti riorganizzata per sezioni visive: Documento,
  Collegamento CRM, dettagli resource-specific, Anagrafica fiscale
  (collapsible), Note
- File splittato per concern: InvoiceImportDraftEditor (orchestratore) +
  InvoiceImportDraftPrimitives (Field/Section/CollapsibleSection) +
  sezioni per resource (Service, Payment, Expense) + BillingSection +
  invoiceImportDraftHelpers (costanti)
- Nessun cambio funzionale, solo UX e manutenibilita'

## Update 2026-03-05 (Gemini multi-row extraction fix)

- Prompt rinforzato: documenti tabulari con N righe devono produrre N record
  separati. Gemini tendeva a raggruppare in un singolo record riassuntivo

## Update 2026-03-05 (Gemini extraction prompt: notes per servizi)

- Prompt Gemini per import servizi ora include istruzione esplicita per `notes`
- Lo schema JSON lo supportava già, mancava solo la guida nel prompt

## Update 2026-03-05 (AI semantic coherence for service description)

- Intent parsing ora estrae `description` dalla domanda utente (testo tra
  virgolette o dopo "titolo:/descrizione:/oggetto:")
- Handoff service_create e project_quick_episode passano description nei
  search params del form
- Prompt AI aggiornato: istruzioni esplicite sui servizi per progetto e
  sulla distinzione description (titolo breve) vs notes (annotazioni operative)
- Capability registry e caveats snapshot aggiornati

## Update 2026-03-05 (project-level services in AI snapshot)

- La snapshot AI ora espone i singoli servizi dentro ogni progetto attivo
  (array `services` in `activeProjects`, max 20 per progetto)
- Prima erano visibili solo totali aggregati (totalServices, totalFees)
- Il filtro per description e' stato aggiunto anche a ServiceListFilter

## Update 2026-03-05 (service description field)

- Aggiunto campo `description` al modello servizi (migration, type, tutte le
  superfici CRUD, import documenti, AI context, bozza fattura)
- Il campo e' opzionale, testuale, distinto da `notes` (annotazioni operative)
- Non impatta views analytics ne' calcoli fiscali

## Update 2026-03-04 (fiscal cash-basis fix)

- `buildFiscalModel` ora calcola la base imponibile sugli incassi ricevuti
  (principio di cassa, L. 190/2014) invece che sui compensi per competenza
- le metriche operative (margini, DSO, concentrazione clienti) restano su
  base competenza (servizi erogati)
- `buildAnalyticsContext` include caveat esplicito sulla differenza
  competenza/cassa per evitare confusione nell'AI chat
- etichette UI aggiornate: "Fatturato" → "Incassato" dove si riferisce
  alla base fiscale

## Update 2026-03-04

Nuovi elementi rilevanti per handoff AI/analytics:

- read-context CRM esteso con:
  - `overduePayments`
  - `upcomingTasks`
  - `overdueTasks`
  - `pendingPayments[].isTaxable`
- nuovo scadenzario operativo in dashboard annuale (`DashboardDeadlineTracker`)
- nuovo capability action id:
  - `task_create`
  - `generate_invoice_draft`
- rule engine unified answer aggiornato con handoff task/invoice draft
- registry moduli centralizzato (`moduleRegistry`) con risorse AI derivate in
  `crmCapabilityRegistry`
- modulo headless `invoicing` dichiarato nel registry per rendere esplicita la
  capacita' "bozza fattura interna" senza creare una nuova CRUD resource

Bozza fattura — semantica "quanto mi deve ancora?":

- i 4 builder (service/project/client/quote) ora deducono solo pagamenti
  `status === "ricevuto"` dal totale esigibile
- pagamenti `in_attesa` o `scaduto` non riducono il dovuto
- rimborsi (`payment_type === "rimborso"`) hanno segno invertito
- servizi con `invoice_ref` vengono esclusi (gia' fatturati)
- se il totale esigibile e' <= 0, il draft restituisce `lineItems: []`
- `hasInvoiceDraftCollectableAmount()` e' il check unificato nelle Show page
- ogni Show page carica i propri pagamenti con `useGetList<Payment>`
- 9 test unitari aggiunti per coprire i casi edge

Nota tassabilita':

- il flag resta atomico su `services.is_taxable`
- `quotes.is_taxable` e' ora persistito e usato come fallback semantico
- i pagamenti leggono tassabilita' derivata (`isPaymentTaxable`) invece di un
  campo dedicato

Read-context AI esteso:

- `clientFinancials` aggiunto allo snapshot: aggregato per cliente con
  totalFees, totalPaid, balanceDue, hasUninvoicedServices
- tutti i limiti di slicing rimossi: l'AI vede l'intero dataset senza cap
- la chat puo' ora rispondere a "quanto mi deve X?" con importi reali
- system prompt Edge Function aggiornato: stile conciso, istruzioni
  `clientFinancials`, formato risposta Risposta/Dettaglio/Note,
  `max_output_tokens` da 900 a 1200
- intent "bozza fattura" ammorbidito: accetta anche "fattura per X" senza
  verbo d'azione esplicito
- entity matching context-aware: `pickClientFromQuestion` e
  `pickProjectFromQuestion` usati nell'handoff fattura per trovare l'entita'
  menzionata dall'utente
- suggestedActions fattura mostra TUTTE le superfici disponibili (preventivo,
  progetto, cliente) invece di una cascata fissa single-option

## Goal

Prepare the CRM for a historical dashboard and future AI analysis by introducing:

- a semantic analytics layer,
- an operational semantic backbone for CRM fields and shared formulas,
- aggregate Supabase views,
- a dedicated `Storico` dashboard mode,
- a path toward one unified AI experience instead of scattered page-level AI
  surfaces,
- and continuity docs that survive chat/session resets.

## Final Product Goal

The real destination is not "more AI cards".

The real destination is:

- one unified AI chat that can read and eventually operate across the whole
  CRM,
- backed by strong semantic definitions for fields, states, dates, formulas,
  tools, pages, modals, and business actions,
- so the AI can avoid writing in the wrong place, using the wrong workflow, or
  inventing false meanings.

This means the current page-level AI widgets are only temporary bridges.
Current work should keep strengthening semantics, business links, and shared
registries instead of multiplying isolated AI entry points.

## Current AI Execution Policy

The approved execution policy is now explicit:

- general CRM chat:
  - `read-only` first
- broader CRM writes from the unified chat:
  - only later
  - only as assisted workflows
  - only with explicit user confirmation
- free autonomous writes across the CRM:
  - not approved

Today the only shipped AI-assisted write flow is invoice import, and it still
requires explicit confirmation before creating `payments`, `expenses`, or
`services`.

## Non-Negotiable Rules

- customer outbound email direction:
  - `Gmail`
- internal high-priority notification direction:
  - `CallMeBot`
- old inbound branch:
  - `Postmark` non fa parte del runtime/config attivo e deve restare fuori dai
    flussi supportati salvo cambio esplicito di direzione prodotto
- communication safety rule:
  - if a flow includes services with `is_taxable = false`, automatic customer
    emails must never be sent
- local browser smoke routes:
  - always use hash routing:
    - `http://127.0.0.1:4173/#/...`

## Historical Naming Note

Some older sections below still quote remote observations collected before the
fiscal/customer correction introduced by
`20260301193000_correct_diego_client_to_gustare_assoc.sql`.

When those historical notes mention `Diego Caltabiano` as if it were the
client label, read them as pre-correction runtime evidence only.

The current canonical interpretation is:

- `ASSOCIAZIONE CULTURALE GUSTARE SICILIA` = fiscal client
- `Diego Caltabiano` = linked operational contact

## Current Recovery Plan

This plan now supersedes the older "next high-value AI/commercial slice"
language still present lower in this historical handoff.

The current order is explicit:

1. rebuild the local business dataset from real source-of-truth files
2. fix system semantics on top of those real data
3. realign UI, AI, import, analytics and linked business flows
4. only after that, rewrite or extend smoke/E2E coverage

Current source-of-truth order:

- first `Fatture/` (XML outgoing and incoming invoices)
- then `Fatture/contabilità interna - diego caltabiano/` for details not
  present in invoices alone
- then Aruba Fatturazione Elettronica portal for exact collection dates
  (coded as `ARUBA_PORTAL_TRUTH` in `scripts/local-truth-data.mjs`)

Current explicit runtime truth that must survive chat resets:

- all outgoing invoices from 2023, 2024 and 2025 are operationally `ricevuto`
  with exact collection dates from the Aruba portal (screenshots 2026-03-02)
- the only exception is `FPA 1/23` dated `2023-10-30` ("Non incassata" per
  the Aruba portal), tied to the `NONSOLOLIBRI` work
- FPA 1/25 and FPA 2/25 are "Stornata" (credit note pair, handled by code)
- Diego/Gustare is fully paid: EUR 23,987.64 invoiced, EUR 23,987.64 collected
- FPR 6/25 (Borghi Marinari, EUR 7,152.10) was corrected from "scaduto" to
  "ricevuto 11/11/2025" via the Aruba portal truth

Current non-negotiable consequences:

- do not treat hardcoded local domain fixtures as a stable foundation
- do not grow test coverage ahead of system correctness
- do not open the supplier domain before the current financial semantics are
  under control
- do not widen general AI write power while the domain model is still weak

Current structural warning:

- the main system fragility is still the overloaded meaning of:
  - invoice/document
  - receivable/payable state
  - actual cash movement
- the project must converge toward a clearer separation of those meanings
  before more expansion work

## How To Resume In A New Chat

Use a prompt like this:

```text
Leggi docs/README.md, docs/development-continuity-map.md, docs/historical-analytics-handoff.md, docs/historical-analytics-backlog.md, docs/contacts-client-project-architecture.md e doc/src/content/docs/developers/historical-analytics-ai-ready.mdx.
Considera come obiettivo finale una chat AI unificata su tutto il CRM, ma senza aggiungere nuove AI sparse: prima vanno mantenute solide semantica, workflow e dati.
Non ridefinire l'architettura già approvata.
Continua dal primo punto aperto del backlog.
Se aggiungi o cambi una feature, aggiorna sempre semantic registry, capability registry, eventuale communication layer, settings se la modifica e' config-driven, test e docs di continuità.
Non chiudere mai una modifica senza sweep completo delle superfici impattate: pagine, create/edit/show/list/filter, dialog/sheet/modal, helper di linking o persistence, provider e funzioni server collegate.
Ricorda i vincoli di prodotto: Gmail per mail cliente, CallMeBot per alert interni urgenti, nessuna mail automatica se ci sono servizi con is_taxable = false.
Usa progress.md e learnings.md solo se serve ricostruire una decisione storica o recuperare un pattern specifico.
```

Minimal reading order for a new session:

1. `docs/README.md`
2. `docs/development-continuity-map.md`
3. `docs/historical-analytics-handoff.md`
4. `docs/historical-analytics-backlog.md`
5. `docs/contacts-client-project-architecture.md`
6. `doc/src/content/docs/developers/historical-analytics-ai-ready.mdx`

Optional deep archive, only if needed:

- `progress.md`
- `learnings.md`

## Mandatory Integration Checklist For New Features

If a new feature changes real CRM behavior, it is not considered integrated
until the relevant items below are updated too:

1. database shape / migration / view / function if business data changes
2. shared semantic meaning in `crmSemanticRegistry` if new states, types,
   categories, formulas, dates, or descriptions are introduced
3. shared capability meaning in `crmCapabilityRegistry` if a new page, route,
   modal, tool, or business action appears
4. communication rules/templates if the feature can send customer or internal
   notifications
5. provider entry points if the frontend or future AI needs one stable access
   method
6. `defaultConfiguration`, `ConfigurationContext`, `SettingsPage` and the
   relevant settings section if the new rule is user-configurable or changes
   a shared default
7. tests for the new invariant or user-visible behavior
8. continuity docs:
   - `docs/development-continuity-map.md`
   - `docs/historical-analytics-handoff.md`
   - `docs/historical-analytics-backlog.md`
   - the relevant canonical/working docs for the touched domain
   - `progress.md` only if the change adds relevant historical chronology
   - `learnings.md` only if a new reusable pattern emerged

This checklist exists because the future unified AI must know every important
surface and rule of the CRM, not guess them from scattered components.

There is now one additional non-negotiable continuity rule:

- if a change touches one of the operational modules
  - `projects`
  - `services`
  - `quotes`
  - `payments`
  - `expenses`
  - `tasks`
  - document import
  - annual dashboard
  - historical dashboard
  - unified AI launcher
- you must also review connected pages, dialogs/sheets/modals, provider entry
  points, helpers/linking/persistence files, and any related Edge Functions
- the detailed sweep map now lives in:
  - `docs/development-continuity-map.md`

## Immediate Pareto Next Step

The previous Pareto step is now closed:

- manual quote-status customer email sending now goes through `Gmail SMTP`,
- reusing `quoteStatusEmailTemplates`,
- with one manual preview/send dialog in quote show,
- and still preserving the hard safety rule for `is_taxable = false`.
- runtime verification is now closed too on the linked remote project:
  - `SMTP_*` secrets set on `qvdmzhyzpyaveniirsmo`
  - `quote_status_email_send` deployed remotely
  - authenticated invoke returned `accepted` with SMTP response `250 2.0.0 OK`
  - smoke user and smoke data cleaned after verification

The next Pareto step is now closed too:

- a first unified AI launcher now exists as a small floating button,
- it is available across the CRM from the shared layout,
- it opens one global shell instead of adding a new page in header/nav,
- and it declares the write-safety rule explicitly before invoice ingestion is
  added.

The next Pareto step is now closed too:

- `Impostazioni -> AI` now has a separate invoice-extraction model field
- the default is `gemini-2.5-pro`
- older persisted configs keep working because nested AI defaults now merge
  safely instead of replacing the whole `aiConfig` object

The next Pareto step is now closed too:

- the unified launcher now supports the first real invoice workflow using
  `@google/genai`,
- mixed upload now works for `PDF` digitali + scansioni/foto,
- the chat now returns one structured proposal editable directly in the same
  shell before saving,
- confirmation now writes only into existing CRM resources:
  - `payments`
  - `expenses`
- semantic registry, capability registry, provider entry points, tests, and
  continuity docs were updated in the same pass
- runtime verification is now closed too on the linked remote project:
  - `GEMINI_API_KEY` set on `qvdmzhyzpyaveniirsmo`
  - `invoice_import_extract` deployed remotely
  - authenticated smoke on mixed files (`customer.pdf` + `supplier.png`)
    returned:
    - one `payments` draft
    - one `expenses` draft
  - the corrected proposal was then confirmed into real remote
    `payments` / `expenses`
  - smoke user and smoke CRM data were cleaned after verification

The next Pareto step is now closed too:

- the launcher now loads one read-only CRM snapshot in the same shell
- the snapshot reuses:
  - `crmSemanticRegistry`
  - `crmCapabilityRegistry`
  - one stable provider entry point:
    - `dataProvider.getUnifiedCrmReadContext()`
- the launcher now shows coherent counts and recent records for:
  - `clients`
  - `quotes`
  - `projects`
  - `payments`
  - `expenses`
- no new standalone AI page or route was added while doing this

The next Pareto step is now closed too:

- the launcher now supports the first real read-only AI answer on top of the
  shared CRM-wide snapshot
- the answer flow stays in the same global shell and uses the same snapshot the
  user sees in UI
- the text model remains the existing analytic/read-only model setting in
  `Impostazioni -> AI`
- the read boundary is now explicit in docs, semantic registry, capability
  registry, launcher copy and Edge Function prompt
- runtime verification is now closed too on the linked remote project:
  - `unified_crm_answer` deployed remotely on `qvdmzhyzpyaveniirsmo`
  - authenticated smoke question returned HTTP `200`
  - the answer used real CRM counts/totals and repeated the write boundary
  - smoke user cleaned after verification

The next Pareto step is now closed too:

- grounded launcher answers now return the first structured handoff suggestions
  toward existing CRM routes
- the suggested actions are built deterministically from the shared snapshot and
  the approved hash route prefix, not invented by the model
- the launcher now lets the user jump from one grounded answer to:
  - record detail routes
  - resource list routes
  - dashboard
- runtime verification is now closed too on the linked remote project:
  - `unified_crm_answer` redeployed remotely on `qvdmzhyzpyaveniirsmo`
  - authenticated smoke question `Chi mi deve ancora pagare?` returned HTTP
    `200`
  - the response included:
    - grounded markdown answer
    - `suggestedActions` for `payments show`, `payments list`, `client show`
  - smoke user cleaned after verification

The next high-value step is now closed too:

- grounded launcher answers now escalate from generic route jumps to the first
  action-oriented commercial handoff on already approved surfaces
- the launcher now prioritizes existing approved actions such as:
  - `quote_create_payment`
  - `client_create_payment`
  - `project_quick_payment`
- the answer panel marks those cases explicitly as `Azione approvata`
- the handoff targets still stay deterministic and system-built:
  - prefilled `payments/create` routes are assembled from snapshot ids
  - project quick-payment jumps reuse the existing project surface
  - commercial URLs are not invented by the model
- runtime verification is now closed too on the linked remote project:
  - `unified_crm_answer` redeployed remotely on `qvdmzhyzpyaveniirsmo`
  - authenticated smoke question `Chi mi deve ancora pagare?` returned HTTP
    `200`
  - the response included:
    - grounded markdown answer
    - one generic `payments show` handoff
    - one approved commercial handoff for `quote_create_payment`
    - one approved commercial handoff for `project_quick_payment`
  - smoke user cleaned after verification

The next high-value step is now:

- keep the same floating shell and make the commercial handoff more guided,
  not more autonomous
- choose the right approved commercial surface with stronger intent/context
  mapping before considering any direct execution from chat
- keep the general CRM chat without direct write execution:
  - no free writes
  - no auto-execution
  - no new scattered AI surfaces

That next high-value step is now closed too:

- launcher `suggestedActions` now expose one explicit primary recommendation
  when the snapshot + question intent make it deterministic
- payment-oriented questions that already ask to `registrare`/`aggiungere`
  something now prioritize the approved payment entry point instead of a
  generic record jump
- the recommendation stays system-built, not model-invented:
  - exactly one action can be marked as recommended
  - the recommendation reason is derived from snapshot state and action type
  - the answer panel renders `Consigliata ora` plus the reason inline
- runtime verification is now closed too on the linked remote project:
  - `unified_crm_answer` redeployed remotely on `qvdmzhyzpyaveniirsmo`
  - authenticated smoke question
    `Da dove posso registrare un pagamento sul preventivo aperto?`
    returned HTTP `200`
  - the response included:
    - first `suggestedAction` = `quote_create_payment`
    - `recommended = true`
    - deterministic `recommendationReason`
  - smoke user cleaned after verification

The next high-value step is now:

- keep the launcher inside approved commercial surfaces, but make the landing
  on those surfaces richer and more contextual
- pass the user from recommendation to the right approved destination with the
  strongest existing prefill/context before discussing any chat-side write
  draft
- still no general write execution from the CRM Q&A shell

That next high-value step is now closed too:

- approved launcher handoffs now land on CRM surfaces with richer context,
  without inventing new write workflows
- `payments/create` handoffs now carry deterministic launcher metadata plus the
  strongest already-supported prefills:
  - linked `quote_id`
  - linked `client_id`
  - linked `project_id`
  - inferred `payment_type` when the question makes it explicit
- `project_quick_payment` handoffs now land on project show with:
  - deterministic launcher metadata
  - `open_dialog=quick_payment`
  - inferred `payment_type` when available
- the destination surfaces now consume that context without executing anything:
  - `PaymentCreate` shows a launcher banner and respects `payment_type`
  - `ProjectShow` shows the launcher banner
  - `QuickPaymentDialog` auto-opens only from the approved deep-link and only
    after financial totals are available
- runtime verification is now closed too on the linked remote project:
  - `unified_crm_answer` redeployed remotely on `qvdmzhyzpyaveniirsmo`
  - authenticated smoke question
    `Come posso registrare il saldo del progetto attivo?` returned HTTP `200`
  - the first `suggestedAction` was:
    - `project_quick_payment`
    - `recommended = true`
    - href with:
      - `launcher_source=unified_ai_launcher`
      - `launcher_action=project_quick_payment`
      - `open_dialog=quick_payment`
      - `payment_type=saldo`
  - smoke user cleaned after verification

The next high-value step is now:

- keep the launcher inside approved commercial surfaces, but start closing the
  last context gaps that still require the user to fill fields manually after
  landing
- prioritize missing prefills or missing approved destination variants before
  discussing any general chat-side write draft
- still no general write execution from the CRM Q&A shell

That next high-value step is now closed too:

- the quote-driven payment landing is now stronger on the existing
  `payments/create` surface
- when a payment is linked to a quote, the destination form now reads the
  existing linked-payment state and shows:
  - quote amount
  - already linked total
  - remaining still-unlinked amount
- standard payment types can now receive a deterministic amount suggestion on
  the destination surface:
  - the suggestion is derived from the quote residual already not linked to any
    payment
  - it is never generated by the model
  - it stays editable by the user
- reimbursement-like payment types do not get an automatic amount suggestion on
  this surface
- this slice did not require a function redeploy:
  - validation closed locally with `npm run typecheck`
  - targeted Vitest passed on payment linking + registries

The next high-value step is now closed too:

- the unified launcher can now expose a first narrow `payment` write-draft
  without writing anything directly in the CRM Q&A shell
- the draft is intentionally strict:
  - only quote-driven
  - only when the quote status allows payment creation
  - only when a deterministic residual amount still exists
  - only for `acconto` / `saldo` / `parziale`
- the answer flow now returns a structured `paymentDraft` payload separate from
  markdown, so the UI can:
  - let the user adjust `paymentType`
  - let the user adjust `amount`
  - let the user adjust `status`
  - carry the draft into the approved `payments/create` surface
- the launcher still does not write:
  - the CTA opens `payments/create`
  - real persistence still starts only from the destination form with explicit
    user confirmation
- runtime verification is now closed too on `qvdmzhyzpyaveniirsmo`:
  - `unified_crm_answer` redeployed
  - authenticated smoke question
    `Preparami una bozza saldo dal preventivo aperto.` returned a structured
    `paymentDraft`
  - returned draft contained:
    - `paymentType=saldo`
    - `amount=450`
    - `status=in_attesa`
    - approved href to `/#/payments/create?...&draft_kind=payment_create`
  - smoke user cleaned after verification

The next high-value step is now closed too:

- the first confirmation-on-surface upgrade around the payment draft is now in
  place on `payments/create`
- the approved destination surface now distinguishes between:
  - the explicit amount carried from the launcher draft
  - the deterministic residual suggestion calculated locally from the linked
    quote
- if the user already changed the draft amount in the launcher, the destination
  form now preserves that explicit value on first render instead of overwriting
  it with the residual suggestion
- the destination UI now makes that distinction visible:
  - it shows the amount coming from the AI draft
  - it shows the current local residual when different
  - it still lets the user switch to the residual suggestion explicitly
- this slice stayed fully inside the approved payment surface:
  - no new write capability was introduced
  - no function redeploy was required
  - validation closed locally with `npm run typecheck` and targeted Vitest

The next high-value step is now closed too:

- the approved `payments/create` surface now keeps the imported payment draft
  scoped to the same quote that originated it
- if the user changes quote after landing on the form:
  - the imported draft amount is no longer treated as the active draft value
  - the local residual suggestion for the newly selected quote can resume its
    normal deterministic behavior
  - the UI no longer presents the old draft amount as if it still belonged to
    the new quote
- this closes a real continuity gap in the strict `launcher -> approved form`
  path:
  - preserve explicit draft edits while the business context is the same
  - stop preserving them when the user changes the linked quote context
- this slice stayed local:
  - no function redeploy
  - local validation closed with `npm run typecheck` and targeted Vitest

The next high-value step is now closed too:

- the approved `payments/create` surface now makes the end of draft continuity
  explicit instead of only behaving correctly in silence
- when the user changes quote away from the one that originated the launcher
  draft:
  - the old draft amount is no longer treated as active
  - the form now also tells the user that the original AI draft belonged to a
    different quote
  - from that point onward only the local context of the currently selected
    quote is considered valid
- this keeps the strict path more understandable:
  - preserve the draft while the business context is still the same
  - explicitly signal when that context has ended
- this slice stayed local:
  - no function redeploy
  - local validation closed with `npm run typecheck` and targeted Vitest

The next high-value step is now closed too:

- the approved `payments/create` surface no longer fights the user on the
  amount field after the first manual edit
- if the user enters the amount field and starts changing it:
  - the automatic residual suggestion stops taking control of the field
  - the user can still explicitly re-apply the local suggestion through the CTA
  - clearing the field temporarily while typing no longer causes an automatic
    re-fill race
- this closes another real stability gap on the same approved corridor:
  - local deterministic suggestions stay available
  - but they stop overriding manual intent once the user takes control
- this slice stayed local:
  - no function redeploy
  - local validation closed with `npm run typecheck` and targeted Vitest

The next high-value step is now closed too:

- the launcher now supports a second narrow payment write-draft on the already
  approved `project_quick_payment` surface
- the read-only CRM snapshot now carries deterministic active-project
  financials derived from services, expenses and received payments:
  - `totalFees`
  - `totalExpenses`
  - `totalPaid`
  - `balanceDue`
- when the user asks to prepare a payment from the active project, the launcher
  can now propose a project-driven payment draft with:
  - `paymentType`
  - `amount`
  - `status`
- that draft still does not write from chat:
  - it deep-links only to the existing quick payment dialog on the project
  - the dialog remains manual and confirmation still happens there
- this closes the only remaining second write-assisted case that was still
  legitimate in this phase because it stays as deterministic and as tightly
  bounded as the quote-driven payment path
- local validation closed with:
  - `npm run typecheck`
  - targeted Vitest on read context, payment linking, shared AI answer builder,
    and launcher UI

Default continuation after this:

- do not widen the general CRM chat into direct write execution
- do not open another write-assisted case by default unless a new real workflow
  gap is demonstrated
- treat further expansion as explicit next-scope work, not as automatic
  continuation of this phase

Tactical UX slice closed out of sequence:

- the unified launcher no longer stacks snapshot, chat, and invoice import in a
  single endless scroll
- `Chat AI` is now the default primary view
- secondary views moved behind a `+` menu:
  - `Snapshot CRM`
  - `Importa fatture e ricevute`
- the launcher chat now follows a standard chat layout:
  - conversation and results stay above
  - the composer stays anchored at the bottom of the panel
  - the `+` action now lives to the left of the composer input, away from the
    drawer close control
- the CRM chat stays mounted while switching views, so question/answer state is
  preserved during navigation inside the same launcher session
- invoice import and payment-draft logic were only extracted/reframed, not
  functionally widened
- local validation closed with:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`

Deferred note from real user trial:

- invoice import can already read a valid historical customer invoice even when
  that client does not exist yet in the CRM
- today the launcher correctly stops before creating a missing client
- later there must be a dedicated slice for:
  - billing-specific client fields missing from the current anagraphic model
  - AI-assisted client creation from invoice import, still only after explicit
    confirmation

Do not open new scattered AI surfaces while doing this. The launcher, the
separate Gemini setting, and the existing semantic/capability foundations are
now the approved entry points for the next AI work too.

## Parallel Track Started: Commercial Backbone

Besides analytics/AI work, a new foundational track has now started to prepare
the CRM for future `AI-driving` behavior:

- goal:
  - make the commercial chain explicit and reliable before extending AI across
    the whole CRM
- current chain:
  - `Quote -> Project -> Payment`
- principle:
  - reduce clicks and keep the UX guided,
  - but do not introduce forced automations when multiple interpretations are
    possible.

## Stop Line For This Phase

This phase is not supposed to generate endless slices.

The intended finish line is:

- `Storico` stable on the approved semantic split:
  - `compensi`
  - `incassi`
- `Annuale` AI limited to the already approved `annual_operations` scope
- commercial flow solid on the real cases now needed:
  - `client -> payment`
  - `quote -> payment`
  - `quote -> project -> payment`
- no forced `quote` or `project` when the job is simpler than that

Treat as already sufficient for this phase:

- the current `Storico` AI path
- the current `Storico` non-AI cash-inflow path
- the current `Annuale` AI operational path
- the current client/quote/project/payment links already validated on the real
  UI

Treat as still acceptable in this phase:

- keeping tests aligned with the shipped widgets
- closing at most one more small commercial gap if it improves real data
  quality or guided UX

Treat as `v2`, not as mandatory continuation of this phase:

- full-page AI over all of `Annuale`
- global conversational AI across the CRM
- more dashboard cards without a strong clarity gain
- workflow bureaucracy that creates records no one really needs

## Strategic AI UX Goal

Another fundamental product goal is now explicit:

- remove the AI interfaces currently scattered across individual pages,
- converge toward one unified AI experience,
- preserve the useful capabilities already shipped,
- and do that without regressions in clarity or ease of use.

Practical consequence for new work:

- do not add new AI entry points casually just because a page can host one,
- prefer semantic/context work that can later feed a unified AI shell,
- and treat the current page-level AI cards as transitional surfaces, not as
  the desired end state.

## What Was Completed

### Product and semantic rules locked in code/docs

- Historical analytics basis v1 is `compensi per competenza`, not `incassi`.
- Current year is always treated as `YTD`.
- `YoY` is computed only on the last two closed years.
- `YoY` returns `N/D` when:
  - there are fewer than two closed years,
  - or the comparison baseline is `0`.

Reference spec:

- `doc/src/content/docs/developers/historical-analytics-ai-ready.mdx`

### Supabase aggregate views added

Migration created:

- `supabase/migrations/20260228133000_historical_analytics_views.sql`

Views introduced:

- `analytics_business_clock`
- `analytics_history_meta`
- `analytics_yearly_competence_revenue`
- `analytics_yearly_competence_revenue_by_category`
- `analytics_client_lifetime_competence_revenue`

### Frontend implementation added

New dashboard modules:

- `src/components/atomic-crm/dashboard/DashboardAnnual.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistorical.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistoricalKpis.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistoricalRevenueChart.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistoricalCategoryMixChart.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistoricalTopClientsCard.tsx`
- `src/components/atomic-crm/dashboard/useHistoricalDashboardData.ts`
- `src/components/atomic-crm/dashboard/dashboardHistoryModel.ts`

Existing shells updated:

- `src/components/atomic-crm/dashboard/Dashboard.tsx`
- `src/components/atomic-crm/dashboard/MobileDashboard.tsx`

Provider update:

- `src/components/atomic-crm/providers/supabase/dataProvider.ts`

### AI-ready semantic layer added

New library files:

- `src/lib/analytics/analyticsDefinitions.ts`
- `src/lib/analytics/buildAnalyticsContext.ts`

Provider entry point added:

- `dataProvider.getHistoricalAnalyticsContext()`
- `dataProvider.getHistoricalCashInflowContext()`
- `dataProvider.generateHistoricalAnalyticsSummary()`
- `dataProvider.askHistoricalAnalyticsQuestion()`

First end-user consumer added:

- `src/components/atomic-crm/dashboard/DashboardHistoricalAiSummaryCard.tsx`

OpenAI server-side integration added:

- edge function: `supabase/functions/historical_analytics_summary/index.ts`
- edge function: `supabase/functions/historical_analytics_answer/index.ts`
- settings section: `src/components/atomic-crm/settings/AISettingsSection.tsx`

Purpose:

- centralize metric definitions,
- expose a structured context object for future AI analysis,
- prevent the AI from inferring business semantics from raw tables.

### Capability registry and quote-status email flow added

New library files:

- `src/lib/semantics/crmCapabilityRegistry.ts`
- `src/lib/semantics/crmCapabilityRegistry.test.ts`
- `src/lib/communications/quoteStatusEmailTemplates.ts`
- `src/lib/communications/quoteStatusEmailTemplates.test.ts`
- `src/lib/communications/quoteStatusEmailContext.ts`
- `src/lib/communications/quoteStatusEmailContext.test.ts`

New UI / function pieces:

- `src/components/atomic-crm/quotes/SendQuoteStatusEmailDialog.tsx`
- `src/components/atomic-crm/quotes/SendQuoteStatusEmailDialog.test.tsx`
- `supabase/functions/quote_status_email_send/index.ts`
- `supabase/functions/_shared/quoteStatusEmailSend.ts`
- `supabase/functions/_shared/quoteStatusEmailSend.test.ts`

Purpose:

- give the future unified AI one explicit catalog of:
  - pages
  - resources
  - dialogs
  - actions
  - route conventions
- avoid making the AI guess what the CRM can or cannot do
- introduce one shared email-template layer for quote status updates instead of
  writing customer emails ad hoc in page components

Current behavior:

- the capability registry now declares:
  - main CRM resources, including `contacts` as a first-class navigable
    resource and not just an embedded legacy surface
  - hash-route conventions
  - important dialogs such as:
    - quote create/show/edit
    - send quote-status email
    - create project from quote
    - quick episode
    - quick payment
  - important business actions such as:
    - drag-and-drop quote status change
    - manual quote-status customer email send
    - create payment from quote
    - create payment from client
    - create project from quote
- the quote-status email layer now declares:
  - per-status send policy:
    - `never`
    - `manual`
    - `recommended`
  - shared dynamic sections
  - HTML + plain-text rendering
  - missing-field detection before sending
  - and a hard safety rule:
    - if the flow includes services with `is_taxable = false`, automatic email
      send must stay blocked
- provider entry points now exist for UI or future AI reuse:
  - `dataProvider.getQuoteStatusEmailContext()`
  - `dataProvider.sendQuoteStatusEmail()`
- quote show now exposes one manual `Invia mail cliente` dialog:
  - subject/body preview
  - optional custom message
  - Gmail SMTP send on confirmation only
  - disabled send when required fields are missing
- the shared context now computes customer-facing payment meaning explicitly:
  - `amountPaid` = only linked payments already `ricevuto`
  - `amountDue` = quote amount minus only received linked payments

Outbound provider decision:

- outbound customer-status emails should target `Gmail`, not `Postmark`
- the actual transport is now wired through `Gmail SMTP`
- current UX remains manual only:
  - no automatic send path has been introduced

Important note:

- the old inbound `postmark` branch is not part of the active runtime/config
- customer-facing outbound communication should go through `Gmail`
- high-priority internal alerts should target `CallMeBot`

Current behavior:

- the AI context now includes `meta`, `metrics`, `series`, `qualityFlags`, and
  human-readable `caveats`,
- the first delivery surface is the custom data-provider method above,
- the historical dashboard now has a manual `Analisi AI` card that calls the
  edge function only on user action,
- the same card now supports both:
  - a guided summary flow,
  - and a single-turn free question flow constrained to historical data only,
- the chosen model is configured in Settings and defaults to `gpt-5.2`,
- the visible dashboard copy is now translated into plain Italian for a
  non-expert business owner,
- the AI prompt now explicitly avoids jargon and explains terms like `YTD`,
  `YoY`, and `competenza` in simpler language,
- the AI card now renders markdown lists with clearer bullets and spacing,
- the Q&A flow includes suggested questions, a `300` character limit, and no
  memory between turns,
- there is still no multi-turn conversational assistant/chat flow in the UI.

### Historical cash-inflow semantic entry point added

Migration created:

- `supabase/migrations/20260228193000_add_historical_cash_inflow_view.sql`

Semantic resource introduced:

- `analytics_yearly_cash_inflow`

Supporting frontend/library pieces:

- `src/lib/analytics/buildHistoricalCashInflowContext.ts`
- `src/lib/analytics/buildHistoricalCashInflowContext.test.ts`
- `src/lib/analytics/analyticsDefinitions.ts`
- `src/components/atomic-crm/providers/supabase/dataProvider.ts`

Purpose:

- expose historical `incassi` as a separate semantic basis,
- keep them explicitly distinct from `compensi per competenza`,
- give future AI or UI consumers a safe entry point without reading raw
  `payments`.

Current behavior:

- the view groups only received payments by `payment_date`,
- `rimborso` rows are excluded,
- the current year is still marked as `YTD`,
- the custom provider now exposes
  `dataProvider.getHistoricalCashInflowContext()`,
- and future or current consumers can reuse one shared semantic context without
  reading raw `payments`.

### Operational semantic backbone added

Migration created and pushed remotely on `2026-02-28`:

- `supabase/migrations/20260228220000_add_service_taxability_and_operational_semantics.sql`

New shared semantic pieces:

- `src/lib/semantics/crmSemanticRegistry.ts`
- `src/lib/semantics/crmSemanticRegistry.test.ts`
- `dataProvider.getCrmSemanticRegistry()`

Configuration additions:

- `operationalConfig.defaultKmRate`
- descriptions on configurable `quoteServiceTypes`
- descriptions on configurable `serviceTypeChoices`

Operational rules now centralized:

- fixed dictionaries now carry AI-readable descriptions for:
  - client types
  - acquisition sources
  - project categories / statuses / TV shows
  - quote statuses
  - payment types / methods / statuses
- shared formulas now cover:
  - service net value
  - taxable service net value
  - travel reimbursement
  - date-range interpretation via `all_day`

Behavioral changes:

- `services` now expose `is_taxable`
- service create/edit flows default `is_taxable = true`
- service and expense forms use one configurable km rate default
- quick TV episode creation uses the same km-rate rule and marks services as
  taxable by default
- the fiscal model now treats `is_taxable` as a fiscal-base switch only:
  - fiscal KPIs use taxable service revenue
  - business-health KPIs keep using full operational revenue

Purpose:

- let future AI read domain meanings from one place instead of guessing from
  raw columns,
- support future AI write flows with clearer target fields and rules,
- and prevent drift between UI calculations, fiscal calculations, and AI
  interpretation.

Remote validation completed on `2026-02-28`:

- `npx supabase db push` applied the migration on the linked project
- `service_role` REST query confirmed the new rows existed remotely
- authenticated REST query with a temporary user confirmed the same resource is
  readable on the real frontend auth path too
- observed remote rows:
  - `2025`:
    - closed year
    - `cash_inflow = 22241.64`
    - `payments_count = 11`
  - `2026`:
    - `YTD`
    - `cash_inflow = 1744.00`
    - `payments_count = 1`

### Historical cash-inflow AI consumer added

New frontend/UI pieces:

- `src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowAiCard.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowAiCard.test.tsx`

Provider methods added:

- `dataProvider.generateHistoricalCashInflowSummary()`
- `dataProvider.askHistoricalCashInflowQuestion()`

Edge Functions added:

- `supabase/functions/historical_cash_inflow_summary/index.ts`
- `supabase/functions/historical_cash_inflow_answer/index.ts`

Runtime config updated:

- `supabase/config.toml`
  - `[functions.historical_cash_inflow_summary]`
  - `[functions.historical_cash_inflow_answer]`
  - both with `verify_jwt = false`

Purpose:

- expose a first end-user consumer of historical `incassi`,
- keep it clearly separate from the existing competence-based historical card,
- validate that the new cash-inflow context is usable by the same AI product
  pattern already used elsewhere.

Current behavior:

- `Storico` now renders two separate AI cards:
  - one for `compensi`
  - one for `incassi`
- the new card supports:
  - guided summary
  - single-turn free question
- the new card reuses the existing model selection in Settings,
- but it keeps copy and prompts explicitly centered on received cash only.

Browser validation completed on `2026-02-28`:

- authenticated login on the real local runtime
- open `Storico`
- trigger guided summary on `AI: spiegami gli incassi`
- trigger suggested question:
  - `Qual è stato l'anno con più incassi ricevuti?`
- observed result:
  - guided summary rendered
  - question answer rendered
  - visible output mentioned `2025`
  - console errors observed:
    - `0`
  - page errors observed:
    - `0`

Important operational note:

- the first deploy returned `401 Invalid JWT` in browser,
- root cause was not the prompt or the provider method,
- root cause was missing `verify_jwt = false` entries for the new function
  slugs in `supabase/config.toml`,

### Historical cash-inflow non-AI surface added

New frontend/UI pieces:

- `src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowCard.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowCard.test.tsx`

Purpose:

- give `Storico` a first plain visual surface for `incassi` without requiring
  an AI question first,
- reuse the same semantic context already used by the AI card,
- keep received cash explicitly separate from competence-based widgets.

Current behavior:

- `Storico` now renders one dedicated non-AI card for historical `incassi`,
- the card shows:
  - total historical cash received
  - latest closed-year cash received
  - the latest yearly rows with payment/project/client counts
  - the first semantic caveat from the shared context
- the card is full-width and intentionally sits outside:
  - competence KPI/chart blocks
  - AI cards
- no competence KPI/chart label was changed or mixed with cash wording.

Validation completed on `2026-02-28`:

- `npm run typecheck`
- `npm test -- --run src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowAiCard.test.tsx src/lib/analytics/buildHistoricalCashInflowContext.test.ts`

Observed test coverage:

- ready state
- empty state
- error state + retry
- `Storico` parent render including the new card
- redeploy after adding those entries fixed the browser path.

### Annual dashboard normalization completed before any AI rollout there

Important constraint discovered after the historical flow shipped:

- `Annuale` was not semantically safe enough for AI as-is,
- it mixed operational revenue, pending cash collection, quote pipeline,
  current alerts, and fiscal simulation in one screen,
- and some parts did not even share the same revenue basis or selected-year
  filter.

Fixes now applied in code:

- annual operational revenue is derived directly from `services`, not from the
  aggregated `monthly_revenue` view,
- the same net-of-discount basis is now used consistently for:
  - annual KPI totals,
  - annual chart,
  - category mix,
  - top clients,
- the current year is now read as `finora`:
  - future services later in the same year are excluded from the operational
    totals,
  - and the annual chart now shows the selected-year window only, not a
    trailing-12-month mix,
- the fiscal/business-health block now filters correctly on the selected year
  for:
  - quote conversion rate,
  - weighted pipeline value,
  - DSO,
- the fiscal UI copy now explicitly frames that section as simulation, not
  definitive accounting truth,
- a defensive migration was added:
  - `supabase/migrations/20260228150000_normalize_monthly_revenue_net_basis.sql`
  - this normalizes `monthly_revenue` to the same net-of-discount basis for any
    future consumer that still queries the view.
- operational note:
  - the current annual runtime no longer depends on that view,
  - so this migration was committed for schema continuity but was not required
    for the client-side runtime validation in this session.

What this means for future AI work:

- `Annuale` is still not a single AI-ready blob,
- but the operational core is now much safer to expose as a dedicated
  `annual_operations` context,
- while `alerts` and `fiscal_simulation` should remain separate contexts.

### Annual operations AI flow now implemented

What was added:

- context builder:
  - `src/lib/analytics/buildAnnualOperationsContext.ts`
- annual AI response types:
  - `src/lib/analytics/annualAnalysis.ts`
- provider methods:
  - `getAnnualOperationsAnalyticsContext(year)`
  - `generateAnnualOperationsAnalyticsSummary(year)`
  - `askAnnualOperationsQuestion(year, question)`
- UI card:
  - `src/components/atomic-crm/dashboard/DashboardAnnualAiSummaryCard.tsx`
- server-side OpenAI functions:
  - `supabase/functions/annual_operations_summary/index.ts`
  - `supabase/functions/annual_operations_answer/index.ts`

Scope decision locked in code:

- the Annuale AI card reads only the operational yearly context,
- it does **not** include:
  - fiscal simulation,
  - current-day alerts,
- and it resets its local AI state when the selected year changes, so old
  summaries do not bleed into another year view.

### Annuale Q&A hardening after real user transcripts

After the first real user transcripts on `2025`, one important correction was
applied:

- the issue was no longer raw data correctness,
- the issue was interpretive drift:
  - treating `0` as an automatic anomaly,
  - speaking too absolutely about a single client,
  - and using wording like `quest'anno` / `futuro` even when the selected year
    was already closed.

Fixes now applied:

- added shared guidance builder:
  - `supabase/functions/_shared/annualOperationsAiGuidance.ts`
- added server-side question reframing for ambiguous prompts:
  - a vague user question is internally restated in a safer form before the
    OpenAI call
- tightened annual suggested questions in the UI so they depend on:
  - selected `year`
  - `isCurrentYear`
- the annual guardrail copy now states more explicitly that:
  - non-demonstrable claims must be called out,
  - and a zero value is not an automatic problem.

Decision:

- stop investing heavily in prompt polish for this temporary UI,
- keep only the minimum anti-bufala hardening,
- move the main effort toward the future `AI-driving` architecture:
  - semantic layer,
  - tool contract,
  - module-by-module drill-down.

### Commercial backbone slice 1 now implemented

What was added:

- new migration:
  - `supabase/migrations/20260228170000_add_quotes_project_link.sql`
- `Quote` now supports `project_id`
- quote form now supports linking to an existing project
- quote show now:
  - displays the linked project,
  - or offers `CreateProjectFromQuoteDialog` when the quote is operational and
    still has no project
- payment form now supports:
  - `quote_id`
  - quote-driven autofill of `client_id`
  - quote-driven autofill of `project_id` when available
  - cleanup of incoherent links if the user changes the client afterward
- quote show now also exposes a quick-payment CTA when the quote is already in
  an operational status
- quick payment pre-fills:
  - linked quote
  - linked client
  - linked project only if it exists already
- payment list/show now display the linked quote too

Important scope decision:

- this is **not** the full quote-builder plan,
- quote and project remain optional domain objects:
  - a simple case may still go through `client -> payment`
  - or `quote -> payment`
  - without forcing `project`
- there are still no:
  - live PDF split editor,
  - automatic status transitions,
- this was the smallest safe slice to strengthen module integration before
  broader AI expansion.

### Commercial backbone slice 2 now implemented

What was added:

- new migration:
  - `supabase/migrations/20260228190000_add_quote_items_json.sql`
- `Quote` now supports optional embedded `quote_items`
- quote create/edit now support repeatable line items
- quote `amount` now auto-derives from line totals when item rows are present
- quote show now renders itemized rows with per-line totals
- quote PDF now renders itemized rows too when the quote is itemized

Important scope decision:

- this is still **not** the full quote-builder plan,
- `quote_items` live inside `quotes`, not in a separate CRUD-heavy module,
- quote and project remain optional domain objects,
- the legacy simple quote path remains valid:
  - description + amount
- itemization only activates when the user actually adds line items.

Runtime issue discovered and fixed during real browser validation:

- quote create used the generic autocomplete fallback `q` on `clients`
- on the real Supabase resource this failed with:
  - `column clients.q does not exist`
- fix applied:
  - added shared name lookup helper:
    - `src/components/atomic-crm/misc/referenceSearch.ts`
  - moved client/project lookups that need name search to explicit
    `name@ilike`
- applied in:
  - `QuoteInputs`
  - `QuoteList`
  - `TaskFormContent`

### Commercial backbone slice 3 now implemented

What was added:

- no new migration was needed
- quote show now includes a dedicated `Pagamenti collegati` section
- the section reads linked rows through the existing `payment.quote_id`
  relation
- the section now shows:
  - received total
  - open registered total
  - remaining amount still not linked to payments
  - direct list of linked payments with date/status/type

Important scope decision:

- this is still a lightweight UX slice, not a new invoicing module
- quote and project remain optional domain objects
- no automatic status transition was introduced
- the goal is:
  - make the quote a clearer control point for commercial follow-up
  - without forcing extra workflow on simple jobs

Validation completed on `2026-02-28`:

- `npm run typecheck`
- `npm test -- --run src/components/atomic-crm/quotes/quotePaymentsSummary.test.ts src/components/atomic-crm/quotes/QuotePaymentsSection.test.tsx src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/quoteProjectLinking.test.ts src/components/atomic-crm/quotes/quoteItems.test.ts`
- authenticated browser smoke on the local Vite runtime:
  - login with a temporary smoke user
  - open the hash route:
    - `http://127.0.0.1:4173/#/quotes/<id>/show`
  - verify the real quote detail renders:
    - `Pagamenti collegati`
    - `Ricevuto`
    - `Da ricevere gia registrato`
    - `Ancora da collegare`
    - linked payment rows `Acconto` and `Saldo`
  - observed browser result:
    - `0` console errors
    - `0` page errors
    - `0` request failures

Covered behavior:

- linked-payment summary by status
- remaining amount vs quote total
- empty state
- non-blocking error state
- real browser render on the authenticated quote show path

### Commercial backbone slice 4 now implemented

What was added:

- no new migration was needed
- client show now includes a direct `Nuovo pagamento` entry point
- the button reuses the existing payment create form with only:
  - `client_id` prefilled
- supporting helpers now exist for the simple path too:
  - `buildPaymentCreateDefaultsFromClient()`
  - `buildPaymentCreatePathFromClient()`

Important scope decision:

- this slice exists exactly for the lightweight cases where a project would be
  unnecessary overhead
- no new dialog or duplicate payment form was introduced
- the goal is:
  - make `client -> payment` as real and explicit as the quote-driven paths
  - while keeping the same payment form and validation logic

Validation completed on `2026-02-28`:

- `npm run typecheck`
- `npm test -- --run src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/QuotePaymentsSection.test.tsx src/components/atomic-crm/quotes/quotePaymentsSummary.test.ts`
- authenticated browser smoke on the local Vite runtime:
  - login with a temporary smoke user
  - open the hash route:
    - `http://127.0.0.1:4173/#/clients/<id>/show`
  - click:
    - `Nuovo pagamento`
  - verify redirect to:
    - `http://127.0.0.1:4173/#/payments/create?client_id=<id>`
  - verify the real payment form already shows the selected client
  - observed browser result:
    - `0` console errors
    - `0` page errors
    - `0` request failures

### Annual operations drill-down now implemented

What was added:

- `annual_operations` now includes semantic drill-down payloads for:
  - pending payments
  - open quotes
- the drill-down lives in the shared model/context layer, not in the UI card
- no edge-function deploy was required:
  - the existing annual AI functions already accept the richer JSON context
    generated client-side

Pending payments drill-down now carries:

- `paymentId`
- `clientId`
- `clientName`
- optional `projectId` / `projectName`
- optional `quoteId`
- `amount`
- `status`
- optional `paymentDate`

Open quotes drill-down now carries:

- `quoteId`
- `clientId`
- `clientName`
- optional `projectId` / `projectName`
- `description`
- `amount`
- `status` + `statusLabel`
- optional `sentDate`
- `hasProject`
- `hasItemizedLines`
- `quoteItemsCount`

Important scope rule:

- this is still **not** the alert snapshot,
- pending payments remain `cash expected`,
- open quotes remain `pipeline potential`,
- the goal is to let the AI cite concrete entities without collapsing
  operational totals, alert urgency, and fiscal simulation into one blob.

Validation now completed on the real answer path too:

- authenticated remote smoke completed on `2026-02-28`
- temporary authenticated user created and cleaned automatically
- local code built the real `annual_operations` context and invoked
  `annual_operations_answer`
- selected year in the smoke:
  - `2026`
- observed drill-down during the run:
  - `2` pending payments
  - `0` open quotes
- the AI answer cited the concrete client label present in the drill-down at
  that time:
  - `Diego Caltabiano` (pre-correction runtime label)
- and it correctly said that no open quotes were present in that same
  perimetro
- no extra code change or edge-function deploy was needed after the context
  rollout

Validation now completed on the real browser path too:

- authenticated browser click-test completed on `2026-02-28`
- local runtime used:
  - `http://127.0.0.1:4173/`
- automation used:
  - Playwright via `npx`
  - installed Google Chrome binary
- verified UI path:
  - login with temporary authenticated user
  - open `Annuale`
  - trigger the suggested payment/quote question
  - wait for the answer in browser
- observed result:
  - the answer cited `Diego Caltabiano` (pre-correction runtime label)
  - the answer correctly stated that no open quotes were present in the same
    `2026` perimetro
  - browser console errors:
    - none
  - browser page errors:
    - none

### Browser click-tests now completed on both active tracks

What was verified in the real authenticated UI on `2026-02-28`:

- commercial backbone:
  - opened a quote without `project_id`
  - created a project from `CreateProjectFromQuoteDialog`
  - verified the quote now exposes the linked project CTA
  - opened payment create
  - selected the linked quote
  - verified autofill/alignment of:
    - `client_id`
    - `project_id`
  - saved a payment and verified payment show renders links to:
    - the project
    - the quote
  - opened a `wedding` quote with no linked project
  - used the quick-payment CTA directly from the quote
  - verified payment create was prefilled with quote/client while leaving
    project empty
  - saved the payment successfully without creating a project
  - created an itemized quote from the real UI
  - verified the amount was auto-derived from line items
  - verified quote show renders the itemized rows in the real authenticated app
- annual AI track:
  - opened `Annuale`
  - generated the guided explanation
  - submitted one suggested question
  - verified the answer stayed in the operational scope and did not drift into:
    - fiscal simulation
    - alert snapshot wording
- historical AI follow-up:
  - opened `Storico`
  - typed a free question manually instead of using only suggested prompts
  - verified the answer rendered in-browser with model `gpt-5.2`
  - verified the wording stayed in plain Italian and remained grounded in the
    visible historical data
  - no browser console errors were observed during the free-question path

Runtime issues discovered and fixed during the browser smoke:

- `CreateProjectFromQuoteDialog` assumed `useCreate(..., { returnPromise: true })`
  always returned `{ data }`
- in the real runtime it resolved to the record directly, so quote linking
  failed on `createdProject.data.id`
- fix applied:
  - normalize the mutation result before reading the created project id
  - added regression test:
    - `src/components/atomic-crm/quotes/CreateProjectFromQuoteDialog.test.tsx`
- `PaymentInputs` used the generic autocomplete `q` search for quotes
- on the Supabase `quotes` resource this did not reliably find the quote by
  description during the real browser flow
- fix applied:
  - added a quote-specific `filterToQuery` on `description@ilike`
  - added regression coverage in:
    - `src/components/atomic-crm/payments/paymentLinking.test.ts`
- quote create used the generic autocomplete fallback `q` on `clients`
- on the Supabase `clients` resource this failed with:
  - `column clients.q does not exist`
- fix applied:
  - added shared `name@ilike` lookup helper for name-based references
  - wired it into quote/task/client lookups that search by name

### Tests added

- `src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts`
- `src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistoricalWidgets.test.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistoricalAiSummaryCard.test.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowCard.test.tsx`
- `src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts`
- `src/lib/analytics/buildAnnualOperationsContext.test.ts`
- `src/components/atomic-crm/dashboard/DashboardAnnualAiSummaryCard.test.tsx`
- `src/components/atomic-crm/quotes/quoteProjectLinking.test.ts`
- `src/components/atomic-crm/payments/paymentLinking.test.ts`
- `src/components/atomic-crm/quotes/CreateProjectFromQuoteDialog.test.tsx`
- `src/components/atomic-crm/quotes/quoteItems.test.ts`
- `src/components/atomic-crm/misc/referenceSearch.test.ts`

Covered today:

- current year treated as YTD,
- YoY based on last two closed years,
- zero-baseline YoY returns `N/D`,
- analytics context serialization,
- parent historical empty state,
- parent historical error state with retry,
- contextual YoY warning rendering,
- widget-level error states,
- widget-level empty states,
- YoY `N/D` UI rendering,
- guided summary trigger/render,
- suggested-question trigger/render for the historical AI card,
- historical cash-inflow non-AI card ready/empty/error states,
- annual current-year YTD exclusion of future services,
- annual net-of-discount basis consistency,
- annual fiscal/business-health selected-year filtering,
- annual AI context caveats and metric serialization,
- annual AI context drill-down serialization for pending payments/open quotes,
- annual AI card summary/question triggers.
- quote -> project linking from direct `useCreate` mutation result.
- quote autocomplete search in the payment form by description.
- quote item row sanitization, total computation and create/edit payload
  transform.
- explicit name-based lookup filters for reference inputs that search on `name`.

## Validation Done

Successful commands:

- `npm run typecheck`
- `npm test -- --run src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts`
- `npm test -- --run src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalWidgets.test.tsx src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts`
- `npm test -- --run src/components/atomic-crm/dashboard/DashboardHistoricalAiSummaryCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalWidgets.test.tsx src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts`
- `npm test -- --run src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts src/components/atomic-crm/dashboard/DashboardHistoricalAiSummaryCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalWidgets.test.tsx src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts`
- `npm test -- --run src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts src/lib/analytics/buildAnnualOperationsContext.test.ts src/components/atomic-crm/dashboard/DashboardAnnualAiSummaryCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalAiSummaryCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalWidgets.test.tsx src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts`
- `npm test -- --run src/components/atomic-crm/quotes/quoteItems.test.ts src/components/atomic-crm/misc/referenceSearch.test.ts src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/CreateProjectFromQuoteDialog.test.tsx src/components/atomic-crm/quotes/quoteProjectLinking.test.ts`
- `npx supabase db push`
- `curl` verification against remote PostgREST with the linked project `service_role`
  key
- `npx supabase secrets set OPENAI_API_KEY ... SB_PUBLISHABLE_KEY ... --project-ref qvdmzhyzpyaveniirsmo`
- `npx supabase functions deploy historical_analytics_summary --project-ref qvdmzhyzpyaveniirsmo`
- `npx supabase functions deploy historical_analytics_answer --project-ref qvdmzhyzpyaveniirsmo`
- `npx supabase functions deploy annual_operations_summary --project-ref qvdmzhyzpyaveniirsmo`
- `npx supabase functions deploy annual_operations_answer --project-ref qvdmzhyzpyaveniirsmo`
- authenticated browser smoke on the local Vite runtime against the linked
  Supabase project for:
  - `Quote -> Project -> Payment`
  - `Annuale` AI card
  - `Storico` free-question path
  - itemized quote create/show flow

Operational helper now available for future authenticated smokes:

- `node scripts/auth-smoke-user.mjs create`
- `node scripts/auth-smoke-user.mjs cleanup --user-id <id>`

Important local browser note:

- this CRM uses hash routing on the local Vite runtime
- for authenticated browser smokes, open routes in the form:
  - `http://127.0.0.1:4173/#/...`
- example:
  - `http://127.0.0.1:4173/#/quotes/<id>/show`
- do not use:
  - `http://127.0.0.1:4173/quotes/<id>/show`

Purpose:

- stop rebuilding temporary-user auth flows from scratch in every session,
- keep the remote smoke path fast and repeatable,
- centralize the correct sequence:
  - resolve `service_role` via CLI
  - create confirmed user
  - wait for `sales`
  - verify password login
  - cleanup `sales -> auth.users`

### Remote verification completed on linked project

Verified on `2026-02-28` against project `qvdmzhyzpyaveniirsmo`:

- `analytics_history_meta` returns:
  - `as_of_date: 2026-02-28`
  - `first_year_with_data: 2024`
  - `last_year_with_data: 2025`
  - `current_year: 2026`
  - `has_current_year_data: false`
- `analytics_yearly_competence_revenue` returns:
  - `2024 => €3,118`
  - `2025 => €20,582`
  - `2026 YTD => €0`
- `analytics_yearly_competence_revenue_by_category` returns non-zero historical
  values for:
  - `produzione_tv`
  - `spot`
- `analytics_client_lifetime_competence_revenue` returns:
  - `Diego Caltabiano => €23,700` (pre-correction runtime label)

Derived historical KPI check from the remote rows:

- `best_closed_year = 2025`
- `latest_closed_year_revenue = €20,582`
- `YoY closed years = 2025 vs 2024 = +560%`

Important nuance:

- the same queries executed with the publishable/anon key return empty arrays,
- this is expected because the historical views use `security_invoker=on` and
  the underlying `clients/projects/services` tables are protected by RLS for
  anonymous users,
- therefore, empty anon responses are not evidence that the migration failed.

Inference from the repository policies:

- authenticated users should see the historical rows in the real app runtime,
  because `public.clients`, `public.projects`, and `public.services` all have
  `Authenticated full access` policies in
  `supabase/migrations/20260225180000_gestionale_schema.sql`,
- this session also verified the first OpenAI flow end-to-end with a temporary
  authenticated remote user:
  - authenticated reads to the historical views succeeded,
  - `historical_analytics_summary` returned `200 OK`,
  - the selected model resolved to `gpt-5.2`,
  - and the generated markdown summary correctly framed `2026` as `YTD` and
    `2025 vs 2024` as the closed-year comparison,
- this session also verified the new single-turn Q&A flow end-to-end with a
  temporary authenticated remote user:
  - authenticated reads to the historical views succeeded,
  - `historical_analytics_answer` returned `200 OK`,
  - the selected model resolved to `gpt-5.2`,
  - an example question `Perché il 2025 è andato meglio del 2024?` returned the
    expected sections:
    - `## Risposta breve`
    - `## Perché lo dico`
    - `## Cosa controllare adesso`
  - the generated answer avoided raw `YTD` / `YoY` jargon and instead used
    plain wording such as `valore del lavoro attribuito a quell'anno` and
    `crescita rispetto all'anno prima`,
- browser evidence collected on `2026-02-28` also confirms the real
  authenticated UI path:
  - the `Storico` dashboard renders KPIs, charts, top clients, and context
    cards correctly,
  - the `Analisi AI dello storico` card renders a generated answer in-browser,
  - the visible answer remains aligned with the approved semantics,
- therefore the guided historical AI summary flow is now verified both at
  remote runtime level and at browser click-path level,
- the new free-question flow is now also verified on the real authenticated
  browser path with a typed question, not only by remote smoke.
- after the plain-language prompt rewrite, the remote function was redeployed
  and returned a simpler answer starting with:
  - `## In breve`
  - plain wording like `valore del lavoro`, `anno in corso fino a oggi`, and
    `crescita rispetto all'anno prima`
- a later authenticated remote smoke also verified the new annual AI flow on
  the same linked project for year `2025`:
  - `annual_operations_summary` returned `200 OK`,
  - `annual_operations_answer` returned `200 OK`,
  - both used model `gpt-5.2`,
  - the summary started with `## In breve`,
  - the answer started with `## Risposta breve`,
  - and the answer did not drift into fiscal simulation wording.
- a later authenticated browser smoke on `2026-02-28` also verified both live
  click-paths end-to-end with temporary records/users and cleanup after the run:
  - commercial chain `Quote -> Project -> Payment`
  - annual AI guided summary + one suggested question

### Remote AI runtime note

The first remote invocation of `historical_analytics_summary` failed with:

- `401 Error: supabaseKey is required.` after deploy, because the shared auth
  middleware expected `SB_PUBLISHABLE_KEY` and the project only had the default
  Supabase secrets,
- then `500 OPENAI_API_KEY non configurata nelle Edge Functions`, because the
  OpenAI secret was not actually present on the linked project even though the
  local `.env` files contained it.

Fix actually applied:

- `_shared/authentication.ts` now falls back to `SUPABASE_ANON_KEY` when
  `SB_PUBLISHABLE_KEY` is absent,
- remote secrets were explicitly set for:
  - `SB_PUBLISHABLE_KEY`
  - `OPENAI_API_KEY`
- the function was redeployed after the auth fix,
- and the remote smoke test passed afterwards.

Additional runtime note for the Q&A flow:

- the first authenticated smoke invocation of `historical_analytics_answer`
  returned `404 Requested function was not found`,
- the root cause was simple: the new function existed locally but had not yet
  been deployed to the linked Supabase project,
- fix applied:
  - `npx supabase functions deploy historical_analytics_answer --project-ref qvdmzhyzpyaveniirsmo`
- re-test immediately after deploy returned `200 OK`.

Additional runtime note for the annual flow:

- the first smoke invocation of `annual_operations_summary` failed with
  `404 Requested function was not found`,
- root cause: although the CLI initially printed a deploy-looking output, the
  function did not actually appear in `supabase functions list`,
- fix applied:
  - verify active remote functions with
    `npx supabase functions list --project-ref qvdmzhyzpyaveniirsmo`
  - redeploy `annual_operations_summary`
- re-test immediately after the second deploy returned `200 OK`.

## Current Explicit Next Slice

The previous `local truth rebuild` slice is now closed:

- local reset now rebuilds the business dataset from the real source files
- Diego/Gustare semantics now come from imported truth, not from hardcoded
  local domain fixtures
- local browser smoke can read and write on top of that rebuilt dataset

The explicit next slice is now:

- `financial semantic separation`

Goal:

- stop overloading `payments` / `expenses` with mixed meanings
- separate more clearly:
  - fiscal document
  - receivable/payable open state
  - actual cash movement
- preserve the rebuilt local truth dataset as the baseline while correcting the
  model

Execution order for this slice:

1. keep the rebuilt local truth baseline as the only acceptable domain source
2. preserve and refine the new foundation already introduced for:
   - emitted/received document
   - open receivable/payable state
   - cash movement
   - project allocation / reconciliation
3. realign UI, AI, import and analytics from `payments` / `expenses` toward
   that clearer model
4. keep compatibility only where migration is not finished yet
5. only after the system is correct, tighten tests around the new semantics

Important boundaries:

- do not open the supplier domain before the document/open/cash separation is
  under control
- do not treat test convenience as a reason to keep the old overloaded model
- technical bootstrap data is allowed only for environment setup, not for
  inventing business truth

Current success condition:

- the local rebuilt domain remains replayable from the real files
- the financial foundation tables remain populated from the same rebuild:
  - `financial_documents`
  - `cash_movements`
  - allocation tables
- the system can answer distinctly:
  - what document exists
  - what is still open
  - what cash really moved
- the first migrated consumer now behaves coherently:
  - `project_financials` prefers foundation document/cash semantics when the
    project is covered by the rebuild
  - legacy `payments` are only a fallback for projects not yet covered by the
    foundation
- 2025 fiscal files are now stronger than before:
  - `FPR 1/25` and `FPR 2/25` are present as real XML files in `Fatture/2025/`
  - the May 2025 public-administration trio is explicit:
    - `FPA 1/25` invoice
    - `FPA 2/25` `TD04` credit note linked to `FPA 1/25`
    - `FPA 3/25` valid reissue
  - `Fatturato attivo 2025` reconstructed from the local truth baseline now
    closes correctly at `€26.700,35` when credit-note semantics are applied
  - the foundation now also preserves fiscal XML breakdowns:
    - `xml_document_code`
    - `taxable_amount`
    - `tax_amount`
    - `stamp_amount`
  - operational incasso semantics remain the project ones:
    - `payments.status = ricevuto / in_attesa / scaduto`
    - `payment_type` remains part of the same operational model
- the next implementation step can then target supplier/domain expansion on top
  of a healthier financial core

The next launcher-UX continuity slice is now closed too:

- on mobile the launcher sheet now uses the full viewport height instead of
  stopping below the top edge
- the general CRM chat now preserves its last visible conversation across
  drawer close/reopen:
  - last answer
  - last payment draft linked to that answer
  - current unsent question text
- the invoice-import workspace deliberately does **not** follow that rule:
  - selected files
  - generated invoice draft
  - confirmation state
  still reset on close
- explicit residual risk documented:
  - reopening the launcher can show an answer grounded on an older snapshot
  - the timestamp remains visible in the UI and the next question still uses
    the current loaded context
- this slice stayed local too:
  - no migration
  - no function redeploy
  - validation closed with `npm run typecheck` and targeted Vitest

The next composer-UX continuity slice is now closed too:

- the compact launcher composer now shows the expand action from the third
  visible line
- the compact launcher composer now keeps growing only up to six visible lines
- after that threshold:
  - the textarea keeps its own scrollbar
  - an explicit full-screen expand action appears
- wrapped text without explicit manual line breaks must still count toward
  those thresholds
- the expanded writer reuses the same draft question and same launcher
  conversation instead of opening a separate flow
- explicit residual risks documented:
  - the long-text threshold depends on runtime line-height measurement
  - mobile keyboard/browser chrome still need real-device smoke beyond local
    UI tests
- that real-device smoke is now partially closed too:
  - an iPhone Safari verification found that the launcher content could stop
    scrolling after a long answer
  - the fix was to harden the mobile drawer scroll chain with:
    - `min-h-0` on the launcher wrappers that own the chat height
    - a dedicated scroll area for the conversation body
    - touch-friendly scrolling on that area
    - a non-growing (`shrink-0`) composer footer
  - validation closed with `npm run typecheck` and
    `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`

The next composer cleanup slice is now closed too:

- the full-screen writer no longer shows explanatory copy that steals reading
  and writing space
- the expanded composer is now a plain vertical writing surface with only:
  - editable text
  - close
  - send
- the launcher composer textareas now opt out of generic
  `field-sizing-content` so the explicit thresholds remain under product
  control, including whitespace-heavy input cases
- this slice stayed local too:
  - no migration
  - no function redeploy
  - validation closed with `npm run typecheck` and targeted Vitest
- real local browser verification is now closed too:
  - the launcher composer thresholds behave correctly after the
    `field-sizing-fixed` override
  - the full-screen writer no longer shows the broken split layout seen in the
    earlier regression screenshots

The expenses-list continuity fix is now documented too:

- `ExpenseListActions` was accidentally using `exporter` without receiving it
  as a prop
- the list now reuses one local exporter instance for both:
  - `List`
  - `ExportButton`
- local browser verification is now closed too:
  - `/#/expenses` no longer crashes with `exporter is not defined`

The next launcher km-expense slice is now closed too:

- the same unified launcher can now handle a strict `spostamento_km` use case
  without opening a new AI surface
- when the question clearly describes a route expense to register, the flow now
  switches to a deterministic branch instead of asking the text model to guess
  kilometers
- the system now:
  - parses origin/destination and round-trip intent from the question
  - resolves both places via `openrouteservice`
  - computes the route distance via `openrouteservice`
  - derives the shared CRM reimbursement estimate from the semantic default
    `km_rate`
  - returns a grounded answer plus one approved handoff to `/#/expenses/create`
    with prefilled `expense_type`, `expense_date`, `km_distance`, `km_rate`,
    and route description
- `ExpenseCreate` now consumes those search params and shows a launcher banner
  before save, keeping the last correction on the approved expense form
- this slice has now been verified on the linked remote runtime too:
  - no migration was needed
  - `OPENROUTESERVICE_API_KEY` and `OPENROUTESERVICE_BASE_URL` were added to
    the linked Supabase Edge Function secrets
  - `unified_crm_answer` was redeployed on `qvdmzhyzpyaveniirsmo`
  - authenticated remote smoke on `2026-03-01` returned HTTP `200`
  - smoke question used:
    `Devo registrare una spesa oggi: ho percorso la tratta Valguarnera Caropepe - Catania andata e ritorno. Calcola quanti chilometri ho percorso e dimmi come caricarli nel CRM.`
  - returned model: `openrouteservice`
  - returned first suggested action:
    `expense_create_km`
  - returned prefilled route:
    `/#/expenses/create?expense_type=spostamento_km&expense_date=2026-03-01&km_distance=160.98&km_rate=0.19...`
  - temporary smoke user was cleaned after verification
  - validation also remains closed with `npm run typecheck`, targeted Vitest,
    and live local ORS calls on the real `Valguarnera Caropepe -> Catania`
    route
- explicit residual risks:
  - geocoding on a city/locality name can resolve the city center or a generic
    point instead of the exact street address
  - the final kilometer value therefore stays a prefill suggestion to verify on
    the expense form before saving
  - remote/edge runtime still needs the ORS secret aligned outside local env if
    this flow is used beyond the local workspace

## Environment Blockers

### Supabase migration state

- Remote state:

- the linked remote project `qvdmzhyzpyaveniirsmo` now has both relevant
  analytics migrations applied:
  - `project_ref: qvdmzhyzpyaveniirsmo`
  - applied migrations:
    - `20260228133000_historical_analytics_views.sql`
    - `20260228150000_normalize_monthly_revenue_net_basis.sql`

- Local state:

- there is still no local database available in this environment,
- `npx supabase status` failed with `Cannot connect to the Docker daemon`.

Impact:

- the remote database now contains the new `analytics_*` views,
- frontend/runtime verification should target the remote environment until a local DB exists.

Next command only if a local DB is introduced later:

```bash
npx supabase migration up
```

### Docs site build not verified end-to-end

Reason:

- `doc/` environment is missing the local `astro` binary in this workspace snapshot.

Impact:

- the MDX spec file was written and formatted,
- but the docs site build itself was not verified in this session.

## Known Risks / Open Edges

- Historical references to FakeRest/demo in older notes are now obsolete:
  the legacy provider was removed from the repo on 2026-04-01.
- The assistant-ready payload exists, and a single-turn historical Q&A flow now
  exists, but no multi-turn conversational chat flow exists yet.
- `Annuale` is still not AI-ready as a whole page:
  - only `annual_operations` has a dedicated AI context today
  - alerts and fiscal simulation remain outside that context
- the richer `annual_operations` drill-down is now validated on both:
  - the remote answer path
  - the real browser UI path
- The browser output is now understandable for non-expert users, but markdown
  readability may still deserve further polish only if product wants a denser
  or more scannable layout.
- Temporary remote auth smoke users created via admin APIs require cleanup in
  this order on the linked project:
  - delete the dependent `sales` row first
  - then delete the auth user
  - otherwise `sales_user_id_fkey` blocks the auth-user deletion

## Recommended Next Session Order

Stable rollback note:

- after this session is pushed, treat that commit as the known-good fallback for
  the historical AI flow,
- if a future change breaks the runtime or semantics, return to that pushed
  commit before investigating forward again.

1. Keep the client billing-profile foundations aligned across:
   - client CRUD/show/export
   - invoice import
   - unified launcher read snapshot
   - client list discovery/search
2. If import-born counterparties become the next priority, open the supplier
   resource/page as a separate slice and stop routing supplier expenses through
   `client_id`.
3. Only after the supplier boundary is explicit, decide whether invoice import
   should also support richer client update/create assistance inside the
   launcher itself.
4. Keep the historical / annual / launcher tests aligned while doing that
   work.
5. Do not add new scattered AI surfaces while this operational base is being
   strengthened.

## Quick Resume Checklist

- Read the spec:
  - `doc/src/content/docs/developers/historical-analytics-ai-ready.mdx`
- Read this handoff:
  - `docs/historical-analytics-handoff.md`
- Read the backlog:
  - `docs/historical-analytics-backlog.md`
- Then continue from:
  - keeping the new client billing-profile foundation aligned across client UI,
    quote PDF, invoice import, unified launcher read snapshot, and client list
    search
  - deciding separately if/when to open the dedicated supplier slice
  - only later evaluating deeper launcher-side create/update assistance on top
    of this stronger base

## Edge Function Secret Hygiene

- `supabase/functions/.env` must remain local-only and must not be tracked by git.
- Use `supabase/functions/.env.example` as the committed template for required
  Edge Function variables.
- `POSTMARK_*` does not belong in the example or future runtime setup because
  Postmark has been removed from the product direction.
- If any real secret has already been committed in repository history, rotate it;
  ignoring the file now does not retroactively protect an exposed key.

## Launcher Travel-Expense / Chat Continuity Fixes

- Natural-language travel-expense questions now match the deterministic
  `spostamento_km` branch even when written as:
  - `da ... fino al ...`
  - with explicit Italian dates such as `giorno 2 febbraio 2026`
  - with round-trip wording such as `sia l'andata che il ritorno`
- Payment handoff and payment draft generation are now explicitly suppressed
  when the detected intent is expense creation/travel reimbursement; this closes
  the bad first-test behavior where the launcher proposed `payments` instead of
  `expenses`.
- The launcher chat now has:
  - explicit `Nuova` / reset action in the header
  - recent conversation history passed back to `unified_crm_answer`
  - last answer still rendered as a single clean card, not as a noisy chat log

Risks kept explicit:

- conversation history is capped to the last 6 turns and is launcher-local only;
  it survives close/reopen of the drawer, but not a full page refresh
- the model now sees recent Q&A turns, but it still does not see transient UI
  state from other launcher views such as half-edited invoice-import drafts
- travel parsing remains heuristic for very free-form Italian phrasing, so new
  route phrasings should extend tests before further broadening the prompt layer
- the unified launcher question-length boundary is now `1200` characters and
  must stay aligned between:
  - compact composer
  - expanded composer
  - `unified_crm_answer` validation
  otherwise the launcher regresses into a false-accept / backend-reject flow

## Manual KM Calculator Surfaces

- A shared `Calcola tratta` dialog now exists for manual km entry in all current
  operational surfaces that really edit travel data:
  - `expenses` km section
  - `services` km section
  - `quick episode` dialog for TV projects
- The dialog asks for:
  - origin
  - destination
  - one-way vs round-trip
  - editable `EUR/km` rate prefilled from the shared default
- The route is estimated server-side through a dedicated Edge Function
  `travel_route_estimate`, not from the browser.
- Applying the estimate updates km/rate in the host UI and can also prefill:
  - `description` on expenses when empty or already travel-generated
  - `location` on services / quick episodes when empty

Risks kept explicit:

- geocoding/routing still depends on textual place quality; the final km value
  must remain user-editable before saving
- `QuickEpisodeForm` now exposes `km_rate` explicitly, but no dedicated browser
  smoke was run in this session on that dialog after the change

## Project Quick-Episode Handoff From Launcher

- The unified CRM launcher now has a deterministic write-handoff for TV project
  work-item requests that clearly imply creation, such as:
  - `nuovo lavoro`
  - `nuovo servizio`
  - `registra puntata`
  - phrasing that mentions an interview plus a related travel expense
- This branch remains read-only in chat, but instead of stopping at
  explanation-only guidance it can now:
  - match the most coherent active project already present in snapshot
  - extract an explicit Italian date
  - extract an operational note such as `Intervista a Roberto Lipari`
  - recognize round-trip travel wording including `andate e ritorno`
  - try route candidates even when the user writes undelimited place sequences
    like `Valguarnera Caropepe Acireale`
- When the matched project is the TV flow already supported by the product, the
  launcher now returns a new approved action:
  - capability id: `project_quick_episode`
  - destination: `/#/projects/:id/show`
  - search params:
    - `launcher_source=unified_ai_launcher`
    - `launcher_action=project_quick_episode`
    - `open_dialog=quick_episode`
    - `service_date`
    - `service_type`
    - optional `km_distance`
    - optional `km_rate`
    - optional `location`
    - optional `notes`
- The destination project surface now:
  - shows a launcher banner in `ProjectShow`
  - auto-opens `QuickEpisodeDialog` when the handoff is present
  - reads the launcher prefills through `projectQuickEpisodeLinking`
  - applies those defaults into `QuickEpisodeForm`
- Copy is intentionally less rigid:
  - if the user asks for a `servizio`, the launcher answer/action says
    `servizio`
  - if the user asks for a `puntata`, it says `puntata`
  - the underlying destination still remains the approved TV quick-episode
    workflow

Explicit boundary kept in place:

- the launcher must not pretend the service already exists in CRM; it only
  prepares the right destination workflow with prefills

## Pareto Service/Expense Handoff Outside TV

- The follow-up Pareto slice is now closed too:
  - when the launcher matches a real active project but that project is not TV,
    `nuovo servizio` no longer falls back to the TV quick-episode dialog
  - the approved destination is now `/#/services/create`
- The read snapshot now carries the minimum extra project semantics needed for
  this branch:
  - `projectCategory`
  - `projectTvShow`
- The launcher uses those fields only to choose the already approved surface:
  - TV project:
    - `project_quick_episode`
  - non-TV project:
    - `service_create`
- `ServiceCreate` now consumes launcher prefills/search params and shows a
  banner when the handoff comes from the unified chat.
- Supported service prefills now include:
  - `project_id`
  - `service_date`
  - `service_type`
  - optional `km_distance`
  - optional `km_rate`
  - optional `location`
  - optional `notes`

- A second Pareto branch is now closed too for non-km costs:
  - the launcher can open `/#/expenses/create` as an approved action
  - capability id:
    - `expense_create`
  - the handoff prefers keeping the business link correct over inventing new UI:
    - if a project is grounded, it carries `client_id + project_id`
    - otherwise, if only a client is grounded, it carries `client_id`
- Generic expense parsing stays intentionally narrow and deterministic:
  - common descriptions such as `casello autostradale`, `pranzo`, `noleggio`,
    `acquisto materiale`
  - simple amount extraction such as `12,50 euro`
  - explicit date extraction when present
- `ExpenseCreate` already supported those prefills; it now also recognizes the
  launcher action `expense_create` for banner copy.

- The TV quick-episode flow was hardened in the same pass instead of opening a
  second TV expense workflow:
  - `QuickEpisodeForm` now lets the user add extra non-km expenses in the same
    dialog
  - `QuickEpisodeDialog` now saves:
    - the service
    - the km expense when present
    - any extra expenses added there
  - those extra expenses stay linked to the same `client_id + project_id`

Explicit boundary still kept in place:

- outside TV there is still no single surface that saves service + expenses in
  one confirmation
- this is intentional Pareto scope control:
  - reuse approved `services/create`
  - reuse approved `expenses/create`
  - do not invent a new mega-form while the business value is already covered

## Travel Route Auth Stabilization

- The first real mobile-browser test of `travel_route_estimate` exposed a
  `401 Invalid JWT` path from the km calculator dialog.
- Two hardening steps are now mandatory together for UI-invoked Edge Functions:
  - keep the function declared in `supabase/config.toml` with
    `verify_jwt = false` when the project uses the custom auth middleware model
  - resolve a fresh user access token client-side and pass
    `Authorization: Bearer <token>` explicitly when invoking the function
- This closes the fragile fallback where the browser-side SDK could otherwise
  hit the function with a publishable-key context or stale session state,
  especially on mobile Safari / reopened sessions.

---

## Nota UI 2026-03-02 — AI card spostata in fondo alla vista annuale

`DashboardAnnualAiSummaryCard` è stata spostata in fondo a `DashboardAnnual.tsx`,
dopo il blocco fiscale. Nessun cambiamento funzionale all'AI o al flusso analytics.

---

## Nota manutenzione 2026-03-02

`supabase/functions/unified_crm_answer/index.ts` ha ricevuto solo una
correzione di formattazione Prettier (whitespace). Nessun cambiamento
funzionale all'AI o al flusso analytics.

- 2026-03-08: unified_crm_answer reasoning re-enabled at effort 'low' — medium exhausted token budget with full CRM snapshot
- 2026-03-31: timezone bonifica — dashboard date helpers (`fiscalDeadlines.ts`, `dashboardModel.ts`, `DashboardDeadlineTracker.tsx`, `DashboardAnnual.tsx`) now use centralized `toISODate`/`todayISODate` from `lib/dateTimezone`. No functional change to AI or analytics flow.
- 2026-04-01: `DashboardDeadlineTracker` — added `onSuccess`/`onError` callbacks to `useUpdate` calls for `markPaymentAsReceived` and `markTaskAsDone`. User-facing toast notifications added via `useNotify`. No change to data model, analytics, or AI flow.

- 2026-04-01: AI snapshot reads from canonical views — `buildUnifiedCrmReadContext` now receives pre-computed `projectFinancialRows` and `clientCommercialPositions` from DB views instead of calculating from raw tables. Invoice draft markdown shows expenses when present. No change to AI model, analytics aggregation, or historical flow.

- 2026-04-02: fiscal-reality-layer branch opened — TypeScript types for the 4 fiscal reality DB tables (`fiscal_declarations`, `fiscal_obligations`, `fiscal_f24_submissions`, `fiscal_f24_payment_lines`) and the read model types (`FiscalDeadlineView`, `FiscalDeadlineViewItem`) added in `fiscalRealityTypes.ts`. No runtime change; this is the type-only foundation for Phase 1 of the fiscal reality layer.
