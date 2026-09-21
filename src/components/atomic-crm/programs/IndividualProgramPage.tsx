import { useEffect } from "react";
import { useTranslate } from "ra-core";
import { useLocation, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";

import type { SlotHolder } from "../capacity/individualCapacity";
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
  const { isPending, offer, capacity, futureOpenings, lastSyncedAt } =
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
              {capacity != null && capacity.unconfirmedStartWeek.length > 0 && (
                <span>
                  {" · "}
                  {translate("crm.programs.start_weeks_to_confirm", {
                    _: "%{count} start weeks to confirm",
                    count: capacity.unconfirmedStartWeek.length,
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
        <UpcomingOpeningsSection
          futureOpenings={futureOpenings}
          lastSyncedAt={lastSyncedAt}
        />
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

// A Start Week and a final session week, said the way Leif works.
//
// The Living Example is twelve sessions across his available `1:1s`
// weeks, so the end is a WEEK on the Year Tracking calendar, not a date
// four months after the start. When the calendar has not been filled far
// enough ahead the row says exactly that, with the count, rather than
// showing a date nobody can stand behind.
const startWeekLine = (
  client: SlotHolder,
  translate: ReturnType<typeof useTranslate>,
): string => {
  if (!client.startDate) {
    return translate("crm.programs.start_week_not_set", {
      _: "Start week not set",
    });
  }
  const parts = [
    translate("crm.programs.starts_on", {
      _: "Starts %{start}",
      start: formatISODateString(client.startDate),
    }),
  ];
  if (client.end?.status === "known") {
    parts.push(
      translate("crm.programs.final_session_week", {
        _: "expected final session week %{week}",
        week: formatISODateString(client.end.finalWeek.start),
      }),
    );
    if (client.end.extensions > 0) {
      parts.push(
        translate("crm.programs.reschedule_extensions", {
          _: "+%{count} week for a reschedule |||| +%{count} weeks for reschedules",
          smart_count: client.end.extensions,
          count: client.end.extensions,
        }),
      );
    }
  } else if (client.end?.status === "incomplete") {
    parts.push(
      translate("crm.programs.end_unavailable", {
        _: "end unavailable — %{scheduled} of %{required} session weeks scheduled",
        scheduled: client.end.weeksScheduled,
        required: client.end.weeksRequired,
      }),
    );
  }
  if (!client.startWeekConfirmed) {
    parts.push(
      translate("crm.programs.start_week_unconfirmed", {
        _: "start week not confirmed",
      }),
    );
  }
  return parts.join(" · ");
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
      meta={startWeekLine(client, translate)}
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
  if (capacity.openings?.status === "unknown") {
    // Full or not, nobody can be started until the calendar reaches far
    // enough to hold their twelve session weeks. Saying "Full" here would
    // be the wrong reason for the right answer.
    return translate("crm.programs.waitlist_needs_calendar", {
      _: "%{active} of %{max} filled — availability unknown until Year Tracking covers %{required} session weeks (%{scheduled} so far).",
      active: capacity.active,
      max: capacity.max,
      scheduled: capacity.openings.weeksScheduled,
      required: capacity.openings.weeksRequired,
    });
  }
  if (capacity.openings != null && capacity.openings.openings > 0) {
    return translate("crm.programs.waitlist_openings_now", {
      _: "%{count} opening now (%{active} of %{max} filled).",
      count: capacity.openings.openings,
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
