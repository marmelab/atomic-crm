import { describe, expect, it } from "vitest";

import { getPaymentReminderDaysOverdue } from "./paymentReminderDates";

describe("getPaymentReminderDaysOverdue", () => {
  it("computes overdue days on the Europe/Rome business date", () => {
    expect(
      getPaymentReminderDaysOverdue("2026-03-09T23:00:00.000Z", "2026-03-10"),
    ).toBe(1);
  });

  it("keeps the minimum display at one day", () => {
    expect(
      getPaymentReminderDaysOverdue("2026-03-09T23:00:00.000Z", "2026-03-10"),
    ).toBeGreaterThanOrEqual(1);
  });

  it("returns zero when no payment date exists", () => {
    expect(getPaymentReminderDaysOverdue(null, "2026-03-10")).toBe(0);
  });
});
