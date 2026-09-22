import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { cohortDateRange, cohortSchedule } from "../cohorts/cohortDates";
import { useCohortCapacity } from "../cohorts/useCohortCapacity";
import { ProgramCardMenu } from "../programs/ProgramCardMenu";
import type { Cohort } from "../types";
import { describeCohortThreshold } from "./cohortThreshold";

const thresholdLabels = {
  below_minimum: "Below minimum",
  minimum_reached: "Minimum reached",
  target_reached: "Target reached",
  full: "Full",
  unknown: null,
} as const;

// Reuses the exact same Cohort capacity classification as the Cohorts page
// (cohorts/useCohortCapacity.ts) — never reinterprets Enrolled/In Sales
// here.
export const CohortCapacityCard = ({ cohort }: { cohort: Cohort }) => {
  const translate = useTranslate();
  const { isPending, enrolledCount, inSalesCount, waitingCount } =
    useCohortCapacity(cohort.id);

  if (isPending || enrolledCount == null) return null;

  const threshold = describeCohortThreshold({
    enrolled: enrolledCount,
    minimum: cohort.minimum_capacity,
    target: cohort.target_capacity,
    maximum: cohort.maximum_capacity,
  });
  const thresholdLabel = thresholdLabels[threshold];
  // Group capacity is seats in a round, never the 1:1 concurrent-client
  // rule: a cohort has a maximum and an enrolled count, and the
  // difference is what is left.
  const seatsRemaining =
    cohort.maximum_capacity != null
      ? Math.max(cohort.maximum_capacity - enrolledCount, 0)
      : null;

  // The shared dates everybody in this round is on. Shown only when
  // they are actually known — January 2027 has fifty-one people waiting
  // and no dates yet, and inventing a range for it would be worse than
  // saying so.
  const dateRange = cohortDateRange(cohortSchedule(cohort));

  return (
    <Card className="p-0">
      <CardContent className="p-0 relative">
        <div className="absolute right-2 top-2 z-10">
          <ProgramCardMenu
            resource="cohorts"
            id={cohort.id}
            name={cohort.name}
            editPath={`/cohorts/${cohort.id}`}
            // A round leaves active use by being completed — the
            // same status the Programs hub already filters on.
            archive={{ status: "completed" }}
            archived={cohort.status === "completed"}
          />
        </div>
        <Link
          to={`/cohorts/${cohort.id}/show`}
          className="flex flex-col gap-1 p-6 hover:bg-accent/50 rounded-xl transition-colors"
        >
          <p className="text-sm font-medium pr-8">{cohort.name}</p>
          {dateRange ? (
            <p className="text-sm text-muted-foreground">{dateRange}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {translate("crm.programs.cohort_dates_unset", {
                _: "Dates not set yet",
              })}
            </p>
          )}
          <p className="text-2xl font-semibold">
            {enrolledCount}
            {cohort.maximum_capacity != null && (
              <span className="text-muted-foreground text-lg">
                {" "}
                / {cohort.maximum_capacity}
              </span>
            )}
            <span className="text-sm text-muted-foreground font-normal">
              {" "}
              {translate("crm.dashboard.capacity_enrolled", { _: "enrolled" })}
            </span>
          </p>
          {seatsRemaining != null && (
            <p className="text-sm text-muted-foreground">
              {translate("crm.dashboard.seats_remaining", {
                _: "%{count} seats left",
                count: seatsRemaining,
              })}
            </p>
          )}
          {thresholdLabel && <Badge variant="outline">{thresholdLabel}</Badge>}
          {inSalesCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {translate("crm.dashboard.people_deciding_count", {
                _: "%{smart_count} person deciding |||| %{smart_count} people deciding",
                smart_count: inSalesCount,
              })}
            </p>
          )}
          {!!waitingCount && waitingCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {translate("resources.waitlist_entries.count", {
                _: "%{count} waiting",
                count: waitingCount,
              })}
            </p>
          )}
        </Link>
      </CardContent>
    </Card>
  );
};
