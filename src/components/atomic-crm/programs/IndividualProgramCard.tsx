import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

import type { Offer } from "../types";
import { useWaitlistEntries } from "../waitlist/useWaitlistEntries";
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

  return (
    <Card className="p-0">
      <CardContent className="p-0">
        <Link
          to={`/programs/individual/${offer.id}`}
          className="flex flex-col gap-1 p-6 hover:bg-accent/50 rounded-xl transition-colors"
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
          {capacity.openings != null && (
            <p className="text-sm text-muted-foreground">
              {translate("crm.dashboard.capacity_openings", {
                _: "%{count} openings",
                count: capacity.openings,
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
