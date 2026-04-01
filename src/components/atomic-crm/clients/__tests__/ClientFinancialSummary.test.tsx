import { describe, expect, it } from "vitest";
import type { ClientCommercialPosition } from "../../types";

// Contract test: verify the view row shape has the fields the component needs.
const mapViewRowToDisplay = (row: ClientCommercialPosition) => ({
  totalFees: row.total_fees,
  totalExpenses: row.total_expenses,
  totalOwed: row.total_owed,
  totalPaid: row.total_paid,
  balanceDue: row.balance_due,
});

describe("ClientFinancialSummary view consumption", () => {
  it("maps view row to display values with no recalculation", () => {
    const row: ClientCommercialPosition = {
      client_id: "c1",
      client_name: "Test Client",
      total_fees: 1000,
      total_expenses: 200,
      total_owed: 1200,
      total_paid: 500,
      balance_due: 700,
      projects_count: 2,
    };
    const display = mapViewRowToDisplay(row);
    expect(display.totalFees).toBe(1000);
    expect(display.totalExpenses).toBe(200);
    expect(display.totalOwed).toBe(1200);
    expect(display.totalPaid).toBe(500);
    expect(display.balanceDue).toBe(700);
  });

  it("handles zero-activity client (all zeros, not nulls)", () => {
    const row: ClientCommercialPosition = {
      client_id: "c2",
      client_name: "Empty Client",
      total_fees: 0,
      total_expenses: 0,
      total_owed: 0,
      total_paid: 0,
      balance_due: 0,
      projects_count: 0,
    };
    const display = mapViewRowToDisplay(row);
    expect(display.balanceDue).toBe(0);
    expect(display.totalOwed).toBe(0);
  });

  it("handles negative balance_due (overpayment / client credit)", () => {
    const row: ClientCommercialPosition = {
      client_id: "c3",
      client_name: "Overpaid Client",
      total_fees: 500,
      total_expenses: 0,
      total_owed: 500,
      total_paid: 700,
      balance_due: -200,
      projects_count: 1,
    };
    const display = mapViewRowToDisplay(row);
    expect(display.balanceDue).toBe(-200);
  });
});
