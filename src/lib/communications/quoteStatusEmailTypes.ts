import type { Client, Quote } from "@/components/atomic-crm/types";

export type QuoteStatusEmailSendPolicy = "never" | "manual" | "recommended";

export type QuoteStatusEmailTemplateDefinition = {
  templateId: string;
  status: string;
  statusLabel: string;
  sendPolicy: QuoteStatusEmailSendPolicy;
  purpose: string;
  ctaLabel?: string;
  requiredDynamicFields: string[];
  optionalDynamicFields: string[];
};

export type BuildQuoteStatusEmailInput = {
  quote: Pick<
    Quote,
    | "status"
    | "description"
    | "amount"
    | "event_start"
    | "event_end"
    | "all_day"
    | "sent_date"
    | "response_date"
    | "rejection_reason"
  >;
  client?: Pick<Client, "name" | "email"> | null;
  serviceLabel?: string | null;
  projectName?: string | null;
  publicQuoteUrl?: string | null;
  paymentAmount?: number | null;
  amountPaid?: number | null;
  amountDue?: number | null;
  businessName?: string;
  supportEmail?: string | null;
  customMessage?: string | null;
  hasNonTaxableServices?: boolean | null;
};

export type BuiltQuoteStatusEmailTemplate =
  QuoteStatusEmailTemplateDefinition & {
    canSend: boolean;
    automaticSendAllowed: boolean;
    automaticSendBlockReason?: string;
    missingFields: string[];
    subject: string;
    previewText: string;
    html: string;
    text: string;
  };

export type QuoteStatusEmailSendRequest = {
  to: string;
  subject: string;
  html: string;
  text: string;
  templateId: string;
  status: string;
  quoteId?: string | number | null;
  automatic?: boolean;
  hasNonTaxableServices?: boolean | null;
};

export type QuoteStatusEmailSendResponse = {
  messageId?: string;
  accepted: string[];
  rejected: string[];
  response?: string;
};

export type EmailSection = {
  title: string;
  body: string;
};
