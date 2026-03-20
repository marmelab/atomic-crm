import type { Meta } from "@storybook/react-vite";
import { ResourceContextProvider } from "ra-core";

import { ContactShow } from "./ContactShow";

import { StoryWrapper, buildContact } from "@/test/StoryWrapper";

const meta = {
  title: "Atomic CRM/Contacts/Contact Show",
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
];

export const MobileSuccess = () => (
  <StoryWrapper
    initialEntries={["/contacts/1/show"]}
    data={{ contacts: successContacts }}
  >
    <ResourceContextProvider value="contacts">
      <ContactShow />
    </ResourceContextProvider>
  </StoryWrapper>
);
