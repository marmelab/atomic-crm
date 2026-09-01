import { useState } from "react";
import { useGetList, useRecordContext, useTranslate } from "ra-core";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  ownerDecisions,
  prospectDecisions,
} from "../deals/opportunityConstants";
import { formatISODateString, formatTimestampString } from "../deals/dealUtils";
import type { Deal, SalesCall } from "../types";
import { salesCallAttendances } from "./salesCallConstants";
import { CompleteSalesCallDialog } from "./CompleteSalesCallDialog";
import { LogSalesCallDialog } from "./LogSalesCallDialog";

const findLabel = (
  choices: { value: string; label: string }[],
  value?: string | null,
) => choices.find((choice) => choice.value === value)?.label;

// Stages the sales-call flow itself produces (bookSalesCall.ts only ever
// advances Approved -> Call Booked) — a legacy/inconsistent record here
// with no sales_calls row behind it is what makes "Complete Sales Call"
// go missing (Human-acceptance repair pass, §Repair 2).
const CALL_LIFECYCLE_STAGES = new Set(["call_booked", "decision", "committed"]);

const describeNextStep = (
  deal: Pick<
    Deal,
    "stage" | "owner_decision" | "prospect_decision" | "follow_up_date"
  >,
  translate: (key: string, options?: Record<string, unknown>) => string,
): string | null => {
  if (deal.owner_decision === "do_not_engage") {
    return findLabel(ownerDecisions, "do_not_engage") ?? null;
  }
  if (deal.owner_decision === "workshops_only") {
    return findLabel(ownerDecisions, "workshops_only") ?? null;
  }
  if (deal.prospect_decision === "yes") {
    return translate("resources.deals.sales_call.next_step_committed", {
      _: "Committed",
    });
  }
  if (deal.prospect_decision === "no") {
    return translate("resources.deals.sales_call.next_step_lost", {
      _: "Lost",
    });
  }
  if (deal.prospect_decision === "thinking" && deal.follow_up_date) {
    return translate("resources.deals.sales_call.next_step_follow_up", {
      _: "Follow up %{date}",
      date: formatISODateString(deal.follow_up_date),
    });
  }
  return null;
};

// The "wherever the call naturally appears" home for the Complete Sales
// Call action (Acuity/Sales Call Lifecycle slice; promoted to a prominent,
// impossible-to-miss position by the Human-acceptance repair pass, §Repair
// 1) — the Opportunity page, above Description/Notes. Reads the most
// recent Sales Call for this Opportunity regardless of status, so a
// cancelled or already-completed call still shows its real state rather
// than silently disappearing. Three distinct states: nothing to show yet
// (Opportunity hasn't reached a call-lifecycle stage), a legacy/
// inconsistent record (stage says Call Booked+ but no sales_calls row —
// §Repair 2), and a normal booked/completed call.
export const DealSalesCallSection = () => {
  const record = useRecordContext<Deal>();
  const translate = useTranslate();
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);

  const { data: salesCalls, isPending } = useGetList<SalesCall>(
    "sales_calls",
    {
      filter: { opportunity_id: record?.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
    },
    { enabled: !!record },
  );
  const salesCall = salesCalls?.[0];

  if (!record || isPending) return null;

  const contactName = record.name;

  if (!salesCall) {
    if (!CALL_LIFECYCLE_STAGES.has(record.stage)) return null;

    // Legacy/inconsistent record — never silently invent a call that
    // wasn't tracked; give Leif a clear, honest recovery action instead
    // of a dead end.
    return (
      <div className="flex flex-col gap-3 m-4 rounded-lg border border-dashed p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {translate("resources.deals.sales_call.name", {
              _: "Sales Call",
            })}
          </span>
          <span className="text-sm text-muted-foreground">
            {translate("resources.deals.sales_call.no_record", {
              _: "This Opportunity reached %{stage} without a tracked sales call.",
              stage:
                findLabel(
                  [{ value: "call_booked", label: "Call Booked" }],
                  record.stage,
                ) ?? record.stage,
            })}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setLogDialogOpen(true)}
        >
          {translate("resources.deals.sales_call.log_action", {
            _: "Log Sales Call",
          })}
        </Button>
        <LogSalesCallDialog
          open={logDialogOpen}
          onOpenChange={setLogDialogOpen}
          contactId={record.contact_id}
          contactName={contactName}
          opportunityId={record.id}
        />
      </div>
    );
  }

  const isPendingOutcome =
    salesCall.status === "booked" && !salesCall.attendance;

  return (
    <div
      className={`flex flex-col gap-3 m-4 rounded-lg border p-4 ${
        isPendingOutcome ? "border-primary" : ""
      }`}
    >
      {salesCall.status === "cancelled" ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {translate("resources.deals.sales_call.name", {
              _: "Sales Call",
            })}
          </span>
          <Badge variant="outline" className="self-start">
            {translate("resources.deals.sales_call.status_cancelled", {
              _: "Cancelled",
            })}
          </Badge>
        </div>
      ) : isPendingOutcome ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {translate("resources.deals.sales_call.name", {
                _: "Sales Call",
              })}
            </span>
            <span className="text-base">
              {formatTimestampString(salesCall.scheduled_at)}
            </span>
            {salesCall.reschedule_count > 0 && (
              <span className="text-xs text-muted-foreground">
                {translate("resources.deals.sales_call.rescheduled_count", {
                  _: "rescheduled %{count}×",
                  count: salesCall.reschedule_count,
                })}
              </span>
            )}
          </div>
          <Button size="lg" onClick={() => setCompleteDialogOpen(true)}>
            {translate("resources.deals.sales_call.complete_action", {
              _: "Complete Sales Call",
            })}
          </Button>
        </div>
      ) : (
        <>
          <span className="text-sm font-medium">
            {translate("resources.deals.sales_call.completed_heading", {
              _: "Sales Call · Completed",
            })}
          </span>
          <div className="flex items-center gap-2 text-sm">
            {salesCall.attendance === "attended" ? (
              <CheckCircle2 className="size-4 text-primary" />
            ) : (
              <XCircle className="size-4 text-muted-foreground" />
            )}
            {findLabel(salesCallAttendances, salesCall.attendance)}
          </div>

          {salesCall.attendance === "attended" && (
            <div className="flex flex-wrap gap-8">
              {record.owner_decision && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground tracking-wide">
                    {translate("resources.deals.sales_call.my_decision", {
                      _: "My decision",
                    })}
                  </span>
                  <span className="text-sm">
                    {findLabel(ownerDecisions, record.owner_decision)}
                  </span>
                </div>
              )}
              {record.owner_decision === "would_work_with" &&
                record.prospect_decision && (
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground tracking-wide">
                      {translate("resources.deals.sales_call.their_decision", {
                        _: "Their decision",
                      })}
                    </span>
                    <span className="text-sm">
                      {findLabel(prospectDecisions, record.prospect_decision)}
                    </span>
                  </div>
                )}
              {describeNextStep(record, translate) && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground tracking-wide">
                    {translate("resources.deals.sales_call.next_step", {
                      _: "Next step",
                    })}
                  </span>
                  <span className="text-sm">
                    {describeNextStep(record, translate)}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <CompleteSalesCallDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        salesCallId={salesCall.id}
        contactName={contactName}
      />
    </div>
  );
};
