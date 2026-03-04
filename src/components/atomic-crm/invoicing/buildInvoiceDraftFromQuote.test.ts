import { describe, expect, it } from "vitest";

import type { Client, Quote } from "../types";
import { buildInvoiceDraftFromQuote } from "./buildInvoiceDraftFromQuote";

const baseClient: Client = {
  id: "client-1",
  name: "Cliente Preventivo",
  client_type: "azienda_locale",
  tags: [],
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
};

const buildQuote = (overrides: Partial<Quote> = {}): Quote => ({
  id: "quote-1",
  client_id: "client-1",
  service_type: "spot",
  all_day: true,
  amount: 1200,
  status: "accettato",
  is_taxable: true,
  index: 1,
  created_at: "2026-01-10T10:00:00.000Z",
  updated_at: "2026-01-10T10:00:00.000Z",
  ...overrides,
});

describe("buildInvoiceDraftFromQuote", () => {
  it("uses sanitized quote items when present", () => {
    const draft = buildInvoiceDraftFromQuote({
      client: baseClient,
      quote: buildQuote({
        quote_items: [
          { description: "Riprese", quantity: 2, unit_price: 300 },
          { description: "Montaggio", quantity: 1, unit_price: 250 },
        ],
      }),
    });

    expect(draft.source.kind).toBe("quote");
    expect(draft.lineItems).toEqual([
      { description: "Riprese", quantity: 2, unitPrice: 300 },
      { description: "Montaggio", quantity: 1, unitPrice: 250 },
    ]);
  });

  it("falls back to one amount line when quote items are missing", () => {
    const draft = buildInvoiceDraftFromQuote({
      client: baseClient,
      quote: buildQuote({
        description: "",
        amount: 750,
        quote_items: [],
      }),
    });

    expect(draft.lineItems).toEqual([
      {
        description: "Prestazione da preventivo",
        quantity: 1,
        unitPrice: 750,
      },
    ]);
  });
});
