import { useState } from "react";
import { useGetOne } from "ra-core";
import { Eye, FileDown } from "lucide-react";
import { BlobProvider } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Client, Quote } from "../types";
import { sanitizeQuoteItems } from "./quoteItems";
import { QuotePDFDocument } from "./QuotePDF";
import { quoteStatusLabels } from "./quotesTypes";
import { downloadQuotePDF } from "./QuotePDF";

export const QuoteCardActions = ({ quote }: { quote: Quote }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { quoteServiceTypes, businessProfile } = useConfigurationContext();

  const { data: client } = useGetOne<Client>(
    "clients",
    { id: quote.client_id },
    { enabled: !!quote.client_id },
  );

  const serviceLabel =
    quoteServiceTypes.find((t) => t.value === quote.service_type)?.label ??
    quote.service_type;
  const statusLabel = quoteStatusLabels[quote.status] ?? quote.status;
  const quoteItems = sanitizeQuoteItems(quote.quote_items);

  const pdfProps = {
    quote,
    client,
    serviceLabel,
    statusLabel,
    quoteItems,
    businessProfile,
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await downloadQuotePDF(pdfProps);
    } finally {
      setDownloading(false);
    }
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
      onClick={(e) => e.stopPropagation()}
    >
      <Popover open={previewOpen} onOpenChange={setPreviewOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 shadow-sm"
            onClick={handlePreviewClick}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[320px] p-2"
          side="left"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          {previewOpen && (
            <BlobProvider document={<QuotePDFDocument {...pdfProps} />}>
              {({ url, loading }) =>
                loading ? (
                  <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
                    Generazione anteprima...
                  </div>
                ) : url ? (
                  <iframe
                    src={url}
                    className="w-full h-[400px] rounded border-0"
                    title="Anteprima PDF"
                  />
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
                    Errore generazione PDF
                  </div>
                )
              }
            </BlobProvider>
          )}
        </PopoverContent>
      </Popover>

      <Button
        variant="secondary"
        size="icon"
        className="h-7 w-7 shadow-sm"
        onClick={handleDownload}
        disabled={downloading}
      >
        <FileDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
