import type { Meta, StoryObj } from "@storybook/react-vite";
import { Form } from "ra-core";

import { NoteInputsMobile } from "./NoteInputsMobile";
import { SaveButton } from "@/components/admin/form";
import { StoryWrapper } from "@/test/StoryWrapper";

type NoteInputsMobileStoryProps = React.ComponentProps<
  typeof NoteInputsMobile
> & { defaultValues?: Record<string, unknown> };

export const NoteInputsMobileStory = ({
  defaultValues,
  ...props
}: NoteInputsMobileStoryProps) => (
  <StoryWrapper>
    <Form defaultValues={defaultValues}>
      <NoteInputsMobile {...props} />
      <SaveButton type="button" className="mt-6" />
    </Form>
  </StoryWrapper>
);

const meta = {
  title: "Atomic CRM/Notes/Note Inputs Mobile",
  includeStories: [
    "Default",
    "WithSaveButton",
    "WithSelectContact",
    "WithAttachmentDefault",
  ],
  render: (args) => <NoteInputsMobileStory {...args} />,
} satisfies Meta<typeof NoteInputsMobileStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelectContact: Story = {
  args: { selectContact: true },
};

export const WithAttachmentDefault: Story = {
  args: {
    defaultValues: {
      attachments: [{ src: "blob:test", title: "evidence.pdf" }],
    },
  },
};
