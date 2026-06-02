# delete-initial-resource — common rules

Read this before touching any resource, then read the per-resource file(s) for what you're deleting.

## The script

`delete-initial-resource.ts` deletes each resource's own folder, then prints the **merged, de-duplicated list of dependent files** (files inside a just-deleted folder are dropped automatically — e.g. `companies/CompanyShow.tsx` won't be listed if you also deleted `companies`). It does **not** edit those files — that's your job. Each entry in the script's `dependentFiles` map has a `//` comment telling you *what* to remove from that path; read it alongside the printed list.

Run from the project root directly:

```bash
node .claude/skills/delete-initial-resource/delete-initial-resource.ts <resource> [<resource> ...]
```

It validates every name (exits on an unknown one or a missing folder), deletes `src/components/atomic-crm/<resource>/` for each, and prints the dependent files plus shared files like `root/CRM.tsx`.

## Shapes a resource takes

A resource is rarely just a folder. Look for each of these — the later ones are invisible to a `\b<resource>\b` grep:

- **Standalone usage** — imports, JSX, routes, menu/nav entries, dashboard widgets, the `<Resource name="...">` entry + imports in `root/CRM.tsx`. Some wrapper components *outside* the folder exist only to render the resource — delete them outright, then clean their importers.
- **Field/column on another record** — fans out much wider than a folder: the type in `types.ts`, the merge logic (`providers/commons/mergeContacts.ts`), CSV/JSON import, i18n, stories/tests, the `StoryWrapper` record builders, and the sample CSVs (`contacts_export.csv`, `test-data/contacts.csv` — drop the column from the header **and** every row). For a *link* column, decide per-link: keep it as an orphaned shell (typed, defaulted) or drop it — remove the UI either way.
- **Aggregated `nb_<resource>` columns** (from the `_summary` views) land on a record type and are read across shows/lists/filters/generators. **Invisible to `\b<resource>\b` grep** (the `_` is a word char) — grep `nb_<resource>` separately. Same for the denormalized `company_name`.
- **Shared subsystems** — notes (over `reference: "contacts" | "deals"`) and the activity log (over a `"company" | "contact" | "deal" | "all"` context union) are parameterised by a union, not keyed to a folder. Narrow the union, delete the per-type render components (`ActivityLog*Created.tsx`) and dead branches, and prune the `providers/commons/activity.ts` fetcher + the `consts.ts`/`types.ts` members. Surviving `=== "<other>"` checks stay valid (tsc won't flag them) — only the deleted member's branches go.
- **Config props** (e.g. `taskTypes`, `dealStages`, `companySectors`) live in `root/defaultConfiguration.ts`, `ConfigurationContext.tsx`, `CRM.tsx` (default + jsdoc + store seed), `App.tsx`, and `SettingsPage.tsx` (the `<Card>` **and** the section-list entry + transform/defaultValues). **A config prop isn't always named after the resource** — grep the resource's settings `<Card>` for other keys (Deals also owned `currency`) and trace each one's consumers; flag borderline-general props rather than dropping them silently.
- **Custom dataProvider methods** live in **both** providers; `CrmDataProvider` is `ReturnType<typeof getDataProviderWithCustomMethods>` (the supabase provider), so removing them there drops them from the type. Also clean each resource's lifecycle-callback blocks in both providers, the `sales` `beforeDelete` reassignment, the supabase `getList` `<resource> -> <resource>_summary` routing, and the FakeRest generators — which *drive* record creation, not just reference the field.
- **The JSON importer** (`misc/useImportFromJson.ts`) treats `contacts`/`companies`/`notes`/`tasks` as top-level importable types (an `import<X>` fn, a `$.<x>.*` path, a `TYPES` arm + switch case, type guards, `stats`/`failedImports`/`idsMaps` keys). Mirror the trims in `ImportPage.tsx` (stats row + help text) and the `import-sample.json` fixture. The CSV importer (`useContactImport.tsx`) has parallel cache + column mappings.
- Don't forget `useCallback`/`useMemo` dependency arrays — a stale `getTags`/`getCompanies` reference there is invisible until `tsc` runs.

## Deleting several at once

- **Order cleanup from the most-coupled resource outward** and read all the relevant per-resource files before editing — the cascade interactions compound.
- Clean a file shared by two deleted resources **once**, for both — don't make two passes that fight each other.
- Reconcile interacting union guidance: deleting both `contacts` and `deals` removes the notes/activity-log subsystem reference *entirely* rather than each narrowing it the other's way — don't half-apply each file's "narrow the union" note.

## Backend (the script only touches frontend)

See the `backend-dev` skill for the migration workflow. In `supabase/schemas/`:

- Drop/adjust the table + view, generate a migration (`npx supabase db diff --local -f remove_<resource>`). Update `contacts_summary`/`companies_summary` if they aggregated the removed data.
- The **`activity_log` view** is a `UNION ALL` where **every branch declares the same column set** — remove the resource's columns from **every** branch (keep the lists aligned), delete its dedicated branch(es), and drop the matching snake→camel rename in the supabase provider's `getList("activity_log")`.
- `06_grants.sql` grants **both** the table and its `<resource>_id_seq` (drop both, or `db diff` fails with `relation "public.<resource>_id_seq" does not exist`). `05_policies.sql` has an `enable row level security` line **and** `create policy` statements (remove both).
- For a resource referenced inside a SQL **function** (`merge_contacts`), drop those lines + the now-unused local var. Editing `02_functions.sql` regenerates the whole function (expected) — renumber leftover step comments so they stay sequential.
- **Orphan subtlety:** deleting triggers can orphan helper functions — but check for shared callers first (`get_domain_favicon` is called by *both* `handle_company_saved` and contact avatars, so it survives a `companies` delete).
- **Edge functions** are separate from the schema and easy to miss: `merge_contacts/`, `_shared/db.ts` (Kysely table types), `postmark/` (inbound email → contact notes), and especially `mcp/` — a whole AI subsystem whose depth varies per resource. When a function loses a capability but survives, **flag the behavior change to the user**.

## Verify

```bash
make typecheck && make lint
```

The dependent-file list is a guide, not a guarantee — resolve whatever `tsc` surfaces. A final `grep -rniE "\b<resource>\b"` over `src/` and `supabase/` is worth it, plus **separate** greps for `nb_<resource>`, `company_name`, and config-prop names (`<resource>Types`, `companySectors`, `currency`). Watch for **benign/substring false positives** and don't blind-delete (each resource file lists its own). Never edit historical files under `supabase/migrations/`.

**i18n is all-or-nothing across both catalogs:** `frenchCrmMessages.ts` is type-checked against the `CrmMessages` type derived from `englishCrmMessages.ts`, so a key must be removed from **both** or **neither** — a one-sided removal is a `tsc` error. Dead `resources.<x>.*` keys are harmless; because cleanup is large and all-or-nothing, **flag them to the user rather than forcing it**. Note: `frenchCrmMessages.ts` uses literal `…` escapes — if an exact-string `Edit` fails on a block spanning one, fall back to `sed -i '<from>,<to>d'` after confirming line numbers with a fresh read.

If local Supabase is running, `npx supabase db reset --local` replays the whole chain + `seed.sql` and catches a broken view/function/grant that `db diff` alone won't (benign `index "…_pkey" does not exist, skipping` NOTICEs are expected). The project runs on Node 22 (see `.nvmrc`), so `make test` (vitest) is also available as a gate if the resource had unit tests.

## Notes

- The deletion is irreversible — rely on git to recover if needed. Confirm the resource(s) with the user before running.
- Per-file guidance lives in the script's `dependentFiles` map comments; if the codebase grows new references, update that map so future runs stay accurate.
