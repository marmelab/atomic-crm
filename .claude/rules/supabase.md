# Supabase Rules — Gestionale Rosario Furnari

## Source Of Truth

Per stato corrente di schema e backend leggere prima:

1. `docs/README.md`
2. `docs/architecture.md`
3. `supabase/migrations/**`
4. `supabase/functions/**`

## Provider First

- non creare client Supabase custom se il `dataProvider` esistente basta
- preferire metodi espliciti nel provider rispetto a fetch sparsi
- se nasce una nuova capability backend, esporre un entry point stabile anche
  per la futura AI

## Remote Deploy Rules

- cambi DB:
  - nuova migration
  - `npx supabase db push`
- cambi Edge Functions:
  - `npx supabase functions deploy <name>`
- `git push` non deploya le Edge Functions remote

## Access Model

- progetto single-user
- registrazione pubblica disabilitata
- business tables protette da RLS
- regola standard:
  - `auth.uid() IS NOT NULL`
- eccezione intenzionale:
  - `keep_alive` con `SELECT` pubblico

## Current Core Schema

Le tabelle operative principali sono:

- `clients`
- `contacts`
- `project_contacts`
- `projects`
- `services`
- `quotes`
- `payments`
- `expenses`
- `client_tasks`
- `client_notes`
- `settings`
- `keep_alive`

Le viste e le funzioni operative principali includono anche:

- `project_financials`
- `monthly_revenue`
- viste `analytics_*`
- `invoice_import_extract`
- `invoice_import_confirm`
- `unified_crm_answer`

## New Table / View Checklist

Per ogni nuova tabella o view reale:

1. creare migration in `supabase/migrations/`
2. definire chiavi, vincoli e indici utili
3. abilitare RLS se applicabile
4. creare policy esplicite
5. aggiungere `created_at` e `updated_at` dove serve
6. aggiornare provider Supabase e FakeRest se la resource e' esposta al CRM
7. aggiornare `types.ts`, eventuali view PK nel provider e docs di continuita'

## Edge Function Rules

- usare `supabase/functions/_shared/` per auth, CORS e helper riusabili
- seguire il pattern:
  - preflight
  - `authenticate()`
  - handler
- usare Edge Functions per:
  - multi-step mutations
  - accesso a secret esterni
  - import documenti
  - logiche AI server-side
- non spostare logica semplice nel backend se puo' restare deterministica nel
  provider o nel DB

### REGOLA CRITICA — config.toml per nuove Edge Functions

Quando si crea una NUOVA Edge Function, aggiungere SUBITO la entry in
`supabase/config.toml`:

```toml
[functions.nome_funzione]
verify_jwt = false
```

Tutte le funzioni di questo progetto gestiscono l'auth internamente con JWKS
(`_shared/authentication.ts`). Se manca la entry, il gateway Supabase (Kong)
blocca il JWT PRIMA che la funzione possa gestirlo → 401 "Invalid JWT"
sistematico. Non e' un errore intermittente: fallisce OGNI chiamata.

## Environment Variables

Frontend:

```bash
VITE_SUPABASE_URL=...
VITE_SB_PUBLISHABLE_KEY=...
```

Server / Edge Functions:

- usare secret Supabase o file `.env` locali dedicati
- non esporre mai secret key nel frontend
