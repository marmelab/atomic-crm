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
import { DataImportButton } from "./DataImportButton";

const ROW_COUNT = 80;

const csv = [
  "first_name,last_name",
  ...Array.from({ length: ROW_COUNT }, (_, index) => `Ada${index},Lovelace`),
].join("\n");

let createDelay = 200;
let createdCount = 0;
let attemptCount = 0;
let isRowRejected = (): boolean => false;

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
      {isMounted ? (
        <DataImportButton resource="contacts" />
      ) : (
        <p>contact list unmounted</p>
      )}
    </>
  );
};

const createContact = async (
  _resource: string,
  params: CreateParams,
): Promise<CreateResult> => {
  await new Promise((resolve) => setTimeout(resolve, createDelay));
  attemptCount += 1;
  if (isRowRejected()) {
    throw new Error("The backend refused this row");
  }
  createdCount += 1;
  return { data: { ...params.data, id: createdCount } };
};

const ImportHarness = ({ children }: { children?: ReactNode }) => (
  <StoryWrapper
    dataProvider={{ create: createContact as DataProvider["create"] }}
  >
    {children ?? (
      <>
        <DataImportButton resource="contacts" />
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
    .getByRole("button", { name: /start import/i })
    .click();

const startImport = async (screen: Screen) => {
  await openImportDialog(screen);
  await selectCsvFile();
  await submitImportDialog(screen);
  await expect
    .element(screen.getByText(/Import in progress/))
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

const readProgressSnackbar = () => {
  const bar = document.querySelector<HTMLElement>('[data-slot="progress"]');
  if (!bar) throw new Error("The progress snackbar has no progress bar");
  const [, importCount, rowCount, errorCount] =
    /Imported (\d+) \/ (\d+) records, with (\d+) errors/.exec(
      bar.parentElement?.innerText ?? "",
    ) ?? [];
  // The shadcn Progress does not forward its value as `aria-valuenow`.
  const indicator = bar.querySelector<HTMLElement>(
    '[data-slot="progress-indicator"]',
  );
  const [, offset] =
    /translateX\(-([\d.]+)%\)/.exec(indicator?.style.transform ?? "") ?? [];
  return {
    value: 100 - Number(offset),
    importCount: Number(importCount),
    rowCount: Number(rowCount),
    errorCount: Number(errorCount),
  };
};

const dispatchBeforeUnload = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  createDelay = 200;
  createdCount = 0;
  attemptCount = 0;
  isRowRejected = () => false;
});

afterEach(() => {
  toast.dismiss();
});

describe("data import", () => {
  it("reports progress in a snackbar and notifies when the import ends", async () => {
    const screen = await render(<ImportHarness />);

    await startImport(screen);

    await expect
      .element(screen.getByText(new RegExp(`/ ${ROW_COUNT} records`)))
      .toBeInTheDocument();

    finishRemainingBatchesFast();

    await expect
      .element(
        screen.getByText(
          `Import complete. Imported ${ROW_COUNT} records, with 0 errors`,
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(screen.getByText(/Import in progress/))
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
          `Import complete. Imported ${ROW_COUNT} records, with 0 errors`,
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
      .element(screen.getByText(/Import complete/))
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
      .element(screen.getByText(/Import complete/))
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
      /Import in progress/.test(stack.text),
    );
    const notificationStack = positions.find((stack) =>
      /Contact updated/.test(stack.text),
    );

    expect(progressStack?.position).toBe("bottom-right");
    expect(notificationStack?.position).toBe("bottom-center");
    expect(progressStack).not.toBe(notificationStack);

    finishRemainingBatchesFast();
    await expect
      .element(screen.getByText(/Import complete/))
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
      .element(screen.getByText(/Import in progress/))
      .toBeInTheDocument();

    finishRemainingBatchesFast();

    await expect
      .element(
        screen.getByText(
          `Import complete. Imported ${ROW_COUNT} records, with 0 errors`,
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
          .getByRole("button", { name: /start import/i }),
      )
      .toBeDisabled();
  });

  it("stops the import from the progress snackbar and reports what landed", async () => {
    const screen = await render(<ImportHarness />);

    await startImport(screen);

    await screen.getByRole("button", { name: /stop import/i }).click();

    await expect
      .element(screen.getByText(/Import in progress/))
      .not.toBeInTheDocument();

    const createdWhenStopped = createdCount;
    expect(createdWhenStopped).toBeLessThan(ROW_COUNT);

    await expect
      .element(screen.getByText(/^Import stopped\./))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText(/Import complete/))
      .not.toBeInTheDocument();
    expect(createdCount).toBe(createdWhenStopped);
  });

  it("counts the rejected rows in the progress bar", async () => {
    isRowRejected = () => attemptCount % 2 === 0;
    const screen = await render(<ImportHarness />);

    await startImport(screen);

    await expect
      .element(screen.getByText(/with [1-9]\d* errors/))
      .toBeInTheDocument();

    const progress = readProgressSnackbar();
    expect(progress.errorCount).toBeGreaterThan(0);
    expect(progress.value).toBeCloseTo(
      ((progress.importCount + progress.errorCount) / progress.rowCount) * 100,
    );

    finishRemainingBatchesFast();

    await expect
      .element(screen.getByText(/Import complete/))
      .toBeInTheDocument();
  });
});
