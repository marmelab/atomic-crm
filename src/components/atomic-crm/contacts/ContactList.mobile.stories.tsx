import type { Meta } from "@storybook/react-vite";
import { ResourceContextProvider } from "ra-core";

import { ContactListMobile } from "./ContactList";

import { StoryWrapper, buildContact } from "@/test/StoryWrapper";

const meta = {
  title: "Atomic CRM/Contacts/Contact List",
  parameters: {
    layout: "fullscreen",
  },
  globals: {
    viewport: { value: "mobile1", isRotated: false },
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

export const MobileEmpty = () => (
  <StoryWrapper>
    <ResourceContextProvider value="contacts">
      <ContactListMobile />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const MobileSuccess = () => (
  <StoryWrapper data={{ contacts: successContacts }}>
    <ResourceContextProvider value="contacts">
      <ContactListMobile />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const MobileLoading = () => (
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
      <ContactListMobile />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const MobileError = () => (
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
      <ContactListMobile />
    </ResourceContextProvider>
  </StoryWrapper>
);
