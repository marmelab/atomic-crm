import { describe, expect, it } from "vitest";

import type { Client, Payment, Quote } from "../types";
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

  it("subtracts only received payments from collectable amount", () => {
    const payments: Pick<Payment, "amount" | "payment_type" | "status">[] = [
      { amount: 400, payment_type: "acconto", status: "ricevuto" },
      { amount: 300, payment_type: "saldo", status: "in_attesa" },
      { amount: 200, payment_type: "acconto", status: "scaduto" },
    ];

    const draft = buildInvoiceDraftFromQuote({
      client: baseClient,
      quote: buildQuote({ amount: 1200 }),
      payments,
    });

    const paymentLine = draft.lineItems.find(
      (li) => li.unitPrice < 0,
    );
    expect(paymentLine).toEqual({
      description: "Pagamenti gia ricevuti",
      quantity: 1,
      unitPrice: -400,
    });
  });

  it("returns empty lineItems when received payments cover the full amount", () => {
    const payments: Pick<Payment, "amount" | "payment_type" | "status">[] = [
      { amount: 1200, payment_type: "saldo", status: "ricevuto" },
    ];

    const draft = buildInvoiceDraftFromQuote({
      client: baseClient,
      quote: buildQuote({ amount: 1200 }),
      payments,
    });

    expect(draft.lineItems).toEqual([]);
  });

  it("handles refund payments correctly (sign inversion)", () => {
    const payments: Pick<Payment, "amount" | "payment_type" | "status">[] = [
      { amount: 500, payment_type: "acconto", status: "ricevuto" },
      { amount: 100, payment_type: "rimborso", status: "ricevuto" },
    ];

    const draft = buildInvoiceDraftFromQuote({
      client: baseClient,
      quote: buildQuote({ amount: 1200 }),
      payments,
    });

    const paymentLine = draft.lineItems.find(
      (li) => li.unitPrice < 0,
    );
    // Net received = 500 - 100 = 400
    expect(paymentLine?.unitPrice).toBe(-400);
  });
});
