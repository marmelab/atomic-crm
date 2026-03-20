import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  buildContact,
  createCrmDb,
  CrmStoryProvider,
} from "@/test/browser/atomic-crm/crmUiHarness";
import { ContactCreate } from "./ContactCreate";

const meta = {
  title: "Atomic CRM/Contacts/Contact Create",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ConcatCreateBasic: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      initialEntries={["/contacts/create"]}
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
      <ContactCreate />
    </CrmStoryProvider>
  ),
};

export const ConcatCreateBasicWithError: Story = {
  render: () => (
    <CrmStoryProvider
      resource="contacts"
      initialEntries={["/contacts/create"]}
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
        creationError: "Simulated create error",
        silent: false,
      }}
    >
      <ContactCreate />
    </CrmStoryProvider>
  ),
};
