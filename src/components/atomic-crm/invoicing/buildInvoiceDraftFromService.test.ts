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
  it("builds description with type and date when no description/location", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService(),
      client: baseClient,
    });

    expect(draft.lineItems).toHaveLength(1);
    expect(draft.lineItems[0]).toEqual(
      expect.objectContaining({
        description: "Riprese Montaggio del 10/01/2026",
        quantity: 1,
        unitPrice: 800,
      }),
    );
  });

  it("prepends service description when available", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({ description: "Spot Kestè Store" }),
      client: baseClient,
    });

    expect(draft.lineItems[0]?.description).toBe(
      "Spot Kestè Store · Riprese Montaggio del 10/01/2026",
    );
  });

  it("appends location when available", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({ location: "Catania" }),
      client: baseClient,
    });

    expect(draft.lineItems[0]?.description).toBe(
      "Riprese Montaggio del 10/01/2026 · Catania",
    );
  });

  it("includes description + location when both present", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({
        description: "Video evento",
        location: "Palermo",
      }),
      client: baseClient,
    });

    expect(draft.lineItems[0]?.description).toBe(
      "Video evento · Riprese Montaggio del 10/01/2026 · Palermo",
    );
  });

  it("formats date range when service_end is present", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({
        description: "Festival",
        service_end: "2026-01-15T18:00:00.000Z",
      }),
      client: baseClient,
    });

    expect(draft.lineItems[0]?.description).toBe(
      "Festival · Riprese Montaggio del 10/01/2026 – 15/01/2026",
    );
  });

  it("adds km reimbursement line with distance and rate breakdown", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({
        km_distance: 50,
        km_rate: 0.4,
        location: "Agrigento",
      }),
      client: baseClient,
    });

    expect(draft.lineItems).toHaveLength(2);
    // no travel_origin/destination → only km breakdown
    expect(draft.lineItems[1]).toEqual({
      description: "Rimborso chilometrico · 50 km × €0,40/km",
      quantity: 1,
      unitPrice: 20,
    });
  });

  it("km line shows route with round trip indicator", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({
        km_distance: 200,
        km_rate: 0.4,
        travel_origin: "Catania",
        travel_destination: "Agrigento",
        trip_mode: "round_trip",
      }),
      client: baseClient,
    });

    expect(draft.lineItems[1]?.description).toBe(
      "Rimborso chilometrico · Catania – Agrigento A/R · 200 km × €0,40/km",
    );
  });

  it("km line shows route without A/R for one-way trips", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({
        km_distance: 100,
        km_rate: 0.4,
        travel_origin: "Catania",
        travel_destination: "Palermo",
        trip_mode: "one_way",
      }),
      client: baseClient,
    });

    expect(draft.lineItems[1]?.description).toBe(
      "Rimborso chilometrico · Catania – Palermo · 100 km × €0,40/km",
    );
  });

  it("km line falls back to default rate when service rate is missing", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({
        km_distance: 100,
        km_rate: undefined as unknown as number,
      }),
      client: baseClient,
      defaultKmRate: 0.19,
    });

    expect(draft.lineItems[1]?.description).toBe(
      "Rimborso chilometrico · 100 km × €0,19/km",
    );
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

  it("returns empty lineItems when already invoiced", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({ invoice_ref: "FPR 1/26" }),
      client: baseClient,
    });

    expect(draft.lineItems).toHaveLength(0);
  });

  it("source label uses description when available", () => {
    const draft = buildInvoiceDraftFromService({
      service: baseService({ description: "Spot promo" }),
      client: baseClient,
    });

    expect(draft.source.label).toBe("Spot promo · 10/01/2026");
  });
});
