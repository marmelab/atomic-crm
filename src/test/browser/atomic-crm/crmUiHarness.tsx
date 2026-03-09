/* eslint-disable react-refresh/only-export-components */
import { Notification } from "@/components/admin/notification";
import { ThemeProvider } from "@/components/admin/theme-provider";
import { ContactList } from "@/components/atomic-crm/contacts/ContactList";
import {
  ContactListContent,
  ContactListContentMobile,
} from "@/components/atomic-crm/contacts/ContactListContent";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { DEFAULT_USER } from "@/components/atomic-crm/providers/fakerest/authProvider";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";
import { CONFIGURATION_STORE_KEY } from "@/components/atomic-crm/root/ConfigurationContext";
import { defaultConfiguration } from "@/components/atomic-crm/root/defaultConfiguration";
import { i18nProvider } from "@/components/atomic-crm/root/i18nProvider";
import { TaskCreateSheet } from "@/components/atomic-crm/tasks/TaskCreateSheet";
import type {
  Company,
  Contact,
  Sale,
  Tag,
  Task,
} from "@/components/atomic-crm/types";
import {
  CoreAdminContext,
  InfiniteListBase,
  ListBase,
  ResourceContextProvider,
  ResourceDefinitionContextProvider,
  localStorageStore,
  type AuthProvider,
} from "ra-core";
import { useMemo, useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router";

const listSort = { field: "last_seen", order: "DESC" } as const;
const listPerPage = 25;

let scenarioCount = 0;

const wait = async (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const getContactName = (record?: Contact) =>
  `${record?.first_name ?? ""} ${record?.last_name ?? ""}`.trim();

const getCompanyName = (record?: Company) => record?.name ?? "";
const getSaleName = (record?: Sale) =>
  `${record?.first_name ?? ""} ${record?.last_name ?? ""}`.trim();
const getTagName = (record?: Tag) => record?.name ?? "";
const getTaskName = (record?: Task) => record?.text ?? "";

const resourceDefinitions = {
  companies: {
    hasList: true,
    name: "companies",
    recordRepresentation: getCompanyName,
  },
  configuration: {
    name: "configuration",
  },
  contacts: {
    hasCreate: true,
    hasList: true,
    hasShow: true,
    name: "contacts",
    recordRepresentation: getContactName,
  },
  contacts_summary: {
    hasList: true,
    name: "contacts_summary",
    recordRepresentation: getContactName,
  },
  sales: {
    hasList: true,
    name: "sales",
    recordRepresentation: getSaleName,
  },
  tags: {
    hasList: true,
    name: "tags",
    recordRepresentation: getTagName,
  },
  tasks: {
    hasCreate: true,
    hasList: true,
    name: "tasks",
    recordRepresentation: getTaskName,
  },
};

const createTestAuthProvider = (): AuthProvider => ({
  canAccess: async () => true,
  checkAuth: async () => undefined,
  checkError: async () => undefined,
  getIdentity: async () => ({
    avatar: DEFAULT_USER.avatar.src,
    fullName: `${DEFAULT_USER.first_name} ${DEFAULT_USER.last_name}`,
    id: DEFAULT_USER.id,
  }),
  login: async () => undefined,
  logout: async () => undefined,
});

const baseSale: Sale = {
  administrator: true,
  avatar: DEFAULT_USER.avatar,
  disabled: false,
  email: DEFAULT_USER.email,
  first_name: DEFAULT_USER.first_name,
  id: DEFAULT_USER.id,
  last_name: DEFAULT_USER.last_name,
  password: DEFAULT_USER.password,
  user_id: DEFAULT_USER.id.toString(),
};

export interface CrmScenarioOptions {
  db?: Db;
  failGetListOnce?: Partial<Record<string, string>>;
  getListDelays?: Partial<Record<string, number>>;
  latency?: number;
}

export interface CrmScenario {
  authProvider: AuthProvider;
  dataProvider: ReturnType<typeof createDataProvider>;
  db: Db;
  store: ReturnType<typeof localStorageStore>;
}

// Provide a minimal FakeRest database shape so tests can override only the records
// that matter for each scenario.
export const createCrmDb = (overrides: Partial<Db> = {}): Db =>
  ({
    companies: [],
    configuration: [{ config: {}, id: 1 }],
    contact_notes: [],
    contacts: [],
    deal_notes: [],
    deals: [],
    sales: [baseSale],
    tags: [],
    tasks: [],
    ...overrides,
  }) as Db;

// Build a valid contact record with sensible defaults to keep tests and stories terse.
export const buildContact = (overrides: Partial<Contact> = {}): Contact => ({
  background: "",
  company_id: null,
  company_name: undefined,
  email_jsonb: [{ email: "ada@example.com", type: "Work" }],
  first_name: "Ada",
  first_seen: "2025-01-01T09:00:00.000Z",
  gender: "female",
  has_newsletter: false,
  id: 1,
  last_name: "Lovelace",
  last_seen: "2025-01-02T10:00:00.000Z",
  linkedin_url: null,
  nb_tasks: 0,
  phone_jsonb: [],
  sales_id: 0,
  status: "warm",
  tags: [],
  title: "CTO",
  ...overrides,
});

// Create an isolated CRM runtime backed by FakeRest, with optional delays and
// one-shot failures to exercise loading and error states.
export const createCrmScenario = ({
  db = createCrmDb(),
  failGetListOnce = {},
  getListDelays = {},
  latency = 0,
}: CrmScenarioOptions = {}): CrmScenario => {
  const authProvider = createTestAuthProvider();
  const baseDataProvider = createDataProvider({
    authProvider,
    db,
    latency,
  });
  const pendingFailures = new Map(Object.entries(failGetListOnce));
  const dataProvider = {
    ...baseDataProvider,
    getList: async (resource, params) => {
      const delayMs = getListDelays[resource] ?? 0;
      if (delayMs > 0) {
        await wait(delayMs);
      }

      const failureMessage = pendingFailures.get(resource);
      if (failureMessage) {
        pendingFailures.delete(resource);
        throw new Error(failureMessage);
      }

      return baseDataProvider.getList(resource, params);
    },
  } as ReturnType<typeof createDataProvider>;
  const store = localStorageStore(
    undefined,
    `CRM_TEST_${(scenarioCount += 1)}`,
  );
  store.setItem(CONFIGURATION_STORE_KEY, defaultConfiguration);

  return {
    authProvider,
    dataProvider,
    db,
    store,
  };
};

// Mount the minimum react-admin and app providers required by the CRM widgets
// under test, without booting the full application shell.
export const CrmTestProvider = ({
  children,
  className,
  initialEntries = ["/"],
  resource,
  scenario,
}: {
  children: ReactNode;
  className?: string;
  initialEntries?: string[];
  resource?: string;
  scenario: CrmScenario;
}) => (
  <MemoryRouter initialEntries={initialEntries}>
    <CoreAdminContext
      authProvider={scenario.authProvider}
      dataProvider={scenario.dataProvider}
      i18nProvider={i18nProvider}
      store={scenario.store}
    >
      <ResourceDefinitionContextProvider definitions={resourceDefinitions}>
        <ThemeProvider>
          <div className={className}>
            {resource ? (
              <ResourceContextProvider value={resource}>
                {children}
              </ResourceContextProvider>
            ) : (
              children
            )}
          </div>
          <Notification />
        </ThemeProvider>
      </ResourceDefinitionContextProvider>
    </CoreAdminContext>
  </MemoryRouter>
);

// Reuse the same scenario factory in Storybook so stories match the integration
// test environment as closely as possible.
export const CrmStoryProvider = ({
  children,
  className,
  initialEntries,
  resource,
  scenarioOptions,
}: {
  children: ReactNode;
  className?: string;
  initialEntries?: string[];
  resource?: string;
  scenarioOptions: CrmScenarioOptions;
}) => {
  const scenario = useMemo(
    () => createCrmScenario(scenarioOptions),
    [scenarioOptions],
  );

  return (
    <CrmTestProvider
      className={className}
      initialEntries={initialEntries}
      resource={resource}
      scenario={scenario}
    >
      {children}
    </CrmTestProvider>
  );
};

export const DesktopContactListHarness = () => <ContactList />;

// ContactListContent expects the desktop list controller to already be mounted.
export const DesktopContactListContentHarness = () => (
  <ListBase perPage={listPerPage} resource="contacts" sort={listSort}>
    <ContactListContent />
  </ListBase>
);

// The mobile content uses the infinite list controller and exposes retry UX for
// request failures.
export const MobileContactListContentHarness = () => (
  <div className="mx-auto max-w-sm px-4 py-6">
    <InfiniteListBase
      perPage={listPerPage}
      queryOptions={{
        onError: () => undefined,
      }}
      resource="contacts"
      sort={listSort}
    >
      <ContactListContentMobile />
    </InfiniteListBase>
  </div>
);

// Keep the sheet stateful so tests can assert that save flows close it.
export const OpenTaskCreateSheetHarness = () => {
  const [open, setOpen] = useState(true);

  return <TaskCreateSheet open={open} onOpenChange={setOpen} />;
};
