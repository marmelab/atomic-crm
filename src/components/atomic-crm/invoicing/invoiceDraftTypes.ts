import type { Identifier } from "ra-core";

import type { Client } from "../types";

export type InvoiceDraftLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceDraftSource = {
  kind: "service" | "project" | "client" | "quote";
  id: Identifier;
  label: string;
};

export type InvoiceDraftInput = {
  client: Client;
  lineItems: InvoiceDraftLineItem[];
  invoiceDate?: string;
  notes?: string;
  source: InvoiceDraftSource;
};

export type InvoiceDraftTotals = {
  taxableAmount: number;
  stampDuty: number;
  totalAmount: number;
};

export const normalizeInvoiceDraftLineItems = (
  lineItems: InvoiceDraftLineItem[],
) =>
  lineItems
    .filter((lineItem) => lineItem.description.trim().length > 0)
    .map((lineItem) => ({
      description: lineItem.description.trim(),
      quantity: Number.isFinite(lineItem.quantity) ? lineItem.quantity : 0,
      unitPrice: Number.isFinite(lineItem.unitPrice) ? lineItem.unitPrice : 0,
    }))
    .filter((lineItem) => lineItem.quantity > 0 || lineItem.unitPrice !== 0);

export const getInvoiceDraftLineTotal = (
  lineItem: Pick<InvoiceDraftLineItem, "quantity" | "unitPrice">,
) => lineItem.quantity * lineItem.unitPrice;

export const computeInvoiceDraftTotals = (
  lineItems: InvoiceDraftLineItem[],
): InvoiceDraftTotals => {
  const taxableAmount = normalizeInvoiceDraftLineItems(lineItems).reduce(
    (sum, lineItem) => sum + getInvoiceDraftLineTotal(lineItem),
    0,
  );
  const stampDuty = taxableAmount > 77.47 ? 2 : 0;

  return {
    taxableAmount,
    stampDuty,
    totalAmount: taxableAmount + stampDuty,
  };
};
