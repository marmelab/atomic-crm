import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

import { monthLabel } from "../capacity/monthLabel";
import { useWaitlistEntries } from "../waitlist/useWaitlistEntries";
import { useLivingExampleCapacityData } from "./useLivingExampleCapacityData";

// The dashboard's Living Example card.
//
// It said "18 / 12 active · 0 openings". Twelve of those eighteen were
// clients; six were people who had agreed to start in October and
// November. Both facts are worth showing — an already-sold slot is a real
// obligation — but they are different facts, and printing the sum as
// "active" made the only number on the card that Leif plans around the one
// number that was wrong.
export const LivingExampleCapacityCard = () => {
  const translate = useTranslate();
  const { isPending, offer, capacity } = useLivingExampleCapacityData();
  const { isPending: waitlistPending, entries: waitlist } = useWaitlistEntries({
    offerId: offer?.id,
    cohortId: null,
  });

  if (isPending || waitlistPending) return null;
  if (!offer || !capacity) return null;

  const programPath = `/programs/individual/${offer.id}`;
  const hasFooter = capacity.committedCount > 0 || capacity.nextOpening != null;

  return (
    <Card className="p-0">
      <CardContent className="p-0 flex flex-col">
        <Link
          to={programPath}
          className={`flex flex-col gap-1 p-6 hover:bg-accent/50 rounded-xl transition-colors ${
            hasFooter ? "pb-1 rounded-b-none" : ""
          }`}
        >
          <p className="text-sm font-medium">{offer.name}</p>
          <p className="text-2xl font-semibold">
            {capacity.active}
            {capacity.max != null && (
              <span className="text-muted-foreground text-lg">
                {" "}
                / {capacity.max}
              </span>
            )}
            <span className="text-sm text-muted-foreground font-normal">
              {" "}
              {translate("crm.dashboard.capacity_active", { _: "active" })}
            </span>
          </p>
          {capacity.overCapacityBy > 0 ? (
            // Over the ceiling is a real condition with a real name. The
            // old card clamped it to "0 openings", which reads as a full
            // practice rather than as a practice that has somehow taken on
            // more people than it has room for.
            <p className="text-sm text-destructive">
              {translate("crm.dashboard.capacity_over", {
                _: "%{count} over capacity",
                count: capacity.overCapacityBy,
              })}
            </p>
          ) : (
            capacity.openings != null && (
              <p className="text-sm text-muted-foreground">
                {translate("crm.dashboard.capacity_openings", {
                  _: "%{count} openings",
                  count: capacity.openings,
                })}
              </p>
            )
          )}
          {waitlist.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {translate("resources.waitlist_entries.count", {
                _: "%{count} waiting",
                count: waitlist.length,
              })}
            </p>
          )}
        </Link>
        {hasFooter && (
          <Link
            to={`${programPath}#upcoming-openings`}
            className="flex flex-col gap-0.5 text-sm text-muted-foreground hover:underline px-6 pb-6 pt-1"
          >
            {capacity.committedCount > 0 && (
              <span>
                {translate("crm.dashboard.capacity_committed", {
                  _: "%{count} starting later",
                  count: capacity.committedCount,
                })}
              </span>
            )}
            {capacity.nextOpening && (
              <span>
                {translate("crm.dashboard.next_opening_month", {
                  _: "Next opening: %{month}",
                  month: monthLabel(capacity.nextOpening.month),
                })}
              </span>
            )}
          </Link>
        )}
      </CardContent>
    </Card>
  );
};
