import type { Meta, StoryObj } from "@storybook/react-vite";

import {
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
      scenarioOptions={{ db: createCrmDb(), silent: false }}
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
        db: createCrmDb(),
        creationError: "Simulated create error",
        silent: false,
      }}
    >
      <ContactCreate />
    </CrmStoryProvider>
  ),
};
