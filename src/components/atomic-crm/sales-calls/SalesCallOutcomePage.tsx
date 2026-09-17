import { useCallback, useEffect, useState } from "react";
import { useDataProvider, useTranslate } from "ra-core";
import { Link, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { SalesCallResolutionContext } from "./loadSalesCallResolutionContext";
import { loadSalesCallResolutionContext } from "./loadSalesCallResolutionContext";
import { formatSalesCallScheduleWithPrecision } from "./salesCallSchedule";
import { classifySalesCallAmbiguity } from "./salesCallTaskTypes";
import { CompleteSalesCallDialog } from "./CompleteSalesCallDialog";

// "What happened on this call?" — the destination for a resolve_sales_call
// Task.
//
// Production acceptance found the Dashboard offering "SALES CALL NEEDS
// MATCHING — Megan Auron · call of Jul 7, 2026 — what happened?" and then
// opening a matching page that answered "This booking is already attached
// to an Opportunity." Megan's call never needed matching; what was unknown
// was its outcome. This page answers that question instead, using the same
// canonical three-way action the Opportunity's own Sales Call section uses
// (CompleteSalesCallDialog: call happened / no-show / cancelled) — one
// implementation, so a call resolved from here and a call resolved from
// the Opportunity page take exactly the same path through the pipeline.
export const SalesCallOutcomePage = () => {
  const { id } = useParams();
  const dataProvider = useDataProvider();
  const translate = useTranslate();
  const [context, setContext] = useState<
    SalesCallResolutionContext | "pending"
  >("pending");
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setContext({ kind: "not-found" });
      return;
    }
    setContext(await loadSalesCallResolutionContext(dataProvider, id));
  }, [dataProvider, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (context === "pending") return null;

  const title = translate("resources.sales_calls.outcome.title", {
    _: "Resolve sales call",
  });

  if (context.kind === "not-found") {
    return (
      <PageShell title={title}>
        <p className="text-sm text-muted-foreground">
          {translate("resources.sales_calls.resolve.not_found", {
            _: "This booking no longer exists.",
          })}
        </p>
      </PageShell>
    );
  }

  const { contact, salesCall } = context;
  const contactName =
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
  const opportunity =
    context.kind === "already-resolved" ? context.opportunity : null;

  // The page branches on the booking's ACTUAL state, never on the Task that
  // brought us here. A task that has gone stale — someone resolved the call
  // from the Opportunity page in another tab — shows the truth rather than
  // offering an action that would contradict it.
  const ambiguity = classifySalesCallAmbiguity(salesCall);

  if (ambiguity === "needs-matching") {
    return (
      <PageShell title={title}>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm">
              {translate("resources.sales_calls.outcome.not_attached", {
                _: "This booking isn't attached to an Opportunity yet, so there's no outcome to record.",
              })}
            </p>
            <Link
              to={`/sales-calls/${salesCall.id}/resolve`}
              className="text-sm underline hover:no-underline"
            >
              {translate("resources.sales_calls.outcome.go_match", {
                _: "Match it to an Opportunity first",
              })}
            </Link>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell title={title}>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">{contactName}</p>
            <p className="text-sm text-muted-foreground">
              {formatSalesCallScheduleWithPrecision(salesCall)}
            </p>
          </div>

          {ambiguity === "none" ? (
            <p className="text-sm">
              {translate("resources.sales_calls.outcome.already_resolved", {
                _: "This call is already resolved.",
              })}
            </p>
          ) : (
            <>
              <p className="text-sm">
                {translate("resources.sales_calls.outcome.question", {
                  _: "What happened on this call?",
                })}
              </p>
              <Button
                type="button"
                className="self-start"
                onClick={() => setDialogOpen(true)}
              >
                {translate("resources.sales_calls.outcome.record", {
                  _: "Record what happened",
                })}
              </Button>
            </>
          )}

          {opportunity && (
            <Link
              to={`/deals/${opportunity.id}/show`}
              className="text-sm underline hover:no-underline"
            >
              {translate("resources.sales_calls.resolve.view_opportunity", {
                _: "View the Opportunity",
              })}
            </Link>
          )}
        </CardContent>
      </Card>

      <CompleteSalesCallDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          // Re-read on close so the page reflects whatever was just
          // recorded, including the case where the dialog was cancelled.
          if (!open) load();
        }}
        salesCallId={salesCall.id}
        contactName={contactName}
      />
    </PageShell>
  );
};

const PageShell = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="max-w-lg mx-auto mt-8 flex flex-col gap-2">
    <h1 className="text-xl font-semibold">{title}</h1>
    {children}
  </div>
);

SalesCallOutcomePage.path = "/sales-calls/:id/outcome";
