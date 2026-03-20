import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  buildContact,
  createCrmDb,
  CrmStoryProvider,
} from "@/test/browser/atomic-crm/crmUiHarness";
import { ContactEdit } from "./ContactEdit";
import { Route, Routes } from "react-router";

const meta = {
  title: "Atomic CRM/Contacts/Contact Edit",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ConcatEditBasic: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      initialEntries={["/contacts/1"]}
      scenarioOptions={{
        db: createCrmDb({
          contacts: [
            buildContact({
              id: 1,
              email_jsonb: [],
              phone_jsonb: [],
            }),
          ] as any,
        }),
        silent: false,
      }}
    >
      <Routes>
        <Route
          path="/contacts/:id"
          element={<ContactEdit mutationMode="pessimistic" />}
        />
      </Routes>
    </CrmStoryProvider>
  ),
};
export const ConcatEditWithError: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      initialEntries={["/contacts/1"]}
      scenarioOptions={{
        db: createCrmDb({
          contacts: [
            buildContact({
              id: 1,
              email_jsonb: [],
              phone_jsonb: [],
            }),
          ] as any,
        }),
        updateError: "Simulated update error",
        silent: false,
      }}
    >
      <Routes>
        <Route
          path="/contacts/:id"
          element={<ContactEdit mutationMode="pessimistic" />}
        />
      </Routes>
    </CrmStoryProvider>
  ),
};

export const ConcatEditNotFound: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      initialEntries={["/contacts/1"]}
      scenarioOptions={{
        db: createCrmDb(),
        silent: false,
      }}
    >
      <Routes>
        <Route
          path="/contacts/:id"
          element={<ContactEdit mutationMode="pessimistic" />}
        />
      </Routes>
    </CrmStoryProvider>
  ),
};
