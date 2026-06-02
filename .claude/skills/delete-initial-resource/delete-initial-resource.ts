// Run with `npx -y tsx .claude/skills/delete-initial-resource/delete-initial-resource.ts`.
// `process` is declared locally because this standalone script lives outside the
// project's tsconfig and so doesn't pick up the global @types/node.
declare const process: {
  cwd(): string;
  argv: string[];
  exit(code?: number): never;
};
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

// ================================ CONSTANTS ================================
const initialResource = [
  "contacts",
  "companies",
  "deals",
  "tags",
  "tasks",
] as const;
const dependentFiles: ResourceFiles = {
  companies: [
    // `companies` is a SPINE/LINK resource like contacts: it owns the companies
    // table AND is a `company_id` link on BOTH `contacts` and `deals`, AND its
    // `companies_summary` view exposes aggregated `nb_contacts`/`nb_deals` plus a
    // denormalized `company_name` that lands on the `Contact` type. So it fans out
    // far wider than the standalone folder. CONFIRM CASCADE SCOPE with the user:
    // remove `company_id` fully (cleanest — drops the column from Contact/Deal,
    // CSVs, merge, generators) vs leave it as an orphaned shell. See SKILL.md.
    "src/components/atomic-crm/types.ts", // Company, ActivityCompanyCreated, Contact.company_id+company_name, Deal.company_id
    "src/components/atomic-crm/consts.ts", // COMPANY_CREATED

    // Activity log — a dedicated `company.created` branch (ActivityLogCompanyCreated,
    // delete outright) PLUS a `"company"` member in the context union. Narrowing the
    // union turns every `=== "company"` check into a type error, so prune them in the
    // contact/deal render components too (the `company_id` ReferenceField / CompanyAvatar):
    "src/components/atomic-crm/activity/ActivityLogCompanyCreated.tsx", // delete outright
    "src/components/atomic-crm/activity/ActivityLog.tsx", // companyId prop + company_id filter; context union
    "src/components/atomic-crm/activity/ActivityLogContext.tsx", // "company"|"contact"|"deal"|"all" union
    "src/components/atomic-crm/activity/ActivityLogIterator.tsx", // COMPANY_CREATED import + branch
    "src/components/atomic-crm/activity/ActivityLogContactCreated.tsx", // company_id "to <company>" block + context==="company"
    "src/components/atomic-crm/activity/ActivityLogContactNoteCreated.tsx", // context==="company"
    "src/components/atomic-crm/activity/ActivityLogDealCreated.tsx", // company_id "to <company>" block + context==="company"
    "src/components/atomic-crm/activity/ActivityLogDealNoteCreated.tsx", // CompanyAvatar + "at_company <company>" + context==="company"
    "src/components/atomic-crm/providers/commons/activity.ts", // getNewCompanies fetcher + company_id on contact/deal activities + companyId param

    // `companySectors` config prop (like dealStages/taskTypes — fans out beyond the folder).
    // The Companies settings <Card> holds only a `companySectors` ArrayInput (NO validateItemsInUse):
    "src/components/atomic-crm/root/defaultConfiguration.ts", // defaultCompanySectors + the default config object
    "src/components/atomic-crm/root/ConfigurationContext.tsx", // companySectors in the interface
    "src/components/atomic-crm/settings/SettingsPage.tsx", // the Companies <Card> AND the section-list entry + transform/defaultValues
    "src/App.tsx", // the prop-list doc comment

    // Contacts feature — `company_id` is a contact field with a company selector,
    // a company avatar/name in the show + lists, and `company_name` (DENORMALIZED
    // from companies_summary) used for "position_at_company". `company_name` is
    // INVISIBLE to a \bcompan(y|ies)\b grep — grep `company_name` separately:
    "src/components/atomic-crm/contacts/ContactInputs.tsx", // AutocompleteCompanyInput ReferenceInput
    "src/components/atomic-crm/contacts/ContactShow.tsx", // company avatar/name (desktop + mobile)
    "src/components/atomic-crm/contacts/ContactListContent.tsx", // company ReferenceField (desktop + mobile)
    "src/components/atomic-crm/contacts/ContactList.tsx", // exporter fetchRelatedRecords companies + `company` CSV column
    "src/components/atomic-crm/contacts/contactModel.ts", // exportToVCard `company?` param + ORG: line
    "src/components/atomic-crm/contacts/ExportVCardButton.tsx", // useGetOne("companies") + passes company to exportToVCard
    "src/components/atomic-crm/contacts/useContactImport.tsx", // getCompanies cache, company column, company_id mapping
    "src/components/atomic-crm/contacts/Avatar.tsx", // stale "if we come from company page" comment only
    "src/components/atomic-crm/contacts/contacts_export.csv", // drop the `company` column (header + every row)

    // Deals feature — `company_id` is a required deal field with a selector + a
    // company avatar in card/show/edit + a company filter in the list:
    "src/components/atomic-crm/deals/DealInputs.tsx", // AutocompleteCompanyInput ReferenceInput (required)
    "src/components/atomic-crm/deals/DealCard.tsx", // company ReferenceField title + CompanyAvatar
    "src/components/atomic-crm/deals/DealShow.tsx", // CompanyAvatar header
    "src/components/atomic-crm/deals/DealEdit.tsx", // CompanyAvatar header
    "src/components/atomic-crm/deals/DealList.tsx", // company_id ReferenceInput filter
    "src/components/atomic-crm/deals/OnlyMineInput.tsx", // MISLABELED i18n key resources.companies.filters.only_mine — re-point to deals
    "src/components/atomic-crm/deals/ContactList.tsx", // company_name in position_at_company

    // SHARED notes subsystem — the note header avatar resolved a `company_id`
    // ReferenceField (CompanyAvatar). Remove it from Note.tsx:
    "src/components/atomic-crm/notes/Note.tsx",

    // Dashboard — HotContacts shows company_name; DealsPipeline leftAvatar is a CompanyAvatar:
    "src/components/atomic-crm/dashboard/HotContacts.tsx", // company_name in secondaryText
    "src/components/atomic-crm/dashboard/DealsPipeline.tsx", // CompanyAvatar leftAvatar

    // Misc — ContactOption renders company_name; the JSON importer treats
    // `companies` as a top-level importable TYPE (importCompany, $.companies.* path,
    // CompanyImport/isCompany, mapSizeToCategory, companySectors validation, stats/
    // failedImports/idsMaps keys) AND maps company_id onto imported contacts:
    "src/components/atomic-crm/misc/ContactOption.tsx", // company_name
    "src/components/atomic-crm/misc/useImportFromJson.ts", // whole importCompany branch + contact company_id
    "src/components/atomic-crm/misc/ImportPage.tsx", // companies stats row + help text
    "src/components/atomic-crm/misc/import-sample.json", // drop the companies section + contact company_id

    // Providers — getList/getOne route companies -> companies_summary (supabase);
    // FakeRest keeps nb_contacts/nb_deals via updateCompany + company callbacks +
    // processCompanyLogo + fetchAndUpdateCompanyData (company_name on contacts) and
    // reassigns companies in the sales beforeDelete; merge_contacts merges company_id:
    "src/components/atomic-crm/providers/supabase/dataProvider.ts", // processCompanyLogo, companies->companies_summary getList/getOne, contacts FTS company_name, companies lifecycle block
    "src/components/atomic-crm/providers/fakerest/dataProvider.ts", // processCompanyLogo, fetchAndUpdateCompanyData, updateCompany, companies callbacks, nb_contacts/nb_deals, sales beforeDelete reassign, getActivityLog companyId arg
    "src/components/atomic-crm/providers/commons/getCompanyAvatar.ts", // delete outright (+ .test.ts)
    "src/components/atomic-crm/providers/commons/mergeContacts.ts", // company_id merge line
    "src/components/atomic-crm/providers/fakerest/dataGenerator/companies.ts", // delete outright
    "src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts", // generateCompanies call + generation order
    "src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts", // Db.companies
    "src/components/atomic-crm/providers/fakerest/dataGenerator/contacts.ts", // picks a company, derives sales_id/first_seen from it — rewrite to a random sale + randomDate()
    "src/components/atomic-crm/providers/fakerest/dataGenerator/deals.ts", // picks a company + filters contacts by company_id — rewrite to random contacts + random sale
    "src/components/atomic-crm/providers/commons/englishCrmMessages.ts", // resources.companies block, company_id, company_name, position_at_company, settings.companies, activity you_added_company/at_company (dead keys — removal optional, see SKILL)
    "src/components/atomic-crm/providers/commons/frenchCrmMessages.ts", // same (uses … escapes — see SKILL note)

    // Layout / story harness:
    "src/components/atomic-crm/layout/Header.tsx", // companies nav tab + path matcher
    "src/components/atomic-crm/layout/MobileNavigation.tsx", // companies path matcher
    "src/test/StoryWrapper.tsx", // createCrmDb companies key + company_id/company_name on buildContact
    "test-data/contacts.csv", // company_id/company_name/company columns (importer ignores them — optional, see SKILL)
  ],
  contacts: [
    // `contacts` is the SPINE of the CRM and the WIDEST deletion of the five:
    // notes attach to it, tasks belong to it, tags is a field on it, companies
    // aggregate it (nb_contacts), deals link it (contact_ids), and the activity
    // log + JSON import + merge subsystems all revolve around it. Removing it
    // orphans notes/tasks/tags (their only attachment target disappears) — so
    // CONFIRM THE CASCADE SCOPE with the user first (keep them as compiling
    // shells, or delete them too). See SKILL.md.
    "src/components/atomic-crm/types.ts", // Contact, ContactNote, Company.nb_contacts, Task.contact_id, ActivityContact*
    "src/components/atomic-crm/consts.ts", // CONTACT_CREATED, CONTACT_NOTE_CREATED

    // Activity log — TWO dedicated branches (contact.created, contactNote.created)
    // to delete, plus a "contact" member in the context union to drop:
    "src/components/atomic-crm/activity/ActivityLogContactCreated.tsx", // delete outright
    "src/components/atomic-crm/activity/ActivityLogContactNoteCreated.tsx", // delete outright
    "src/components/atomic-crm/activity/ActivityLogIterator.tsx",
    "src/components/atomic-crm/activity/ActivityLog.tsx", // context: "company"|"contact"|"deal"|"all"
    "src/components/atomic-crm/activity/ActivityLogContext.tsx", // same union
    "src/components/atomic-crm/providers/commons/activity.ts", // getNewContactsAndNotes (FakeRest feed)

    // Dashboard — HotContacts is a contacts widget and DashboardStepper is a
    // contact-onboarding wizard (delete both); Dashboard/MobileDashboard gate on
    // contact counts; LatestNotes mixes contact_notes + a <Contact> renderer:
    "src/components/atomic-crm/dashboard/HotContacts.tsx", // delete outright
    "src/components/atomic-crm/dashboard/DashboardStepper.tsx", // delete outright (contact onboarding)
    "src/components/atomic-crm/dashboard/Dashboard.tsx",
    "src/components/atomic-crm/dashboard/MobileDashboard.tsx",
    "src/components/atomic-crm/dashboard/LatestNotes.tsx",
    "src/components/atomic-crm/dashboard/TasksList.tsx", // <AddTask selectContact/>

    // Companies — nb_contacts fans out like nb_tasks and is INVISIBLE to a
    // \bcontacts?\b grep (the `_` is a word char) — grep `nb_contacts` separately:
    "src/components/atomic-crm/companies/CompanyShow.tsx", // contacts tab + ContactsIterator + nb_contacts
    "src/components/atomic-crm/companies/CompanyCard.tsx", // nb_contacts avatar group
    "src/components/atomic-crm/companies/CompanyList.tsx", // nb_contacts sort field

    // SHARED notes subsystem — generic over `reference: "contacts" | "deals"`.
    // Narrow the union to "deals". GOTCHA: DealNote.status is typed `undefined`
    // (ContactNote-compat), so `useFormContext<DealNote>` collapses status to
    // `never` and breaks the status hydration in NoteInputs — widen with
    // `Omit<DealNote, "status"> & { status?: string }`. The contact-ONLY mobile
    // note components are dead once contacts is gone — delete them outright
    // (and their stories/tests + the index.ts re-export):
    "src/components/atomic-crm/notes/foreignKeyMapping.ts", // drop the contacts key
    "src/components/atomic-crm/notes/NoteInputs.tsx", // narrow; drop contactOptionText + status hydration
    "src/components/atomic-crm/notes/NoteInputs.test.tsx", // drop the "contacts" reference test
    "src/components/atomic-crm/notes/NoteCreate.tsx",
    "src/components/atomic-crm/notes/NotesIterator.tsx",
    "src/components/atomic-crm/notes/Note.tsx", // ContactNote|DealNote -> DealNote
    "src/components/atomic-crm/notes/NoteAttachments.tsx", // same union
    "src/components/atomic-crm/notes/index.ts", // drops the NotesIteratorMobile re-export
    "src/components/atomic-crm/notes/NoteCreateSheet.tsx", // delete outright (contact-only mobile)
    "src/components/atomic-crm/notes/NoteEditSheet.tsx", // delete outright
    "src/components/atomic-crm/notes/NoteShowPage.tsx", // delete outright
    "src/components/atomic-crm/notes/NotesIteratorMobile.tsx", // delete (+ .stories + .test)
    "src/components/atomic-crm/notes/NoteInputsMobile.tsx", // delete (+ .stories + .test)

    // Tasks belong to contacts (contact_id) and carry nb_tasks bookkeeping.
    // Strip the contact-linking UI/queries (keep tasks as a standalone shell):
    "src/components/atomic-crm/tasks/AddTask.tsx",
    "src/components/atomic-crm/tasks/Task.tsx", // showContact + contact ReferenceField
    "src/components/atomic-crm/tasks/TaskCreateSheet.tsx",
    "src/components/atomic-crm/tasks/TaskCreateSheet.stories.tsx", // uses buildContact
    "src/components/atomic-crm/tasks/TaskCreateSheet.test.tsx", // delete (contact-create flow)
    "src/components/atomic-crm/tasks/TaskEditSheet.tsx",
    "src/components/atomic-crm/tasks/TaskFormContent.tsx", // selectContact reference input
    "src/components/atomic-crm/tasks/TasksIterator.tsx", // showContact
    "src/components/atomic-crm/tasks/TasksListFilter.tsx", // showContact
    "src/components/atomic-crm/tasks/TasksListFilter.test.tsx",
    "src/components/atomic-crm/tasks/TasksListByDueDate.tsx", // filterByContact + showContact

    // Deals link contacts via `contact_ids` — keep the column but remove the UI
    // (the selector, the per-deal contact list, the contacts-gated empty state):
    "src/components/atomic-crm/deals/DealInputs.tsx", // contact_ids ReferenceArrayInput + contactOptionText
    "src/components/atomic-crm/deals/DealShow.tsx", // contact_ids ReferenceArrayField + <ContactList/>
    "src/components/atomic-crm/deals/ContactList.tsx", // delete outright (the deal's contact list)
    "src/components/atomic-crm/deals/DealEmpty.tsx", // drop the "create a contact first" gating

    // Misc — ContactOption is a shared option renderer (delete); the JSON
    // importer is heavily contact-coupled (importContact/importNote, contactGender):
    "src/components/atomic-crm/misc/ContactOption.tsx", // delete outright
    "src/components/atomic-crm/misc/useImportFromJson.ts", // importContact, importNote(contact_notes), contactGender, stats/idsMaps
    "src/components/atomic-crm/misc/ImportPage.tsx", // contacts/notes stats rows + help text
    "src/components/atomic-crm/misc/import-sample.json", // drop the contacts + notes sections

    // Providers — `mergeContacts` is a custom dataProvider method in BOTH
    // providers (part of the CrmDataProvider type) backed by the merge_contacts
    // edge+SQL fn; getContactAvatar generates avatars; the supabase getList
    // routes contacts -> contacts_summary and remaps activity_log
    // contact_note -> contactNote:
    "src/components/atomic-crm/providers/commons/mergeContacts.ts", // delete outright
    "src/components/atomic-crm/providers/commons/getContactAvatar.ts", // delete (+ .test.ts)
    "src/components/atomic-crm/providers/fakerest/dataProvider.ts", // mergeContacts, processContactAvatar, contact/contact_notes callbacks, tasks nb_tasks callbacks, sales beforeDelete reassign
    "src/components/atomic-crm/providers/supabase/dataProvider.ts", // mergeContacts, contacts->contacts_summary routing, activity_log contactNote remap, contact(_notes) lifecycle
    "src/components/atomic-crm/providers/fakerest/dataGenerator/contacts.ts", // delete outright
    "src/components/atomic-crm/providers/fakerest/dataGenerator/contactNotes.ts", // delete outright
    "src/components/atomic-crm/providers/fakerest/dataGenerator/finalize.ts", // delete (sets contact status from notes)
    "src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts", // generateContacts/ContactNotes + finalize
    "src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts", // Db.contacts, Db.contact_notes
    "src/components/atomic-crm/providers/fakerest/dataGenerator/deals.ts", // contact_ids generation
    "src/components/atomic-crm/providers/fakerest/dataGenerator/tasks.ts", // contact_id + nb_tasks increment
    "src/components/atomic-crm/providers/fakerest/dataGenerator/companies.ts", // nb_contacts seed
    "src/components/atomic-crm/providers/commons/englishCrmMessages.ts", // resources.contacts block, nb_contacts, position_at_company, etc.
    "src/components/atomic-crm/providers/commons/frenchCrmMessages.ts", // same (uses … escapes — see SKILL note)

    // Layout / login / story harness:
    "src/components/atomic-crm/layout/Header.tsx", // contacts nav tab + path matcher
    "src/components/atomic-crm/layout/MobileNavigation.tsx", // contacts nav + ContactCreateSheet + NoteCreateSheet + contact_id
    "src/components/atomic-crm/login/SignupPage.tsx", // redirectTo: "/contacts"
    "src/test/StoryWrapper.tsx", // buildContact builder + createCrmDb contacts/contact_notes keys
  ],
  deals: [
    // `deals` LOOKS standalone (it owns the deals + deal_notes tables) but it
    // is woven into two SHARED subsystems — notes and the activity log — adds an
    // aggregated `nb_deals` column to `companies_summary`, ships THREE config props
    // (dealStages/dealCategories/dealPipelineStatuses) PLUS a `currency` prop that is
    // NOT named after the resource, and has a custom `unarchiveDeal` dataProvider
    // method. So it fans out almost as wide as a column removal.
    "src/components/atomic-crm/types.ts", // Deal, DealNote, ActivityDeal*, DealStage, Company.nb_deals
    "src/components/atomic-crm/consts.ts", // DEAL_CREATED, DEAL_NOTE_CREATED
    // Deal-only components living OUTSIDE deals/ — delete these outright:
    "src/components/atomic-crm/dashboard/DealsChart.tsx",
    "src/components/atomic-crm/dashboard/DealsPipeline.tsx",
    "src/components/atomic-crm/activity/ActivityLogDealCreated.tsx",
    "src/components/atomic-crm/activity/ActivityLogDealNoteCreated.tsx",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/deals.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/dealNotes.ts",
    // SHARED notes subsystem — parameterised by `reference: "contacts" | "deals"`.
    // Narrow the union to "contacts" and prune the now-dead deal branches (the
    // `=== "contacts"` checks stay valid; only `=== "deals"`/`deal_id` must go):
    "src/components/atomic-crm/notes/foreignKeyMapping.ts",
    "src/components/atomic-crm/notes/NoteInputs.tsx",
    "src/components/atomic-crm/notes/NoteCreate.tsx",
    "src/components/atomic-crm/notes/Note.tsx",
    "src/components/atomic-crm/notes/NoteAttachments.tsx",
    "src/components/atomic-crm/notes/NotesIterator.tsx",
    "src/components/atomic-crm/notes/NoteInputs.test.tsx", // drops the "deals" reference test
    // SHARED activity-log subsystem — branches + a `"deal"` member in the context union:
    "src/components/atomic-crm/activity/ActivityLogIterator.tsx",
    "src/components/atomic-crm/activity/ActivityLog.tsx", // context: "company"|"contact"|"deal"|"all"
    "src/components/atomic-crm/activity/ActivityLogContext.tsx", // same union
    // Dashboard:
    "src/components/atomic-crm/dashboard/Dashboard.tsx", // totalDeal + <DealsChart/>
    "src/components/atomic-crm/dashboard/LatestNotes.tsx", // deal_notes fetch + <Deal/> renderer
    // Providers — note the `unarchiveDeal` custom method lives in BOTH providers and
    // is part of the `CrmDataProvider` type (derived from the supabase provider's return):
    "src/components/atomic-crm/providers/commons/activity.ts", // getNewDealsAndNotes
    "src/components/atomic-crm/providers/commons/mergeContacts.ts", // reassign deal contact_ids
    "src/components/atomic-crm/providers/fakerest/dataProvider.ts", // unarchiveDeal, deal(_notes) callbacks, sales beforeDelete reassign
    "src/components/atomic-crm/providers/supabase/dataProvider.ts", // unarchiveDeal, deal(_notes) callbacks, activity_log deal_note→dealNote remap
    "src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/companies.ts", // nb_deals seed
    "src/components/atomic-crm/providers/commons/englishCrmMessages.ts", // resources.deals, nb_deals, activity, dashboard, settings.deals, settings.validation
    "src/components/atomic-crm/providers/commons/frenchCrmMessages.ts", // same (uses … escapes — see SKILL note)
    "src/components/atomic-crm/providers/commons/i18nProvider.test.ts", // asserts a resources.deals.* key
    // Config props — dealStages/dealCategories/dealPipelineStatuses AND `currency`
    // (currency is deal-scoped but NOT named after the resource — easy to miss):
    "src/components/atomic-crm/root/defaultConfiguration.ts",
    "src/components/atomic-crm/root/ConfigurationContext.tsx",
    "src/components/atomic-crm/settings/SettingsPage.tsx", // the Deals <Card>, the section-list entry, validateItemsInUse + currency input
    "src/components/atomic-crm/settings/SettingsPage.test.ts", // only tests validateItemsInUse — delete outright
    "src/App.tsx", // the prop-list doc comment
    // Companies / contacts / layout consumers (nb_deals badges invisible to \bdeals?\b grep):
    "src/components/atomic-crm/companies/CompanyShow.tsx", // deals tab + DealsIterator + nb_deals
    "src/components/atomic-crm/companies/CompanyCard.tsx", // nb_deals badge
    "src/components/atomic-crm/contacts/ContactMergeButton.tsx", // dealsCount preview
    "src/components/atomic-crm/layout/Header.tsx", // deals nav tab + path matcher
    "src/components/atomic-crm/layout/MobileNavigation.tsx", // deals path matcher
    "src/test/StoryWrapper.tsx", // deals: [] + deal_notes: [] db shape
  ],
  tags: [
    // `tags` is a column on `contacts`, so its references are woven through
    // the contacts feature, the providers, i18n, tests and the sample data.
    "src/components/atomic-crm/types.ts",
    // Tag-only components living under contacts/ — delete these outright:
    "src/components/atomic-crm/contacts/TagsList.tsx",
    "src/components/atomic-crm/contacts/TagsListEdit.tsx",
    "src/components/atomic-crm/contacts/BulkTagButton.tsx",
    // Consumers of the components above + the contacts.tags field:
    "src/components/atomic-crm/contacts/ContactShow.tsx",
    "src/components/atomic-crm/contacts/ContactAside.tsx",
    "src/components/atomic-crm/contacts/ContactListContent.tsx",
    "src/components/atomic-crm/contacts/ContactList.tsx",
    "src/components/atomic-crm/contacts/ContactListFilter.tsx",
    "src/components/atomic-crm/contacts/contactModel.ts",
    "src/components/atomic-crm/contacts/useContactImport.tsx",
    "src/components/atomic-crm/companies/CompanyShow.tsx",
    "src/components/atomic-crm/misc/useImportFromJson.ts",
    "src/components/atomic-crm/providers/commons/mergeContacts.ts",
    // i18n: drop the `bulk_tag` block, `filters.tags`, and the `tags` resource block:
    "src/components/atomic-crm/providers/commons/englishCrmMessages.ts",
    "src/components/atomic-crm/providers/commons/frenchCrmMessages.ts",
    // FakeRest data layer:
    "src/components/atomic-crm/providers/fakerest/dataGenerator/contacts.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts",
    // Tests, stories and sample data (the contacts.tags column lives in the CSVs):
    "src/components/atomic-crm/contacts/ContactList.stories.tsx",
    "src/components/atomic-crm/contacts/ContactList.test.tsx",
    "src/test/StoryWrapper.tsx",
    "src/components/atomic-crm/contacts/contacts_export.csv",
    "test-data/contacts.csv",
  ],
  tasks: [
    // `tasks` is a standalone resource, BUT it also adds an aggregated
    // `nb_tasks` column to the `contacts_summary` view (surfaced on the
    // `Contact` type) and ships a `taskTypes` configuration prop — so its
    // references fan out almost as wide as a column removal.
    "src/components/atomic-crm/types.ts",
    // Task-only wrapper components living outside tasks/ — delete outright:
    "src/components/atomic-crm/dashboard/TasksList.tsx",
    "src/components/atomic-crm/contacts/ContactTasksList.tsx",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/tasks.ts",
    // Consumers of the tasks resource / the `nb_tasks` contact field:
    "src/components/atomic-crm/dashboard/Dashboard.tsx",
    "src/components/atomic-crm/layout/MobileNavigation.tsx",
    "src/components/atomic-crm/contacts/ContactShow.tsx",
    "src/components/atomic-crm/contacts/ContactShow.test.tsx",
    "src/components/atomic-crm/contacts/ContactAside.tsx",
    "src/components/atomic-crm/contacts/ContactListContent.tsx", // nb_tasks badge — invisible to \btasks?\b grep
    "src/components/atomic-crm/contacts/ContactListFilter.tsx",
    "src/components/atomic-crm/contacts/ContactMergeButton.tsx",
    "src/components/atomic-crm/companies/CompanyShow.tsx", // nb_tasks badge — invisible to \btasks?\b grep
    // Import / merge logic:
    "src/components/atomic-crm/misc/useImportFromJson.ts",
    "src/components/atomic-crm/misc/ImportPage.tsx",
    "src/components/atomic-crm/misc/import-sample.json",
    "src/components/atomic-crm/providers/commons/mergeContacts.ts",
    // FakeRest data layer (generators + provider callbacks that keep nb_tasks):
    "src/components/atomic-crm/providers/fakerest/dataProvider.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/contacts.ts", // nb_tasks
    "src/test/StoryWrapper.tsx", // tasks: [] db shape + nb_tasks on the contact builder
    // i18n: drop the `tasks` resource block, `task_count`, `upcoming_tasks`,
    // `filters.tasks`, `settings.tasks` and the import description:
    "src/components/atomic-crm/providers/commons/englishCrmMessages.ts",
    "src/components/atomic-crm/providers/commons/frenchCrmMessages.ts",
    // `taskTypes` configuration prop (fans out like dealStages/noteStatuses):
    "src/components/atomic-crm/root/defaultConfiguration.ts",
    "src/components/atomic-crm/root/ConfigurationContext.tsx",
    "src/components/atomic-crm/settings/SettingsPage.tsx", // the Tasks <Card> AND the section-list entry
    "src/App.tsx", // the prop-list doc comment
  ],
} as const;
const sharedDependentFiles: string[] = [
  "src/components/atomic-crm/root/CRM.tsx",
];
const resourceFilesPath = "src/components/atomic-crm" as const;

// ================================   TYPES   ================================
type InitialResource = (typeof initialResource)[number];
type DependentFile = string;
type ResourceFiles = Record<InitialResource, DependentFile[]>;

// ================================ FUNCTIONS ================================
const main = async () => {
  const resourcesToDelete = getResources();
  const basePath = process.cwd();
  for (const resource of resourcesToDelete) {
    await deleteIsolatedFiles(resource, basePath);
  }
  returnDependentFiles(resourcesToDelete);
};

// Get the resources to delete from the command line arguments (one or more),
// validate each one, and de-duplicate.
const getResources = (): InitialResource[] => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Please provide at least one resource to delete (you may pass several).",
    );
    process.exit(1);
  }

  const invalid = args.filter(
    (resource) => !initialResource.includes(resource as InitialResource),
  );
  if (invalid.length > 0) {
    console.error(
      `Resource(s) ${invalid
        .map((resource) => `"${resource}"`)
        .join(", ")} do not exist. Valid resources: ${initialResource.join(
        ", ",
      )}.`,
    );
    process.exit(1);
  }

  return [...new Set(args)] as InitialResource[];
};

// Delete the resource folder and its files.
const deleteIsolatedFiles = async (
  resource: InitialResource,
  basePath: string,
) => {
  const folderPath = `${basePath}/${resourceFilesPath}/${resource}`;

  if (!existsSync(folderPath)) {
    console.error(
      `Folder for resource "${resource}" does not exist. Skipping deletion of isolated files.`,
    );
    process.exit(1);
  }

  await rm(folderPath, { recursive: true, force: true });
};

// Return to Claude all the files dependent on the deleted resource(s).
// When several resources are deleted at once, merge and de-duplicate their
// dependent-file lists, then drop any file that lives inside a folder we just
// deleted (e.g. `companies/CompanyShow.tsx` is a dependent of `contacts`, but
// it is gone once `companies` is deleted too).
const returnDependentFiles = (resources: InitialResource[]) => {
  const deletedFolders = resources.map(
    (resource) => `${resourceFilesPath}/${resource}/`,
  );

  const merged = new Set<DependentFile>([
    ...resources.flatMap((resource) => dependentFiles[resource]),
    ...sharedDependentFiles,
  ]);

  const allDependentFilesToReturn = [...merged]
    .filter((file) => !deletedFolders.some((folder) => file.startsWith(folder)))
    .sort();

  // eslint-disable-next-line no-console
  console.log(
    `Dependent files for resource(s) ${resources
      .map((resource) => `"${resource}"`)
      .join(", ")}:\n`,
    allDependentFilesToReturn,
  );
  process.exit(0);
};

// ================================  MAIN CALL  ================================
await main();
