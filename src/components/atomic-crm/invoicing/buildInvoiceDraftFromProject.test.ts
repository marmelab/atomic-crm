import { describe, expect, it } from "vitest";

import type { Client, Payment, Project, Service } from "../types";
import { buildInvoiceDraftFromProject } from "./buildInvoiceDraftFromProject";

const baseClient: Client = {
  id: "client-1",
  name: "Cliente Progetto",
  client_type: "azienda_locale",
  tags: [],
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
};

const baseProject: Project = {
  id: "project-1",
  client_id: "client-1",
  name: "Progetto Alpha",
  category: "spot",
  status: "in_corso",
  all_day: true,
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
};

const buildService = (
  id: string,
  overrides: Partial<Service> = {},
): Service => ({
  id,
  client_id: "client-1",
  project_id: "project-1",
  service_date: "2026-01-10T12:00:00.000Z",
  all_day: true,
  is_taxable: true,
  service_type: "riprese",
  fee_shooting: 100,
  fee_editing: 0,
  fee_other: 0,
  discount: 0,
  km_distance: 0,
  km_rate: 0.2,
  created_at: "2026-01-09T10:00:00.000Z",
  ...overrides,
});

describe("buildInvoiceDraftFromProject", () => {
  it("keeps one line item per service when the same type count is low", () => {
    const draft = buildInvoiceDraftFromProject({
      project: baseProject,
      client: baseClient,
      services: [
        buildService("s1", { service_type: "riprese" }),
        buildService("s2", {
          service_type: "montaggio",
          service_date: "2026-01-12T12:00:00.000Z",
        }),
        buildService("s3", {
          service_type: "riprese_montaggio",
          service_date: "2026-01-15T12:00:00.000Z",
        }),
      ],
    });

    expect(draft.lineItems).toHaveLength(3);
    expect(draft.lineItems.every((lineItem) => lineItem.quantity === 1)).toBe(
      true,
    );
  });

  it("lists each service individually even when many share the same type", () => {
    const draft = buildInvoiceDraftFromProject({
      project: baseProject,
      client: baseClient,
      services: Array.from({ length: 6 }, (_, index) =>
        buildService(`s-${index + 1}`, {
          service_type: "riprese",
          fee_shooting: 100,
          service_date: `2026-01-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
        }),
      ),
    });

    expect(draft.lineItems).toHaveLength(6);
    expect(draft.lineItems[0].description).toBe("Riprese del 10/01/2026");
    expect(draft.lineItems[5].description).toBe("Riprese del 15/01/2026");
  });

  it("adds per-service km reimbursement lines", () => {
    const draft = buildInvoiceDraftFromProject({
      project: baseProject,
      client: baseClient,
      services: [
        buildService("s1", { km_distance: 10, km_rate: 0.2 }),
        buildService("s2", {
          km_distance: 5,
          km_rate: 0.2,
          service_date: "2026-01-12T12:00:00.000Z",
        }),
        buildService("s3", {
          project_id: "project-2",
          km_distance: 100,
          km_rate: 0.2,
        }),
      ],
    });

    // s1: service line + km line, s2: service line + km line, s3 excluded (different project)
    expect(draft.lineItems).toHaveLength(4);
    expect(draft.lineItems[1]).toEqual({
      description: "Rimborso chilometrico · 10 km × €0,20/km",
      quantity: 1,
      unitPrice: 2,
    });
    expect(draft.lineItems[3]).toEqual({
      description: "Rimborso chilometrico · 5 km × €0,20/km",
      quantity: 1,
      unitPrice: 1,
    });
  });

  it("excludes services that already have an invoice_ref", () => {
    const draft = buildInvoiceDraftFromProject({
      project: baseProject,
      client: baseClient,
      services: [
        buildService("s1", { fee_shooting: 300 }),
        buildService("s2", {
          fee_shooting: 500,
          invoice_ref: "FPA-001",
          service_date: "2026-01-12T12:00:00.000Z",
        }),
      ],
    });

    expect(draft.lineItems).toHaveLength(1);
    expect(draft.lineItems[0].unitPrice).toBe(300);
  });

  it("subtracts only received payments from collectable amount", () => {
    const payments: Pick<Payment, "amount" | "payment_type" | "status">[] = [
      { amount: 50, payment_type: "acconto", status: "ricevuto" },
      { amount: 200, payment_type: "saldo", status: "in_attesa" },
    ];

    const draft = buildInvoiceDraftFromProject({
      project: baseProject,
      client: baseClient,
      services: [buildService("s1", { fee_shooting: 300 })],
      payments,
    });

    const paymentLine = draft.lineItems.find((li) => li.unitPrice < 0);
    expect(paymentLine).toEqual({
      description: "Pagamenti gia ricevuti",
      quantity: 1,
      unitPrice: -50,
    });
  });

  it("returns empty lineItems when received payments cover everything", () => {
    const payments: Pick<Payment, "amount" | "payment_type" | "status">[] = [
      { amount: 100, payment_type: "saldo", status: "ricevuto" },
    ];

    const draft = buildInvoiceDraftFromProject({
      project: baseProject,
      client: baseClient,
      services: [buildService("s1", { fee_shooting: 100 })],
      payments,
    });

    expect(draft.lineItems).toEqual([]);
  });
});
