#!/usr/bin/node

declare const process: {
    cwd(): unknown;
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
        "src/components/atomic-crm/contacts/ContactInputs.tsx",
        "src/components/atomic-crm/deals/DealInputs.tsx",
        "src/components/atomic-crm/activity/ActivityLogCompanyCreated.tsx",
        "src/components/atomic-crm/activity/ActivityLogDealNoteCreated.tsx",
        "src/components/atomic-crm/contacts/ContactShow.tsx",
        "src/components/atomic-crm/dashboard/DealsPipeline.tsx",
        "src/components/atomic-crm/deals/DealCard.tsx",
        "src/components/atomic-crm/deals/DealEdit.tsx",
        "src/components/atomic-crm/deals/DealShow.tsx",
        "src/components/atomic-crm/notes/Note.tsx",
    ],
    contacts: [
        "src/components/atomic-crm/companies/CompanyShow.tsx",
        "src/components/atomic-crm/misc/useImportFromJson.ts",
        "src/components/atomic-crm/providers/fakerest/dataGenerator/contacts.ts",
        "src/components/atomic-crm/dashboard/DashboardStepper.tsx",
        "src/components/atomic-crm/layout/MobileNavigation.tsx",
        "src/components/atomic-crm/activity/ActivityLogContactCreated.tsx",
        "src/components/atomic-crm/activity/ActivityLogContactNoteCreated.tsx",
        "src/components/atomic-crm/companies/CompanyCard.tsx",
        "src/components/atomic-crm/companies/CompanyShow.tsx",
        "src/components/atomic-crm/dashboard/HotContacts.tsx",
        "src/components/atomic-crm/deals/ContactList.tsx",
        "src/components/atomic-crm/misc/ContactOption.tsx",
    ],
    deals: [
        "src/components/atomic-crm/dashboard/DealsPipeline.tsx",
        "src/components/atomic-crm/dashboard/DealsChart.tsx",
        "src/components/atomic-crm/companies/CompanyShow.tsx",
    ],
    tags: [
        "src/components/atomic-crm/misc/useImportFromJson.ts",
        "src/components/atomic-crm/contacts/TagsListEdit.tsx",
        "src/components/atomic-crm/contacts/BulkTagButton.tsx",
    ],
    tasks: [
        "src/components/atomic-crm/dashboard/TasksList.tsx",
        "src/components/atomic-crm/contacts/ContactAside.tsx",
        "src/components/atomic-crm/layout/MobileNavigation.tsx",
        "src/components/atomic-crm/contacts/ContactTasksList.tsx",
    ],
} as const;
const sharedDependentFiles: string[] = [
    "src/components/atomic-crm/root/CRM.tsx",
] as const;
const resourceFilesPath = "src/components/atomic-crm" as const;

// ================================   TYPES   ================================
type InitialResource = (typeof initialResource)[number];
type DependentFile = string;
type ResourceFiles = Record<InitialResource, DependentFile[]>;

// ================================ FONCTIONS ================================
const main = async () => {
    const resourceToDelete = getResource();
    const basePath = process.cwd() as string;
    await deleteIsolatedFiles(resourceToDelete, basePath);
    returnDependentFiles(resourceToDelete);
};

// Get the resource to delete from the command line arguments, and check if it's valid
const getResource = (): InitialResource => {
    const resourceToDelete = process.argv[2];
    if (!resourceToDelete) {
        console.error("Please provide a resource to delete.");
        process.exit(1);
    }

    if (!checkResourceExists(resourceToDelete)) {
        console.error(`Resource "${resourceToDelete}" does not exist.`);
        process.exit(1);
    }

    return resourceToDelete as InitialResource;
};
// Check if the resource exists in the initialResource array
const checkResourceExists = (resource: string): boolean => {
    if (!initialResource.includes(resource as InitialResource)) {
        return false;
    }
    return true;
};

// Delete the ressource folder and their files. And return any that failed to delete
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

// Return to Claude all the files dependent on the deleted resource
const returnDependentFiles = (resource: InitialResource) => {
    const dependentFilesToReturn = dependentFiles[resource];
    const allDependentFilesToReturn = [
        ...dependentFilesToReturn,
        ...sharedDependentFiles,
    ];

    // eslint-disable-next-line no-console
    console.log(
        `Dependent files for resource "${resource}":\n`,
        allDependentFilesToReturn,
    );
    process.exit(0);
};

// ================================  MAIN CALL  ================================
await main();
