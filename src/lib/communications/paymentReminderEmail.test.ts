import { describe, expect, it } from "vitest";

import { buildPaymentReminderEmail } from "./paymentReminderEmail";

describe("buildPaymentReminderEmail", () => {
  it("formats the payment date on the Europe/Rome business day", () => {
    const email = buildPaymentReminderEmail({
      clientName: "Cliente Test",
      clientEmail: "cliente@example.com",
      amount: 250,
      paymentDate: "2026-03-09T23:00:00.000Z",
      daysOverdue: 1,
      paymentType: "saldo",
      supportEmail: "support@example.com",
    });

    expect(email.previewText).toContain("10 marzo 2026");
    expect(email.text).toContain("Scadenza prevista: 10 marzo 2026");
  });
});
