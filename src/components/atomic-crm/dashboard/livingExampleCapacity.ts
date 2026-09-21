// The dashboard's view of an individual Offer's capacity.
//
// This file used to hold its own copy of "active" — a set of three status
// strings, dates ignored. It was one of three such copies, and the reason
// the dashboard reported "18 / 12 active · 0 openings" from the same rows
// the Clients list was correctly showing as twelve current clients and six
// people who had not started yet.
//
// There is one rule now, in capacity/slotOccupancy.ts, and everything
// asks it. What remains here is only the shaping the dashboard card needs.
import {
  computeFutureOpenings,
  computeIndividualCapacity,
  type IndividualCapacity,
  type SlotEnrollment,
} from "../capacity/individualCapacity";

export type NextOpening = {
  // YYYY-MM of the first month in which Leif could safely start somebody
  // new.
  month: string;
  // How many he could start that month.
  count: number;
  // Whether that answer depends on a Start Week nobody has confirmed.
  restsOnUnconfirmedDates: boolean;
};

export type LivingExampleCapacity = IndividualCapacity & {
  nextOpening: NextOpening | null;
  // Agreed, set up, not started. Shown as its own number because it is a
  // different fact from "active", and conflating them is what broke this
  // card.
  committedCount: number;
  // How many Start Weeks in the picture Leif has never stated.
  unconfirmedStartWeekCount: number;
};

export const computeLivingExampleCapacity = (
  enrollments: SlotEnrollment[],
  max: number | null,
  durationMonths: number | null,
  now: Date = new Date(),
): LivingExampleCapacity => {
  const capacity = computeIndividualCapacity(
    enrollments,
    max,
    durationMonths,
    now,
  );
  const { months } = computeFutureOpenings(capacity, now);

  // The first month Leif could actually start somebody new and still be
  // within the ceiling for the whole of their programme — not the first
  // month a slot happens to come free. Three containers finish in October
  // 2026 and none of them is an opening, because four people arrive on 8
  // November.
  const firstFree = months.find((month) => month.openings > 0);

  return {
    ...capacity,
    committedCount: capacity.committed.length,
    unconfirmedStartWeekCount: capacity.unconfirmedStartWeek.length,
    nextOpening: firstFree
      ? {
          month: firstFree.month,
          count: firstFree.openings,
          restsOnUnconfirmedDates: months
            .slice(0, months.indexOf(firstFree) + 1)
            .some((month) => month.restsOnUnconfirmedDates),
        }
      : null,
  };
};
