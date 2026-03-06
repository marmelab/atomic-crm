import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  buildContact,
  createCrmDb,
  CrmStoryProvider,
  OpenTaskCreateSheetHarness,
} from "@/test/browser/atomic-crm/crmUiHarness";

const meta = {
  title: "Atomic CRM/Tasks/Task Create Sheet",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const GlobalTaskCreateOpen: Story = {
  render: () => (
    <CrmStoryProvider
      scenarioOptions={{
        db: createCrmDb({
          contacts: [
            buildContact({
              first_name: "Ada",
              id: 1,
              last_name: "Lovelace",
            }),
            buildContact({
              first_name: "Grace",
              id: 2,
              last_name: "Hopper",
            }),
          ] as any,
        }),
      }}
    >
      <OpenTaskCreateSheetHarness />
    </CrmStoryProvider>
  ),
};
