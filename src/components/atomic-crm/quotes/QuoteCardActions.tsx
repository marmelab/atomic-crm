import { lazy, Suspense, useState } from "react";
import { Eye, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Client, Quote } from "../types";
import { sanitizeQuoteItems } from "./quoteItems";
import { quoteStatusLabels } from "./quotesTypes";
import type { QuotePDFProps } from "./QuotePDF";

const LazyQuoteCardPDFPreview = lazy(
  () => import("./QuoteCardPDFPreview"),
);

const lazyDownloadQuotePDF = async (props: QuotePDFProps) => {
  const { downloadQuotePDF } = await import("./QuotePDF");
  return downloadQuotePDF(props);
};

export const QuoteCardActions = ({
  quote,
  client,
}: {
  quote: Quote;
  client?: Client;
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { quoteServiceTypes, businessProfile } = useConfigurationContext();

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
      await lazyDownloadQuotePDF(pdfProps);
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
            <Suspense
              fallback={
                <div className="h-100 flex items-center justify-center text-sm text-muted-foreground">
                  Caricamento...
                </div>
              }
            >
              <LazyQuoteCardPDFPreview {...pdfProps} />
            </Suspense>
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
