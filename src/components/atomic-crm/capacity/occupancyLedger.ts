import type { SlotHolder } from "./slotHolder";
import { computeExpectedEnd, type SessionWeek } from "./sessionWeeks";

// How many people are in the programme, at every moment the CRM knows
// about — and from that, the only question Leif actually asks a capacity
// board:
//
//     "When could I safely promise somebody a start?"
//
// This file has been wrong twice, in opposite directions, and both are
// worth remembering because they are the two ways a capacity board lies.
//
// It never gave a committed client their slot BACK: only occupied
// containers were scanned for end dates, so a future start was a permanent
// +1 and every month after it came out one short. And it called a month an
// opening whenever departures outnumbered arrivals inside it — October
// netted +1 while four people arrived in November, so filling that
// "opening" would have meant telling somebody their start was cancelled.
//
// An opening now means what it has to mean to be safe, and there are two
// halves to it, because promising somebody a start is promising two
// different things:
//
//   1. the practice stays within its ceiling for as long as they are in
//      it, and
//   2. their own twelve session weeks actually exist on the calendar.
//
// The second half is not a technicality. Year Tracking currently stops on
// 24 January 2027; a client started in December has nowhere to put
// sessions 4 through 12, and no amount of headroom makes that a real
// opening.

export type SlotEvent = {
  date: string;
  holder: SlotHolder;
  kind: "start" | "end";
};

export type LedgerEntry = SlotEvent & {
  // Occupancy immediately after this event.
  occupiedAfter: number;
  // Ceiling minus occupancy, floored at zero. See `overCapacityAfter` for
  // the other direction — a board that shows "-3 openings" is not saying
  // anything a person can act on.
  remainingAfter: number;
  overCapacityAfter: number;
};

// Same-date ordering: departures are applied before arrivals.
//
// A container ending on the 14th and another starting on the 14th is a
// handover, not a moment when the practice held one extra person. Ordering
// arrivals first would invent a one-day spike and refuse a start that is
// genuinely fine. The rule is written down so it cannot be decided
// differently by accident later.
const KIND_ORDER = { end: 0, start: 1 } as const;

const byDateThenKind = (a: SlotEvent, b: SlotEvent): number =>
  a.date.localeCompare(b.date) ||
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
  a.holder.name.localeCompare(b.holder.name);

// Every future arrival and departure the CRM can derive, in order.
//
// A currently-occupied container contributes only its departure — it is
// already inside the occupancy count. A committed one contributes both,
// and that symmetry is the bug fix: capacity it takes on its Start Date,
// it gives back when its final session week is over.
//
// A container whose end cannot be computed contributes NO departure. It
// holds its slot for the whole horizon, which is the honest consequence of
// not knowing when it finishes, and those people are named rather than
// quietly excluded. That covers both a missing Start Date and a Year
// Tracking calendar that stops before the 12th week.
export const buildSlotEvents = (
  occupied: SlotHolder[],
  committed: SlotHolder[],
  today: string,
): SlotEvent[] => {
  const events: SlotEvent[] = [];
  const freesOn = (holder: SlotHolder) =>
    holder.end?.status === "known" ? holder.end.freesOn : null;

  for (const holder of occupied) {
    const date = freesOn(holder);
    if (date && date >= today) events.push({ date, holder, kind: "end" });
  }
  for (const holder of committed) {
    if (!holder.startDate) continue;
    events.push({ date: holder.startDate, holder, kind: "start" });
    const date = freesOn(holder);
    if (date && date > holder.startDate) {
      events.push({ date, holder, kind: "end" });
    }
  }

  return events.sort(byDateThenKind);
};

export const computeLedger = (
  events: SlotEvent[],
  occupiedToday: number,
  max: number,
): LedgerEntry[] => {
  let occupied = occupiedToday;
  return events.map((event) => {
    occupied += event.kind === "start" ? 1 : -1;
    return {
      ...event,
      occupiedAfter: occupied,
      remainingAfter: Math.max(max - occupied, 0),
      overCapacityAfter: Math.max(occupied - max, 0),
    };
  });
};

// Occupancy on a given date, once that date's events have all happened.
export const occupancyOn = (
  events: SlotEvent[],
  occupiedToday: number,
  date: string,
): number =>
  events.reduce(
    (count, event) =>
      event.date <= date ? count + (event.kind === "start" ? 1 : -1) : count,
    occupiedToday,
  );

// The most people in the programme at any moment in [from, to].
export const peakOccupancyBetween = (
  events: SlotEvent[],
  occupiedToday: number,
  from: string,
  to: string,
): number => {
  let peak = occupancyOn(events, occupiedToday, from);
  let running = peak;
  for (const event of events) {
    if (event.date <= from) continue;
    if (event.date > to) break;
    running += event.kind === "start" ? 1 : -1;
    if (running > peak) peak = running;
  }
  return peak;
};

export type OpeningsAnswer =
  | { status: "known"; openings: number; peakOccupancy: number }
  // The calendar does not reach far enough to seat a new client's own
  // twelve weeks, so whether they could start is not a question the CRM
  // can answer yet. Never rendered as a zero, and never as an opening.
  | {
      status: "unknown";
      reason: "calendar_too_short";
      weeksScheduled: number;
      weeksRequired: number;
    };

// How many NEW clients could start on `date` — meaning both halves: the
// ceiling holds for the whole of their container, and their twelve session
// weeks exist.
export const safeOpeningsStartingOn = (
  events: SlotEvent[],
  occupiedToday: number,
  max: number,
  date: string,
  weeks: SessionWeek[],
): OpeningsAnswer => {
  // Could this person even be scheduled? Asked first, because a practice
  // with ten free slots and no calendar still cannot take anybody.
  const newContainer = computeExpectedEnd(weeks, date, 0);
  if (!newContainer || newContainer.status === "incomplete") {
    return {
      status: "unknown",
      reason: "calendar_too_short",
      weeksScheduled: newContainer?.weeksScheduled ?? 0,
      weeksRequired: newContainer?.weeksRequired ?? 12,
    };
  }

  // A new client is one more person for the whole of their own container,
  // so the ceiling has to hold with them in it, right through to the end
  // of their twelfth session week.
  const peak = peakOccupancyBetween(
    events,
    occupiedToday,
    date,
    newContainer.freesOn,
  );
  return {
    status: "known",
    openings: Math.max(max - peak, 0),
    peakOccupancy: peak,
  };
};
