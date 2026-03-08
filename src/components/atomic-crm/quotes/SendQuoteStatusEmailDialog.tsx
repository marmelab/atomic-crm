import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Mail, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  buildQuoteStatusEmailTemplateFromContext,
  type QuoteStatusEmailContext,
} from "@/lib/communications/quoteStatusEmailContext";
import { getQuoteStatusEmailTemplateDefinition } from "@/lib/communications/quoteStatusEmailTemplates";

import type { CrmDataProvider } from "../providers/types";
import type { Quote } from "../types";

const missingFieldLabels: Record<string, string> = {
  client_name: "nome cliente",
  client_email: "email cliente",
  quote_description: "descrizione preventivo",
  public_quote_url: "link pubblico preventivo",
  service_label: "tipo servizio",
  event_range: "data evento",
  project_name: "nome progetto",
  payment_amount: "importo pagamento",
  amount_paid: "totale pagato",
  amount_due: "residuo",
  support_email: "email supporto",
  rejection_reason: "motivo rifiuto",
  custom_message: "messaggio personalizzato",
};

const getPolicyCopy = (template: {
  sendPolicy: "never" | "manual" | "recommended";
  automaticSendBlockReason?: string;
}) => {
  if (template.automaticSendBlockReason) {
    return template.automaticSendBlockReason;
  }

  if (template.sendPolicy === "recommended") {
    return "Template consigliato per questo stato, ma l'invio resta sempre manuale.";
  }

  return "Questo stato richiede revisione manuale del testo prima dell'invio.";
};

export const SendQuoteStatusEmailDialog = ({
  quote,
}: {
  quote: Pick<Quote, "id" | "status">;
}) => {
  const definition = getQuoteStatusEmailTemplateDefinition(quote.status);
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [toOverride, setToOverride] = useState("");

  const {
    data: context,
    mutate: loadContext,
    reset: resetContext,
    isPending: isContextPending,
    error: contextError,
  } = useMutation({
    mutationKey: ["quote-status-email-context", quote.id],
    mutationFn: (quoteId: Quote["id"]) =>
      dataProvider.getQuoteStatusEmailContext(quoteId),
    onError: (error: Error) => {
      notify(
        error.message ||
          "Impossibile preparare la mail cliente del preventivo adesso.",
        {
          type: "error",
        },
      );
    },
  });

  const {
    mutate: sendEmail,
    reset: resetSend,
    isPending: isSendPending,
    error: sendError,
  } = useMutation({
    mutationKey: ["quote-status-email-send", quote.id],
    mutationFn: ({
      context: emailContext,
      customMessage: nextCustomMessage,
    }: {
      context: QuoteStatusEmailContext;
      customMessage: string;
    }) => {
      const template = buildQuoteStatusEmailTemplateFromContext(emailContext, {
        customMessage: nextCustomMessage.trim() || null,
      });

      const recipientEmail =
        toOverride.trim() || emailContext.client?.email || "";

      return dataProvider.sendQuoteStatusEmail({
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
        templateId: template.templateId,
        status: template.status,
        quoteId: emailContext.quoteId,
        automatic: false,
        hasNonTaxableServices: emailContext.hasNonTaxableServices,
      });
    },
    onSuccess: () => {
      notify("Mail cliente inviata con Gmail.", {
        type: "success",
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      notify(
        error.message || "Impossibile inviare la mail cliente del preventivo.",
        {
          type: "error",
        },
      );
    },
  });

  useEffect(() => {
    if (!open) {
      setCustomMessage("");
      setToOverride("");
      resetContext();
      resetSend();
      return;
    }

    loadContext(quote.id);
  }, [loadContext, open, quote.id, resetContext, resetSend]);

  if (definition.sendPolicy === "never") {
    return null;
  }

  const template = context
    ? buildQuoteStatusEmailTemplateFromContext(context, {
        customMessage: customMessage.trim() || null,
      })
    : null;
  const missingFields =
    template?.missingFields.map(
      (field) => missingFieldLabels[field] ?? field,
    ) ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Mail className="h-4 w-4" />
          Invia mail cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invia mail cliente</DialogTitle>
          <DialogDescription>
            La mail riusa il template condiviso dello stato attuale del
            preventivo e parte solo su tua conferma via Gmail SMTP.
          </DialogDescription>
        </DialogHeader>

        {isContextPending ? (
          <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
            Sto preparando la mail cliente da inviare...
          </div>
        ) : null}

        {contextError ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Contesto mail non disponibile</AlertTitle>
            <AlertDescription>{contextError.message}</AlertDescription>
          </Alert>
        ) : null}

        {context && template ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{template.statusLabel}</Badge>
              <Badge variant="outline">
                {template.sendPolicy === "recommended"
                  ? "consigliata"
                  : "manuale"}
              </Badge>
              {context.hasNonTaxableServices ? (
                <Badge variant="outline">is_taxable = false presente</Badge>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-muted/30 px-3 py-3">
                <Label
                  htmlFor={`quote-status-email-to-${quote.id}`}
                  className="text-xs text-muted-foreground"
                >
                  A
                </Label>
                <Input
                  id={`quote-status-email-to-${quote.id}`}
                  type="email"
                  value={toOverride || context.client?.email || ""}
                  onChange={(e) => setToOverride(e.target.value)}
                  placeholder="Email destinatario"
                  className="mt-1 h-8 text-sm font-medium"
                />
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-3">
                <p className="text-xs text-muted-foreground">Oggetto</p>
                <p className="text-sm font-medium">{template.subject}</p>
              </div>
            </div>

            <Alert>
              <AlertTriangle />
              <AlertTitle>Regola di invio</AlertTitle>
              <AlertDescription>{getPolicyCopy(template)}</AlertDescription>
            </Alert>

            {missingFields.length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Invio bloccato</AlertTitle>
                <AlertDescription>
                  Manca ancora: {missingFields.join(", ")}.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor={`quote-status-email-message-${quote.id}`}>
                Messaggio opzionale
              </Label>
              <Textarea
                id={`quote-status-email-message-${quote.id}`}
                value={customMessage}
                onChange={(event) => setCustomMessage(event.target.value)}
                placeholder="Aggiungi un dettaglio utile solo se serve davvero."
                maxLength={600}
                className="min-h-28"
              />
              <div className="text-[11px] text-muted-foreground">
                {customMessage.trim().length}/600 caratteri.
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Anteprima testo</p>
              <div className="rounded-md border bg-muted/20 px-4 py-4 text-sm whitespace-pre-wrap leading-6">
                {template.text}
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
                onClick={() => sendEmail({ context, customMessage })}
                disabled={isSendPending || !template.canSend}
                className="gap-2"
              >
                {isSendPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Invia con Gmail
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
