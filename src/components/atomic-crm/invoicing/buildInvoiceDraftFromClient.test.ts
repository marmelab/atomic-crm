import { describe, expect, it } from "vitest";

import type { Client, Project, Service } from "../types";
import { buildInvoiceDraftFromClient } from "./buildInvoiceDraftFromClient";

const baseClient: Client = {
  id: "client-1",
  name: "Cliente Uno",
  client_type: "azienda_locale",
  tags: [],
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
};

const baseProjects: Project[] = [
  {
    id: "project-1",
    client_id: "client-1",
    name: "Progetto 1",
    category: "spot",
    status: "in_corso",
    all_day: true,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
  },
  {
    id: "project-2",
    client_id: "client-1",
    name: "Progetto 2",
    category: "wedding",
    status: "in_corso",
    all_day: true,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
  },
];

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

describe("buildInvoiceDraftFromClient", () => {
  it("includes only client services without invoice_ref", () => {
    const draft = buildInvoiceDraftFromClient({
      client: baseClient,
      projects: baseProjects,
      services: [
        buildService("s1", {
          project_id: "project-1",
          fee_shooting: 100,
        }),
        buildService("s2", {
          project_id: "project-1",
          invoice_ref: "FPA-001",
          fee_shooting: 700,
        }),
        buildService("s3", {
          project_id: "project-2",
          fee_shooting: 200,
          km_distance: 10,
          km_rate: 0.2,
        }),
        buildService("s4", {
          project_id: null,
          fee_shooting: 50,
        }),
        buildService("s5", {
          client_id: "client-2",
          fee_shooting: 999,
        }),
      ],
    });

    expect(draft.source.kind).toBe("client");
    expect(draft.lineItems).toHaveLength(4);
    expect(draft.lineItems).toEqual(
      expect.arrayContaining([
        {
          description: "Progetto 1 · Riprese del 10/01/2026",
          quantity: 1,
          unitPrice: 100,
        },
        {
          description: "Progetto 2 · Riprese del 10/01/2026",
          quantity: 1,
          unitPrice: 200,
        },
        {
          description: "Progetto 2 · Rimborso chilometrico · 10 km × €0,20/km",
          quantity: 1,
          unitPrice: 2,
        },
        {
          description: "Servizi senza progetto · Riprese del 10/01/2026",
          quantity: 1,
          unitPrice: 50,
        },
      ]),
    );
  });

  it("returns empty lineItems when all services are already invoiced", () => {
    const draft = buildInvoiceDraftFromClient({
      client: baseClient,
      projects: baseProjects,
      services: [
        buildService("s1", {
          fee_shooting: 500,
          invoice_ref: "FPA-001",
        }),
        buildService("s2", {
          fee_shooting: 300,
          invoice_ref: "FPA-002",
          project_id: "project-2",
        }),
      ],
    });

    expect(draft.lineItems).toEqual([]);
  });
});
