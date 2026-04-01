# Architettura Referenti CRM

**Stato del documento:** `canonical`
**Scopo:** fonte primaria per il dominio referenti e le relazioni
`clients + contacts + project_contacts`.
**Quando usarlo:** quando cambiano referenti, clienti, progetti o il loro uso
nel contesto AI.

Data: 2026-03-01
Ultimo aggiornamento: 2026-03-08

## UI Update — Liste Clienti, Referenti e Progetti con Icone Colorate

Le liste sono state arricchite visivamente con icone colorate coerenti:

- **Clienti** (`ClientListContent`): Icone per tipo (Building2, Store, Heart, PartyPopper, Globe)
- **Referenti** (`ContactList`): Icone per ruolo (Crown, Briefcase, Euro, User)  
- **Progetti** (`ProjectListContent`): Icone per categoria (TV, Sparkles, Heart, PartyPopper, Globe)

Scopo: migliorare la scanability visiva e la distinzione tra tipologie/categorie.

Dal 2026-03-08, le icone nelle liste clienti, referenti e fornitori vengono
sostituite dall'avatar Cloudinary quando `logo_url` (clienti/fornitori) o
`photo_url` (referenti) è presente. Il componente `ListAvatar` gestisce il
fallback automatico all'icona originale quando nessuna immagine è caricata.

## Decisione

Per reintrodurre i referenti nel gestionale non abbiamo ripristinato l'intero
modello legacy `companies + contacts + deals` di Atomic CRM.

Abbiamo invece scelto un approccio Pareto e scalabile:

- `clients` resta l'anagrafica azienda/controparte principale del gestionale
- `contacts` torna a essere la risorsa per le persone/referenti
- `contacts.client_id` collega ogni referente al cliente attuale
- `contacts.contact_role` rende esplicito il ruolo operativo/amministrativo/
  fatturazione senza affidarsi solo al testo libero
- `contacts.is_primary_for_client` identifica un solo referente principale per
  cliente
- `project_contacts` e' la join table che collega i referenti ai progetti
- `project_contacts.is_primary` identifica un solo referente primario per
  progetto

## Perche' questa scelta

Ripristinare integralmente `companies` avrebbe reintrodotto due modelli
concorrenti per la stessa entita' di business:

- `clients` nel gestionale custom
- `companies` nel CRM legacy

Questo avrebbe aumentato fragilita', duplicazioni e rischio di incoerenze nei
workflow AI, nei filtri, nelle relazioni e nell'analisi dati.

La scelta adottata mantiene:

- un solo master per aziende/controparti: `clients`
- una sola risorsa persone/referenti: `contacts`
- una relazione pulita e scalabile cliente -> referenti -> progetti

## Scope implementato

- migration DB `20260301213000_reactivate_contacts_for_clients_projects.sql`
- migration DB `20260301234500_harden_contacts_roles_and_primary.sql`
- riattivazione resource `contacts` nel CRM
- nuove schermate contatti: lista, create, edit, show
- sezione referenti nel dettaglio cliente
- sezione referenti nel dettaglio progetto
- collegamento automatico al progetto quando un referente viene creato da un
  progetto
- dialog per collegare un referente cliente gia esistente a un progetto
- toggle coerente del referente primario progetto
- normalizzazione dati lato provider per `contacts` e `project_contacts`
- estensione del read-context AI del launcher unificato con:
  - referenti recenti
  - ruolo strutturato e priorita' esplicita del referente
  - relazioni strutturate cliente -> referenti
  - relazioni strutturate progetto -> referenti
  - relazioni strutturate referente -> progetti
  - servizi individuali per progetto (max 20 per progetto, con description)
  - intent parsing per description servizio (titolo breve) nella domanda utente
  - prompt AI con guida semantica description vs notes

## Update 2026-03-08 — ContactRow extraction + suppliers destructuring fix

- `ContactRow` extracted from `ContactList.tsx` into separate file (code split
  for max-lines compliance). No behavioral change.
- `buildUnifiedCrmReadContext`: added missing `suppliers` destructuring param
  (was causing ReferenceError when building AI snapshot).

## Update 2026-03-04 — Kanban Project View

La lista progetti ha ora un toggle lista/kanban (solo desktop). Il kanban mostra
4 colonne per status con drag-and-drop che aggiorna lo stato del progetto.
Non impatta direttamente i referenti ma cambia la superficie di navigazione
progetti.

## Mappa impatto continuita'

Quando cambia questo dominio, non basta aggiornare solo i componenti UI
`contacts/`.

Le superfici da considerare correlate sono almeno:

- schema e migration Supabase
- `src/components/atomic-crm/types.ts`
- helper dominio `contacts/contactRecord.ts`
- provider Supabase
- `src/components/atomic-crm/root/CRM.tsx`
- `src/components/atomic-crm/root/i18nProvider.tsx`
- `ClientShow` e `ProjectShow`
- `src/lib/ai/unifiedCrmReadContext.ts`
- `src/components/atomic-crm/ai/UnifiedCrmReadSnapshot.tsx`
- `supabase/functions/_shared/unifiedCrmAnswer.ts`
- docs di continuita'

`Settings` non va aggiornata automaticamente per questo dominio.
Va toccata solo se i referenti introducono una regola realmente configurabile
dall'utente; non per semplici relazioni strutturali o perimetri read-only.

## Confini intenzionali di questa fase

Non abbiamo ripristinato:

- `companies`
- `deals`
- `contact_notes`
- task legacy collegati ai contatti legacy

Questa esclusione e' intenzionale. Serve a non perdere controllo del dominio
attuale mentre si reintroduce la capacita' CRM davvero necessaria: gestire
persone associate a clienti e progetti.

## Effetti sul dominio

Esempio corretto:

- cliente: `ASSOCIAZIONE CULTURALE GUSTARE SICILIA`
- referente: `Diego Caltabiano`
- progetti collegati: `Gustare Sicilia`, `Bella tra i Fornelli`

Quindi il referente non sostituisce mai il cliente fiscale.

Da ora in poi il referente va modellato con questa gerarchia:

- cliente fiscale / controparte: `clients`
- persona: `contacts`
- ruolo strutturato della persona: `contact_role`
- qualifica libera eventuale: `title`
- referente principale del cliente: `is_primary_for_client`
- referente primario di uno specifico progetto: `project_contacts.is_primary`

Per questo caso reale, la verifica finale non va fatta su note sparse ma sulla
fonte dati documentale piu autorevole:

- `Fatture/`
- `Fatture/contabilità interna - diego caltabiano/`

Se emerge un conflitto tra appunti storici e queste cartelle, prevale sempre la
relazione cliente `ASSOCIAZIONE CULTURALE GUSTARE SICILIA` -> referente
`Diego Caltabiano`.

## Passi successivi raccomandati

1. Introdurre nel read-context AI anche surface/action deterministiche dedicate ai referenti quando emergera' un bisogno operativo specifico oltre all'analisi read-only.
2. Introdurre un dominio generale `party/suppliers` se l'area fornitori verra'
   modellata come controparte autonoma e non solo come estensione dei clienti.
3. Valutare se riusare una parte del merge legacy di `contacts` solo quando ci
   sara' bisogno reale di deduplica avanzata.

---

## Nota manutenzione 2026-03-02

`ClientFinancialSummary.tsx` ha ricevuto solo una correzione di formattazione
Prettier (whitespace). Nessun cambiamento funzionale al modello clienti/progetti.

## Nota manutenzione 2026-03-04

E' stato aggiunto un flusso cross-cutting "bozza fattura interna" con entry
point anche da:

- `ClientShow`
- `ProjectShow`

## Nota manutenzione 2026-03-06

`ClientFinancialSummary.tsx` semplificato: rimosso il doppio path che
calcolava km dai servizi e filtrava `spostamento_km` dalle spese. Ora usa una
singola fonte (tutte le spese, incluse le auto-create dal trigger
`sync_service_km_expense`), allineandosi alla stessa formula di
`project_financials.expense_view`. Rimossa dipendenza da
`useConfigurationContext` (non più necessaria) e i campi `total_km`,
`total_km_cost` dal tipo `ProjectFinancialRow`.

Il flusso risponde alla domanda "quanto mi deve ancora questo
cliente/progetto?" e genera un PDF di supporto.

Semantica:

- aggrega servizi non fatturati (senza `invoice_ref`) + km reimbursement
- deduce solo pagamenti `status === "ricevuto"` (non `in_attesa`/`scaduto`)
- rimborsi (`payment_type === "rimborso"`) hanno segno invertito
- `ProjectShow` carica i pagamenti con `useGetList<Payment>`
- `ClientFinancialSummary` ora legge un singolo record dalla view
  `client_commercial_position` via `useGetOne` — zero ricalcolo in React,
  nessuna aggregazione di 4 fetch separati
- il pulsante "Genera bozza fattura" compare solo se
  `hasInvoiceDraftCollectableAmount()` ritorna true
- non scrive su DB (solo anteprima/download PDF)

Impatto architetturale:

- nessuna nuova tabella o join nel dominio referenti
- nessuna modifica a `contacts` / `project_contacts`
- continuita' garantita mantenendo il boundary:
  - `clients` = controparte fiscale
  - `contacts` = persone referenti
  - invoicing draft = tool operativo interno separato dal modello relazionale

## Nota manutenzione 2026-03-05

Aggiunto `QuickClientEmailDialog` (`clients/QuickClientEmailDialog.tsx`):
dialog inline per aggiungere l'email a un cliente esistente che ne e' privo.

Usato in `QuoteShowActions` quando il preventivo ha un client_id valido ma
`client.email` e' null/vuoto. Non modifica il dominio relazionale
(contacts/project_contacts): aggiorna solo il campo `email` sulla tabella
`clients` via `useUpdate`.

Impatto architetturale: nessuno — nessuna nuova tabella, join o relazione.

## Mobile Card Style

Titolo principale nelle card mobile lista: `text-base font-bold` (clients, contacts, projects).

## AI Snapshot Financial Views (2026-04-01)

buildUnifiedCrmReadContext now receives pre-computed financial data from DB views (project_financials, client_commercial_position) instead of calculating from raw tables. The snapshot shape for clientFinancials includes totalExpenses. No relational changes.
