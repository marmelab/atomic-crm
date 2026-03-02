# Local Truth Rebuild — Fonti e Regole

**Stato del documento:** `canonical`
**Scopo:** fonte primaria per la gerarchia di verita' del rebuild locale del
dominio, le fonti dati autoritarie e le regole di risoluzione.
**Quando usarlo:** ogni volta che si tocca il rebuild locale, l'import
documenti, lo stato incasso o l'anagrafica clienti.
**Quando NON usarlo:** per il dettaglio del caso Diego/Gustare (servizi,
tariffe, acconti, CSV). Per quello usare `docs/data-import-analysis.md`.

**File correlati:**

- `supabase/migrations/20260302170000_domain_data_snapshot.sql` — snapshot
  statico del dominio (dal 2026-03-02 sostituisce i vecchi script dinamici)
- `docs/data-import-analysis.md` (caso reale Diego/Gustare)
- `docs/development-continuity-map.md` (sweep e integrazione)

> **Nota (2026-03-02):** gli script `scripts/local-truth-data.mjs`,
> `scripts/local-truth-data.test.mjs` e `scripts/bootstrap-local-truth.mjs`
> sono stati rimossi dal repo. Il dataset e' ora gestito interamente tramite la
> migration snapshot statica. I dettagli storici su ARUBA_PORTAL_TRUTH,
> ARUBA_CLIENT_REGISTRY e UNFILED_OPERATIONAL_TRUTH restano documentati qui
> come fonte di riferimento per la semantica del dato, anche se l'implementazione
> non risiede piu' negli script.

---

## Gerarchia di verita'

Per il rebuild locale del dominio la gerarchia non e' negoziabile:

1. `Fatture/` — XML fatture emesse e ricevute
2. `Fatture/contabilita' interna - diego caltabiano/` — CSV contabilita'
   operativa per il caso Diego/Gustare
3. portale Aruba Fatturazione Elettronica — stato incasso autoritativo e
   anagrafica clienti completa
4. file Numbers e note operative derivate

Nel workspace corrente questi percorsi corrispondono a:

- `/Users/rosariofurnari/Documents/gestionale-rosario/Fatture`
- `/Users/rosariofurnari/Documents/gestionale-rosario/Fatture/contabilita' interna - diego caltabiano`

Regole operative:

- `Fatture/` e' la fonte dati suprema per documenti fiscali, intestazioni
  reali, controparti e storico fatture
- per il caso Diego/Gustare, `Fatture/contabilita' interna - diego caltabiano/`
  e' la fonte piu' autorevole per interpretare il rapporto tra Diego Caltabiano
  e `ASSOCIAZIONE CULTURALE GUSTARE SICILIA`
- se un appunto, una bozza di import o una nota storica entra in conflitto con
  queste cartelle, prevalgono sempre i documenti presenti in queste cartelle

---

## ARUBA_PORTAL_TRUTH — Stato incasso fatture

Mappa derivata dagli screenshot del portale Aruba Fatturazione Elettronica
(colonna "Doc. coll.", catturati il 2026-03-02 per gli anni 2023, 2024 e 2025).
Originariamente codificata in `scripts/local-truth-data.mjs` (ora rimosso);
il dataset risultante e' persistito nella migration snapshot
`20260302170000_domain_data_snapshot.sql`.

### 2023 — 11 fatture (11 XML completi)

- 10 incassate con date esatte
- `FPA 1/23` (Comune di Aidone, NONSOLOLIBRI): **Non incassata** — resta
  scaduto, esclusa dalla mappa
- tutte le altre: incassate (FPR 1/23 → 01/04/2023 ... FPR 10/23 →
  30/01/2024)
- FPR 1/23 (LAURUS S.R.L., €1.872,00): XML aggiunto il 2026-03-02

### 2024 — 7 fatture

- tutte incassate con date esatte
- FPR 1/24 → 07/01/2024, FPR 2/24 → 15/02/2024, FPR 3/24 → 28/03/2024,
  FPR 4/24 → 03/06/2024, FPR 5/24 → 13/09/2024, FPR 6/24 → 01/10/2024,
  FPR 7/24 → 27/12/2024

### 2025 — 13 fatture

- 11 incassate, 2 stornate (FPA 1/25 + FPA 2/25)
- FPR 1/25 → 03/03/2025, FPR 2/25 → 14/05/2025, FPA 3/25 → 20/05/2025,
  FPR 3/25 → 08/07/2025, FPA 4/25 → 23/07/2025, FPR 4/25 → 14/10/2025,
  FPR 5/25 → 31/10/2025, FPR 6/25 → 11/11/2025, FPR 7/25 → 23/12/2025,
  FPR 8/25 → 27/12/2025, FPR 9/25 → 26/01/2026
- FPR 6/25 (Borghi Marinari, €7.152,10): la contabilita' CSV non copriva il
  pagamento, corretto dal portale Aruba

Questa mappa sostituisce i vecchi override anno-per-anno (2023 blanket, 2024
pre-CSV) con date di incasso precise dalla fonte autoritativa.

### Riconciliazione Aruba — verificata 2026-03-02

Confronto `cash_movements` raggruppati per anno di `movement_date` (principio
di cassa) vs dashboard Aruba "Incassi":

- 2023: Δ €0,00
- 2024: Δ +€2,00 (bollo virtuale incluso in ImportoTotaleDocumento)
- 2025: Δ +€0,19 (arrotondamento centesimi)
- 2026: Δ €0,00
- Totale: Δ +€2,19 su €46.713,79 (0.00%)

### ImportoPagamento vs ImportoTotaleDocumento

Due fatture AQUACHETA 2023 hanno `ImportoPagamento` diverso da
`ImportoTotaleDocumento` nell'XML:

- FPR 5/23: TotaleDocumento €372,00 / ImportoPagamento €465,00 (+25%)
- FPR 9/23: TotaleDocumento €250,00 / ImportoPagamento €312,50 (+25%)

Aruba "Incassi" usa ImportoPagamento (il denaro realmente incassato). I
`cash_movements` portale usano quindi `payableAmount` (= ImportoPagamento) per
l'importo, e `total` (= ImportoTotaleDocumento) per l'allocazione documento.
Questo allinea i totali per anno di incasso con la dashboard Aruba.

Per tutte le altre fatture (2024, 2025) i due campi coincidono.

---

## ARUBA_CLIENT_REGISTRY — Anagrafica clienti

Costante originariamente in `scripts/local-truth-data.mjs` (ora rimosso),
derivata dal file
`Fatture/ReportClienti.xls` (export "Report Clienti" del portale Aruba
Fatturazione Elettronica).

- 14 clienti dopo deduplicazione (Comune di Aidone: 8 righe → 1) e
  esclusioni (Edmondo Tamajo, Gioielleria Giangreco)
- campi: denominazione, P.IVA, CF, email, PEC, telefono, codice SDI,
  indirizzo completo (via, civico, CAP, comune, provincia, nazione)
- registrati PRIMA dell'elaborazione XML: il registry XLS pone la baseline,
  l'XML arricchisce/sovrascrive dove ha dati (party > existing)

### Clienti presenti solo nel registry (nessuna fattura XML)

- ASSOCIAZIONE LA TERRA ELETTRICA
- ASSOCIAZIONE VOLONTARIATO AMICI DELLO SPORT AICS
- ARCHEOCLUB AIDONE MORGANTINA
- ASSOCIAZIONE EUROFORM

### Esclusioni

- Spett. le On. Edmondo Tamajo — escluso per istruzione esplicita dell'utente
- GIOIELLERIA GIANGRECO DI GIANGRECO MARZIA & C. — escluso per istruzione
  esplicita dell'utente

---

## Regola di risoluzione runtime per l'import AI

Nel runtime reale dell'import documenti, la risoluzione del `client` non deve
promuovere automaticamente una persona a cliente se nel CRM quella persona e'
gia' un referente collegato a un'azienda.

Ordine corretto dei segnali:

1. progetto o cliente gia' selezionati esplicitamente
2. identificativi fiscali forti (`CF`, `P.IVA`)
3. denominazione fiscale / ragione sociale
4. referente gia' presente in `contacts` con collegamento univoco a un cliente
5. solo in ultima istanza il nome libero della controparte

Per il caso Diego/Gustare questo significa che, anche se un documento nomina
solo `Diego Caltabiano`, il resolver deve preferire il cliente fiscale
`ASSOCIAZIONE CULTURALE GUSTARE SICILIA` quando il referente Diego e' gia' noto
nel CRM e collegato a quel cliente.

---

## Fatture ricevute

Le cartelle:

- `Fatture/2023/fatture_ricevute/`
- `Fatture/2024/fatture_ricevute/`
- `Fatture/2025/fatture_ricevute/`

rappresentano soldi spesi realmente e fanno parte del rebuild locale.

### Inventario verificato

| Anno | Numero fatture ricevute | Totale importato come spese |
|------|------------------------|-----------------------------|
| 2023 | 4 | €351,72 |
| 2024 | 3 | €1.013,67 |
| 2025 | 2 | €704,06 |
| **Totale** | **9** | **€2.069,45** |

### Fornitori / controparti

| Controparte | Numero fatture | Totale |
|-------------|----------------|--------|
| ARUBA SPA | 5 | €222,40 |
| FABIO STEFANO CAPIZZI | 3 | €1.522,56 |
| DHL EXPRESS (ITALY) S.R.L. | 1 | €324,49 |

### Stato semantico attuale

- le fatture ricevute vengono parse come documenti `incoming`
- oggi vengono tradotte in record `expenses`
- non hanno ancora una semantica finanziaria completa separata tra:
  - documento ricevuto
  - debito aperto / da pagare
  - uscita di cassa effettiva
- modellazione transitoria corretta; va evoluta nel prossimo passo di
  separazione `documento / aperto / cassa`

Regola di continuita':

- queste fatture ricevute non vanno mai trattate come rumore o dati secondari
- ogni rebuild locale o rifattorizzazione finanziaria deve preservarle
- il prossimo refactor della semantica finanziaria deve partire anche da questi
  casi reali, non solo dalle fatture emesse

---

## Correzione dataset fiscale 2025

Dal 2026-03-02 il repo contiene gli XML reali:

- `FPR 1/25`
- `FPR 2/25`

Questi file sono la fonte primaria per il documento fiscale 2025, mentre la
contabilita' interna Diego resta la fonte di arricchimento per:

- allocazioni progetto
- referenti
- stato incasso operativo
- dettaglio lavori e costi non leggibili dalla sola fattura

### Pattern nota di credito 2025

Nel repo 2025 esiste un trio:

- `FPA 1/25` = fattura emessa
- `FPA 2/25` = `TD04`, nota di credito collegata a `FPA 1/25`
- `FPA 3/25` = riemissione valida

Conseguenze:

- `FPA 2/25` non va trattata come fattura attiva positiva
- `FPA 1/25` va considerata annullata dalla nota di credito
- per il `Fatturato attivo 2025` la base e' `customer_invoice` meno i documenti
  annullati da `customer_credit_note`

La semantica `nota di credito collegata a documento precedente` e' parte del
dominio reale e va preservata nei refactor della foundation finanziaria.

---

## UNFILED_OPERATIONAL_TRUTH — Lavori eseguiti ma non fatturati

Costante originariamente in `scripts/local-truth-data.mjs` (ora rimosso),
array di entry per lavori
confermati dall'utente che il CSV registra solo come date senza importi.

### Scopo

Il CSV di contabilita' interna Diego puo' contenere righe "placeholder" con
data ma zero importi. `isServicePlaceholder()` le scarta correttamente dal
flusso contabile perche' non hanno allocazione verso fatture. Ma se sono
lavori realmente eseguiti (confermati dall'utente), il rebuild deve comunque
generarli come:

- record `service` con tariffe standard
- record `expense` per i km associati
- record `payment` in stato `in_attesa` per il totale dovuto

Questo permette di:

- vederli nell'interfaccia (lista servizi, lista pagamenti)
- segnarli come pagati quando arriva il saldo
- includerli nei calcoli finanziari e dashboard

### Dati attuali

| Progetto              | Data       | Località          | Note           | Fee     | Km  |
|-----------------------|------------|-------------------|----------------|---------|-----|
| Bella tra i Fornelli  | 2025-09-18 | Cantina Tre Santi | Vendemmia      | 187+125 | 120 |
| Bella tra i Fornelli  | 2025-10-21 | Cantina Tre Santi | Puntata finale | 187+125 | 120 |
| Vale il Viaggio       | 2026-01-29 | Palermo           | Natale Giunta  | 233+156 | 0   |
| Vale il Viaggio       | 2026-02-02 | Taormina          | Saretto Bambar | 233+156 | 192 |
| Vale il Viaggio       | 2026-02-22 | Milazzo           | Roberto Lipari | 233+156 | 192 |

**Pagamenti pendenti:**

- Bella tra i Fornelli: €669,60 (2 × 312 fee + 2 × 22,80 km)
- Vale il Viaggio (Natale Giunta): €389,00 (1 × 389 fee, 0 km)
- Vale il Viaggio (Saretto Bambar + Roberto Lipari): €850,96 (2 × 389 fee + 2 × 36,48 km)

### Regola di manutenzione

Quando l'utente conferma il pagamento di un lavoro non fatturato:

- aggiornare il record `payment` nel DB (status: `ricevuto`, data, metodo)
- se viene emessa fattura, aggiornare anche `invoice_ref` sui servizi e spese
- quando il dominio e' sufficientemente aggiornato, creare una nuova migration
  snapshot aggiornata per consolidare lo stato

---

## Stato incasso operativo

Nel progetto la verita' operativa dell'incasso arriva da `payments.status`:

- `ricevuto`
- `in_attesa`
- `scaduto`

Questi tre stati bastano e vanno mantenuti come semantica canonica del CRM.
