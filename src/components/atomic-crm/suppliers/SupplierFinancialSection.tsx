import { useGetList } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

import type { FinancialDocumentSummary } from "../types";

const eur = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2 });

const documentTypeLabels: Record<string, string> = {
  customer_invoice: "Fattura emessa",
  supplier_invoice: "Fattura ricevuta",
  customer_credit_note: "Nota credito emessa",
  supplier_credit_note: "Nota credito ricevuta",
};

const statusLabels: Record<string, string> = {
  open: "Aperto",
  partial: "Parziale",
  settled: "Saldato",
  overdue: "Scaduto",
};

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  open: "outline",
  partial: "secondary",
  settled: "default",
  overdue: "destructive",
};

// ---------- Summary card (debiti/crediti) ----------

export const SupplierFinancialSummary = ({
  supplierId,
}: {
  supplierId: string;
}) => {
  const { data: docs, isPending } = useGetList<FinancialDocumentSummary>(
    "financial_documents_summary",
    {
      filter: { "supplier_id@eq": supplierId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "issue_date", order: "DESC" },
    },
    { enabled: !!supplierId },
  );

  if (isPending || !docs?.length) return null;

  let totalOwed = 0; // supplier invoices we owe (inbound)
  let totalCredit = 0; // credit notes in our favor
  let totalPaid = 0;
  let totalOpen = 0;
  let overdueCount = 0;

  for (const doc of docs) {
    if (
      doc.document_type === "supplier_invoice" ||
      doc.document_type === "customer_credit_note"
    ) {
      totalOwed += doc.total_amount;
      totalPaid += doc.settled_amount;
      totalOpen += doc.open_amount;
      if (doc.settlement_status === "overdue") overdueCount++;
    } else {
      totalCredit += doc.total_amount;
    }
  }

  const netBalance = totalOpen - totalCredit;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Situazione debiti / crediti
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Totale fatturato" value={eur(totalOwed)} />
        <SummaryTile label="Pagato" value={eur(totalPaid)} />
        <SummaryTile
          label="Da pagare"
          value={eur(totalOpen)}
          highlight={totalOpen > 0}
        />
        <SummaryTile
          label="Saldo netto"
          value={`${netBalance >= 0 ? "" : "-"}EUR ${eur(Math.abs(netBalance))}`}
          highlight={netBalance > 0}
        />
      </div>
      {overdueCount > 0 && (
        <p className="text-sm text-destructive">
          {overdueCount} fattura{overdueCount > 1 ? "e" : ""} scadut
          {overdueCount > 1 ? "e" : "a"}
        </p>
      )}
    </div>
  );
};

const SummaryTile = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className="rounded-lg border px-3 py-2">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-sm font-semibold ${highlight ? "text-destructive" : ""}`}>
      {value}
    </p>
  </div>
);

// ---------- Document list card ----------

export const SupplierFinancialDocsCard = ({
  supplierId,
}: {
  supplierId: string;
}) => {
  const { data: docs, isPending } = useGetList<FinancialDocumentSummary>(
    "financial_documents_summary",
    {
      filter: { "supplier_id@eq": supplierId },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "issue_date", order: "DESC" },
    },
    { enabled: !!supplierId },
  );

  if (isPending) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Documenti fiscali
      </h3>
      {!docs?.length ? (
        <p className="text-sm text-muted-foreground">
          Nessun documento fiscale collegato a questo fornitore.
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-muted-foreground" />
                <span className="font-medium">
                  {documentTypeLabels[doc.document_type] ?? doc.document_type}
                </span>
                <span className="text-muted-foreground">
                  n. {doc.document_number}
                </span>
                <span className="text-muted-foreground">
                  {new Date(doc.issue_date).toLocaleDateString("it-IT")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[doc.settlement_status] ?? "outline"}>
                  {statusLabels[doc.settlement_status] ?? doc.settlement_status}
                </Badge>
                <span className="text-sm font-medium whitespace-nowrap">
                  EUR {eur(doc.total_amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
