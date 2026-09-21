import type { Identifier } from "ra-core";

import type { Enrollment } from "../types";
import { projectedEndDate, type ProjectedEnd } from "./projectedEnd";
import { slotPhaseOf, toDateKey } from "./slotOccupancy";

// One Enrollment's claim on one of an individual Offer's slots, carrying
// enough identity to name the human being on a page.
export type SlotHolder = {
  enrollmentId: Identifier;
  contactId: Identifier | null;
  name: string;
  status: Enrollment["status"];
  startDate: string | null;
  end: ProjectedEnd;
};

export type SlotEnrollment = Pick<
  Enrollment,
  "id" | "status" | "start_date" | "end_date"
> & {
  contactId?: Identifier | null;
  name?: string;
};

export type IndividualCapacity = {
  max: number | null;
  // People Leif is working with right now.
  active: number;
  // max - active, never below zero. An over-capacity database is a real
  // condition with a real name; it is not "minus two openings".
  openings: number | null;
  // How far past the ceiling the current occupancy actually is. Zero
  // unless something has gone wrong, and then the number is the whole
  // point — it is what makes the situation legible instead of clamped
  // away.
  overCapacityBy: number;
  occupied: SlotHolder[];
  // Agreed and set up, not started. A real obligation against a future
  // slot, and deliberately NOT counted as active: these are the six rows
  // that made the dashboard say eighteen.
  committed: SlotHolder[];
  // Occupied slots whose finish nobody can compute. They hold a slot now,
  // so they count toward `active`, but they cannot appear in the future
  // openings maths without inventing a date.
  unknownEnd: SlotHolder[];
};

const toSlotHolder = (
  enrollment: SlotEnrollment,
  durationMonths: number | null,
): SlotHolder => ({
  enrollmentId: enrollment.id,
  contactId: enrollment.contactId ?? null,
  name: enrollment.name ?? "",
  status: enrollment.status,
  startDate: enrollment.start_date ?? null,
  end: projectedEndDate(enrollment, durationMonths),
});

export const computeIndividualCapacity = (
  enrollments: SlotEnrollment[],
  max: number | null,
  durationMonths: number | null,
  now: Date = new Date(),
): IndividualCapacity => {
  const today = toDateKey(now);
  const occupied: SlotHolder[] = [];
  const committed: SlotHolder[] = [];

  for (const enrollment of enrollments) {
    const phase = slotPhaseOf(enrollment, today);
    if (phase === "released") continue;
    const holder = toSlotHolder(enrollment, durationMonths);
    (phase === "occupied" ? occupied : committed).push(holder);
  }

  const active = occupied.length;
  return {
    max,
    active,
    openings: max == null ? null : Math.max(max - active, 0),
    overCapacityBy: max == null ? 0 : Math.max(active - max, 0),
    occupied: occupied.sort(byEndThenName),
    committed: committed.sort(byStartThenName),
    unknownEnd: occupied.filter((holder) => holder.end.basis === "unknown"),
  };
};

// Soonest to finish first — the order Leif reads the list in when the
// question is "who frees up next". A holder with no computable end sorts
// last rather than being treated as ending today.
const byEndThenName = (a: SlotHolder, b: SlotHolder): number => {
  const aKey = a.end.date ?? "";
  const bKey = b.end.date ?? "";
  if (aKey !== bKey) {
    if (!aKey) return 1;
    if (!bKey) return -1;
    return aKey.localeCompare(bKey);
  }
  return a.name.localeCompare(b.name);
};

const byStartThenName = (a: SlotHolder, b: SlotHolder): number => {
  const aKey = a.startDate ?? "";
  const bKey = b.startDate ?? "";
  if (aKey !== bKey) {
    if (!aKey) return 1;
    if (!bKey) return -1;
    return aKey.localeCompare(bKey);
  }
  return a.name.localeCompare(b.name);
};

// One month in which the shape of the practice changes.
export type OpeningsMonth = {
  // YYYY-MM.
  month: string;
  // Containers projected to finish in this month.
  freeing: SlotHolder[];
  // Already-agreed containers starting in this month.
  committing: SlotHolder[];
  // Slots free once this month's departures and arrivals have both
  // happened. Negative means Leif has promised more starts than he will
  // have room for — a fact worth seeing, not a number to clamp.
  netAvailableAfter: number;
};

export type FutureOpenings = {
  months: OpeningsMonth[];
  // Occupied containers with no computable end date. They are absent from
  // every month above, so the projection is knowingly incomplete by
  // exactly this many people, and says so.
  unknownEnd: SlotHolder[];
};

// When occupied slots become available, netted against what has already
// been promised.
//
// "Two openings in November" is a useful sentence only if it is still true
// after the people already booked to start in November have started. Leif
// has six future starts agreed; a board that showed departures alone would
// have invited him to sell slots he had already sold. So arrivals and
// departures are counted in the same ledger, and the running total is what
// the page reports.
//
// Months with nothing happening are omitted rather than padded — this is a
// list of changes, not a calendar.
export const computeFutureOpenings = (
  capacity: IndividualCapacity,
  now: Date = new Date(),
): FutureOpenings => {
  if (capacity.max == null) return { months: [], unknownEnd: [] };

  const today = toDateKey(now);
  const byMonth = new Map<
    string,
    { freeing: SlotHolder[]; committing: SlotHolder[] }
  >();
  const bucket = (month: string) => {
    const existing = byMonth.get(month);
    if (existing) return existing;
    const created = { freeing: [], committing: [] } as {
      freeing: SlotHolder[];
      committing: SlotHolder[];
    };
    byMonth.set(month, created);
    return created;
  };

  for (const holder of capacity.occupied) {
    // A container whose computed end is already behind us frees nothing
    // in the future — it is either about to be closed out by hand, or its
    // projection has simply been overtaken. Either way it is not a date
    // to plan around.
    if (!holder.end.date || holder.end.date < today) continue;
    bucket(holder.end.date.slice(0, 7)).freeing.push(holder);
  }
  for (const holder of capacity.committed) {
    if (!holder.startDate) continue;
    bucket(holder.startDate.slice(0, 7)).committing.push(holder);
  }

  let running = Math.max(capacity.max - capacity.active, 0);
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, entry]) => {
      running += entry.freeing.length - entry.committing.length;
      return {
        month,
        freeing: entry.freeing.sort(byEndThenName),
        committing: entry.committing.sort(byStartThenName),
        netAvailableAfter: running,
      };
    });

  return { months, unknownEnd: capacity.unknownEnd };
};
