import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { buildTestCrm } from "./actionDestinationTestFixtures";
import type { SalesCall, Task } from "../types";

// Unmatched Sales Call Resolution slice: resolve_sales_call must never
// open the generic Edit Task modal (Description/Due date/Type/Status
// answer nothing about "what Opportunity does this belong to?") — it
// routes to the dedicated resolution page instead, shows self-describing
// context inline, and never presents its internal-only due_date as a
// dated to-do Leif failed to do.
describe("Task — resolve_sales_call human-facing rendering", () => {
  it("shows the 'Sales call needs matching' header and self-describing context, with no Due date or Postpone offered", async () => {
    await page.viewport(1280, 900);
    const salesCall: SalesCall = {
      id: 1,
      opportunity_id: null,
      contact_id: 1,
      status: "booked",
      original_scheduled_at: "2026-09-10T18:00:00.000Z",
      scheduled_at: "2026-09-10T18:00:00.000Z",
      reschedule_count: 0,
      source: "acuity",
      acuity_appointment_id: "acuity-1",
      acuity_appointment_type_id: "12345",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const resolveTask: Task = {
      id: 3000,
      contact_id: 1,
      type: "resolve_sales_call",
      text: "SalesId Verify · The Living Example · Sep 10, 2026, 6:00 PM",
      due_date: "2026-01-01T00:00:00.000Z",
      done_date: null,
      status: "pending",
      sales_id: 0,
      sales_call_id: 1,
    };
    const { element } = buildTestCrm({
      sales_calls: [salesCall],
      tasks: [resolveTask],
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Sales call needs matching"))
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "SalesId Verify · The Living Example · Sep 10, 2026, 6:00 PM",
        ),
      )
      .toBeInTheDocument();
    await expect.element(screen.getByText(/^Due /)).not.toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: "SalesId Verify · The Living Example · Sep 10, 2026, 6:00 PM",
    });
    await expect
      .element(link)
      .toHaveAttribute("href", "/sales-calls/1/resolve");
  });

  it("the dropdown's Edit action navigates to the resolution page too, never the generic Task editor", async () => {
    await page.viewport(1280, 900);
    const salesCall: SalesCall = {
      id: 1,
      opportunity_id: null,
      contact_id: 1,
      status: "booked",
      original_scheduled_at: "2026-09-10T18:00:00.000Z",
      scheduled_at: "2026-09-10T18:00:00.000Z",
      reschedule_count: 0,
      source: "acuity",
      acuity_appointment_id: "acuity-1",
      acuity_appointment_type_id: "12345",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const resolveTask: Task = {
      id: 3001,
      contact_id: 1,
      type: "resolve_sales_call",
      text: "SalesId Verify · The Living Example · Sep 10, 2026, 6:00 PM",
      due_date: "2026-01-01T00:00:00.000Z",
      done_date: null,
      status: "pending",
      sales_id: 0,
      sales_call_id: 1,
    };
    const { element } = buildTestCrm({
      sales_calls: [salesCall],
      tasks: [resolveTask],
    });
    const screen = await render(element);

    const menuButton = screen.getByRole("button", { name: "task actions" });
    await menuButton.click();
    const editItem = screen.getByText("Edit");
    await editItem.click();

    // Navigated to the dedicated resolution page — proven by its own
    // distinctive explanation, never the generic Edit sheet (which would
    // show a "Description"/"Due date" form instead). This fixture's
    // acuity_appointment_type_id ("12345") matches no seeded Offer/Cohort,
    // so the specific reason shown is the unknown-appointment-type case.
    await expect
      .element(screen.getByText("Appointment type not mapped to an Offer"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Description"))
      .not.toBeInTheDocument();
  });
});
