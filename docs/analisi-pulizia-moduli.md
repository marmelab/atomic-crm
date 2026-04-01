# Analisi Moduli Atomic CRM — Decisioni di Pulizia

**Stato del documento:** `historical`
**Scopo:** spiegare le decisioni iniziali di pulizia/adattamento del fork
Atomic CRM.
**Quando NON usarlo da solo:** per descrivere lo stato attuale del sistema.
Alcune decisioni qui sono state superate, per esempio la riattivazione di
`contacts` come dominio referenti. Per lo stato attuale usare
`docs/README.md`, `docs/architecture.md` e
`docs/contacts-client-project-architecture.md`.

Esempi di punti superati:

- `contacts` non e' piu una valutazione aperta: e' stato riattivato
- `project_contacts` ora esiste
- alcune note su resource registrate in `CRM.tsx` non vanno lette come stato
  corrente

**Data:** 2026-02-26
**Stato storico originale:** In attesa di decisione utente

Questo documento analizza in dettaglio ogni modulo ereditato da Atomic CRM
che non è nella specifica del gestionale. Per ciascuno: cosa fa, a cosa serve,
cosa dipende da lui, e le opzioni concrete (tenere / adattare / rimuovere).

---

## 1. Companies (Aziende)

### Cosa fa

Gestione completa delle aziende: nome, logo, sito web, LinkedIn, telefono,
indirizzo, settore, dimensione, P.IVA, fatturato. Vista a griglia con card,
filtri per dimensione/settore, dettaglio con 3 tab (Attività, Contatti, Deals).

### File: 14 file in `src/components/atomic-crm/companies/`

`CompanyList`, `CompanyCreate`, `CompanyEdit`, `CompanyShow`, `CompanyInputs`,
`CompanyCard`, `CompanyAvatar`, `CompanyAside`, `CompanyEmpty`, `CompanyListFilter`,
`GridList`, `AutocompleteCompanyInput`, `sizes.ts`, `index.ts`

### Tabella DB: `companies`

Colonne: name, sector, size, linkedin_url, website, phone_number, address,
zipcode, city, country, sales_id, logo (JSONB), tax_identifier, revenue, ecc.

### Chi lo usa

- **Contacts**: ogni contatto ha `company_id` → link all'azienda
- **Deals**: ogni deal ha `company_id` → link all'azienda
- **Activity Log**: logga la creazione di aziende
- **AutocompleteCompanyInput**: usato nei form di contatti e deals per selezionare/creare azienda inline

### Chi dipende da lui

La **cancellazione di un'azienda** fa CASCADE DELETE su tutti i contatti e deals collegati.

### Stato attuale nel gestionale

- **Non è nella navigazione** (rimosso dal Header nella sessione 7)
- **La risorsa è ancora registrata** in CRM.tsx (`<Resource name="companies" />`)
- Nel gestionale, il concetto di "azienda" è stato fuso in "Cliente" (tabella `clients`)

### Opzioni

1. **Rimuovere UI + tenere tabella** — La tabella `companies` è usata dai moduli
   originali (contacts, deals). Se rimuoviamo anche quelli, la tabella diventa inutile.
2. **Rimuovere tutto** — Se rimuoviamo contacts/deals originali (sostituiti dai nostri
   clients/projects), companies non serve più a nessuno.
3. **Tenere** — Non ha senso: il gestionale ha già il modulo Clienti che lo sostituisce.

### Rischio rimozione: BASSO

Nessun modulo del gestionale (clients, projects, services, quotes, payments, expenses)
referenzia companies. La dipendenza è solo interna ai moduli Atomic CRM originali.

---

## 2. Tasks (Attività / To-Do)

### Cosa fa

Sistema di task management legato ai contatti. Ogni task ha: descrizione, data scadenza,
tipo (Email, Demo, Meeting, Follow-up, Call, ecc.), contatto associato, utente assegnato.

**Feature principali:**

- Filtri intelligenti per scadenza: Scaduti, Oggi, Domani, Questa settimana, Più tardi
- Checkbox per completare task (spariscono dopo 5 minuti)
- Reschedule rapido: "Domani" / "Prossima settimana" con un click
- Aggiorna `last_seen` del contatto quando si aggiunge un task
- Versione mobile con bottom sheet dedicati

### File: 10 file in `src/components/atomic-crm/tasks/`

`Task`, `TasksIterator`, `TaskFormContent`, `taskFilters`, `TasksListContent`,
`AddTask`, `TaskCreateSheet`, `TaskEdit`, `TaskEditSheet`, `MobileTasksList`

### Tabella DB: `tasks`

Colonne: contact_id (FK), type, text, due_date, done_date, sales_id.
Trigger auto-set sales_id.

### Chi lo usa

- **Contacts**: mostra i task nella scheda contatto (`ContactAside`, `ContactTasksList`)
- **Dashboard** (vecchia, ora rimossa): mostrava i task categorizzati per scadenza
- **MobileNavigation**: pulsante rapido "crea task" nella barra mobile
- **View `contacts_summary`**: conta i task per contatto (`nb_tasks`)

### Chi dipende da lui

- `TasksListFilter.tsx` e `TasksListEmpty.tsx` sono ancora usati (importati da
  `contacts/ContactTasksList.tsx`)
- La view `contacts_summary` include il conteggio task

### Stato attuale nel gestionale

- **Non è nella navigazione** (non c'è nel Header)
- **La risorsa è registrata** in CRM.tsx
- **La dashboard lo ha rimosso** (sessione 10 — dashboard finanziaria senza task)
- Nel gestionale, le "scadenze" sono gestite da: pagamenti (date scadenza),
  servizi (date lavori), preventivi (date eventi). Non ci sono task generici.

### Opzioni

1. **Rimuovere tutto** — Il gestionale non prevede task generici. Le scadenze
   sono tracciate nei moduli specifici (pagamenti in attesa, prossimi lavori nella dashboard).
2. **Adattare come promemoria** — Potrebbe essere utile avere un sistema di
   promemoria rapidi ("Chiamare cliente X domani", "Mandare preventivo a Y").
   I task sono già pronti per questo uso e hanno un'ottima UX mobile.
3. **Tenere com'è** — Funzionerebbe, ma è legato ai `contacts` originali
   (non ai `clients` del gestionale), quindi servirebbe un adattamento.

### Rischio rimozione: MEDIO

Se si rimuovono i task, bisogna anche pulire:

- La view `contacts_summary` (rimuovere il join con tasks)
- I componenti `TasksListFilter` e `TasksListEmpty` (usati da contacts)
- Il pulsante task nella navigazione mobile
- Il trigger `set_task_sales_id_trigger`

### Valore potenziale: MEDIO-ALTO

L'idea di "promemoria rapidi" è utile per un freelance. "Chiamare Diego domani",
"Mandare fattura venerdì". La UX con reschedule veloce e filtri per scadenza è
ben fatta. Ma richiederebbe adattamento (collegare a `clients` anziché `contacts`).

---

## 3. Notes (Note)

### Cosa fa

Sistema di note testuali con allegati, collegato a contatti e deals.
Due risorse separate: `contact_notes` e `deal_notes`.

**Feature principali:**

- Testo con rendering Markdown (link, liste, blockquote)
- Allegati file (upload su Supabase Storage, bucket `attachments`)
- Preview immagini in griglia 4 colonne
- Status note (warm/cold) che si propaga al contatto
- Troncamento intelligente con "Leggi tutto" / "Mostra meno"
- Versione mobile con pagina dedicata per singola nota
- Date relative ("2 ore fa")

### File: 14 file in `src/components/atomic-crm/notes/`

`Note`, `NoteCreate`, `NoteCreateSheet`, `NoteInputs`, `NoteEditSheet`,
`NoteShowPage`, `NotesIterator`, `NotesIteratorMobile`, `NoteAttachments`,
`AttachmentField`, `StatusSelector`, `foreignKeyMapping`, `utils`, `index`

### Tabelle DB: `contact_notes` + `deal_notes`

Colonne: contact_id/deal_id, text, date, sales_id, status (solo contact_notes),
attachments (JSONB array con src, title, path, type).
Trigger: auto-set sales_id, log in activity on create.

### Chi lo usa

- **Contacts**: note nella scheda contatto (tab "Note"), creazione inline
- **Deals**: note nel dialog deal (sezione in basso)
- **Activity Log**: logga la creazione di note
- **MobileNavigation**: pulsante rapido "crea nota" nella barra mobile
- **Supabase Storage**: bucket `attachments` per i file

### Stato attuale nel gestionale

- **Non è esposto direttamente** — le note sono sempre embedded in contatti/deals
- Nel gestionale, i `clients` hanno un campo `notes` (testo semplice), e ogni modulo
  (progetti, servizi, pagamenti, spese, preventivi) ha il suo campo `notes`.

### Opzioni

1. **Rimuovere tutto** — I campi `notes` (testo) nei moduli del gestionale coprono
   il caso d'uso base. Non servono note multiple con allegati.
2. **Adattare per i Clienti** — Aggiungere un sistema di note multiple ai clienti
   del gestionale. Utile per tenere storico conversazioni: "22/02 — Chiamato,
   vuole preventivo entro venerdì", "25/02 — Inviato preventivo, attende risposta".
   Ma è un lavoro significativo (cambiare FK da contacts a clients).
3. **Tenere com'è** — Funziona solo con contacts/deals originali.

### Rischio rimozione: BASSO

Nessun modulo del gestionale usa le note Atomic CRM. I campi `notes` nei nostri
moduli bastano per appunti semplici.

### Valore potenziale: MEDIO

Lo storico note con date e allegati è più potente del semplice campo testo.
Un freelance potrebbe voler allegare contratti, bozze, foto del lavoro.
Ma il campo `notes` nei moduli attuali copre l'80% del caso d'uso.

---

## 4. Activity Log (Registro Attività)

### Cosa fa

Feed cronologico delle attività recenti nel CRM. Mostra in ordine temporale:
chi ha fatto cosa e quando.

**Eventi tracciati:**

- Azienda creata
- Contatto creato
- Nota contatto creata
- Deal creato
- Nota deal creata

**NON traccia:** modifiche, cancellazioni, task, login.

### Come funziona

**Non c'è una tabella activity dedicata.** Il log è calcolato al volo con 5 query
parallele (companies, contacts, contact_notes, deals, deal_notes), poi merge
e ordinamento client-side. C'è un FIXME nel codice: "Replace with a server-side
view or a custom API endpoint" per motivi di performance.

### File: 9 file in `src/components/atomic-crm/activity/`

`ActivityLog`, `ActivityLogIterator`, `ActivityLogContext`,
`ActivityLogNote`, `ActivityLogCompanyCreated`, `ActivityLogContactCreated`,
`ActivityLogDealCreated`, `ActivityLogContactNoteCreated`, `ActivityLogDealNoteCreated`

### Chi lo usa

- **CompanyShow**: tab "Attività" nella scheda azienda
- **Dashboard** (vecchia, rimossa): aveva `DashboardActivityLog`
- **DataProvider**: metodo custom `getActivityLog()` in entrambi i provider

### Stato attuale nel gestionale

- **Non è nella navigazione**
- **La dashboard non lo usa più** (rimpiazzata con dashboard finanziaria)
- L'unico punto dove appare è **CompanyShow** — che stiamo valutando di rimuovere

### Opzioni

1. **Rimuovere tutto** — Non serve. Il gestionale è single-user, non ha bisogno
   di sapere "chi ha fatto cosa". La dashboard finanziaria copre il monitoraggio.
2. **Adattare per il gestionale** — Creare un activity log per le entità del
   gestionale (clienti, progetti, pagamenti). Ma per un single-user è overengineering.
3. **Tenere com'è** — Inutile: traccia solo entità Atomic CRM (companies, contacts, deals).

### Rischio rimozione: MOLTO BASSO

Nessun modulo del gestionale lo usa. Non ha tabella DB dedicata da pulire.
Basta rimuovere i file e il metodo `getActivityLog()` dai data provider.

### Valore potenziale: BASSO

Per un utente singolo, un activity log non aggiunge valore. Sai già cosa hai
fatto perché sei l'unico a usare il sistema.

---

## 5. Tags (Etichette)

### Cosa fa

Sistema di etichette colorate per i contatti. Ogni tag ha nome + colore
(10 colori pastello predefiniti). Relazione many-to-many con i contatti
(array di ID nel campo `tags` del contatto).

**Feature:**

- Creazione tag inline (dal form contatto, senza uscire)
- Color picker con 10 pastelli
- Filtro contatti per tag
- Badge colorati nella lista contatti
- Import/export CSV con tag

### File: 6 file in `src/components/atomic-crm/tags/`

`colors`, `RoundButton`, `TagChip`, `TagDialog`, `TagCreateModal`, `TagEditModal`

### Tabella DB: `tags`

Colonne: id, name, color. Nessuna FK — i tag ID sono salvati come array
nel campo `tags` dei contatti.

### Chi lo usa

- **Contacts** (esclusivamente): `TagsList`, `TagsListEdit`, filtri lista,
  dettaglio contatto, import CSV
- **Nessun altro modulo** usa i tag

### Stato attuale nel gestionale

- I `clients` del gestionale NON hanno un campo `tags`
- La categorizzazione è gestita da `client_type` (Produzione TV, Azienda locale,
  Privato wedding, ecc.) e `acquisition_source` (Instagram, Passaparola, ecc.)

### Opzioni

1. **Rimuovere tutto** — `client_type` e `acquisition_source` coprono il caso d'uso.
   I tag servivano nel CRM multi-utente per classificazione libera.
2. **Adattare per i Clienti** — Aggiungere tag colorati ai clienti del gestionale.
   Potrebbe essere utile per etichette custom: "VIP", "Pagatore lento",
   "Da ricontattare". Ma aggiunge complessità.
3. **Tenere com'è** — Funziona solo con contacts, non con clients.

### Rischio rimozione: MOLTO BASSO

Solo il modulo contacts originale usa i tag. Nessun modulo del gestionale li referenzia.

### Valore potenziale: BASSO-MEDIO

I tag colorati sono carini ma non essenziali. Il campo `notes` nei clienti
copre le annotazioni libere. Le categorie fisse (`client_type`) coprono la classificazione.

---

## 6. Sales (Utenti / Team)

### Cosa fa

Gestione utenti del CRM. Nel contesto Atomic CRM (multi-utente), serve per:

- Creare nuovi utenti (via Edge Function che chiama Supabase Auth)
- Assegnare contatti/deals/aziende a utenti specifici
- Filtrare "solo i miei" contatti/deals
- Mostrare "Tu" o il nome dell'utente nelle attività e note
- Disabilitare utenti (soft-delete, non cancellazione)

### File: 6 file in `src/components/atomic-crm/sales/`

`SalesList`, `SalesCreate`, `SalesEdit`, `SalesInputs`, `SaleName`, `index`

### Tabella DB: `sales`

Colonne: id, first_name, last_name, email, administrator, user_id (FK auth.users),
avatar (JSONB), disabled.

### Trigger CRITICI

- **`handle_new_user()`**: quando un utente fa signup → crea riga in `sales`
  (primo utente = admin)
- **`handle_update_user()`**: sync profilo auth.users → sales
- **`set_sales_id_default()`**: auto-popola `sales_id` su INSERT in contacts,
  notes, companies, deals, tasks

### Chi lo usa (come FK `sales_id`)

Praticamente **tutto**: contacts, contact_notes, deals, deal_notes, companies, tasks.
Ogni record ha `sales_id` per sapere chi l'ha creato/chi ne è responsabile.

### Stato attuale nel gestionale

- **"Utenti" è nel menu dropdown** del Header (visibile solo admin)
- **La pagina profilo** (`/profile`) funziona e usa `sales`
- Il gestionale è single-user, ma la tabella `sales` è necessaria per i trigger
  e per l'identità utente

### Opzioni

1. **Rimuovere solo la UI** (lista utenti, creazione, modifica) — Tenere
   la tabella + trigger + `SaleName`. Non serve gestire altri utenti.
   La pagina profilo può restare.
2. **Rimuovere tutto** — **PERICOLOSO**. I trigger `set_sales_id_default`
   e `handle_new_user` si romperebbero. Molte FK diventerebbero orfane.
3. **Tenere com'è** — Funziona, occupa poco spazio, è già nascosto per non-admin.

### Rischio rimozione UI: MOLTO BASSO

La UI utenti non serve (single-user). Ma tabella e trigger sono **intoccabili**.

### Rischio rimozione tabella: CRITICO

La tabella `sales` e i trigger sono infrastruttura di base.

---

## Riepilogo Decisionale

| Modulo | Cosa fa nel gestionale | Raccomandazione | Rischio |
|--------|----------------------|-----------------|---------|
| **Companies** | Niente (sostituito da Clienti) | Rimuovere UI, valutare tabella | Basso |
| **Tasks** | Niente (scadenze nei moduli specifici) | Rimuovere, MA valutare adattamento come "promemoria" | Medio |
| **Notes** | Niente (campi notes nei moduli) | Rimuovere, MA valutare storico note per clienti | Basso |
| **Activity Log** | Niente (single-user, no audit) | Rimuovere | Molto basso |
| **Tags** | Niente (client_type copre) | Rimuovere | Molto basso |
| **Sales** | Tabella + trigger essenziali | Rimuovere solo UI, tenere tabella + trigger | UI: basso, Tabella: critico |

### Moduli Atomic CRM collegati (da valutare insieme)

Se si rimuovono Companies, la cascata tocca anche:

- **Contacts** originale (ha `company_id`) — ma è già sostituito da Clients
- **Deals** originale (ha `company_id`) — ma è già sostituito da Quotes

Quindi la domanda vera è: **rimuoviamo anche i moduli Contacts e Deals originali?**
Sono già stati sostituiti da Clienti e Preventivi nel gestionale.

### Dipendenze incrociate da risolvere

Se si fa la pulizia completa (rimuovere contacts, deals, companies, tasks,
notes, tags, activity — tenendo solo sales tabella/trigger):

1. **`contacts_summary` view** → da rimuovere o ricreare per `clients`
2. **`set_sales_id_default` trigger** → rimuovere i riferimenti a contacts/deals/companies
3. **Legacy FakeRest data generators** → item storico; il provider FakeRest è
   stato poi rimosso dal repo
4. **Activity log nei data provider** → rimuovere `getActivityLog()` method
5. **`SaleName` component** → tenere, potrebbe servire nel gestionale
6. **Mobile navigation** → rimuovere pulsanti rapidi task/note
7. **Import/Export CSV** → il gestionale ha il proprio export nei moduli
8. **ConfigurationContext** → pulire config non più usate (dealStages, noteStatuses, taskTypes, ecc.)
9. **Settings page** → adattare per mostrare solo le impostazioni del gestionale

---

## Prossimi passi

Questo documento serve come base per la discussione.
**L'utente decide** cosa tenere, cosa adattare, cosa rimuovere.
Solo dopo la decisione si procede con l'implementazione.
