import { useState } from "react";
import { AlertTriangle, Ban, Check, CircleX } from "lucide-react";
import { useDataProvider, useNotify, useRefresh, useTranslate } from "ra-core";
import { Confirm } from "@/components/admin/confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Application, Deal } from "../types";
import {
  applicationStatusBadgeVariant,
  applicationStatusLabels,
} from "./applicationConstants";
import {
  reviewApplication,
  type ApplicationReviewOutcome,
} from "./reviewApplication";

// The operational control area of the Application review page (Native
// Applications slice, §2/§3). Every write goes through the reviewApplication
// domain action — this component only orchestrates the click, the pending
// state, and (for Do Not Engage) the confirmation step; it never writes to
// a resource directly (§19).
export const ApplicationReviewActions = ({
  application,
  deal,
  applicantName,
}: {
  application: Application;
  deal: Deal;
  applicantName: string;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [pendingOutcome, setPendingOutcome] =
    useState<ApplicationReviewOutcome | null>(null);
  const [confirmingDoNotEngage, setConfirmingDoNotEngage] = useState(false);

  const runOutcome = async (outcome: ApplicationReviewOutcome) => {
    setPendingOutcome(outcome);
    try {
      const result = await reviewApplication({
        dataProvider,
        application,
        deal,
        outcome,
      });
      if (!result.applied) {
        // A stale tab / double-click landed after this Application was
        // already reviewed elsewhere (§17.F/G) — never silently overwrite,
        // just tell the user and show the real current state.
        notify("resources.applications.review.already_reviewed_notice", {
          type: "warning",
          _: "This application was already reviewed — showing the current state.",
        });
      } else {
        notify("resources.applications.updated", { type: "info" });
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setPendingOutcome(null);
      refresh();
    }
  };

  if (application.status !== "pending") {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={applicationStatusBadgeVariant[application.status]}>
          {applicationStatusLabels[application.status]}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {translate("resources.applications.review.already_reviewed", {
            _: "Reviewed — no further action needed.",
          })}
        </span>
      </div>
    );
  }

  const isBusy = pendingOutcome != null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={applicationStatusBadgeVariant[application.status]}>
          {applicationStatusLabels[application.status]}
        </Badge>
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runOutcome("approved")}
        >
          <Check className="w-4 h-4" />
          {translate("resources.applications.action.approve")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runOutcome("needs_higher_care")}
        >
          <AlertTriangle className="w-4 h-4" />
          {translate("resources.applications.action.needs_higher_care")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runOutcome("not_fit")}
        >
          <CircleX className="w-4 h-4" />
          {translate("resources.applications.action.not_fit")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={isBusy}
          onClick={() => setConfirmingDoNotEngage(true)}
        >
          <Ban className="w-4 h-4" />
          {translate("resources.applications.action.do_not_engage")}
        </Button>
      </div>
      <Confirm
        isOpen={confirmingDoNotEngage}
        title={translate("resources.applications.review.dne_confirm_title", {
          _: "Mark %{name} as Do Not Engage?",
          name: applicantName,
        })}
        content={translate("resources.applications.review.dne_confirm_body", {
          _: "This removes them from future direct sales eligibility.",
        })}
        confirmColor="warning"
        loading={isBusy}
        onConfirm={() => {
          setConfirmingDoNotEngage(false);
          runOutcome("do_not_engage");
        }}
        onClose={() => setConfirmingDoNotEngage(false)}
      />
    </>
  );
};
