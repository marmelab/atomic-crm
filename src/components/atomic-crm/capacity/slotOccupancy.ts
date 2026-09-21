import type { Enrollment } from "../types";
import { classifyEnrollment } from "../enrollments/classifyEnrollment";

// THE rule for whether an Enrollment is consuming one of an individual
// Offer's concurrent client slots. One definition, used by every surface
// that shows a capacity number.
//
// It had three.
//
// The Clients list already asked the right question — classifyEnrollment.ts
// reads start_date, end_date, the terminal statuses and today, and its own
// header names the case that forced it: Daniel Alexander, agreed and set up
// with a container starting 8 November, appearing under Current Clients
// seven weeks early. But the dashboard capacity card, the program page and
// this rule each kept their OWN copy of "active", and those copies looked
// only at the status column. So the Clients list said twelve current
// clients while the dashboard said "18 / 12 active · 0 openings", from the
// same rows, on the same screen.
//
// Six of those eighteen had not started. The card was not counting clients;
// it was counting agreements. Nothing was wrong with the data.
//
// So there is now one rule, and it is the one that was already right.
// classifyEnrollment is the authority; this module names what its phases
// MEAN for capacity, and everything else asks here.

export type SlotPhase = "occupied" | "committed" | "released";

// A container that is running right now occupies a slot. One that has been
// agreed but not started is COMMITTED — a real obligation Leif cannot sell
// twice, but not somebody he is working with today. Terminal or finished
// containers have released theirs.
//
// An Enrollment with no start_date at all counts as occupied, matching
// classifyEnrollment exactly: it is live work whose date was never
// recorded, and hiding it would undercount a real person.
export const slotPhaseOf = (
  enrollment: Pick<Enrollment, "status" | "start_date" | "end_date">,
  today?: string,
): SlotPhase => {
  const phase = classifyEnrollment(enrollment, today);
  if (phase === "current") return "occupied";
  if (phase === "upcoming") return "committed";
  return "released";
};

export const occupiesSlot = (
  enrollment: Pick<Enrollment, "status" | "start_date" | "end_date">,
  today?: string,
): boolean => slotPhaseOf(enrollment, today) === "occupied";

export const isCommittedFutureStart = (
  enrollment: Pick<Enrollment, "status" | "start_date" | "end_date">,
  today?: string,
): boolean => slotPhaseOf(enrollment, today) === "committed";

export const toDateKey = (value: Date): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
