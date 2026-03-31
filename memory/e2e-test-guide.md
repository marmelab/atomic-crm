---
name: E2E Test Suite Guide
description: Come funzionano i 98 test E2E Playwright, come lanciarli, quando aggiornarli, pattern e insidie
type: reference
---

## Infrastruttura

- **Runner**: Playwright, config in `playwright.config.ts`
- **Modalità**: `fullyParallel: false`, `workers: 1` — sequenziale, un test alla volta
- **Test dir**: `tests/e2e/`
- **Support**: `tests/e2e/support/` — auth helpers, test data controller
- **Risultati**: `test-results/` (gitignored), screenshot on failure

## Stack locale richiesto

- Supabase locale (porta 55321 REST, 55322 DB)
- Frontend Vite (porta 5173)
- `make start` avvia tutto, oppure `npx supabase start` + `npx vite --host`

## Come lanciare

```bash
# Tutti i test (98 test, ~7 min)
npx playwright test tests/e2e/ --reporter=line

# Singola suite
npx playwright test tests/e2e/dashboard-annual.smoke.spec.ts --reporter=line

# Singolo test per riga
npx playwright test "tests/e2e/projects.complete.spec.ts:64" --reporter=line

# Make target (avvia anche lo stack se necessario)
make test-e2e
```

## Test Data Controller

File: `tests/e2e/support/test-data-controller.ts`

Ogni suite usa `resetAndSeedTestData()` nel `beforeEach`:
1. TRUNCATE di tutte le tabelle business (con `session_replication_role = replica`)
2. INSERT di dati controllati: 1 client, 1 project (produzione_tv), 3 services, 5 payments, 3 expenses manuali
3. Il trigger DB `sync_service_km_expense` crea automaticamente 2 spese km dai servizi con km > 0
4. Re-seed dei workflow templates (truncati durante reset)

**Dati seed attesi**:
- Client: `Test Client {uuid}`, tipo `azienda_locale`
- Project: `Test Project {uuid}`, categoria `produzione_tv`, status `in_corso`, budget 10000
- Services: 3 (riprese 3000€, montaggio 2000€, riprese_montaggio 1500€) = 6500€ totale
- Payments: 5 (acconto 2000 ricevuto, saldo 1500 ricevuto, rimborso 300 ricevuto, parziale 2000 in_attesa, parziale 500 scaduto)
- Expenses: 5 totali (3 manuali: materiale 500+25%, software 30, credito 999 + 2 auto-km: 19€ e 9.50€)
- Spese progetto totali: 653,50€ (625 materiale + 19 km + 9.50 km)

## 19 Suite — Stato al 2026-03-31

| Suite | Test | Cosa copre |
|-------|------|-----------|
| navigation.smoke | 2 | Nav desktop + mobile, tutti i moduli raggiungibili |
| auth.smoke | 2 | Login admin, persistenza mode dashboard |
| dashboard-annual.smoke | 7 | KPI cards, net availability, cash flow, deadlines, AI card |
| calculations.smoke | 5 | Totali dashboard, riepilogo progetto, bozza fattura, pagamenti, servizi |
| projects.complete | 11 | CRUD, financial summary, quick episode/payment, invoice draft, filtri, delete |
| services.complete | 7 | CRUD, fee calc, km, tassabilità, fattura ref, duplica, delete |
| payments.complete | 13 | CRUD, stati, tipi, filtri, deadline tracker, quote linking, delete |
| expenses.complete | 12 | CRUD, km calc, markup, filtri per tipo/progetto, credito, delete |
| clients.complete | 10 | CRUD, filtri, search, delete |
| tasks.complete | 1 | Lista, creazione, completamento, filtri, edit, delete, dashboard |
| kanban-projects.smoke | 3 | Toggle lista/kanban, card details, mobile (no kanban) |
| workflow-automation.smoke | 4 | Lista, show details, create, toggle active/inactive |
| deadline-tracker.smoke | 1 | Sezione "Cosa devi fare" con contatori e azioni |
| ai-chat-simple | 1 | Chat AI si apre e risponde |
| ai-semantic-ui | 4 | Categorie AI, loading state, icone, visual hierarchy |
| ai-annual-real | 2 | AI "spiegami l'anno" con Edge Function reale (slow, 90s timeout) |
| full-ui-audit | 3 | Clients CRUD, Projects page loads, Settings page loads |
| ui-screenshot-audit | 8 | Screenshot di tutte le pagine principali |
| debug-dashboard | 1 | Dashboard carica senza errori |

## Quando aggiornare i test

1. **UI rinominata** (testi card, bottoni, labels) → aggiornare selettori `getByText`, `getByLabel`, `getByRole`
2. **Form labels cambiate** → aggiornare `getByLabel("...")` — leggere sempre il componente Inputs.tsx
3. **Redirect cambiato** → aggiornare `toHaveURL(/.../)`  — leggere il componente Create/Edit per il prop `redirect`
4. **Nuovi dati seed** → aggiornare conteggi (`toHaveCount`) e valori numerici attesi
5. **DB trigger aggiunge record** → i conteggi cambiano (es. auto-km da `sync_service_km_expense`)
6. **DeleteButton pattern** → usa undo toast, NON dialog di conferma. Test devono cercare notifica, non dialog

## Pattern per selettori robusti

- **Colonne tabella**: scope a `page.locator("table thead")` o `page.locator("table")` per evitare ambiguità con navbar/sidebar
- **Filtri sidebar**: scope a `.shrink-0.w-56` o simile per distinguere da tabella
- **Status/type badges**: scope a `table tbody` per evitare match con filtri sidebar
- **Valori currency**: usare regex con separatore migliaia opzionale: `/6\.?500,00\s*€/`
- **Testi con CSS uppercase**: `getByText` matcha il testo DOM (lowercase), non il rendering CSS

## Insidie note

- **ai-annual-real**: chiama Edge Functions reali, serve `test.setTimeout(90_000)` e stack completo
- **tasks.complete**: lento (~3 min) per timeout interni
- **Batch run**: tutti passano insieme (98/98) ma se un test corrompe i seed data (es. crea record extra senza cleanup), i successivi possono fallire. Il `beforeEach` con TRUNCATE dovrebbe prevenire, ma attenzione a test che non usano il controller.
