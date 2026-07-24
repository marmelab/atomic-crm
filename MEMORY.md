# MEMORY

Durable Atomic CRM knowledge. One sentence per bullet, freshest first. Maintained by the `documentator` agent — see [.claude/agents/documentator.md](.claude/agents/documentator.md).

## Business Knowledge

- Core resources: contacts, companies, deals (Kanban pipeline), tasks, notes, tags, and sales (team members).
- Domain options (genders, sectors, deal stages/categories, note statuses, task types) are `<CRM>` props in `src/App.tsx`, not hardcoded.
- Sales users sync with Supabase `auth.users` via triggers; deletion is unsupported — accounts are disabled instead.
- Aggregated reads use database views (`contacts_summary`, `companies_summary`), which FakeRest emulates in the frontend.
- Two interchangeable data providers: Supabase (production) and FakeRest (in-browser demo, resets on reload).
- Filters use `ra-data-postgrest` syntax (`field_name@operator`); operators must be supported by the FakeRest `supabaseAdapter`.

## 2026-07-24 13:26 — Dockerfile EasyPanel livré, hook auto-memory corrigé
**Résumé.** Session partie d'une question sur l'installation/déploiement du CRM sur EasyPanel. Un Dockerfile de production (absent jusque-là) + `.dockerignore` ont été conçus (Turso managé, image node:22.19.0-bookworm-slim) et implémentés via le harness (orchestrator → planner → developer → reviewer → merger → promotion). Mergé dans `main` (fast-forward + merge --no-ff) puis pushé vers github.com/sylvaindiv/atomic-crm.git. En cours de route, le hook global `auto-memory.sh` s'est emballé (les sous-agents partagent le session_id → dizaines d'écritures concurrentes, 1512 lignes de doublons dans MEMORY.md) ; cause identifiée et corrigée.
**Décisions prises.** - Turso managé plutôt que SQLite local sur volume EasyPanel — usage interne mais préférence pour éviter de gérer ses propres sauvegardes. - Image node:22.19.0-bookworm-slim (pas Alpine) — plus sûr pour ce déploiement unique malgré support musl confirmé.
**Fichiers / skills modifiés.** - `Dockerfile` — build multi-stage production, mergé et pushé sur `main`. - `.dockerignore` — idem. - `~/.claude/hooks/auto-memory.sh` — ajout verrou par session (mkdir atomique) + cooldown 10 min contre les écritures concurrentes.
**Prochaines étapes / TODOs.** - [ ] Créer la base Turso et configurer TURSO_DATABASE_URL/TURSO_AUTH_TOKEN/PORT sur EasyPanel. - [ ] Créer l'App EasyPanel depuis le repo GitHub et déployer.
