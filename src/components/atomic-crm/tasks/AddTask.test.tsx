import { RecordContextProvider, ResourceContextProvider } from "ra-core";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import type { Db } from "../providers/fakerest/dataGenerator/types";
import { AddTask } from "./AddTask";

const contact = buildContact({
  first_name: "Ada",
  id: 1,
  last_name: "Lovelace",
});

describe("AddTask", () => {
  it("closes the dialog and confirms the creation when the contact refresh fails", async () => {
    // Arrange: the task create succeeds, the follow-up contact refresh does not.
    const screen = await render(
      <StoryWrapper
        data={{ contacts: [contact] } as Partial<Db>}
        dataProvider={{
          getOne: (resource: string) =>
            Promise.reject(new Error(`getOne("${resource}") is unavailable`)),
        }}
      >
        <ResourceContextProvider value="contacts">
          <RecordContextProvider value={contact}>
            <AddTask />
          </RecordContextProvider>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    // Act
    await screen.getByRole("button", { name: /add task/i }).click();
    await screen
      .getByLabelText(/description/i)
      .fill("Follow up about onboarding");
    await screen.getByRole("button", { name: /^save$/i }).click();

    // Assert: the task exists, so the dialog must go away with a confirmation.
    await expect.element(screen.getByText("Task added")).toBeInTheDocument();
    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  });
});
