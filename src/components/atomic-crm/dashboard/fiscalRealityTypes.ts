import type { FiscalDeadlineComponent } from "./fiscalModelTypes";

// --- DB entity types ---

export type FiscalDeclaration = {
  id: string;
  tax_year: number;
  total_substitute_tax: number;
  total_inps: number;
  prior_advances_substitute_tax: number;
  prior_advances_inps: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export type FiscalObligationSource = "auto_generated" | "manual";

export type FiscalObligation = {
  id: string;
  declaration_id: string | null;
  source: FiscalObligationSource;
  component: FiscalDeadlineComponent;
  competence_year: number;
  payment_year: number;
  due_date: string;
  amount: number;
  installment_number: number | null;
  installment_total: number | null;
  is_overridden: boolean;
  overridden_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export type FiscalF24Submission = {
  id: string;
  submission_date: string;
  notes: string | null;
  created_at: string;
  user_id: string;
};

export type FiscalF24PaymentLine = {
  id: string;
  submission_id: string;
  obligation_id: string;
  amount: number;
  created_at: string;
  user_id: string;
};

export type FiscalF24PaymentLineEnriched = FiscalF24PaymentLine & {
  submission_date: string;
};

// --- Read model types ---

export type FiscalDeadlineItemSource = "estimate" | "obligation";

export type FiscalDeadlineItemStatus =
  | "estimated"
  | "due"
  | "partial"
  | "paid"
  | "overpaid";

export type FiscalDeadlineViewItem = {
  component: FiscalDeadlineComponent;
  competenceYear: number;
  amount: number;
  source: FiscalDeadlineItemSource;
  paidAmount: number;
  paidDate: string | null;
  remainingAmount: number;
  overpaidAmount: number;
  status: FiscalDeadlineItemStatus;
};

export type FiscalDeadlineView = {
  date: string;
  label: string;
  paymentYear: number;
  priority: "high" | "low";
  isPast: boolean;
  daysUntil: number;
  items: FiscalDeadlineViewItem[];
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
  totalOverpaid: number;
  estimateComparison: number | null;
};
