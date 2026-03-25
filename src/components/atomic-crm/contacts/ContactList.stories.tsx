import type { Meta } from "@storybook/react-vite";
import { ResourceContextProvider } from "ra-core";

import { ContactList } from "./ContactList";

import { StoryWrapper, buildContact } from "@/test/StoryWrapper";

const meta = {
  title: "Atomic CRM/Contacts/Contact List",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

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

export const DesktopEmpty = () => (
  <StoryWrapper>
    <ResourceContextProvider value="contacts">
      <ContactList />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const DesktopSuccess = () => (
  <StoryWrapper data={{ contacts: successContacts }}>
    <ResourceContextProvider value="contacts">
      <ContactList />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const DesktopLoading = () => (
  <StoryWrapper
    dataProvider={{
      getList: async (resource) => {
        if (resource === "contacts") {
          await new Promise(() => {});
        }
        return { data: [], total: 0 };
      },
    }}
  >
    <ResourceContextProvider value="contacts">
      <ContactList />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const DesktopError = () => (
  <StoryWrapper
    dataProvider={{
      getList: async (resource) => {
        if (resource === "contacts") {
          throw new Error("Error loading contacts");
        }
        return { data: [], total: 0 };
      },
    }}
  >
    <ResourceContextProvider value="contacts">
      <ContactList />
    </ResourceContextProvider>
  </StoryWrapper>
);

const dataForBulkAddTag = {
  contacts: [
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
  ],
  tags: [{ color: "#A5B4FC", id: 1, name: "VIP" }],
};

export const BulkTagButton = () => (
  <StoryWrapper data={dataForBulkAddTag}>
    <ResourceContextProvider value="contacts">
      <ContactList />
    </ResourceContextProvider>
  </StoryWrapper>
);
