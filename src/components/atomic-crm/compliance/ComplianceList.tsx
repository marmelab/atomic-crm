import {
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ComplianceFiling, FilingStatus, FilingType } from "../types";
import {
  ALL_FILING_STATUSES,
  ALL_FILING_TYPES,
  FILING_STATUS_LABELS,
  FILING_TYPE_LABELS,
} from "./filingTypes";
import { ComplianceStatusBadge } from "./ComplianceStatusBadge";

type SortField = "due_date" | "filing_type" | "status" | "period_covered";
type SortDir = "asc" | "desc";

interface ComplianceListProps {
  filings: ComplianceFiling[];
  companies: Record<number, string>;
}

export const ComplianceList = ({ filings, companies }: ComplianceListProps) => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();

  const [filterStatus, setFilterStatus] = useState<FilingStatus | "ALL">("ALL");
  const [filterType, setFilterType] = useState<FilingType | "ALL">("ALL");
  const [filterCompany, setFilterCompany] = useState<string>("ALL");
  const [filterMine, setFilterMine] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "due_date",
    dir: "asc",
  });

  const uniqueCompanyIds = useMemo(
    () => [...new Set(filings.map((f) => String(f.company_id)))],
    [filings],
  );

  const filtered = useMemo(() => {
    let result = filings;
    if (filterStatus !== "ALL")
      result = result.filter((f) => f.status === filterStatus);
    if (filterType !== "ALL")
      result = result.filter((f) => f.filing_type === filterType);
    if (filterCompany !== "ALL")
      result = result.filter((f) => String(f.company_id) === filterCompany);
    if (filterMine && identity?.id)
      result = result.filter((f) => f.assigned_to === identity.id);
    return [...result].sort((a, b) => {
      const av = a[sort.field] ?? "";
      const bv = b[sort.field] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [
    filings,
    filterStatus,
    filterType,
    filterCompany,
    filterMine,
    sort,
    identity,
  ]);

  const toggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort.field !== field) return <ChevronsUpDown className="w-3 h-3" />;
    return sort.dir === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as FilingStatus | "ALL")}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {ALL_FILING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {FILING_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterType}
          onValueChange={(v) => setFilterType(v as FilingType | "ALL")}
        >
          <SelectTrigger className="w-52 h-8 text-xs">
            <SelectValue placeholder="Filing type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All filing types</SelectItem>
            {ALL_FILING_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {FILING_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Company" />
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

        <Button
          variant={filterMine ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setFilterMine((v) => !v)}
        >
          {translate("crm.compliance.filter_mine", { _: "Assigned to me" })}
        </Button>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} filing{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("due_date")}
                >
                  Due date <SortIcon field="due_date" />
                </button>
              </th>
              <th className="text-left p-3 font-medium">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("filing_type")}
                >
                  Filing type <SortIcon field="filing_type" />
                </button>
              </th>
              <th className="text-left p-3 font-medium">Period</th>
              <th className="text-left p-3 font-medium">Company</th>
              <th className="text-left p-3 font-medium">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("status")}
                >
                  Status <SortIcon field="status" />
                </button>
              </th>
              <th className="text-left p-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-muted-foreground"
                >
                  No filings match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((filing) => (
              <FilingRow
                key={filing.id}
                filing={filing}
                companyName={companies[Number(filing.company_id)]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const FilingRow = ({
  filing,
  companyName,
}: {
  filing: ComplianceFiling;
  companyName?: string;
}) => {
  const dueDate = new Date(filing.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const isUrgent =
    daysUntilDue >= 0 && daysUntilDue <= 7 && filing.status === "UPCOMING";

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="p-3 whitespace-nowrap">
        <span
          className={
            isUrgent ? "font-semibold text-amber-600 dark:text-amber-400" : ""
          }
        >
          {dueDate.toLocaleDateString("en-GB")}
        </span>
        {isUrgent && (
          <Badge
            variant="outline"
            className="ml-2 text-xs border-amber-400 text-amber-600"
          >
            {daysUntilDue === 0 ? "Today" : `${daysUntilDue}d`}
          </Badge>
        )}
        {filing.status === "OVERDUE" && (
          <Badge variant="destructive" className="ml-2 text-xs">
            {Math.abs(daysUntilDue)}d overdue
          </Badge>
        )}
      </td>
      <td className="p-3">{FILING_TYPE_LABELS[filing.filing_type]}</td>
      <td className="p-3 text-muted-foreground">{filing.period_covered}</td>
      <td className="p-3">
        {companyName ? (
          <Link
            to={`/companies/${filing.company_id}/show`}
            className="flex items-center gap-1 hover:underline text-primary"
          >
            <Building2 className="w-3 h-3" />
            {companyName}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-3">
        <ComplianceStatusBadge status={filing.status} />
      </td>
      <td className="p-3 text-muted-foreground text-xs max-w-48 truncate">
        {filing.notes ?? "—"}
      </td>
    </tr>
  );
};

// Re-export for import convenience
export { FILING_STATUS_LABELS } from "./filingTypes";
