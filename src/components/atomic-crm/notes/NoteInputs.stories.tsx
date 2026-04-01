import type { Meta, StoryObj } from "@storybook/react-vite";
import { Form } from "ra-core";

import { NoteInputs } from "./NoteInputs";
import { SaveButton } from "@/components/admin/form";
import { StoryWrapper } from "@/test/StoryWrapper";

type NoteInputsStoryProps = React.ComponentProps<typeof NoteInputs> & {
  defaultValues?: Record<string, unknown>;
  withSaveButton?: boolean;
};

export const NoteInputsStory = ({
  defaultValues,
  withSaveButton = false,
  ...props
}: NoteInputsStoryProps) => (
  <StoryWrapper>
    <Form defaultValues={defaultValues}>
      <NoteInputs {...props} />
      {withSaveButton ? <SaveButton type="button" /> : null}
    </Form>
  </StoryWrapper>
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
