import { useDeferredValue, useMemo } from "react";
import { useGetOne } from "ra-core";
import { useWatch } from "react-hook-form";
import { PDFViewer } from "@react-pdf/renderer";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Client, QuoteItem } from "../types";
import { sanitizeQuoteItems } from "./quoteItems";
import { QuotePDFDocument } from "./QuotePDF";
import { quoteStatusLabels } from "./quotesTypes";

export const QuotePDFPreview = () => {
  const clientId = useWatch({ name: "client_id" });
  const description = useWatch({ name: "description" });
  const amount = useWatch({ name: "amount" });
  const status = useWatch({ name: "status" });
  const serviceType = useWatch({ name: "service_type" });
  const eventStart = useWatch({ name: "event_start" });
  const eventEnd = useWatch({ name: "event_end" });
  const allDay = useWatch({ name: "all_day" });
  const sentDate = useWatch({ name: "sent_date" });
  const responseDate = useWatch({ name: "response_date" });
  const isTaxable = useWatch({ name: "is_taxable" });
  const notes = useWatch({ name: "notes" });
  const quoteItems = useWatch({ name: "quote_items" }) as
    | QuoteItem[]
    | undefined;
  const quoteId = useWatch({ name: "id" });

  const { quoteServiceTypes, businessProfile } = useConfigurationContext();

  const { data: client } = useGetOne<Client>(
    "clients",
    { id: clientId },
    { enabled: !!clientId },
  );

  const serviceLabel =
    quoteServiceTypes.find((t) => t.value === serviceType)?.label ??
    serviceType ??
    "";
  const statusLabel = quoteStatusLabels[status] ?? status ?? "";

  const quote = useMemo(
    () => ({
      id: quoteId ?? "draft",
      description: description ?? "",
      amount: Number(amount) || 0,
      status: status ?? "primo_contatto",
      service_type: serviceType ?? "",
      event_start: eventStart,
      event_end: eventEnd,
      all_day: allDay ?? true,
      sent_date: sentDate,
      response_date: responseDate,
      is_taxable: isTaxable ?? true,
      notes: notes ?? "",
      quote_items: quoteItems,
      client_id: clientId,
      index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    [
      quoteId,
      description,
      amount,
      status,
      serviceType,
      eventStart,
      eventEnd,
      allDay,
      sentDate,
      responseDate,
      isTaxable,
      notes,
      quoteItems,
      clientId,
    ],
  );

  const deferredQuote = useDeferredValue(quote);
  const deferredClient = useDeferredValue(client);
  const sanitizedItems = sanitizeQuoteItems(deferredQuote.quote_items);

  return (
    <div className="h-full min-h-[500px] max-w-full overflow-hidden rounded-md border bg-muted/30">
      <PDFViewer
        width="100%"
        height="100%"
        showToolbar={false}
        className="rounded-md"
      >
        <QuotePDFDocument
          quote={deferredQuote}
          client={deferredClient}
          serviceLabel={serviceLabel}
          statusLabel={statusLabel}
          quoteItems={sanitizedItems}
          businessProfile={businessProfile}
        />
      </PDFViewer>
    </div>
  );
};
