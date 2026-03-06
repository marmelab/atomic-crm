import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  buildContact,
  createCrmDb,
  createCrmScenario,
  CrmTestProvider,
  OpenTaskCreateSheetHarness,
} from "@/test/browser/atomic-crm/crmUiHarness";

describe("TaskCreateSheet integration", () => {
  it("creates a task for a selected contact and updates last_seen", async () => {
    const originalLastSeen = "2025-01-02T10:00:00.000Z";
    const scenario = createCrmScenario({
      db: createCrmDb({
        contacts: [
          buildContact({
            first_name: "Ada",
            id: 1,
            last_name: "Lovelace",
            last_seen: "2025-01-01T10:00:00.000Z",
            nb_tasks: 1,
          }),
          buildContact({
            first_name: "Grace",
            id: 2,
            last_name: "Hopper",
            last_seen: originalLastSeen,
          }),
        ] as any,
        tasks: [
          {
            contact_id: 1,
            due_date: "2025-01-03T12:00:00.000Z",
            id: 1,
            sales_id: 0,
            text: "Existing seeded task",
            type: "email",
          },
        ] as any,
      }),
    });
    const user = userEvent.setup();

    render(
      <CrmTestProvider scenario={scenario}>
        <OpenTaskCreateSheetHarness />
      </CrmTestProvider>,
    );

    await user.type(
      await screen.findByLabelText(/description/i),
      "Follow up about onboarding",
    );

    const [contactInput, typeInput] = await screen.findAllByRole("combobox");

    await user.click(contactInput);
    await user.click(await screen.findByText("Grace Hopper"));

    await user.click(typeInput);
    const typeOptions = await screen.findByRole("listbox");
    await user.click(within(typeOptions).getByText("Call"));

    const dueDateInput = screen.getByLabelText(/due date/i);
    await user.clear(dueDateInput);
    await user.type(dueDateInput, "2026-03-06T12:30");

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText("Task added")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Create Task")).toBeNull();
    });

    await waitFor(() => {
      return expect(
        scenario.dataProvider
          .getList("tasks", {
            filter: {},
            pagination: { page: 1, perPage: 10 },
            sort: { field: "id", order: "ASC" },
          })
          .then(({ data }) =>
            data.some((task) => task.text === "Follow up about onboarding"),
          ),
      ).resolves.toBe(true);
    });

    const tasks = await scenario.dataProvider.getList("tasks", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    const createdTask = tasks.data.find(
      (task) => task.text === "Follow up about onboarding",
    );

    expect(createdTask).toMatchObject({
      contact_id: 2,
      text: "Follow up about onboarding",
      type: "call",
    });
    expect(tasks.data).toHaveLength(2);

    const updatedContact = await scenario.dataProvider.getOne("contacts", {
      id: 2,
    });
    expect(updatedContact.data.last_seen).not.toBe(originalLastSeen);
    expect(updatedContact.data.nb_tasks).toBe(1);
  });
});
