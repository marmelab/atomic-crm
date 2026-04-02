# Claude Auto-Correction System

> **Questo file NON è documentazione**. È il mio sistema di apprendimento
> automatico. Ogni entry è un trigger che mi costringe a comportarmi
> diversamente. I trigger critici sono anche coperti dai file auto-loaded
> in `.claude/rules/` (architecture.md, supabase.md, session-workflow.md).

---

## Rituale di sessione

1. Leggo questo file all'inizio di ogni sessione
2. Applico i trigger alla situazione attuale
3. Se imparo qualcosa di nuovo, aggiorno PRIMA di chiudere

---

## Indice trigger per categoria

| Cat.         | ID    | Trigger                                   |
| ------------ | ----- | ----------------------------------------- |
| **UI**       | UI-1  | Nuova lista desktop → resizable columns   |
| **UI**       | UI-2  | Nuovo filtro entità → FilterPopover       |
| **UI**       | UI-3  | Nuova pagina lista → MobilePageTitle      |
| **UI**       | UI-4  | Input numerici → MAI `?? 0`               |
| **UI**       | UI-5  | useEffect + formState → ciclo infinito    |
| **UI**       | UI-6  | Import `@/components/admin` → no barrel   |
| **DB**       | DB-1  | Enum/Choice → aggiorna TUTTE le superfici |
| **DB**       | DB-2  | Nuova migration → checklist replayability |
| **DB**       | DB-3  | km servizi → spesa auto da trigger DB     |
| **DB**       | DB-4  | View con meno colonne → DROP prima        |
| **DB**       | DB-5  | Frontend→trigger invariant → audit dup    |
| **Backend**  | BE-1  | Edge Function modificata → deploy manuale |
| **Backend**  | BE-2  | Nuova Edge Function → config.toml!        |
| **Backend**  | BE-3  | Schema change → riavviare edge runtime    |
| **Backend**  | BE-4  | Deduplica servizi → includere description |
| **Dominio**  | DOM-1 | Fiscale = CASSA, non competenza           |
| **Dominio**  | DOM-2 | Forfettario ≠ regime ordinario            |
| **Config**   | CFG-1 | Nuova configurazione → 3 file obbligatori |
| **Workflow** | WF-1  | Aggiorno continuity-map → aggiorna indice |
| **Workflow** | WF-2  | CI prettier fail su file da subagent      |
| **Workflow** | WF-3  | Destructuring param → verificare completo |
| **Workflow** | WF-4  | Aggiorno file sistema → sweep incrociata  |
| **Workflow** | WF-5  | E2E test → valida sistema, non adattare   |
| **Workflow** | WF-6  | Commit codice → docs+memoria STESSO       |
| **UI**       | UI-7  | Desktop props → verificare mobile         |
| **UI**       | UI-8  | Nuova superficie AI → card unificata      |
| **Backend**  | BE-5  | EF env vars → stop+start NON restart      |
| **Backend**  | BE-6  | Reload remoto → TRUNCATE prima load       |
| **Workflow** | WF-7  | Dopo push → controlla CI autonomo         |
| **Dominio**  | DOM-3 | FatturaPA XML → schema XSD + Aruba        |
| **Dominio**  | DOM-4 | Stato semantico ≠ `array.length`          |
| **Config**   | CFG-2 | BusinessProfile → merge defaults safe     |
| **Config**   | CFG-3 | Flag/prop root → verificare consumo reale |
| **Backend**  | BE-7  | OpenAI reasoning → effort "low" per CRM  |
| **Backend**  | BE-8  | Supabase ref → NON dfrrigmjsvcsdhgqtikz   |
| **Workflow** | WF-8  | Business date → dateTimezone helper       |
| **Workflow** | WF-9  | Business date UI → smoke cross-timezone   |
| **Workflow** | WF-10 | Fix timezone → sweep consumer date-only   |
| **Workflow** | WF-11 | Full E2E rossa → triage prima, patch dopo |
| **Workflow** | WF-12 | Guardrail shell → non mangiare failure    |
| **Dominio**  | DOM-5 | Fiscale due layer → check entrambi        |

---

## UI Triggers

### UI-1: Nuova lista desktop = colonne ridimensionabili

**Quando**: creo/modifico `*ListContent.tsx` con tabella desktop
**Fare**: `useResizableColumns(resource)` + `ResizableHead` + `tableLayout: "fixed"`
**Perché**: tutte le liste CRM supportano resize con localStorage persistence

### UI-2: Nuovo filtro entità = usare FilterPopover

**Quando**: aggiungo filtro dropdown per entità (client, project, supplier...)
**Fare**: `FilterPopover` da `filters/FilterHelpers.tsx`, NON duplicare Popover inline
**Perché**: 6 moduli usavano lo stesso Popover duplicato, ora c'è il generico

### UI-3: Nuova pagina lista → MobilePageTitle

**Quando**: creo/modifico un componente `*List.tsx`
**Fare**: aggiungere `<MobilePageTitle title="..." />` come primo figlio
**Perché**: su mobile non c'è breadcrumb, utente non sa dove è
**Check**: cerco `title={false}` nella lista → devo aggiungere MobilePageTitle

### UI-4: Input numerici React — MAI `?? 0`

**Quando**: vedo `<Input type="number" value={field ?? 0}` o `onChange: "" → 0`
**Fare**: `value={field ?? ""}` e `onChange: "" → null`
**Perché**: l'utente non riesce a cancellare il campo

### UI-5: useEffect + formState = ciclo infinito

**Quando**: vedo `formState` nelle dipendenze di un `useEffect`
**Fare**: rimuoverlo, usare `getFieldState("field")` senza secondo parametro
**Perché**: `formState` cambia ad ogni render → loop infinito garantito

### UI-6: Import da `@/components/admin` → no barrel

**Quando**: vedo import dal barrel file
**Fare**: split in import specifici (`@/components/admin/x`)
**Perché**: previene bundle bloat e circular deps
**Eccezione**: se l'import specifico non esiste (es. `SaveButton` è in `form.tsx`), usare il barrel solo per quello

### UI-7: Componente desktop con props → verificare SEMPRE il mobile

**Quando**: passo nuovi props a un componente condiviso (es. `DashboardKpiCards`, qualsiasi card/widget riusato)
**Fare**: cercare TUTTE le chiamate di quel componente nel codebase (`Grep`) e verificare che i nuovi props siano passati anche da `MobileDashboard`, `Mobile*`, e qualsiasi altro consumer
**Perché**: `MobileDashboard` chiamava `DashboardKpiCards` senza `fiscalKpis` e `taxesPaid` → TASSE mostrava "—" su mobile con dati finanziari SBAGLIATI. Dati finanziari errati = rischio critico per l'utente. MAI lasciare un consumer senza i props necessari.
**Check**: `grep -r "ComponentName" src/ --include="*.tsx"` per trovare tutti i consumer

### UI-8: Nuova superficie AI → pattern card unificata

**Quando**: aggiungo AI a una nuova sezione del prodotto (es. storico, dettaglio)
**Fare**: replicare il pattern `DashboardHistoricalAiCard` / `DashboardAnnualAiSummaryCard`:

1. Vista smart toggle (localStorage key unica)
2. Suggerimenti colorate con `HistoricalSuggestedQuestion` (color + priority + scope)
3. Input libero + Enter submit
4. PDF export via afterprint (`[data-print-portal]`)
5. Compact mode per mobile (collapsible suggestions)
6. Provider con `{ visualMode }` option
7. Edge Function con `visualModeInstructions` condivise

**Perché**: la checklist in AGENTS.md ("AI Visual Blocks Pattern") ha 6 step — questo trigger aggiunge i dettagli UI mancanti (suggerimenti colorate, compact mode, scope selector)

---

## DB Triggers

### DB-1: Enum/Choice = aggiorna TUTTE le superfici

**Quando**: aggiungo un valore a un enum (expense_type, service_type, status...)
**Fare**: aggiornare CHECK constraint DB, types.ts, UI choices/labels, views con CASE, AI registry, Edge Functions, test
**Perché**: commit a33d903 aggiunse 3 expense types nel frontend ma NON nel CHECK → INSERT bloccati per settimane

### DB-2: Nuova migration SQL → checklist

**Quando**: creo `supabase/migrations/YYYYMMDDHHMMSS_*.sql`
**Fare**: verificare:
- `IF EXISTS` / `IF NOT EXISTS` per replayability
- RLS policies se tabella nuova
- Indici su FK
- Trigger `updated_at` se serve

### DB-3: km su servizi = spesa auto dal trigger DB

**Quando**: codice che inserisce servizi con km_distance > 0
**Fare**: NON creare manualmente spesa spostamento_km — il trigger `sync_service_km_expense` la crea via `source_service_id`
**Perché**: doppio conteggio. `quickEpisodePersistence` e `invoice_import` NON devono creare spese km

### DB-4: View con shape ridotta = DROP prima di ricreare

**Quando**: riscrivo una view rimuovendo o rinominando colonne esistenti
**Fare**: usare `DROP VIEW IF EXISTS ...` seguito da `CREATE VIEW ...`; non usare `CREATE OR REPLACE VIEW` se il nuovo schema ha meno colonne. Verificare prima eventuali dipendenze e ricrearle nella stessa migration se servono.
**Perché**: Postgres non permette di eliminare colonne da una view con `OR REPLACE` (`ERROR: cannot drop columns from view`). Il bug ha rotto `supabase db reset` sulla migration `20260401094930_single_source_financials.sql`, quindi ha violato la replayability.

### DB-5: Sposto un invariant dal frontend al DB trigger = audit duplicati orfani

**Quando**: una logica che prima creava record dal client viene spostata in un trigger DB (es. `services` -> `expenses.spostamento_km`)
**Fare**: auditare subito le righe create durante la finestra di transizione cercando gruppi con stessa chiave naturale ma mix di record linked/unlinked (`source_service_id` presente + assente). Pulire gli orfani prima di fidarsi dei nuovi totali.
**Perché**: il 2026-03-06 `QuickEpisode` creava ancora manualmente la spesa km mentre il trigger `sync_service_km_expense` la creava gia' dal `service`. Risultato: doppio conteggio, progetto/cliente gonfiati di `€ 40,54` finche' non e' stato rimosso l'orfano.

---

## Backend Triggers

### BE-1: Edge Function modificata → deploy manuale

**Quando**: tocco codice in `supabase/functions/`
**Fare**: ricordare che `git push` NON basta, serve `npx supabase functions deploy`
**Perché**: altrimenti resta la vecchia versione in produzione

### BE-2: Nuova Edge Function → config.toml!

**Quando**: creo una NUOVA Edge Function
**Fare**: aggiungere IMMEDIATAMENTE in `supabase/config.toml`:
```toml
[functions.nome_funzione]
verify_jwt = false
```
**Perché**: l'auth è gestita internamente da `_shared/authentication.ts`. Senza la entry, Kong blocca il JWT → 401 sistematico su OGNI chiamata.
**Bug reale**: `invoice_import_confirm` ha dato 401 per settimane.
**Check**: `grep "functions.nome_funzione" supabase/config.toml`

### BE-3: Schema change → riavviare edge runtime

**Quando**: dopo migration che cambia tipo colonna o aggiunge colonna
**Fare**: `docker restart supabase_edge_runtime_gestionale-rosario`
**Perché**: l'edge runtime usa lo schema della sessione, senza restart usa il vecchio

### BE-4: Deduplica servizi → includere description

**Quando**: vedo query di deduplicazione in `invoice_import_confirm`
**Fare**: verificare che `description` sia nel WHERE
**Perché**: spot diversi stessa data/fee (es. 2 spot Gustare €312) visti come duplicati senza description

### BE-5: EF env vars → stop+start, NON docker restart

**Quando**: aggiungo/modifico variabili in `supabase/functions/.env`
**Fare**: `npx supabase stop --no-backup && npx supabase start` — MAI solo `docker restart`
**Perché**: `docker restart` riavvia il container con le STESSE env vars dell'avvio originale. Solo `supabase stop+start` rilegge `functions/.env` e le passa al container.

### BE-6: Reload dati remoti → TRUNCATE prima di load

**Quando**: dopo `supabase start` o `supabase db reset` devo caricare dati remoti
**Fare**: TRUNCATE tutte le tabelle (auth + public + storage) con `session_replication_role = replica` PRIMA di `psql -f dump.sql`
**Perché**: la migration `20260302170000_domain_data_snapshot.sql` carica dati che collidono col dump remoto → errori "duplicate key". Sequenza: truncate → load dump → `npm run local:admin:bootstrap`

### BE-7: OpenAI reasoning → effort "low" per unified_crm_answer

**Quando**: tocco il parametro `reasoning` nella Edge Function `unified_crm_answer`
**Fare**: MAI usare `effort: "medium"` — il contesto CRM completo è troppo grande e il modello esaurisce i token nel ragionamento, producendo output vuoto (502). Usare `effort: "low"`. Le altre EF (annual, historical, cash inflow) possono tenere "medium" perché il loro contesto è pre-aggregato e piccolo.
**Perché**: gpt-5.2 e gpt-5-mini con reasoning medium + snapshot CRM intero → 20-30s di thinking → output_text vuoto → 502

### BE-8: Supabase project ref → NON usare il vecchio

**Quando**: deployo Edge Functions con `npx supabase functions deploy`
**Fare**: usare `--project-ref qvdmzhyzpyaveniirsmo`, NON il vecchio `dfrrigmjsvcsdhgqtikz`
**Perché**: il progetto è stato ricreato, il vecchio ref dà 403

### WF-7: Dopo push → controlla CI autonomamente

**Quando**: ho appena fatto `git push`
**Fare**: SEMPRE controllare il CI con `gh run list --limit 1` + `gh run view <id> --log-failed` SENZA aspettare che l'utente mandi screenshot. Se fallisce, fixare e re-pushare autonomamente.
**Perché**: l'utente non deve fare da intermediario tra me e il CI. Devo controllare i log da solo, ogni volta, subito dopo il push.

### WF-8: Business date = dateTimezone helper, mai toISOString().slice

**Quando**: scrivo `new Date().toISOString().slice(0,10)` o
`.toISOString().split("T")[0]` per ottenere una data di business, oppure
`new Date("YYYY-MM-DD")` per parsare una data di business
**Fare**: usare `todayISODate()` o `toISODate(date)` dal modulo
`dateTimezone` (`src/lib/dateTimezone.ts` client, `_shared/dateTimezone.ts` EF).
Mai convertire una business date string in `Date` senza semantica esplicita.
**Perché**: `toISOString()` converte in UTC prima di estrarre — data
sbagliata tra 00:00 e 02:00 CEST. `new Date("YYYY-MM-DD")` interpreta come
UTC midnight — giorno sbagliato in `Europe/Rome` nella stessa finestra.

---

## Dominio Triggers

### DOM-1: Modello fiscale = CASSA, non competenza

**Quando**: vedo calcolo base imponibile forfettaria
**Fare**: verificare che usi `payments` (status=ricevuto, payment_date), NON `services` (service_date)
**Perché**: regime forfettario = principio di cassa (Art. 1 commi 54-89, L. 190/2014)

### DOM-2: Forfettario ≠ regime ordinario

**Quando**: propongo feature fiscali (deducibilità, IVA, costi deducibili)
**Fare**: FERMARMI e verificare se ha senso nel forfettario
**Perché**: nel forfettario le spese NON si deducono individualmente — il coefficiente di redditività le assorbe. No IVA, no deduzioni singole.

### DOM-3: FatturaPA XML → schema XSD + Aruba

**Quando**: tocco la generazione XML FatturaPA (`invoiceDraftXml.ts`)
**Fare**: verificare conformità allo schema XSD FPR12 v1.2.3 e compatibilità col flusso Aruba PEC. I campi critici sono: DatiTrasmissione (CF intermediario Aruba), CedentePrestatore (RF19), DettaglioLinee (IVA 0% N2.2), DatiPagamento (MP05 bonifico). Bollo escluso dall'XML (gestito da Aruba).
**Perché**: Aruba scarta silenziosamente XML non conformi allo schema, senza dare errori chiari. Un campo mancante o malformato blocca l'invio della fattura.

### DOM-4: Stato semantico di dominio ≠ lunghezza array UI

**Quando**: una vista deriva uno stato business (es. primo anno, step workflow, completezza) da condizioni tipo `items.length === 0`
**Fare**: verificare se il dominio ha elementi "sempre presenti" o low-priority filler; se sì, introdurre un flag esplicito nel modello (`isFirstYear`, `isDegraded`, ecc.) e usare quello nella UI
**Perché**: nel refactor fiscale 2026-04-02 le low-priority deadlines (bollo/dichiarazione) esistono sempre, quindi `deadlines.length === 0` non può più significare "primo anno". La UI avrebbe mostrato semantica falsa pur con calcolo corretto.

### DOM-5: Fiscale due layer → check entrambi

**Quando**: aggiungo feature fiscali, modifico deadline, dashboard o promemoria
**Fare**: verificare ENTRAMBI i layer: 1) stima (fiscalModel, fiscalDeadlines) 2) realtà (fiscal_declarations, fiscal_obligations, F24). Un consumer deve usare `buildFiscalRealityAwareSchedule()` per il merge, MAI riscrivere la logica inline. Se tocco il layer stima, verificare che il read model produce output coerente. Se tocco il layer realtà, verificare che il fallback estimated funzioni ancora.
**Perché**: il sistema ha 2 fonti fiscali — stime CRM e dati reali dal commercialista. Se una feature legge solo una delle due, mostra dati parziali o contraddittori. Phase 1 ha anche un'inconsistenza nota: dashboard mostra obblighi reali, promemoria automatici usano ancora le stime (Phase 2 follow-up).

---

## Config Triggers

### CFG-1: Nuova configurazione → 3 file obbligatori

**Quando**: aggiungo un campo a `ConfigurationContextValue`
**Fare**:
1. `defaultConfiguration.ts`
2. `SettingsPage.tsx`
3. `docs/architecture.md` sezione Settings

### CFG-2: BusinessProfile → merge defaults safe

**Quando**: modifico `businessProfile` in `defaultConfiguration.ts` o nel merge logic di Settings
**Fare**: verificare che il merge config→defaults non sovrascriva campi utente con valori vuoti. Il pattern corretto e' deep merge con fallback: ogni campo usa il valore salvato se presente, altrimenti il default. MAI sostituire l'intero oggetto.
**Perché**: un merge naive ha cancellato i dati emittente (P.IVA, IBAN) salvati dall'utente, facendo generare PDF preventivo/bozza fattura senza dati fiscali.

### CFG-3: Flag/prop root -> verificare consumo reale

**Quando**: aggiungo o uso una prop/flag di controllo a livello root (telemetry, feature flag, disable/enable behavior)
**Fare**: verificare che la stessa prop venga consumata nel layer che produce davvero l'effetto e che non venga solo inoltrata a un figlio diverso. Se c'e' un wrapper (`App` -> `CRM` -> `Admin`), controllare TUTTI i passaggi.
**Perché**: `disableTelemetry` era gia' forzato sul componente `Admin`, ma il beacon custom viveva in `CRM.tsx` e continuava a partire. Il flag sembrava attivo, ma non lo era nel punto che contava.

---

## Workflow Triggers

### WF-1: Aggiorno development-continuity-map.md → aggiorna indice

**Quando**: aggiungo `## Update`, Structural Section o Changelog
**Fare**: aggiornare Navigation Map in cima + `Last updated:`
**Perché**: senza indice, il documento da 1100+ righe è innavigabile

### WF-2: CI prettier fail su file da subagent

**Quando**: file creati da Agent tool non passano prettier in CI
**Fare**: `npx prettier --check` sui file nuovi PRIMA del push
**Perché**: lint-staged formatta solo i file staged, i subagent possono avere formatting diverso

### WF-3: Destructuring param → verificare completezza

**Quando**: aggiungo parametro opzionale a funzione con destructuring
**Fare**: verificare che sia presente ANCHE nella destrutturazione, non solo nel tipo
**Perché**: `buildUnifiedCrmReadContext` aveva `suppliers?` nel tipo ma mancava nella destrutturazione → ReferenceError

### WF-4: Aggiorno file di sistema → sweep incrociata OBBLIGATORIA

**Quando**: modifico uno qualsiasi tra: `memory/*.md`, `.claude/rules/learning.md`, `CLAUDE.md`, `.claude/rules/*.md`
**Fare**: PRIMA di dichiarare "fatto", verificare che TUTTI gli altri file di sistema siano coerenti:
- Riferimenti a file: esistono ancora? path corretto?
- Formati descritti nelle istruzioni: corrispondono al formato reale del file?

### WF-5: E2E test → validano il sistema, non si adattano

**Quando**: un E2E test fallisce dopo un mio cambiamento
**Fare**: verificare PRIMA se il sistema produce il valore corretto (query DB, screenshot). Se sì, il test era sbagliato — correggi il test. Se no, il mio codice ha un bug — correggi il codice.
**Perché**: i test servono a verificare il sistema corretto. Adattare i test per farli passare senza capire la causa nasconde bug reali (es. calculations.smoke aspettava 644€ ma il sistema produceva correttamente 653,50€ da sempre).

### WF-6: Commit codice → docs+memoria NELLO STESSO commit

**Quando**: sto per eseguire `git commit` su codice prodotto
**Fare**: PRIMA di committare, verificare se servono aggiornamenti a `docs/`, `memory/*.md`, `.claude/rules/learning.md`. Se si', includerli nello STESSO `git add` + `git commit`. MAI fare prima il commit di codice e poi un commit separato "docs: align...".
**Perché**: commit separati per docs causano disallineamenti sistematici. L'utente ha dovuto correggermi più volte perché dimenticavo docs/memoria dopo il codice. La regola è ora anche in `.claude/rules/session-workflow.md` (COMMIT GATE).

### WF-11: Full E2E rossa dopo evoluzione UI -> prima triage, poi patch mirata

**Quando**: una full suite E2E fallisce in molti moduli subito dopo cambiamenti UI/label/flow
**Fare**: NON rilanciare la suite intera alla cieca. Prendere 1 fail rappresentativo per modulo, confrontarlo con la UI reale e capire se e' drift della spec (label rinominata, selector ambiguo, flow cambiato, responsive) o bug prodotto. Correggere prima i test obsoleti, poi rilanciare la full suite una sola volta.
**Perché**: evita di bruciare tempo/token su rerun inutili e separa rapidamente regressioni vere da test fragili. Oggi `tasks`, `services`, `payments`, `full-ui-audit` e `ai-annual-real` erano rossi per selector/heading obsoleti, non per regressioni del sistema.

### WF-12: Guardrail shell -> non usare `&& ... || true` per hook critici

**Quando**: scrivo un comando shell in hook/CI che esegue un controllo solo se
un file e' staged o se un `grep -q` fa match
**Fare**: usare `if ...; then controllo; fi` oppure raggruppare i comandi, senza
chiudere con `|| true` che assorbe anche il failure del controllo reale
**Perché**: `.husky/pre-commit` sembrava validare `check-learning-integrity`,
ma il pattern `grep -q ... && node ... || true` lasciava passare comunque i
failure veri dello script

### WF-9: Business date UI -> smoke cross-timezone reale

**Quando**: valido una UI che mostra scadenze, "oggi", giorni mancanti o date
di business (`DashboardDeadlineTracker`, badge scaduti, date-only operative)
**Fare**: aggiungere almeno uno smoke che blocca `Date.now()` e gira la stessa
pagina in due timezone browser diverse (`Europe/Rome` e una timezone non-UE,
es. `America/New_York`). Gli assert devono colpire il valore business vero
(data mostrata, delta giorni), non dettagli di layout incidentalmente presenti
o assenti.
**Perché**: un codice che sembra corretto in locale puo' ancora dipendere dal
timezone del browser quando fa `new Date("YYYY-MM-DD")` o formatta date-only.
La prova reale e' "stesso output business in timezone diverse", non "passa nel
mio browser".

### WF-10: Fix timezone -> sweep tutti i consumer del date-only

**Quando**: correggo un modello o helper che produce business-date `YYYY-MM-DD`
o deadline fiscali
**Fare**: grep e verificare ANCHE i consumer che:
- leggono `currentYear` con `new Date().getFullYear()`
- formattano `deadline.date` con `new Date("YYYY-MM-DD")`
- generano `due_date` con `new Date(dateOnly + "T00:00:00").toISOString()`
- esistono in runtime diversi (client + `supabase/functions/_shared`)
**Perché**: sistemare solo il modello non basta. Wrapper UI, card di dettaglio
e Edge Functions possono continuare a slittare su boundary anno/giorno o
scrivere timestamp sbagliati pur usando dati gia' bonificati a monte.

---

## Checklist di auto-verifica (prima di dire "fatto")

**Ogni fix**: `typecheck` + `lint` + `build` → tutti 0 errori?
**Ogni modifica DB**: migration creata? types.ts aggiornato? tipi TS = DB?
**Ogni modifica UI lista**: MobilePageTitle? Filtri mobile (Sheet)? ResizableHead?

---

## Template per nuovi trigger

```markdown
### XX-N: [Breve descrizione]

**Quando**: [situazione che attiva il trigger]
**Fare**: [azione automatica]
**Perché**: [conseguenza se non si fa]
```

---

*File di auto-apprendimento — NON duplicare AGENTS.md*
