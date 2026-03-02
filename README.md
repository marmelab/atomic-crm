# Gestionale Rosario Furnari

Fork fortemente personalizzato di Atomic CRM per gestire:

- clienti e referenti
- progetti
- registro lavori
- preventivi
- pagamenti
- spese
- promemoria
- dashboard annuale e storica
- chat AI unificata e import documenti

Questo repository non va letto come il prodotto upstream `Atomic CRM`.
L'upstream e' solo la base di partenza tecnica.

## Start Here

Per capire il progetto senza prendere decisioni su documenti sbagliati, leggere
in questo ordine:

1. [docs/README.md](docs/README.md)
2. [docs/development-continuity-map.md](docs/development-continuity-map.md)
3. [docs/historical-analytics-handoff.md](docs/historical-analytics-handoff.md)
4. [docs/architecture.md](docs/architecture.md)
5. [docs/contacts-client-project-architecture.md](docs/contacts-client-project-architecture.md)

## Core Rules

- il codice reale e le migration sono la verita' operativa
- i documenti canonici vanno aggiornati nello stesso passaggio delle feature
- i documenti storici non sono fonte primaria del comportamento attuale
- la regola di Pareto domina sia le scelte di codice sia la documentazione

## Development

```bash
make install
make start
make test
make test-e2e
make typecheck
make lint
```

Nota operativa:

- la modalita' demo/FakeRest non fa piu parte del workflow supportato
- sviluppo, smoke test e validazione vanno eseguiti sul runtime reale avviato
  con `make start`
- `make start` e `npx supabase db reset` ricreano automaticamente anche un
  admin locale autenticabile
- `make start` verifica anche che il dominio locale minimo sia allineato al
  rebuild reale da `Fatture/`
- `make supabase-reset-database` ricostruisce il database locale di dominio da:
  - `Fatture/`
  - `Fatture/contabilità interna - diego caltabiano/`
- nel solo runtime locale il login email/password Supabase resta abilitato per
  supportare bootstrap admin e smoke E2E
- `make test-e2e` gira sul dataset locale reale ricostruito, non su fixture
  dominio hardcoded
- gli smoke Playwright locali coprono sia lettura sia write-path minimi:
  - login admin
  - cliente/referente Diego-Gustare
  - progetto + snapshot AI
  - creazione referente da progetto con auto-link
  - aggiornamento referente primario progetto
- credenziali locali di default:
  - email `admin@gestionale.local`
  - password `LocalAdmin123!`
- se vuoi cambiarle senza toccare il repo, usa in `.env.local`:
  - `LOCAL_SUPABASE_ADMIN_EMAIL`
  - `LOCAL_SUPABASE_ADMIN_PASSWORD`

## Deploy

- frontend:
  - `git push origin main`
- database remoto:
  - `npx supabase db push`
- Edge Functions remote:
  - `npx supabase functions deploy <nome>`

`git push` da solo non deploya le Edge Functions.

## Upstream

Base tecnica originaria:

- `marmelab/atomic-crm`
- <https://github.com/marmelab/atomic-crm>
