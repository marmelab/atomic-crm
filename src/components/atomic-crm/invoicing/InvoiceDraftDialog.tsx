import { FileDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  computeInvoiceDraftTotals,
  getInvoiceDraftLineTotal,
  normalizeInvoiceDraftLineItems,
  type InvoiceDraftInput,
} from "./invoiceDraftTypes";
import { downloadInvoiceDraftPdf } from "./invoiceDraftPdf";
import {
  formatClientBillingAddress,
  getClientBillingDisplayName,
} from "../clients/clientBilling";

const formatAmount = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export const InvoiceDraftDialog = ({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: InvoiceDraftInput | null;
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const lineItems = useMemo(
    () => normalizeInvoiceDraftLineItems(draft?.lineItems ?? []),
    [draft?.lineItems],
  );
  const totals = useMemo(
    () => computeInvoiceDraftTotals(lineItems),
    [lineItems],
  );

  if (!draft) {
    return null;
  }

  const clientName =
    getClientBillingDisplayName(draft.client) ?? draft.client.name;
  const clientAddress = formatClientBillingAddress(draft.client);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bozza fattura</DialogTitle>
          <DialogDescription>
            Riferimento interno per compilazione su Aruba. Nessuna scrittura nel
            DB.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          BOZZA - NON VALIDA AI FINI FISCALI
        </div>

        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Cliente</p>
            <p className="font-medium">{clientName}</p>
            {clientAddress ? (
              <p className="text-xs text-muted-foreground">{clientAddress}</p>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground">Origine</p>
            <p className="font-medium">
              {draft.source.kind} - {draft.source.label}
            </p>
            <p className="text-xs text-muted-foreground">
              Data documento: {draft.invoiceDate ?? todayIsoDate()}
            </p>
          </div>
        </div>

        <div className="rounded-md border">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span>Descrizione</span>
            <span className="text-right">Q.ta</span>
            <span className="text-right">Prezzo</span>
            <span className="text-right">Totale</span>
          </div>

          {lineItems.map((lineItem, index) => (
            <div
              key={`${lineItem.description}-${index}`}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b px-3 py-2 text-sm last:border-b-0"
            >
              <span>{lineItem.description}</span>
              <span className="text-right tabular-nums">
                {lineItem.quantity}
              </span>
              <span className="text-right tabular-nums">
                {formatAmount(lineItem.unitPrice)}
              </span>
              <span className="text-right tabular-nums">
                {formatAmount(getInvoiceDraftLineTotal(lineItem))}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Totale imponibile</span>
            <span className="font-medium">
              {formatAmount(totals.taxableAmount)}
            </span>
          </div>
          {totals.stampDuty > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bollo</span>
              <span className="font-medium">
                {formatAmount(totals.stampDuty)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between font-semibold">
            <span>Totale documento</span>
            <span>{formatAmount(totals.totalAmount)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Operazione effettuata ai sensi dell'art. 1 commi 54-89 L. 190/2014
        </p>

        {draft.notes ? (
          <div className="rounded-md border p-3 text-sm">
            <p className="text-xs text-muted-foreground">Note</p>
            <p className="whitespace-pre-wrap">{draft.notes}</p>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Chiudi
          </Button>
          <Button
            type="button"
            onClick={async () => {
              setIsDownloading(true);
              try {
                await downloadInvoiceDraftPdf({ draft });
              } finally {
                setIsDownloading(false);
              }
            }}
          >
            <FileDown className="mr-1 h-4 w-4" />
            {isDownloading ? "Generazione..." : "Download PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
