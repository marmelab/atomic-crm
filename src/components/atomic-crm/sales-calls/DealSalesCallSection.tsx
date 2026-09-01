import { useState } from "react";
import { useGetList, useRecordContext, useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatTimestampString } from "../deals/dealUtils";
import type { Deal, SalesCall } from "../types";
import { salesCallAttendances } from "./salesCallConstants";
import { CompleteSalesCallDialog } from "./CompleteSalesCallDialog";

const findLabel = (
  choices: { value: string; label: string }[],
  value?: string | null,
) => choices.find((choice) => choice.value === value)?.label;

// The "wherever the call naturally appears" home for the Complete Sales
// Call action (Acuity/Sales Call Lifecycle slice) — the Opportunity page,
// alongside the existing Application/Enrollment section it sits next to.
// Reads the most recent Sales Call for this Opportunity regardless of
// status, so a cancelled or already-completed call still shows its real
// state rather than silently disappearing.
export const DealSalesCallSection = () => {
  const record = useRecordContext<Deal>();
  const translate = useTranslate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: salesCalls } = useGetList<SalesCall>(
    "sales_calls",
    {
      filter: { opportunity_id: record?.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
    },
    { enabled: !!record },
  );
  const salesCall = salesCalls?.[0];
  if (!record || !salesCall) return null;

  const contactName = record.name;

  return (
    <div className="flex flex-col gap-2 m-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground tracking-wide">
            {translate("resources.deals.sales_call.name", {
              _: "Sales Call",
            })}
          </span>
          <span className="text-sm">
            {salesCall.status === "cancelled" ? (
              <Badge variant="outline">
                {translate("resources.deals.sales_call.status_cancelled", {
                  _: "Cancelled",
                })}
              </Badge>
            ) : salesCall.attendance ? (
              <Badge variant="outline">
                {findLabel(salesCallAttendances, salesCall.attendance)}
              </Badge>
            ) : (
              formatTimestampString(salesCall.scheduled_at)
            )}
            {salesCall.reschedule_count > 0 &&
              salesCall.status !== "cancelled" && (
                <span className="text-xs text-muted-foreground ml-2">
                  {translate("resources.deals.sales_call.rescheduled_count", {
                    _: "rescheduled %{count}×",
                    count: salesCall.reschedule_count,
                  })}
                </span>
              )}
          </span>
        </div>

        {salesCall.status === "booked" && !salesCall.attendance && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            {translate("resources.deals.sales_call.complete_action", {
              _: "Complete Sales Call",
            })}
          </Button>
        )}
      </div>

      <CompleteSalesCallDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        salesCallId={salesCall.id}
        contactName={contactName}
      />
    </div>
  );
};
