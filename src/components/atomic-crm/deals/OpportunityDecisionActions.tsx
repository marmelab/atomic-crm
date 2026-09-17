import { useState } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { Deal } from "../types";
import {
  isAtDecision,
  recordOpportunityDecision,
  type OpportunityDecision,
} from "./recordOpportunityDecision";
import {
  isAwaitingBooking,
  resolveApprovedOpportunity,
  type ApprovedResolution,
} from "./resolveApprovedOpportunity";

// The two places an Opportunity sits waiting on a human answer, each given
// the answer it is actually waiting for.
//
// Renders nothing anywhere else: an Opportunity at Interested or Call
// Booked is not waiting on a decision, and offering one there would invite
// Leif to record an answer to a question nobody asked.
export const OpportunityDecisionActions = ({ deal }: { deal: Deal }) => {
  if (isAtDecision(deal)) return <DecisionActions deal={deal} />;
  if (isAwaitingBooking(deal)) return <ApprovedActions deal={deal} />;
  return null;
};

const DecisionActions = ({ deal }: { deal: Deal }) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);

  const record = async (decision: OpportunityDecision) => {
    setBusy(true);
    try {
      const result = await recordOpportunityDecision(dataProvider, {
        opportunityId: deal.id,
        decision,
      });
      if (result.status === "already-resolved") {
        notify("This Opportunity has already been resolved.", {
          type: "warning",
        });
      } else if (result.status === "not-found") {
        notify("ra.notification.http_error", { type: "error" });
      } else {
        notify(DECISION_CONFIRMATION[decision], { type: "info" });
      }
      refresh();
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ActionCard title="Record decision">
      <Button type="button" onClick={() => record("committed")} disabled={busy}>
        Committed
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => record("declined")}
        disabled={busy}
      >
        Declined offer
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => record("ghosted")}
        disabled={busy}
      >
        Ghosted
      </Button>
    </ActionCard>
  );
};

const DECISION_CONFIRMATION: Record<OpportunityDecision, string> = {
  // Says what actually changed. Committed is deliberately not described as
  // won: nothing has been paid.
  committed: "Recorded as committed.",
  declined: "Recorded as declined — the Opportunity is closed.",
  ghosted: "Recorded as ghosted — the Opportunity is closed.",
};

const ApprovedActions = ({ deal }: { deal: Deal }) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);

  const resolve = async (resolution: ApprovedResolution) => {
    setBusy(true);
    try {
      const result = await resolveApprovedOpportunity(dataProvider, {
        opportunityId: deal.id,
        resolution,
      });
      if (result.status === "unchanged") {
        notify("Left as Approved, waiting for them to book.", { type: "info" });
      } else if (result.status === "already-resolved") {
        notify("This Opportunity has already been resolved.", {
          type: "warning",
        });
      } else if (result.status === "not-found") {
        notify("ra.notification.http_error", { type: "error" });
      } else {
        notify(
          resolution === "nurture"
            ? "Moved to Nurture."
            : "Recorded as Lost — nothing was deleted.",
          { type: "info" },
        );
      }
      refresh();
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ActionCard title="Approved — no call booked">
      <Button
        type="button"
        variant="outline"
        onClick={() => resolve("await-booking")}
        disabled={busy}
      >
        Keep waiting for a booking
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => resolve("nurture")}
        disabled={busy}
      >
        Nurture
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => resolve("lost")}
        disabled={busy}
      >
        Lost
      </Button>
    </ActionCard>
  );
};

const ActionCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Card className="mt-4">
    <CardContent className="flex flex-col gap-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </CardContent>
  </Card>
);
