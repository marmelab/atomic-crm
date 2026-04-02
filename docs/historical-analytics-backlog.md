# Historical Analytics Backlog

**Stato del documento:** `working`
**Scopo:** backlog e log evolutivo delle slice analytics/AI/commerciali.
**Quando NON usarlo da solo:** per dedurre lo stato canonico del prodotto senza
incrociarlo con `docs/README.md`, `docs/architecture.md` e i documenti
`canonical`.

Last updated: 2026-04-02 (fiscal truth / Gestione Separata parity)

## Update 2026-04-02 — Fiscal truth / Gestione Separata

Slice completata: `dashboard + Edge Function fiscal truth parity`.

Deliverable chiusi:

- `fiscalConfig.defaultTaxProfileAtecoCode` aggiunto e reso editabile da
  Settings con fallback stabile (`731102` / `73.11.02`)
- fiscal model split in due corsie:
  - stima anno fiscale selezionato
  - calendario pagamenti anno `Y` costruito da `Y-1` e `Y-2`
- `unmappedCashRevenue` + warning `UNMAPPED_TAX_PROFILE` introdotti con parita'
  client/server
- `DashboardNetAvailabilityCard` resa prudenziale:
  niente sottrazione del "gia' pagato" locale dal reserve math canonico
- tracking locale fiscale confinato alla UX scadenze con chiave stabile
  `buildFiscalDeadlineKey()`
- `useGenerateFiscalTasks` allineato a identita' strutturale
  (`component + competenceYear + date`)
- Edge Function `fiscal_deadline_check` riallineata alla stessa matematica e
  agli stessi warning del client
- parita' coperta da test sintetici dedicati:
  `fiscalParity.test.ts` + `_shared/fiscalDeadlineCalculation.test.ts`

Residuo immediato:

- eseguire sweep completo `make test`, `make typecheck`, `make lint`
- deployare la Edge Function remota `fiscal_deadline_check`
- chiudere verifica manuale su dashboard annuale/mobile con warning
  `UNMAPPED_TAX_PROFILE` visibile e calendario pagamento coerente

## Update 2026-04-01 — unified_crm_answer prompt copy hardening

Slice completata: `plain-language translation of internal financial flags`.

Deliverable chiusi:

- prompt `unified_crm_answer` aggiornato per vietare nomi di campi raw nel
  markdown utente
- traduzione obbligatoria dei booleani/flag tecnici in frasi naturali
- guardrail ristretto al lessico: nessun cambio intenzionale di struttura
  globale o verbosita' della risposta
- caso esplicito coperto nel prompt:
  `hasUninvoicedServices = si` -> `ci sono ancora servizi non fatturati`

Motivazione:

- dopo il refactor single-source financials l'AI usava correttamente la
  snapshot, ma in alcuni casi faceva trapelare il nome del flag di sistema
  invece di parlare in italiano umano. Il problema era di wording nel prompt,
  non di dati o aggregazioni.

## Update 2026-04-01 — AI snapshot expense detail follow-up

Slice completata: `unifiedCrmReadContext expense detail parity`.

Deliverable chiusi:

- `snapshot.activeProjects[]` include ora anche `expenses[]`
- `recentExpenses.amount` usa l'importo operativo reale, non il raw DB
- `snapshot.totals.expensesAmount` allineato alla stessa formula operativa
- test di regressione aggiunti per `spostamento_km` e dettaglio spese progetto

Motivazione:

- dopo il refactor single-source financials i saldi erano corretti, ma l'AI
  poteva ancora spiegare male i progetti con spese km perche' vedeva
  `recentExpenses.amount = 0` sui record `spostamento_km` e non aveva un
  dettaglio spese annidato nel progetto.

## Update 2026-03-31 — Timezone bonifica backlog after phase 4

Slice completata: `dashboard annual wrappers + fiscal deadline consumers + EF parity`.

Deliverable chiusi:

- `dashboardModel.ts` / `fiscalModel.ts` gia' bonificati e validati
- `DashboardAnnual`, `MobileDashboard`, `DashboardAnnualAiSummaryCard` allineati
  al current year `Europe/Rome`
- `DashboardDeadlinesCard` e `useGenerateFiscalTasks` non convertono piu'
  `FiscalDeadline.date` con `Date` locale
- shared Edge Function fiscale allineata al contratto business-date
  (`dateTimezone` Deno esteso + `fiscal_deadline_check` year derivato da
  `todayISODate()`)
- validazione forte chiusa:
  - `typecheck` / `lint` / `build`
  - unit mirati verdi
  - stessa suite verde con `TZ=America/New_York`
  - `dashboard-annual.smoke.spec.ts` verde

Residuo immediato:

- nessun hotspot business-critical noto ancora aperto nel piano timezone
- match grep rimasti sono intenzionalmente fuori scope:
  - `google_calendar_sync` (timezone esplicita del provider)
  - esempio JSDoc in `date-input`
  - parser display in `CreateServiceFromQuoteDialog`

Nota operativa:

- il prossimo passo non e' altro refactor timezone generico;
  e' deployare la Edge Function remota `fiscal_deadline_check` quando si decide
  di spedire questa slice.

## Update 2026-03-31 — Timezone bonifica backlog after phase 2

Slice completata: `tasks all-day + task filters + unifiedCrmReadContext business-date alignment`.

Deliverable chiusi:

- helper `dateTimezone` estesi con start/end of business day, delta giorni e
  formatting business-date
- `client_tasks` create/edit/postpone/list allineati a `Europe/Rome`
- `formatDateRange` / `formatDateLong` stabili per superfici all-day
- `unifiedCrmReadContext` allineato al contratto business-date della dashboard
- validazione: unit verdi + `tasks.complete.spec.ts` verde + smoke
  cross-timezone dashboard verde

Backlog immediato residuo:

- chiuso poi nella phase 3/4 dello stesso giorno

Nota operativa:

- la regola verificata resta la stessa:
  business-date = helper condivisi + smoke cross-timezone su una superficie reale

## Update 2026-03-08 (d) — unified_crm_answer robustness + suggestion scoping

- `unified_crm_answer`: removed `reasoning.effort` (caused empty outputs), compact JSON context, `max_output_tokens` 1500→2000, better error logging.
- `unifiedCrmAnswerSuggestions.ts`: payment-related keywords added to `focusPayments` patterns; quote suggestions in `genericSummary` path now gated behind `focusQuotes`.

## Update 2026-03-08 (c) — Historical dashboard Bambino redesign

Slice completata: `Historical dashboard "Approccio Bambino" — unified AI card, Vista smart, KPI redesign, CashInflow redesign`.

Deliverable chiusi:

- Unified `DashboardHistoricalAiCard` con scope selector (storico/incassi), Vista smart, suggested questions colorate, PDF export, compact mobile
- KPI cards Bambino con icon badge colorate e numeri grandi
- Cash Inflow Card Bambino con 2 colonne + progress bars
- Provider: 4 metodi storici con `{ visualMode }` option
- 4 Edge Functions aggiornate con visualMode support
- Tipi: `HistoricalVisualSummary`, `HistoricalVisualAnswer`, `HistoricalSuggestedQuestion`
- Eliminati 4 file obsoleti (2 componenti + 2 test)
- Layout storico semplificato, inline subtitle, AI card in cima

Test: 58 file pass, typecheck clean.

Backlog immediato residuo:

- deploy Edge Functions `historical_analytics_summary`, `historical_analytics_answer`, `historical_cash_inflow_summary`, `historical_cash_inflow_answer`
- validazione visuale su stack locale

## Update 2026-03-08 (b)

Slice completata: `Dashboard Pareto features — net availability, tax tracking, cash flow, YoY`.

Deliverable chiusi:

- KPI "Disponibilità netta stimata" (cassa − spese − tasse residue)
- Tracking pagamenti fiscali con persistenza localStorage (useStore)
- Previsione cash flow 30 giorni (entrate pagamenti + uscite scadenze fiscali)
- Confronto YoY stesso periodo su revenue, cassa, spese con badge delta
- AI context esteso con `cash_received_net` metric e sezione `yearOverYear`
- Edge Functions aggiornate con istruzioni AI per nuovi dati

Nuovi file: `DashboardNetAvailabilityCard`, `DashboardCashFlowCard`,
`DashboardYoyBadge`, `useFiscalPaymentTracking`.

Test: 5 unit test + 3 E2E smoke test.

Backlog immediato residuo:

- deploy Edge Functions `annual_operations_summary`, `annual_operations_answer`
- validazione E2E smoke su stack locale

## Update 2026-03-08

Slice completata: `AI annual expense context + dashboard UX + E2E validation`.

Deliverable chiusi:

- AI "spiegami l'anno" ora include spese operative: totale, breakdown per tipo,
  metrica `annual_expenses_total`, margine lordo operativo (lavoro - spese)
- Guardrail AI: zero-spese non è problema automatico, anno corrente = provvisorio,
  reddito fiscale esplicitamente fuori scope, stem matching per domande su
  spese/margini, reframe domande spese con qualificatore temporale
- Dashboard alert: icona link discreta per navigare al dettaglio servizio/pagamento
- Icone servizio dedicate: `riprese_montaggio` (Clapperboard), `sviluppo_web` (Code)
- Persistenza scelta lista/kanban su progetti (localStorage)
- Edge Functions deployate: `annual_operations_summary`, `annual_operations_answer`

E2E test aggiunti (6 nuovi):

- `dashboard-annual.smoke.spec.ts` (4 test mock): KPI, alert links, card AI, payload
- `ai-annual-real.spec.ts` (2 test reali): verifica calcolo margine e prudenza AI
- Fix bug pre-esistente `calculations.smoke`: spese 644→653,50€ (mancava km S2)
- Seed arricchito con `abbonamento_software` + `credito_ricevuto` per validazione

Backlog immediato residuo:

- nessun blocco critico; la AI annuale è ora testata end-to-end con dati reali

## Update 2026-03-04

Slice completata: `module-registry + taxability + deadlines + invoice-draft`.

Deliverable chiusi:

- registry moduli unificato con nav desktop/mobile e risorse AI derivate
- contatti visibili in nav desktop e menu mobile "Altro"
- scadenzario operativo annuale con azioni rapide
- capability AI aggiuntive: `task_create`, `generate_invoice_draft`
- bozza fattura interna multi-entry point (service/project/client/quote)
- tassabilita' coerente:
  - `quotes.is_taxable`
  - default config-driven su servizi/preventivi
  - tassabilita' pagamento derivata
  - flat services inclusi nel modello fiscale
- fix semantica pagamenti nei builder invoice draft:
  - deduzione solo pagamenti `status === "ricevuto"`
  - inversione segno rimborsi
  - exclusione servizi gia' fatturati (`invoice_ref`)
  - return `lineItems: []` se totale esigibile <= 0
  - `hasInvoiceDraftCollectableAmount()` come check unificato
  - Show page caricate con `useGetList<Payment>` per dati reali
  - 9 test unitari aggiunti (3 per quote, 3 per project, 3 per client)

Backlog immediato residuo:

- chat AI: rispondere a "quanto mi deve X?" usando i builder o un read-context
  esteso con importi esigibili per cliente/progetto
- aggiungere smoke E2E dedicati per:
  - navigazione module-registry desktop/mobile
  - scadenzario dashboard
  - invoice draft end-to-end sui 4 entry point
- deploy remoto Edge Function `unified_crm_answer` dopo merge/push del ramo

Archivio storico opzionale, da leggere solo se serve piu' contesto:

- `progress.md`
- `learnings.md`

## Historical Naming Note

Some older closed slices below still quote runtime observations collected
before the fiscal/customer correction introduced by
`20260301193000_correct_diego_client_to_gustare_assoc.sql`.

When those historical notes mention `Diego Caltabiano` as the client label,
read them as pre-correction evidence only.

The current canonical interpretation is:

- `ASSOCIAZIONE CULTURALE GUSTARE SICILIA` = fiscal client
- `Diego Caltabiano` = linked operational contact

## Current State

The codebase now contains:

- the historical analytics spec,
- aggregate view definitions,
- dashboard `Annuale | Storico` shells,
- a history model with semantic rules,
- and an AI-ready analytics context builder.

Remote verification on the linked Supabase project is now done at the resource
layer:

- the new `analytics_*` views are present and populated on
  `qvdmzhyzpyaveniirsmo`,
- the observed remote rows match the approved semantic rules,
- the apparent "empty" result with the publishable/anon key was traced to RLS
  on security-invoker views, not to missing data.

The implementation is now functionally closed for v1:

- remote data/runtime verified,
- authenticated browser path verified for the historical dashboard and guided AI
  summary,
- baseline UI tests added for the historical widgets,
- visible dashboard copy translated into plain Italian for non-expert users,
- the AI summary card has basic readability polish applied,
- and the historical AI surface now supports both guided summary and a
  single-turn free question constrained to historical data and already verified
  by authenticated remote smoke and real browser click-test.
- the commercial backbone slice `Quote -> Project -> Payment` is now
  browser-validated too,
- the simple `client -> payment` path now has a direct UI entry point too,
- the quote-driven quick-payment path is now browser-validated too, including
  the case with no linked project,
- the `quote_items` foundation is now implemented inside `quotes` without
  introducing a separate CRUD module,
- quote show now also exposes a first non-invasive visibility layer for linked
  payments,
- that quote-side payment visibility layer is now browser-validated too on the
  real authenticated quote show path,
- itemized quotes now auto-derive `amount` from line items, keep the classic
  quote path backward-compatible, and are browser-validated on real create/show
  flows,
- `annual_operations` now exposes a first AI-safe drill-down for
  `pagamenti da ricevere` and `preventivi aperti`,
- the Annuale AI answer path is now remotely validated on a real question about
  payments/open quotes using that richer drill-down,
- the `Annuale` AI card is now browser-validated on the real authenticated
  UI path also on the specific payment/open-quote question set,
- and a first historical `incassi` semantic resource now exists too:
  - `analytics_yearly_cash_inflow`
  - `buildHistoricalCashInflowContext()`
  - `dataProvider.getHistoricalCashInflowContext()`
  - with authenticated remote verification already closed,
- and that same `incassi` layer now has a first separate end-user AI consumer:
  - `DashboardHistoricalCashInflowAiCard`
  - `historical_cash_inflow_summary`
  - `historical_cash_inflow_answer`
  - browser-validated on the real authenticated UI path,
- and that same `incassi` layer now also has a first separate non-AI surface:
  - `DashboardHistoricalCashInflowCard`
  - test-validated on the real `Storico` render path.
- and a first operational semantic backbone now exists too:
  - `crmSemanticRegistry`
  - `operationalConfig.defaultKmRate`
  - `services.is_taxable`
  - shared km/service formulas reused by UI, fiscal model, and future AI
    consumers.
- and a first product-capability / communication foundation now exists too:
  - `crmCapabilityRegistry`
  - `quoteStatusEmailTemplates`
  - `quoteStatusEmailContext`
  - `dataProvider.getQuoteStatusEmailContext()`
  - `dataProvider.sendQuoteStatusEmail()`
  - `quote_status_email_send`
  - `SendQuoteStatusEmailDialog`
  - manual Gmail SMTP send path from quote show
  - `CallMeBot` declared as the planned internal high-priority notification
    channel

The next work is now future expansion on top of a stable shipped core, not a
missing foundation piece.

Cross-surface note:

- `Storico` is AI-enabled end-to-end.
- `Annuale` now has a first AI-enabled flow too, but only on the dedicated
  `annual_operations` context.
- `Annuale` is still **not** AI-enabled as a whole page: alert snapshot and
  fiscal simulation remain deliberately outside that context.
- a parallel non-AI track has now started too:
  - commercial backbone hardening for `Quote -> Project -> Payment`
  - because global AI on weak cross-module links would stay fragile

Strategic product note:

- the long-term goal is **not** to keep shipping isolated AI widgets in many
  pages,
- but to unify the useful AI capabilities into one clearer AI experience
  without losing what already works.
- the current page-level AI cards should therefore be treated as transitional,
  not as the final UX architecture.
- the approved execution path is now explicit too:
  - first a general `read-only` CRM chat
  - only later assisted writes with explicit confirmation
  - no free autonomous CRM writes

Current override for the next phase:

- the old closed AI/commercial milestones below remain useful as archive
- they are not the current execution priority anymore
- the current priority is system recovery on real data:
  - rebuild local business truth from `Fatture/`
  - enrich with `Fatture/contabilità interna - diego caltabiano/`
  - then fix system semantics
  - then realign UI/AI/import/analytics
  - only after that, update or expand E2E/smoke

## First Open Priority

The current first open priority now supersedes the old slice-by-slice launcher
expansion story below.

Current first open priority:

- `financial semantic separation`

Why:

- the local runtime now rebuilds from the real source-of-truth files
- this exposes the real system weakness more clearly:
  - document vs due/open state
  - due/open state vs actual cash movement
  - partial/project allocations vs fiscal totals
- without that separation, analytics, AI and future suppliers would keep
  resting on ambiguous financial meaning

Tasks (completed 2026-03-02):

- [x] preserve the rebuilt local truth dataset as the validation baseline
- [x] keep the new foundation tables populated from that rebuild:
  - `financial_documents`
  - `cash_movements`
  - explicit allocation tables
- [x] preserve the fiscal XML breakdowns in the foundation:
  - `xml_document_code`
  - `taxable_amount`
  - `tax_amount`
  - `stamp_amount`
- [x] keep `project_financials` on the new priority order:
  - use foundation cash when the project is covered and settled
  - use `financial_documents` as the semantic base when the project is covered
    but still unpaid
  - fall back to legacy `payments` only for uncovered projects
- [x] portal cash movements for ALL invoices (not just Diego/Gustare):
  - gap-based: fills only the delta between CSV-settled and total
  - audit script: `scripts/audit-aruba-reconciliation.mjs`
  - 29/29 settlement status match, 15/15 tests pass

Open (next arc):

- map where `payments` and `expenses` still overload document, open state and
  cash movement semantics
- migrate UI, AI, import and analytics progressively to the clearer model
- when the dataset is stable, convert the rebuild script into a one-shot
  migration (pre-backup) and retire `scripts/bootstrap-local-truth.mjs` +
  `scripts/local-truth-data.mjs` as runtime dependencies

Acceptance (met):

- the rebuilt local dataset stays replayable from real files
- the rebuilt local dataset also repopulates the financial foundation tables
- the system can distinguish:
  - existing fiscal document
  - residual open amount/state
  - actual cash movement
- keep the product semantic authority internal:
  - `payments.status` remains the operational truth for incasso state
  - `payment_type` remains part of the same truth
- the next open work can then focus on suppliers and richer analytics without
  carrying forward semantic ambiguity

Archive note:

- the long closed milestone chain that follows remains useful historical
  evidence
- it should not be read as the current priority queue

The manual quote-status email step is now closed.
It is also runtime-verified on the linked remote project:

- `SMTP_*` secrets set on `qvdmzhyzpyaveniirsmo`
- `quote_status_email_send` deployed remotely
- authenticated invoke returned `accepted` with SMTP response `250 2.0.0 OK`
- smoke user and smoke quote/client cleaned after verification

The floating launcher step is now closed too:

- one unified AI launcher now exists as a small whole-site floating button
- it opens the same shell everywhere from shared layout
- it does not add a new AI page in the main navigation
- it is now declared in the capability registry as the unified AI entry point

The separate settings step is now closed too:

- `Impostazioni -> AI` now exposes a dedicated invoice-extraction model field
- default:
  - `gemini-2.5-pro`
- old persisted configs now keep the new nested AI default safely

The invoice vertical-slice step is now closed too:

- the unified launcher now supports mixed invoice ingestion with
  `@google/genai`
- upload accepts:
  - `PDF` digitali
  - scansioni/foto con layout variabili
- the assistant now returns one structured proposal editable directly in the
  same chat shell before saving
- explicit confirmation now writes only into existing CRM resources:
  - `payments`
  - `expenses`
- provider entry points now exist for:
  - workspace read
  - temp file upload
  - draft extraction
  - confirmed write
- runtime verification is now closed too on `qvdmzhyzpyaveniirsmo`:
  - `GEMINI_API_KEY` aligned
  - `invoice_import_extract` deployed
  - authenticated smoke with `customer.pdf` + `supplier.png` returned one
    `payments` draft and one `expenses` draft
  - the corrected proposal was then written into remote `payments` /
    `expenses`
  - smoke data cleaned after verification

The read-context step is now closed too:

- one stable provider entry point now exists:
  - `getUnifiedCrmReadContext()`
- the launcher now renders a read-only CRM snapshot in the same shell
- the snapshot reuses semantic + capability registries instead of rebuilding
  meanings inside the component
- the snapshot now covers:
  - `clients`
  - `contacts`
  - `project_contacts`
  - `quotes`
  - `projects`
  - `payments`
  - `expenses`
- the snapshot now exposes structured relations instead of leaving them in
  notes:
  - client -> referenti
  - client -> progetti attivi
  - referente -> progetti
  - progetto -> referenti
- this was intentionally **not** a new `Settings` feature:
  - the change is structural/read-only, not a user-configurable rule
  - continuity therefore had to be updated in docs rather than by adding a new
    toggle in `Impostazioni`
- no new AI page or page-level AI widget was added to deliver this step

The general CRM answer step is now closed too:

- the unified launcher now supports the first read-only AI answer flow on top
  of the shared CRM-wide snapshot
- the flow uses:
  - the same launcher shell
  - the same snapshot the user sees
  - the existing text-model setting already used by Storico/Annuale
- no new AI page or page-level AI widget was added
- runtime verification is now closed too on `qvdmzhyzpyaveniirsmo`:
  - `unified_crm_answer` deployed
  - authenticated smoke question returned HTTP `200`
  - answer markdown came back grounded on the real snapshot and repeated the
    read-only/write-confirmation boundary
  - smoke user cleaned after verification

The guided route-handoff step is now closed too:

- unified launcher answers now include structured `suggestedActions`
- the handoff targets stay on existing approved CRM surfaces:
  - record show routes
  - resource list routes
  - dashboard
- routes are built deterministically from the shared snapshot + hash route
  prefix, not generated free-form by the model
- runtime verification is now closed too on `qvdmzhyzpyaveniirsmo`:
  - `unified_crm_answer` redeployed
  - authenticated smoke question `Chi mi deve ancora pagare?` returned HTTP
    `200`
  - response included one grounded answer plus handoff actions for:
    - `payments show`
    - `payments list`
    - `clients show`
  - smoke user cleaned after verification

The first action-oriented commercial handoff step is now closed too:

- unified launcher answers now include both generic route handoff and approved
  commercial handoff
- the approved commercial targets currently include:
  - `quote_create_payment`
  - `client_create_payment`
  - `project_quick_payment`
- `suggestedActions` remain deterministic:
  - routes and query params come from the shared snapshot
  - the model does not invent commercial URLs
- runtime verification is now closed too on `qvdmzhyzpyaveniirsmo`:
  - `unified_crm_answer` redeployed
  - authenticated smoke question `Chi mi deve ancora pagare?` returned HTTP
    `200`
  - response included one grounded answer plus handoff actions for:
    - `payments show`
    - `quote_create_payment`
    - `project_quick_payment`
  - smoke user cleaned after verification

The next open priority is:

- make the handoff more guided on top of approved commercial surfaces, still
  inside the same floating shell
- improve intent/context mapping so the launcher picks the most coherent
  approved entry point before any future write-execution discussion
- keep the general CRM chat without direct write execution

That guided commercial handoff step is now closed too:

- `suggestedActions` can now carry one explicit primary recommendation
- payment-oriented questions that already ask to register/add a payment now
  prioritize the approved action handoff instead of a generic show route
- the recommendation metadata stays deterministic:
  - `recommended`
  - `recommendationReason`
- runtime verification is now closed too on `qvdmzhyzpyaveniirsmo`:
  - `unified_crm_answer` redeployed
  - authenticated smoke question
    `Da dove posso registrare un pagamento sul preventivo aperto?` returned
    HTTP `200`
  - response included:
    - first action `quote_create_payment`
    - `recommended = true`
    - deterministic reason text
  - smoke user cleaned after verification

The next open priority is:

- keep the general launcher inside approved commercial surfaces, but deepen the
  landing quality on those surfaces
- hand off the user to the destination that already exists with the strongest
  usable prefill/context, before any future chat-side write draft
- still do not give the general CRM chat direct write execution

That richer landing step is now closed too:

- approved handoffs now carry deterministic launcher context into existing CRM
  surfaces
- `payments/create` handoffs can now transport:
  - `quote_id`
  - `client_id`
  - `project_id`
  - explicit `payment_type` when inferable from the question
  - launcher metadata for UI copy
- `project_quick_payment` handoffs now land on project show with:
  - `open_dialog=quick_payment`
  - optional `payment_type`
  - launcher metadata for banner/copy
- the landing surfaces stay inside already approved UI:
  - `PaymentCreate` banner + supported prefills
  - `ProjectShow` banner
  - `QuickPaymentDialog` auto-open with supported defaults only
- runtime verification is now closed too on `qvdmzhyzpyaveniirsmo`:
  - `unified_crm_answer` redeployed
  - authenticated smoke question
    `Come posso registrare il saldo del progetto attivo?` returned HTTP `200`
  - response included first action `project_quick_payment` with:
    - `recommended = true`
    - launcher search params
    - `payment_type=saldo`
  - smoke user cleaned after verification

The next open priority is:

- keep the launcher on approved commercial surfaces, but close the last manual
  gaps that still appear after landing
- prioritize missing prefills or missing approved destination variants before
  any future general write-draft discussion
- still do not give the general CRM chat direct write execution

That landing-gap step is now closed too for the quote-driven payment path:

- `payments/create` now reads the linked quote context more deeply on the
  destination surface
- the form now surfaces:
  - quote amount
  - already linked total
  - remaining still-unlinked amount
- for standard payment types, the form can suggest a deterministic amount equal
  to the residual not yet linked to payments
- the suggestion remains local to the destination surface:
  - not model-generated
  - not auto-confirmed
  - always editable by the user
- `rimborso` / `rimborso_spese` do not receive the same automatic amount
  suggestion here
- this slice did not require a function redeploy:
  - local validation closed with `npm run typecheck`
  - targeted Vitest passed on payment linking + registries

The next open priority is now closed too:

- the launcher can now prepare a first narrow `payment` write-draft on top of
  the quote-driven commercial path
- the draft is deliberately constrained:
  - it only appears when the question clearly asks to prepare/register/create a
    payment
  - it only targets open quotes with eligible status and positive residual
  - it only proposes `acconto` / `saldo` / `parziale`
- the response contract now includes a structured `paymentDraft` payload that:
  - stays editable in the launcher
  - never writes from chat
  - deep-links into the already approved `payments/create` route with supported
    query params
- runtime verification is now closed too on `qvdmzhyzpyaveniirsmo`:
  - `unified_crm_answer` redeployed
  - authenticated smoke question
    `Preparami una bozza saldo dal preventivo aperto.`
  - response returned:
    - `paymentDraft.paymentType = saldo`
    - `paymentDraft.amount = 450`
    - `paymentDraft.status = in_attesa`
    - approved `/#/payments/create?...&draft_kind=payment_create` href
  - smoke user cleaned after verification

The next open priority is now closed too:

- the first confirmation-on-surface workflow upgrade around the payment draft is
  now implemented on `payments/create`
- the approved destination form now preserves an explicit amount edited in the
  launcher draft instead of silently replacing it with the local residual
  suggestion
- the form now also exposes both layers when relevant:
  - imported AI draft amount
  - current deterministic residual from the linked quote
- the user can still switch manually to the local residual suggestion, but that
  choice is explicit on the approved surface
- this slice stayed local:
  - no function changes needed
  - no chat-side write added
  - validation closed with `npm run typecheck` plus targeted Vitest

The next open priority is now closed too:

- the first payment draft hardening pass now also scopes draft preservation to
  the same quote context that originated the draft
- when the destination form changes quote, the old launcher draft amount is no
  longer privileged over the deterministic local suggestion of the new quote
- this avoids a misleading continuity bug on the approved form:
  - preserve imported edits only while the business context is still the same
  - stop treating them as active when the quote changes
- this slice stayed local and deterministic:
  - no edge-function change
  - no new write capability
  - validation closed with `npm run typecheck` plus targeted Vitest

The next open priority is now closed too:

- the payment draft hardening pass now also makes draft-context invalidation
  explicit on the approved destination form
- when the user changes quote after landing on `payments/create`:
  - the old launcher draft is no longer applied
  - the UI now states clearly that the AI draft belonged to another quote
  - the surface reverts to the local semantics of the quote currently selected
- this closes another ambiguity inside the already approved corridor without
  widening the AI perimeter:
  - no edge-function change
  - no new write capability
  - validation closed with `npm run typecheck` plus targeted Vitest

The next open priority is now closed too:

- the payment draft hardening pass now also protects manual amount editing on
  the approved destination form
- once the user starts editing `amount` on `payments/create`:
  - the automatic residual suggestion no longer reclaims the field
  - the suggestion remains available only as an explicit CTA
  - transient empty states while typing no longer trigger an unwanted refill
- this removes another instability from the already approved corridor without
  widening the AI perimeter:
  - no edge-function change
  - no new write capability
  - validation closed with `npm run typecheck` plus targeted Vitest

The next open priority is now closed too:

- the launcher now supports a second narrow payment write-draft on the
  approved `project_quick_payment` surface
- the CRM read snapshot now exposes deterministic active-project financials
  derived from services, expenses and received payments
- the project quick-payment dialog can now consume a launcher draft carrying:
  - `payment_type`
  - `amount`
  - `status`
- this still does not give the general CRM chat direct write execution:
  - chat only prepares the draft
  - confirmation still happens inside the approved project dialog

Default line after this:

- do not open another write-assisted case by default
- only resume expansion if a new real workflow gap appears or the next scope is
  made explicit

Tactical UX slice closed out of sequence:

- the launcher shell was simplified before opening the next milestone:
  - `Chat AI` now opens as the default view
  - `Snapshot CRM` and `Importa fatture e ricevute` moved behind a `+` menu
  - the chat view remains mounted while switching views, so state is preserved
  - the chat panel now keeps answers above and the composer at the bottom
  - the `+` control now sits to the left of the composer input instead of near
    the close `X`
- this did not widen the AI capability perimeter:
  - no new routes
  - no new edge functions
  - no new write power
- validation closed with:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`

Deferred note from real usage, not current priority:

- importing an older customer invoice can legitimately find a real client that
  is still absent from the CRM
- the launcher does not yet support creating that missing client from the
  invoice workflow
- the current client model also lacks some billing-specific fields needed for a
  solid invoice-born customer draft
- this must be handled later as an explicit slice:
  - define the missing billing anagraphic fields first
  - then allow AI-assisted client creation only with explicit confirmation

That deferred note is now promoted to the next explicit slice, and the
analysis is now closed:

- evidence inspected:
  - current `clients` table and UI
  - current invoice-import draft / extract contract
  - real outgoing invoices under `Fatture/2023`, `Fatture/2024`,
    `Fatture/2025`
  - current `expenses` linkage
- the current gap is structural, not just UX:
  - `clients` still stores only one freeform `address`
  - `clients` still merges `Partita IVA / Codice Fiscale` into one `tax_id`
  - invoice import still has nowhere structured to keep billing anagraphic
    fields even when Gemini sees them
- recurring customer billing fields observed in real XML invoices:
  - `Denominazione`
  - `IdPaese`
  - `IdCodice`
  - `CodiceFiscale`
  - `Indirizzo`
  - `NumeroCivico`
  - `CAP`
  - `Comune`
  - `Provincia`
  - `Nazione`
  - `CodiceDestinatario`
- the next slice must therefore proceed in this order:
  - first define the client billing-profile fields in schema, types and UI
  - then extend invoice extraction + draft payload so the launcher can carry
    those fields coherently
  - only after that consider AI-assisted client creation, always with explicit
    confirmation
- keep the supplier/vendor problem as a separate later slice:
  - `expenses` still links counterparties through `client_id`
  - there is still no dedicated supplier resource/page
  - do not mix supplier-resource design into the customer billing-profile
    migration unless a hard blocker appears

That customer billing-profile slice is now closed too:

- new nullable client billing fields now exist in DB schema:
  - `billing_name`
  - `vat_number`
  - `fiscal_code`
  - split billing address fields
  - `billing_sdi_code`
  - `billing_pec`
- client create/edit/show/export and quote PDF now consume those structured
  fields with fallback to the old legacy fields
- invoice import now carries the same fiscal fields end-to-end:
  - Gemini schema
  - edge-function prompt
  - draft payload
  - draft editor
- when an imported customer is still missing from the CRM, the draft can now
  open `clients/create` already prefilled instead of forcing a dead end
- if the user still confirms only `payments` / `expenses`, the extracted fiscal
  fields are at least preserved in the created record notes for traceability
- runtime verification is now closed too on `qvdmzhyzpyaveniirsmo`:
  - migration `20260301153000_add_client_billing_profile.sql` pushed remotely
  - `invoice_import_extract` redeployed remotely
  - authenticated smoke on real PDF `FPR 1/23` returned:
    - `billingName = LAURUS S.R.L.`
    - `vatNumber = IT04126560871`
    - `billingCity = Pozzallo`
    - `billingSdiCode = M5UXCR1`
    - warning for missing client still not present in CRM
- supplier/vendor modeling remains intentionally deferred to its own slice:
  - `expenses` still links through `client_id`
  - no supplier resource/page was introduced here

The immediate continuity follow-up is now closed too:

- the unified launcher read snapshot now exposes the new customer
  billing/fiscal profile on recent clients:
  - billing-coherent name
  - `P.IVA`
  - `CF`
  - `Codice Destinatario`
  - `PEC`
  - summarized billing address
- client-linked quote/project/payment references inside the launcher now reuse
  that billing-coherent naming
- client list discovery is now aligned with the same data:
  - row preview shows billing identity badges
  - filters/search now support billing name, `P.IVA`, `CF`,
    `Codice Destinatario`, `PEC`, and billing city
- this stayed a local continuity slice:
  - no DB change
  - no edge-function change
  - validation closed with `npm run typecheck` and targeted Vitest

The launcher continuity/reading-space slice is now closed too:

- mobile launcher now fills the whole viewport height for reading room
- the CRM chat inside the launcher now survives close/reopen with:
  - last answer
  - current payment draft
  - current unsent question
- invoice import intentionally stays reset-on-close to avoid carrying temporary
  document state across drawer sessions
- known residual risk:
  - the restored answer may refer to a slightly older snapshot than the live
    CRM at reopen time
  - the visible answer timestamp is now the explicit clue for that boundary

The launcher composer continuity slice is now closed too:

- the compact composer now exposes the expand action from the third visible
  line onward
- the compact composer only starts its own scrollbar from the seventh line
- the expanded writer stays inside the same launcher conversation instead of
  creating a separate draft flow
- the expanded writer no longer wastes space on explanatory copy and now keeps
  only the editable surface plus close/send actions
- the launcher composer textareas now opt out of generic
  `field-sizing-content`, so the product-owned thresholds stay coherent even
  on whitespace-heavy input
- known residual risk:
  - the line thresholds depend on runtime line-height measurement
  - mobile keyboard/browser-chrome overlap still deserves real-device smoke
    beyond local UI tests
- that local smoke is now at least partially closed:
  - the launcher chat fixes were rechecked in the real local browser and the
    reported regressions are resolved
- that mobile real-device smoke is now partially closed too:
  - an iPhone Safari smoke found a blocked scroll state on long answers
  - the launcher now relies on one explicit mobile scroll area plus `min-h-0`
    wrappers and a `shrink-0` composer footer
  - validation closed with typecheck and targeted Vitest

The expenses list regression is now closed too:

- `ExpenseListActions` now receives the same exporter passed to `List`
- the `/#/expenses` screen no longer crashes with `exporter is not defined`

The launcher km-expense slice is now closed too:

- the unified launcher can now help on a real `spostamento_km` workflow
  without adding a second AI surface
- when the question clearly describes a route expense to register, the launcher
  now uses a deterministic `openrouteservice` branch to:
  - resolve origin and destination
  - compute the route distance
  - derive the reimbursement estimate from the shared default `km_rate`
  - open `/#/expenses/create` with the route already prefilled
- the approved landing on `expenses/create` now supports:
  - `expense_type`
  - `expense_date`
  - `km_distance`
  - `km_rate`
  - `description`
  - launcher banner copy
- known residual risk:
  - if the route uses only a city/locality name, ORS may resolve a generic
    point instead of the exact address, so km stay user-correctable before save
- validation closed with:
  - `npm run typecheck`
  - targeted Vitest
  - live local ORS calls on the first real route used as product benchmark
  - authenticated remote smoke on `2026-03-01` after setting
    `OPENROUTESERVICE_API_KEY` on `qvdmzhyzpyaveniirsmo`
  - remote smoke result:
    - HTTP `200`
    - model `openrouteservice`
    - first suggested action `expense_create_km`
    - handoff prefilled on `/#/expenses/create`
  - smoke user cleaned after verification

Why this comes next:

- the launcher now has the base layers it needed:
  - a real invoice workflow
  - a real CRM-wide read snapshot
  - a real CRM-wide read-only answer flow
  - a first practical route handoff from grounded answer to existing CRM
    surfaces
  - a first approved commercial handoff toward real payment-oriented surfaces
- a first deterministic primary recommendation on top of those approved actions
- a first richer landing on those approved commercial surfaces with supported
  prefills and launcher context
- a first deterministic destination-side amount suggestion on the quote payment
  path
- the next Pareto gain is therefore not another raw Q&A surface, but closing
  the last manual context gaps on top of those approved landings
- the semantic/capability backbone is already strong enough for this next step

The next open priority is now:

- keep the supplier/vendor problem as its own explicit slice instead of
  widening the customer billing model again
- if expense counterparties become the active pain point:
  - introduce a dedicated supplier resource/page
  - stop overloading `client_id` for supplier expenses
- only after that boundary is explicit, evaluate richer create/update
  assistance from invoice import on top of the stronger customer profile now in
  place

Not the next step by default:

- a new AI page in the main navigation
- more page-level AI cards
- more dashboard widgets
- broader automation after the manual path is already stable
- direct write execution from the general CRM Q&A flow
- automatic invoice writes without explicit confirmation
- letting the model invent raw URLs or unsupported routes

## Stop Line For This Phase

This work must not grow forever. For the current recovery phase, `enough`
means:

- the local database can be rebuilt from real source-of-truth files
- Diego/Gustare no longer depends on hardcoded local domain fixtures
- the rebuilt dataset is good enough to expose real semantic gaps in the
  financial model
- only then do tests become worth stabilizing on top of that dataset

What is legitimate work in this phase:

- rebuild/import work from `Fatture/`
- enrichment from `Fatture/contabilità interna - diego caltabiano/`
- correcting schema and domain semantics when real data expose a weakness
- realigning UI, import, AI and analytics to the rebuilt truth

What is **not** part of this phase by default:

- adding more AI slices because the old launcher path still has room to grow
- expanding supplier-resource design before the current financial model is
  clearer
- widening general AI writes while the underlying data model is still weak
- adding more E2E coverage on top of synthetic local business data

Stop condition:

- after reset, the local runtime rebuilds on real business data
- the next open problem is genuinely semantic/modeling work, not synthetic
  bootstrap drift
- from that point, tests can be rewritten as verification of the recovered
  system instead of as a substitute for it

## How To Use This Backlog In A New Chat

Ask the new session to:

1. read `docs/historical-analytics-handoff.md`
2. read this file
3. read `doc/src/content/docs/developers/historical-analytics-ai-ready.mdx`
4. continue from the first unfinished priority without re-opening already closed architecture decisions
5. if a feature changes CRM behavior, update the semantic registry, capability
   registry, tests, and continuity docs in the same pass

Use `progress.md` and `learnings.md` only as optional deep archive if the open
question depends on historical chronology or on a pattern already discovered in
the past.

## Completed Since Last Update

### Remote historical verification on the linked project

- Verified via remote PostgREST against project `qvdmzhyzpyaveniirsmo`:
  - `analytics_history_meta`
  - `analytics_yearly_competence_revenue`
  - `analytics_yearly_competence_revenue_by_category`
  - `analytics_client_lifetime_competence_revenue`
- Confirmed remote semantics:
  - `2026` is present as `YTD`
  - `YoY` is derived from `2025 vs 2024`
  - top client lifetime revenue is populated
  - category mix contains non-zero historical data
- Important operational note:
  - the publishable/anon key returns empty arrays on the historical views
    because the views use `security_invoker=on` on top of RLS-protected base
    tables
  - this must not be interpreted as a broken migration

### First AI-ready integration entry point

- Added `dataProvider.getHistoricalAnalyticsContext()`
- Added `dataProvider.generateHistoricalAnalyticsSummary()`
- The returned payload now includes:
  - `meta`
  - `metrics`
  - `series`
  - `qualityFlags`
  - `caveats`
- `caveats` convert semantic conditions into human-readable statements such as:
  - competence-vs-cash basis
  - current year as YTD
  - closed-years-only YoY
  - insufficient-data / zero-baseline conditions
  - future-services exclusion

### Operational semantic backbone for AI-safe read/write

- Added shared semantic registry:
  - `src/lib/semantics/crmSemanticRegistry.ts`
- Added provider access:
  - `dataProvider.getCrmSemanticRegistry()`
- Added configurable operational rule:
  - `operationalConfig.defaultKmRate`
- Added service fiscal flag:
  - `services.is_taxable`
- Added semantic descriptions to fixed dictionaries:
  - client types
  - acquisition sources
  - project categories / statuses / TV shows
  - quote statuses
  - payment types / methods / statuses
- Reused the same formulas in the real app:
  - service net value
  - taxable service net value
  - travel reimbursement
- Aligned real UI paths:
  - service create/show/list
  - expense create/show/list
  - quick TV episode creation
  - fiscal model
- Validation completed on `2026-02-28`:
  - `npm run typecheck`
  - `npm test -- --run src/lib/semantics/crmSemanticRegistry.test.ts src/components/atomic-crm/dashboard/fiscalModel.test.ts src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts src/lib/analytics/buildAnnualOperationsContext.test.ts`
  - `npx supabase db push`

### Capability registry and quote-status email templates

- Added a first capability catalog for the future unified AI:
  - `src/lib/semantics/crmCapabilityRegistry.ts`
- It now declares:
  - main resources
  - main pages
  - critical dialogs/modals
  - important business actions
  - route mode (`hash`)
  - a mandatory integration checklist for future features
- Added a first communication template layer:
  - `src/lib/communications/quoteStatusEmailTemplates.ts`
- It now supports:
  - quote-status specific send policies
  - dynamic HTML/text output
  - required-field checks before sending
  - shared sections instead of hardcoded page copy
  - hard safety rule:
    - services with `is_taxable = false` must never trigger automatic emails
- Product direction locked:
  - outbound mail target is `Gmail`
  - the current template layer stays provider-agnostic until credentials and
    transport are wired
  - internal urgent notifications target `CallMeBot`
- Cleanup completed:
  - the old inbound `postmark` function is not part of the active
    runtime/config and related UI/config must stay unused
- Validation completed on `2026-02-28`:
  - `npm run typecheck`
  - `npm test -- --run src/lib/communications/quoteStatusEmailTemplates.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`

### Manual quote-status email sending via Gmail SMTP

- Added shared context builder:
  - `src/lib/communications/quoteStatusEmailContext.ts`
- Added provider entry points:
  - `dataProvider.getQuoteStatusEmailContext()`
  - `dataProvider.sendQuoteStatusEmail()`
- Added real UI entry point:
  - `src/components/atomic-crm/quotes/SendQuoteStatusEmailDialog.tsx`
- Added real transport:
  - `supabase/functions/quote_status_email_send/index.ts`
- Added current user-facing behavior:
  - quote show now exposes `Invia mail cliente`
  - the dialog previews subject/body before sending
  - the send remains manual only
  - the dialog reuses `quoteStatusEmailTemplates`
  - the send is disabled when required fields are missing
- Added semantic/capability continuity:
  - capability registry now declares the manual send action and Gmail SMTP env
  - semantic registry now declares the customer-facing residual formula:
    - quote amount minus linked payments already `ricevuto`
- Hard rule preserved:
  - if linked services include `is_taxable = false`, automatic send remains
    blocked
  - no automatic customer send path was introduced in this slice
- Validation completed on `2026-02-28`:
  - `npm run typecheck`
  - `npm test -- --run src/lib/communications/quoteStatusEmailTemplates.test.ts src/lib/communications/quoteStatusEmailContext.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts src/components/atomic-crm/quotes/SendQuoteStatusEmailDialog.test.tsx supabase/functions/_shared/quoteStatusEmailSend.test.ts`

### Explicit scope decision

- Historical FakeRest/demo notes below are legacy context only.
- The FakeRest provider was removed from the repo on 2026-04-01.

### First end-user AI flow shipped

- Added a manual `Analisi AI` card inside the `Storico` dashboard
- Added Settings dropdown for model selection
- Default model set to `gpt-5.2`
- Deployed edge function:
  - `historical_analytics_summary`
- Remote secrets configured:
  - `OPENAI_API_KEY`
  - `SB_PUBLISHABLE_KEY`
- Authenticated remote smoke test completed on `2026-02-28`:
  - temporary authenticated user created on `qvdmzhyzpyaveniirsmo`
  - authenticated reads to `analytics_history_meta`,
    `analytics_yearly_competence_revenue`, and
    `analytics_yearly_competence_revenue_by_category` succeeded
  - `historical_analytics_summary` returned `200 OK`
  - model resolved to `gpt-5.2`
  - OpenAI summary included the expected YTD / closed-year framing
- Authenticated browser smoke test completed on `2026-02-28`:
  - `Storico` renders the historical KPIs/charts/cards in the real UI
  - the `Analisi AI dello storico` card renders a generated answer in-browser
  - the visible output is coherent with the approved semantics:
    - two closed years: `2024-2025`
    - `2026` framed as `YTD`
    - `YoY` framed as `2025 vs 2024`

### UI test coverage and AI card polish added

- Added UI test infrastructure for React components:
  - `jsdom`
  - `@testing-library/react`
- Added baseline widget/UI tests:
  - `DashboardHistorical.ui.test.tsx`
  - `DashboardHistoricalWidgets.test.tsx`
- Covered states:
  - parent empty state
  - parent error state + retry
  - contextual YoY warning state
  - widget-level error states
  - widget empty states
  - YoY `N/D` rendering
- Polished AI markdown rendering:
  - visible list bullets
  - better paragraph/list spacing inside the AI summary card

### Plain-language translation layer added

- Replaced user-facing jargon in the historical dashboard:
  - `YTD` -> plain wording such as `finora` / `anno in corso fino a oggi`
  - `YoY` -> `crescita rispetto all'anno prima`
  - `competenza` -> explanation centered on `valore del lavoro`, not accounting terms
- Rewrote historical cards and helper copy for a non-expert business owner
- Reworked the OpenAI prompt so the AI explains the numbers in plain Italian,
  translating any unavoidable technical term immediately
- Remote function redeployed after the prompt rewrite

### Historical free-question flow added

- Added provider method:
  - `dataProvider.askHistoricalAnalyticsQuestion()`
- Added separate Edge Function to preserve the already stable summary flow:
  - `historical_analytics_answer`
- Extended the existing AI card with:
  - textarea input
  - suggested question chips
  - guardrail copy explaining that the AI only uses the visible historical data
  - single-turn answer rendering
- Added AI-card component tests covering:
  - guided summary flow still working
  - suggested-question flow
  - disabled submit on empty question
- Deployed `historical_analytics_answer` to
  `qvdmzhyzpyaveniirsmo`
- Authenticated remote smoke test completed on `2026-02-28`:
  - temporary authenticated user created on `qvdmzhyzpyaveniirsmo`
  - authenticated reads to the historical views succeeded
  - `historical_analytics_answer` returned `200 OK`
  - model resolved to `gpt-5.2`
  - output started with `## Risposta breve`
  - output avoided raw `YTD` / `YoY` wording
- Important operational note:
  - the first smoke failed with `Requested function was not found`
  - root cause was missing remote deploy, not broken code
  - redeploy fixed it immediately

### Annual dashboard semantic normalization added

- Removed the annual runtime dependency on `monthly_revenue` for KPI/chart/core
  operational calculations
- Annual operational numbers now derive from `services` directly with one
  consistent basis:
  - fee net of discount
- For the current year:
  - future services later in the year are excluded from operational totals
  - the chart window is the selected-year window up to today, not trailing 12
    months
- The annual UI now explains the meaning of each block more clearly:
  - value of work
  - cash expected
  - pipeline potential
  - fiscal simulation
- `BusinessHealth` metrics now respect the selected year for:
  - quote conversion rate
  - weighted pipeline value
  - DSO
- Added defensive migration:
  - `20260228150000_normalize_monthly_revenue_net_basis.sql`
- Added tests:
  - `dashboardAnnualModel.test.ts`
- Important scope note:
  - this did **not** make `Annuale` AI-ready as a single context
  - it only made the operational core stable enough for a future
    `annual_operations` context

### Annual operations AI flow added

- Added context builder:
  - `buildAnnualOperationsContext()`
- Added provider methods:
  - `getAnnualOperationsAnalyticsContext(year)`
  - `generateAnnualOperationsAnalyticsSummary(year)`
  - `askAnnualOperationsQuestion(year, question)`
- Added Edge Functions:
  - `annual_operations_summary`
  - `annual_operations_answer`
- Added UI consumer:
  - `DashboardAnnualAiSummaryCard`
- Added tests:
  - `buildAnnualOperationsContext.test.ts`
  - `DashboardAnnualAiSummaryCard.test.tsx`
- Added remote deploy + authenticated smoke on `2026-02-28`:
  - year used in smoke: `2025`
  - summary returned `200 OK`
  - answer returned `200 OK`
  - model resolved to `gpt-5.2`
  - output stayed in the operational domain and did not drift into fiscal
    simulation
- Important scope rule preserved:
  - Annuale AI reads only `annual_operations`
  - it does not include the fiscal simulator
  - it does not include current-day alerts

### Annuale hardening applied after real user answers

- Added shared guidance helper:
  - `supabase/functions/_shared/annualOperationsAiGuidance.ts`
- Added internal question reframing before the annual Q&A OpenAI call
- Tightened suggested questions so they reflect:
  - closed year vs current year
- Re-tested remotely on the problematic 2025 question set
- Scope decision:
  - keep only minimal anti-bufala prompt hardening
  - do not keep polishing this temporary UI indefinitely
  - move future effort toward `AI-driving` foundations:
    - semantic layer
    - tool contract
    - drill-down data contracts

### Commercial backbone slice 1 added

- Added migration:
  - `20260228170000_add_quotes_project_link.sql`
- Added quote/project linking in the UI
- Added `CreateProjectFromQuoteDialog`
- Added payment form support for `quote_id` with coherent autofill/cleanup
- Added payment list/show visibility for linked quotes
- Important scope note:
  - this is only the first integration slice
  - `quote_items` and full quote-builder automation are still open future work

### Browser click-test of the commercial flow completed

- Real authenticated browser smoke completed on `2026-02-28`
- Verified end-to-end path:
  - quote without `project_id`
  - project creation from quote
  - linked project visible back on the quote
  - payment creation with quote-driven alignment of client/project
  - payment show visibility for both linked project and linked quote
- Runtime fixes discovered and applied during the smoke:
  - `CreateProjectFromQuoteDialog` now supports direct mutation records, not
    only `{ data }`
  - quote autocomplete in `PaymentInputs` now searches explicitly on
    `description@ilike`
- Added regression coverage:
  - `CreateProjectFromQuoteDialog.test.tsx`
  - `paymentLinking.test.ts`

### Browser click-test of the Annuale AI flow completed

- Real authenticated browser smoke completed on `2026-02-28`
- Verified path:
  - open `Annuale`
  - generate the guided explanation
  - submit one suggested question
  - confirm the answer stays inside the operational context
    without drifting into fiscal simulation or alert wording

### Browser click-test of the Storico free-question flow completed

- Real authenticated browser click-test completed on `2026-02-28`
- Verified path:
  - open `Storico`
  - type a manual free question in the textarea
  - submit the request from the real UI
  - verify the answer renders correctly in the browser runtime
- Evidence collected:
  - answer returned on model `gpt-5.2`
- wording stayed in plain Italian and grounded itself in visible historical
  year/category data
- no browser console errors were observed during the Q&A path

### Quote quick-payment slice completed

- Added a direct `Registra pagamento` CTA on the quote show page
- The CTA opens `/payments/create` with prefilled:
  - `quote_id`
  - `client_id`
  - `project_id` only when a linked project already exists
- Scope rule kept explicit:
  - quote is useful but not mandatory
  - project is useful but not mandatory
  - the quick-payment path must still work for simple cases like `wedding`
    without forcing project creation
- Real authenticated browser smoke completed on `2026-02-28`
- Verified path:
  - open a `wedding` quote with no linked project
  - use `Registra pagamento`
  - verify payment create opens with linked quote and client already aligned
  - verify project remains empty instead of being forced
  - save the payment successfully from the real UI
- Added helper coverage for:
  - quick-payment eligibility by quote status
  - prefilled payment-create defaults from quote
  - parsing defaults back from the create URL search params

### Quote items foundation completed

- Added migration:
  - `20260228190000_add_quote_items_json.sql`
- Scope decision locked in code:
  - `quote_items` live inside `quotes.quote_items` as a JSONB array payload,
    not as a separate CRUD-heavy resource
  - the classic quote path stays valid:
    - `description + amount` still works
  - when `quote_items` exist:
    - `amount` is derived automatically from the line totals
- Added quote-items helper module:
  - `quoteItems.ts`
  - sanitize rows
  - compute totals
  - transform create/edit payloads safely
- Added form/UI support:
  - repeatable `Voci preventivo` in create/edit
  - auto-locked total when the quote is itemized
  - quote show renders the item list with per-line totals
  - quote PDF renders itemized rows when present
- Runtime fix discovered during real browser validation:
  - generic autocomplete search `q` is not safe on the Supabase `clients`
    resource
  - real browser flow failed with `column clients.q does not exist`
  - fix applied:
    - added shared `name@ilike` helper for client/project reference lookups
    - wired it into quote create/list and task client selection
- Validation completed on `2026-02-28`:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/quotes/quoteItems.test.ts src/components/atomic-crm/misc/referenceSearch.test.ts src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/CreateProjectFromQuoteDialog.test.tsx src/components/atomic-crm/quotes/quoteProjectLinking.test.ts`
  - `npx supabase db push`
  - authenticated browser smoke:
    - created a quote with line items from the real UI
    - verified computed amount in the form/runtime
    - verified itemized rendering in quote show on the real authenticated app
    - no browser console errors after the explicit `name@ilike` fix

### Quote payment visibility slice completed

- Added quote-side payment summary helper:
  - `quotePaymentsSummary.ts`
- Added quote-side UI section:
  - `QuotePaymentsSection.tsx`
- Added product behavior:
  - quote show now exposes linked-payment visibility without leaving the quote
  - the user can read:
    - already received
    - already registered but still open
    - remaining amount not yet linked to payments
    - individual linked payment rows
- Scope rule preserved:
  - no new mandatory object was introduced
  - no automatic status transition was introduced
  - the feature strengthens the current `quote -> payment` link instead of
    inventing a heavier workflow
- Validation on `2026-02-28`:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/quotes/quotePaymentsSummary.test.ts src/components/atomic-crm/quotes/QuotePaymentsSection.test.tsx src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/quoteProjectLinking.test.ts src/components/atomic-crm/quotes/quoteItems.test.ts`

### Client direct-payment slice completed

- Added client-side quick path helpers:
  - `buildPaymentCreateDefaultsFromClient()`
  - `buildPaymentCreatePathFromClient()`
- Added product behavior:
  - client show now exposes `Nuovo pagamento`
  - the button opens the existing payment create form with `client_id`
    already set
- Scope rule preserved:
  - no new mandatory object was introduced
  - no project is forced for the simple case
  - no duplicate payment form/dialog was introduced
- Validation on `2026-02-28`:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/QuotePaymentsSection.test.tsx src/components/atomic-crm/quotes/quotePaymentsSummary.test.ts`
  - authenticated browser smoke:
    - `client show -> Nuovo pagamento -> payment create with client prefilled`

### Annual operations drill-down completed

- Added semantic drill-down payload inside `annual_operations`:
  - `drilldowns.pendingPayments`
  - `drilldowns.openQuotes`
- Scope rule kept explicit:
  - this is not the alert snapshot
  - pending payments stay `cash expected`
  - open quotes stay `pipeline potential`
  - the AI now receives concrete entities without mixing them with fiscal or
    day-based alert logic
- Pending payments drill-down now includes:
  - `paymentId`
  - `clientId`
  - `clientName`
  - optional `projectId` / `projectName`
  - optional `quoteId`
  - `amount`
  - `status`
  - optional `paymentDate`
- Open quotes drill-down now includes:
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
- Important bridge with the commercial backbone:
  - quote/project remain optional,
  - but the AI now sees whether an open quote is already linked to a project
    and whether it is itemized.
- Validation completed:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts src/lib/analytics/buildAnnualOperationsContext.test.ts supabase/functions/_shared/annualOperationsAiGuidance.test.ts`
  - no edge-function deploy required:
    - existing annual functions already accept the richer JSON context from the
      client/provider

### Annuale AI validation on payment/quote questions completed

- Authenticated remote smoke completed on `2026-02-28`
- Validation setup:
  - temporary authenticated user created via admin API on
    `qvdmzhyzpyaveniirsmo`
  - cleanup completed automatically after the run
  - local code built the real `annual_operations` context and sent it to the
    existing `annual_operations_answer` function
- Observed result:
  - chosen year in the smoke: `2026`
- drill-down contained:
  - `2` pending payments
  - `0` open quotes
- the answer cited the concrete client label present in the drill-down at that
  time:
  - `Diego Caltabiano` (pre-correction runtime label)
  - the answer also correctly stated that no open quotes were present in that
    perimetro
- Outcome:
  - the richer context is not only serialized correctly,
  - it is also actually used by the real AI answer path without additional
    code changes or new deploys.

### Annuale browser click-test on payment/quote questions completed

- Real authenticated browser click-test completed on `2026-02-28`
- Validation setup:
  - temporary authenticated user created on `qvdmzhyzpyaveniirsmo`
  - local Vite runtime on `127.0.0.1:4173`
  - real browser automation executed with Playwright using the installed
    Google Chrome binary
- Verified path:
  - open login page
  - sign in with the temporary user
  - land on the real `Annuale` dashboard
  - trigger the suggested question:
    - `Cosa raccontano pagamenti e preventivi del 2026?`
  - wait for the in-browser answer to render
- Observed result:
  - the answer cited `Diego Caltabiano` (pre-correction runtime label)
  - the answer stated correctly that no open quotes were present in the same
    `2026` perimetro
  - browser console errors observed during the path:
    - `0`
  - browser page errors observed during the path:
    - `0`
- Outcome:
  - the Annuale AI payment/open-quote question set is now closed both:
    - on the remote answer path
    - and on the real browser UI path

### Historical `incassi` semantic entry point added

- Added migration:
  - `20260228193000_add_historical_cash_inflow_view.sql`
- Added semantic resource:
  - `analytics_yearly_cash_inflow`
- Added provider method:
  - `dataProvider.getHistoricalCashInflowContext()`
- Added semantic builder:
  - `buildHistoricalCashInflowContext()`
- Added metric definitions:
  - `historical_total_cash_inflow`
  - `latest_closed_year_cash_inflow`
- Added tests:
  - `buildHistoricalCashInflowContext.test.ts`
- Added remote verification on `2026-02-28`:
  - `service_role` REST query showed:
    - `2025` closed year
    - `2026` as `YTD`
  - authenticated REST query with a temporary user showed the same rows
- Scope rule preserved:
  - do not mix `incassi` into the existing competence widgets
  - keep `compensi` and `incassi` as separate semantic bases

### Historical `incassi` AI consumer added

- Added dedicated UI card:
  - `DashboardHistoricalCashInflowAiCard`
- Added provider methods:
  - `generateHistoricalCashInflowSummary()`
  - `askHistoricalCashInflowQuestion()`
- Added Edge Functions:
  - `historical_cash_inflow_summary`
  - `historical_cash_inflow_answer`
- Added browser/UI tests:
  - `DashboardHistoricalCashInflowAiCard.test.tsx`
- Added runtime config continuity:
  - `supabase/config.toml`
  - `[functions.historical_cash_inflow_summary] verify_jwt = false`
  - `[functions.historical_cash_inflow_answer] verify_jwt = false`
- Added browser validation on `2026-02-28`:
  - authenticated login on the real local runtime
  - guided summary rendered
  - suggested-question answer rendered
  - no console errors
  - no page errors
- Scope rule preserved:
  - the new card stays separate from the existing `Storico` KPI/chart widgets
  - `compensi` and `incassi` are still never mixed in one widget

### Historical `incassi` non-AI surface added

- Added dedicated UI card:
  - `DashboardHistoricalCashInflowCard`
- Added browser/UI tests:
  - `DashboardHistoricalCashInflowCard.test.tsx`
  - `DashboardHistorical.ui.test.tsx`
- Added product behavior:
  - `Storico` now shows a small non-AI card for received cash
  - the card reuses `dataProvider.getHistoricalCashInflowContext()`
  - the card keeps totals/yearly rows/caveat wording centered on `incassi`
- Scope rule preserved:
  - the card is separate from competence KPIs/charts
  - the card does not rename or reinterpret any `compensi` widget
- Validation on `2026-02-28`:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowAiCard.test.tsx src/lib/analytics/buildHistoricalCashInflowContext.test.ts`

## Priority 1

### Financial semantic separation on rebuilt real data

Why:

- the rebuilt local truth baseline now exists
- the main weakness is the overloaded meaning of document, due state and cash
  movement
- without fixing this, real-data rebuilds will keep surfacing ambiguity instead
  of producing trustworthy business behavior

Tasks:

- map all current reads/writes that overload `payments` and `expenses`
- introduce a clearer target around:
  - document
  - open receivable/payable state
  - cash movement
  - allocation / reconciliation
- preserve compatibility long enough to migrate UI, AI and import safely

Acceptance:

- the system answers correctly and separately:
  - what was invoiced/received
  - what is still due
  - what was actually paid/incassato
- follow-up work can focus on suppliers and analytics on top of a healthier
  financial backbone

## Priority 2

### Supplier domain only after the financial core is credible

Why:

- suppliers will inherit the same semantic risks as clients if the system still
  confuses document, open state and cash movement
- opening suppliers too early would duplicate ambiguity instead of resolving it

Tasks:

- keep supplier design parked until the document/open/cash split is explicit
- prepare the supplier model with the same rule:
  - fiscal counterparty != operational referent
- reopen supplier implementation only when the financial backbone is stable

Acceptance:

- suppliers can be introduced without reusing the old overloaded financial
  semantics

## Priority 3

### Re-align UI, AI, import and analytics on the recovered model

Why:

- once the rebuild and semantics are corrected, the surfaces must read the same
  truth instead of carrying divergent interpretations

Tasks:

- update UI flows, import flows, read contexts and analytics views on top of
  the recovered domain
- then rewrite smoke/E2E as verification of the corrected system
- only later reopen broader supplier or AI expansion discussions

Acceptance:

- the same business fact is read coherently by forms, dashboards, import and
  AI surfaces
- without losing the current validated question/answer capabilities,
- and without creating regressions in simple day-to-day use.

## Priority 4

### Legacy note — old FakeRest/demo parity item

Why:

- the current product scope no longer includes a FakeRest/demo runtime.

Tasks:

- if a synthetic demo ever returns, prefer a capability check over reviving the
  old FakeRest-specific path.

Acceptance:

- any future synthetic demo mode must not expose a broken historical tab.

## Priority 5

### Expand analytics surface / assistant UX

Only after the base is stable:

- add `incassi` historical views,
- keep `Annuale` AI scoped to `annual_operations` until dedicated contexts are
  designed for alerts/fiscal,
- add `YTD vs same period last year`,
- add client concentration historical KPIs,
- add category trend commentary for the future AI assistant,
- optionally evolve the current single-turn AI card into a multi-turn
  conversational assistant.

## Current Launcher Guardrails

- Travel-expense questions in the launcher must resolve to `expenses/create`
  and never fall back to payment drafts or payment handoff.
- TV work-item creation requests grounded on a real active project may now hand
  off to the approved `project quick episode` flow, but only as a project-level
  destination with explicit confirmation still required there.
- Non-TV work-item creation requests grounded on a real active project must now
  hand off to `services/create`, not to the TV quick-episode dialog.
- Generic non-km expense requests must prefer `expenses/create` with the
  strongest grounded association available:
  - `client_id + project_id` when a project is grounded
  - `client_id` only when no project can be grounded safely
- The unified launcher question-length limit is currently `1200` characters and
  must remain aligned across both composer variants and the backend validator.
- Natural-language route wording such as `da ... fino al ...` must stay covered
  by tests before broadening the parser further.
- When the user references a project/service in free text, the launcher may
  ground itself on the project found in snapshot, but it must not claim that
  the specific service/work item already exists unless that granularity is
  really present in the read context.
- Outside TV, do not invent a new combined service+expense workflow unless the
  two-surface Pareto path (`services/create` + `expenses/create`) proves
  insufficient in real usage.

## Current Travel-UI Guardrails

- The manual km calculator must stay shared across `expenses`, `services` and
  `quick episode`, not fork into per-page variants.
- The calculator may prefill host fields, but the user must still see and edit:
  - `km_distance`
  - `km_rate`
  - any generated travel description/location before save
- Route estimation must stay server-side through a provider entry point; do not
  move ORS calls into the browser bundle.
- `travel_route_estimate` must stay declared in `supabase/config.toml`
  alongside the other UI-invoked Edge Functions; forgetting the entry regresses
  browser calls to `401 Invalid JWT` before the function code runs.
- Frontend invokes of authenticated Edge Functions should resolve a fresh user
  access token explicitly instead of relying on SDK fallback behavior.

## Non-Negotiable Rules

These rules must remain true in all future work:

- `Compensi` and `Incassi` are distinct metrics.
- Current year is `YTD`, not a full year.
- `YoY` means the last two closed years unless another comparison is explicitly named.
- If a metric is not comparable, show `N/D` with a reason.
- The AI must consume semantic context, not raw tables.
- `supabase/functions/.env` must stay untracked; commit only
  `supabase/functions/.env.example` with placeholders.

- 2026-03-08: reasoning effort downgraded to 'low' in unified_crm_answer (other EFs keep 'medium' — smaller context)
- 2026-04-01: AI snapshot builder wired to canonical views (project_financials, client_commercial_position) — no new backlog items
