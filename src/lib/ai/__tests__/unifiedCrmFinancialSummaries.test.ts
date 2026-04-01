import { describe, expect, it } from "vitest";

import type {
  ClientCommercialPosition,
  ProjectFinancialRow,
} from "@/components/atomic-crm/types";

import {
  mapClientCommercialPositions,
  mapProjectFinancialRows,
} from "../unifiedCrmFinancialSummaries";

describe("mapProjectFinancialRows", () => {
  it("maps view rows to snapshot Map keyed by project_id", () => {
    const rows: ProjectFinancialRow[] = [
      {
        project_id: "p1",
        project_name: "Project Alpha",
        client_id: "c1",
        client_name: "Client A",
        category: "spot",
        total_services: 5,
        total_fees: 2500,
        total_km: 100,
        total_km_cost: 19,
        total_expenses: 300,
        total_owed: 2800,
        total_paid: 1000,
        balance_due: 1800,
      },
    ];
    const map = mapProjectFinancialRows(rows);
    const entry = map.get("p1");
    expect(entry).toBeDefined();
    expect(entry!.totalFees).toBe(2500);
    expect(entry!.totalExpenses).toBe(300);
    expect(entry!.totalPaid).toBe(1000);
    expect(entry!.balanceDue).toBe(1800);
  });
});

describe("mapClientCommercialPositions", () => {
  it("maps view rows with uninvoiced flag from Map", () => {
    const rows: ClientCommercialPosition[] = [
      {
        client_id: "c1",
        client_name: "Client A",
        total_fees: 5000,
        total_expenses: 600,
        total_owed: 5600,
        total_paid: 3000,
        balance_due: 2600,
        projects_count: 3,
      },
    ];
    const uninvoiced = new Map([["c1", 2]]);
    const result = mapClientCommercialPositions(rows, uninvoiced);
    expect(result[0].totalFees).toBe(5000);
    expect(result[0].totalExpenses).toBe(600);
    expect(result[0].balanceDue).toBe(2600);
    expect(result[0].hasUninvoicedServices).toBe(true);
  });

  it("sets hasUninvoicedServices false when count is 0", () => {
    const rows: ClientCommercialPosition[] = [
      {
        client_id: "c2",
        client_name: "Client B",
        total_fees: 1000,
        total_expenses: 0,
        total_owed: 1000,
        total_paid: 1000,
        balance_due: 0,
        projects_count: 1,
      },
    ];
    const result = mapClientCommercialPositions(rows, new Map());
    expect(result[0].hasUninvoicedServices).toBe(false);
  });
});
