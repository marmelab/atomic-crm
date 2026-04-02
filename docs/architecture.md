# Architecture — Gestionale Rosario Furnari

## Overview

Fork di Atomic CRM personalizzato per gestire l'attività professionale
di fotografo, videomaker e web developer. Single-user, interfaccia italiana.

Stato del documento:

- `canonical` — ultimo aggiornamento: 2026-04-02
- descrive la fotografia implementativa ad alto livello
- le vecchie "sessioni" citate nel file sono indizi storici, non la fonte
  primaria della verita' operativa se entrano in conflitto con codice o
  migration attuali

## Changelog

- 2026-04-02: Fiscal reality layer Phase 1 step 8 — UI entry dialogs: `DichiarazioneEntryDialog` (upsert + regenerate obligations, divergence warning), `F24RegistrationDialog` (checklist of deadline obligations, resolve IDs at submit), `ObligationEntryDialog` (manual source, no declaration). Trigger buttons in `DashboardAnnual` fiscal header; `DashboardDeadlinesCard` shows Phase 1 inconsistency note when `hasRealFiscalData` is true.
- 2026-04-02: Fiscal reality layer Phase 1 step 7 — All dashboard consumers (`DashboardAnnual`, `MobileDashboard`) now call `useFiscalReality` and pass `deadlineViews` + `totalOpenObligations` to children. `DashboardDeadlinesCard` renders reality-aware view with source-aware status badges and F24 registration callback when `deadlineViews` is provided, legacy `schedule` path preserved for backward compat. `DashboardNetAvailabilityCard` uses `totalOpenObligations` for tax reserve when available. `DashboardKpiCards` threads the new prop. `MobileFiscalKpis` shows remaining amount and paid info from deadline views.
- 2026-04-02: Fiscal reality layer Phase 1 step 6 — `useFiscalReality` hook added in `dashboard/`; single fetch+merge entrypoint for fiscal reality consumers; fetches obligations and enriched payment lines via year-scoped `useQuery` keys, calls `buildFiscalRealityAwareSchedule` via `useMemo`, returns `deadlineViews: null` while loading so consumers can gate on readiness; derives `totalOpenObligations` (sum of `remainingAmount` across all deadline view items) and `hasRealFiscalData` (`obligations.length > 0`).
- 2026-04-02: Fiscal reality layer Phase 1 step 5 — `fiscalRealityProvider.ts` adds 10 closure-based provider methods for fiscal CRUD (declarations, obligations, F24 submissions/payment lines, regeneration, declaration delete). All reads are year-scoped via DB-side filters. `getEnrichedPaymentLinesForYear` uses two-step query (obligation IDs by payment_year, then lines by obligation_id). `regenerateDeclarationObligations` and `deleteFiscalDeclaration` return structured `BlockedObligation[]` results. Merged into `dataProvider.ts` via `buildFiscalRealityProviderMethods()`. Dead code in `updateFiscalObligation` removed post-review.
- 2026-04-02: Fiscal reality layer Phase 1 step 4 — `buildFiscalRealityAwareSchedule` read model merges estimated deadlines with real obligations via UNION+merge by canonical key (`component::competenceYear::dueDate`). Handles estimate-only, obligation-only (manual/standalone), mixed sources, partial/full/over payments, deterministic component sort order, and priority-then-date deadline sort. 11 unit tests cover all status derivations, real-only deadlines, `estimateComparison`, and totals.
- 2026-04-02: Fiscal reality layer Phase 1 step 2 — `buildObligationsFromDeclaration` pure function converts a `FiscalDeclaration` into `ObligationDraft[]` (omits server fields `id`, `created_at`, `updated_at`, `user_id`). Rules: saldo clamped ≥0, imposta double/single/no acconto based on thresholds (€257.52/€51.65), INPS 40%×2 when >0, zero-amount obligations not emitted, all rounded via `roundFiscalOutput`; 25 unit tests; no DB write or UI wiring in this step.
- 2026-04-02: Fiscal reality layer — TypeScript types for 4 DB tables (`fiscal_declarations`, `fiscal_obligations`, `fiscal_f24_submissions`, `fiscal_f24_payment_lines`) and read model types (`FiscalDeadlineView`, `FiscalDeadlineViewItem`) added in `fiscalRealityTypes.ts`; no runtime change, type-only foundation for Phase 1.
- 2026-04-02: Fiscal truth refactor (Gestione Separata) — the fiscal dashboard and `fiscal_deadline_check` now use a two-lane contract: `FiscalYearEstimate` for selected tax year `Y` and `FiscalPaymentSchedule` for payment year `Y`, built from estimate `Y-1` plus advance plan `Y-2`. Added explicit fallback config `fiscalConfig.defaultTaxProfileAtecoCode` (default `731102`, ATECO `73.11.02`), `UNMAPPED_TAX_PROFILE` warnings on dashboard and Edge Function, canonical rounding via pure helpers, and safe-first net availability: device-local "segnato come pagato" stays reminder-only and no longer alters reserve math. Desktop/mobile and client/server parity are covered by dedicated fiscal tests.
- 2026-04-02: unified_crm_answer create-flow split — the old monolithic `_shared/unifiedCrmAnswerCreateFlows.ts` is now a thin barrel that re-exports per-intent modules (`TravelExpense`, `ProjectQuickEpisode`, `ServiceCreate`, `ExpenseCreate`, `InvoiceDraft`) plus a small shared helper file; this is a structural hardening only, meant to keep ESLint `max-lines` / `complexity` guardrails enforceable without changing AI handoff behavior.
- 2026-04-01: AI snapshot expense detail fix — `unifiedCrmReadContext` now serializes per-project `expenses` alongside `services` inside `activeProjects`, and `recentExpenses` / `totals.expensesAmount` use the operational expense amount (km reimbursement, markup, credits) instead of raw `expenses.amount`; this closes the AI mismatch where project totals included expenses but the detail list showed `0,00` km rows.
- 2026-04-01: Invoice draft builders now include billable expenses and apply Invoice Draft Sign Rule (rimborso excluded from deductions); `buildInvoiceDraftFromClient` accepts expenses + payments params, returns null when collectable <= 0; call sites in ProjectShow and ClientShow updated.
- 2026-04-01: AI snapshot now reads from canonical views — `buildUnifiedCrmReadContext` accepts `projectFinancialRows` and `clientCommercialPositions` from the `project_financials` / `client_commercial_position` DB views via new mappers (`mapProjectFinancialRows`, `mapClientCommercialPositions`), removing the last client-side financial calculation from the snapshot builder; `dataProviderAi` fetches both views in the same `Promise.all`; invoice draft markdown shows expenses when present; `clientFinancials` snapshot shape now includes `totalExpenses`.
- 2026-04-01: QuickPaymentDialog `rimborso_spese` fix — now suggests remaining expenses (total - already reimbursed), not gross total; `getSuggestedAmount` exported as pure function with `paidRimborsoSpese` param.
- 2026-04-01: AI payment parser fix — `inferPreferredPaymentType` now distinguishes bare "rimborso" (refund to client) from "rimborso spese" (expense reimbursement) using longest-match-first; canonical implementation in `src/lib/ai/inferPreferredPaymentType.ts`, mirrored in Edge Function `unifiedCrmAnswerIntents.ts`; `PaymentDraftCard` uses a single unified `allowedPaymentTypes` set excluding "rimborso" from draft cards (sensitive op, manual-only).
- 2026-04-01: Single source of truth for financial position — rewrote `project_financials` view removing dual-path (foundation/legacy), always using `payments` table; added `client_id` and `total_owed` columns; created new `client_commercial_position` view for canonical client-level aggregation with Record Precedence Rules; added performance indexes on payments/expenses/services.
- 2026-04-01: ProjectShow reads `total_owed` and `balance_due` from `project_financials` view — no more React-side recalculation of `grandTotal`/`balanceDue`; negative balance shown as "Credito cliente".
- 2026-04-01: Repo hardening follow-up — removed the legacy frontend GitHub Pages deploy path (`ghpages:deploy`, related script and workflow step), made `prod-deploy` backend-only, clarified that `make start` bootstraps the local admin while raw `npx supabase db reset` still needs `npm run local:admin:bootstrap`, documented the deterministic Playwright test-data lane as technical-only, and swept remaining date-only UI formatters to `formatBusinessDate()`.
- 2026-04-01: CI hardening — GitHub Actions workflows now opt into Node 24 for JavaScript actions, `actions/checkout` / `actions/setup-node` were bumped to v6, and the stale manual `deploy-demo` job was removed because the demo build path no longer exists in this fork.
- 2026-04-01: FakeRest removal cleanup — removed the obsolete `src/components/atomic-crm/providers/fakerest/**` tree plus `faker` / `ra-data-fakerest` dependencies, cleaned TS config leftovers (`faker` ambient types, `demo` tsconfig include), and updated canonical/docs-site guidance so this fork now documents Supabase as the only supported data provider.
- 2026-04-01: Build chunking follow-up — `vite.config.ts` now splits the old `vendor-misc` fallback more intentionally (`vendor-lodash`, `vendor-markdown`, `vendor-upload`, `@floating-ui` folded into `vendor-radix`) so the standard production build stays below the Vite 500 kB warning threshold without changing runtime behavior.
- 2026-04-01: Post-push CI follow-up — `MobileDashboard.tsx` reflowed with Prettier after the GitHub `Prettier` job flagged a wrapping mismatch on the historical-mode helper copy. No behavioral change.
- 2026-04-01: Technical hardening cleanup — app root now disables telemetry coherently (`App.tsx` + `CRM.tsx` aligned), `dompurify` upgraded to 3.3.3, normal builds no longer emit sourcemaps or `dist/stats.html` unless explicitly requested, unsupported demo entrypoints removed (`vite.demo.config.ts`, `demo/`, `Welcome.tsx`, `VITE_IS_DEMO` branches), `TagsListEdit` now used directly in ClientShow, and `QuoteCardActions` no longer uses a pointless dynamic import for `QuotePDF`.
- 2026-04-01: Error handling audit — 8 verified bugs fixed (6 HIGH/MEDIUM + 2 LOW): `parseAiVisualBlocks` shared helper + `InvalidAiOutputError` for 6 AI EFs (502 vs 500 discrimination), `validateGoogleTokenResponse` for OAuth token caching, Supabase mutation error checks in `google_calendar_sync`, `useNotify` on `DashboardDeadlineTracker` mutations, `getUserSale` throws on DB error instead of masking as 401, `storageBucket` fetch error logging, runtime validation on Google Calendar API response shape, `updateSaleDisabled` error check in users EF. 16 new unit tests. Prettier formatting sweep (28 files, whitespace only).
- 2026-03-31: Timezone bonifica phase 4b — removed the last grep-noise/residual date conversions: `google_calendar_sync` now uses shared `addDaysToISODate`, `CreateServiceFromQuoteDialog` normalizes draft date inputs via `toBusinessISODate`, and the `DateInput` JSDoc example no longer suggests `toISOString().split("T")[0]`.
- 2026-03-31: Timezone bonifica phase 4 — `DashboardAnnual`, `MobileDashboard`, `DashboardAnnualAiSummaryCard`, `DashboardDeadlinesCard`, `useGenerateFiscalTasks` and the shared Edge Function fiscal deadline flow now consume/generate business dates via `dateTimezone`; `fiscal_deadline_check` derives `currentYear` from the Europe/Rome business date instead of runtime-local `Date`.
- 2026-03-31: Timezone bonifica phase 3 — `dashboardModel`, `fiscalModel`, `fiscalDeadlines` and payment reminder flows now classify years/months/day-deltas via `dateTimezone` business-date helpers instead of browser-local `Date` math; payment reminder emails now pass an explicit headline to the shared HTML renderer.
- 2026-03-31: Timezone bonifica phase 2 — task all-day flows now normalize due_date on the Europe/Rome business day across create/edit/postpone/list filters, `formatDateRange`/`formatDateLong` no longer drift on all-day timestamps, and `unifiedCrmReadContext` classifies overdue/upcoming payments/tasks via business-date helpers instead of browser-local `Date` math.
- 2026-03-31: Project list: batch client fetch via useGetMany (replaces N+1 useGetOne per row), budget displayed in mobile card via formatCurrencyPrecise.
- 2026-03-30: Bugfix audit — 9 verified fixes: Payment.client_id nullable alignment (types.ts + consumer guards in dashboardModel/PaymentListContent), updated_at added to Service/Payment/Expense types, client tags default, supplier dropdown canonical import (credito_ricevuto), budget formatCurrencyPrecise unification (ProjectShow+Kanban), expense mobile card supplier name, DashboardKpiCards compact prop implementation, DeltaArrow 0% display, JSON.parse defensive try-catch in dataProvider.
- 2026-03-09: fix(settings/mobile): Save bar now inline (scrollable) on mobile instead of fixed overlay that clashed with MobileNavigation. Desktop keeps fixed bar. fix(ai/invoice-draft): when user mentions "preventivo" but no open quotes exist in context, parser returns null (delegates to AI model) instead of misleading fallback to unrelated client surface.
- 2026-03-08: Mobile dashboard data parity fix — added useRealtimeInvalidation to MobileAnnualDashboard (was missing, causing stale data from persistent localStorage cache). Added staleTime: 2min to mobile QueryClient to force refetch when data is stale. Fixes expenses showing 0 on mobile while desktop showed correct values.
- 2026-03-08: AI shared components — AiStatusCallout (4 tones: success/warning/info/error, Navy & Petrolio for info), AiDraftSummaryBar (Bambino-style resource summary with Banknote/Receipt/Wrench icons and semantic colors), PaymentDraftCard upgraded with Navy & Petrolio palette + hero amount. AiInvoiceImportView refactored to use shared components replacing hardcoded callout/confirmation boxes. File upload hint shows limits inline (6 files, 20 MB each). Current date injected in extraction prompt to prevent false future-date warnings.
- 2026-03-08: unified_crm_answer robustness — removed `reasoning.effort` parameter (caused empty outputs), compacted JSON context, `max_output_tokens` bumped to 2000, improved error logging. Suggestion engine: payment keywords expanded in focusPayments patterns, quote suggestions scoped to focusQuotes-only in genericSummary path.
- 2026-03-08: AI chat robustness — conversation history per-turn cap (3000 chars answer, 1200 chars question) in normalizeConversationHistory; 30s timeout with Promise.race on Edge Function call in provider; user-friendly timeout error message.
- 2026-03-08: Invoice import prompt hardening — 3 Pareto rules added: (1) classification by P.IVA ownership (cedente=titolare → payments, else → expenses); (2) always use net/imponibile amounts, not gross; (3) match clients by VAT/CF first, name second, null if uncertain. Reduces misclassification, wrong amounts, and failed client matches.
- 2026-03-08: unified_crm_answer Edge Function split — extracted prompt.ts (instructions + missing key markdown), helpers.ts (buildCrmFlowResponse + resolveTravelEstimate), handleCreateFlows() for rule engine branching. index.ts reduced from 460 to 290 lines, answerUnifiedCrmQuestion complexity reduced.
- 2026-03-08: AI chat suggestion cards redesign — replaced rotating 2×4 grid with category chips + question list layout (Navy & Petrolio palette). 9 Pareto-optimized categories ordered by daily usage frequency: Panoramica, Fatturazione, Incassi, Lavoro svolto, Spese e km, Preventivi, Clienti, Promemoria, Automazioni. Fatturazione promoted to dedicated category. Removed unused useRotatingSuggestions hook.
- 2026-03-08: AI invoice draft create flow — dedicated create flow in unified_crm_answer for invoice generation via chat. parseUnifiedCrmInvoiceDraftQuestion() detects "fattura/aruba/bozza fattura" intent, resolves entity (quote > project > client) from snapshot with entity matching, builds rich markdown with financial summary (totalFees, totalPaid, balanceDue, uninvoicedServices), provides up to 3 handoff actions to Show pages with ?invoiceDraft=true. Registered in Edge Function before generic suggestion fallback.
- 2026-03-08: Migration idempotency fix — `20260308003136` constraint creation wrapped in DO block for safe remote replay (no functional change)
- 2026-03-08: FatturaPA XML generation — invoiceDraftXml.ts builder generates FatturaPA v1.2.3 (FPR12) XML from invoice draft. BusinessProfile extended with structured address (addressStreet/Number/PostalCode/City/Province/Country) + beneficiaryName. Modal: invoice number input + Download XML button. XML includes DatiTrasmissione (Aruba PEC CF), CedentePrestatore (RF19), CessionarioCommittente, DettaglioLinee (IVA 0% N2.2), DatiPagamento (MP05 bonifico). Bollo excluded from XML (Aruba handles it).
- 2026-03-08: Invoice draft commercial structure — invoiceDraftPdf.tsx rewritten with Aruba FE-aligned layout (Fornitore/Cliente, 6-col table with IVA N2.2, bollo row, payment method with Banca/BIC/IBAN, RF19 regime, Riepilogo IVA + Calcolo fattura, Netto a pagare hero, Causale). InvoiceDraftDialog modal aligned to same structure. BusinessProfile extended with bankName and bic. SendPaymentReminderDialog aligned to Navy & Petrolio. Services list: clickable client/project names.
- 2026-03-08: Historical dashboard "Approccio Bambino" redesign — unified DashboardHistoricalAiCard (replaces 2 old AI cards) with Vista smart, scope selector (storico/incassi), color-coded suggested questions, PDF export, compact mobile mode. KPI cards and CashInflowCard redesigned with Bambino layout (semantic colors, big numbers, icon badges). Deleted: DashboardHistoricalAiSummaryCard, DashboardHistoricalCashInflowAiCard. Edge Functions: all 4 historical EFs updated with visualMode support.
- 2026-03-08: AI visual mode ("Vista smart") — opt-in toggle on annual AI card. When active, Edge Functions return structured JSON blocks (text, metrics, bar-chart, trend, progress, comparison, breakdown, callout, action) rendered by AiBlockRenderer.tsx. Provider methods accept `{ visualMode }` option. Toggle persisted in localStorage. Shared prompt in `_shared/visualModePrompt.ts`.
- 2026-03-08: Dashboard Pareto features — 4 new dashboard capabilities: (1) DashboardNetAvailabilityCard showing cash-received minus expenses minus taxes; (2) fiscal deadline payment tracking via useFiscalPaymentTracking (localStorage persistence); (3) DashboardCashFlowCard with 30-day inflow/outflow forecast combining pending payments and fiscal deadlines; (4) Year-over-year comparison (YearOverYearComparison type + DashboardYoyBadge) on KPI cards; AI context enriched with cash_received_net metric and yearOverYear section; Edge Function prompts updated
- 2026-03-08: Dashboard alert action links — each alert row in DashboardAlertsCard now has a discrete icon linking to the service/quote detail page
- 2026-03-08: AI annual context enriched with expenses — DashboardModel aggregates expenses by type (excludes crediti, computes km reimbursement), buildAnnualOperationsContext serializes expenses section, Edge Functions updated with expense/margin AI instructions, annualOperationsAiGuidance adds dynamic guardrails for zero-expenses and provisional estimates
- 2026-03-08: Service type icons — added dedicated icons for riprese_montaggio (Clapperboard/indigo) and sviluppo_web (Code/teal); all defaultServiceTypeChoices now have a matching icon+color entry
- 2026-03-08: Projects view mode (list/kanban) persisted in localStorage
- 2026-03-08: Resizable columns on all list pages (useResizableColumns hook + ResizableHead component, localStorage persistence). Client filter added to services list. FilterHelpers refactor (FilterPopover generic component replaces duplicated Popover blocks across 6 filter files)
- 2026-03-08: AI layer fully aligned with suppliers — snapshot includes recentSuppliers, supplierFinancials, supplier refs on expenses/tasks/contacts; semantic registry, capability registry, Edge Function instructions updated
- 2026-03-08: Supplier financial section — SupplierFinancialSummary (debiti/crediti), SupplierFinancialDocsCard (storico documenti), financial_documents_summary view updated with supplier_id + LEFT JOIN
- 2026-03-31: Timezone bonifica — centralized `dateTimezone` modules (client + EF), 12 call sites fixed, `financial_documents_summary` view uses `(NOW() AT TIME ZONE 'Europe/Rome')::date` instead of `CURRENT_DATE`
- 2026-04-01: AI financial summaries refactored — `buildProjectFinancialSummaries` and `buildClientFinancialSummaries` replaced with thin view mappers (`mapProjectFinancialRows`, `mapClientCommercialPositions`) that read from `project_financials` and `client_commercial_positions` database views instead of computing from raw records
- 2026-03-08: Supplier notes — SupplierNotesSection using `client_notes.supplier_id`, migration makes client_id nullable with CHECK constraint
- 2026-03-08: Cloudinary — fix crop coordinates applied to saved URL (widget returns original + coordinates, now injected as c_crop transform)
- 2026-03-08: Cloudinary Upload Widget — all available sources enabled (local, url, camera, image_search, google_drive, dropbox, unsplash, shutterstock, gettyimages, istock)
- 2026-03-08: Cloudinary URL transform ordering fix — crop transforms (c_crop) preserved before display transforms to avoid 400 errors
- 2026-03-08: Cloudinary — ListAvatar component shows logo/photo in list rows with icon fallback (clients, contacts, suppliers)
- 2026-03-08: Cloudinary — on-demand AI background removal for avatar uploads (via URL transform, requires addon active on preset)
- 2026-03-08: Cloudinary Upload Widget — interactive square crop (1:1) for avatar mode (logos, contact photos)
- 2026-03-08: Cloudinary media fields on Suppliers (logo) — form input, show page, semantic registry
- 2026-03-08: Cloudinary media fields on Clients (logo), Contacts (photo), Payments (proof), Expenses (proof) — form inputs, show pages, AI snapshot + semantic registry
- 2026-03-07: Remove `notes` text field from clients/suppliers UI — keep only `client_notes` chronological log
- 2026-03-07: Cloudinary integration — SDK, Upload Widget, Media Library Widget, hooks and reusable CloudinaryMediaButton component
- 2026-03-07: Supplier reminders — `client_tasks.supplier_id` FK, SupplierTasksSection in SupplierShow, AddTask supports supplier context
- 2026-03-07: Contacts can link to suppliers via `supplier_id` FK; SupplierShow shows referents section; ContactShow/ContactInputs support supplier link
- 2026-03-07: Suppliers `tags bigint[]` column; generic `TagsListEdit` component replaces hardcoded `ClientTagsListEdit`
- 2026-03-07: Moved Aruba S.p.A. and CAPIZZI FABIO STEFANO from clients to suppliers (data-only, zero dependencies)
- 2026-03-07: Suppliers `default_expense_type` — auto-fills expense type when selecting a supplier in expense form (credito_ricevuto excluded)
- 2026-03-07: Suppliers list filters (desktop sidebar always visible + mobile sheet): name, email, VAT, fiscal code, city
- 2026-03-07: Fix column preferences 406 — use maybeSingle() instead of single() for settings query
- 2026-03-07: Desktop Header and mobile Altro menu now driven by moduleRegistry (iconColor field); no more hardcoded HEADER_ITEMS
- 2026-03-07: Suppliers module — new `suppliers` table, FK `supplier_id` on `expenses`, CRUD module, AI semantic registry, invoice import match/create
- 2026-03-07: Bulk selection + column visibility across all 6 CRM lists (clients, contacts, projects, services, payments, expenses)
- 2026-03-06: Fix rimborso_spese incorrectly counted as taxable income in fiscal model
- 2026-03-06: Payment reminder: import labels from single source, hide sollecito for rimborso payments
- 2026-03-06: Auto-create km expenses from services via DB trigger (sync_service_km_expense)
- 2026-03-06: Prettier formatting sweep (38 files, whitespace only, no logic changes)
- 2026-03-06: Google Calendar integration — auto-sync services to calendar via Service Account
- 2026-03-06: Fix import path in dataProviderGoogleCalendar (edgeFunctionError)
- 2026-03-06: Comprehensive mobile layout audit — fix all Create/Edit/Show pages (flex-col, mb-28, responsive titles, Settings bottom padding, PDF preview overflow, button wrapping)
- 2026-03-06: Fix mobile FAB clearance on all List pages (spacer in ListView), Dashboard, and TasksList
- 2026-03-06: Update ExpenseListContent icons and colors for new expense types; fix Highway→Route icon (Highway not exported by lucide-react)

## Continuita'

Per riprendere correttamente il progetto in una nuova chat o sessione, i file
di riferimento minimi non sono solo questa architettura generale.

Leggere sempre anche:

- `docs/README.md`
- `docs/historical-analytics-handoff.md`
- `docs/development-continuity-map.md`
- `docs/historical-analytics-backlog.md`
- `docs/contacts-client-project-architecture.md`

Regola pratica:

- se una modifica introduce una nuova regola configurabile o cambia un default
  condiviso, va aggiornata anche `Impostazioni`
- se una modifica e' solo strutturale/read-only, `Impostazioni` non va toccata
  ma la motivazione va lasciata nei docs di continuita'

## Update 2026-03-06 — Preserve Import Draft State on Sheet Close

Lo sheet AI Launcher ora preserva lo stato della vista import (file, bozze,
conferme) e la vista attiva quando viene chiuso e riaperto, identico al
comportamento gia' esistente per la chat AI libera. Un bottone "Nuova"
nell'header della vista import (stesso pattern del bottone "Nuova" nella chat)
permette il reset esplicito del workspace.

File coinvolti:
- `AiLauncherHeader.tsx` — aggiunto bottone "Nuova" per la vista import
- `UnifiedAiLauncher.tsx` — rimosso `resetImportWorkspace()` da `onOpenChange`,
  preservato `activeView` alla chiusura

## Update 2026-03-04 (j) — Copy Answer Button in AI Chat Header

Aggiunto bottone copia (icona Copy) nell'header della chat AI, a sinistra del
bottone "Nuova". Copia l'intero `answerMarkdown` negli appunti con feedback
visivo (icona Check per 2 secondi). Visibile solo quando c'è una risposta.

Test aggiornati: le suggestion card ora includono un titolo categoria inline,
quindi i test usano `findByText` + `.closest("button")` invece di
`getByRole("button", { name })` per selezionare una suggestion.

## Update 2026-03-04 (i) — Rotating Suggestion Cards in AI Chat

L'empty state della chat AI ora mostra 8 card suggerimento divise per categoria
con rotazione sfalsata. Ogni 4 secondi 2 card (di categorie diverse) cambiano
domanda con un fade-in animato.

File nuovi:

- `src/lib/ai/suggestedQuestionCategories.ts` — 8 categorie × 3 domande (pool)
- `src/hooks/useRotatingSuggestions.ts` — hook di rotazione con coda shuffled
- `src/components/atomic-crm/ai/SuggestionCards.tsx` — componente presentazionale

Categorie: Panoramica, Clienti e referenti, Preventivi, Progetti e servizi,
Pagamenti e fatture, Spese e trasferte, Promemoria, Automazioni.

`unifiedCrmSuggestedQuestions` in `unifiedCrmAssistant.ts` ora derivato dal
pool categorizzato per backward compatibility. `UnifiedCrmAnswerPanel.tsx`
ridotto da 527 a 472 righe estraendo le suggestion cards.

## Update 2026-03-04 (h) — PaymentDraftCard aria-label

Aggiunto `aria-label` ai `<select>` di tipo e stato in `PaymentDraftCard.tsx`
per accessibilita'. Nessun cambiamento funzionale.

## Update 2026-03-04 (g) — Split unifiedCrmAnswer.ts (3110 → 6 files)

`supabase/functions/_shared/unifiedCrmAnswer.ts` (3110 righe) splittato per
concern reale in 5 moduli + barrel re-export:

| File | Righe | Concern |
|---|---|---|
| `unifiedCrmAnswerTypes.ts` | 122 | Types + constant |
| `unifiedCrmAnswerUtils.ts` | 220 | Utility pure condivise |
| `unifiedCrmAnswerIntents.ts` | 731 | Intent detection, entity matching, inference |
| `unifiedCrmAnswerCreateFlows.ts` | 824 | Travel/episode/service/expense flows |
| `unifiedCrmAnswerSuggestions.ts` | 1373 | Suggestion engine + payment draft + validation |
| `unifiedCrmAnswer.ts` | 41 | Barrel re-export |

Dipendenze: `Types ← Utils ← Intents ← CreateFlows / Suggestions` (nessun ciclo).

Il barrel mantiene tutti gli import dei consumer (`unified_crm_answer/index.ts`
e `unifiedCrmAnswer.test.ts`) invariati. Nessun cambiamento funzionale.

## Update 2026-03-04 (f) — Type Safety Cleanup in unifiedCrmAnswer

Fix errori di tipo pre-esistenti in `unifiedCrmAnswer.ts`:
- `DraftPaymentType` alias + return type annotations per `inferPreferredPaymentType`,
  `inferQuoteDraftPaymentType`, `inferProjectDraftPaymentType`
- Estrazione `buildShowHref` in variabili locali nel branch `focusContacts`
  (stesso pattern applicato a `focusWorkflows` nel commit precedente)

Nessun cambiamento funzionale — solo type safety.

## Update 2026-03-04 (e) — AI Semantic Audit & Fiscal Deadline Awareness

### Correzioni

Audit completo della coerenza semantica AI dopo l'aggiunta di workflow automations
e fiscal deadline reminders. Gap trovati e corretti:

1. **Backend type union** (`unifiedCrmAnswer.ts`): aggiunto `"workflows"` alla
   resource union e `"workflow_create"`, `"workflow_show"` alla capabilityActionId
   union — prima il codice emetteva valori non dichiarati nel tipo
2. **Fiscal deadline AI awareness**: aggiunta regola `fiscalDeadlineReminders` alla
   semantic registry, `fiscalDeadlineReminders` al capability registry communications,
   intent detection per keywords fiscali (F24, INPS, scadenze, contributi, ecc.)
   nel rule engine, branch routing dedicato, istruzioni nel system prompt AI
3. **workflow_edit**: aggiunta action nel capability registry
4. **expenseTypes**: aggiunto dizionario mancante alla semantic registry
5. **client_tasks.due_date**: aggiunto campo date mancante alla semantic registry

### Invarianti

- Il tipo `UnifiedCrmSuggestedAction` in `unifiedCrmAnswer.ts` deve restare
  allineato con il corrispondente tipo in `unifiedCrmAssistant.ts` (frontend)
- Ogni nuovo intent nel rule engine deve avere un'esclusione nel `genericSummary`
- Ogni nuova feature backend automatica deve essere documentata sia nella semantic
  registry (regola) sia nel capability registry (communications)

## Update 2026-03-04 (d) — Fiscal Deadline Automated Reminders

### Architettura

Check giornaliero schedulato via `pg_cron` + `pg_net` che invoca la Edge Function
`fiscal_deadline_check`. La funzione:

1. Legge la fiscal config dalla tabella `configuration` (JSONB)
2. Legge pagamenti/progetti necessari a ricostruire la stima fiscale di `Y-1`
   e il piano acconti di `Y-2`
3. Calcola il calendario di pagamento dell'anno `Y` con la stessa logica pura
   del client-side (`fiscalDeadlines.ts` / `fiscalModel.ts`)
4. Crea `client_tasks` per le scadenze entro 30 giorni (con deduplicazione)
5. Manda notifica email + WhatsApp per le scadenze entro 7 giorni
6. Logga warning strutturati se parte del cash tassabile resta non mappata a un
   profilo ATECO valido (`UNMAPPED_TAX_PROFILE`) senza bloccare il calendario

### File coinvolti

- `supabase/functions/_shared/fiscalDeadlineCalculation.ts` — calcolo scadenze (port Deno)
- `supabase/functions/fiscal_deadline_check/index.ts` — Edge Function principale
- `supabase/migrations/20260304184909_fiscal_deadline_cron.sql` — pg_cron + pg_net + schedule
- `supabase/seed.sql` — Vault secrets per ambiente locale

### Dipendenze

- Estensioni: `pg_cron`, `pg_net`, Vault (gia' disponibile in Supabase hosted)
- Secrets in Vault: `project_url`, `service_role_key` (per invocare la Edge Function)
- `internalNotifications.ts` riusato per email + WhatsApp best-effort

### Scadenze coperte (regime forfettario)

- **30 giugno**: Saldo + 1° Acconto (F24 + INPS) — high priority
- **30 novembre**: 2° Acconto (F24 + INPS) — high priority
- **31 maggio, 30 settembre, 30 novembre, 28 febbraio**: Bollo trimestrale — low priority
- **31 ottobre**: Dichiarazione dei redditi — low priority

## Update 2026-03-04 (c) — Realtime, Payment Reminders, Internal Notifications

### Supabase Realtime

Hook `useRealtimeInvalidation` sottoscrive `postgres_changes` su tabelle
specifiche e invalida la cache React Query corrispondente.

Integrato in:

- `DashboardAnnual`: payments, services, projects, quotes, expenses, clients, client_tasks
- `DashboardHistorical`: payments, services, projects, clients, analytics views + custom query key `historical-cash-inflow-context`

File: `src/hooks/useRealtimeInvalidation.ts`

### Payment Reminder Email (con review)

Flusso:

1. Dashboard deadline tracker mostra pulsante "Reminder" per pagamenti scaduti
2. Click apre `SendPaymentReminderDialog` con anteprima email
3. Utente rivede, aggiunge messaggio opzionale, conferma
4. Edge Function `payment_reminder_send` invia email al cliente via SMTP
5. Dopo invio, `notifyOwner()` invia conferma al proprietario via email + WhatsApp

File principali:

- `src/lib/communications/paymentReminderEmail.ts` — template builder
- `src/lib/communications/paymentReminderEmailTypes.ts` — tipi
- `src/components/atomic-crm/payments/SendPaymentReminderDialog.tsx` — dialog review
- `supabase/functions/payment_reminder_send/index.ts` — Edge Function
- `supabase/functions/_shared/paymentReminderSend.ts` — validazione payload

### Internal Notifications (Email + WhatsApp CallMeBot)

Modulo shared `supabase/functions/_shared/internalNotifications.ts`:

- `sendInternalEmail(subject, text)` — SMTP verso `SMTP_USER` (owner)
- `sendWhatsApp(message)` — GET a `api.callmebot.com/whatsapp.php`
- `notifyOwner(subject, message)` — chiama entrambi, best-effort

Env vars: `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` (gia' in `.env`)

Usato da `payment_reminder_send`, riusabile per future automazioni.

## Update 2026-03-04 (b) — Kanban, Workflow

### Kanban Project View

La lista progetti ora supporta toggle lista/kanban (solo desktop).
Il Kanban mostra 4 colonne per stato: in_corso, in_pausa, completato,
cancellato. Drag-and-drop nativo HTML5 cambia lo stato del progetto.

File: `src/components/atomic-crm/projects/ProjectKanbanView.tsx`

### Workflow Automation

Nuovo modulo `workflows` registrato nel module registry.

DB:

- tabella `workflows` (trigger_resource, trigger_event, trigger_conditions JSONB, actions JSONB)
- tabella `workflow_executions` (log esecuzione per debug)
- 3 workflow pre-seeded (preventivo accettato, progetto avviato, pagamento ricevuto)
- `trigger_resource` CHECK: tutte e 8 le risorse CRM (clients, contacts, projects, quotes, services, payments, expenses, client_tasks) — migration `20260306160426`

Engine client-side:

- `workflowEngine.ts`: intercetta afterCreate/afterUpdate via lifecycle callbacks
- anti-loop: flag `_executing` impedisce trigger ricorsivi
- azioni supportate: `create_task`, `create_project`, `update_field` (esegue `dataProvider.update` reale), `send_email`, `send_notification`
- `send_email`: invia email a destinatario (client_email o custom) via Edge Function `workflow_notify`
- `send_notification`: notifica interna al proprietario (email + WhatsApp CallMeBot) via `workflow_notify`
- template con placeholder: `{nome_cliente}`, `{risorsa}`, `{stato}`, `{importo}`, `{data}` — risolti server-side
- logging automatico in `workflow_executions`

Edge Function: `supabase/functions/workflow_notify/index.ts`

- riceve `channel` (`email_external` | `notify_owner`), `trigger_resource`, `trigger_record_id`
- risolve placeholder dal record e dal client via `supabaseAdmin`
- dispatch a SMTP (email esterna) o `notifyOwner()` (dual-channel interno)
- shared: `workflowNotifyTypes.ts`, `workflowTemplatePlaceholders.ts`

UI: List, Create, Edit, Show con execution history.
List ha mobile card view (niente tabelle su telefono).
Titolo principale card mobile: `text-base font-bold` su tutti i moduli.
Show ha griglia responsive e pre-block con overflow.
Navigazione: menu "Altro" mobile, non nella header desktop.
WorkflowCreate supporta precompilazione via search params (name, trigger_resource, trigger_event, action_type, etc.).

Integrazione AI Chat:

- Le automazioni attive sono incluse nella snapshot `UnifiedCrmReadContext` come `activeWorkflows`
- Il modulo `workflows` e' registrato nel module registry con metadati AI
- Il capability registry dichiara `workflow_create` e `workflow_show` come azioni approvate
- Il semantic registry include la regola `workflowAutomations`
- Le istruzioni AI nell'Edge Function guidano l'LLM a verificare se un'automazione equivalente esiste gia prima di suggerirne una nuova
- Il rule engine aggiunge handoff strutturati quando l'intent riguarda automazioni

## Update 2026-03-06 (b) — Google Calendar Integration

### Overview

Sync unidirezionale Gestionale → Google Calendar. Quando un servizio viene
creato, modificato o eliminato, l'evento corrispondente su Google Calendar
viene automaticamente sincronizzato.

### Autenticazione

- **Service Account** Google (no OAuth, no consent screen)
- Il calendario dell'utente e' condiviso con l'email del service account
- JWT firmato localmente → scambiato per access token via Google OAuth2
- Token cached in memoria nell'Edge Function (refresh automatico)

### Flusso

1. Lifecycle callback `afterCreate`/`afterUpdate`/`afterDelete` su `services`
2. Awaited: chiama `syncServiceToCalendar()` nel dataProvider e mergia il risultato nel record
3. Edge Function `google_calendar_sync` riceve action + service_id
4. Legge il servizio + client + project dal DB
5. Crea/aggiorna/elimina evento su Calendar API v3
6. Salva `google_event_id` + `google_event_link` sul record servizio

### File coinvolti

- `supabase/functions/_shared/googleCalendarAuth.ts` — JWT signing + token cache
- `supabase/functions/google_calendar_sync/index.ts` — Edge Function
- `src/components/atomic-crm/providers/supabase/dataProviderGoogleCalendar.ts` — provider method
- `src/components/atomic-crm/providers/supabase/dataProvider.ts` — lifecycle callbacks
- `src/components/atomic-crm/services/ServiceShow.tsx` — link cliccabile
- `src/components/atomic-crm/types.ts` — campi `google_event_id`, `google_event_link`

### Secrets remoti

- `GOOGLE_CALENDAR_CLIENT_EMAIL`
- `GOOGLE_CALENDAR_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`

### Formato evento

- Titolo: `{Progetto} — {Descrizione}` (se no descrizione, usa tipo servizio)
- Luogo: `location` o `travel_destination`
- Note evento: tipo servizio, cliente, URL cliccabile al servizio nel gestionale
- All-day: usa `date` fields (end esclusivo)
- Timed: default 09:00–18:00 Europe/Rome

## Update 2026-03-04

### Module Registry come fonte unica dei moduli CRM

La registrazione dei moduli e' ora centralizzata in:

- `src/components/atomic-crm/root/moduleRegistry.ts`

Il registry governa:

- resource name, route, componenti CRUD/mobile
- visibilita' e ordine nav desktop/mobile
- visibilita' nel menu create mobile (`navigate` vs `sheet`)
- identita' AI della risorsa
- badge opzionali per la navigazione (es. pagamenti scaduti)
- moduli headless abilitabili/disabilitabili senza rimuovere codice

Desktop header, mobile bottom bar, menu "Altro", create menu e `CRM.tsx`
leggono ora la stessa definizione, senza liste hardcoded duplicate.

### Modulo headless invoicing

Il modulo cross-cutting `invoicing` e' registrato come headless con identita'
AI esplicita. Non espone Resource page, ma rende conoscibile al layer AI il
flusso "bozza fattura interna" da servizio/progetto/cliente/preventivo.

### Scadenzario operativo e read-context AI

La dashboard annuale include una card `DashboardDeadlineTracker` con:

- pagamenti scaduti
- pagamenti in scadenza (7 giorni)
- promemoria in scadenza (7 giorni)

Il componente e' splittato in moduli focalizzati:

- `dashboardDeadlineTrackerModel.ts` — filtering, sorting, conteggi (builder puro)
- `dashboardDeadlineTrackerFormatters.ts` — formattazione date, valute, nomi
- `DashboardDeadlineTrackerSummary.tsx` — contatori colorati + empty state
- `DashboardDeadlineTrackerActionList.tsx` — lista azioni con dot/link/button
- `DashboardDeadlineTrackerContent.tsx` — orchestrazione summary + action list

Contatori e totali usano il dataset completo; la lista visibile e' limitata
(`slice`) per non sovraccaricare la card.

### Type safety e allineamento tipi (2026-03-31)

Audit su 632 file con fix non comportamentali:

- tipi analytics views e `ProjectFinancialRow` allineati a `RaRecord` (`id`)
- `UpcomingServiceAlert.serviceType` allineato al union literal di `Service`
- `FiscalDeadline` dichiarazione redditi: aggiunti `paidAmount`/`paidDate`
- dead code `_selectedModel` rimosso dalle AI card (model risolto nel provider)
- `@testing-library/jest-dom/vitest` aggiunto a `tsconfig.app.json` per i
  matcher DOM nei test
- classi Tailwind normalizzate alla sintassi v4 canonical

Il read-context AI (`buildUnifiedCrmReadContext`) include ora anche:

- `overduePayments`
- `upcomingTasks`
- `overdueTasks`
- `pendingPayments[].isTaxable` derivato semanticamente

### Tassabilita' coerente

Aggiornamenti principali:

- migration `quotes.is_taxable` (`BOOLEAN NOT NULL DEFAULT true`)
- default automatico `is_taxable` su servizi e preventivi guidato da
  `fiscalConfig.taxabilityDefaults`
- tassabilita' pagamento derivata via config (`taxabilityDefaults`)
- modello fiscale basato su principio di CASSA (incassi ricevuti nell'anno),
  non su competenza (servizi erogati). La base imponibile forfettaria e' la
  somma dei pagamenti con `status='ricevuto'` e `payment_date` nell'anno,
  mappati a categorie ATECO tramite il progetto collegato. I flat payments o le
  categorie non collegate usano il fallback esplicito
  `fiscalConfig.defaultTaxProfileAtecoCode`; se il fallback e' invalido o
  mancante, il cash resta in `unmappedCashRevenue`, non entra nei bucket
  imponibili ATECO e alza il warning `UNMAPPED_TAX_PROFILE`.
- metriche operative (margini, DSO, concentrazione clienti) restano basate
  sui servizi (competenza) per coerenza con la salute business
- KPI fiscali estesi:
  - `fatturatoTotaleYtd` (incassato totale)
  - `fatturatoNonTassabileYtd` (incassato non tassabile)
  - `unmappedCashRevenue` (incassato tassabile ma fiscalmente non mappato)

### Bozza fattura interna (no write DB)

Scopo operativo: rispondere alla domanda "quanto mi deve ancora questo
cliente/progetto/preventivo?" e generare un PDF di supporto da inviare alla
controparte come simulazione fattura. Non e' una fattura reale.

Modulo condiviso in `src/components/atomic-crm/invoicing/`:

- builders puri da service/project/client/quote
- dialog unico `InvoiceDraftDialog`
- generazione PDF con watermark "BOZZA - NON VALIDA AI FINI FISCALI"; layout
  e palette colori allineati al PDF preventivo; colonne totali con larghezze
  fisse per allineamento a destra; P.IVA e CF emittente visibili nell'header
  (non solo footer)
- identità visiva condivisa: PDF preventivo e email preventivo usano la palette
  Navy (`#1B2A4A`) & Petrolio (`#2A7B88`) con layout card-based; la bozza
  fattura segue lo stesso stile per coerenza cross-canale
- nessuna scrittura DB: output solo di supporto operativo per compilazione
  Aruba

Semantica di calcolo dei builders:

- ogni builder somma il valore netto dei servizi non ancora fatturati
  (esclusi quelli con `invoice_ref` valorizzato)
- i km reimbursement vengono aggregati come voce separata; il calcolo usa
  `calculateKmReimbursement()` che applica `defaultKmRate` dalla config quando
  il servizio ha `km_rate` NULL — ogni Show page legge
  `operationalConfig.defaultKmRate` da `useConfigurationContext()` e lo passa
  esplicitamente ai builder; **non usare** `km_distance * km_rate` inline (bug
  storico: NULL → 0). `TravelRouteCalculatorDialog.toRateValue` also treats
  `km_rate === 0` as unset and falls back to `defaultKmRate`.
  `ClientFinancialSummary` now reads a single row from the
  `client_commercial_position` view via `useGetOne` — zero recalculation in
  React
- vengono sottratti **solo** i pagamenti con `status === "ricevuto"` — i
  pagamenti `in_attesa` o `scaduto` non riducono il dovuto
- i rimborsi (`payment_type === "rimborso"`) hanno segno invertito nella
  deduzione
- se il totale esigibile e' <= 0, il builder restituisce `lineItems: []`
  (nessun importo da richiedere)

Tipo condiviso: `DraftPayment = Pick<Payment, "amount" | "payment_type" |
"status">`

Helper unificato: `hasInvoiceDraftCollectableAmount(draft)` — usato da tutte
le pagine Show per decidere se mostrare il pulsante "Genera bozza fattura".
Un draft non-null con `lineItems: []` non mostra il pulsante.

Entry point UI:

- `ServiceShow` — draft singolo servizio (escluso se gia' fatturato)
- `ProjectShow` — aggrega servizi progetto non fatturati + km + deduce
  pagamenti ricevuti del progetto
- `ClientShow` — aggrega tutti i servizi non fatturati del cliente + km +
  deduce tutti i pagamenti ricevuti del cliente
- `QuoteShow` — usa le voci del preventivo (`quote_items`) + deduce
  pagamenti ricevuti collegati al preventivo

Ogni Show page carica i pagamenti collegati tramite `useGetList<Payment>` con
il filtro appropriato (`client_id@eq`, `project_id@eq`, `quote_id@eq`).

### Test strategy aggiornata

Guardrail test ampliati con:

- test unitari per i 4 builder invoice draft, inclusi:
  - filtro `status === "ricevuto"` (non deduce `in_attesa`/`scaduto`)
  - inversione segno rimborsi
  - copertura completa → `lineItems: []`
  - esclusione servizi gia' fatturati (`invoice_ref`)
- test unitari helper scadenzario (ordinamento/filtro pagamenti/task)
- estensioni a test di semantica, fiscal model, configuration merge e
  read-context AI per i nuovi invarianti di tassabilita'/scadenze

### Fix coerenza dashboard e AI (post module-registry)

Calcoli dashboard corretti:

- **DSO inclusivo flat services**: pagamenti senza `project_id` ora usano la
  data del servizio flat piu' vecchio del cliente come riferimento
  (`clientEarliestFlatService` in `fiscalModel.ts`)
- **Margini inclusivi spese generali**: spese senza `project_id` ora rientrano
  nella categoria `"__general"` (Spese generali) invece di essere ignorate
- **Revenue operativo inclusivo flat services**: servizi senza `project_id` ora
  rientrano nella categoria `"__flat"` (Servizi diretti) nel dashboard annuale
  e nel conteggio `topClientRevenue`
- **KPI labels chiariti**: "netto sconti, non incassi" → "tutto il lavoro
  svolto" nel dashboard operativo; label fiscali chiarite con "(solo tassabile)"

AI read-context esteso:

- `clientFinancials`: aggregato per cliente con totalFees, totalPaid,
  balanceDue, hasUninvoicedServices — permette alla chat di rispondere a
  "quanto mi deve Diego?" con importi reali
- tutti i limiti di slicing rimossi: clienti, contatti, preventivi, progetti,
  pagamenti, task, spese e servizi flat sono esposti senza cap numerico
- `clientLevelServices` senza limite (era slice 10)
- `activeProjects[].services`: array di servizi individuali per progetto
  (max 20 per progetto, ordinati per data desc) — prima erano solo totali
  aggregati (totalServices, totalFees)

AI intent parsing e handoff:

- `inferProjectQuickEpisodeDescription`: estrae un titolo breve del servizio
  dalla domanda utente (testo tra virgolette o dopo "titolo:/descrizione:")
- il prompt AI include istruzioni esplicite sulla distinzione description
  (titolo identificativo) vs notes (annotazioni operative)
- `hasInvoiceDraftIntent` ammorbidito: "fattura per Diego" ora funziona senza
  verbo d'azione esplicito grazie a pattern direzionali (per/di/del/della...)
- handoff fattura context-aware: usa `pickClientFromQuestion` e
  `pickProjectFromQuestion` per trovare l'entita' menzionata dall'utente
- suggestedActions fattura multi-opzione: mostra tutte le superfici disponibili
  (preventivo, progetto, cliente) come scelte separate
- system prompt aggiornato: stile conciso (elenchi puntati, dritto al punto),
  istruzioni `clientFinancials`, formato Risposta/Dettaglio/Note
- guardrail di copy: il prompt non deve esporre nomi di campi raw o flag
  interni (`hasUninvoicedServices`, `balanceDue`, ecc.); quei valori vanno
  sempre tradotti in italiano naturale lato risposta

## Current Direction

Il dominio locale e' gestito con una migration snapshot statica:

- `supabase/migrations/20260302170000_domain_data_snapshot.sql`

Dal 2026-03-04 la snapshot contiene solo TRUNCATE + INSERT dei settings di
configurazione (6 record: km_rate, currency, fee defaults). Nessun dato di
dominio (clienti, progetti, servizi, ecc.) viene pre-caricato.

I dati storici (2023-2025) sono archiviati nella cartella `Fatture/` e non
servono piu' nel database locale. Il database locale serve ora come ambiente
pulito per verificare che i flussi e i calcoli funzionino correttamente
inserendo dati dall'interfaccia CRM.

Regole operative:

- `npx supabase db reset` riallinea migration + snapshot tecnica; se serve il
  login locale, aggiungere `npm run local:admin:bootstrap`
- `make supabase-reset-database` e' il rebuild locale supportato del dominio:
  reset schema, load di `supabase/seed_domain_data.sql`, bootstrap admin
- quando servono dati di test strutturati, crearli dall'UI o con migration
  dedicate
- la suite Playwright deterministica basata su `test-data-controller.ts` e'
  un harness tecnico di regressione UI, non una base architetturale del dominio
- non reintrodurre script dinamici di rebuild o fixture dominio hardcoded come
  seconda fonte di verita'

## Current Financial Semantics Warning

Il punto piu' fragile dell'architettura corrente e' la semantica finanziaria.

Oggi `payments` ed `expenses` coprono ancora, in modo parziale e sovrapposto:

- documento emesso/ricevuto
- stato da incassare/pagare
- movimento di cassa effettivo
- in alcuni casi anche allocazione progetto

La direzione architetturale da mantenere esplicita e' separare meglio:

- documenti fiscali
- posizione aperta da incassare/pagare
- movimenti di cassa
- riconciliazioni/allocazioni

Stato attuale della separazione:

- la foundation DB ora esiste in:
  - `financial_documents`
  - `financial_document_project_allocations`
  - `cash_movements`
  - `financial_document_cash_allocations`
  - `financial_documents_summary`
- la foundation DB (tabelle, vincoli, viste) e' pronta; i dati vanno inseriti
  dall'interfaccia CRM o con migration dedicate
- `financial_documents` ora distingue anche le note di credito:
  - `customer_credit_note`
  - `supplier_credit_note`
- `financial_documents` conserva anche i campi fiscali XML necessari alla
  riconciliazione:
  - `xml_document_code`
  - `taxable_amount`
  - `tax_amount`
  - `stamp_amount`
- nel 2025 reale esiste già un caso importante:
  - `FPA 1/25` fattura
  - `FPA 2/25` `TD04` collegata a `FPA 1/25`
  - `FPA 3/25` riemissione valida
- la foundation documentale ora distingue:
  - documento fiscale
  - tipo documento (`invoice` / `credit_note`)
  - importi fiscali lordi e imponibili
  - aperti da incassare/pagare sul documento
- semantica di progetto da mantenere:
  - lo stato incasso operativo resta quello di `payments.status`
  - `payment_type` resta parte del modello operativo dei pagamenti
- `payments` ed `expenses` restano però ancora il layer compatibilità letto da
  gran parte di UI, analytics, import e AI
- il primo consumer già riallineato è `project_financials`:
  - se il progetto ha documenti nella foundation, il pagato usa
    `financial_document_cash_allocations`
  - se il progetto ha documenti ma ancora nessuna cassa allocata, la base
    semantica è `financial_documents`
  - il fallback a `payments` legacy resta solo per progetti non ancora coperti
    dalla foundation
- il prossimo lavoro corretto è migrare progressivamente i consumer verso la
  foundation nuova senza perdere il comportamento attuale

Finche' questa separazione non viene introdotta, ogni modifica a import
documenti, pagamenti, spese, dashboard, analytics e AI va considerata ad alta
fragilita' semantica.

## Stato Infrastruttura (snapshot operativa aggiornata)

### Certezze — Audit superato

| Componente | Stato | Verificato |
|------------|-------|------------|
| Schema DB custom + referenti CRM + analytics views | Deployed e conforme | migration review |
| Migration Fase 2 (discount + tariffe) | Applicata al DB remoto | `npx supabase db push` |
| Migration quotes index | Applicata al DB remoto | storico |
| Migration client_tasks + client_notes + tags | Applicata al DB remoto | storico |
| Import dati Diego Caltabiano (84 + 40 km + 3 split) | Applicata al DB remoto | storico |
| Riallocazione pagamenti Diego (DELETE 10 + CREATE 11) | Applicata al DB remoto | storico |
| Fix view project_financials (Cartesian product) | Applicata al DB remoto | storico |
| Filtri progetto su Pagamenti/Spese | Implementati | storico |
| Ricerca progetto (ilike) | Fix `q` → `name@ilike` | storico |
| Bilanci verificati: tutti i progetti Diego a 0 o pending | Confermato | storico |
| Riepilogo finanziario su ClientShow/ProjectShow | Implementato | storico |
| Dashboard Fase 2 (Recharts) | Implementata (desktop + mobile KPI) | storico |
| Pulizia moduli Atomic CRM | Completata in modo selettivo: `companies` e `deals` rimossi, `contacts` riattivato come dominio referenti | 2026-03-01 |
| Referenti CRM (`contacts` + `project_contacts`) | Implementati e integrati con clienti, progetti e chat AI | 2026-03-01 |
| Tasks adattati (Promemoria) | Funzionanti con client_tasks | storico |
| Notes clienti | Funzionanti con client_notes | storico |
| Tags clienti | Funzionanti (BIGINT[] su clients) | storico |
| RLS policies | Attive su tutte le tabelle | audit manuale |
| Signup pubblico libero | Non supportato; le route tecniche di bootstrap/recovery restano nel router, ma nel runtime Supabase single-user corrente il flusso normale resta login-only | 2026-03-01 |
| Keep-alive workflow | Attivo, testato con successo (HTTP 200) | `gh workflow run` |
| Localizzazione IT | Completa su ~70+ file, 3 livelli | storico |
| DateTime Range Support (all_day pattern) | Implementato su 4 moduli | storico |
| Simulatore Fiscale + KPI Salute Aziendale | Implementato | storico |
| Mobile UX (card lists, Sheet filters, MobileBackButton) | Tutti i moduli CRUD | storico |
| Login/Signup branding (foto utente, maschera circolare) | Implementato | storico |
| Auth init bypass (single-user hardcoded) | Implementato | storico |
| Navigazione per anno Dashboard | Implementata | storico |
| Colori semantici Dashboard (success/warning badge + progress) | Implementati | storico |
| Typecheck | Guardrail operativo, da rieseguire sulle modifiche rilevanti | workflow locale |
| Build produzione (`npm run build`) | Verifica disponibile, da rieseguire prima di release significative | workflow locale |
| Test | Suite presente + test mirati per slice | vitest |
| Lint | Guardrail operativo via ESLint + pre-commit | workflow locale |
| Deploy Vercel | gestionale-rosario.vercel.app | storico |
| Supabase locale | Supportato su porte isolate `5532x`; il bootstrap da zero deve restare replayable con `npx supabase start` | 2026-03-01 |
| Financial semantics foundation | Tabelle `financial_documents`, `cash_movements` e allocazioni pronte (schema + viste). `project_financials` usa `financial_foundation` come base primaria. La snapshot locale e' stata svuotata il 2026-03-04 per debug dei flussi; i dati storici restano in `Fatture/`. | 2026-03-04 |
| Admin locale post-reset | `make start` bootstrapa l'admin locale; dopo `npx supabase db reset` serve `npm run local:admin:bootstrap` se occorre il login | 2026-04-01 |
| Smoke E2E locale | La suite Playwright corrente usa dati tecnici deterministici per regressioni UI; non sostituisce la validazione sul dominio reale ricostruito | 2026-04-01 |
| Google Calendar sync | Unidirezionale Gestionale→Calendar via Service Account + Edge Function `google_calendar_sync`. Campi `google_event_id` e `google_event_link` su `services`. Link cliccabile in ServiceShow. | 2026-03-06 |
| Cloudinary media | SDK (`@cloudinary/url-gen` + `@cloudinary/react`), Upload Widget e Media Library Widget (script async in index.html). Config in `src/lib/cloudinary/`, hooks `useCloudinaryUpload` e `useCloudinaryMediaLibrary`, componenti `CloudinaryUploadInput` (form) e `CloudinaryImageField` (display con transform). Upload preset: `Gestionale`. Cloud: `dsmhshc2b`. Campi DB: `clients.logo_url`, `contacts.photo_url`, `payments.proof_url`, `expenses.proof_url`. AI snapshot e semantic registry aggiornati. | 2026-03-08 |
| Auth email/password locale | Abilitato solo nel runtime locale per bootstrap admin e smoke browser; non riflette automaticamente il remoto | 2026-03-01 |
| Rebuild locale del dominio | `npx supabase db reset` riallinea migration + snapshot tecnica (settings). Il rebuild locale supportato del dominio e' `make supabase-reset-database`: reset, load di `supabase/seed_domain_data.sql` dal dump remoto e bootstrap admin. | 2026-04-01 |

### Cose ancora da verificare manualmente

- Signup disabilitato nel **Supabase Dashboard remoto** (non solo config.toml locale)
- npm audit: 4 vulnerabilità (1 moderate, 3 high) — da valutare
- Il ramo `postmark` non fa parte del runtime/config attivo: le comunicazioni
  supportate oggi restano `Gmail` outbound cliente e `CallMeBot` per alert
  interni prioritari
- 3 warning lint pre-esistenti in ExpenseShow/PaymentShow (max-lines-per-function,
  complexity — non errori bloccanti)

## Database Schema

### Tabelle custom (da specifica)

Nota di continuita':

- lo schema corrente e' ancora quello operativo
- non e' ancora il modello finale desiderato per la semantica finanziaria
- `payments` ed `expenses` vanno considerati contenitori ancora troppo
  sovraccarichi finche' non verra' introdotta una separazione piu esplicita tra
  documenti, aperti e cassa

| Tabella | Scopo | RLS | Colonne |
|---------|-------|-----|---------|
| clients | Anagrafica clienti + profilo fiscale/fatturazione | auth.uid() IS NOT NULL | nome operativo, `billing_name`, contatti base, `P.IVA` / `CF`, indirizzo fiscale, `SDI` / `PEC`, note, tags, timestamps |
| contacts | Referenti / persone collegate ai clienti | auth.uid() IS NOT NULL | nome/cognome, `contact_role` strutturato, `title` libero, `is_primary_for_client`, email/telefoni JSONB, background, tags, FK `client_id`, timestamps |
| project_contacts | Join referenti-progetti | auth.uid() IS NOT NULL | FK `project_id`, FK `contact_id`, `is_primary` con unicita' per progetto, timestamps |
| projects | Progetti/programmi | auth.uid() IS NOT NULL | cliente, categoria, `tv_show`, stato, range date, budget, note, timestamps |
| services | Registro lavori (cuore) | auth.uid() IS NOT NULL | FK progetto, date/range, tipo servizio, `description`, tassabilita', fee, km (`km_distance` numeric(10,2)), `travel_origin`/`travel_destination`/`trip_mode`, `invoice_ref`, note, `updated_at` |
| quotes | Preventivi + pipeline Kanban | auth.uid() IS NOT NULL | cliente/progetto, tipo servizio, range evento, importo, stato, `quote_items`, note |
| workflows | Automazioni trigger-based | auth.uid() IS NOT NULL | nome, trigger (resource/event/conditions JSONB), actions JSONB, is_active, timestamps |
| workflow_executions | Log esecuzioni workflow | auth.uid() IS NOT NULL | FK workflow, trigger info, status, result JSONB, error, timestamp |
| payments | Tracking pagamenti | auth.uid() IS NOT NULL | cliente/progetto/preventivo, data, tipo, importo, metodo, `invoice_ref`, stato, note |
| suppliers | Anagrafica fornitori | auth.uid() IS NOT NULL | name, vat_number, fiscal_code, phone, email, address, billing_name/address/city/province/zip/country, note, timestamps |
| expenses | Spese e km | auth.uid() IS NOT NULL | cliente/progetto, data, tipo spesa (`spostamento_km`, `pedaggio_autostradale`, `vitto_alloggio`, `acquisto_materiale`, `abbonamento_software`, `noleggio`, `credito_ricevuto`, `altro`), km/importo, markup, descrizione, `invoice_ref`, `source_service_id` (FK→services, auto-create trigger), `supplier_id` (FK→suppliers, nullable) |
| client_tasks | Promemoria (opzionalmente legati a un cliente) | auth.uid() IS NOT NULL | testo, tipo, data scadenza, `all_day`, completamento, FK cliente opzionale |
| client_notes | Note clienti (con allegati) | auth.uid() IS NOT NULL | FK cliente obbligatoria, testo, data, allegati, timestamps |
| settings | Configurazione | auth.uid() IS NOT NULL | record `config` persistito per branding, tipi, AI, fiscale, operativita' |
| sales | Profilo utente e supporto auth single-user | auth.uid() IS NOT NULL | identita' utente, avatar, admin/disabled, FK `auth.users` |
| tags | Catalogo etichette riusato dai clienti e disponibile anche nel modello dati dei referenti | auth.uid() IS NOT NULL | nome, colore |
| keep_alive | Heartbeat free tier | SELECT public | ping e timestamp |
| fiscal_declarations | Dichiarazione annuale dal commercialista (tasse sostitutive + INPS totali e acconti già versati) | auth.uid() = user_id | `tax_year` (UNIQUE per user), totali imposta sostitutiva, INPS, acconti pregressi, note, timestamps |
| fiscal_obligations | Singole rate/scadenze da pagare derivate dalla dichiarazione o create manualmente | auth.uid() = user_id | FK `declaration_id` (bare, no cascade), `source` (auto_generated/manual), `component` (enum 8 valori), `competence_year`, `payment_year`, `due_date`, `amount`, `installment_number/total`, `is_overridden`, note, timestamps |
| fiscal_f24_submissions | Un evento di versamento F24 | auth.uid() = user_id | `submission_date`, note, timestamps |
| fiscal_f24_payment_lines | Allocazione importo da un F24 a un'obbligazione specifica | auth.uid() = user_id | FK `submission_id` (ON DELETE CASCADE), FK `obligation_id` (restrictive), `amount > 0`, `user_id` auto-sync dal trigger |

### Quotes — 10 stati pipeline

```
primo_contatto → preventivo_inviato → in_trattativa → accettato →
acconto_ricevuto → in_lavorazione → completato → saldato → rifiutato / perso
```

### Settings (struttura attiva)
- `title`
- `lightModeLogo`
- `darkModeLogo`
- `taskTypes`
- `noteStatuses`
- `quoteServiceTypes`
- `serviceTypeChoices`
- `operationalConfig.defaultKmRate`
- `operationalConfig.defaultTravelOrigin` — threaded to all `TravelRouteCalculatorDialog` call sites (services, expenses, invoice import, quick episode)
- `fiscalConfig.taxProfiles`
- `fiscalConfig.defaultTaxProfileAtecoCode`
- `fiscalConfig.aliquotaINPS`
- `fiscalConfig.tettoFatturato`
- `fiscalConfig.annoInizioAttivita`
- `fiscalConfig.taxabilityDefaults`
- `aiConfig.historicalAnalysisModel`: modello condiviso per Storico, Annuale e
  chat AI unificata read-only
- `aiConfig.invoiceExtractionModel`: modello dedicato all'import documenti
- `businessProfile.*`: dati emittente (nome, P.IVA, CF, codice univoco SDI,
  IBAN, indirizzo, email, telefono, tagline) usati nei PDF di preventivi e
  bozze fattura interna; editabili da Settings > Profilo Aziendale
- `googleWorkplaceDomain`: dominio Google Workspace per SSO (opzionale);
  editabile da Settings > Autenticazione; se non impostato, il login SSO
  non viene mostrato
- `disableEmailPasswordAuthentication`: disabilita login email/password
  (default false); utile quando si usa solo SSO aziendale

### Views

| View | Scopo |
|------|-------|
| project_financials | Riepilogo finanziario per progetto: fees, km, expenses, total_owed (fees + expenses), total_paid (da payments con status=ricevuto), balance_due. Single source: sempre tabella `payments`, nessun dual-path. Include `client_id` e `client_name`. `security_invoker = on`. Tipo TypeScript: `ProjectFinancialRow` in `types.ts`. |
| client_commercial_position | Posizione commerciale aggregata per cliente: total_fees, total_expenses, total_owed, total_paid, balance_due, projects_count. Applica Record Precedence Rules (project's client_id prevails). Include servizi/spese/pagamenti senza progetto. `security_invoker = on`. Tipo TypeScript: `ClientCommercialPosition` in `types.ts`. |
| monthly_revenue | Fatturato mensile per categoria (fees - discount) |
| fiscal_f24_payment_lines_enriched | JOIN di payment lines con submission_date per evitare fetch broad + join in-memory lato client. `security_invoker = on`. |
| analytics_* | Base storica/AI per Storico e consumer analytics (`analytics_business_clock`, `analytics_history_meta`, `analytics_yearly_competence_revenue`, `analytics_yearly_competence_revenue_by_category`, `analytics_client_lifetime_competence_revenue`, `analytics_yearly_cash_inflow`) |

PK esplicite nel dataProvider:
- `monthly_revenue` → PK composita `month + category`
- `project_financials` → PK `project_id`

### Struttura modulare del dataProvider Supabase

Il provider Supabase e' organizzato in moduli feature nel path
`src/components/atomic-crm/providers/supabase/`:

| File | Responsabilita' |
|------|-----------------|
| `dataProvider.ts` | Orchestratore: setup, env, auth/sales/config, assembly moduli, lifecycle callbacks |
| `dataProviderAnalytics.ts` | 9 metodi analytics (summary, answer, context getters) |
| `dataProviderAnalyticsContext.ts` | 3 context builder per storico, cash inflow, annuale |
| `dataProviderAi.ts` | CRM read context, semantic registry, domanda unificata |
| `dataProviderInvoiceImport.ts` | Workspace, upload file, genera/conferma draft import (payments, expenses, services) |
| `dataProviderCommunications.ts` | Email context preventivo, invio email |
| `dataProviderTravel.ts` | Stima tratta, suggerisci luoghi |
| `fiscalRealityProvider.ts` | CRUD fiscale: declarations, obligations, F24 submissions/payment lines, regeneration |
| `dataProviderTypes.ts` | Tipi condivisi: InvokeEdgeFunction, BaseProvider, LARGE_PAGE |
| `storageBucket.ts` | Upload attachments, logo config, file import fatture |
| `edgeFunctionError.ts` | Helper estrazione errore da Edge Function |

Ogni modulo feature esporta una factory `buildXxxProviderMethods(deps)` che
riceve le dipendenze condivise (baseDataProvider, invokeEdgeFunction, config
getters). L'orchestratore assembla tutto con object spread e il tipo
`CrmDataProvider` resta invariato per i consumer.

Semantica operativa attuale di `project_financials`:

- Single source: la view usa SEMPRE la tabella `payments` (status=ricevuto)
  come unica fonte per `total_paid`. Il vecchio dual-path
  (financial_foundation / legacy_payments) e' stato rimosso.
- `total_owed` = total_fees + total_expenses (quanto il cliente deve)
- `balance_due` = total_owed - total_paid (quanto resta da incassare)
- Rimborsi (`payment_type = 'rimborso'`) vengono sottratti dal total_paid
- Crediti ricevuti (`expense_type = 'credito_ricevuto'`) vengono sottratti
  dalle expenses
- Spese km usano `km_distance * km_rate` invece di `amount`

### Migrations

| Migration | Scopo |
|-----------|-------|
| `20260225180000_gestionale_schema.sql` | Schema iniziale (8 tabelle, RLS, views, dati iniziali) |
| `20260225230028_fase2_discount_tariffe.sql` | Colonna discount, tariffe aggiornate, views fix |
| `20260226120000_add_quotes_index.sql` | Colonna index su quotes per ordinamento Kanban |
| `20260226200000_client_tasks_notes_tags.sql` | Tabelle client_tasks, client_notes, colonna tags su clients |
| `20260227100000_import_diego_caltabiano.sql` | Import dati reali: 1 client + 9 projects + 64 services + 7 payments + 3 expenses |
| `20260227110000_import_diego_km_expenses.sql` | 40 spese spostamento_km (una per servizio con km > 0) |
| `20260227120000_import_diego_pending_payment.sql` | Pagamento pendente iniziale €7,152.10 |
| `20260227130000_import_diego_split_payments.sql` | Split pagamento pendente per progetto + assign project_id |
| `20260227140000_fix_project_financials_view.sql` | Fix prodotto cartesiano nella view (subquery pre-aggregation) |
| `20260227150000_assign_invoice_refs.sql` | Assegna invoice_ref (FPR) ai pagamenti ricevuti |
| `20260227160000_import_diego_nisseno.sql` | Import 4 puntate Nisseno + km expenses + pagamento |
| `20260227170000_fix_nisseno_payment_date.sql` | Fix data pagamento Nisseno (29/12/2025) |
| `20260227180000_fix_nisseno_fee_breakdown.sql` | Fix breakdown compensi Nisseno (shooting+editing separati) |
| `20260227190000_fix_missing_invoice_refs.sql` | Fix 2 pagamenti senza invoice_ref → FPR 6/25 |
| `20260227200000_complete_btf_cantina_tre_santi.sql` | Completa 2 servizi BTF non fatturati (vendemmia + puntata finale) |
| `20260227210000_fix_payment_types.sql` | Fix payment_type acconto → saldo per 2 pagamenti che completano fattura |
| `20260227220000_btf_extra_expenses_and_payment.sql` | Aggiunge 2 expense km + 1 payment in_attesa per BTF non fatturato |
| `20260227205707_reallocate_diego_payments.sql` | Riallocazione completa: DELETE 10 errati + CREATE 11 corretti per progetto |
| `20260227230000_add_expenses_to_project_financials.sql` | Aggiunge total_expenses dalla tabella expenses alla view project_financials |
| `20260228000000_audit_constraints.sql` | Audit sessione 14: UNIQUE, CHECK >= 0, tipi credito_ricevuto + rimborso, iPhone migrato |
| `20260227220805_payment_date_not_null.sql` | payment_date NOT NULL (safety fill + ALTER COLUMN) |
| `20260227223414_quote_rejection_reason_required.sql` | CHECK rejection_reason required when status=rifiutato |
| `20260227224137_date_range_checks.sql` | CHECK end_date >= start_date (projects), response_date >= sent_date (quotes) |
| `20260227224448_add_updated_at_columns.sql` | updated_at + trigger set_updated_at() su services, payments, expenses |
| `20260227224515_unique_project_client_name.sql` | UNIQUE (client_id, name) su projects |
| `20260227230519_add_quotes_service_type_check.sql` | CHECK su quotes.service_type (poi droppato) |
| `20260227231714_drop_service_type_checks.sql` | DROP CHECK su quotes + services service_type (tipi ora dinamici) |
| `20260228120000_datetime_range_support.sql` | DateTime Range Support: DATE→TIMESTAMPTZ, event_date→event_start/end, all_day su 4 tabelle |
| `20260228133000_historical_analytics_views.sql` | Prime viste aggregate per storico analytics |
| `20260228150000_normalize_monthly_revenue_net_basis.sql` | Allinea `monthly_revenue` alla base netta coerente con i modelli analytics |
| `20260228170000_add_quotes_project_link.sql` | Aggiunge il collegamento `quotes.project_id` |
| `20260228190000_add_quote_items_json.sql` | Aggiunge `quote_items` ai preventivi |
| `20260228193000_add_historical_cash_inflow_view.sql` | Vista dedicata agli incassi storici |
| `20260228220000_add_service_taxability_and_operational_semantics.sql` | Aggiunge `is_taxable` e basi semantiche operative |
| `20260301100000_views_security_invoker.sql` | Hardening sicurezza sulle views |
| `20260301110000_rls_initplan_optimization.sql` | Ottimizzazione RLS/initplan |
| `20260301120000_index_foreign_keys.sql` | Indici su foreign key principali |
| `20260301153000_add_client_billing_profile.sql` | Profilo fiscale clienti: billing_name, indirizzo fatturazione, SDI, PEC |
| `20260301183000_normalize_client_fiscal_fields.sql` | Bonifica campi fiscali cliente e normalizzazione `billing_name`/`tax_id` |
| `20260301193000_correct_diego_client_to_gustare_assoc.sql` | Correzione anagrafica fiscale Diego -> Associazione Culturale Gustare Sicilia |
| `20260301213000_reactivate_contacts_for_clients_projects.sql` | Riattiva `contacts` per i referenti e aggiunge `project_contacts` |
| `20260301234500_harden_contacts_roles_and_primary.sql` | Ruoli strutturati referenti + referente principale cliente + primario progetto deterministico |
| `20260302010500_financial_documents_foundation.sql` | Introduce `financial_documents`, `cash_movements`, allocazioni esplicite e il primo riallineamento di `project_financials` verso la nuova foundation |
| `20260302104422_services_optional_client_id.sql` | Aggiunge `client_id` opzionale a `services` (come `expenses`): servizi senza progetto possono essere legati direttamente al cliente |
| `20260302143000_add_historical_billing_rounding_credits.sql` | Inserisce crediti di arrotondamento storico su 3 progetti Gustare (€7,32 Gustare Sicilia, €0,10 Borghi Marinari, €2,00 Carratois) come `credito_ricevuto` in `expenses` |
| `20260302160000_add_iphone_credit_payment.sql` | Inserisce il pagamento `rimborso_spese` di €250 in attesa (iPhone: accordo iniziale €500, rivalutato a €250, Diego deve €250 a Rosario) collegato a Borghi Marinari |
| `20260302170000_domain_data_snapshot.sql` | **Snapshot pulita (solo settings).** TRUNCATE di tutte le tabelle operative + INSERT dei 6 record di configurazione. Svuotata il 2026-03-04 per debug dei flussi di calcolo. |
| `20260307200325_round_monetary_fields_in_project_financials.sql` | Aggiunge `ROUND(..., 2)` a tutti i campi monetari aggregati nella view `project_financials` (total_fees, total_km_cost, total_expenses, total_paid_legacy, balance_due) per eliminare decimali spurii da floating point |
| `20260401094930_single_source_financials.sql` | Riscrive `project_financials` (single source: sempre payments, no dual-path), aggiunge `client_id`/`total_owed`. Crea `client_commercial_position` view. Aggiunge indici performance su payments/expenses/services. |

## Moduli Frontend

### Moduli IMPLEMENTATI

| Modulo | Directory | Tipo | Stato |
|--------|-----------|------|-------|
| **Clienti** | `clients/` | CRUD + billing profile + tags/notes/tasks | Completo |
| **Referenti** | `contacts/` | CRUD + ruoli strutturati + relazioni cliente/progetto + primary flags | Completo |
| **Progetti** | `projects/` | CRUD + quick flows collegati | Completo |
| **Registro Lavori** | `services/` | CRUD (Table) | Completo |
| **Preventivi** | `quotes/` | Kanban desktop + mobile tabs/cards + dialog + PDF preview/download + mail cliente + quote→service + quick client + full-text search (description, notes) | Completo |
| **Pagamenti** | `payments/` | CRUD + handoff commerciali | Completo |
| **Spese** | `expenses/` | CRUD + km/travel flows | Completo |
| **Promemoria** | `tasks/` | Lista con filtri temporali | Completo |
| **Tags** | `tags/` | Gestione embedded + modali attiva su clienti/impostazioni; supporto dati referenti parziale | Completo |
| **Travel / KM** | `travel/` | Dialog cross-cutting per suggerimenti luogo e calcolo tratta | Completo |
| **Dashboard** | `dashboard/` | Recharts + KPI + alert + fiscale + storico | Completo |
| **AI unificata** | `ai/` | Launcher, snapshot read-only CRM, import, handoff, chat read-only | Completo |

### Snapshot AI unificata

La snapshot letta dal launcher AI non e' testo libero ricostruito al volo.

Espone in modo strutturato almeno:

- clienti recenti con profilo fiscale essenziale e recapiti di fatturazione
  principali gia presenti nel CRM
- referenti recenti con recapiti, ruolo strutturato, flag `principale cliente`
  e relazioni strutturate verso clienti e progetti
- progetti attivi con referenti associati, inclusa l'informazione
  `primario progetto`

Questa snapshot resta read-only e serve a far ragionare la chat AI interna del
prodotto sul modello corretto del dominio, senza inferire tutto dalle note.

### Import documenti AI

Il workspace dell'import documenti non usa piu solo `clients + projects`.

Per ridurre i falsi match persona -> cliente, il resolver runtime legge anche i
`contacts` e puo risalire dal referente noto al cliente fiscale collegato.

Il dominio referenti e' ora piu robusto anche a monte:

- ogni contact puo avere un `contact_role` strutturato
- ogni cliente puo avere un solo `is_primary_for_client = true`
- ogni progetto puo avere un solo `project_contacts.is_primary = true`

L'ordine corretto resta:

1. progetto/cliente gia selezionati
2. identificativi fiscali forti
3. denominazione fiscale
4. referente noto collegato a un cliente
5. nome libero della controparte solo come ultimo fallback

Edge Functions coinvolte:

- `invoice_import_extract` — estrazione AI da PDF/immagini, produce draft
- `invoice_import_confirm` — conferma draft e inserimento nel DB; la dedup
  servizi confronta `project_id + service_date + fee_shooting + fee_editing +
  fee_other + description` (la `description` e' necessaria per distinguere
  servizi diversi con stessa data e stessi importi)

Note tecniche:

- `services.km_distance` e' `numeric(10,2)` per supportare distanze decimali
  dal calcolatore tratte (es. 212.47 km)
- i campi numerici nell'editor draft usano `value ?? ""` (mai `?? 0`) per
  permettere la modifica manuale dei valori
- il geocoding e routing usano Google Maps APIs (Geocoding, Routes v2, Places
  Autocomplete) dal 2026-03-06, in sostituzione di OpenRouteService. Il modulo
  condiviso e' `supabase/functions/_shared/googleMapsService.ts`. Env var:
  `GOOGLE_MAPS_API_KEY` (locale in `supabase/functions/.env`, remoto come
  Supabase secret). Geocoding usa `components=country:IT` (filtro rigido) +
  `region=it` (bias); Places Autocomplete usa `includedRegionCodes: ["it"]`

### INP / Performance dei form input

- `SelectInput` (`src/components/admin/select-input.tsx`): NON usare key
  dinamica sul `<Select>` Radix — causa remount completo. Il bug
  radix-ui/primitives#3135 è gestito con una guardia nel `handleChange` che
  ignora `onValueChange("")` spurie.
- `AutocompleteInput` (`src/components/admin/autocomplete-input.tsx`):
  - Il `setFilters` alla chiusura del Popover è wrappato in `startTransition`
    per non bloccare la paint.
  - La selezione di un valore chiude il Popover prima (frame 1) e aggiorna il
    form state in un `setTimeout(0)` separato (frame 2). Questo evita che
    l'unmount del Command tree e la cascata `useWatch` finiscano nello stesso
    long task.
- Nelle cascate `useEffect` che chiamano `setValue` programmaticamente (es.
  auto-sync `client_id` da progetto, auto-calcolo importo), NON usare
  `shouldValidate: true` — la validazione al submit basta e risparmiare cicli
  di render.
- I sub-component dei form complessi (es. `QuoteItemsInputs`,
  `QuoteNotesInputs`, `QuoteStatusInputs`) sono wrappati in `React.memo` per
  evitare re-render a cascata dal parent che osserva campi diversi tramite
  `useWatch`.

### Struttura moduli CRUD

Pattern base valido per i moduli CRUD classici (`clients`, `contacts`,
`projects`, `services`, `payments`, `expenses`).

Eccezioni reali da ricordare:

- `quotes` usa una board/lista che ospita `create/show/edit` come dialog
  agganciati alle route, quindi non espone il classico export CRUD completo in
  `index.tsx`
- `tasks` usa una lista dedicata con dialog/sheet invece di un CRUD classico
- `travel` non e' una resource autonoma: e' un helper cross-cutting riusato da
  spese, servizi e quick flows progetto

```
src/components/atomic-crm/[modulo]/
├── index.tsx              # Export (list, show, edit, create, recordRepresentation)
├── [Modulo]List.tsx       # Lista con filtri, export CSV, sort
├── [Modulo]ListContent.tsx # Rendering tabella con Table component
├── [Modulo]ListFilter.tsx # Sidebar filtri con badge toggle
├── [Modulo]Create.tsx     # CreateBase + Form + Inputs + FormToolbar
├── [Modulo]Edit.tsx       # EditBase + Form + Inputs + FormToolbar
├── [Modulo]Show.tsx       # ShowBase + dettaglio record
├── [Modulo]Inputs.tsx     # Campi form condivisi Create/Edit
└── [modulo]Types.ts       # Choices e labels per select/badge
```

### Struttura Promemoria (Tasks)

```
src/components/atomic-crm/tasks/
├── TasksList.tsx          # Pagina lista desktop
├── MobileTasksList.tsx    # Pagina lista mobile
├── TasksListContent.tsx   # Composizione filtri temporali
├── Task.tsx               # Riga singola task con checkbox done
├── AddTask.tsx            # Dialog creazione (con selectClient opzionale)
├── TaskFormContent.tsx    # Form fields (testo, tipo, data, cliente)
├── TaskCreateSheet.tsx    # Sheet mobile creazione
├── TaskEdit.tsx           # Pagina edit
├── TaskEditSheet.tsx      # Sheet mobile edit
├── TasksIterator.tsx      # Lista task con ordinamento
└── taskFilters.ts         # Filtri: overdue, today, tomorrow, thisWeek, later
```

Risorsa: `client_tasks` (UUID PK, FK opzionale a clients)

### Struttura Note Clienti

Integrato nella scheda cliente (ClientShow):
- `clients/ClientNotesSection.tsx` — lista + inline create
- `clients/ClientNoteItem.tsx` — singola nota con edit/delete
- `clients/ClientTasksSection.tsx` — promemoria del cliente

Risorsa: `client_notes` (UUID PK, FK obbligatoria a clients)

### Struttura Tags

```
src/components/atomic-crm/tags/
├── ClientTagsList.tsx     # Display tags nel cliente
├── TagsListEdit.tsx       # Editor generico tags per risorse taggable
├── TagCreateModal.tsx     # Creazione tag
├── TagEditModal.tsx       # Modifica tag
├── TagDialog.tsx          # Dialog condiviso create/edit
├── TagChip.tsx            # Render badge/tag
├── RoundButton.tsx        # Selettore colore
└── colors.ts              # Palette colori
```

Non esiste una pagina dedicata `tags`: la gestione UI attiva avviene in scheda
cliente e in `Impostazioni`.

Il modello dati dei referenti conserva `tags`, ma la relativa UI non e' ancora
esposta come superficie operativa nei form/show dei `contacts`.

### Dashboard (Recharts + Fiscale)

```
src/components/atomic-crm/dashboard/
├── Dashboard.tsx                       # Desktop toggle Annuale / Storico
├── MobileDashboard.tsx                 # Mobile con Annuale compatta + accesso a Storico
├── useDashboardData.ts                 # useGetList multipli + expenses + fiscalConfig (year param)
├── useHistoricalDashboardData.ts       # Context builder per la vista Storico
├── dashboardModel.ts                   # Aggregazioni KPI/grafici/pipeline/alert + fiscal (year-aware)
├── dashboardModelTypes.ts              # Tipi dashboard estratti (DashboardModel, KPIs, drilldowns, alerts)
├── dashboardFormatters.ts              # Formatters (currency, date, category labels)
├── dashboardHistoryModel.ts            # Aggregazioni storiche e quality flags
├── fiscalModel.ts                      # Logica pura calcoli fiscali regime forfettario (principio di cassa)
├── fiscalModelTypes.ts                 # Tipi fiscali estratti (FiscalModel, FiscalKpis, deadlines, health)
├── fiscalRealityTypes.ts               # Tipi DB (FiscalDeclaration, FiscalObligation, F24) + read model (FiscalDeadlineView)
├── fiscalDeadlines.ts                  # buildDeadlines (F24/INPS high-priority + bolli/dichiarazione low-priority)
├── useGenerateFiscalTasks.ts           # Hook: genera client_tasks dai deadline fiscali calcolati
├── DashboardAnnual.tsx                 # Vista Annuale con guida lettura, AI card e simulazione fiscale
├── DashboardHistorical.tsx             # Vista Storico con AI card unificata, KPI Bambino, cash inflow
├── DashboardHistoricalAiCard.tsx       # AI unificata storico: Vista smart, scope storico/incassi, PDF, compact
├── DashboardAnnualAiSummaryCard.tsx    # AI guidata sul contesto annual_operations
├── DashboardHistoricalCashInflowCard.tsx # Incassi storici con layout Bambino (2 colonne + progress bars)
├── DashboardKpiCards.tsx               # 4 KPI cards fatturato/pagamenti
├── DashboardFiscalKpis.tsx             # 4 KPI cards fiscali (netto, tasse, accantonamento, tetto)
├── DashboardAtecoChart.tsx             # Bar chart orizzontale fatturato vs reddito per ATECO
├── DashboardDeadlinesCard.tsx          # Scadenze fiscali: high-priority prominenti, low-priority collassate, bottone genera promemoria
├── DashboardBusinessHealthCard.tsx     # Salute aziendale (conversione, DSO, concentrazione, margini)
├── DashboardRevenueTrendChart.tsx      # Line chart (12 mesi)
├── DashboardCategoryChart.tsx          # Bar chart per categoria
├── DashboardPipelineCard.tsx           # Pipeline preventivi
├── DashboardTopClientsCard.tsx         # Top 5 clienti
├── DashboardAlertsCard.tsx             # Alert urgenti
├── DashboardHistoricalKpis.tsx         # KPI storici multi-year
├── DashboardHistoricalRevenueChart.tsx # Trend storico ricavi di competenza
├── DashboardHistoricalCategoryMixChart.tsx # Mix categorie storico
├── DashboardHistoricalTopClientsCard.tsx # Top clienti storico lifetime
├── DashboardLoading.tsx                # Skeleton loading
├── TasksListFilter.tsx                 # Helper filtro task per dashboard
└── TasksListEmpty.tsx                  # Helper stato vuoto task
```

## Navigazione

```
Bacheca | Clienti | Progetti | Registro Lavori | Preventivi | Pagamenti | Spese | Promemoria
```

Menu utente (dropdown): Profilo | Impostazioni

Mobile: Inizio | Clienti | [+] | Promemoria | Altro

Nel menu `Altro` mobile (icone colorate come desktop Header, testo `text-lg`):

- Referenti (`text-cyan-500`)
- Progetti (`text-amber-500`)
- Registro Lavori (`text-indigo-500`)
- Preventivi (`text-violet-500`)
- Pagamenti (`text-green-500`)
- Spese (`text-orange-500`)
- Profilo (`text-muted-foreground`)
- Impostazioni (`text-muted-foreground`)
- toggle tema `sistema / chiaro / scuro`
- logout (`text-destructive`)

Automazioni: rimossa dal menu `Altro`, accessibile da Impostazioni.

## Risorse registrate in CRM.tsx

```
clients, contacts, projects, services, quotes, payments, expenses, suppliers
  ← CRUD/Kanban con pagine
client_tasks
  ← lista con pagina desktop + mobile
client_notes, project_contacts
  ← risorse headless consumate da sezioni embed
sales
  ← risorsa infrastrutturale consumata da auth e `/profile`
tags
  ← risorsa headless consumata da clienti, referenti e `Impostazioni`
```

### Utility condivise (misc/)

| File | Scopo |
|------|-------|
| `misc/formatDateRange.ts` | `formatDateRange(start, end, allDay)` e `formatDateLong(start, end, allDay)` — formattazione date coerente con supporto range e all_day |
| `misc/ErrorMessage.tsx` | Componente errore riutilizzabile con AlertCircle |
| `misc/CreateSheet.tsx` | Sheet mobile per creazione record |
| `misc/FormToolbar.tsx` | Toolbar form con Save/Delete |

### Utility data/timezone (lib/)

| File | Scopo |
|------|-------|
| `lib/dateTimezone.ts` | `BUSINESS_TIMEZONE` (`Europe/Rome`), `toISODate(date)`, `todayISODate()`, `toBusinessISODate(value)`, `startOfBusinessDayISOString(value)`, `endOfBusinessDayISOString(value)`, `diffBusinessDays(from,to)`, `formatBusinessDate(value)` — layer unico per business-date e day-boundary italiane. Sostituisce i pattern `toISOString().slice(0,10)`, `new Date("YYYY-MM-DD")` e i delta giorni basati sul fuso del browser. |
| `supabase/functions/_shared/dateTimezone.ts` | Parity quasi completa col modulo client: `BUSINESS_TIMEZONE`, `toISODate`, `todayISODate`, `toBusinessISODate`, `getBusinessYear`, `startOfBusinessDayISOString`, `diffBusinessDays`, `formatBusinessDate` + `formatDateInTimezone(date, tz)` per timezone configurabili. Duplicazione intenzionale: runtime diversi (Vite vs Deno). |
| `supabase/functions/_shared/parseAiVisualBlocks.ts` | Helper condiviso per il parsing JSON del visual mode AI. Esporta `parseAiVisualBlocks(outputText)` (wrappa `JSON.parse`) e `InvalidAiOutputError` (distinguibile da errori API generici). Le Edge Function con visual mode devono usare questo helper al posto di `JSON.parse` diretto, cosi' i catch block possono rispondere 502 vs 500 in modo semanticamente corretto. |

## Tipi TypeScript (types.ts)

```
Client, Contact, Project, Service, Payment, ← CRUD
Expense, Quote, ProjectContact              ← CRUD/Kanban/relazioni
ClientTask, ClientNote                     ← Tasks/Notes adattati
Tag, Sale, SalesFormData, SignUpData        ← Infrastruttura
RAFile, AttachmentNote                     ← File/allegati
LabeledValue, NoteStatus                  ← Config
FiscalConfig, FiscalTaxProfile             ← Fiscale
```

## Authentication

- Method: Supabase Auth
- Access paths attivi:
  - email/password
  - Google Workplace SSO se `googleWorkplaceDomain` e' configurato
- User: rosariodavide.furnari@gmail.com (unico)
- Signup pubblico libero: non supportato
- Bootstrap primo utente:
  - resta come superficie tecnica nel router
  - nel runtime Supabase single-user corrente non e' il percorso normale, perche'
    `getIsInitialized()` e' forzato a `true`
  - se la route viene aperta mentre l'app risulta gia inizializzata, reindirizza
    al login normale
- API Keys: VITE_SB_PUBLISHABLE_KEY (formato sb_publishable_...)

## Supabase Config

- Progetto remoto: `qvdmzhyzpyaveniirsmo.supabase.co`
- Keep-alive: GitHub Actions, lunedì e giovedì 08:00 UTC
- Edge Function secrets: SB_SECRET_KEY configurato su remoto

## Deployment

- **Hosting**: Vercel (gestionale-rosario.vercel.app)
- **Auto-deploy**: Vercel collegato al repo GitHub, deploya su ogni push a main

## Pages Map

```
/login               → Entry auth principale; nel runtime Supabase corrente resta il percorso normale di accesso
/sign-up             → Superficie tecnica di bootstrap primo utente; nel runtime corrente rimbalza sul login se l'app risulta gia inizializzata
/sign-up/confirm     → Schermata tecnica di conferma bootstrap iniziale
/forgot-password     → Recupero password
/set-password        → Impostazione/reset password
/oauth/consent       → Consenso OAuth
/                    → Dashboard finanziaria (Recharts: KPI, grafici, pipeline, alert, navigazione anno)
/clients             → Lista clienti
/clients/create      → Crea cliente
/clients/:id         → Modifica cliente
/clients/:id/show    → Scheda cliente (dettagli, fatturazione, tags, riepilogo finanziario, referenti, note, promemoria)
/contacts            → Lista referenti
/contacts/create     → Crea referente
/contacts/:id        → Modifica referente
/contacts/:id/show   → Scheda referente
/projects            → Lista progetti
/projects/create     → Crea progetto
/projects/:id        → Modifica progetto
/projects/:id/show   → Dettaglio progetto (dati base, referenti, quick flows, riepilogo finanziario)
/services            → Registro lavori
/services/create     → Crea lavoro
/services/:id        → Modifica lavoro
/services/:id/show   → Dettaglio servizio
/quotes              → Pipeline preventivi (Kanban 10 stati desktop, tabs + cards mobile)
/quotes/create       → Crea preventivo in dialog
/quotes/:id          → Modifica preventivo in dialog
/quotes/:id/show     → Dettaglio preventivo in dialog
/payments            → Lista pagamenti
/payments/create     → Crea pagamento
/payments/:id        → Modifica pagamento
/payments/:id/show   → Dettaglio pagamento
/expenses            → Spese e km
/expenses/create     → Crea spesa
/expenses/:id        → Modifica spesa
/expenses/:id/show   → Dettaglio spesa
/suppliers           → Lista fornitori
/suppliers/create    → Crea fornitore
/suppliers/:id       → Modifica fornitore
/suppliers/:id/show  → Dettaglio fornitore
/client_tasks        → Lista promemoria (filtri: scaduti, oggi, domani, settimana, più avanti)
/settings            → Impostazioni (Marchio, Etichette, Tipi preventivo, Tipi servizio, Operatività, Note, Attività, AI, Fiscale)
/profile             → Profilo utente
```

- unified_crm_answer: reasoning re-enabled with effort 'low' (medium caused empty outputs due to large CRM context)

- QuotePDFPreview: mobile overlay now uses BlobProvider + native iframe instead of PDFViewer canvas (enables pinch-to-zoom)

- SettingsPage: mobile sticky category tab bar (Azienda/Catalogo/Operativo/Avanzate) for quick navigation, reuses existing IntersectionObserver

- SettingsPage: all 11 sections now collapsible (closed by default), sidebar/tab navigation auto-opens target section

- SettingsPage: compact collapsible headers (text-sm, py-2.5, h-4 icons)

- SettingsPage: Card py-0 gap-0 override for compact collapsible sections

- SettingsPage: mobile save bar compact (abbreviated labels, size sm, no overflow)

<!-- Settings: save bar auto-hides on scroll down, shows on scroll up (sticky + scroll listener) -->
<!-- Settings save bar: sticky on mobile (overflow container), fixed on desktop -->
<!-- Settings save bar: always visible on desktop, auto-hide on mobile -->
<!-- Settings: removed Authentication/SSO section (single-user, not needed) -->
