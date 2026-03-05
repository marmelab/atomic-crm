import type { InvoiceImportRecordDraft } from "@/lib/ai/invoiceImport";

export const confidenceTone: Record<
  InvoiceImportRecordDraft["confidence"],
  "default" | "secondary" | "outline"
> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

export const resourceLabels = {
  payments: "Pagamento",
  expenses: "Spesa",
  services: "Servizio",
};

export const hasBillingProfileDraft = (record: InvoiceImportRecordDraft) =>
  [
    record.billingName,
    record.vatNumber,
    record.fiscalCode,
    record.billingAddressStreet,
    record.billingAddressNumber,
    record.billingPostalCode,
    record.billingCity,
    record.billingProvince,
    record.billingCountry,
    record.billingSdiCode,
    record.billingPec,
  ].some((value) => value?.trim());
