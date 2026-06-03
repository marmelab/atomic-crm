# Deleting `deals`

`deals` owns the `deals` + `deal_notes` tables but is woven into **two shared subsystems** (notes, activity log), adds an aggregated `nb_deals` to `companies_summary`, ships **three** config props plus a non-eponymous one, and has a custom dataProvider method — so it fans out almost as wide as a column removal.

## Frontend specifics
- **Shared subsystems** — narrow the notes union to `"contacts"` and the activity-log union to drop `"deal"`; prune the `=== "deals"`/`deal_id`/`DealNote` branches (the `=== "contacts"` checks stay valid). Delete `ActivityLogDealCreated.tsx` + `ActivityLogDealNoteCreated.tsx` outright; drop `getNewDealsAndNotes` in `providers/commons/activity.ts` and `DEAL_CREATED`/`DEAL_NOTE_CREATED` + `ActivityDeal*` in `consts.ts`/`types.ts`. Drop the `"deals"` reference test in `NoteInputs.test.tsx`.
- **Config props** — `dealStages`/`dealCategories`/`dealPipelineStatuses` **plus `currency`**, which is deal-scoped but NOT named after the resource (it lived in the Deals `<Card>`; readers are `DealsChart`/`DealsPipeline`/`CompanyShow`'s deal iterator). Removing `currency` is a judgement call — flag it. The Deals `<Card>` also carries a `validateItemsInUse` helper — exported, unit-tested in `SettingsPage.test.ts` (delete that test file outright), backed by a `crm.settings.validation` i18n block; delete all three.
- **Custom method** — `unarchiveDeal(deal)` in **both** providers (drops from `CrmDataProvider` automatically via the supabase provider's return type).
- **Wrapper components** outside the folder, delete outright: `dashboard/DealsChart.tsx`, `dashboard/DealsPipeline.tsx`. `Dashboard.tsx` keeps both an import **and** a `{totalDeal ? <DealsChart/> : null}` JSX site — remove both. `LatestNotes.tsx` fetches `deal_notes` + renders `<Deal/>`.
- **`nb_deals` readers** (invisible to `\bdeals?\b` grep): `CompanyShow.tsx` (deals tab), `CompanyCard.tsx` (badge). `ContactMergeButton.tsx` shows a `dealsCount` preview.
- i18n: `resources.deals`, `nb_deals`, activity/dashboard/`settings.deals`/`settings.validation` keys; `i18nProvider.test.ts` asserts a `resources.deals.*` key.

## Backend
- Drop the `deals` + `deal_notes` tables, grants, policies, sequences. Update `companies_summary` (drop `count(distinct d.id) as nb_deals` + the `left join public.deals`).
- `activity_log` view: `deals` contributed a `deal` + `deal_note` column to **every** branch **and** two dedicated branches (`deal.created`, `dealNote.created`) — remove both, keep column lists aligned, and drop the `deal_note → dealNote` rename in the supabase provider's `getList("activity_log")`.
- **MCP:** **no** dedicated MCP App — only the `DealsTable` Kysely interface in `_shared/db.ts`, the deal-reassignment step in `merge_contacts/index.ts` (its removal leaves the `sql` import unused — drop it), and deal mentions in the `query`/`mutate` **prompt-text examples** in `mcp/index.ts` (rewrite the examples, don't just delete lines).

## grep — benign matches to leave
- `deals` matches `ideal` (an English comment in `RelativeDate.tsx`) and the French `affaires`/`Chiffre d'affaires` (= revenue, not a deal, in `frenchCrmMessages.ts`) — filter them out and don't blind-delete French lines.
