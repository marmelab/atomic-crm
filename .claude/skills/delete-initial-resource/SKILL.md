---
name: delete-initial-resource
description: Remove one or more of the initial CRM resources (contacts, companies, deals, tags, tasks) from the codebase. Use when the user asks to delete, remove, or strip out one or several of these built-in resources. Runs the delete-initial-resource.ts script to drop each resource's own folder, then guides cleanup of every file that references them.
---

# delete-initial-resource

Removes one or more of the five initial Atomic CRM resources (`contacts`, `companies`, `deals`, `tags`, `tasks`) and every reference to them. **Irreversible — confirm the target(s) with the user first; rely on git to recover.**

## Steps

1. **Confirm the target(s)**, then read each one's file before editing:
   - `contacts` → [`contacts.md`](contacts.md) — spine; **confirm cascade scope first**
   - `companies` → [`companies.md`](companies.md) — spine/link; **confirm cascade scope first**
   - `deals` → [`deals.md`](deals.md)
   - `tags` → [`tags.md`](tags.md)
   - `tasks` → [`tasks.md`](tasks.md)
2. **Run the script** (below) — deletes each `src/components/atomic-crm/<resource>/` folder and prints the dependent files to clean.
3. **Clean each dependent file** using the "Shapes" patterns below + the per-resource file.
4. **Verify** (below).

Deleting several at once: clean from the most-coupled resource outward; clean a shared file **once** for both; and reconcile interacting union guidance — deleting both `contacts` and `deals` removes the notes/activity-log reference *entirely* rather than each narrowing it, so don't half-apply each file's "narrow the union" note.

## The script

```bash
node .claude/skills/delete-initial-resource/delete-initial-resource.ts <resource> [<resource> ...]
```

Validates the names, deletes each resource's folder, and prints the **merged, de-duplicated dependent-file list** (files inside a just-deleted folder are dropped). It does **not** edit those files — that's your job. Each entry in the script's `dependentFiles` map has a `//` comment saying *what* to remove; read it alongside the printed list, and update the map if the codebase grows new references.

## Shapes a resource takes

A resource is rarely just a folder. The later shapes are invisible to a `\b<resource>\b` grep:

- **Standalone** — imports, JSX, routes, menu/nav, dashboard widgets, the `<Resource>` entry in `root/CRM.tsx`. Wrapper components *outside* the folder that only render the resource: delete outright, then clean importers.
- **Field/column on another record** — fans out far wider: the `types.ts` type, `providers/commons/mergeContacts.ts`, CSV/JSON import, i18n, stories/tests, `StoryWrapper` builders, and the sample CSVs (header **and** every row). For a *link* column, decide per-link: orphaned shell (typed, defaulted) or drop — remove the UI either way.
- **Aggregated `nb_<resource>`** (from the `_summary` views) lands on a record type, read across shows/lists/filters/generators. **Invisible to a `\b<resource>\b` grep** (the `_` is a word char) — grep `nb_<resource>` and the denormalized `company_name` separately.
- **Shared subsystems** — notes (`reference: "contacts" | "deals"`) and the activity log (`"company" | "contact" | "deal" | "all"` union). Narrow the union, delete the per-type render components (`ActivityLog*Created.tsx`) + dead branches, prune the `providers/commons/activity.ts` fetcher + `consts.ts`/`types.ts` members. Surviving `=== "<other>"` checks stay valid — only the deleted member's branches go.
- **Config props** (`taskTypes`, `dealStages`, `companySectors`) live in `root/defaultConfiguration.ts`, `ConfigurationContext.tsx`, `CRM.tsx` (default + jsdoc + store seed), `App.tsx`, and `SettingsPage.tsx` (the `<Card>` **and** the section-list entry). **Not always named after the resource** — grep the settings `<Card>` for other keys (Deals owned `currency`) and flag borderline-general ones rather than dropping them silently.
- **Custom dataProvider methods** live in **both** providers; `CrmDataProvider` derives from the supabase one, so removing them there drops them from the type. Also clean the lifecycle-callback blocks in both providers, the `sales` `beforeDelete` reassignment, the supabase `<resource> -> <resource>_summary` `getList` routing, and the FakeRest generators (which *drive* record creation).
- **JSON importer** (`misc/useImportFromJson.ts`) treats `contacts`/`companies`/`notes`/`tasks` as top-level types (`import<X>` fn, `$.<x>.*` path, a `TYPES` arm + switch, guards, `stats`/`failedImports`/`idsMaps` keys). Mirror in `ImportPage.tsx` + `import-sample.json`; the CSV importer (`useContactImport.tsx`) has parallel mappings.
- Check `useCallback`/`useMemo` deps — a stale `getTags`/`getCompanies` there is invisible until `tsc`.

## Backend (the script only touches frontend)

See the `backend-dev` skill for the migration workflow. In `supabase/schemas/`:

- Drop/adjust the table + view, generate a migration (`npx supabase db diff --local -f remove_<resource>`); update `contacts_summary`/`companies_summary` if they aggregated it.
- **`activity_log`** is a `UNION ALL` with the same column set per branch — remove the resource's columns from **every** branch (keep them aligned), delete its dedicated branch(es), and drop the matching snake→camel rename in the supabase `getList("activity_log")`.
- `06_grants.sql` grants the table **and** its `<resource>_id_seq` (drop both). `05_policies.sql` has an RLS-enable line **and** `create policy` statements (drop both).
- A resource used inside a SQL function (`merge_contacts`): drop those lines + the unused local var. Editing `02_functions.sql` regenerates the whole function (expected) — renumber leftover step comments.
- **Orphan check:** deleting triggers can orphan helpers — but verify shared callers first (`get_domain_favicon` survives a `companies` delete because contact avatars also call it).
- **Edge functions** are separate and easy to miss: `merge_contacts/`, `_shared/db.ts` (Kysely types), `postmark/` (inbound email), and `mcp/` (an AI subsystem whose depth varies per resource). When a surviving function loses a capability, **flag it to the user**.

## Verify

```bash
make typecheck && make lint
```

Resolve whatever `tsc` surfaces (the dependent-file list is a guide, not a guarantee). Then `grep -rniE "\b<resource>\b"` over `src/`+`supabase/`, plus **separate** greps for `nb_<resource>`, `company_name`, and config-prop names (`<resource>Types`, `companySectors`, `currency`). Watch for benign/substring false positives (each resource file lists its own); never edit `supabase/migrations/`.

**i18n is all-or-nothing:** `frenchCrmMessages.ts` is type-checked against the type derived from `englishCrmMessages.ts`, so remove a key from **both** catalogs or **neither** (a one-sided removal is a `tsc` error). Dead `resources.<x>.*` keys are harmless — flag rather than force. `frenchCrmMessages.ts` uses literal `…` escapes; if an exact-string `Edit` fails on a block spanning one, fall back to `sed -i '<from>,<to>d'`.

If Supabase is running, `npx supabase db reset --local` replays the chain + `seed.sql` and catches a broken view/function/grant `db diff` misses (benign `index "…_pkey" does not exist` NOTICEs expected). On Node 22 (see `.nvmrc`), `make test` (vitest) is also available.
