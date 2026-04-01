import type { Meta } from "@storybook/react-vite";

import { ContactCreate } from "./ContactCreate";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import type { DataProvider } from "ra-core";

const meta = {
  title: "Atomic CRM/Contacts/Contact Create",
  parameters: {
    layout: "fullscreen",
  },
  globals: {
    viewport: { value: "responsive", isRotated: false },
  },
} satisfies Meta;

export default meta;

export const ContactCreateBasic = ({
  dataProvider = {},
  silent,
}: {
  dataProvider?: Partial<DataProvider>;
  silent?: boolean;
}) => (
  <StoryWrapper
    initialEntries={["/contacts/create"]}
    data={{
      contacts: [
        buildContact({
          id: 1,
          email_jsonb: [],
          phone_jsonb: [],
        }),
      ] as any,
    }}
    dataProvider={dataProvider}
    silent={silent}
  >
    <ContactCreate />
  </StoryWrapper>
);

export const ContactCreateBasicWithError = () => (
  <StoryWrapper
    initialEntries={["/contacts/create"]}
    data={{
      contacts: [
        buildContact({
          id: 1,
          email_jsonb: [],
          phone_jsonb: [],
        }),
      ] as any,
    }}
    dataProvider={{
      create: async (resource, params) => {
        if (resource === "contacts") {
          throw new Error("Failed to create contact");
        }
        return { data: params.data as any };
      },
    }}
  >
    <ContactCreate />
  </StoryWrapper>
);
