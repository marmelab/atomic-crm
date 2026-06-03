# Deleting `tasks`

`tasks` looks standalone (it owns the `tasks` folder + table) but it **adds an aggregated `nb_tasks` column to `contacts_summary`** (which lands on the `Contact` type) and ships a **`taskTypes` config prop** — so it fans out almost like a column removal.

## Frontend specifics
- **`nb_tasks` readers:** `CompanyShow.tsx`, `ContactListContent.tsx`, `ContactShow.tsx` (+ test), `ContactListFilter.tsx` (a `nb_tasks@gt` filter), `ContactMergeButton.tsx`, and the FakeRest provider/generators (which increment/decrement it). **Invisible to `\btasks?\b` grep** — grep `nb_tasks` separately.
- **`taskTypes` config prop** — see SKILL.md "Shapes a resource takes". The Tasks `<Card>` has no `validateItemsInUse`.
- **Wrapper components** outside the folder, delete outright: `dashboard/TasksList.tsx`, `contacts/ContactTasksList.tsx`.
- i18n: drop the `tasks` resource block, `task_count`, `upcoming_tasks`, `filters.tasks`, `settings.tasks`, and the import description (both catalogs — see SKILL.md).

## Backend
- Drop the `tasks` table + grants/policies/sequence.
- **MCP edge function:** `mcp/taskListUi.ts` is a ~13 KB guest-HTML "MCP App" — delete outright. Remove the `display_task_list` + `complete_task` tools and their prompt examples in `mcp/index.ts`, and the `tasks` example in `mcp/validateSql.test.ts`. (Note: the `CRM_BASE_URL` env var is driven by the task→contact deep-link, which is really a `contacts` concern — see [`contacts.md`](contacts.md); it only goes dead if contacts is deleted too.)
