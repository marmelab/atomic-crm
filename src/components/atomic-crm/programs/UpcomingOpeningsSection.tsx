import { useState } from "react";
import { useTranslate } from "ra-core";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

import { AvailabilityAnswer } from "../capacity/AvailabilityAnswer";
import type { FutureOpenings } from "../capacity/individualCapacity";
import type { IndividualCapacity } from "../capacity/individualCapacity";
import { monthLabel, weekLabel } from "../capacity/monthLabel";
import { dayBefore } from "../capacity/sessionWeeks";
import { MonthBreakdownDialog } from "../capacity/MonthBreakdownDialog";
import { OccupancyBar, OccupancyLabel } from "../capacity/OccupancyBar";
import {
  capacityNow,
  describeAvailability,
  monthsFromWeeks,
  type MonthAvailability,
} from "../capacity/openingsNarrative";
import type { SlotHolder } from "../capacity/slotHolder";
import { SyncCalendarButton } from "../capacity/SyncCalendarButton";
import { weekCapacities } from "../capacity/weekCapacity";
import { Section } from "../misc/ProgramLayout";

// When Leif could safely commit another client.
//
// This section has been wrong in three ways now, and the third is the one
// that is easiest to repeat. It read Enrollment.end_date and said "no
// upcoming openings" forever. Then it counted departures net of arrivals
// and offered an opening that four November starts had already taken. Both
// were arithmetic faults and both were fixed.
//
// The third was not. The arithmetic was right and the screen still failed
// human acceptance, because it published the engine's internal state as
// the answer: "unknown — only 11 of 12 session weeks exist for a new
// client", "Peak 14 in the programme". Leif's reaction was the review:
// "I don't understand if I have any openings available or not, what
// unknown means, what 11 out of 12 means, or whether peak 14 means I have
// 14 people enrolled."
//
// So the order is now answer, then reason, then mechanism, then the thing
// he can do about it — and every month can be opened to see the weeks it
// was worked out from. None of that is calculated here: this file reads
// openingsNarrative.ts, which reads weekCapacity.ts, which reads the one
// occupancy ledger.
const names = (holders: SlotHolder[]) =>
  holders.map((holder) => holder.name).join(", ");

export const UpcomingOpeningsSection = ({
  capacity,
  futureOpenings,
  lastSyncedAt,
  now,
}: {
  capacity: IndividualCapacity;
  futureOpenings: FutureOpenings;
  lastSyncedAt?: string | null;
  now?: Date;
}) => {
  const translate = useTranslate();
  const [openMonth, setOpenMonth] = useState<MonthAvailability | null>(null);
  const { unknownEnd, unconfirmedStartWeek, needsCalendar } = futureOpenings;

  const weeks = weekCapacities(capacity, now);
  // The calendar's own end, not the end of whatever slice is on screen.
  const horizon = capacity.calendarHorizon
    ? dayBefore(capacity.calendarHorizon)
    : null;
  const availability = describeAvailability(weeks, horizon);
  const months = monthsFromWeeks(weeks, horizon);
  const current = capacityNow(capacity);

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
      {/* Where the practice is right now. Two numbers, never added
          together: twelve active plus six booked is not eighteen active,
          and presenting it as one number is how this board first lied. */}
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {translate("crm.programs.capacity_now", {
              _: "Right now",
            })}
          </p>
          {current.max != null && (
            <>
              <OccupancyLabel occupancy={current.active} max={current.max} />
              <OccupancyBar occupancy={current.active} max={current.max} />
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {translate("crm.programs.capacity_committed_plain", {
              _: "%{count} client already booked to start |||| %{count} clients already booked to start",
              smart_count: current.committed.length,
              count: current.committed.length,
            })}
          </p>
        </div>
        <div className="sm:text-right sm:max-w-[22rem]">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {translate("crm.programs.capacity_next", { _: "Next opening" })}
          </p>
          <AvailabilityAnswer availability={availability} variant="headline" />
        </div>
      </div>

      {unconfirmedStartWeek.length > 0 && (
        // The forecast is arithmetic on dates, and some of these dates
        // were inferred from a booked session — something the owner has
        // ruled out as evidence of when a programme begins.
        <p className="text-sm text-muted-foreground">
          {translate("crm.programs.openings_unconfirmed_starts", {
            _: "Provisional: %{count} start weeks below have not been confirmed by you.",
            count: unconfirmedStartWeek.length,
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
            <MonthCard
              key={month.month}
              month={month}
              onOpen={() => setOpenMonth(month)}
            />
          ))}
        </div>
      )}

      {unknownEnd.length > 0 && (
        // Not "no programme length to work one out from" — the 1:1
        // programme has a canonical length and it is twelve sessions. What
        // is missing is calendar, which is a different problem with a
        // different fix, and the old copy sent Leif looking for the wrong
        // one.
        <p className="mt-2 text-xs text-muted-foreground">
          {translate("crm.programs.openings_unknown_end", {
            _: "No finish date yet for %{names} — Year Tracking doesn't reach their 12th session week.",
            names: names(unknownEnd),
          })}
        </p>
      )}

      <MonthBreakdownDialog
        month={openMonth}
        onClose={() => setOpenMonth(null)}
      />
    </Section>
  );
};

// A month, answered before it is described.
//
// The whole card is a button. Leif asked to be able to click one of these
// boxes, and a div with an onClick is not something a keyboard or a screen
// reader can click.
const MonthCard = ({
  month,
  onOpen,
}: {
  month: MonthAvailability;
  onOpen: () => void;
}) => {
  const translate = useTranslate();
  const busiest = month.busiest;

  return (
    <Card className="p-0">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-start gap-3 rounded-xl p-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {monthLabel(month.month)}
            </p>

            <AvailabilityAnswer
              availability={month.availability}
              variant="card"
            />

            {busiest && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="text-xs text-muted-foreground">
                  {translate("crm.programs.busiest_week", {
                    _: "Busiest week (%{date}):",
                    date: weekLabel(busiest.week.start),
                  })}
                </span>
                <OccupancyLabel
                  occupancy={busiest.occupancy}
                  max={busiest.max}
                />
                <OccupancyBar occupancy={busiest.occupancy} max={busiest.max} />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {translate("crm.programs.month_starts_finishes", {
                _: "%{starts} starting · %{finishes} finishing",
                starts: month.starting.length,
                finishes: month.finishing.length,
              })}
              {month.starting.length > 0 && ` — ${names(month.starting)}`}
            </p>

            <span className="pt-0.5 text-xs font-medium text-primary">
              {translate("crm.programs.view_breakdown", {
                _: "View breakdown",
              })}
            </span>
          </div>
          <ChevronRight
            className="mt-1 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
      </CardContent>
    </Card>
  );
};
