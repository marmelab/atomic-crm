import { useState, type ReactNode } from "react";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import {
  useNotify,
  type CreateParams,
  type CreateResult,
  type DataProvider,
} from "ra-core";
import { toast } from "sonner";

import { StoryWrapper } from "@/test/StoryWrapper";
import { ContactImportButton } from "./ContactImportButton";

const ROW_COUNT = 80;

const csv = [
  "first_name,last_name",
  ...Array.from({ length: ROW_COUNT }, (_, index) => `Ada${index},Lovelace`),
].join("\n");

let createDelay = 200;
let createdCount = 0;

const NotifyTrigger = () => {
  const notify = useNotify();
  return (
    <button onClick={() => notify("Contact updated", { type: "success" })}>
      notify
    </button>
  );
};

const UnmountableImportControls = () => {
  const [isMounted, setIsMounted] = useState(true);
  return (
    <>
      <button onClick={() => setIsMounted(false)}>unmount contact list</button>
      {isMounted ? <ContactImportButton /> : <p>contact list unmounted</p>}
    </>
  );
};

const createContact = async (
  _resource: string,
  params: CreateParams,
): Promise<CreateResult> => {
  await new Promise((resolve) => setTimeout(resolve, createDelay));
  createdCount += 1;
  return { data: { ...params.data, id: createdCount } };
};

const ImportHarness = ({ children }: { children?: ReactNode }) => (
  <StoryWrapper
    dataProvider={{ create: createContact as DataProvider["create"] }}
  >
    {children ?? (
      <>
        <ContactImportButton />
        <NotifyTrigger />
      </>
    )}
  </StoryWrapper>
);

type Screen = Awaited<ReturnType<typeof render>>;

const openImportDialog = (screen: Screen) =>
  screen.getByRole("button", { name: /import csv/i }).click();

const selectCsvFile = () => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("The import dialog has no file input");
  return page
    .elementLocator(input)
    .upload(new File([csv], "contacts.csv", { type: "text/csv" }));
};

const submitImportDialog = (screen: Screen) =>
  screen
    .getByRole("toolbar")
    .getByRole("button", { name: /import csv/i })
    .click();

const startImport = async (screen: Screen) => {
  await openImportDialog(screen);
  await selectCsvFile();
  await submitImportDialog(screen);
  await expect
    .element(screen.getByText(/Importing contacts/))
    .toBeInTheDocument();
};

const finishRemainingBatchesFast = () => {
  createDelay = 0;
};

const getToasterPositions = () =>
  Array.from(document.querySelectorAll("[data-sonner-toaster]")).map(
    (toaster) => ({
      position: `${toaster.getAttribute("data-y-position")}-${toaster.getAttribute("data-x-position")}`,
      text: (toaster as HTMLElement).innerText,
    }),
  );

const dispatchBeforeUnload = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  createDelay = 200;
  createdCount = 0;
});

afterEach(() => {
  toast.dismiss();
});

describe("contact import", () => {
  it("reports progress in a snackbar and notifies when the import ends", async () => {
    const screen = await render(<ImportHarness />);

    await startImport(screen);

    await expect
      .element(screen.getByText(new RegExp(`/ ${ROW_COUNT} contacts`)))
      .toBeInTheDocument();

    finishRemainingBatchesFast();

    await expect
      .element(
        screen.getByText(
          `Contacts import complete. Imported ${ROW_COUNT} contacts, with 0 errors`,
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(screen.getByText(/Importing contacts/))
      .not.toBeInTheDocument();
  });

  it("closes the dialog when the import starts", async () => {
    const screen = await render(<ImportHarness />);

    await startImport(screen);

    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();

    finishRemainingBatchesFast();

    await expect
      .element(
        screen.getByText(
          `Contacts import complete. Imported ${ROW_COUNT} contacts, with 0 errors`,
        ),
      )
      .toBeInTheDocument();
    expect(createdCount).toBe(ROW_COUNT);
  });

  it("prevents starting a second import while one is running", async () => {
    const screen = await render(<ImportHarness />);

    await startImport(screen);

    await expect
      .element(screen.getByRole("button", { name: /import csv/i }))
      .toBeDisabled();

    finishRemainingBatchesFast();

    await expect
      .element(screen.getByText(/Contacts import complete/))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /import csv/i }))
      .toBeEnabled();
  });

  it("asks the browser to confirm leaving the page only while the import runs", async () => {
    const screen = await render(<ImportHarness />);

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    await startImport(screen);

    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

    finishRemainingBatchesFast();

    await expect
      .element(screen.getByText(/Contacts import complete/))
      .toBeInTheDocument();

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
  });

  it("keeps the progress snackbar in its own stack when another notification pops up", async () => {
    const screen = await render(<ImportHarness />);

    await startImport(screen);

    await screen.getByRole("button", { name: "notify" }).click();
    await expect.element(screen.getByText("Contact updated")).toBeVisible();

    const positions = getToasterPositions();
    const progressStack = positions.find((stack) =>
      /Importing contacts/.test(stack.text),
    );
    const notificationStack = positions.find((stack) =>
      /Contact updated/.test(stack.text),
    );

    expect(progressStack?.position).toBe("bottom-right");
    expect(notificationStack?.position).toBe("bottom-center");
    expect(progressStack).not.toBe(notificationStack);

    finishRemainingBatchesFast();
    await expect
      .element(screen.getByText(/Contacts import complete/))
      .toBeInTheDocument();
  });

  it("keeps importing after the subtree holding the import button unmounts", async () => {
    const screen = await render(
      <ImportHarness>
        <UnmountableImportControls />
      </ImportHarness>,
    );

    await startImport(screen);

    await screen.getByRole("button", { name: "unmount contact list" }).click();
    await expect
      .element(screen.getByText("contact list unmounted"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /import csv/i }))
      .not.toBeInTheDocument();

    await expect
      .element(screen.getByText(/Importing contacts/))
      .toBeInTheDocument();

    finishRemainingBatchesFast();

    await expect
      .element(
        screen.getByText(
          `Contacts import complete. Imported ${ROW_COUNT} contacts, with 0 errors`,
        ),
      )
      .toBeInTheDocument();
    expect(createdCount).toBe(ROW_COUNT);
  });

  it("disables the dialog submit button until a file is selected", async () => {
    const screen = await render(<ImportHarness />);

    await openImportDialog(screen);

    await expect.element(screen.getByText(/Download CSV sample/)).toBeVisible();
    await expect
      .element(
        screen
          .getByRole("toolbar")
          .getByRole("button", { name: /import csv/i }),
      )
      .toBeDisabled();
  });

  it("stops the import from the progress snackbar", async () => {
    const screen = await render(<ImportHarness />);

    await startImport(screen);

    await screen.getByRole("button", { name: /stop import/i }).click();

    await expect
      .element(screen.getByText(/Importing contacts/))
      .not.toBeInTheDocument();

    const createdWhenStopped = createdCount;
    await expect
      .element(screen.getByText(/Contacts import complete/))
      .not.toBeInTheDocument();
    expect(createdWhenStopped).toBeLessThan(ROW_COUNT);
  });
});
