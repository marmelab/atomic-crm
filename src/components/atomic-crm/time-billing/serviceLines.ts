import type { InvoiceStatus, ServiceLine } from "../types";

export const SERVICE_LINE_LABELS: Record<ServiceLine, string> = {
  TAX: "Tax",
  AFS: "Annual Financial Statements",
  PAYROLL: "Payroll",
  BOOKKEEPING: "Bookkeeping",
  ADVISORY: "Advisory",
  COMPLIANCE: "Compliance",
  OTHER: "Other",
};

export const ALL_SERVICE_LINES: ServiceLine[] = [
  "TAX",
  "AFS",
  "PAYROLL",
  "BOOKKEEPING",
  "ADVISORY",
  "COMPLIANCE",
  "OTHER",
];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  PAID: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const ALL_INVOICE_STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "SENT",
  "PAID",
  "CANCELLED",
];
