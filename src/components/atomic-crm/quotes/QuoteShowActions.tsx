import { FileDown, MoreHorizontal, AlertTriangle } from "lucide-react";
import { Link } from "react-router";
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Client, Quote } from "../types";
import { canCreateProjectFromQuote } from "./quoteProjectLinking";
import { canCreateServiceFromQuote } from "./quoteServiceLinking";
import {
  buildPaymentCreatePathFromQuote,
  canCreatePaymentFromQuote,
} from "../payments/paymentLinking";
import { CreateProjectFromQuoteDialog } from "./CreateProjectFromQuoteDialog";
import { CreateServiceFromQuoteDialog } from "./CreateServiceFromQuoteDialog";
import { SendQuoteStatusEmailDialog } from "./SendQuoteStatusEmailDialog";
import { QuickClientCreateDialog } from "../clients/QuickClientCreateDialog";

type QuoteShowActionsProps = {
  quote: Quote;
  client?: Client;
  project?: { id: string | number; name: string } | null;
  pdfLoading: boolean;
  onDownloadPDF: () => void;
  hasCollectableAmount: boolean;
  onOpenInvoiceDraft: () => void;
};

export const QuoteShowActions = ({
  quote,
  client,
  project,
  pdfLoading,
  onDownloadPDF,
  hasCollectableAmount,
  onOpenInvoiceDraft,
}: QuoteShowActionsProps) => {
  const hasClientEmail = !!client?.email;

  return (
    <div className="flex gap-2 pr-12 flex-wrap">
      {/* Primary actions — always visible */}
      <Button
        variant="default"
        size="sm"
        onClick={onDownloadPDF}
        disabled={pdfLoading}
      >
        <FileDown className="h-4 w-4 mr-1" />
        {pdfLoading ? "Generazione..." : "PDF"}
      </Button>

      {hasClientEmail ? (
        <SendQuoteStatusEmailDialog quote={quote} />
      ) : (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled className="gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Email mancante
          </Button>
          <QuickClientCreateDialog linkToQuoteId={quote.id} />
        </div>
      )}

      {/* Secondary actions — contextual */}
      {canCreateServiceFromQuote(quote) && (
        <CreateServiceFromQuoteDialog client={client} quote={quote} />
      )}

      {project ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`/projects/${project.id}/show`}>Apri progetto</Link>
        </Button>
      ) : canCreateProjectFromQuote(quote) ? (
        <CreateProjectFromQuoteDialog client={client} quote={quote} />
      ) : null}

      {canCreatePaymentFromQuote(quote) && (
        <Button asChild variant="outline" size="sm">
          <Link to={buildPaymentCreatePathFromQuote({ quote })}>
            Registra pagamento
          </Link>
        </Button>
      )}

      {hasCollectableAmount && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenInvoiceDraft}
        >
          Genera bozza fattura
        </Button>
      )}

      {/* Tertiary actions — dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <EditButton />
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <DeleteButton />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
