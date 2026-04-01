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

- il repository non contiene piu' il provider demo/FakeRest
- sviluppo, smoke test e validazione vanno eseguiti sul runtime reale avviato
  con `make start`
- `make start` avvia Supabase locale e bootstrapa l'admin locale
- dopo un `npx supabase db reset`, se ti serve il login locale, esegui anche
  `npm run local:admin:bootstrap`
- `make supabase-reset-database` e' il rebuild locale supportato: migration +
  dump reale `supabase/seed_domain_data.sql` + bootstrap admin
- `Fatture/` e `Fatture/contabilità interna - diego caltabiano/` restano
  fonti storiche di riferimento, non il workflow di rebuild locale
- nel solo runtime locale il login email/password Supabase resta abilitato per
  supportare bootstrap admin e smoke E2E
- `make test-e2e` esegue oggi una suite Playwright tecnica con dati
  deterministici creati da `tests/e2e/support/test-data-controller.ts`
- quella suite serve per regressioni UI/flow ripetibili, NON come fonte di
  verita' del dominio
- per validazione semantica o fiscale usare sempre il dominio locale
  ricostruito via `make supabase-reset-database`
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
