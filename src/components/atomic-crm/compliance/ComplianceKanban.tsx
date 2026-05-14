import { Building2 } from "lucide-react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { ComplianceFiling, FilingStatus } from "../types";
import {
  ALL_FILING_STATUSES,
  FILING_STATUS_COLORS,
  FILING_STATUS_LABELS,
  FILING_TYPE_LABELS,
} from "./filingTypes";

interface ComplianceKanbanProps {
  filings: ComplianceFiling[];
  companies: Record<number, string>;
}

export const ComplianceKanban = ({
  filings,
  companies,
}: ComplianceKanbanProps) => {
  const byStatus = Object.fromEntries(
    ALL_FILING_STATUSES.map((s) => [
      s,
      filings
        .filter((f) => f.status === s)
        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    ]),
  ) as Record<FilingStatus, ComplianceFiling[]>;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {ALL_FILING_STATUSES.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          filings={byStatus[status]}
          companies={companies}
        />
      ))}
    </div>
  );
};

const KanbanColumn = ({
  status,
  filings,
  companies,
}: {
  status: FilingStatus;
  filings: ComplianceFiling[];
  companies: Record<number, string>;
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2 px-1">
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          FILING_STATUS_COLORS[status],
        )}
      >
        {FILING_STATUS_LABELS[status]}
      </span>
      <span className="text-xs text-muted-foreground ml-auto">
        {filings.length}
      </span>
    </div>

    <div className="flex flex-col gap-2 min-h-24">
      {filings.length === 0 && (
        <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground text-center">
          None
        </div>
      )}
      {filings.map((filing) => (
        <KanbanCard
          key={filing.id}
          filing={filing}
          companyName={companies[Number(filing.company_id)]}
        />
      ))}
    </div>
  </div>
);

const KanbanCard = ({
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
    <Card
      className={cn(
        "p-3 flex flex-col gap-1 text-xs shadow-sm",
        isUrgent && "border-amber-400",
        filing.status === "OVERDUE" && "border-red-400",
      )}
    >
      <span className="font-medium leading-tight">
        {FILING_TYPE_LABELS[filing.filing_type]}
      </span>
      <span className="text-muted-foreground">{filing.period_covered}</span>
      {companyName && (
        <Link
          to={`/companies/${filing.company_id}/show`}
          className="flex items-center gap-1 text-primary hover:underline truncate"
        >
          <Building2 className="w-3 h-3 shrink-0" />
          <span className="truncate">{companyName}</span>
        </Link>
      )}
      <span
        className={cn(
          "mt-0.5",
          isUrgent
            ? "text-amber-600 dark:text-amber-400 font-medium"
            : filing.status === "OVERDUE"
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground",
        )}
      >
        {dueDate.toLocaleDateString("en-GB")}
        {isUrgent && ` · ${daysUntilDue === 0 ? "today" : `${daysUntilDue}d`}`}
        {filing.status === "OVERDUE" && ` · ${Math.abs(daysUntilDue)}d overdue`}
      </span>
    </Card>
  );
};
