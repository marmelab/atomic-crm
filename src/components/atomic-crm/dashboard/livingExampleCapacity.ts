// The dashboard's view of an individual Offer's capacity.
//
// This file used to hold its own copy of "active" — a set of three status
// strings, dates ignored. It was one of three such copies, and the reason
// the dashboard reported "18 / 12 active · 0 openings" from the same rows
// the Clients list was correctly showing as twelve current clients and six
// people who had not started yet.
//
// There is one rule now, in capacity/, and everything asks it. What
// remains here is only the shaping the dashboard card needs.
import {
  computeFutureOpenings,
  computeIndividualCapacity,
  type IndividualCapacity,
  type SlotEnrollment,
} from "../capacity/individualCapacity";
import type { SessionWeek } from "../capacity/sessionWeeks";

export type NextOpening = {
  // YYYY-MM of the first month in which Leif could safely start somebody
  // new — the ceiling holding for their whole container, and their twelve
  // session weeks existing on the calendar.
  month: string;
  count: number;
  restsOnUnconfirmedDates: boolean;
};

export type LivingExampleCapacity = IndividualCapacity & {
  nextOpening: NextOpening | null;
  // Agreed, set up, not started. Its own number because it is a different
  // fact from "active", and conflating them is what broke this card.
  committedCount: number;
  unconfirmedStartWeekCount: number;
  // How many people's containers cannot be ended because Year Tracking
  // stops too early. While this is non-zero the forecast has a floor it
  // cannot see past, and the card says so instead of implying room.
  needsCalendarCount: number;
};

export const computeLivingExampleCapacity = (
  enrollments: SlotEnrollment[],
  max: number | null,
  weeks: SessionWeek[],
  now: Date = new Date(),
): LivingExampleCapacity => {
  const capacity = computeIndividualCapacity(enrollments, max, weeks, now);
  const { months } = computeFutureOpenings(capacity, now);

  // The first month Leif could actually start somebody new. Not the first
  // month a slot happens to come free: three containers finish in October
  // 2026 and none of them is an opening, because four people arrive on 8
  // November.
  const firstFree = months.find(
    (month) => month.openings.status === "known" && month.openings.openings > 0,
  );

  return {
    ...capacity,
    committedCount: capacity.committed.length,
    unconfirmedStartWeekCount: capacity.unconfirmedStartWeek.length,
    needsCalendarCount: capacity.needsCalendar.length,
    nextOpening:
      firstFree && firstFree.openings.status === "known"
        ? {
            month: firstFree.month,
            count: firstFree.openings.openings,
            restsOnUnconfirmedDates: months
              .slice(0, months.indexOf(firstFree) + 1)
              .some((month) => month.restsOnUnconfirmedDates),
          }
        : null,
  };
};
