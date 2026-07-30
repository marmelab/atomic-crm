// Run with `node .claude/skills/delete-initial-resource/delete-initial-resource.ts`
// (Node >= 22.18 strips TypeScript types natively; on older Node use `npx -y tsx <...>`).
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
    "src/components/atomic-crm/types.ts",
    "src/components/atomic-crm/consts.ts",
    "src/components/atomic-crm/activity/ActivityLogCompanyCreated.tsx",
    "src/components/atomic-crm/activity/ActivityLog.tsx",
    "src/components/atomic-crm/activity/ActivityLogContext.tsx",
    "src/components/atomic-crm/activity/ActivityLogIterator.tsx",
    "src/components/atomic-crm/activity/ActivityLogContactCreated.tsx",
    "src/components/atomic-crm/activity/ActivityLogContactNoteCreated.tsx",
    "src/components/atomic-crm/activity/ActivityLogDealCreated.tsx",
    "src/components/atomic-crm/activity/ActivityLogDealNoteCreated.tsx",
    "src/components/atomic-crm/providers/commons/activity.ts",
    "src/components/atomic-crm/root/defaultConfiguration.ts",
    "src/components/atomic-crm/root/ConfigurationContext.tsx",
    "src/components/atomic-crm/settings/SettingsPage.tsx",
    "src/App.tsx",
    "src/components/atomic-crm/contacts/ContactInputs.tsx",
    "src/components/atomic-crm/contacts/ContactShow.tsx",
    "src/components/atomic-crm/contacts/ContactListContent.tsx",
    "src/components/atomic-crm/contacts/ContactList.tsx",
    "src/components/atomic-crm/contacts/contactModel.ts",
    "src/components/atomic-crm/contacts/ExportVCardButton.tsx",
    "src/components/atomic-crm/contacts/useContactImport.tsx",
    "src/components/atomic-crm/contacts/Avatar.tsx",
    "src/components/atomic-crm/contacts/contacts_export.csv",
    "src/components/atomic-crm/deals/DealInputs.tsx",
    "src/components/atomic-crm/deals/DealCard.tsx",
    "src/components/atomic-crm/deals/DealShow.tsx",
    "src/components/atomic-crm/deals/DealEdit.tsx",
    "src/components/atomic-crm/deals/DealList.tsx",
    "src/components/atomic-crm/deals/OnlyMineInput.tsx",
    "src/components/atomic-crm/deals/ContactList.tsx",
    "src/components/atomic-crm/notes/Note.tsx",
    "src/components/atomic-crm/dashboard/HotContacts.tsx",
    "src/components/atomic-crm/dashboard/DealsPipeline.tsx",
    "src/components/atomic-crm/misc/ContactOption.tsx",
    "src/components/atomic-crm/misc/useImportFromJson.ts",
    "src/components/atomic-crm/misc/ImportPage.tsx",
    "src/components/atomic-crm/misc/import-sample.json",
    "src/components/atomic-crm/providers/supabase/dataProvider.ts",
    "src/components/atomic-crm/providers/fakerest/dataProvider.ts",
    "src/components/atomic-crm/providers/commons/getCompanyAvatar.ts",
    "src/components/atomic-crm/providers/commons/mergeContacts.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/companies.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/contacts.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/deals.ts",
    "src/components/atomic-crm/providers/commons/englishCrmMessages.ts",
    "src/components/atomic-crm/providers/commons/frenchCrmMessages.ts",
    "src/components/atomic-crm/layout/Header.tsx",
    "src/components/atomic-crm/layout/MobileNavigation.tsx",
    "src/test/StoryWrapper.tsx",
    "test-data/contacts.csv",
  ],
  contacts: [
    "src/components/atomic-crm/types.ts",
    "src/components/atomic-crm/consts.ts",
    "src/components/atomic-crm/activity/ActivityLogContactCreated.tsx",
    "src/components/atomic-crm/activity/ActivityLogContactNoteCreated.tsx",
    "src/components/atomic-crm/activity/ActivityLogIterator.tsx",
    "src/components/atomic-crm/activity/ActivityLog.tsx",
    "src/components/atomic-crm/activity/ActivityLogContext.tsx",
    "src/components/atomic-crm/providers/commons/activity.ts",
    "src/components/atomic-crm/dashboard/HotContacts.tsx",
    "src/components/atomic-crm/dashboard/DashboardStepper.tsx",
    "src/components/atomic-crm/dashboard/Dashboard.tsx",
    "src/components/atomic-crm/dashboard/MobileDashboard.tsx",
    "src/components/atomic-crm/dashboard/LatestNotes.tsx",
    "src/components/atomic-crm/dashboard/TasksList.tsx",
    "src/components/atomic-crm/companies/CompanyShow.tsx",
    "src/components/atomic-crm/companies/CompanyCard.tsx",
    "src/components/atomic-crm/companies/CompanyList.tsx",
    "src/components/atomic-crm/notes/foreignKeyMapping.ts",
    "src/components/atomic-crm/notes/NoteInputs.tsx",
    "src/components/atomic-crm/notes/NoteInputs.test.tsx",
    "src/components/atomic-crm/notes/NoteCreate.tsx",
    "src/components/atomic-crm/notes/NotesIterator.tsx",
    "src/components/atomic-crm/notes/Note.tsx",
    "src/components/atomic-crm/notes/NoteAttachments.tsx",
    "src/components/atomic-crm/notes/index.ts",
    "src/components/atomic-crm/notes/NoteCreateSheet.tsx",
    "src/components/atomic-crm/notes/NoteEditSheet.tsx",
    "src/components/atomic-crm/notes/NoteShowPage.tsx",
    "src/components/atomic-crm/notes/NotesIteratorMobile.tsx",
    "src/components/atomic-crm/notes/NoteInputsMobile.tsx",
    "src/components/atomic-crm/tasks/AddTask.tsx",
    "src/components/atomic-crm/tasks/Task.tsx",
    "src/components/atomic-crm/tasks/TaskCreateSheet.tsx",
    "src/components/atomic-crm/tasks/TaskCreateSheet.stories.tsx",
    "src/components/atomic-crm/tasks/TaskCreateSheet.test.tsx",
    "src/components/atomic-crm/tasks/TaskEditSheet.tsx",
    "src/components/atomic-crm/tasks/TaskFormContent.tsx",
    "src/components/atomic-crm/tasks/TasksIterator.tsx",
    "src/components/atomic-crm/tasks/TasksListFilter.tsx",
    "src/components/atomic-crm/tasks/TasksListFilter.test.tsx",
    "src/components/atomic-crm/tasks/TasksListByDueDate.tsx",
    "src/components/atomic-crm/deals/DealInputs.tsx",
    "src/components/atomic-crm/deals/DealShow.tsx",
    "src/components/atomic-crm/deals/ContactList.tsx",
    "src/components/atomic-crm/deals/DealEmpty.tsx",
    "src/components/atomic-crm/misc/ContactOption.tsx",
    "src/components/atomic-crm/misc/useImportFromJson.ts",
    "src/components/atomic-crm/misc/ImportPage.tsx",
    "src/components/atomic-crm/misc/import-sample.json",
    "src/components/atomic-crm/providers/commons/mergeContacts.ts",
    "src/components/atomic-crm/providers/commons/getContactAvatar.ts",
    "src/components/atomic-crm/providers/fakerest/dataProvider.ts",
    "src/components/atomic-crm/providers/supabase/dataProvider.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/contacts.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/contactNotes.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/finalize.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/deals.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/tasks.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/companies.ts",
    "src/components/atomic-crm/providers/commons/englishCrmMessages.ts",
    "src/components/atomic-crm/providers/commons/frenchCrmMessages.ts",
    "src/components/atomic-crm/layout/Header.tsx",
    "src/components/atomic-crm/layout/MobileNavigation.tsx",
    "src/components/atomic-crm/login/SignupPage.tsx",
    "src/test/StoryWrapper.tsx",
  ],
  deals: [
    "src/components/atomic-crm/types.ts",
    "src/components/atomic-crm/consts.ts",
    "src/components/atomic-crm/dashboard/DealsChart.tsx",
    "src/components/atomic-crm/dashboard/DealsPipeline.tsx",
    "src/components/atomic-crm/activity/ActivityLogDealCreated.tsx",
    "src/components/atomic-crm/activity/ActivityLogDealNoteCreated.tsx",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/deals.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/dealNotes.ts",
    "src/components/atomic-crm/notes/foreignKeyMapping.ts",
    "src/components/atomic-crm/notes/NoteInputs.tsx",
    "src/components/atomic-crm/notes/NoteCreate.tsx",
    "src/components/atomic-crm/notes/Note.tsx",
    "src/components/atomic-crm/notes/NoteAttachments.tsx",
    "src/components/atomic-crm/notes/NotesIterator.tsx",
    "src/components/atomic-crm/notes/NoteInputs.test.tsx",
    "src/components/atomic-crm/activity/ActivityLogIterator.tsx",
    "src/components/atomic-crm/activity/ActivityLog.tsx",
    "src/components/atomic-crm/activity/ActivityLogContext.tsx",
    "src/components/atomic-crm/dashboard/Dashboard.tsx",
    "src/components/atomic-crm/dashboard/LatestNotes.tsx",
    "src/components/atomic-crm/providers/commons/activity.ts",
    "src/components/atomic-crm/providers/commons/mergeContacts.ts",
    "src/components/atomic-crm/providers/fakerest/dataProvider.ts",
    "src/components/atomic-crm/providers/supabase/dataProvider.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/companies.ts",
    "src/components/atomic-crm/providers/commons/englishCrmMessages.ts",
    "src/components/atomic-crm/providers/commons/frenchCrmMessages.ts",
    "src/components/atomic-crm/providers/commons/i18nProvider.test.ts",
    "src/components/atomic-crm/root/defaultConfiguration.ts",
    "src/components/atomic-crm/root/ConfigurationContext.tsx",
    "src/components/atomic-crm/settings/SettingsPage.tsx",
    "src/components/atomic-crm/settings/SettingsPage.test.ts",
    "src/App.tsx",
    "src/components/atomic-crm/companies/CompanyShow.tsx",
    "src/components/atomic-crm/companies/CompanyCard.tsx",
    "src/components/atomic-crm/contacts/ContactMergeButton.tsx",
    "src/components/atomic-crm/layout/Header.tsx",
    "src/components/atomic-crm/layout/MobileNavigation.tsx",
    "src/test/StoryWrapper.tsx",
  ],
  tags: [
    "src/components/atomic-crm/types.ts",
    "src/components/atomic-crm/contacts/TagsList.tsx",
    "src/components/atomic-crm/contacts/TagsListEdit.tsx",
    "src/components/atomic-crm/contacts/BulkTagButton.tsx",
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
    "src/components/atomic-crm/providers/commons/englishCrmMessages.ts",
    "src/components/atomic-crm/providers/commons/frenchCrmMessages.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/contacts.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts",
    "src/components/atomic-crm/contacts/ContactList.stories.tsx",
    "src/components/atomic-crm/contacts/ContactList.test.tsx",
    "src/test/StoryWrapper.tsx",
    "src/components/atomic-crm/contacts/contacts_export.csv",
    "test-data/contacts.csv",
  ],
  tasks: [
    "src/components/atomic-crm/types.ts",
    "src/components/atomic-crm/dashboard/TasksList.tsx",
    "src/components/atomic-crm/contacts/ContactTasksList.tsx",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/tasks.ts",
    "src/components/atomic-crm/dashboard/Dashboard.tsx",
    "src/components/atomic-crm/layout/MobileNavigation.tsx",
    "src/components/atomic-crm/contacts/ContactShow.tsx",
    "src/components/atomic-crm/contacts/ContactShow.test.tsx",
    "src/components/atomic-crm/contacts/ContactAside.tsx",
    "src/components/atomic-crm/contacts/ContactListContent.tsx",
    "src/components/atomic-crm/contacts/ContactListFilter.tsx",
    "src/components/atomic-crm/contacts/ContactMergeButton.tsx",
    "src/components/atomic-crm/companies/CompanyShow.tsx",
    "src/components/atomic-crm/misc/useImportFromJson.ts",
    "src/components/atomic-crm/misc/ImportPage.tsx",
    "src/components/atomic-crm/misc/import-sample.json",
    "src/components/atomic-crm/providers/commons/mergeContacts.ts",
    "src/components/atomic-crm/providers/fakerest/dataProvider.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts",
    "src/components/atomic-crm/providers/fakerest/dataGenerator/contacts.ts",
    "src/test/StoryWrapper.tsx",
    "src/components/atomic-crm/providers/commons/englishCrmMessages.ts",
    "src/components/atomic-crm/providers/commons/frenchCrmMessages.ts",
    "src/components/atomic-crm/root/defaultConfiguration.ts",
    "src/components/atomic-crm/root/ConfigurationContext.tsx",
    "src/components/atomic-crm/settings/SettingsPage.tsx",
    "src/App.tsx",
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
