import { CalendarDays } from "lucide-react";
import { useGetList } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { ComplianceFiling } from "../types";
import { ComplianceStatusBadge } from "../compliance/ComplianceStatusBadge";
import { FILING_TYPE_LABELS } from "../compliance/filingTypes";

export const FilingsDueThisWeek = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDays = new Date(today);
  sevenDays.setDate(today.getDate() + 7);

  const todayStr = today.toISOString().split("T")[0];
  const sevenDaysStr = sevenDays.toISOString().split("T")[0];

  const { data: filings = [], isPending } = useGetList<ComplianceFiling>(
    "compliance_filings",
    {
      filter: { "due_date@gte": todayStr, "due_date@lte": sevenDaysStr },
      sort: { field: "due_date", order: "ASC" },
      pagination: { page: 1, perPage: 50 },
    },
  );

  if (isPending) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Filings Due This Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No filings due this week.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filings.map((f) => (
              <Link
                key={f.id}
                to="/compliance"
                className="flex items-center justify-between text-sm hover:bg-muted px-1 py-1 rounded transition-colors"
              >
                <span className="truncate font-medium">
                  {FILING_TYPE_LABELS[f.filing_type]}
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-muted-foreground text-xs">
                    {new Date(f.due_date).toLocaleDateString("en-GB")}
                  </span>
                  <ComplianceStatusBadge status={f.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
