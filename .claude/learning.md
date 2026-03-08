# Claude Auto-Correction System

> **Questo file NON è documentazione**. È il mio sistema di apprendimento
> automatico. Ogni entry è un trigger che mi costringe a comportarmi
> diversamente.

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
| **Backend**  | BE-1  | Edge Function modificata → deploy manuale |
| **Backend**  | BE-2  | Nuova Edge Function → config.toml!       |
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
| **Workflow** | WF-6  | Commit codice → docs+memoria NELLO STESSO commit |
| **UI**       | UI-7  | Componente desktop con props → verificare mobile |

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

---

## Config Triggers

### CFG-1: Nuova configurazione → 3 file obbligatori

**Quando**: aggiungo un campo a `ConfigurationContextValue`
**Fare**:
1. `defaultConfiguration.ts`
2. `SettingsPage.tsx`
3. `docs/architecture.md` sezione Settings

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

**Quando**: modifico uno qualsiasi tra: `memory/*.md`, `.claude/learning.md`, `CLAUDE.md`, `.claude/rules/*.md`
**Fare**: PRIMA di dichiarare "fatto", verificare che TUTTI gli altri file di sistema siano coerenti:
- Riferimenti a file: esistono ancora? path corretto?
- Formati descritti nelle istruzioni: corrispondono al formato reale del file?

### WF-5: E2E test → validano il sistema, non si adattano

**Quando**: un E2E test fallisce dopo un mio cambiamento
**Fare**: verificare PRIMA se il sistema produce il valore corretto (query DB, screenshot). Se sì, il test era sbagliato — correggi il test. Se no, il mio codice ha un bug — correggi il codice.
**Perché**: i test servono a verificare il sistema corretto. Adattare i test per farli passare senza capire la causa nasconde bug reali (es. calculations.smoke aspettava 644€ ma il sistema produceva correttamente 653,50€ da sempre).

### WF-6: Commit codice → docs+memoria NELLO STESSO commit

**Quando**: sto per eseguire `git commit` su codice prodotto
**Fare**: PRIMA di committare, verificare se servono aggiornamenti a `docs/`, `memory/*.md`, `.claude/learning.md`. Se sì, includerli nello STESSO `git add` + `git commit`. MAI fare prima il commit di codice e poi un commit separato "docs: align...".
**Perché**: commit separati per docs causano disallineamenti sistematici. L'utente ha dovuto correggermi più volte perché dimenticavo docs/memoria dopo il codice. La regola è ora anche in `.claude/rules/session-workflow.md` (COMMIT GATE).

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
