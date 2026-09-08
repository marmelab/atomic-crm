import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import type { Enrollment } from "../types";
import {
  buildDeal,
  buildReviewTask,
  buildTestCrm,
} from "./actionDestinationTestFixtures";

// Manual Task UX repair, round 2 (§2): the Dashboard Task row's person
// link now goes straight to the Client/Enrollment page when that's
// unambiguous (exactly one CURRENT operational Enrollment), rather than
// always to the Contact page. "Payment" (ClientShow's own
// PaymentContextCard label — confirmed absent anywhere on ContactShow)
// is the distinguishing marker: present after the click means the link
// landed on ClientShow, absent means it stayed on/landed on ContactShow
// — a real rendered-content assertion, not an href implementation
// detail.
const followUpTask = buildReviewTask({
  id: 2000,
  type: "follow_up",
  text: "Follow up",
});

describe("Task Dashboard person link — routes to Client page when deterministic", () => {
  it("G: zero current operational Enrollments — routes to ContactShow", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      deals: [buildDeal({ id: 10, contact_id: 1 })],
      enrollments: [],
      tasks: [followUpTask],
    });
    const screen = await render(element);

    await screen
      .getByRole("link", { name: "SalesId Verify", exact: true })
      .click();

    await expect.element(screen.getByText("Payment")).not.toBeInTheDocument();
  });

  it("H: exactly one current operational Enrollment — routes straight to that Client page", async () => {
    await page.viewport(1280, 900);
    // A second, COMPLETED Enrollment for the same Contact is included on
    // purpose — completed is explicitly excluded from "current
    // operational" (enrollmentConstants.ts), so this also proves the
    // status filter itself, not just the ordinal count.
    const enrollments: Enrollment[] = [
      {
        id: 1,
        opportunity_id: 10,
        status: "active",
        start_date: "2026-01-01",
        end_date: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        opportunity_id: 11,
        status: "completed",
        start_date: "2025-01-01",
        end_date: "2025-06-01",
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-06-01T00:00:00.000Z",
      },
    ];
    const { element } = buildTestCrm({
      deals: [
        buildDeal({ id: 10, contact_id: 1 }),
        buildDeal({ id: 11, contact_id: 1, name: "Older Deal" }),
      ],
      enrollments,
      tasks: [followUpTask],
    });
    const screen = await render(element);

    await screen
      .getByRole("link", { name: "SalesId Verify", exact: true })
      .click();

    await expect.element(screen.getByText("Payment")).toBeVisible();
  });

  it("I: two or more current operational Enrollments — never guesses, routes to ContactShow", async () => {
    await page.viewport(1280, 900);
    const enrollments: Enrollment[] = [
      {
        id: 1,
        opportunity_id: 10,
        status: "active",
        start_date: "2026-01-01",
        end_date: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        opportunity_id: 11,
        status: "onboarding",
        start_date: null,
        end_date: null,
        created_at: "2026-02-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
      },
    ];
    const { element } = buildTestCrm({
      deals: [
        buildDeal({ id: 10, contact_id: 1 }),
        buildDeal({ id: 11, contact_id: 1, name: "Second Deal" }),
      ],
      enrollments,
      tasks: [followUpTask],
    });
    const screen = await render(element);

    await screen
      .getByRole("link", { name: "SalesId Verify", exact: true })
      .click();

    await expect.element(screen.getByText("Payment")).not.toBeInTheDocument();
  });

  it("J: routing does not mutate Task, Enrollment, Contact, or sales state", async () => {
    await page.viewport(1280, 900);
    const enrollments: Enrollment[] = [
      {
        id: 1,
        opportunity_id: 10,
        status: "active",
        start_date: "2026-01-01",
        end_date: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    const { element, dataProvider } = buildTestCrm({
      deals: [buildDeal({ id: 10, contact_id: 1 })],
      enrollments,
      tasks: [followUpTask],
    });
    const screen = await render(element);

    const before = await Promise.all([
      dataProvider.getOne("tasks", { id: followUpTask.id }),
      dataProvider.getOne("enrollments", { id: 1 }),
      dataProvider.getOne("contacts", { id: 1 }),
    ]);

    await screen
      .getByRole("link", { name: "SalesId Verify", exact: true })
      .click();
    await expect.element(screen.getByText("Payment")).toBeVisible();

    const after = await Promise.all([
      dataProvider.getOne("tasks", { id: followUpTask.id }),
      dataProvider.getOne("enrollments", { id: 1 }),
      dataProvider.getOne("contacts", { id: 1 }),
    ]);

    expect(after[0].data).toEqual(before[0].data);
    expect(after[1].data).toEqual(before[1].data);
    expect(after[2].data).toEqual(before[2].data);
  });
});
