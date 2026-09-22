import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

import { OpeningsLine } from "../capacity/OpeningsLine";
import type { Offer } from "../types";
import { useWaitlistEntries } from "../waitlist/useWaitlistEntries";
import { ProgramCardMenu } from "./ProgramCardMenu";
import { useIndividualProgramData } from "./useIndividualProgramData";

// A 1:1 program's summary card on the Programs hub (§6) — unlike the
// Dashboard's LivingExampleCapacityCard (which always highlights "the"
// Living Example), this one is driven by a specific Offer id so the hub
// correctly represents every 1:1 program, not just the first one found.
export const IndividualProgramCard = ({ offer }: { offer: Offer }) => {
  const translate = useTranslate();
  const { isPending, capacity } = useIndividualProgramData(offer.id);
  const { isPending: waitlistPending, entries: waitlist } = useWaitlistEntries({
    offerId: offer.id,
    cohortId: null,
  });

  if (isPending || waitlistPending || !capacity) return null;

  // No shared cohort date range here, deliberately. A 1:1 program has
  // no start or end of its own: each client has their own Start Week
  // and their own finish, derived from the Year Tracking calendar.
  // Printing one date range over all of them would be fiction.
  return (
    <Card className="p-0">
      <CardContent className="p-0 relative">
        <div className="absolute right-2 top-2 z-10">
          <ProgramCardMenu
            resource="offers"
            id={offer.id}
            name={offer.name}
            editPath={`/offers/${offer.id}`}
            // A 1:1 program leaves active use by being deactivated.
            archive={{ is_active: false }}
            archived={offer.is_active === false}
          />
        </div>
        <Link
          to={`/programs/individual/${offer.id}`}
          className="flex flex-col gap-1 p-6 hover:bg-accent/50 rounded-xl transition-colors"
        >
          <p className="text-sm font-medium pr-8">{offer.name}</p>
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
            <p className="text-sm text-destructive">
              {translate("crm.dashboard.capacity_over", {
                _: "%{count} over capacity",
                count: capacity.overCapacityBy,
              })}
            </p>
          ) : (
            capacity.openings != null && (
              <OpeningsLine openings={capacity.openings} />
            )
          )}
          {/* Agreed and not started. The hub shows the same two numbers
              the Dashboard does, because a card that shows only occupancy
              is the card that said "0 openings" with six people booked. */}
          {capacity.committed.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {translate("crm.dashboard.capacity_committed", {
                _: "%{count} starting later",
                count: capacity.committed.length,
              })}
            </p>
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
      </CardContent>
    </Card>
  );
};
