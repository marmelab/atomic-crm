import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  buildContact,
  createCrmDb,
  CrmStoryProvider,
  DesktopContactListContentHarness,
  DesktopContactListHarness,
  MobileContactListContentHarness,
} from "@/test/browser/atomic-crm/crmUiHarness";

const meta = {
  title: "Atomic CRM/Contacts/Contact List",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const successContacts = [
  buildContact({
    first_name: "Ada",
    id: 1,
    last_name: "Lovelace",
    last_seen: "2025-01-05T10:00:00.000Z",
    title: "CTO",
  }),
  buildContact({
    first_name: "Grace",
    id: 2,
    last_name: "Hopper",
    last_seen: "2025-01-06T11:00:00.000Z",
    title: "Rear Admiral",
  }),
];

const bulkTagContacts = [
  buildContact({
    first_name: "Ada",
    id: 1,
    last_name: "Lovelace",
    tags: [1],
  }),
  buildContact({
    first_name: "Grace",
    id: 2,
    last_name: "Hopper",
    tags: [],
  }),
];

const bulkCreateContacts = Array.from({ length: 30 }, (_, index) =>
  buildContact({
    first_name: `Contact${index + 1}`,
    id: index + 1,
    last_name: "Tester",
    tags: [],
  }),
);

export const EmptyDesktop: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      scenarioOptions={{ db: createCrmDb() }}
    >
      <DesktopContactListHarness />
    </CrmStoryProvider>
  ),
};

export const SuccessDesktop: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      scenarioOptions={{
        db: createCrmDb({ contacts: successContacts as any }),
      }}
    >
      <DesktopContactListHarness />
    </CrmStoryProvider>
  ),
};

export const LoadingContent: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      scenarioOptions={{
        db: createCrmDb({ contacts: successContacts as any }),
        getListDelays: { contacts: 10_000 },
      }}
    >
      <DesktopContactListContentHarness />
    </CrmStoryProvider>
  ),
};

export const ErrorMobile: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      scenarioOptions={{
        db: createCrmDb({ contacts: successContacts as any }),
        failGetListOnce: { contacts: "Error loading contacts" },
      }}
    >
      <MobileContactListContentHarness />
    </CrmStoryProvider>
  ),
};

export const BulkTagDesktop: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      scenarioOptions={{
        db: createCrmDb({
          contacts: bulkTagContacts as any,
          tags: [{ color: "#A5B4FC", id: 1, name: "VIP" }] as any,
        }),
      }}
    >
      <DesktopContactListHarness />
    </CrmStoryProvider>
  ),
};

export const BulkCreateTagDesktop: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      scenarioOptions={{
        db: createCrmDb({
          contacts: bulkCreateContacts as any,
        }),
      }}
    >
      <DesktopContactListHarness />
    </CrmStoryProvider>
  ),
};
