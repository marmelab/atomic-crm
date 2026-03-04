import type { Client, Payment, Quote } from "../types";
import { sanitizeQuoteItems } from "../quotes/quoteItems";
import {
  getInvoiceDraftLineTotal,
  type InvoiceDraftInput,
  type InvoiceDraftLineItem,
} from "./invoiceDraftTypes";

type DraftPayment = Pick<Payment, "amount" | "payment_type" | "status">;

const getSignedPaymentAmount = (payment: DraftPayment) =>
  payment.payment_type === "rimborso" ? -payment.amount : payment.amount;

export const buildInvoiceDraftFromQuote = ({
  quote,
  client,
  payments = [],
}: {
  quote: Quote;
  client: Client;
  payments?: DraftPayment[];
}): InvoiceDraftInput => {
  const sanitizedItems = sanitizeQuoteItems(quote.quote_items);
  const receivedPayments = payments.filter((p) => p.status === "ricevuto");
  const linkedTotal = receivedPayments.reduce(
    (sum, payment) => sum + getSignedPaymentAmount(payment),
    0,
  );

  const baseLineItems: InvoiceDraftLineItem[] =
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
  const lineItems = [...baseLineItems];

  if (linkedTotal !== 0) {
    lineItems.push({
      description: "Pagamenti gia ricevuti",
      quantity: 1,
      unitPrice: -linkedTotal,
    });
  }

  const collectableAmount = lineItems.reduce(
    (sum, lineItem) => sum + getInvoiceDraftLineTotal(lineItem),
    0,
  );

  return {
    client,
    lineItems: collectableAmount > 0 ? lineItems : [],
    notes: quote.notes ?? undefined,
    source: {
      kind: "quote",
      id: quote.id,
      label: quote.description?.trim() || "Preventivo",
    },
  };
};
