// src/components/atomic-crm/time-billing/InvoiceList.tsx
import { useMemo, useState } from "react";
import type { Invoice, InvoiceStatus } from "../types";
import {
  ALL_INVOICE_STATUSES,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
} from "./serviceLines";
import { formatSZL } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InvoiceListProps {
  invoices: Invoice[];
  companies: Record<string | number, string>;
}

export const InvoiceList = ({ invoices, companies }: InvoiceListProps) => {
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | "ALL">(
    "ALL",
  );
  const [filterCompany, setFilterCompany] = useState("ALL");

  const uniqueCompanyIds = useMemo(
    () => [...new Set(invoices.map((inv) => String(inv.company_id)))],
    [invoices],
  );

  const filtered = useMemo(() => {
    let result = invoices;
    if (filterStatus !== "ALL")
      result = result.filter((i) => i.status === filterStatus);
    if (filterCompany !== "ALL")
      result = result.filter((i) => String(i.company_id) === filterCompany);
    return [...result].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [invoices, filterStatus, filterCompany]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={filterStatus}
          onValueChange={(v) => {
            if (v === "ALL" || (ALL_INVOICE_STATUSES as string[]).includes(v))
              setFilterStatus(v as InvoiceStatus | "ALL");
          }}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {ALL_INVOICE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {INVOICE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All companies</SelectItem>
            {uniqueCompanyIds.map((id) => (
              <SelectItem key={id} value={id}>
                {companies[Number(id)] ?? `Company ${id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "invoice" : "invoices"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Invoice #</th>
              <th className="text-left p-3 font-medium">Company</th>
              <th className="text-left p-3 font-medium">Period</th>
              <th className="text-right p-3 font-medium">Subtotal</th>
              <th className="text-right p-3 font-medium">VAT (15%)</th>
              <th className="text-right p-3 font-medium">Total</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-muted-foreground"
                >
                  No invoices yet.
                </td>
              </tr>
            )}
            {filtered.map((inv) => (
              <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3 font-mono text-xs font-medium">
                  {inv.invoice_number}
                </td>
                <td className="p-3 text-xs">
                  {companies[Number(inv.company_id)] ??
                    `Company ${inv.company_id}`}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(inv.period_start).toLocaleDateString("en-GB")} –{" "}
                  {new Date(inv.period_end).toLocaleDateString("en-GB")}
                </td>
                <td className="p-3 text-right text-xs font-mono">
                  {formatSZL(inv.subtotal_szl)}
                </td>
                <td className="p-3 text-right text-xs font-mono">
                  {formatSZL(inv.vat_szl)}
                </td>
                <td className="p-3 text-right text-xs font-mono font-semibold">
                  {formatSZL(inv.total_szl)}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}
                  >
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
