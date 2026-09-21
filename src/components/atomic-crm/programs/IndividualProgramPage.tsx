import { useEffect } from "react";
import { useTranslate } from "ra-core";
import { useLocation, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";

import type { SlotHolder } from "../capacity/individualCapacity";
import { monthLabel } from "../capacity/monthLabel";
import { PageHeader, PersonCard, Section } from "../misc/ProgramLayout";
import { formatISODateString } from "../deals/dealUtils";
import { enrollmentStatusLabels } from "../enrollments/enrollmentConstants";
import { CopyApplicationLinkButton } from "../public-application/CopyApplicationLinkButton";
import { LivingExampleApplicationPage } from "../public-application/LivingExampleApplicationPage";
import { AddToWaitlistButton } from "../waitlist/AddToWaitlistButton";
import { WaitlistSection } from "../waitlist/WaitlistSection";
import { useWaitlistEntries } from "../waitlist/useWaitlistEntries";
import { UpcomingOpeningsSection } from "./UpcomingOpeningsSection";
import { useIndividualProgramData } from "./useIndividualProgramData";

// The Living Example (or any future 1:1 Offer's) program page — a real
// user-facing page over the existing Offer + Enrollment data, not a new
// "Program" table.
export const IndividualProgramPage = () => {
  const { offerId } = useParams();
  const location = useLocation();
  const translate = useTranslate();
  const { isPending, offer, capacity, futureOpenings } =
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
              {capacity != null && capacity.overCapacityBy > 0 && (
                <span className="text-destructive">
                  {" · "}
                  {translate("crm.dashboard.capacity_over", {
                    _: "%{count} over capacity",
                    count: capacity.overCapacityBy,
                  })}
                </span>
              )}
              {capacity?.overCapacityBy === 0 && capacity.openings != null && (
                <span>
                  {" · "}
                  {translate("crm.dashboard.capacity_openings", {
                    _: "%{count} openings",
                    count: capacity.openings,
                  })}
                </span>
              )}
              {capacity != null && capacity.committed.length > 0 && (
                <span>
                  {" · "}
                  {translate("crm.dashboard.capacity_committed", {
                    _: "%{count} starting later",
                    count: capacity.committed.length,
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
        </div>
      </div>

      <Section
        title={translate("crm.programs.current_clients", {
          _: "Current Clients",
        })}
      >
        {capacity == null || capacity.occupied.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.programs.no_current_clients", {
              _: "No current clients.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {capacity.occupied.map((client) => (
              <SlotPersonCard key={client.enrollmentId} client={client} />
            ))}
          </div>
        )}
      </Section>

      {/* Agreed and set up, not started. Kept visually separate from
          Current Clients for the same reason the header no longer adds
          them together: an obligation is not an occupancy. */}
      {capacity != null && capacity.committed.length > 0 && (
        <Section
          title={translate("crm.programs.starting_later", {
            _: "Starting Later",
          })}
        >
          <div className="flex flex-col gap-2">
            {capacity.committed.map((client) => (
              <SlotPersonCard key={client.enrollmentId} client={client} />
            ))}
          </div>
        </Section>
      )}

      {futureOpenings != null && (
        <UpcomingOpeningsSection futureOpenings={futureOpenings} />
      )}

      <WaitlistSection
        entries={waitlist}
        offerId={offer.id}
        offerName={offer.name}
        cohortId={null}
        // The waitlist is where Leif adds the person who just messaged him
        // on Instagram, so the control belongs at the waitlist, not only
        // in the page header three sections up.
        action={<AddToWaitlistButton offerId={offer.id} cohortId={null} />}
        // Availability, stated beside the people waiting for it, because
        // the two questions are always asked together. It reports and
        // never acts: nobody is invited, moved, or emailed from here.
        availability={availabilityLine(capacity, translate)}
      />
    </div>
  );
};

const SlotPersonCard = ({ client }: { client: SlotHolder }) => {
  const translate = useTranslate();
  return (
    <PersonCard
      contactId={client.contactId}
      // The CRM never invents a name; when it genuinely does not know
      // one, it says so rather than rendering a blank row.
      name={
        client.name ||
        translate("crm.programs.unnamed_client", { _: "an unnamed client" })
      }
      // The dates the row is about, said plainly: a recorded end gets its
      // day, a worked-out one gets its month and the word "expected".
      meta={
        client.startDate
          ? client.end.basis === "recorded"
            ? translate("crm.programs.runs_until", {
                _: "%{start} — ends %{end}",
                start: formatISODateString(client.startDate),
                end: formatISODateString(client.end.date!),
              })
            : client.end.basis === "projected"
              ? translate("crm.programs.runs_expected", {
                  _: "%{start} — expected to end %{month}",
                  start: formatISODateString(client.startDate),
                  month: monthLabel(client.end.date!.slice(0, 7)),
                })
              : translate("crm.programs.starts_only", {
                  _: "Starts %{start}",
                  start: formatISODateString(client.startDate),
                })
          : translate("crm.programs.no_start_recorded", {
              _: "Start date not set",
            })
      }
      trailing={
        <Badge variant="outline">{enrollmentStatusLabels[client.status]}</Badge>
      }
    />
  );
};

// One short sentence about whether there is room, for the top of the
// waitlist. Deliberately a fact and nothing more — see Part I: who gets an
// opening is Leif's decision, and this line never makes it.
const availabilityLine = (
  capacity: ReturnType<typeof useIndividualProgramData>["capacity"],
  translate: ReturnType<typeof useTranslate>,
): string | null => {
  if (capacity == null || capacity.max == null) return null;
  if (capacity.overCapacityBy > 0) {
    return translate("crm.programs.waitlist_over_capacity", {
      _: "%{active} of %{max} slots filled — %{over} over capacity.",
      active: capacity.active,
      max: capacity.max,
      over: capacity.overCapacityBy,
    });
  }
  if (capacity.openings != null && capacity.openings > 0) {
    return translate("crm.programs.waitlist_openings_now", {
      _: "%{count} opening now (%{active} of %{max} filled).",
      count: capacity.openings,
      active: capacity.active,
      max: capacity.max,
    });
  }
  return translate("crm.programs.waitlist_full", {
    _: "Full — %{active} of %{max} slots filled.",
    active: capacity.active,
    max: capacity.max,
  });
};

IndividualProgramPage.path = "/programs/individual/:offerId";
