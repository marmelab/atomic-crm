import { describe, expect, it } from "vitest";

import type { Client, Service } from "../types";
import { buildInvoiceDraftFromService } from "./buildInvoiceDraftFromService";

const baseClient: Client = {
  id: "client-1",
  name: "Cliente Test",
  client_type: "azienda_locale",
  tags: [],
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
};

const baseService = (overrides: Partial<Service> = {}): Service => ({
  id: "service-1",
  client_id: "client-1",
  project_id: "project-1",
  service_date: "2026-01-10T12:00:00.000Z",
  all_day: true,
  is_taxable: true,
  service_type: "riprese_montaggio",
  fee_shooting: 500,
  fee_editing: 200,
  fee_other: 100,
  discount: 0,
  km_distance: 0,
  km_rate: 0.19,
  created_at: "2026-01-09T10:00:00.000Z",
  ...overrides,
});

describe("buildInvoiceDraftFromService", () => {
  it("builds one line item for a simple service", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService(),
      client: baseClient,
    });

    expect(draft.source.kind).toBe("service");
    expect(draft.lineItems).toHaveLength(1);
    expect(draft.lineItems[0]).toEqual(
      expect.objectContaining({
        description: expect.stringContaining("Riprese Montaggio del"),
        quantity: 1,
        unitPrice: 800,
      }),
    );
  });

  it("adds a dedicated km reimbursement line when present", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({
        km_distance: 50,
        km_rate: 0.4,
      }),
      client: baseClient,
    });

    expect(draft.lineItems).toHaveLength(2);
    expect(draft.lineItems[1]).toEqual({
      description: "Rimborso chilometrico (50 km)",
      quantity: 1,
      unitPrice: 20,
    });
  });

  it("calculates service net total including discount", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({
        fee_shooting: 200,
        fee_editing: 100,
        fee_other: 50,
        discount: 25,
      }),
      client: baseClient,
    });

    expect(draft.lineItems[0]?.unitPrice).toBe(325);
  });
});
