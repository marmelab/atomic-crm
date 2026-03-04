import { describe, expect, it } from "vitest";

import type { Client, Project, Service } from "../types";
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

  it("groups same-type services when there are more than five", () => {
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

    expect(draft.lineItems).toEqual([
      {
        description: "Riprese (6 interventi)",
        quantity: 1,
        unitPrice: 600,
      },
    ]);
  });

  it("adds an aggregated km reimbursement line for project services", () => {
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

    expect(draft.lineItems).toHaveLength(3);
    expect(draft.lineItems[2]).toEqual({
      description: "Rimborsi chilometrici progetto",
      quantity: 1,
      unitPrice: 3,
    });
  });
});
