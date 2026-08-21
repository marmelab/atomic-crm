import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { RecordContextProvider, ResourceContextProvider } from "ra-core";
import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import { AddTask } from "./AddTask";
import type { Db } from "../providers/fakerest/dataGenerator/types";

const contact = buildContact({
  first_name: "Ada",
  id: 1,
  last_name: "Lovelace",
});

const renderAddTask = (
  dataProvider?: Parameters<typeof StoryWrapper>[0]["dataProvider"],
) =>
  render(
    <StoryWrapper
      data={{ contacts: [contact] } as Partial<Db>}
      dataProvider={dataProvider}
    >
      <ResourceContextProvider value="contacts">
        <RecordContextProvider value={contact}>
          <AddTask />
        </RecordContextProvider>
      </ResourceContextProvider>
    </StoryWrapper>,
  );

describe("AddTask", () => {
  it("reopens the dialog with the task details when the create fails", async () => {
    const screen = await renderAddTask({
      create: () =>
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("Network error")), 500),
        ),
    });

    await screen.getByRole("button", { name: /add task/i }).click();
    await screen
      .getByLabelText(/description/i)
      .fill("Follow up about onboarding");
    await screen.getByRole("button", { name: /^save$/i }).click();

    // The user dismisses the dialog while the request is still in flight.
    await screen.getByRole("button", { name: /close/i }).click();
    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();

    // The failed request brings the dialog back, task details included.
    await expect.element(screen.getByText("Network error")).toBeInTheDocument();
    await expect
      .element(screen.getByLabelText(/description/i))
      .toHaveValue("Follow up about onboarding");
  });

  it("keeps the task details when the create fails while the dialog is open", async () => {
    const screen = await renderAddTask({
      create: () => Promise.reject(new Error("Network error")),
    });

    await screen.getByRole("button", { name: /add task/i }).click();
    await screen
      .getByLabelText(/description/i)
      .fill("Follow up about onboarding");
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.element(screen.getByText("Network error")).toBeInTheDocument();
    await expect
      .element(screen.getByLabelText(/description/i))
      .toHaveValue("Follow up about onboarding");
  });

  it("closes the dialog and starts from a blank form after a successful create", async () => {
    const screen = await renderAddTask();

    await screen.getByRole("button", { name: /add task/i }).click();
    await screen
      .getByLabelText(/description/i)
      .fill("Follow up about onboarding");
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.element(screen.getByText("Task added")).toBeInTheDocument();
    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();

    await screen.getByRole("button", { name: /add task/i }).click();
    await expect.element(screen.getByLabelText(/description/i)).toHaveValue("");
  });
});
