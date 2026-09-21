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
  // YYYY-MM of the first month in which a slot actually becomes free.
  month: string;
  // Slots free once that month's departures AND its already-agreed
  // arrivals have both happened. Never a promise Leif has already made to
  // somebody else.
  count: number;
};

export type LivingExampleCapacity = IndividualCapacity & {
  nextOpening: NextOpening | null;
  // Agreed, set up, not started. Shown as its own number because it is a
  // different fact from "active", and conflating them is what broke this
  // card.
  committedCount: number;
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

  // The first month that leaves Leif with somewhere to put somebody. A
  // month where two clients finish and two others start frees nothing, and
  // saying otherwise would invite him to sell a slot twice.
  const firstFree = months.find((month) => month.netAvailableAfter > 0);

  return {
    ...capacity,
    committedCount: capacity.committed.length,
    nextOpening: firstFree
      ? { month: firstFree.month, count: firstFree.netAvailableAfter }
      : null,
  };
};
