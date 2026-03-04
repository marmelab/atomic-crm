export type PaymentReminderEmailInput = {
  clientName: string;
  clientEmail: string;
  amount: number;
  paymentDate: string;
  daysOverdue: number;
  paymentType: string;
  invoiceRef?: string | null;
  projectName?: string | null;
  customMessage?: string | null;
  businessName?: string;
  supportEmail?: string | null;
};

export type PaymentReminderEmailSendRequest = {
  to: string;
  subject: string;
  html: string;
  text: string;
  paymentId: string | number;
};

export type PaymentReminderEmailSendResponse = {
  messageId?: string;
  accepted: string[];
  rejected: string[];
  response?: string;
  notification?: {
    email: { ok: boolean; error?: string };
    whatsapp: { ok: boolean; error?: string };
  };
};
