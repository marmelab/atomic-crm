import { describe, expect, it } from "vitest";
import { getSuggestedAmount } from "../QuickPaymentDialog";

describe("getSuggestedAmount", () => {
  it("rimborso_spese suggests remaining expenses, not total", () => {
    expect(
      getSuggestedAmount("rimborso_spese", {
        fees: 1000,
        expenses: 300,
        paid: 500,
        paidRimborsoSpese: 100,
      }),
    ).toBe(200);
  });
  it("rimborso_spese suggests 0 when all expenses reimbursed", () => {
    expect(
      getSuggestedAmount("rimborso_spese", {
        fees: 1000,
        expenses: 300,
        paid: 800,
        paidRimborsoSpese: 300,
      }),
    ).toBe(0);
  });
  it("saldo suggests full balance due", () => {
    expect(
      getSuggestedAmount("saldo", {
        fees: 1000,
        expenses: 200,
        paid: 500,
        paidRimborsoSpese: 0,
      }),
    ).toBe(700);
  });
  it("saldo suggests 0 when overpaid", () => {
    expect(
      getSuggestedAmount("saldo", {
        fees: 500,
        expenses: 0,
        paid: 700,
        paidRimborsoSpese: 0,
      }),
    ).toBe(0);
  });
  it("acconto suggests total fees", () => {
    expect(
      getSuggestedAmount("acconto", {
        fees: 1000,
        expenses: 200,
        paid: 0,
        paidRimborsoSpese: 0,
      }),
    ).toBe(1000);
  });
});
