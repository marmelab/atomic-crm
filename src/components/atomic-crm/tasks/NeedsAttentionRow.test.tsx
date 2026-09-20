import { render } from "vitest-browser-react";

import { buildTestCrm } from "./actionDestinationTestFixtures";
import type { SalesCall, Task } from "../types";

// Leif's own mockup is the specification:
//
//   Megan Auron
//   What happened on the Jul 7 sales call?
//   [Resolve]
//
// Every Needs Attention row answers WHO / WHAT / WHEN / WHAT CAN I DO, and
// none of them shouts an internal type at him.

const salesCall = (overrides: Partial<SalesCall> = {}): SalesCall =>
  ({
    id: 1,
    opportunity_id: 1,
    contact_id: 1,
    status: "booked",
    original_scheduled_at: "2026-07-07T18:00:00.000Z",
    scheduled_at: "2026-07-07T18:00:00.000Z",
    reschedule_count: 0,
    source: "acuity",
    acuity_appointment_id: "acuity-1",
    acuity_appointment_type_id: "12345",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as SalesCall;

const task = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 3100,
    contact_id: 1,
    type: "resolve_sales_call",
    text: "SalesId Verify · The Living Example · Jul 7, 2026",
    due_date: "2026-01-01T00:00:00.000Z",
    done_date: null,
    status: "pending",
    sales_id: 0,
    sales_call_id: 1,
    ...overrides,
  }) as Task;

describe("Needs Attention rows", () => {
  it("asks what happened on the call, and offers exactly one thing to do", async () => {
    // Arrange
    const { element } = buildTestCrm({
      sales_calls: [salesCall()],
      tasks: [task()],
    });

    // Act
    const screen = await render(element);

    // Assert — the question in plain language, and a verb to act on.
    await expect
      .element(screen.getByText("What happened on this call?"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Resolve" }))
      .toBeInTheDocument();
  });

  it("names the person the row is about", async () => {
    // Arrange
    const { element } = buildTestCrm({
      sales_calls: [salesCall()],
      tasks: [task()],
    });

    // Act
    const screen = await render(element);

    // Assert — WHO, as a link to that person, not buried in a sentence.
    await expect
      .element(screen.getByRole("link", { name: "SalesId Verify" }))
      .toHaveAttribute("href", "/contacts/1/show");
  });

  it("asks a future booking whose it is, never what happened on it", async () => {
    // Arrange — Anna Howard's 29 October booking, attached to nothing.
    // The row used to read "What happened on this call?" above a [Resolve]
    // button, about a call five weeks away.
    const { element } = buildTestCrm({
      sales_calls: [
        salesCall({
          opportunity_id: null,
          scheduled_at: "2026-10-29T18:00:00.000Z",
          original_scheduled_at: "2026-10-29T18:00:00.000Z",
        }),
      ],
      tasks: [
        task({
          type: "sales_call_needs_matching",
          text: "SalesId Verify · The Living Example · Oct 29, 2026, 6:00 PM",
        }),
      ],
    });

    // Act
    const screen = await render(element);

    // Assert
    await expect
      .element(
        screen.getByText("Which Opportunity does this booking belong to?"),
      )
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("What happened on this call?"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Match" }))
      .toBeInTheDocument();
  });

  it("shows no date when the task's due_date is an internal artefact", async () => {
    // Arrange — resolve_sales_call carries a due_date only because the
    // column requires one. Presenting it would invent a deadline.
    const { element } = buildTestCrm({
      sales_calls: [salesCall()],
      tasks: [task()],
    });

    // Act
    const screen = await render(element);

    // Assert
    await expect.element(screen.getByText(/^Due /)).not.toBeInTheDocument();
    await expect.element(screen.getByText("Jan 1")).not.toBeInTheDocument();
  });
});
