import {
  FileDown,
  MoreHorizontal,
  FolderOpen,
  CreditCard,
  FileText,
  Pencil,
} from "lucide-react";
import { Link } from "react-router";
import { useCreatePath, useRecordContext, useResourceContext } from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

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
import { QuickClientEmailDialog } from "../clients/QuickClientEmailDialog";

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
  const isMobile = useIsMobile();
  const hasClientEmail = !!client?.email;

  const emailOrClientButton = hasClientEmail ? (
    <SendQuoteStatusEmailDialog quote={quote} />
  ) : client ? (
    <QuickClientEmailDialog client={client} />
  ) : (
    <QuickClientCreateDialog linkToQuoteId={quote.id} />
  );

  const showCreateService = canCreateServiceFromQuote(quote);
  const showCreateProject = !project && canCreateProjectFromQuote(quote);
  const showPayment = canCreatePaymentFromQuote(quote);
  if (isMobile) {
    return (
      <MobileActions
        quote={quote}
        client={client}
        project={project}
        pdfLoading={pdfLoading}
        onDownloadPDF={onDownloadPDF}
        hasCollectableAmount={hasCollectableAmount}
        onOpenInvoiceDraft={onOpenInvoiceDraft}
        emailOrClientButton={emailOrClientButton}
        showCreateService={showCreateService}
        showCreateProject={showCreateProject}
        showPayment={showPayment}
      />
    );
  }

  // Desktop: all buttons visible
  return (
    <div className="flex gap-2 flex-wrap items-center">
      <Button
        variant="default"
        size="sm"
        onClick={onDownloadPDF}
        disabled={pdfLoading}
      >
        <FileDown className="h-4 w-4 mr-1" />
        {pdfLoading ? "Generazione..." : "PDF"}
      </Button>

      {emailOrClientButton}

      {showCreateService && (
        <CreateServiceFromQuoteDialog client={client} quote={quote} />
      )}

      {project ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`/projects/${project.id}/show`}>Apri progetto</Link>
        </Button>
      ) : showCreateProject ? (
        <CreateProjectFromQuoteDialog client={client} quote={quote} />
      ) : null}

      {showPayment && (
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

      <EditButton />
      <DeleteButton variant="outline" size="sm" />
    </div>
  );
};

/* ── Mobile layout ── */

type MobileActionsProps = {
  quote: Quote;
  client?: Client;
  project?: { id: string | number; name: string } | null;
  pdfLoading: boolean;
  onDownloadPDF: () => void;
  hasCollectableAmount: boolean;
  onOpenInvoiceDraft: () => void;
  emailOrClientButton: React.ReactNode;
  showCreateService: boolean;
  showCreateProject: boolean;
  showPayment: boolean;
};

const MobileActions = ({
  quote,
  client,
  project,
  pdfLoading,
  onDownloadPDF,
  hasCollectableAmount,
  onOpenInvoiceDraft,
  emailOrClientButton,
  showCreateService,
  showCreateProject,
  showPayment,
}: MobileActionsProps) => {
  const resource = useResourceContext();
  const record = useRecordContext();
  const createPath = useCreatePath();
  const editLink = createPath({ resource, type: "edit", id: record?.id });

  const hasContextualItems = !!project || showPayment || hasCollectableAmount;

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <Button
        variant="default"
        size="sm"
        onClick={onDownloadPDF}
        disabled={pdfLoading}
      >
        <FileDown className="h-4 w-4 mr-1" />
        {pdfLoading ? "..." : "PDF"}
      </Button>

      {emailOrClientButton}

      {showCreateService && (
        <CreateServiceFromQuoteDialog client={client} quote={quote} />
      )}
      {showCreateProject && (
        <CreateProjectFromQuoteDialog client={client} quote={quote} />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-50">
          {project && (
            <DropdownMenuItem asChild>
              <Link to={`/projects/${project.id}/show`}>
                <FolderOpen className="h-4 w-4" />
                Apri progetto
              </Link>
            </DropdownMenuItem>
          )}

          {showPayment && (
            <DropdownMenuItem asChild>
              <Link to={buildPaymentCreatePathFromQuote({ quote })}>
                <CreditCard className="h-4 w-4" />
                Registra pagamento
              </Link>
            </DropdownMenuItem>
          )}

          {hasCollectableAmount && (
            <DropdownMenuItem onSelect={onOpenInvoiceDraft}>
              <FileText className="h-4 w-4" />
              Genera bozza fattura
            </DropdownMenuItem>
          )}

          {hasContextualItems && <DropdownMenuSeparator />}

          <DropdownMenuItem asChild>
            <Link to={editLink}>
              <Pencil className="h-4 w-4" />
              Modifica
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <DeleteButton
              variant="ghost"
              size="sm"
              className="w-full justify-start text-destructive! px-2 py-1.5 h-auto font-normal"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
