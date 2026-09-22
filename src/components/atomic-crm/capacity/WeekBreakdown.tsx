import { useTranslate } from "ra-core";

import { weekLabel } from "./monthLabel";
import {
  OccupancyBar,
  OccupancyLabel,
  SessionWeeksFound,
} from "./OccupancyBar";
import type { SlotHolder } from "./slotHolder";
import type { WeekCapacity } from "./weekCapacity";

// One `1:1s` week, week by week, with the names that move the numbers.
//
// Leif asked for exactly this: "I need to be able to click on one of those
// boxes and see a full breakdown of that calculation." A total he has to
// reverse-engineer names from is the same failure as a total with no unit.
//
// Stacked vertically at every width. A spreadsheet is not more readable on
// a phone for being smaller, and the desktop version of this reads fine as
// a list.
export const WeekBreakdown = ({ week }: { week: WeekCapacity }) => {
  const translate = useTranslate();

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {translate("crm.programs.week_of", {
            _: "Week of %{date}",
            date: weekLabel(week.week.start),
          })}
        </p>
        <OccupancyLabel occupancy={week.occupancy} max={week.max} />
      </div>

      <OccupancyBar occupancy={week.occupancy} max={week.max} />

      <PeopleLine
        label={translate("crm.programs.week_starting", { _: "Starting" })}
        people={week.starting}
        empty={translate("crm.programs.week_no_starts", { _: "No starts" })}
      />
      <PeopleLine
        label={translate("crm.programs.week_finishing", { _: "Finishing" })}
        people={week.finishing}
        empty={translate("crm.programs.week_no_finishes", {
          _: "No finishes",
        })}
      />

      <SafeStartAnswer week={week} />
    </li>
  );
};

const PeopleLine = ({
  label,
  people,
  empty,
}: {
  label: string;
  people: SlotHolder[];
  empty: string;
}) => (
  <p className="text-xs">
    <span className="text-muted-foreground">{label}: </span>
    {people.length === 0 ? (
      <span className="text-muted-foreground">{empty}</span>
    ) : (
      <span>{people.map((person) => person.name).join(", ")}</span>
    )}
  </p>
);

// "Could a new client start this week?" — answered, then justified from
// the same evaluation that produced the answer.
const SafeStartAnswer = ({ week }: { week: WeekCapacity }) => {
  const translate = useTranslate();
  const { answer, peak, holdsSlotUntil } = week.safeStart;

  if (answer.status === "unknown") {
    return (
      <div className="mt-1 flex flex-col gap-1.5 border-t pt-2">
        <p className="text-xs font-medium">
          {translate("crm.programs.safe_start_unknown", {
            _: "Can't tell yet whether someone could start this week",
          })}
        </p>
        <SessionWeeksFound
          scheduled={answer.weeksScheduled}
          required={answer.weeksRequired}
        />
        <p className="text-xs text-muted-foreground">
          {translate("crm.programs.safe_start_unknown_action", {
            _: "Add %{count} more 1:1 week to Year Tracking, then Sync Calendar. |||| Add %{count} more 1:1 weeks to Year Tracking, then Sync Calendar.",
            smart_count: Math.max(
              answer.weeksRequired - answer.weeksScheduled,
              1,
            ),
            count: Math.max(answer.weeksRequired - answer.weeksScheduled, 1),
          })}
        </p>
      </div>
    );
  }

  if (answer.openings > 0) {
    return (
      <div className="mt-1 border-t pt-2">
        <p className="text-xs font-medium">
          {translate("crm.programs.safe_start_yes", {
            _: "A new client could start this week",
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {translate("crm.programs.safe_start_yes_why", {
            _: "They stay at or below %{max} active clients every week through their 12th session, ending %{until}.",
            max: week.max,
            until: holdsSlotUntil ? weekLabel(holdsSlotUntil) : "—",
          })}
        </p>
      </div>
    );
  }

  // No. The reason is always the same shape — somebody already committed
  // would be in the programme at the same time — so it is stated with
  // their names rather than as a number Leif has to interpret.
  const blockers = peak?.contributors ?? [];
  return (
    <div className="mt-1 border-t pt-2">
      <p className="text-xs font-medium">
        {translate("crm.programs.safe_start_no", {
          _: "No — a new client could not start this week",
        })}
      </p>
      <p className="text-xs text-muted-foreground">
        {blockers.length > 0 && peak?.reachedOn
          ? translate("crm.programs.safe_start_no_why_names", {
              _: "Starting someone here would reach %{peak} active clients in the week of %{when}, because %{names} %{verb} already booked to start.",
              peak: answer.peakOccupancy,
              when: weekLabel(peak.reachedOn),
              names: blockers.map((person) => person.name).join(", "),
              verb: blockers.length === 1 ? "is" : "are",
            })
          : translate("crm.programs.safe_start_no_why_full", {
              _: "The programme is already at %{peak} of %{max} active clients for the whole of their 12 sessions.",
              peak: answer.peakOccupancy,
              max: week.max,
            })}
      </p>
    </div>
  );
};
