import type { IndividualCapacity } from "./individualCapacity";
import type { SlotHolder } from "./slotHolder";
import { isSafeOpening, monthOfWeek, type WeekCapacity } from "./weekCapacity";

// The answer, in the form Leif asked for it.
//
// Human acceptance failed on this screen, and not because the arithmetic
// was wrong. It said:
//
//   "October 2026 — unknown — only 11 of 12 session weeks exist for a new
//    client"  ...  "Peak 14 in the programme"
//
// and Leif said: "I don't understand if I have any openings available or
// not, what unknown means, what 11 out of 12 means, or whether peak 14
// means I have 14 people enrolled."
//
// Every one of those words was true. None of them was an answer. "unknown"
// is the engine's word for its own state; "11 of 12" is the mechanism;
// "peak 14" is a number with no unit attached. The screen was showing its
// working and calling it a conclusion.
//
// So this module exists to turn the canonical evaluation into a sentence,
// and to keep the mechanism underneath it rather than in front of it:
//
//   ANSWER   Can I take another client, and when?
//   WHY      Because of these people, on these dates.
//   DETAIL   11 of the 12 weeks needed currently exist.
//   ACTION   Add 1:1 weeks to Year Tracking, then Sync Calendar.
//
// It computes nothing. Every fact below is read off weekCapacity.ts, which
// reads them off the one occupancy ledger.

export type Availability =
  | {
      kind: "safe_opening";
      // The earliest week a new client could start and stay inside the
      // ceiling for the whole of their own twelve session weeks.
      week: WeekCapacity;
      openings: number;
    }
  | {
      kind: "no_opening";
      // The last week the CRM could actually test. Beyond it the calendar
      // runs out, and "no opening" would be a claim rather than a finding.
      testedThrough: string | null;
      // Whether there are further weeks it could not test.
      calendarRunsOut: boolean;
      horizon: string | null;
    }
  | {
      kind: "cannot_calculate";
      horizon: string | null;
      // The nearest week to a full container, so the detail line can say
      // how far off the calendar is rather than only that it is short.
      weeksScheduled: number;
      weeksRequired: number;
    };

export type CapacityNow = {
  active: number;
  max: number | null;
  overBy: number;
  // Future Enrollments with an owner Start Date. Kept separate from
  // `active` on purpose — twelve now plus six booked is not eighteen
  // active, and presenting it as one number is how this board first went
  // wrong.
  committed: SlotHolder[];
};

export const capacityNow = (capacity: IndividualCapacity): CapacityNow => ({
  active: capacity.active,
  max: capacity.max,
  overBy: capacity.overCapacityBy,
  committed: capacity.committed,
});

// The one sentence at the top of the section, and — asked about one
// month's weeks — the one on each card.
//
// `horizon` is passed in rather than taken from `weeks`, and that is not a
// detail. Derived from the weeks it was given, a month card would announce
// its own last week as the end of Year Tracking: the October card said
// "Year Tracking ends Oct 21" while the calendar ran to late January. The
// horizon is a fact about the calendar, not about the slice of it being
// looked at.
export const describeAvailability = (
  weeks: WeekCapacity[],
  horizon: string | null,
): Availability => {
  const opening = weeks.find(isSafeOpening);
  if (opening && opening.safeStart.answer.status === "known") {
    return {
      kind: "safe_opening",
      week: opening,
      openings: opening.safeStart.answer.openings,
    };
  }

  const testable = weeks.filter(
    (week) => week.safeStart.answer.status === "known",
  );

  // Nothing could be tested at all: every candidate week runs past the end
  // of Year Tracking before its twelfth session. That is not "no opening",
  // and saying so would be the CRM claiming to know something it cannot.
  if (testable.length === 0) {
    const nearest = weeks
      .map((week) => week.safeStart.answer)
      .filter((answer) => answer.status === "unknown")
      .sort((a, b) =>
        a.status === "unknown" && b.status === "unknown"
          ? b.weeksScheduled - a.weeksScheduled
          : 0,
      )[0];

    return {
      kind: "cannot_calculate",
      horizon,
      weeksScheduled:
        nearest && nearest.status === "unknown" ? nearest.weeksScheduled : 0,
      weeksRequired:
        nearest && nearest.status === "unknown" ? nearest.weeksRequired : 12,
    };
  }

  return {
    kind: "no_opening",
    testedThrough: testable[testable.length - 1]?.lastDay ?? null,
    calendarRunsOut: testable.length < weeks.length,
    horizon,
  };
};

// One month, answered the same way and from the same weeks.
export type MonthAvailability = {
  month: string;
  weeks: WeekCapacity[];
  availability: Availability;
  // Everyone whose container begins or ends in this month, in week order.
  starting: SlotHolder[];
  finishing: SlotHolder[];
  // The busiest week in the month, against the ceiling.
  busiest: WeekCapacity | null;
};

export const monthsFromWeeks = (
  weeks: WeekCapacity[],
  horizon: string | null,
): MonthAvailability[] => {
  const byMonth = new Map<string, WeekCapacity[]>();
  for (const week of weeks) {
    const month = monthOfWeek(week);
    byMonth.set(month, [...(byMonth.get(month) ?? []), week]);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthWeeks]) => ({
      month,
      weeks: monthWeeks,
      // The same function the headline uses, asked about fewer weeks. A
      // month card and the sentence above it cannot disagree, because
      // there is only one way either of them can be produced.
      availability: describeAvailability(monthWeeks, horizon),
      starting: monthWeeks.flatMap((week) => week.starting),
      finishing: monthWeeks.flatMap((week) => week.finishing),
      busiest: monthWeeks.reduce<WeekCapacity | null>(
        (busiest, week) =>
          busiest == null || week.occupancy > busiest.occupancy
            ? week
            : busiest,
        null,
      ),
    }));
};
