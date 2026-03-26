import type { Meta, StoryObj } from "@storybook/react-vite";
import { Form } from "ra-core";

import { NoteInputs } from "./NoteInputs";
import { SaveButton } from "@/components/admin/form";
import {
  createCrmDb,
  CrmStoryProvider,
} from "@/test/browser/atomic-crm/crmUiHarness";

type NoteInputsStoryProps = React.ComponentProps<typeof NoteInputs> & {
  defaultValues?: Record<string, unknown>;
  withSaveButton?: boolean;
};

export const NoteInputsStory = ({
  defaultValues,
  withSaveButton = false,
  ...props
}: NoteInputsStoryProps) => (
  <CrmStoryProvider scenarioOptions={{ db: createCrmDb() }}>
    <Form defaultValues={defaultValues}>
      <NoteInputs {...props} />
      {withSaveButton ? <SaveButton type="button" /> : null}
    </Form>
  </CrmStoryProvider>
);

const meta = {
  title: "Atomic CRM/Notes/Note Inputs",
  includeStories: ["Default", "WithSaveButton", "WithAttachmentDefault"],
  render: (args) => <NoteInputsStory {...args} />,
} satisfies Meta<typeof NoteInputsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSaveButton: Story = {
  args: {
    withSaveButton: true,
  },
};

export const WithAttachmentDefault: Story = {
  args: {
    defaultValues: {
      attachments: [{ src: "blob:test", title: "evidence.pdf" }],
    },
    withSaveButton: true,
  },
};
