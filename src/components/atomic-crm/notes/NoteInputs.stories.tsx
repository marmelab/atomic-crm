import type { Meta, StoryObj } from "@storybook/react-vite";
import { CoreAdminContext, Form } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";

import { NoteInputs } from "./NoteInputs";
import { SaveButton } from "@/components/admin/form";

const testI18nProvider = {
  translate: (key: string) =>
    (
      ({
        "resources.notes.inputs.add_note": "Add a note",
        "resources.notes.inputs.show_options": "Show options",
        "resources.notes.fields.date": "Date",
        "resources.notes.fields.attachments": "Attachments",
        "resources.notes.fields.status": "Status",
        "resources.notes.fields.contact_id": "Contact",
        "resources.notes.fields.deal_id": "Deal",
        "resources.notes.validation.note_or_attachment_required":
          "A note or an attachment is required",
        "ra.action.save": "Save",
      }) as Record<string, string>
    )[key] ?? key,
  changeLocale: () => Promise.resolve(),
  getLocale: () => "en",
};

const dataProvider = fakeDataProvider({
  notes: [],
  contacts: [],
  deals: [],
  sales: [],
});

type NoteInputsStoryProps = React.ComponentProps<typeof NoteInputs> & {
  defaultValues?: Record<string, unknown>;
  withSaveButton?: boolean;
};

export const NoteInputsStory = ({
  defaultValues,
  withSaveButton = false,
  ...props
}: NoteInputsStoryProps) => (
  <CoreAdminContext dataProvider={dataProvider} i18nProvider={testI18nProvider}>
    <Form defaultValues={defaultValues}>
      <NoteInputs {...props} />
      {withSaveButton ? <SaveButton type="button" /> : null}
    </Form>
  </CoreAdminContext>
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
