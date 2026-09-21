import { useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import type {
  FutureOpenings,
  OpeningsMonth,
  SlotHolder,
} from "../capacity/individualCapacity";
import { monthLabel } from "../capacity/monthLabel";
import { SyncCalendarButton } from "../capacity/SyncCalendarButton";
import { Section } from "../misc/ProgramLayout";

// When Leif could safely commit another client.
//
// This section has now been wrong in two different directions, and both
// are worth remembering because they are the two ways a capacity board
// lies.
//
// It read Enrollment.end_date, which is null for every Living Example
// client, so it said "No upcoming openings." forever while three people
// were due to finish in October — a board that under-reports until you
// stop believing it.
//
// Then it counted departures net of arrivals month by month and called
// the running total an opening. October came out at +1. Four people start
// on 8 November; filling that "opening" would have taken the practice to
// sixteen — a board that over-reports, which is worse, because acting on
// it means telling somebody their start is cancelled.
//
// So a month shows an opening only if a client could start in it AND be
// there at the end of their four months without the ceiling ever
// breaking.
const names = (holders: SlotHolder[]) =>
  holders.map((holder) => holder.name).join(", ");

export const UpcomingOpeningsSection = ({
  futureOpenings,
  lastSyncedAt,
}: {
  futureOpenings: FutureOpenings;
  lastSyncedAt?: string | null;
}) => {
  const translate = useTranslate();
  const {
    months,
    unknownEnd,
    unconfirmedStartWeek,
    needsCalendar,
    calendarHorizon,
  } = futureOpenings;

  return (
    <Section
      id="upcoming-openings"
      title={translate("crm.programs.upcoming_openings", {
        _: "Upcoming Openings",
      })}
      // Every date below comes from Year Tracking, so the control that
      // refreshes it belongs here rather than somewhere else on the page.
      action={
        <SyncCalendarButton
          lastSyncedAt={lastSyncedAt}
          stillShortFor={needsCalendar.length}
        />
      }
    >
      {unconfirmedStartWeek.length > 0 && (
        // The forecast is arithmetic on dates, and most of these dates
        // were inferred from a booked session — something the owner has
        // ruled out as evidence of when a programme begins. Saying so
        // above the months is the difference between a projection and a
        // claim.
        <p className="text-sm text-muted-foreground">
          {translate("crm.programs.openings_unconfirmed_starts", {
            _: "Provisional: %{count} start weeks below have not been confirmed by you.",
            count: unconfirmedStartWeek.length,
          })}
        </p>
      )}
      {needsCalendar.length > 0 && (
        // The single most actionable thing on this section. Year Tracking
        // stops before these containers reach their twelfth session week,
        // so their ends are genuinely unknown — and an unknown end holds a
        // slot, which is usually why a month below shows no opening. A few
        // more `1:1s` weeks in the calendar answers all of it at once.
        <p className="text-sm text-muted-foreground">
          {translate("crm.programs.openings_need_calendar", {
            _: "Year Tracking reaches %{horizon}. Until it goes further, no end can be worked out for: %{names}.",
            horizon: calendarHorizon ?? "—",
            names: names(needsCalendar),
          })}
        </p>
      )}
      {months.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.programs.no_upcoming_openings", {
            _: "No upcoming openings.",
          })}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {months.map((month) => (
            <MonthRow key={month.month} month={month} />
          ))}
        </div>
      )}
      {unknownEnd.length > 0 && (
        // The projection is knowingly incomplete, and says by how much.
        <p className="mt-2 text-xs text-muted-foreground">
          {translate("crm.programs.openings_unknown_end", {
            _: "Not included: %{names} — no end date, and no programme length to work one out from.",
            names: names(unknownEnd),
          })}
        </p>
      )}
    </Section>
  );
};

const MonthRow = ({ month }: { month: OpeningsMonth }) => {
  const translate = useTranslate();

  return (
    <Card className="p-0">
      <CardContent className="px-4 py-2.5 flex flex-col gap-0.5">
        <p className="text-sm font-medium">
          {monthLabel(month.month)}
          {" — "}
          {month.openings.status === "unknown" ? (
            // Not zero. Whether somebody could start here is a question
            // the CRM cannot answer until Year Tracking reaches far
            // enough to seat their own twelve session weeks.
            <span>
              {translate("crm.programs.opening_needs_calendar", {
                _: "unknown — only %{scheduled} of %{required} session weeks exist for a new client",
                scheduled: month.openings.weeksScheduled,
                required: month.openings.weeksRequired,
              })}
            </span>
          ) : month.openings.openings > 0 ? (
            translate("crm.programs.opening_count", {
              _: "%{count} opening |||| %{count} openings",
              smart_count: month.openings.openings,
              count: month.openings.openings,
            })
          ) : month.overCapacityBy > 0 ? (
            <span className="text-destructive">
              {translate("crm.programs.opening_over_committed", {
                _: "no opening — %{count} over capacity at its peak",
                count: month.overCapacityBy,
              })}
            </span>
          ) : (
            translate("crm.programs.opening_none", { _: "no opening" })
          )}
        </p>
        {month.freeing.length > 0 && (
          <p className="text-xs text-muted-foreground truncate">
            {translate("crm.programs.opening_completes", {
              _: "%{names} expected to finish",
              names: names(month.freeing),
            })}
          </p>
        )}
        {month.committing.length > 0 && (
          <p className="text-xs text-muted-foreground truncate">
            {translate("crm.programs.opening_starts", {
              _: "%{names} already booked to start",
              names: names(month.committing),
            })}
          </p>
        )}
        {/* Why a month with three people finishing can still be no
            opening: the peak is what the ceiling has to survive. */}
        <p className="text-xs text-muted-foreground">
          {translate("crm.programs.opening_peak", {
            _: "Peak %{peak} in the programme",
            peak: month.peakOccupancy,
          })}
          {month.restsOnUnconfirmedDates && (
            <>
              {" · "}
              {translate("crm.programs.opening_provisional", {
                _: "start weeks unconfirmed",
              })}
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
};
