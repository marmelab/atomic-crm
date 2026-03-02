# Historical Analytics Handoff

**Stato del documento:** `working`
**Scopo:** handoff operativo e memoria di implementazione per riprendere il
lavoro senza riaprire decisioni gia prese.
**Quando NON usarlo da solo:** per dedurre architettura canonica o stato
prodotto senza incrociarlo con `docs/README.md` e i documenti `canonical`.

Last updated: 2026-03-02

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
requires explicit confirmation before creating `payments` or `expenses`.

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

- FakeRest/demo historical resources remain unimplemented, but this is now
  explicitly de-prioritized for the current product scope.
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
