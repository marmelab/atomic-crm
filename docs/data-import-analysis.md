# Analisi Dati Reali — Caso Diego Caltabiano / Gustare Sicilia

**Stato del documento:** `reference`
**Scopo:** caso reale di dominio: servizi, tariffe, acconti, CSV e mapping
operativo del rapporto Diego/Gustare.
**Quando NON usarlo:** per la gerarchia di verita' generale, lo stato incasso
di tutte le fatture o l'anagrafica clienti completa. Per quello usare
`docs/local-truth-rebuild.md`.

**Fonti verificate:** cartella `Fatture/`, sotto-cartella
`Fatture/contabilita' interna - diego caltabiano/`, file Numbers
`Rosario Furnari - Servizi per Diego Caltabiano - DAL 27 10 24 AL 07 04 25.numbers`
**Analizzato:** 2026-02-25
**Stato:** Dati estratti e VALIDATI con Rosario

**Nota 2026-03-05:** il prompt Gemini per l'estrazione servizi ora include
istruzione esplicita per il campo `notes` (annotazioni operative dal documento)
e regola critica per documenti tabulari multi-riga: ogni riga = un record
separato (testato su SPOT GS 2026.pdf con 9 servizi). L'editor bozza e' stato
riorganizzato in sezioni visive (Documento, CRM, dettagli resource, Anagrafica
fiscale collapsible, Note) e splittato per concern in moduli dedicati.

**Nota 2026-03-06:** la dedup servizi in `invoice_import_confirm` ora include
`description` nella chiave di confronto, necessario per distinguere servizi
diversi con stessa data e stessi importi (es. due spot diversi nello stesso
giorno a €312). `km_distance` migrato a `numeric(10,2)` per distanze decimali.

**Nota 2026-03-06 (service date per row):** il prompt Gemini ora istruisce
esplicitamente di usare la data REALE di svolgimento di ciascun servizio dalla
riga della tabella, non la data di emissione/intestazione del documento.
L'editor bozza mostra "Data servizio" (non "Data documento") per i record di
tipo servizio, e il campo descrizione e' enfatizzato visivamente (`font-semibold
text-base`) per facilitare l'identificazione del singolo servizio nella bozza.

**Nota 2026-03-07 (supplier resolution):** `invoice_import_confirm` ora risolve
automaticamente il fornitore per le expense importate. La funzione
`resolveOrCreateSupplier` matcha per P.IVA, poi per nome (case-insensitive), e
se non trova corrispondenze crea un nuovo record in `suppliers` con l'anagrafica
fiscale estratta dal documento. Il `supplier_id` viene salvato sulla expense.
Tutto avviene nella stessa transazione Kysely (rollback sicuro). Se non ci sono
dati counterparty, `supplier_id` resta null (backward-compatible).

**Nota 2026-03-08 (prompt hardening):** aggiunte 3 regole Pareto al prompt
Gemini di estrazione: (1) classificazione per P.IVA titolare — se il cedente ha
P.IVA 01309870861 il record e' un pagamento (incasso), altrimenti e' una spesa;
(2) usare SEMPRE l'importo imponibile (netto senza IVA), non il lordo — il CRM
gestisce importi netti; (3) match cliente prima per P.IVA/CF, poi per nome, null
se incerto. Risolve i 3 errori piu' frequenti: classificazione sbagliata,
importi gonfiati dall'IVA, clientId null su documenti con P.IVA leggibile.

**Nota 2026-03-06 (duplicate skip):** la conferma import ora **salta i duplicati**
invece di bloccare l'intero batch con 409. Se un record esiste gia nel DB
(match su stessi campi chiave), viene aggiunto a `skipped[]` nella risposta e
gli altri record vengono importati normalmente. Il frontend mostra un riepilogo
separato per record creati (verde) e saltati (ambra).

**Aggiornato:** con risposte di Rosario + nuove tariffe 2025/2026

---

## Traduzione di dominio Diego/Gustare

- `ASSOCIAZIONE CULTURALE GUSTARE SICILIA` = cliente fiscale / controparte
  principale
- `Diego Caltabiano` = referente operativo/persona collegata al cliente

Questa regola vale per import AI, anagrafica clienti, referenti, mapping DB,
analisi storiche e correzione dati.

Per la gerarchia di verita' completa, le fonti dati autoritarie e le regole di
risoluzione runtime, vedere `docs/local-truth-rebuild.md`.

## Struttura del file

2 fogli (sheets):
- **SERVIZI** — Dal 27/10/2024 al 07/04/2025 (periodo 1)
- **SERVIZI-1** — Dal 20/04/2025 in poi (periodo 2)

Colonne: Data | BELLA TRA I FORNELLI | GUSTARE SICILIA | SPOT | COMPENSO RIPRESE | COMPENSO MONTAGGIO | KM | NOTE

Le colonne BTF / GS / SPOT indicano a quale progetto appartiene il servizio
(la localita/nome viene scritta nella colonna del progetto corrispondente).

---

## 1. Cliente

Un solo cliente fiscale in questo file:

| Campo | Valore |
|-------|--------|
| name | ASSOCIAZIONE CULTURALE GUSTARE SICILIA |
| client_type | produzione_tv |
| fiscal_code | 05416820875 |
| source | passaparola |

**Nota importante:** il file operativo e i fogli contabili fanno riferimento a
Diego Caltabiano come referente, ma la gerarchia di verita' suprema definita
in `docs/local-truth-rebuild.md` conferma che l'intestatario fiscale ricorrente
e' `ASSOCIAZIONE CULTURALE GUSTARE SICILIA`. Nel CRM quindi Diego va trattato
come referente operativo, non come cliente anagrafico principale.

---

## 2. Progetti identificati

| # | Nome Progetto | Categoria | Programma TV | Stato |
|---|---------------|-----------|-------------|-------|
| 1 | Gustare Sicilia | produzione_tv | gustare_sicilia | in_corso |
| 2 | Gustare Sicilia — Borghi Marinari | produzione_tv | gustare_sicilia | in_corso |
| 3 | Bella tra i Fornelli | produzione_tv | bella_tra_i_fornelli | in_corso |
| 4 | Spot Colate Verdi Evo Etna | spot | — | completato |
| 5 | Spot Rosemary's Pub | spot | — | completato |
| 6 | Spot Panino Mania | spot | — | completato |
| 7 | Spot HCLINIC | spot | — | completato |
| 8 | Spot Spritz & Co | spot | — | completato |
| 9 | Spot Il Castellaccio | spot | — | completato |
| 10 | Spot Camping Carratois | spot | — | completato |
| 11 | Gustare Sicilia — Nisseno | produzione_tv | gustare_sicilia | completato |

**Note:**

- Gli spot in questo file sono coordinati operativamente da Diego per conto
  dell'associazione. Rosario fa spot anche per altri clienti, che saranno
  progetti separati con clienti diversi.
- **Borghi Marinari** e un progetto GS separato (16 puntate dedicate
  ai borghi marinari siciliani), non fa parte della stagione GS principale.

---

## 3. Servizi (Registro Lavori) — FOGLIO 1: dal 27/10/2024 al 07/04/2025

### Correzioni date applicate al CSV

Corrette direttamente in `SERVIZI-Tabella 1.csv` (errori di digitazione di Diego):

| Riga CSV | Dato originale | Corretto | Verita' canonica | Progetto |
|----------|---------------|----------|-----------------|----------|
| 3 | 27 ott 14 | 27 ott 24 | 2024-10-27 | GS Ragalna |
| 15 | 5 gen 24 | 5 gen 25 | 2025-01-05 | BTF Santocchini |
| 16 | 8 gen 24 | 8 gen 25 | 2025-01-08 | SPOT HCLINIC |
| 17 | 13 gen 24 | 13 gen 25 | 2025-01-13 | BTF Pasticceria Vittoria |

### Servizi Gustare Sicilia (GS) — Foglio 1

| # | Data | Localita | Riprese | Montaggio | Km | Note |
|---|------|----------|---------|-----------|-----|------|
| 1 | 2024-10-27 | Ragalna (speciale) | 187 | 249 | 148 | |
| 2 | 2024-11-24 | Nicolosi (speciale) | 187 | 249 | 163 | |
| 3 | 2024-12-07 | Bronte | 187 | — | 188 | Solo riprese |
| 4 | 2024-12-08 | Bronte | 187 | 249 | 188 | |
| 5 | 2024-12-16 | Motta S. Anastasia | 187 | — | 141 | Solo riprese |
| 6 | 2024-12-17 | Motta S. Anastasia | 187 | 249 | 141 | |
| 7 | 2025-01-20 | Mazzarino | 187 | — | 84 | Solo riprese |
| 8 | 2025-01-21 | Mazzarino | 187 | 249 | — | |
| 9 | 2025-01-27 | Pietraperzia | 187 | — | 65 | Solo riprese |
| 10 | 2025-01-28 | Pietraperzia | 187 | 249 | — | |
| 11 | 2025-02-11 | Aidone | 187 | 249 | 43 | Riprese e montaggio |
| 12 | 2025-02-18 | Piazza Armerina | 187 | 249 | 40 | Riprese e montaggio |
| 13 | 2025-03-17 | Gibellina | 187 | 249 | — | Riprese e montaggio |
| 14 | 2025-03-23 | Valguarnera | 187 | 249 | — | Riprese e montaggio |
| 15 | 2025-03-31 | Barrafranca | 187 | 249 | 60 | Riprese e montaggio |
| 16 | 2025-04-07 | Corleone | 187 | 249 | — | Riprese e montaggio |

**Subtotale GS foglio 1:** €6.229 (confermato dal file)

### Servizi Bella tra i Fornelli (BTF) — Foglio 1

| # | Data | Localita/Puntata | Riprese | Montaggio | Km | Note |
|---|------|-----------------|---------|-----------|-----|------|
| 1 | 2024-12-23 | Spot BTF (da Santocchini) | — | 125 | 164 | Sconto, riprese e montaggio veloci |
| 2 | 2024-12-29 | Sigla BTF | — | 250 | 103 | Si intende riprese e montaggio |
| 3 | 2025-01-05 | Santocchini | 187 | 125 | 164 | |
| 4 | 2025-01-13 | Pasticceria Vittoria | 187 | 125 | 155 | |
| 5 | 2025-01-23 | Mon - Nicolosi | 187 | 125 | 163 | |
| 6 | 2025-01-30 | Spritz & Co - Belpasso | 187 | 125 | 152 | |
| 7 | 2025-02-13 | Acitrezza - Paninomania | 187 | 125 | 160 | |
| 8 | 2025-02-20 | Catania - Antica Sicilia | 187 | 125 | 160 | |
| 9 | 2025-02-25 | Spazio Sapore | 187 | — | 160 | SOLO RIPRESE |
| 10 | 2025-03-03 | Spazio Sapore | 187 | — | 160 | SOLO RIPRESE |
| 11 | 2025-03-06 | Esterne - Spazio Sapore | 187 | — | 210 | SOLO RIPRESE |
| 12 | 2025-03-11 | Spazio Sapore | 187 | — | 160 | SOLO RIPRESE |
| 13 | (no date) | Montaggio 3 puntate Spazio Sapore | — | 375 | — | 125 x 3 |
| 14 | 2025-03-25 | U Fucularu | — | 125 | — | SOLO MONTAGGIO |
| 15 | 2025-04-04 | La Prua - Acireale | 187 | 125 | 198 | |

**Subtotale BTF foglio 1:** €3.807 (confermato dal file)

### Servizi SPOT — Foglio 1

| # | Data | Nome Spot | Riprese | Montaggio | Km | Note |
|---|------|-----------|---------|-----------|-----|------|
| 1 | 2024-10-17 | Colate Verdi Evo Etna | — | 125 | — | Sconto, riprese/musica/voiceover gia forniti |
| 2 | 2024-12-28 | Rosemary's Pub | — | 250 | 163 | Si intende riprese e montaggio |
| 3 | 2024-12-28 | Panino Mania | — | 250 | — | Si intende riprese e montaggio |
| 4 | 2025-01-08 | HCLINIC | — | 250 | 168 | Si intende riprese e montaggio |
| 5 | 2025-01-23 | Spritz & Co | — | 250 | — | |
| 6 | 2025-03-04 | Il Castellaccio | — | 250 | — | |

**Subtotale SPOT foglio 1:** €1.375 (confermato dal file)

### Voci speciali — Foglio 1

| # | Tipo | Trattamento | Importo |
|---|------|-------------|---------|
| 1 | ~~Bonus montaggio~~ | IGNORARE — considerato sconto, non inserire nel DB | 249 |
| 2 | Spesa accessoria | Expense: acquisto_materiale, Hard Disk Seagate IronWolf Pro 8TB (+25% ricarico) | 293 |

---

## 4. Servizi (Registro Lavori) — FOGLIO 2: dal 20/04/2025 in poi

### Servizi Gustare Sicilia (GS) — Foglio 2

| # | Data | Localita/Puntata | Riprese | Montaggio | Km | Note |
|---|------|-----------------|---------|-----------|-----|------|
| 1 | 2025-04-20 | Pietraperzia | 187 | 249 | 65 | |
| 2 | 2025-04-28 | Ambiens | 187 | 249 | 60 | |
| 3 | 2025-05-29 | Pozzallo | 187 | 249 | 150 | |
| 4 | 2025-06-12 | 1 - Acitrezza | 187 | 249 | 190 | Borghi Marinari |
| 5 | 2025-06-16 | 2 - Brucoli | 187 | 249 | 200 | Borghi Marinari |
| 6 | 2025-06-26 | 3 - Castellammare del Golfo | 187 | 249 | 0 | Borghi Marinari |
| 7 | 2025-07-02 | 4 - Marzamemi | 187 | 249 | 150 | Borghi Marinari |
| 8 | 2025-07-17 | 5 - Capo d'Orlando | 187 | 249 | 150 | Borghi Marinari |
| 9 | 2025-07-23 | 6 - Selinunte | 187 | 249 | 0 | Borghi Marinari |
| 10 | 2025-08-04 | 7 - Isola delle Femmine | 187 | 249 | 0 | Borghi Marinari |
| 11 | 2025-08-09 | 8 - Salina | 187 | 249 | 800 | Viaggio doppio 400km x2, pedaggi non conteggiati |
| 12 | 2025-08-12 | 9 - Custonaci | 187 | 249 | 0 | Borghi Marinari |
| 13 | 2025-08-21 | 10 - Sferracavallo | 187 | 249 | 0 | Borghi Marinari |
| 14 | 2025-08-31 | 11 - Pozzallo | 187 | 249 | 150 | Borghi Marinari |
| 15 | 2025-09-03 | 12 - Santa Flavia | 187 | 249 | 0 | Borghi Marinari |
| 16 | 2025-09-16 | 13 - Catania | 187 | 249 | 150 | Borghi Marinari |
| 17 | 2025-09-25 | 14 - Lipari | 187 | 249 | 400 | Borghi Marinari |
| 18 | 2025-09-30 | 15 - Favignana | 187 | 249 | 0 | Borghi Marinari |
| 19 | 2025-10-06 | 16 - Sciacca | 187 | 249 | 0 | Borghi Marinari |

**Note date:** ROW 22-25 del file contengono date in formato "3 sett 25" ecc.
che sono state interpretate come settembre 2025.

**Subtotale GS foglio 2:** €8.284 (confermato dal file)

### Servizi Bella tra i Fornelli (BTF) — Foglio 2

| # | Data | Localita/Puntata | Riprese | Montaggio | Km | Note |
|---|------|-----------------|---------|-----------|-----|------|
| 1 | 2025-05-20 | Cantina Tre Santi | 187 | — | 120 | SOLO RIPRESE |
| 2 | 2025-05-27 | Cantina Tre Santi | 187 | — | 120 | SOLO RIPRESE |
| 3 | 2025-05-28 | Cantina Tre Santi | 187 | — | — | SOLO RIPRESE |
| 4 | (no date) | Cantina Tre Santi montaggio | — | 500 | — | Montaggio 4 puntate (125 x 4) |
| 5 | 2025-06-05 | Spazio Sapore | 187 | — | 150 | SOLO RIPRESE, montaggio gia saldato |
| 6 | 2025-09-18 | Cantina Tre Santi | — | — | — | (solo data, nessun importo) |
| 7 | 2025-10-21 | Cantina Tre Santi | — | — | — | (solo data, nessun importo) |

**Subtotale BTF foglio 2:** €1.248 (confermato dal file)

### Voci speciali — Foglio 2

| # | Tipo | Trattamento | Importo |
|---|------|-------------|---------|
| 1 | Spesa accessoria | Expense: acquisto_materiale, Hard Disk | +260 |
| 2 | Credito ricevuto | Da registrare come `credito_ricevuto` da €500 nel blocco contabile Borghi Marinari | -500 |

**Subtotale spese accessorie foglio 2:** -€240 (confermato: 260 - 500 = -240)
La vendita iPhone va nel DB come `credito_ricevuto` da €500 associato al
blocco `Borghi Marinari`, non come riga da ignorare.

---

## 5. Pagamenti (Acconti)

### Foglio 1 — Totalmente saldato

| # | Data | Importo | Note |
|---|------|---------|------|
| 1 | 27/12/2024 | 999,00 | |
| 2 | 10/02/2025 | 2.000,00 | |
| 3 | 03/03/2025 | 3.113,00 | |
| 4 | 22/04/2025 | 2.500,00 | |
| 5 | 30/04/2025 | 2.000,00 | |
| 6 | 14/05/2025 | 1.795,19 | Saldo finale |
| **TOTALE** | | **12.407,19** | **Da saldare: €0** |

### Foglio 2 — Saldato (confermato dal portale Aruba 11/11/2025)

| # | Data | Importo | Note |
|---|------|---------|------|
| 1 | 14/10/2025 | 2.682,35 | Acconto da CSV |
| 2 | 11/11/2025 | 7.152,10 | Saldo confermato da portale Aruba |
| **TOTALE** | | **9.834,45** | **Da saldare: €0** |

---

## 6. Fatture

| # | Riferimento | Data | Km | Km EUR | Servizi EUR | Altro EUR | Totale EUR |
|---|-------------|------|----|--------|-------------|-----------|-----------|
| 1 | FPR 7/24 | 19/12/2024 | 0 | 0 | 997 | — | 997,00 |
| 2 | FPR 1/25 | 01/02/2025 | 0 | 0 | 5.115 | — | 5.115,00 |
| 3 | FPR 2/25 | 11/04/2025 | 3.701 | 703,19 | 5.592 | — | 6.295,19 |
| 4 | FPR 4/25 | 12/10/2025 | 665 | 126,35 | 2.556 | — | 2.682,35 |
| 5 | FPR 6/25 | 04/11/2025 | 2.190 | 416,10 | 6.976 | -240 | 7.152,10 |
| 6 | FPR 9/25 | (da XML) | 0 | 0 | 1.744 | 2 (bollo) | 1.746,00 |

**Note:**

- FPR 6/25: data emissione effettiva 04/11/2025 (progetto Borghi Marinari,
  incassata 11/11/2025 — confermato dal portale Aruba)
- FPR 9/25: 4 puntate GS Nisseno (Mazzarino 15/10, Riesi 16/10, Sommatino
  20/10, Butera 23/10/2025). Incassata il 26/01/2026. Non coperta dal CSV,
  servizi derivati dall'XML + verifica utente/calendario.

**Totale fatturato:** €12.407,19 + €9.834,45 + €1.746,00 = **€23.987,64**
**Totale pagato:** €12.407,19 + €9.834,45 + €1.746,00 = **€23.987,64**
**Da saldare:** €0

---

## 7. Riepilogo numerico complessivo

| Voce | Foglio 1 | Foglio 2 | Totale |
|------|----------|----------|--------|
| Servizi GS | €6.229 | €8.284 | €14.513 |
| Servizi BTF | €3.807 | €1.248 | €5.055 |
| Servizi SPOT | €1.375 | €0 | €1.375 |
| Spese accessorie | €293 | -€240 | €53 |
| Km totali | 3.701 km | 2.855 km | 6.556 km |
| Rimborso km | €703,19 | €542,45 | €1.245,64 |

| **Totale generale** | **€12.407,19** | **€9.834,45** | **€1.746,00** | **€23.987,64** |
| Pagato | €12.407,19 | €9.834,45 | €1.746,00 | €23.987,64 |
| **Da saldare** | **€0** | **€0** | **€0** | **€0** |

Nota: la colonna "FPR 9/25" rappresenta la fattura Nisseno non coperta dal CSV,
con servizi derivati da XML + verifica utente/calendario.

---

## 8. Mapping al DB Schema del Gestionale

### clients (1 record)

```sql
INSERT INTO clients (name, client_type, source, fiscal_code, notes)
VALUES (
  'ASSOCIAZIONE CULTURALE GUSTARE SICILIA',
  'produzione_tv',
  'passaparola',
  '05416820875',
  'Cliente fiscale ricorrente confermato da Fatture/ e dalla contabilita interna di Diego'
);
```

### contacts (1 record consigliato)

```sql
INSERT INTO contacts (client_id, first_name, last_name, notes)
VALUES (
  :gustare_client_id,
  'Diego',
  'Caltabiano',
  'Referente operativo storico per Gustare Sicilia e progetti collegati'
);
```

### projects (11 records)

```sql
-- Gustare Sicilia
INSERT INTO projects (client_id, name, category, tv_show, status, start_date)
VALUES (:gustare_client_id, 'Gustare Sicilia', 'produzione_tv', 'gustare_sicilia', 'in_corso', '2024-10-27');

-- Gustare Sicilia — Borghi Marinari
INSERT INTO projects (client_id, name, category, tv_show, status, start_date)
VALUES (:gustare_client_id, 'Gustare Sicilia — Borghi Marinari', 'produzione_tv', 'gustare_sicilia', 'in_corso', '2025-06-12');

-- Gustare Sicilia — Nisseno
INSERT INTO projects (client_id, name, category, tv_show, status, start_date)
VALUES (:gustare_client_id, 'Gustare Sicilia — Nisseno', 'produzione_tv', 'gustare_sicilia', 'completato', '2025-10-15');

-- Bella tra i Fornelli
INSERT INTO projects (client_id, name, category, tv_show, status, start_date)
VALUES (:gustare_client_id, 'Bella tra i Fornelli', 'produzione_tv', 'bella_tra_i_fornelli', 'in_corso', '2024-12-23');

-- Spot (uno per ciascuno)
INSERT INTO projects (client_id, name, category, status, start_date) VALUES
(:gustare_client_id, 'Spot Colate Verdi Evo Etna', 'spot', 'completato', '2024-10-17'),
(:gustare_client_id, 'Spot Rosemary''s Pub', 'spot', 'completato', '2024-12-28'),
(:gustare_client_id, 'Spot Panino Mania', 'spot', 'completato', '2024-12-28'),
(:gustare_client_id, 'Spot HCLINIC', 'spot', 'completato', '2025-01-08'),
(:gustare_client_id, 'Spot Spritz & Co', 'spot', 'completato', '2025-01-23'),
(:gustare_client_id, 'Spot Il Castellaccio', 'spot', 'completato', '2025-03-04'),
(:gustare_client_id, 'Spot Camping Carratois', 'spot', 'completato', '2024-01-01');
```

### services (~50+ records)

Ogni riga del foglio Numbers diventa un record nella tabella `services`.
Il tipo servizio viene determinato dalla combinazione riprese/montaggio:

- Solo riprese -> `riprese`
- Solo montaggio -> `montaggio`
- Entrambi -> `riprese_montaggio`

**Caso speciale SPOT:** La tariffa spot (€250 vecchia / €312 nuova) e una
tariffa flat unica che copre riprese+montaggio. Nel DB va in `fee_other`,
NON spezzata tra fee_shooting e fee_editing. Il tipo servizio e `riprese_montaggio`
ma i campi fee_shooting e fee_editing restano a 0.

### payments (CSV acconti + Aruba portal truth + supplementary truth)

I 7 acconti CSV (6 dal foglio 1 + 1 dal foglio 2) sono la base per i
pagamenti Gustare coperti dalla contabilita' interna. Per lo stato incasso
di tutte le fatture emesse, vedere `docs/local-truth-rebuild.md` (sezione
ARUBA_PORTAL_TRUTH).

Il conteggio finale dei payments nel dataset dipende dal numero di fatture
outgoing XML presenti nel repo.

### expenses (3 records — inclusa compensazione iPhone)

| Descrizione | Tipo | Importo | Ricarico | Progetto |
|-------------|------|---------|----------|----------|
| Hard Disk Seagate IronWolf Pro 8TB | acquisto_materiale | 234,40 (base) | 25% = 293 | Foglio 1 (da associare) |
| Hard Disk | acquisto_materiale | 260 | 0% | Borghi Marinari |
| Vendita iPhone | credito_ricevuto | 500 | 0% | Borghi Marinari |

---

## 9. Risposte di Rosario (confermate)

1. **Fonte acquisizione cliente:** Passaparola
2. **Bonus montaggio €249:** IGNORARE — considerato sconto
3. **Vendita iPhone (-€500):** NON ignorare; va registrata come
   `credito_ricevuto` collegato al progetto Borghi Marinari
4. **Spot:** In questo storico Diego coordina operativamente gli spot per conto
   dell'associazione. Rosario fa spot anche per altri clienti (saranno
   progetti separati con clienti diversi).
5. **Borghi Marinari:** Progetto GS SEPARATO — 16 puntate dedicate ai borghi
   marinari siciliani. Non fa parte della stagione GS principale.
6. **Nuove tariffe 2025/2026:** Aumento ~25% applicato (vedi sezione 10)

### Domande ancora aperte

- Contatti referente Diego? (telefono, email) — da inserire quando disponibili
- ~~ROW 32-33 foglio 2 (Cantina Tre Santi senza importi)~~ — **RISOLTO**: lavori
  eseguiti non fatturati, importati via `UNFILED_OPERATIONAL_TRUTH` con tariffe
  standard BTF (187+125) e km=120. Pagamento `in_attesa` da €669,60.
- Metodo pagamento acconti — tutti bonifico?
- Date "3 sett 25", "16 sett 25" — confermata interpretazione settembre 2025?

---

## 10. Tariffe aggiornate 2025/2026

Fonte: `riepilogo analisi compensi per servizi per diego caltabiano.pdf`

### Vecchie tariffe (usate nei dati del file Numbers)

| Voce | Importo |
|------|---------|
| Riprese | €187 |
| Montaggio GS | €249 |
| Montaggio BTF / VIV | €125 |
| SPOT completo (flat: riprese+montaggio inclusi) | €250 |

### Nuove tariffe (da applicare ai nuovi lavori)

| Voce | Importo | Aumento |
|------|---------|---------|
| Riprese | €233 | +24,6% |
| Montaggio GS | €311 | +24,9% |
| Montaggio VIV | €156 | +24,8% |
| SPOT completo (flat: riprese+montaggio inclusi) | €312 | +24,8% |

### Classifica compenso per giornata

| # | Tipo lavoro | Composizione | Importo/giornata |
|---|-------------|--------------|-----------------|
| 1 | Vale il Viaggio (puntata completa) | Riprese 1/2gg + Montaggio 1/2gg | €389 |
| 2 | SPOT completo | Riprese 1/2gg + Montaggio 1/2gg | €312 |
| 3 | Montaggio GS | 1 giornata da casa | €311 |
| 4 | Riprese GS | 1 giornata fuori casa | €233 |

### Nuovo programma: Vale il Viaggio (VIV)

Il PDF rivela un terzo programma TV: **Vale il Viaggio**.
Va aggiunto alle opzioni `tv_show` nel DB:

```
CHECK (tv_show IN ('bella_tra_i_fornelli', 'gustare_sicilia', 'vale_il_viaggio', 'altro'))
```

### Impatto sulle settings del DB

Questa nota appartiene al bootstrap originario delle settings.

Nel runtime attuale la configurazione applicativa e' piu' ricca e non va letta
come semplice elenco stabile di chiavi `default_fee_*`.

Questa sezione resta utile solo per capire il passaggio storico delle tariffe:

```sql
-- Tariffe vecchie (gia presenti)
-- default_fee_shooting: 187
-- default_fee_editing_standard: 249
-- default_fee_editing_spot: 250
-- default_fee_editing_short: 125

-- Tariffe nuove (da aggiornare)
UPDATE settings SET value = '233' WHERE key = 'default_fee_shooting';
UPDATE settings SET value = '311' WHERE key = 'default_fee_editing_standard';
UPDATE settings SET value = '312' WHERE key = 'default_fee_editing_spot';
-- Nota: rinominare la key in 'default_fee_spot' (tariffa flat, non solo montaggio)
UPDATE settings SET value = '156' WHERE key = 'default_fee_editing_short';
```

---

## 11. Impatti sullo schema DB

Dall'analisi dei dati reali emergono 2 modifiche necessarie allo schema:

### 11.1 Aggiungere campo `discount` alla tabella `services`

Rosario applica sconti occasionali (es: "riprese e montaggio veloci").
Serve un campo per tracciare gli sconti senza sporcare i compensi standard.

```sql
ALTER TABLE services ADD COLUMN discount DECIMAL(10,2) DEFAULT 0;
-- Il totale diventa: fee_shooting + fee_editing + fee_other - discount
```

### 11.2 Aggiungere `vale_il_viaggio` a tv_show

```sql
ALTER TABLE projects DROP CONSTRAINT projects_tv_show_check;
ALTER TABLE projects ADD CONSTRAINT projects_tv_show_check
  CHECK (tv_show IN ('bella_tra_i_fornelli', 'gustare_sicilia', 'vale_il_viaggio', 'altro'));
```

---

## Appendice A. Mappa canonica verificata Diego/Gustare

Aggiornata il 2026-03-02 con verifica incrociata CSV + XML + Google Calendar.

### Riepilogo fatture

| Fattura | Servizi | Totale | Settlement | Km | Note |
|---------|---------|--------|------------|----|------|
| FPR 7/24 | 3 entries | €997 | ricevuto 27/12/24 | 0 (carry) | |
| FPR 1/25 | 18 entries | €5,115 | ricevuto 03/03/25 | 0 (carry) | |
| FPR 2/25 | 16+2 special | €6,295.19 | ricevuto 14/05/25 | 3,701 km | |
| FPR 4/25 | 8 entries | €2,682.35 | ricevuto 14/10/25 | 665 km | |
| FPR 6/25 | 16+2 special | €7,152.10 | ricevuto 11/11/25 | 2,190 km | Emissione 04/11/2025 |
| FPR 9/25 | 4 entries | €1,746 | ricevuto 26/01/26 | 0 | Nisseno, senza CSV |

### FPR 9/25 — Dettaglio episodi Nisseno

Fattura coperta dall'XML `IT01879020517A2025_itYcw.xml` ma senza copertura nel
CSV della contabilita' interna. Servizi ricostruiti da XML + verifica utente e
calendario.

| # | Data | Localita | Riprese | Montaggio | Km |
|---|------|----------|---------|-----------|-----|
| 1 | 2025-10-15 | Mazzarino | 187 | 249 | 0 |
| 2 | 2025-10-16 | Riesi | 187 | 249 | 0 |
| 3 | 2025-10-20 | Sommatino | 187 | 249 | 0 |
| 4 | 2025-10-23 | Butera | 187 | 249 | 0 |

Totale servizi: €1,744. Bollo: €2. Totale fattura: €1,746.
Incassata il 26/01/2026 tramite bonifico.

### Correzioni date CSV applicate

Errori di digitazione di Diego corretti direttamente in
`SERVIZI-Tabella 1.csv`:

| Riga | Dato originale | Corretto | Data canonica | Progetto |
|------|---------------|----------|---------------|----------|
| 3 | 27 ott 14 | 27 ott 24 | 2024-10-27 | GS Ragalna |
| 15 | 5 gen 24 | 5 gen 25 | 2025-01-05 | BTF Santocchini |
| 16 | 8 gen 24 | 8 gen 25 | 2025-01-08 | SPOT HCLINIC |
| 17 | 13 gen 24 | 13 gen 25 | 2025-01-13 | BTF Pasticceria Vittoria |
