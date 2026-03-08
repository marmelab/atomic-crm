import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Mail, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataProvider, useNotify, type Identifier } from "ra-core";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildPaymentReminderEmail } from "@/lib/communications/paymentReminderEmail";

import type { CrmDataProvider } from "../providers/types";
import type { Client, Payment, Project } from "../types";
import { paymentTypeLabels } from "./paymentTypes";

const toStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const diffDays = (from: Date, to: Date) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(
    (toStartOfDay(to).valueOf() - toStartOfDay(from).valueOf()) / msPerDay,
  );
};

const formatCurrency = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

export const SendPaymentReminderDialog = ({
  paymentId,
  trigger,
}: {
  paymentId: Identifier;
  trigger?: React.ReactNode;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  const {
    data: context,
    mutate: loadContext,
    reset: resetContext,
    isPending: isContextPending,
    error: contextError,
  } = useMutation({
    mutationKey: ["payment-reminder-context", paymentId],
    mutationFn: (id: Identifier) => dataProvider.getPaymentReminderContext(id),
    onError: (error: Error) => {
      notify(error.message || "Impossibile preparare il reminder.", {
        type: "error",
      });
    },
  });

  const {
    mutate: sendReminder,
    reset: resetSend,
    isPending: isSendPending,
    error: sendError,
  } = useMutation({
    mutationKey: ["payment-reminder-send", paymentId],
    mutationFn: ({
      payment,
      client,
      project,
      customMsg,
    }: {
      payment: Payment;
      client: Client | null;
      project: Project | null;
      customMsg: string;
    }) => {
      const daysOverdue = payment.payment_date
        ? Math.max(
            1,
            Math.abs(diffDays(new Date(payment.payment_date), new Date())),
          )
        : 0;

      const email = buildPaymentReminderEmail({
        clientName: client?.name ?? "Cliente",
        clientEmail: client?.email ?? "",
        amount: Number(payment.amount ?? 0),
        paymentDate: payment.payment_date,
        daysOverdue,
        paymentType: payment.payment_type,
        invoiceRef: payment.invoice_ref,
        projectName: project?.name,
        customMessage: customMsg.trim() || null,
      });

      return dataProvider.sendPaymentReminder({
        to: client?.email ?? "",
        subject: email.subject,
        html: email.html,
        text: email.text,
        paymentId: String(payment.id),
      });
    },
    onSuccess: () => {
      notify(
        "Reminder pagamento inviato. Riceverai conferma via email e WhatsApp.",
        {
          type: "success",
        },
      );
      setOpen(false);
    },
    onError: (error: Error) => {
      notify(error.message || "Impossibile inviare il reminder.", {
        type: "error",
      });
    },
  });

  useEffect(() => {
    if (!open) {
      setCustomMessage("");
      resetContext();
      resetSend();
      return;
    }
    loadContext(paymentId);
  }, [loadContext, open, paymentId, resetContext, resetSend]);

  const payment = context?.payment;
  const client = context?.client ?? null;
  const project = context?.project ?? null;
  const clientEmail = client?.email;

  const daysOverdue = payment?.payment_date
    ? Math.max(
        1,
        Math.abs(diffDays(new Date(payment.payment_date), new Date())),
      )
    : 0;

  const preview =
    payment && client
      ? buildPaymentReminderEmail({
          clientName: client.name ?? "Cliente",
          clientEmail: client.email ?? "",
          amount: Number(payment.amount ?? 0),
          paymentDate: payment.payment_date,
          daysOverdue,
          paymentType: payment.payment_type,
          invoiceRef: payment.invoice_ref,
          projectName: project?.name,
          customMessage: customMessage.trim() || null,
        })
      : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <Mail className="h-4 w-4" />
            Reminder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#2C3E50]">Invia reminder pagamento</DialogTitle>
          <DialogDescription>
            Rivedi il contenuto della mail prima di inviarla. Dopo l'invio
            riceverai una notifica email e WhatsApp di conferma.
          </DialogDescription>
        </DialogHeader>

        {isContextPending ? (
          <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
            Sto preparando il reminder...
          </div>
        ) : null}

        {contextError ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Contesto non disponibile</AlertTitle>
            <AlertDescription>{contextError.message}</AlertDescription>
          </Alert>
        ) : null}

        {payment && preview ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-l-[3px] border-l-[#2C3E50] bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">A</p>
                <p className="text-sm font-medium">
                  {clientEmail || "Email cliente mancante"}
                </p>
              </div>
              <div className="rounded-lg border border-l-[3px] border-l-[#456B6B] bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#456B6B]">Oggetto</p>
                <p className="text-sm font-medium">{preview.subject}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-l-[3px] border-l-[#2C3E50] bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">Importo</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(Number(payment.amount ?? 0))}
                </p>
              </div>
              <div className="rounded-lg border border-l-[3px] border-l-[#456B6B] bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#456B6B]">Tipo</p>
                <p className="text-sm font-medium">
                  {paymentTypeLabels[payment.payment_type] ??
                    payment.payment_type}
                </p>
              </div>
              <div className="rounded-lg border border-l-[3px] border-l-[#2C3E50] bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">Ritardo</p>
                <p className="text-sm font-medium">
                  {daysOverdue} {daysOverdue === 1 ? "giorno" : "giorni"}
                </p>
              </div>
            </div>

            {!clientEmail ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Invio bloccato</AlertTitle>
                <AlertDescription>
                  Il cliente non ha un'email configurata. Aggiungila prima di
                  inviare il reminder.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor={`payment-reminder-message-${paymentId}`}>
                Messaggio aggiuntivo (opzionale)
              </Label>
              <Textarea
                id={`payment-reminder-message-${paymentId}`}
                value={customMessage}
                onChange={(event) => setCustomMessage(event.target.value)}
                placeholder="Aggiungi una nota personale se serve."
                maxLength={600}
                className="min-h-28"
              />
              <div className="text-[11px] text-muted-foreground">
                {customMessage.trim().length}/600 caratteri.
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">Anteprima testo</p>
              <div className="rounded-lg border bg-[#E8EDF2]/50 px-4 py-4 text-sm whitespace-pre-wrap leading-6">
                {preview.text}
              </div>
            </div>

            {sendError ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Invio non riuscito</AlertTitle>
                <AlertDescription>{sendError.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  sendReminder({
                    payment,
                    client,
                    project,
                    customMsg: customMessage,
                  })
                }
                disabled={isSendPending || !clientEmail}
                className="gap-2 bg-[#2C3E50] hover:bg-[#1a2a38]"
              >
                {isSendPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Invia reminder
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
