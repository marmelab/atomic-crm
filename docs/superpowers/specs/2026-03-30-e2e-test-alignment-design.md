# E2E Test Alignment — Design Spec

> Data: 2026-03-30
> Stato: spec per allineamento test E2E alla UI ridisegnata

## Problema

14 test E2E in 3 suite falliscono perche' i selettori cercano testi/elementi che
non esistono piu' dopo la riprogettazione UI "Approccio Bambino". La UI funziona
correttamente — sono i test ad essere obsoleti.

## Root Cause per suite

### dashboard-annual.smoke (7 test falliti)

Tutti i fallimenti sono selettori con testi vecchi. Le card KPI, cash flow,
net availability, deadlines e AI sono state rinominate.

| Test (riga) | Selettore rotto | Testo UI attuale | Sorgente |
|-------------|----------------|-----------------|----------|
| :25 | `"Valore del lavoro dell'anno"` | `"Lavoro dell'anno"` | DashboardKpiCards.tsx:151 |
| :36 | `"Pagamenti da ricevere"` | `"Da incassare"` | DashboardKpiCards.tsx:72 |
| :52 | `"Scadenze e alert"` | `"Cosa devi fare"` | DashboardDeadlineTracker.tsx:232 |
| :82 | `"Disponibilita' netta stimata"` | `"Quanto ti resta in tasca"` | DashboardNetAvailabilityCard.tsx:41 |
| :87 | `"Incassato netto:"` | `"Incassato"` | DashboardNetAvailabilityCard.tsx:52 |
| :88 | `"Spese operative:"` | `"Spese"` | DashboardNetAvailabilityCard.tsx:67 |
| :97 | `"Cash flow prossimi 30 giorni"` | `"Prossimi 30 giorni"` | DashboardCashFlowCard.tsx:23 |
| :102 | `"Entrate attese"` | `"Entrano"` | DashboardCashFlowCard.tsx:35 |
| :103 | `"Uscite previste"` | `"Escono"` | DashboardCashFlowCard.tsx:55 |
| :130,166,201 | `/spiegami annuale/i` | `"Spiegami l'anno {year}"` | DashboardAnnualAiSummaryCard.tsx:208 |
| :156 | `"AI: spiegami l'anno"` | `"Chiedi all'AI"` | DashboardAnnualAiSummaryCard.tsx:173 |

### calculations.smoke (1 test fallito)

| Test (riga) | Selettore rotto | Testo UI attuale | Sorgente |
|-------------|----------------|-----------------|----------|
| :24 | `"Valore del lavoro dell'anno"` | `"Lavoro dell'anno"` | DashboardKpiCards.tsx:151 |

### projects.complete (6 test falliti)

Questi hanno root cause diverse — non solo testi rinominati:

| Test (riga) | Errore | Root cause |
|-------------|--------|------------|
| :15 | `getByText("Cliente")` not found | Ambiguita': "Cliente" matcha anche "Clienti" nella navbar. Il testo colonna esiste ma il selettore non e' specifico |
| :34 | `toHaveURL(/\/projects$/)` after save | Il redirect dopo creazione non va a `/projects` — potrebbe andare a `/projects/{id}/show` |
| :64 | `"Riepilogo finanziario"` not visible | Il testo nella UI attuale e' `"RIEPILOGO FINANZIARIO"` (uppercase via CSS `uppercase`) — `getByText` e' case-sensitive sui testi renderizzati |
| :92 | `button "Puntata"` click timeout | Il pulsante potrebbe non essere visibile senza scroll, oppure il testo e' diverso |
| :133 | `getByText(/3000,00/)` strict mode: 2 elements | Il valore `3000,00` appare in piu' posti nella pagina — servono selettori piu' specifici |
| :225 | `getByText(/Conferma\|eliminare/)` not found | Il dialog di conferma usa un testo diverso |

## Approccio

**Principio WF-5**: i test validano il sistema, non si adattano. Prima verifico
che il sistema produca il valore corretto, poi allineo il selettore al testo
attuale. Non invento selettori — leggo la UI reale.

**Regola**: ogni selettore aggiornato deve usare il testo ESATTO presente nel
componente sorgente, con riferimento file:riga.

### Strategia per tipo di errore

1. **Testo rinominato** (dashboard, calculations): sostituire il vecchio testo
   col nuovo, 1:1 meccanico
2. **Selettore ambiguo** (projects :15 "Cliente"): usare selettore piu'
   specifico (es. `within(table).getByText("Cliente")` o `th` scoping)
3. **Redirect cambiato** (projects :34): verificare il redirect attuale e
   aggiornare l'URL pattern
4. **Case sensitivity CSS** (projects :64): usare regex case-insensitive o
   `{ exact: false }`
5. **Multi-match** (projects :133): aggiungere `.first()` o scope al container
6. **Dialog testo diverso** (projects :225): leggere il componente dialog e
   usare il testo reale

## File da modificare

- `tests/e2e/dashboard-annual.smoke.spec.ts` — 7 test, ~15 selettori
- `tests/e2e/calculations.smoke.spec.ts` — 1 test, 1 selettore
- `tests/e2e/projects.complete.spec.ts` — 6 test, ~8 selettori

## File da leggere (non modificare)

Per ogni selettore rotto, il componente sorgente va letto per confermare il
testo attuale. I file gia' mappati sono elencati nella tabella sopra. Per i
progetti servira' leggere anche:

- `src/components/atomic-crm/projects/ProjectShow.tsx` — testo sezioni
- `src/components/atomic-crm/projects/ProjectCreate.tsx` — redirect dopo save
- `src/components/atomic-crm/projects/ProjectInputs.tsx` — label form

## Criteri di accettazione

1. Tutti i 14 test devono passare dopo le modifiche
2. I test gia' passanti (navigation, payments, expenses, ecc.) non devono rompersi
3. Nessun test deve essere disabilitato o skippato
4. Ogni selettore aggiornato deve avere un commento col riferimento al
   componente sorgente (file:riga) quando il testo non e' ovvio
5. `make test` (unit) deve continuare a passare
6. I valori numerici attesi nei test devono corrispondere ai dati seed reali,
   non a valori inventati

## Fuori scope

- Aggiungere nuovi test
- Modificare la UI
- Refactoring dei test helper
- Fix ai test che gia' passano
