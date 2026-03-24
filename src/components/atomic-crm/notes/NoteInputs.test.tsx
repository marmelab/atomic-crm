import { render } from "vitest-browser-react";
import { CoreAdminContext, Form } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";
import { useFormContext } from "react-hook-form";

import { NoteInputs } from "./NoteInputs";
import { SaveButton } from "@/components/admin/form";
import { defaultConfiguration } from "../root/defaultConfiguration";

vi.mock("../root/ConfigurationContext", () => ({
  useConfigurationContext: () => defaultConfiguration,
}));

const mockIsMobile = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockIsMobile,
}));

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

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <CoreAdminContext dataProvider={dataProvider} i18nProvider={testI18nProvider}>
    <Form>{children}</Form>
  </CoreAdminContext>
);

const AttachmentSetter = () => {
  const { setValue } = useFormContext();

  return (
    <button
      type="button"
      onClick={() => {
        setValue(
          "attachments",
          [{ src: "blob:test", title: "evidence.pdf" }],
          { shouldDirty: true, shouldValidate: true },
        );
      }}
    >
      Add attachment
    </button>
  );
};

describe("NoteInputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMobile.mockReturnValue(false);
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it("renders the note textarea", async () => {
    const screen = await render(<NoteInputs />, {
      wrapper: Wrapper,
    });

    await expect.element(screen.getByPlaceholder("Add a note")).toBeVisible();
  });

  it("shows the 'Show options' button on desktop when displayMore is false", async () => {
    const screen = await render(<NoteInputs />, {
      wrapper: Wrapper,
    });

    await expect
      .element(screen.getByRole("button", { name: "Show options" }))
      .toBeVisible();
  });

  it("does not show the 'Show options' button on mobile", async () => {
    mockIsMobile.mockReturnValue(true);

    const screen = await render(<NoteInputs />, {
      wrapper: Wrapper,
    });

    await expect
      .element(screen.getByRole("button", { name: "Show options" }))
      .not.toBeInTheDocument();
  });

  it("reveals the extra options section after clicking 'Show options'", async () => {
    const screen = await render(<NoteInputs />, {
      wrapper: Wrapper,
    });

    const showOptionsButton = screen.getByRole("button", {
      name: "Show options",
    });
    await showOptionsButton.click();

    await expect
      .element(screen.getByRole("button", { name: "Show options" }))
      .not.toBeInTheDocument();

    await expect.element(screen.getByText("Date")).toBeVisible();
    await expect.element(screen.getByText("Attachments")).toBeVisible();
  });

  it("renders the status selector when showStatus is true", async () => {
    const screen = await render(<NoteInputs showStatus />, {
      wrapper: Wrapper,
    });

    // Click 'Show options' to reveal the hidden section
    await screen.getByRole("button", { name: "Show options" }).click();

    await expect.element(screen.getByText("Status")).toBeVisible();
  });

  it("does not render the status selector when showStatus is false", async () => {
    const screen = await render(<NoteInputs showStatus={false} />, {
      wrapper: Wrapper,
    });

    await expect.element(screen.getByText("Status")).not.toBeInTheDocument();
  });

  it("renders the contact reference selector when selectReference is contacts", async () => {
    const screen = await render(
      <NoteInputs selectReference reference="contacts" />,
      {
        wrapper: Wrapper,
      },
    );

    await expect.element(screen.getByText("Contact")).toBeVisible();
  });

  it("renders the deal reference selector when selectReference is deals", async () => {
    const screen = await render(
      <NoteInputs selectReference reference="deals" />,
      {
        wrapper: Wrapper,
      },
    );

    await expect.element(screen.getByText("Deal")).toBeVisible();
  });

  it("does not render a reference selector when selectReference is not set", async () => {
    const screen = await render(<NoteInputs />, {
      wrapper: Wrapper,
    });

    await expect.element(screen.getByText("Contact")).not.toBeInTheDocument();
    await expect.element(screen.getByText("Deal")).not.toBeInTheDocument();
  });

  it("should have the current date as default value for the date input", async () => {
    const screen = await render(<NoteInputs />, {
      wrapper: Wrapper,
    });

    await screen.getByRole("button", { name: "Show options" }).click();

    const dateInput = screen.getByLabelText("Date");
    const currentDate = new Date();
    const offset = currentDate.getTimezoneOffset();
    const localDate = new Date(currentDate.getTime() - offset * 60 * 1000);
    const expectedValue = localDate.toISOString().slice(0, 16);

    await expect(dateInput).toHaveValue(expectedValue);
  });

  it("should use the note date instead of the current date when it is set", async () => {
    const screen = await render(<NoteInputs />, {
      wrapper: ({ children }) => (
        <CoreAdminContext
          dataProvider={dataProvider}
          i18nProvider={testI18nProvider}
        >
          <Form
            defaultValues={{
              date: "2024-01-01T12:00",
            }}
          >
            {children}
          </Form>
        </CoreAdminContext>
      ),
    });

    await screen.getByRole("button", { name: "Show options" }).click();

    const dateInput = screen.getByLabelText("Date");

    await expect(dateInput).toHaveValue("2024-01-01T12:00");
  });

  it("shows a validation error when submitting an empty note without attachments", async () => {
    const screen = await render(
      <>
        <NoteInputs />
        <SaveButton type="button" />
      </>,
      {
        wrapper: Wrapper,
      },
    );

    await screen.getByRole("button", { name: "Save" }).click();

    await expect
      .element(screen.getByText("A note or an attachment is required"))
      .toBeVisible();
  });

  it("treats whitespace-only note text as empty", async () => {
    const screen = await render(
      <>
        <NoteInputs />
        <SaveButton type="button" />
      </>,
      {
        wrapper: Wrapper,
      },
    );

    await screen.getByPlaceholder("Add a note").fill("   ");
    await screen.getByRole("button", { name: "Save" }).click();

    await expect
      .element(screen.getByText("A note or an attachment is required"))
      .toBeVisible();
  });

  it("allows submitting a note with an attachment and no text", async () => {
    const screen = await render(
      <>
        <NoteInputs />
        <AttachmentSetter />
        <SaveButton type="button" />
      </>,
      {
        wrapper: Wrapper,
      },
    );

    await screen.getByRole("button", { name: "Add attachment" }).click();
    await screen.getByRole("button", { name: "Save" }).click();

    await expect
      .element(screen.getByText("A note or an attachment is required"))
      .not.toBeInTheDocument();
  });
});
