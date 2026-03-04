import type { Client, Quote } from "../types";
import { sanitizeQuoteItems } from "../quotes/quoteItems";
import type { InvoiceDraftInput } from "./invoiceDraftTypes";

export const buildInvoiceDraftFromQuote = ({
  quote,
  client,
}: {
  quote: Quote;
  client: Client;
}): InvoiceDraftInput => {
  const sanitizedItems = sanitizeQuoteItems(quote.quote_items);

  const lineItems =
    sanitizedItems.length > 0
      ? sanitizedItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        }))
      : [
          {
            description:
              quote.description?.trim() || "Prestazione da preventivo",
            quantity: 1,
            unitPrice: Number(quote.amount ?? 0),
          },
        ];

  return {
    client,
    lineItems,
    notes: quote.notes ?? undefined,
    source: {
      kind: "quote",
      id: quote.id,
      label: quote.description?.trim() || "Preventivo",
    },
  };
};
