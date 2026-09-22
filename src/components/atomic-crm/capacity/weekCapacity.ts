import {
  explainSafeStart,
  peakBetween,
  type SafeStartExplanation,
  type SlotEvent,
} from "./occupancyLedger";
import { dayBefore, type SessionWeek } from "./sessionWeeks";
import type { SlotHolder } from "./slotHolder";
import { toDateKey } from "./slotOccupancy";

// The practice, one `1:1s` week at a time.
//
// A month is the wrong unit to answer "can I take somebody?" with, and
// answering it monthly is what made the board unreadable. Asked only of
// the 1st of December, the CRM can say "no opening in December" while the
// week of the 21st is perfectly safe — and a person reading that has no
// way to tell the difference between "December is full" and "the first of
// December happens to be full".
//
// Weeks are also the unit Leif already thinks in, because they are the
// unit Year Tracking is kept in. Every row here is one of his own `1:1s`
// weeks.
//
// Nothing in this file decides anything. Occupancy, the peak, and whether
// a new client could start are all answered by occupancyLedger.ts from the
// one event sequence; this arranges those answers by week so a screen can
// show them. That is the whole point of it existing: the summary, the
// month card, the drilldown and the weekly bars are four views of ONE
// evaluation, not four calculations that happen to agree today.
export type WeekCapacity = {
  week: SessionWeek;
  // The week's last real day. `week.end` is exclusive.
  lastDay: string;
  // The most people in the programme at any moment during this week.
  occupancy: number;
  max: number;
  // How far past the ceiling that goes. Zero unless something has been
  // committed that the ceiling does not cover.
  overBy: number;
  // The people whose containers begin and end inside this week.
  starting: SlotHolder[];
  finishing: SlotHolder[];
  // Could ONE more client start this week and stay inside the ceiling for
  // the whole of their own twelve session weeks? With the working.
  safeStart: SafeStartExplanation;
};

const inWeek = (event: SlotEvent, week: SessionWeek) =>
  event.date >= week.start && event.date < week.end;

// Just enough of a practice to evaluate it, named structurally rather
// than as IndividualCapacity so that individualCapacity.ts can use this
// without the two importing each other.
export type EvaluableCapacity = {
  max: number | null;
  active: number;
  events: SlotEvent[];
  weeks: SessionWeek[];
};

// Every eligible week from `today` onward, in order.
//
// Weeks that have already finished are dropped: a capacity board answers
// what Leif can do next, and an opening he could have sold in June is not
// a fact he can act on.
export const weekCapacities = (
  capacity: EvaluableCapacity,
  now: Date = new Date(),
): WeekCapacity[] => {
  const { max, events, active, weeks } = capacity;
  if (max == null) return [];

  const today = toDateKey(now);

  return weeks
    .filter((week) => week.end > today)
    .slice()
    .sort(
      (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
    )
    .map((week) => {
      const lastDay = dayBefore(week.end);
      const peak = peakBetween(events, active, week.start, lastDay);
      // A candidate cannot start in the past, so the week containing today
      // is tested from today rather than from its Monday.
      const candidateStart = week.start < today ? today : week.start;

      return {
        week,
        lastDay,
        occupancy: peak.peak,
        max,
        overBy: Math.max(peak.peak - max, 0),
        starting: events
          .filter((event) => event.kind === "start" && inWeek(event, week))
          .map((event) => event.holder),
        finishing: events
          .filter((event) => event.kind === "end" && inWeek(event, week))
          .map((event) => event.holder),
        safeStart: explainSafeStart(events, active, max, candidateStart, weeks),
      };
    });
};

// Whether a week is one Leif could actually sell.
//
// Deliberately not "is this week below the ceiling". A week holding eleven
// people has room in it, and that is not the same question: if somebody
// already committed starts a fortnight later, putting a new twelve-week
// client into that gap takes the practice to thirteen inside their own
// container. The temporary space is real and the opening is not.
export const isSafeOpening = (week: WeekCapacity): boolean =>
  week.safeStart.answer.status === "known" &&
  week.safeStart.answer.openings > 0;

export const monthOfWeek = (week: WeekCapacity): string =>
  week.week.start.slice(0, 7);
