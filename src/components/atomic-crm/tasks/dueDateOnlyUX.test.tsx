import { ResourceContextProvider, ShowBase } from "ra-core";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { AddTask } from "./AddTask";
import { buildDeal, buildTestCrm } from "./actionDestinationTestFixtures";
import type { Task } from "../types";

// Manual Task UX repair, round 2 (§4): Leif does not need clock-time
// precision for an ordinary manual Task — the create/edit form now asks
// for a date only (DateInput, native `<input type="date">`), never a
// datetime-local control. Verified directly against the rendered DOM
// (the input's own `type` attribute), the most literal proof "no time
// picker is exposed" can have.
describe("Manual Task due date — date only, no time (Manual Task UX repair, round 2)", () => {
  it("O/Q: the create form shows a date-only control, no time field", async () => {
    const contact = buildContact({
      id: 1,
      first_name: "Maya",
      last_name: "Chen",
    });
    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <AddTask />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "Add task" }).click();

    const dueDateInput = screen.getByLabelText(/due date/i);
    await expect.element(dueDateInput).toHaveAttribute("type", "date");
    // Q: no separate time control anywhere in the dialog.
    expect(screen.container.querySelector('input[type="time"]')).toBeNull();
  });

  it("P/Q: the edit form (an existing manual Task) shows a date-only control, no time field", async () => {
    await page.viewport(1280, 900);
    const existingTask: Task = {
      id: 2000,
      contact_id: 1,
      type: "other",
      text: "Check in about GYU attendance",
      due_date: "2026-09-08T13:40:00.000Z",
      done_date: null,
      status: "pending",
      sales_id: 0,
    };
    const { element } = buildTestCrm({
      deals: [buildDeal()],
      tasks: [existingTask],
    });
    const screen = await render(element);

    // The title button opens the generic edit sheet for a plain `other`
    // Task (no dedicated resolution page — see taskActionDestination.ts).
    await screen.getByText("Check in about GYU attendance").click();

    const dueDateInput = screen.getByLabelText(/due date/i);
    await expect.element(dueDateInput).toHaveAttribute("type", "date");
  });
});
