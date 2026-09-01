import { useEffect } from "react";
import { useTranslate } from "ra-core";
import { useLocation, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { PageHeader, PersonCard, Section } from "../misc/ProgramLayout";
import { formatMonthDayString } from "../deals/dealUtils";
import { enrollmentStatusLabels } from "../enrollments/enrollmentConstants";
import { CopyApplicationLinkButton } from "../public-application/CopyApplicationLinkButton";
import { LivingExampleApplicationPage } from "../public-application/LivingExampleApplicationPage";
import { AddToWaitlistButton } from "../waitlist/AddToWaitlistButton";
import { WaitlistSection } from "../waitlist/WaitlistSection";
import { useWaitlistEntries } from "../waitlist/useWaitlistEntries";
import { useIndividualProgramData } from "./useIndividualProgramData";

// The Living Example (or any future 1:1 Offer's) program page — §8-9 of the
// Programs + Opportunity UX slice. A real user-facing page over the
// existing Offer + Enrollment data, not a new "Program" table. Its visual
// language (PageHeader/Section/PersonCard from misc/ProgramLayout.tsx) is
// the reference the Runtime + Visual Consistency slice carries to the GYU
// Cohort page and beyond.
export const IndividualProgramPage = () => {
  const { offerId } = useParams();
  const location = useLocation();
  const translate = useTranslate();
  const { isPending, offer, capacity, currentClients, upcomingOpenings } =
    useIndividualProgramData(offerId);
  const { isPending: waitlistPending, entries: waitlist } = useWaitlistEntries({
    offerId,
    cohortId: null,
  });

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

  if (isPending || waitlistPending) return null;
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
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={offer.name}
          summary={
            <>
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
              {waitlist.length > 0 && (
                <span>
                  {" · "}
                  {translate("resources.waitlist_entries.count", {
                    _: "%{count} waiting",
                    count: waitlist.length,
                  })}
                </span>
              )}
            </>
          }
        />
        <div className="flex items-center gap-2">
          <CopyApplicationLinkButton
            path={LivingExampleApplicationPage.path}
            label={offer.name}
          />
          <AddToWaitlistButton offerId={offer.id} cohortId={null} />
        </div>
      </div>

      <Section
        title={translate("crm.programs.current_clients", {
          _: "Current Clients",
        })}
      >
        {currentClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.programs.no_current_clients", {
              _: "No current clients.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {currentClients.map((client) => (
              <PersonCard
                key={client.enrollmentId}
                contactId={client.contactId}
                name={client.name}
                trailing={
                  <Badge variant="outline">
                    {enrollmentStatusLabels[client.status]}
                  </Badge>
                }
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        id="upcoming-openings"
        title={translate("crm.programs.upcoming_openings", {
          _: "Upcoming Openings",
        })}
      >
        {upcomingOpenings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.programs.no_upcoming_openings", {
              _: "No upcoming openings.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingOpenings.map((opening) => (
              <Card key={opening.date} className="p-0">
                <CardContent className="px-4 py-2.5">
                  <p className="text-sm font-medium">
                    {formatMonthDayString(opening.date)}
                    {" — "}
                    {translate("crm.programs.opening_count", {
                      _: "%{count} opening |||| %{count} openings",
                      smart_count: opening.count,
                      count: opening.count,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
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
      </Section>

      <WaitlistSection entries={waitlist} />
    </div>
  );
};

IndividualProgramPage.path = "/programs/individual/:offerId";
