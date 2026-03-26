import type { Meta } from "@storybook/react-vite";

import { ContactEdit } from "./ContactEdit";
import { Route, Routes } from "react-router";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import type { DataProvider } from "ra-core";

const meta = {
  title: "Atomic CRM/Contacts/Contact Edit",
  parameters: {
    layout: "fullscreen",
  },
  globals: {
    viewport: { value: "responsive", isRotated: false },
  },
} satisfies Meta;

export default meta;

export const ContactEditBasic = ({
  dataProvider = {},
  silent,
}: {
  dataProvider?: Partial<DataProvider>;
  silent?: boolean;
}) => (
  <StoryWrapper
    initialEntries={["/contacts/1"]}
    data={{
      contacts: [
        buildContact({
          id: 1,
          email_jsonb: [],
          phone_jsonb: [],
        }),
      ],
    }}
    dataProvider={dataProvider}
    silent={silent}
  >
    <Routes>
      <Route path="/contacts/:id" element={<ContactEdit />} />
    </Routes>
  </StoryWrapper>
);

export const ContactEditWithEmailsAndPhones = ({
  dataProvider = {},
  silent,
}: {
  dataProvider?: Partial<DataProvider>;
  silent?: boolean;
}) => (
  <StoryWrapper
    initialEntries={["/contacts/1"]}
    data={{
      contacts: [
        buildContact({
          id: 1,
          email_jsonb: [{ email: "ada@example.com", type: "Work" }],
          phone_jsonb: [{ number: "0123456789", type: "Work" }],
        }),
      ],
    }}
    dataProvider={dataProvider}
    silent={silent}
  >
    <Routes>
      <Route path="/contacts/:id" element={<ContactEdit />} />
    </Routes>
  </StoryWrapper>
);

export const ContactEditWithError = () => (
  <StoryWrapper
    initialEntries={["/contacts/1"]}
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
      update: async (resource, params) => {
        if (resource === "contacts") {
          throw new Error("Failed to update contact");
        }
        return { data: params.data as any };
      },
    }}
  >
    <Routes>
      <Route path="/contacts/:id" element={<ContactEdit />} />
    </Routes>
  </StoryWrapper>
);

export const ContactEditNotFound = () => (
  <StoryWrapper initialEntries={["/contacts/1"]}>
    <Routes>
      <Route path="/contacts/:id" element={<ContactEdit />} />
    </Routes>
  </StoryWrapper>
);
