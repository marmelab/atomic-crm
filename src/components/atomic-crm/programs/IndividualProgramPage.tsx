import { useEffect } from "react";
import { useTranslate } from "ra-core";
import { Link, useLocation, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { enrollmentStatusLabels } from "../enrollments/enrollmentConstants";
import { useIndividualProgramData } from "./useIndividualProgramData";

// The Living Example (or any future 1:1 Offer's) program page — §8-9 of the
// Programs + Opportunity UX slice. A real user-facing page over the
// existing Offer + Enrollment data, not a new "Program" table.
export const IndividualProgramPage = () => {
  const { offerId } = useParams();
  const location = useLocation();
  const translate = useTranslate();
  const { isPending, offer, capacity, currentClients, upcomingOpenings } =
    useIndividualProgramData(offerId);

  // The Dashboard's "Next opening" link (LivingExampleCapacityCard.tsx)
  // points at this page's #upcoming-openings anchor. HashRouter's own `#`
  // means the browser never fires its native fragment-scroll for a
  // client-side route change, so it's done by hand once the content (and
  // the target element) actually exists.
  useEffect(() => {
    if (isPending || !location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ block: "start" });
  }, [isPending, location.hash]);

  if (isPending) return null;
  if (!offer) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          {translate("crm.programs.individual_not_found", {
            _: "This program could not be found.",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 mt-1 p-1 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">{offer.name}</h1>
        <p className="text-lg text-muted-foreground">
          {capacity?.active}
          {capacity?.max != null && <span> / {capacity.max}</span>}{" "}
          {translate("crm.dashboard.capacity_active", { _: "active" })}
          {capacity?.openings != null && (
            <span>
              {" · "}
              {translate("crm.dashboard.capacity_openings", {
                _: "%{count} openings",
                count: capacity.openings,
              })}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          {translate("crm.programs.current_clients", {
            _: "Current Clients",
          })}
        </h2>
        {currentClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.programs.no_current_clients", {
              _: "No current clients.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {currentClients.map((client) => (
              <Card key={client.enrollmentId}>
                <CardContent className="flex items-center justify-between py-3">
                  <Link
                    to={`/contacts/${client.contactId}/show`}
                    className="text-sm font-medium hover:underline"
                  >
                    {client.name}
                  </Link>
                  <Badge variant="outline">
                    {enrollmentStatusLabels[client.status]}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div id="upcoming-openings" className="flex flex-col gap-3 scroll-mt-4">
        <h2 className="text-xl font-semibold">
          {translate("crm.programs.upcoming_openings", {
            _: "Upcoming Openings",
          })}
        </h2>
        {upcomingOpenings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.programs.no_upcoming_openings", {
              _: "No upcoming openings.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingOpenings.map((opening) => (
              <Card key={opening.date}>
                <CardContent className="py-3">
                  <p className="text-sm font-medium">
                    {formatMonthDay(opening.date)}
                    {" — "}
                    {translate("crm.programs.opening_count", {
                      _: "%{count} opening |||| %{count} openings",
                      smart_count: opening.count,
                      count: opening.count,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {opening.clients
                      .map((client) =>
                        translate("crm.programs.opening_completes", {
                          _: "%{name} completes",
                          name: client.name,
                        }),
                      )
                      .join(", ")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

IndividualProgramPage.path = "/programs/individual/:offerId";

// Same UTC/local-safe formatting rationale as dashboard cards — see
// dashboard/LivingExampleCapacityCard.tsx.
const formatMonthDay = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};
