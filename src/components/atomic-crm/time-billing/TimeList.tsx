// src/components/atomic-crm/time-billing/TimeList.tsx
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import type { ServiceLine, TimeEntry } from "../types";
import { ALL_SERVICE_LINES, SERVICE_LINE_LABELS } from "./serviceLines";
import { formatSZL } from "@/lib/format";

type SortField = "entry_date" | "hours" | "hourly_rate_szl" | "service_line";
type SortDir = "asc" | "desc";

const SortIcon = ({
  field,
  sort,
}: {
  field: SortField;
  sort: { field: SortField; dir: "asc" | "desc" };
}) => {
  if (sort.field !== field) return <ChevronsUpDown className="w-3 h-3" />;
  return sort.dir === "asc" ? (
    <ChevronUp className="w-3 h-3" />
  ) : (
    <ChevronDown className="w-3 h-3" />
  );
};

interface TimeListProps {
  entries: TimeEntry[];
  companies: Record<string | number, string>;
}

export const TimeList = ({ entries, companies }: TimeListProps) => {
  const [filterCompany, setFilterCompany] = useState("ALL");
  const [filterService, setFilterService] = useState<ServiceLine | "ALL">(
    "ALL",
  );
  const [filterBillable, setFilterBillable] = useState<"ALL" | "yes" | "no">(
    "ALL",
  );
  const [filterInvoiced, setFilterInvoiced] = useState<"ALL" | "yes" | "no">(
    "ALL",
  );
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "entry_date",
    dir: "desc",
  });

  const uniqueCompanyIds = useMemo(
    () => [...new Set(entries.map((e) => String(e.company_id)))],
    [entries],
  );

  const filtered = useMemo(() => {
    let result = entries;
    if (filterCompany !== "ALL")
      result = result.filter((e) => String(e.company_id) === filterCompany);
    if (filterService !== "ALL")
      result = result.filter((e) => e.service_line === filterService);
    if (filterBillable === "yes") result = result.filter((e) => e.billable);
    if (filterBillable === "no") result = result.filter((e) => !e.billable);
    if (filterInvoiced === "yes")
      result = result.filter((e) => e.invoice_id != null);
    if (filterInvoiced === "no")
      result = result.filter((e) => e.invoice_id == null);

    return [...result].sort((a, b) => {
      const field = sort.field;
      let cmp: number;
      if (field === "hours" || field === "hourly_rate_szl") {
        cmp = (a[field] ?? 0) - (b[field] ?? 0);
      } else {
        const av = String(a[field] ?? "");
        const bv = String(b[field] ?? "");
        cmp = av.localeCompare(bv);
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [
    entries,
    filterCompany,
    filterService,
    filterBillable,
    filterInvoiced,
    sort,
  ]);

  const toggleSort = (field: SortField) =>
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
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

        <Select
          value={filterService}
          onValueChange={(v) => {
            if (v === "ALL" || (ALL_SERVICE_LINES as string[]).includes(v))
              setFilterService(v as ServiceLine | "ALL");
          }}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="All services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All services</SelectItem>
            {ALL_SERVICE_LINES.map((sl) => (
              <SelectItem key={sl} value={sl}>
                {SERVICE_LINE_LABELS[sl]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterBillable}
          onValueChange={(v) => {
            if (v === "ALL" || v === "yes" || v === "no") setFilterBillable(v);
          }}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Billable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="yes">Billable only</SelectItem>
            <SelectItem value="no">Non-billable</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterInvoiced}
          onValueChange={(v) => {
            if (v === "ALL" || v === "yes" || v === "no") setFilterInvoiced(v);
          }}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Invoice status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All entries</SelectItem>
            <SelectItem value="no">Uninvoiced only</SelectItem>
            <SelectItem value="yes">Invoiced only</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("entry_date")}
                >
                  Date <SortIcon field="entry_date" sort={sort} />
                </button>
              </th>
              <th className="text-left p-3 font-medium">Company</th>
              <th className="text-left p-3 font-medium">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("service_line")}
                >
                  Service <SortIcon field="service_line" sort={sort} />
                </button>
              </th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-right p-3 font-medium">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground ml-auto"
                  onClick={() => toggleSort("hours")}
                >
                  Hours <SortIcon field="hours" sort={sort} />
                </button>
              </th>
              <th className="text-right p-3 font-medium">Rate</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-center p-3 font-medium">Billable</th>
              <th className="text-center p-3 font-medium">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="p-6 text-center text-muted-foreground"
                >
                  No entries match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((entry) => (
              <tr
                key={entry.id}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="p-3 whitespace-nowrap text-xs">
                  {new Date(entry.entry_date).toLocaleDateString("en-GB")}
                </td>
                <td className="p-3 text-xs">
                  {companies[Number(entry.company_id)] ??
                    `Company ${entry.company_id}`}
                </td>
                <td className="p-3 text-xs">
                  {SERVICE_LINE_LABELS[entry.service_line]}
                </td>
                <td className="p-3 text-xs text-muted-foreground max-w-48 truncate">
                  {entry.description}
                </td>
                <td className="p-3 text-right text-xs font-mono">
                  {entry.hours.toFixed(2)}
                </td>
                <td className="p-3 text-right text-xs font-mono">
                  {entry.billable ? formatSZL(entry.hourly_rate_szl) : "—"}
                </td>
                <td className="p-3 text-right text-xs font-mono font-medium">
                  {entry.billable
                    ? formatSZL(entry.hours * entry.hourly_rate_szl)
                    : "—"}
                </td>
                <td className="p-3 text-center">
                  {entry.billable ? (
                    <Badge
                      variant="outline"
                      className="text-xs border-green-400 text-green-600"
                    >
                      Yes
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  {entry.invoice_id != null ? (
                    <Badge variant="outline" className="text-xs">
                      Invoiced
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
