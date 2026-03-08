import { FileCode, FileDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  computeInvoiceDraftTotals,
  getInvoiceDraftLineTotal,
  normalizeInvoiceDraftLineItems,
  type InvoiceDraftInput,
} from "./invoiceDraftTypes";
import { downloadInvoiceDraftPdf } from "./invoiceDraftPdf";
import { downloadInvoiceDraftXml } from "./invoiceDraftXml";
import {
  formatClientBillingAddress,
  getClientBillingDisplayName,
} from "../clients/clientBilling";
import { useConfigurationContext } from "../root/ConfigurationContext";

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
  const { businessProfile } = useConfigurationContext();
  const [isDownloading, setIsDownloading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");

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
          <DialogTitle className="text-lg font-bold text-[#2C3E50]">Bozza fattura</DialogTitle>
          <DialogDescription>
            Riferimento interno per compilazione su Aruba. Nessuna scrittura nel
            DB.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-dashed border-[#2C3E50]/30 bg-[#E8EDF2]/40 p-3 text-xs font-bold uppercase tracking-wider text-[#2C3E50]">
          BOZZA - NON VALIDA AI FINI FISCALI
        </div>

        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div className="rounded-lg border border-l-[3px] border-l-[#2C3E50] bg-white px-3 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">Fornitore</p>
            <p className="font-medium">{businessProfile.name}</p>
            {businessProfile.vatNumber ? (
              <p className="text-xs text-muted-foreground">P.IVA: IT{businessProfile.vatNumber}</p>
            ) : null}
            {businessProfile.fiscalCode ? (
              <p className="text-xs text-muted-foreground">C.F.: {businessProfile.fiscalCode}</p>
            ) : null}
            {businessProfile.address ? (
              <p className="text-xs text-muted-foreground">{businessProfile.address}</p>
            ) : null}
          </div>
          <div className="rounded-lg border border-l-[3px] border-l-[#456B6B] bg-white px-3 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#456B6B]">Cliente</p>
            <p className="font-medium">{clientName}</p>
            {clientAddress ? (
              <p className="text-xs text-muted-foreground">{clientAddress}</p>
            ) : null}
            {draft.client.vat_number ? (
              <p className="text-xs text-muted-foreground">P.IVA: {draft.client.vat_number}</p>
            ) : null}
            {draft.client.fiscal_code ? (
              <p className="text-xs text-muted-foreground">C.F.: {draft.client.fiscal_code}</p>
            ) : null}
            {draft.client.billing_sdi_code ? (
              <p className="text-xs text-muted-foreground">Cod. dest.: {draft.client.billing_sdi_code}</p>
            ) : null}
          </div>
        </div>

        <p className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">Prodotti e servizi</p>
        <div className="rounded-lg border overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 border-b bg-[#E8EDF2] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#2C3E50]">
            <span className="w-8 text-center">Nr</span>
            <span>Descrizione</span>
            <span className="text-right">Q.tà</span>
            <span className="text-right">Prezzo</span>
            <span className="text-right">Importo</span>
            <span className="text-center w-16">IVA</span>
          </div>

          {lineItems.map((lineItem, index) => (
            <div
              key={`${lineItem.description}-${index}`}
              className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 border-b px-3 py-2 text-sm last:border-b-0"
            >
              <span className="w-8 text-center text-muted-foreground">{index + 1}</span>
              <span>{lineItem.description}</span>
              <span className="text-right tabular-nums">
                {lineItem.quantity}
              </span>
              <span className="text-right tabular-nums">
                {formatAmount(lineItem.unitPrice)}
              </span>
              <span className="text-right tabular-nums font-medium">
                {formatAmount(getInvoiceDraftLineTotal(lineItem))}
              </span>
              <span className="text-center w-16 text-xs text-muted-foreground">0% N2.2</span>
            </div>
          ))}
          {totals.stampDuty > 0 ? (
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 border-b px-3 py-2 text-sm last:border-b-0">
              <span className="w-8 text-center text-muted-foreground">{lineItems.length + 1}</span>
              <span className="text-xs">Imposta di bollo assolta in modo virtuale</span>
              <span className="text-right tabular-nums">1</span>
              <span className="text-right tabular-nums">{formatAmount(totals.stampDuty)}</span>
              <span className="text-right tabular-nums font-medium">{formatAmount(totals.stampDuty)}</span>
              <span className="text-center w-16 text-xs text-muted-foreground">0% N2.2</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">Riepilogo IVA</p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0% N2.2</span>
              <span>Imponibile: {formatAmount(totals.totalAmount)} · Imposta: {formatAmount(0)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Totale imponibile</span>
              <span className="font-medium">{formatAmount(totals.taxableAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Totale IVA</span>
              <span className="font-medium">{formatAmount(0)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base rounded-md bg-[#E8EDF2] px-2 py-1">
              <span className="text-[#2C3E50]">Netto a pagare</span>
              <span>{formatAmount(totals.totalAmount)}</span>
            </div>
          </div>
        </div>

        <p className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">Pagamento</p>
        <div className="rounded-lg border border-l-[3px] border-l-[#2C3E50] bg-white px-3 py-2 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span><span className="text-muted-foreground">Modalità:</span> Bonifico</span>
            {businessProfile.bankName ? <span><span className="text-muted-foreground">Banca:</span> {businessProfile.bankName}</span> : null}
            {businessProfile.bic ? <span><span className="text-muted-foreground">BIC:</span> {businessProfile.bic}</span> : null}
          </div>
          {businessProfile.iban ? (
            <p className="text-xs mt-1"><span className="text-muted-foreground">IBAN:</span> <span className="font-mono font-medium">{businessProfile.iban}</span></p>
          ) : null}
        </div>

        <div className="rounded-lg border border-l-[3px] border-l-[#456B6B] bg-white px-3 py-2 text-xs">
          <p className="font-bold uppercase tracking-wider text-[#456B6B] mb-1">Regime fiscale</p>
          <p className="text-muted-foreground">
            RF19 — Regime forfettario · Operazione senza IVA ai sensi dell'art. 1 co. 54-89 L. 190/2014
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Origine: {draft.source.kind} — {draft.source.label} · Data: {draft.invoiceDate ?? todayIsoDate()}
        </p>

        {draft.notes ? (
          <div className="rounded-lg border border-l-[3px] border-l-[#456B6B] bg-white p-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#456B6B]">Note</p>
            <p className="whitespace-pre-wrap">{draft.notes}</p>
          </div>
        ) : null}

        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-50">
            <Label htmlFor="invoice-number" className="text-xs text-muted-foreground">
              Numero fattura (per XML)
            </Label>
            <Input
              id="invoice-number"
              placeholder="es. FPR 2/25"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Chiudi
            </Button>
            <Button
              type="button"
              className="bg-[#2C3E50] hover:bg-[#1a2a38]"
              onClick={async () => {
                setIsDownloading(true);
                try {
                  await downloadInvoiceDraftPdf({
                    draft,
                    issuer: businessProfile,
                  });
                } finally {
                  setIsDownloading(false);
                }
              }}
            >
              <FileDown className="mr-1 h-4 w-4" />
              {isDownloading ? "Generazione..." : "PDF"}
            </Button>
            <Button
              type="button"
              className="bg-[#456B6B] hover:bg-[#375858]"
              disabled={!invoiceNumber.trim()}
              onClick={() => {
                downloadInvoiceDraftXml({
                  draft,
                  issuer: businessProfile,
                  invoiceNumber: invoiceNumber.trim(),
                });
              }}
            >
              <FileCode className="mr-1 h-4 w-4" />
              XML
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
