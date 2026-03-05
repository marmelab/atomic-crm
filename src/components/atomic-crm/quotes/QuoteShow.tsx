import {
  ShowBase,
  useGetList,
  useGetOne,
  useRecordContext,
  useRedirect,
} from "ra-core";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Payment, Quote } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { sanitizeQuoteItems } from "./quoteItems";
import { downloadQuotePDF } from "./QuotePDF";
import { QuoteShowActions } from "./QuoteShowActions";
import { QuoteShowSections } from "./QuoteShowSections";
import { InvoiceDraftDialog } from "../invoicing/InvoiceDraftDialog";
import { buildInvoiceDraftFromQuote } from "../invoicing/buildInvoiceDraftFromQuote";
import { hasInvoiceDraftCollectableAmount } from "../invoicing/invoiceDraftTypes";
import { quoteStatusLabels } from "./quotesTypes";

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
  const { quoteServiceTypes, businessProfile } = useConfigurationContext();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [invoiceDraftOpen, setInvoiceDraftOpen] = useState(false);

  const { data: client } = useGetOne(
    "clients",
    { id: record?.client_id },
    { enabled: !!record?.client_id },
  );
  const { data: project } = useGetOne(
    "projects",
    { id: record?.project_id },
    { enabled: !!record?.project_id },
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
      ? buildInvoiceDraftFromQuote({ quote: record, client, payments: linkedPayments })
      : null;
  const hasCollectable = hasInvoiceDraftCollectableAmount(invoiceDraft);

  useEffect(() => {
    if (!record || !client) return;
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("invoiceDraft") === "true" && hasCollectable) {
      setInvoiceDraftOpen(true);
    }
  }, [client, location.search, record, hasCollectable]);

  if (!record) return null;

  const serviceLabel =
    quoteServiceTypes.find((t) => t.value === record.service_type)?.label ??
    record.service_type;
  const statusLabel = quoteStatusLabels[record.status] ?? record.status;
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
        businessProfile,
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
        <QuoteShowActions
          quote={record}
          client={client}
          project={project}
          pdfLoading={pdfLoading}
          onDownloadPDF={handleDownloadPDF}
          hasCollectableAmount={hasCollectable}
          onOpenInvoiceDraft={() => setInvoiceDraftOpen(true)}
        />
      </div>

      <QuoteShowSections
        quote={record}
        client={client}
        project={project}
        serviceLabel={serviceLabel}
        quoteItems={quoteItems}
      />

      <InvoiceDraftDialog
        open={invoiceDraftOpen}
        onOpenChange={setInvoiceDraftOpen}
        draft={hasCollectable ? invoiceDraft : null}
      />
    </div>
  );
};
