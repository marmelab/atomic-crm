import { format, isValid } from "date-fns";
import { FileDown } from "lucide-react";
import {
  ShowBase,
  useGetList,
  useGetOne,
  useRecordContext,
  useRedirect,
} from "ra-core";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import type { Payment, Quote } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { CreateProjectFromQuoteDialog } from "./CreateProjectFromQuoteDialog";
import { quoteStatusLabels } from "./quotesTypes";
import { downloadQuotePDF } from "./QuotePDF";
import { formatDateRange } from "../misc/formatDateRange";
import { canCreateProjectFromQuote } from "./quoteProjectLinking";
import { getQuoteItemLineTotal, sanitizeQuoteItems } from "./quoteItems";
import { QuotePaymentsSection } from "./QuotePaymentsSection";
import {
  buildPaymentCreatePathFromQuote,
  canCreatePaymentFromQuote,
} from "../payments/paymentLinking";
import { SendQuoteStatusEmailDialog } from "./SendQuoteStatusEmailDialog";
import { InvoiceDraftDialog } from "../invoicing/InvoiceDraftDialog";
import { buildInvoiceDraftFromQuote } from "../invoicing/buildInvoiceDraftFromQuote";
import { hasInvoiceDraftCollectableAmount } from "../invoicing/invoiceDraftTypes";

export const QuoteShow = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const handleClose = () => {
    redirect("list", "quotes");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <DialogTitle className="sr-only">Dettaglio preventivo</DialogTitle>
        <DialogDescription className="sr-only">
          Visualizzazione dettaglio preventivo
        </DialogDescription>
        {id ? (
          <ShowBase id={id}>
            <QuoteShowContent />
          </ShowBase>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const QuoteShowContent = () => {
  const record = useRecordContext<Quote>();
  const location = useLocation();
  const { quoteServiceTypes } = useConfigurationContext();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [invoiceDraftOpen, setInvoiceDraftOpen] = useState(false);

  const { data: client } = useGetOne(
    "clients",
    {
      id: record?.client_id,
    },
    {
      enabled: !!record?.client_id,
    },
  );
  const { data: project } = useGetOne(
    "projects",
    {
      id: record?.project_id,
    },
    {
      enabled: !!record?.project_id,
    },
  );

  const { data: linkedPayments = [] } = useGetList<Payment>(
    "payments",
    {
      filter: { "quote_id@eq": record?.id },
      sort: { field: "payment_date", order: "DESC" },
      pagination: { page: 1, perPage: 100 },
    },
    { enabled: !!record?.id },
  );

  const invoiceDraft =
    record && client
      ? buildInvoiceDraftFromQuote({
          quote: record,
          client,
          payments: linkedPayments,
        })
      : null;
  const hasCollectableAmount = hasInvoiceDraftCollectableAmount(invoiceDraft);

  useEffect(() => {
    if (!record || !client) return;
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("invoiceDraft") === "true" && hasCollectableAmount) {
      setInvoiceDraftOpen(true);
    }
  }, [client, location.search, record, hasCollectableAmount]);

  if (!record) return null;

  const statusLabel = quoteStatusLabels[record.status] ?? record.status;
  const serviceLabel =
    quoteServiceTypes.find((t) => t.value === record.service_type)?.label ??
    record.service_type;
  const quoteItems = sanitizeQuoteItems(record.quote_items);

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      await downloadQuotePDF({
        quote: record,
        client,
        serviceLabel,
        statusLabel,
        quoteItems,
      });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start mb-8">
        <h2 className="text-2xl font-semibold">
          {record.description || "Preventivo"}
        </h2>
        <div className="flex gap-2 pr-12">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
          >
            <FileDown className="h-4 w-4 mr-1" />
            {pdfLoading ? "Generazione..." : "PDF"}
          </Button>
          {project ? (
            <Button asChild variant="outline" size="sm">
              <Link to={`/projects/${project.id}/show`}>Apri progetto</Link>
            </Button>
          ) : canCreateProjectFromQuote(record) ? (
            <CreateProjectFromQuoteDialog client={client} quote={record} />
          ) : null}
          {canCreatePaymentFromQuote(record) ? (
            <Button asChild variant="outline" size="sm">
              <Link to={buildPaymentCreatePathFromQuote({ quote: record })}>
                Registra pagamento
              </Link>
            </Button>
          ) : null}
          {hasCollectableAmount ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInvoiceDraftOpen(true)}
            >
              Genera bozza fattura
            </Button>
          ) : null}
          <SendQuoteStatusEmailDialog quote={record} />
          <EditButton />
          <DeleteButton />
        </div>
      </div>

      <div className="flex flex-wrap gap-8 mx-4">
        <InfoField label="Cliente" value={client?.name} />
        <InfoField label="Progetto collegato">
          {project ? (
            <Link
              to={`/projects/${project.id}/show`}
              className="text-sm text-primary hover:underline"
            >
              {project.name}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">
              Nessun progetto collegato
            </span>
          )}
        </InfoField>
        <InfoField label="Tipo servizio" value={serviceLabel} />
        <InfoField label="Stato">
          <Badge variant="secondary">{statusLabel}</Badge>
        </InfoField>
        <InfoField label="Tassabilità">
          <Badge
            variant={record.is_taxable === false ? "secondary" : "outline"}
          >
            {record.is_taxable === false ? "Non tassabile" : "Tassabile"}
          </Badge>
        </InfoField>
        <InfoField
          label="Importo"
          value={record.amount.toLocaleString("it-IT", {
            style: "currency",
            currency: "EUR",
          })}
        />
      </div>

      <div className="flex flex-wrap gap-8 mx-4 mt-4">
        {record.event_start && (
          <InfoField
            label="Evento"
            value={formatDateRange(
              record.event_start,
              record.event_end,
              record.all_day,
            )}
          />
        )}
        {record.sent_date && isValid(new Date(record.sent_date)) && (
          <InfoField
            label="Data invio"
            value={format(new Date(record.sent_date), "dd/MM/yyyy")}
          />
        )}
        {record.response_date && isValid(new Date(record.response_date)) && (
          <InfoField
            label="Data risposta"
            value={format(new Date(record.response_date), "dd/MM/yyyy")}
          />
        )}
      </div>

      <QuotePaymentsSection quote={record} />

      {quoteItems.length > 0 && (
        <>
          <Separator className="my-4 mx-4" />
          <div className="mx-4 space-y-3">
            <span className="text-xs text-muted-foreground tracking-wide">
              Voci preventivo
            </span>
            <div className="rounded-md border">
              {quoteItems.map((item, index) => (
                <div
                  key={`${item.description}-${index}`}
                  className="flex items-start justify-between gap-4 border-b px-3 py-3 last:border-b-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} ×{" "}
                      {item.unit_price.toLocaleString("it-IT", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {getQuoteItemLineTotal(item).toLocaleString("it-IT", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {record.rejection_reason && (
        <>
          <Separator className="my-4 mx-4" />
          <div className="mx-4">
            <span className="text-xs text-muted-foreground tracking-wide">
              Motivo rifiuto
            </span>
            <p className="text-sm">{record.rejection_reason}</p>
          </div>
        </>
      )}

      {record.notes && (
        <>
          <Separator className="my-4 mx-4" />
          <div className="mx-4 whitespace-pre-line">
            <span className="text-xs text-muted-foreground tracking-wide">
              Note
            </span>
            <p className="text-sm leading-6">{record.notes}</p>
          </div>
        </>
      )}

      <InvoiceDraftDialog
        open={invoiceDraftOpen}
        onOpenChange={setInvoiceDraftOpen}
        draft={hasCollectableAmount ? invoiceDraft : null}
      />
    </div>
  );
};

const InfoField = ({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground tracking-wide">{label}</span>
    {children ?? <span className="text-sm">{value}</span>}
  </div>
);
