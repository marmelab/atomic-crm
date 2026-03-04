# Documentation Map

Last updated: 2026-03-04

## Purpose

Questa directory non e' un archivio indistinto.

Per ridurre errori di lettura, ogni documento deve cadere in una di queste
categorie:

- `canonical`: fonte operativa da allineare al codice
- `working`: handoff/backlog per continuita' implementativa
- `reference`: analisi o casi reali utili, ma non fonte primaria del prodotto
- `historical`: documenti di decisione superata o design iniziale, da leggere
  solo con contesto

## Pareto Rules

- una regola di business deve avere una sola casa canonica
- i documenti storici non devono sembrare fonte di verita' attuale
- il workflow supportato di sviluppo/validazione locale usa il runtime reale
  Supabase, non la vecchia demo FakeRest
- il sistema viene prima dei test:
  - prima si rende il dominio reale coerente
  - poi i test verificano che il comportamento corretto non regredisca
- i dati locali di dominio non vanno inventati in fixture hardcoded se la fonte
  di verita' esiste gia':
  - prima `Fatture/` (XML fatture emesse e ricevute)
  - poi `Fatture/contabilità interna - diego caltabiano/` come arricchimento
    del caso Diego/Gustare
  - poi portale Aruba Fatturazione Elettronica per date di incasso esatte
    (originariamente codificate in `ARUBA_PORTAL_TRUTH`; ora consolidate
    nella migration snapshot `20260302170000_domain_data_snapshot.sql`)
- fixture o bootstrap hardcoded di dominio sono solo debito tecnico
  temporaneo, non una seconda fonte di verita'
- se il comportamento e' gia spedito:
  - il codice e le migration sono la verita' operativa
  - i documenti `canonical` vanno aggiornati nello stesso passaggio
- se un file non e' canonico, deve dichiararlo chiaramente

## Current Continuity Intent

Per la prossima fase del progetto, la continuita' va letta con questo ordine:

1. fonte di verita' reale
2. rebuild locale del sistema
3. correzione della semantica e delle relazioni di dominio
4. test come verifica finale

Tradotto in pratica:

- prima si ricostruisce il database locale partendo da `Fatture/`
- poi si arricchisce dal materiale di
  `Fatture/contabilità interna - diego caltabiano/`
- poi si correggono le superfici applicative che leggono quei dati
- solo dopo si scrivono o si aggiornano test E2E/smoke

Il fronte piu' fragile da trattare con questa logica e' la semantica
finanziaria, che oggi va ancora separata meglio tra:

- documento emesso/ricevuto
- stato da incassare/pagare
- movimento di cassa effettivo

## Automation Guardrails

Il repository non si affida piu' solo alla disciplina manuale.

Prima dei commit gira anche un controllo automatico di continuita':

- `scripts/check-continuity.mjs`

Questo hook verifica che le modifiche su codice prodotto, schema, AI,
document-import e configurazione condivisa si portino dietro almeno i documenti
o le superfici companion minime richieste.

## Agent Orchestration Files

Anche i file di orchestrazione agentica hanno una gerarchia esplicita:

- `AGENTS.md`
  - fonte canonica condivisa per workflow e regole di progetto
- `CLAUDE.md`
  - wrapper complementare per Claude Code
  - deve importare `AGENTS.md`
  - deve contenere solo delta minimi specifici di Claude

Questo evita di mantenere due prompt completi che poi divergono nel tempo.

## Two AI Layers

Nel progetto esistono due piani diversi che non vanno confusi:

- `agent runtime`
  - riguarda gli agenti di sviluppo che lavorano sul repo
  - vive in `AGENTS.md`, `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`
  - usa `progress.md` e `learnings.md` solo come archivio operativo/storico
- `product runtime`
  - riguarda l'AI interna del CRM vista dall'utente finale
  - vive in `src/components/atomic-crm/ai/`, `src/lib/semantics/`,
    `supabase/functions/`, `docs/architecture.md`,
    `docs/historical-analytics-handoff.md`,
    `docs/historical-analytics-backlog.md`,
    `docs/contacts-client-project-architecture.md`

Regola pratica:

- se cambia come lavora l'agente sul repo, aggiornare i file di orchestrazione
- se cambia la chat AI del CRM, i suoi modelli, tool, route, handoff o limiti,
  aggiornare codice prodotto + docs `canonical/working`
- i due piani si toccano solo nella continuita' di sviluppo, non nella
  semantica funzionale del prodotto

## Required Structure For New Docs

Ogni nuovo documento importante dovrebbe dichiarare all'inizio, in forma breve:

- `Stato del documento`
  - `canonical`, `working`, `reference` o `historical`
- `Scopo`
- `Quando usarlo`
- `Quando NON usarlo`
- `File/moduli correlati`

Questo riduce gli errori dell'AI e impedisce che un documento storico venga
letto come fonte primaria.

## Reading Order For AI Or New Sessions

1. `docs/README.md`
2. `docs/development-continuity-map.md`
3. `docs/local-truth-rebuild.md`
4. `docs/historical-analytics-handoff.md`
5. `docs/architecture.md`
6. `docs/contacts-client-project-architecture.md`
7. `docs/data-import-analysis.md`
8. `Gestionale_Rosario_Furnari_Specifica.md`

## Canonical

### `docs/development-continuity-map.md`

Fonte primaria per:

- reading order
- integration checklist
- sweep obbligatoria di moduli, pagine, modali, helper, provider e function
- regola `Settings si / Settings no`

### `docs/architecture.md`

Fonte primaria per:

- stato implementato ad alto livello
- schema e risorse correnti
- mappa moduli e pagine

### `docs/local-truth-rebuild.md`

Fonte primaria per:

- gerarchia di verita' del rebuild locale del dominio
- `ARUBA_PORTAL_TRUTH` (stato incasso fatture 2023-2025)
- `ARUBA_CLIENT_REGISTRY` (anagrafica clienti completa)
- regola di risoluzione runtime per l'import AI
- fatture ricevute e semantica finanziaria transitoria

### `docs/contacts-client-project-architecture.md`

Fonte primaria per:

- dominio `clients + contacts + project_contacts`
- decisioni Pareto sui referenti

## Working

### `docs/historical-analytics-handoff.md`

Documento di ripartenza operativa.

Serve per:

- capire dove riprendere il lavoro
- ricordare vincoli e stop-line
- evitare di riaprire decisioni gia prese

Non e' la fonte primaria del prodotto o del dominio.

Se devi leggere solo il minimo utile:

- `Goal`
- `Current AI Execution Policy`
- `How To Resume In A New Chat`
- `Mandatory Integration Checklist For New Features`
- `Current Explicit Next Slice`
- `Known Risks / Open Edges`

### `docs/historical-analytics-backlog.md`

Log evolutivo e backlog operativo.

Serve per:

- vedere cosa e' gia stato chiuso
- vedere i passi ancora aperti

Non va usato da solo per inferire lo stato canonico del sistema.

Se devi leggere solo il minimo utile:

- `Current State`
- `First Open Priority`
- `Stop Line For This Phase`
- `Priority 1..5`

## Reference

### `docs/data-import-analysis.md`

Caso reale Diego/Gustare: servizi, tariffe, acconti, CSV e mapping operativo.

Fonte primaria solo per:

- dettaglio dei servizi, fogli contabili e acconti Diego/Gustare
- tariffe vecchie e nuove, mapping al DB schema

Per la gerarchia di verita' generale, lo stato incasso e l'anagrafica clienti
completa usare `docs/local-truth-rebuild.md`. La fonte dati suprema resta la
cartella repo-root `Fatture/`; al suo interno
`Fatture/contabilità interna - diego caltabiano/` e' la fonte piu autorevole
per attribuire correttamente Diego Caltabiano come referente operativo di
`ASSOCIAZIONE CULTURALE GUSTARE SICILIA`.

### `Gestionale_Rosario_Furnari_Specifica.md`

Visione prodotto e bootstrap originario del progetto.

Va letto come:

- fonte di intenti e vincoli di business
- non come fotografia perfetta dello stato implementato attuale

Se una parte e' gia stata implementata diversamente, la fonte operativa resta il
codice piu i documenti `canonical`.

## Historical

### `docs/design-fase2.md`

Design iniziale di trasformazione dal fork Atomic CRM.

Valore attuale:

- storico di scelte visuali e di trasformazione

Non e' fonte canonica del sistema attuale.

### `docs/analisi-pulizia-moduli.md`

Analisi storica dei moduli legacy di Atomic CRM.

Valore attuale:

- capire perche' certi moduli sono stati rimossi o adattati

Non e' fonte canonica dello stato corrente.

## Legacy Archives Outside `docs/`

### `progress.md`

Log cronologico molto dettagliato delle sessioni.

Valore attuale:

- audit storico
- ricostruzione della sequenza decisionale
- ricerca mirata di una feature o data specifica

Non va letto come punto di ingresso primario di una nuova sessione.

### `learnings.md`

Archivio dei pattern emersi sessione dopo sessione.

Valore attuale:

- deep archive di errori gia incontrati
- recupero di pattern operativi specifici
- supporto quando serve spiegare perche' una regola e' nata

Non va letto in modo lineare all'inizio di ogni chat.
Le regole ancora vive devono essere promosse nei documenti `canonical` o in
`.claude/rules/`.

## When Docs Conflict

Ordine di priorita':

1. schema DB / migration / Edge Functions / codice reale
2. documenti `canonical`
3. documenti `working`
4. documenti `reference`
5. documenti `historical`

Se trovi un conflitto tra livello 1 e livello 2:

- correggere subito la documentazione canonica

Se trovi un conflitto tra livello 2 e 3/4/5:

- non toccare il codice
- chiarire il documento non canonico o aggiungere una nota di superamento
