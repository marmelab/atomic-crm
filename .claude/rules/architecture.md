# Architecture Rules — Gestionale Rosario Furnari

## Source Priority

Seguire i pattern locali del repo, non l'upstream Atomic CRM alla lettera.

Ordine corretto:

1. codice reale, migration, Edge Functions
2. documenti `canonical` in `docs/`
3. documenti `working`
4. archivi storici

## Resource Pattern

Le resource vive del CRM includono almeno:

- `clients`
- `contacts`
- `projects`
- `services`
- `quotes`
- `payments`
- `expenses`
- `suppliers`
- `tasks` / `client_tasks`

Ogni nuova resource deve allinearsi ai pattern locali gia presenti, non ai
moduli legacy rimossi come `companies` o `deals`.

## Module Structure

Per i moduli CRUD classici il pattern base resta:

```text
src/components/atomic-crm/[module]/
├── [Module]List.tsx
├── [Module]Create.tsx
├── [Module]Edit.tsx
├── [Module]Show.tsx
├── [Module]Inputs.tsx
└── index.tsx
```

Eccezioni legittime:

- `quotes` ha anche superfici Kanban, PDF e dialog dedicati
- `dashboard` e `ai` non seguono il pattern CRUD classico
- moduli con dialog/sheet/linking richiedono sweep aggiuntiva

## Configuration Rule

Se una modifica introduce una regola configurabile o cambia un default condiviso,
aggiornare anche:

- `defaultConfiguration`
- `ConfigurationContext`
- `SettingsPage`
- section settings pertinente

Se la modifica e' solo strutturale o read-only, non toccare `Settings` per
riflesso: lasciare invece traccia nei docs di continuita'.

## Anti-Bloat

- non aggiungere nuove superfici quando una esistente puo' essere riusata
- non duplicare logica business tra UI, provider e AI
- non creare moduli "provvisori" fuori pattern senza documentare la ragione
- se un file cresce per responsabilita' multiple, splittarlo per concern reale,
  non per rispettare limiti arbitrari
